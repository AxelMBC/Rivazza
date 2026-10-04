import fs from "node:fs";
import http from "node:http";
import { pipeline } from "node:stream";

import type { TrackAssets } from "./content/trackAssets.js";

type Route =
  | { kind: "json"; pick: (assets: TrackAssets) => unknown; missing: string }
  | { kind: "png"; pick: (assets: TrackAssets) => string | null };

const ROUTES = new Map<string, Route>([
  [
    "/api/track-map/meta",
    {
      kind: "json",
      pick: (assets) => assets.meta,
      missing: "no map for current track",
    },
  ],
  [
    "/api/track-map/edges",
    {
      kind: "json",
      pick: (assets) => assets.edges,
      missing: "no track edges for current track",
    },
  ],
  [
    "/api/track-map/image",
    { kind: "png", pick: (assets) => assets.mapImagePath },
  ],
]);

const sendJson = (
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const sendNotFound = (res: http.ServerResponse): void => {
  res.writeHead(404);
  res.end();
};

export const createTrackAssetServer = (
  getAssets: () => TrackAssets | null,
): http.Server =>
  http.createServer((req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    const route = ROUTES.get((req.url ?? "").split("?")[0]);
    if (!route) return sendNotFound(res);

    const assets = getAssets();
    if (route.kind === "json") {
      const body = assets ? route.pick(assets) : null;
      if (!body) return sendJson(res, 404, { error: route.missing });
      return sendJson(res, 200, body);
    }

    const imagePath = assets ? route.pick(assets) : null;
    if (!imagePath) return sendNotFound(res);
    res.writeHead(200, { "Content-Type": "image/png" });
    pipeline(fs.createReadStream(imagePath), res, () => {});
  });
