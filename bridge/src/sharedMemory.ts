import type { CutEvent, TelemetryFrame } from './types.js';

// AC publishes SPageFilePhysics as a memory-mapped page on the local machine
// (#pragma pack(4), rewritten every physics tick at ~333 Hz) — the same
// interface SimHub and Crew Chief read. Every struct member before the fields
// read here is a 4-byte scalar or float array, so these offsets are stable
// magic numbers in the parsers.ts tradition — do not "clean them up".
const MAPPING_NAME = 'Local\\acpmf_physics';
const OFF_PACKET_ID = 0; // int32 — frozen while paused / in menus / closed
const OFF_SPEED_KMH = 28; // float32
const OFF_TYRES_OUT = 244; // int32 — the game's own lap-invalidation counter
const READ_SIZE = 256; // covers every field above with headroom

// AC's static page names the loaded track and layout. The UDP handshake
// doesn't report the layout subfolder for multi-layout tracks, so this is the
// only reliable source (see resolveTrackAssetsForSession). ~800 B struct; a
// 1 KB over-read stays inside the same committed page and is safe.
const STATIC_MAPPING_NAME = 'Local\\acpmf_static';
const STATIC_READ_SIZE = 1024;

const FILE_MAP_READ = 0x0004;

const POLL_MS = 16; // ~60 Hz nominal; Windows floors short timers near 15.6 ms
const OPEN_RETRY_MS = 3000; // same cadence as the UDP handshake retry
const CUT_TYRES = 4; // AC invalidates a lap at four wheels beyond the limits
const MIN_SPEED_KMH = 10; // garage / teleport states never count as cuts

type CutDetector = {
  getFrame: () => TelemetryFrame | null;
  isLive: () => boolean;
  onCut: (cut: CutEvent) => void;
};

type Kernel32 = {
  openMapping: (name: string) => unknown; // HANDLE — null while AC isn't running locally
  mapView: (handle: unknown) => unknown; // base pointer — null on failure
  copyOut: (dest: Buffer, view: unknown, len: number) => void;
  unmapView: (view: unknown) => void;
  closeHandle: (handle: unknown) => void;
};

// koffi is this repo's only native dependency; if it fails to load, cut
// detection simply stays off — nothing else depends on it.
const loadKernel32 = async (): Promise<Kernel32 | null> => {
  try {
    const koffi = (await import('koffi')).default;
    const lib = koffi.load('kernel32.dll');
    const openFileMapping = lib.func('OpenFileMappingW', 'void *', ['uint32', 'bool', 'str16']);
    const mapViewOfFile = lib.func('MapViewOfFile', 'void *', ['void *', 'uint32', 'uint32', 'uint32', 'size_t']);
    const rtlMoveMemory = lib.func('RtlMoveMemory', 'void', ['_Out_ uint8 *', 'void *', 'size_t']);
    const unmapViewOfFile = lib.func('UnmapViewOfFile', 'bool', ['void *']);
    const closeHandle = lib.func('CloseHandle', 'bool', ['void *']);
    return {
      openMapping: (name) => openFileMapping(FILE_MAP_READ, false, name),
      mapView: (handle) => mapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0),
      copyOut: (dest, view, len) => rtlMoveMemory(dest, view, len),
      unmapView: (view) => unmapViewOfFile(view),
      closeHandle: (handle) => closeHandle(handle),
    };
  } catch (err) {
    console.log('[shm] koffi unavailable, cut detection off:', (err as Error).message);
    return null;
  }
};

// kernel32 is loaded once and shared by cut detection and the static-page
// reader — koffi's native binding needn't be paid for twice.
let kernelPromise: Promise<Kernel32 | null> | null = null;
const kernel32 = (): Promise<Kernel32 | null> => (kernelPromise ??= loadKernel32());

