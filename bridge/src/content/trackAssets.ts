import fs from "node:fs";
import path from "node:path";

import type { MapMeta, TrackEdges } from "@rivazza/protocol";

import { readStaticPageTokens } from "../shm/kernel32.js";

import { AC_PATH } from "./acPath.js";
import { resolveTrackEdges } from "./aiSpline.js";

export type TrackAssets = {
  meta: MapMeta | null;
  mapImagePath: string | null;
  edges: TrackEdges | null;
};

const parseMapIni = (iniPath: string): MapMeta | null => {
  const values: Record<string, number> = {};
  for (const line of fs.readFileSync(iniPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_]+)\s*=\s*(-?[\d.]+)/);
    if (match) values[match[1]] = Number(match[2]);
  }
  const { WIDTH, HEIGHT, X_OFFSET, Z_OFFSET, SCALE_FACTOR } = values;
  if (
    [WIDTH, HEIGHT, X_OFFSET, Z_OFFSET, SCALE_FACTOR].some(
      (v) => v === undefined,
    )
  )
    return null;
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
  const trackRoot = path.join(AC_PATH, "content", "tracks", track);
  const candidates = trackConfig
    ? [path.join(trackRoot, trackConfig), trackRoot]
    : [trackRoot];

  let meta: MapMeta | null = null;
  let mapImagePath: string | null = null;
  for (const dir of candidates) {
    const iniPath = path.join(dir, "data", "map.ini");
    if (!fs.existsSync(iniPath)) continue;
    try {
      meta = parseMapIni(iniPath);
      if (!meta) continue;
      const imagePath = path.join(dir, "map.png");
      mapImagePath = fs.existsSync(imagePath) ? imagePath : null;
      break;
    } catch (err) {
      console.error(`[map] failed to parse ${iniPath}:`, err);
    }
  }

  // On a multi-layout track the root fast_lane.ai describes another layout,
  // so a layout file that fails validation must not fall through to it.
  let edges: TrackEdges | null = null;
  for (const dir of candidates) {
    const aiPath = path.join(dir, "ai", "fast_lane.ai");
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

// Multi-layout tracks (ks_highlands, ks_nurburgring, …) keep every map.ini
// and fast_lane.ai under a per-layout folder, nothing at the track root.
const listTrackConfigs = (track: string): string[] => {
  const trackRoot = path.join(AC_PATH, "content", "tracks", track);
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
        fs.existsSync(path.join(trackRoot, name, "data", "map.ini")) ||
        fs.existsSync(path.join(trackRoot, name, "ai", "fast_lane.ai")),
    );
};

// Whole-token match: the layout "nordschleife" is a substring of the track id
// "ks_nordschleife", so a substring scan picks it over the loaded "endurance".
const resolveLoadedLayout = async (
  configs: string[],
): Promise<string | null> => {
  const tokens = await readStaticPageTokens();
  return (
    [...configs]
      .sort((a, b) => b.length - a.length)
      .find((name) => tokens.has(name)) ?? null
  );
};

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
