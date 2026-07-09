import fs from 'node:fs';
import path from 'node:path';
import { resolveTrackEdges } from './aiSpline.js';
import { readStaticPage } from './sharedMemory.js';
import type { MapMeta, TrackEdges } from './types.js';

const DEFAULT_AC_PATH = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\assettocorsa';
const STEAM_LIBRARY_CONFIGS = [
  'C:\\Program Files (x86)\\Steam\\config\\libraryfolders.vdf',
  'C:\\Program Files\\Steam\\config\\libraryfolders.vdf',
];

// AC_PATH override -> any Steam library containing assettocorsa -> default.
const discoverAcPath = (): string => {
  if (process.env.AC_PATH) return process.env.AC_PATH;
  for (const vdfPath of STEAM_LIBRARY_CONFIGS) {
    let vdf: string;
    try {
      vdf = fs.readFileSync(vdfPath, 'utf8');
    } catch {
      continue;
    }
    // libraryfolders.vdf lists every library (default included) as "path" "X:\\...".
    for (const match of vdf.matchAll(/"path"\s+"([^"]+)"/g)) {
      const library = match[1].replace(/\\\\/g, '\\');
      const candidate = path.join(library, 'steamapps', 'common', 'assettocorsa');
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return DEFAULT_AC_PATH;
};

export const AC_PATH = discoverAcPath();
if (fs.existsSync(AC_PATH)) {
  console.log(`[map] using AC install at ${AC_PATH}`);
} else {
  console.warn(
    `[map] AC install not found at ${AC_PATH} — set the AC_PATH env var to your assettocorsa folder`,
  );
}

// The three assets resolve independently: meta (data/map.ini) fixes the
// viewport, edges (ai/fast_lane.ai) depict the track limits, and the image
// exists but is deliberately never drawn by the web app.
export type TrackAssets = {
  meta: MapMeta | null;
  mapImagePath: string | null;
  edges: TrackEdges | null;
};

const parseMapIni = (iniPath: string): MapMeta | null => {
  const values: Record<string, number> = {};
  for (const line of fs.readFileSync(iniPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(-?[\d.]+)/);
    if (match) values[match[1]] = Number(match[2]);
  }
  const { WIDTH, HEIGHT, X_OFFSET, Z_OFFSET, SCALE_FACTOR } = values;
  if ([WIDTH, HEIGHT, X_OFFSET, Z_OFFSET, SCALE_FACTOR].some((v) => v === undefined)) return null;
  return {
    width: WIDTH,
    height: HEIGHT,
    xOffset: X_OFFSET,
    zOffset: Z_OFFSET,
    scaleFactor: SCALE_FACTOR,
  };
};

// Layout-specific assets live in content/tracks/<track>/<config>/, base
// (single-layout) tracks keep them at the track root.
export const resolveTrackAssets = (track: string, trackConfig: string): TrackAssets | null => {
  const trackRoot = path.join(AC_PATH, 'content', 'tracks', track);
  const candidates = trackConfig ? [path.join(trackRoot, trackConfig), trackRoot] : [trackRoot];

  let meta: MapMeta | null = null;
  let mapImagePath: string | null = null;
  for (const dir of candidates) {
    const iniPath = path.join(dir, 'data', 'map.ini');
    if (!fs.existsSync(iniPath)) continue;
    try {
      meta = parseMapIni(iniPath);
      if (!meta) continue;
      const imagePath = path.join(dir, 'map.png');
      mapImagePath = fs.existsSync(imagePath) ? imagePath : null;
      break;
    } catch (err) {
      console.error(`[map] failed to parse ${iniPath}:`, err);
    }
  }

  // First existing fast_lane.ai wins with no fallthrough: on a multi-layout
  // track the root spline describes a different layout, so a layout file
  // that fails validation must not fall back to it.
  let edges: TrackEdges | null = null;
  for (const dir of candidates) {
    const aiPath = path.join(dir, 'ai', 'fast_lane.ai');
    if (!fs.existsSync(aiPath)) continue;
    edges = resolveTrackEdges(aiPath, meta);
    break;
  }

  if (!meta && !edges) {
    // JSON.stringify exposes invisible characters in the handshake strings.
    console.warn(
      `[map] no map data found for track ${JSON.stringify(track)} (config ${JSON.stringify(trackConfig)})`,
    );
    return null;
  }
  return { meta, mapImagePath, edges };
};

// Layout subfolders that actually carry map assets. Multi-layout tracks
// (ks_highlands, ks_nurburgring, …) keep nothing at the track root — every
// map.ini / fast_lane.ai lives under a per-layout folder — so this is how we
// discover the candidate configs when the handshake didn't name one.
const listTrackConfigs = (track: string): string[] => {
  const trackRoot = path.join(AC_PATH, 'content', 'tracks', track);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(trackRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter(
      (name) =>
        fs.existsSync(path.join(trackRoot, name, 'data', 'map.ini')) ||
        fs.existsSync(path.join(trackRoot, name, 'ai', 'fast_lane.ai')),
    );
};

// Which of a track's layout folders is loaded, read from the static
// shared-memory page's trackConfiguration field. AC stores the exact
// subfolder name (e.g. "layout_int"), so a garbage-tolerant substring scan of
// the page — the same philosophy as readWideString — picks it out without
// depending on the field's struct offset. Longest-first so a longer folder
// name wins over any shorter one it contains. Null when the page can't be
// read (non-Windows, AC_SHM=0, remote host) or names no known layout.
const resolveLoadedLayout = async (configs: string[]): Promise<string | null> => {
  const page = await readStaticPage();
  if (!page) return null;
  const text = page.toString('utf16le');
  return [...configs].sort((a, b) => b.length - a.length).find((name) => text.includes(name)) ?? null;
};

// Full session resolution: the handshake config first (correct for
// single-layout tracks and any track that reports its subfolder), then the
// multi-layout fallback that discovers the layout folders and asks shared
// memory which one is loaded. Kept separate from the sync resolveTrackAssets
// so the pure file lookup stays testable and side-effect free.
export const resolveTrackAssetsForSession = async (
  track: string,
  handshakeConfig: string,
): Promise<TrackAssets | null> => {
  const direct = resolveTrackAssets(track, handshakeConfig);
  if (direct) return direct;

  const configs = listTrackConfigs(track);
  if (configs.length === 0) return null;
  if (configs.length === 1) return resolveTrackAssets(track, configs[0]);

  const layout = await resolveLoadedLayout(configs);
  if (!layout) {
    console.warn(
      `[map] track ${JSON.stringify(track)} has ${configs.length} layouts (${configs.join(', ')}) ` +
        `and the loaded one couldn't be read from shared memory — drawing the driven line`,
    );
    return null;
  }
  console.log(`[map] resolved layout ${JSON.stringify(layout)} for ${JSON.stringify(track)} via shared memory`);
  return resolveTrackAssets(track, layout);
};
