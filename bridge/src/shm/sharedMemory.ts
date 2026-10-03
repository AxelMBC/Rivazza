import type { CutEvent, TelemetryFrame } from "@rivazza/protocol";

// SPageFilePhysics is #pragma pack(4) and every member before these is a
// 4-byte scalar or float array, so the offsets are stable.
const MAPPING_NAME = "Local\\acpmf_physics";
const OFF_PACKET_ID = 0; // frozen while paused, in menus, or closed
const OFF_SPEED_KMH = 28;
const OFF_TYRES_OUT = 244;
const READ_SIZE = 256;

// The UDP handshake omits the layout subfolder of multi-layout tracks; the
// static page names it. ~800 B struct, so a 1 KB read stays in its page.
const STATIC_MAPPING_NAME = "Local\\acpmf_static";
const STATIC_READ_SIZE = 1024;

const FILE_MAP_READ = 0x0004;

const POLL_MS = 16; // ~60 Hz nominal; Windows floors short timers near 15.6 ms
const OPEN_RETRY_MS = 3000;
const CUT_TYRES = 4; // AC invalidates a lap at four wheels beyond the limits
const MIN_SPEED_KMH = 10;

type CutDetector = {
  getFrame: () => TelemetryFrame | null;
  isLive: () => boolean;
  onCut: (cut: CutEvent) => void;
};

type Kernel32 = {
  openMapping: (name: string) => unknown;
  mapView: (handle: unknown) => unknown;
  copyOut: (dest: Buffer, view: unknown, len: number) => void;
  unmapView: (view: unknown) => void;
  closeHandle: (handle: unknown) => void;
};

const loadKernel32 = async (): Promise<Kernel32 | null> => {
  try {
    const koffi = (await import("koffi")).default;
    const lib = koffi.load("kernel32.dll");
    const openFileMapping = lib.func("OpenFileMappingW", "void *", [
      "uint32",
      "bool",
      "str16",
    ]);
    const mapViewOfFile = lib.func("MapViewOfFile", "void *", [
      "void *",
      "uint32",
      "uint32",
      "uint32",
      "size_t",
    ]);
    const rtlMoveMemory = lib.func("RtlMoveMemory", "void", [
      "_Out_ uint8 *",
      "void *",
      "size_t",
    ]);
    const unmapViewOfFile = lib.func("UnmapViewOfFile", "bool", ["void *"]);
    const closeHandle = lib.func("CloseHandle", "bool", ["void *"]);
    return {
      openMapping: (name) => openFileMapping(FILE_MAP_READ, false, name),
      mapView: (handle) => mapViewOfFile(handle, FILE_MAP_READ, 0, 0, 0),
      copyOut: (dest, view, len) => rtlMoveMemory(dest, view, len),
      unmapView: (view) => unmapViewOfFile(view),
      closeHandle: (handle) => closeHandle(handle),
    };
  } catch (err) {
    console.log(
      "[shm] koffi unavailable, cut detection off:",
      (err as Error).message,
    );
    return null;
  }
};

let kernelPromise: Promise<Kernel32 | null> | null = null;
const kernel32 = (): Promise<Kernel32 | null> =>
  (kernelPromise ??= loadKernel32());

export const readStaticPage = async (): Promise<Buffer | null> => {
  if (process.platform !== "win32" || process.env.AC_SHM === "0") return null;
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

export const startCutDetection = (detector: CutDetector): (() => void) => {
  if (process.platform !== "win32") return () => {};
  if (process.env.AC_SHM === "0") {
    console.log("[shm] cut detection disabled (AC_SHM=0)");
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
    const packetId = page.readInt32LE(OFF_PACKET_ID);
    if (packetId === lastPacketId) return;
    lastPacketId = packetId;

    const tyresOut = page.readInt32LE(OFF_TYRES_OUT);
    const isOut = tyresOut >= CUT_TYRES;
    const onset = isOut && !wasOut;
    wasOut = isOut;
    if (!onset) return;

    const frame = detector.getFrame();
    const speedKmh = page.readFloatLE(OFF_SPEED_KMH);
    if (!detector.isLive() || !frame || frame.inPit || speedKmh < MIN_SPEED_KMH)
      return;
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
    if (handle == null) return;
    view = k32.mapView(handle);
    if (view == null) {
      k32.closeHandle(handle);
      handle = null;
      return;
    }
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = null;
    console.log("[shm] physics page mapped, cut detection live");
    pollTimer = setInterval(poll, POLL_MS);
  };

  void kernel32().then((lib) => {
    if (!lib || stopped) return;
    k32 = lib;
    tryOpen();
    if (view == null) {
      console.log(
        "[shm] physics page not available (is AC running on this PC?), retrying quietly",
      );
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