// One-shot read of AC's static shared-memory page (track/layout/car metadata).
// Windows/same-PC only; returns null anywhere the page can't be mapped
// (non-Windows, AC_SHM=0, koffi failure, AC closed or on another host) so
// callers degrade gracefully. Unlike the physics page this is read on demand,
// not polled — its contents only change between sessions.
export const readStaticPage = async (): Promise<Buffer | null> => {
  if (process.platform !== 'win32' || process.env.AC_SHM === '0') return null;
  const k32 = await kernel32();
  if (!k32) return null;
  const handle = k32.openMapping(STATIC_MAPPING_NAME);
  if (handle == null) return null;
  const view = k32.mapView(handle);
  if (view == null) {
    k32.closeHandle(handle);
    return null;
  }
  try {
    const page = Buffer.alloc(STATIC_READ_SIZE);
    k32.copyOut(page, view, STATIC_READ_SIZE);
    return page;
  } finally {
    k32.unmapView(view);
    k32.closeHandle(handle);
  }
};

// Polls the physics page and turns "numberOfTyresOut reaches 4" onsets into
// cut events stamped from the newest UDP frame (at 60 Hz+ packet arrival the
// position is at most ~1 m stale — sub-pixel at map scale). Returns a stop
// function. Anywhere the page can't be read (non-Windows, AC_SHM=0, koffi
// failure, AC on another PC) this degrades to a no-op with one log line.
export const startCutDetection = (detector: CutDetector): (() => void) => {
  if (process.platform !== 'win32') return () => {};
  if (process.env.AC_SHM === '0') {
    console.log('[shm] cut detection disabled (AC_SHM=0)');
    return () => {};
  }

  let stopped = false;
  let pollTimer: NodeJS.Timeout | null = null;
  let retryTimer: NodeJS.Timeout | null = null;
  let k32: Kernel32 | null = null;
  let handle: unknown = null;
  let view: unknown = null;

  const page = Buffer.alloc(READ_SIZE);
  let lastPacketId: number | null = null;
  let wasOut = false;

  const poll = (): void => {
    if (!k32 || view == null) return;
    k32.copyOut(page, view, READ_SIZE);
    // A frozen packet id means paused, menus, replay, or a closed game —
    // consume nothing so no stale transition can ever fire.
    const packetId = page.readInt32LE(OFF_PACKET_ID);
    if (packetId === lastPacketId) return;
    lastPacketId = packetId;

    const tyresOut = page.readInt32LE(OFF_TYRES_OUT);
    const isOut = tyresOut >= CUT_TYRES;
    const onset = isOut && !wasOut;
    // One event per excursion: re-arms only once back under four out.
    wasOut = isOut;
    if (!onset) return;

    const frame = detector.getFrame();
    const speedKmh = page.readFloatLE(OFF_SPEED_KMH);
    if (!detector.isLive() || !frame || frame.inPit || speedKmh < MIN_SPEED_KMH) return;
    detector.onCut({
      lapCount: frame.lapCount,
      lapTimeMs: frame.lapTimeMs,
      x: frame.x,
      z: frame.z,
      speedKmh: frame.speedKmh,
      tyresOut,
    });
  };

  const tryOpen = (): void => {
    if (!k32 || stopped) return;
    handle = k32.openMapping(MAPPING_NAME);
    if (handle == null) return; // AC not running here yet; retry keeps going
    view = k32.mapView(handle);
    if (view == null) {
      k32.closeHandle(handle);
      handle = null;
      return;
    }
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = null;
    console.log('[shm] physics page mapped, cut detection live');
    pollTimer = setInterval(poll, POLL_MS);
  };

  void kernel32().then((lib) => {
    if (!lib || stopped) return;
    k32 = lib;
    tryOpen();
    if (view == null) {
      console.log('[shm] physics page not available (is AC running on this PC?), retrying quietly');
      retryTimer = setInterval(tryOpen, OPEN_RETRY_MS);
    }
  });

  return () => {
    stopped = true;
    if (pollTimer) clearInterval(pollTimer);
    if (retryTimer) clearInterval(retryTimer);
    if (k32 && view != null) k32.unmapView(view);
    if (k32 && handle != null) k32.closeHandle(handle);
  };
};
