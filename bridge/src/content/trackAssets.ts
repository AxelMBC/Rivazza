import fs from "node:fs";
import path from "node:path";

import type { MapMeta, TrackEdges } from "@rivazza/protocol";

import { AC_PATH } from "./acPath.js";
import { resolveTrackEdges } from "./aiSpline.js";

export type TrackAssets = {
  meta: MapMeta | null;
  edges: TrackEdges | null;
};

export type ReadLayoutTokens = () => Promise<ReadonlySet<string>>;

const trackRootPath = (track: string): string =>
  path.join(AC_PATH, "content", "tracks", track);
const mapIniPath = (dir: string): string => path.join(dir, "data", "map.ini");
const fastLanePath = (dir: string): string =>
  path.join(dir, "ai", "fast_lane.ai");

const parseMapIni = (iniPath: string): MapMeta | null => {
  const values: Record<string, number> = {};
  for (const line of fs.readFileSync(iniPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(-?[\d.]+)/);
    if (match) values[match[1]] = Number(match[2]);
  }
  const { WIDTH, HEIGHT, X_OFFSET, Z_OFFSET, SCALE_FACTOR } = values;
  const allFinite = [WIDTH, HEIGHT, X_OFFSET, Z_OFFSET, SCALE_FACTOR].every(
    Number.isFinite,
  );
  if (!allFinite || WIDTH <= 0 || HEIGHT <= 0 || SCALE_FACTOR <= 0) return null;
  return {
    width: WIDTH,
    height: HEIGHT,
    xOffset: X_OFFSET,
    zOffset: Z_OFFSET,
    scaleFactor: SCALE_FACTOR,
  };
};

export const resolveTrackAssets = (
  track: string,
  trackConfig: string,
): TrackAssets | null => {
  const trackRoot = trackRootPath(track);
  const candidates = trackConfig
    ? [path.join(trackRoot, trackConfig), trackRoot]
    : [trackRoot];

  let meta: MapMeta | null = null;
  for (const dir of candidates) {
    const iniPath = mapIniPath(dir);
    if (!fs.existsSync(iniPath)) continue;
    try {
      meta = parseMapIni(iniPath);
      if (meta) break;
    } catch (err) {
      console.error(`[map] failed to parse ${iniPath}:`, err);
    }
  }

  // On a multi-layout track the root fast_lane.ai describes another layout,
  // so a layout file that fails validation must not fall through to it.
  let edges: TrackEdges | null = null;
  for (const dir of candidates) {
    const aiPath = fastLanePath(dir);
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
  return { meta, edges };
};

// Multi-layout tracks (ks_highlands, ks_nurburgring, …) keep every map.ini
// and fast_lane.ai under a per-layout folder, nothing at the track root.
const listTrackConfigs = (track: string): string[] => {
  const trackRoot = trackRootPath(track);
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
        fs.existsSync(mapIniPath(path.join(trackRoot, name))) ||
        fs.existsSync(fastLanePath(path.join(trackRoot, name))),
    );
};

// Whole-token match: the layout "nordschleife" is a substring of the track id
// "ks_nordschleife", so a substring scan picks it over the loaded "endurance".
const resolveLoadedLayout = async (
  configs: string[],
  readLayoutTokens: ReadLayoutTokens,
): Promise<string | null> => {
  const tokens = await readLayoutTokens();
  return (
    [...configs]
      .sort((a, b) => b.length - a.length)
      .find((name) => tokens.has(name)) ?? null
  );
};

export const resolveTrackAssetsForSession = async (
  track: string,
  handshakeConfig: string,
  readLayoutTokens: ReadLayoutTokens,
): Promise<TrackAssets | null> => {
  const direct = resolveTrackAssets(track, handshakeConfig);
  if (direct) return direct;

  const configs = listTrackConfigs(track);
  if (configs.length === 0) return null;
  if (configs.length === 1) return resolveTrackAssets(track, configs[0]);

  const layout = await resolveLoadedLayout(configs, readLayoutTokens);
  if (!layout) {
    console.warn(
      `[map] track ${JSON.stringify(track)} has ${configs.length} layouts (${configs.join(", ")}) ` +
        `and the loaded one couldn't be read from shared memory — drawing the driven line`,
    );
    return null;
  }
  console.log(
    `[map] resolved layout ${JSON.stringify(layout)} for ${JSON.stringify(track)} via shared memory`,
  );
  return resolveTrackAssets(track, layout);
};
