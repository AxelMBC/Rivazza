// Usage:
//   npm run record -w bridge -- --out ../web/public/demo/imola.json
//   npm run record -w bridge -- --host 127.0.0.1 --port 3001 --duration 300
// Stop with Ctrl-C (or let --duration elapse); the file is written on exit.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { WebSocket } from "ws";

import type { BridgeMessage } from "./types.js";

// `npm run record -w bridge` runs with the CWD set to the bridge workspace, so
// paths resolve against the repo root instead — otherwise --out would bury the
// recording under bridge/ rather than where the web app reads it.
const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const DEFAULT_OUT = "web/public/demo/imola.json";

type Recording = { t: number; msg: BridgeMessage }[];

const parseArgs = (argv: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        out[key] = next;
        i++;
      } else {
        out[key] = "true";
      }
    }
  }
  return out;
};

const args = parseArgs(process.argv.slice(2));
const host = args.host ?? process.env.AC_HOST ?? "127.0.0.1";
const port = args.port ?? process.env.BRIDGE_PORT ?? "3001";
const rawOut = args.out ?? DEFAULT_OUT;
const outPath = path.isAbsolute(rawOut)
  ? rawOut
  : path.resolve(REPO_ROOT, rawOut);
const durationSec = args.duration ? Number(args.duration) : null;

const url = `ws://${host}:${port}/ws`;
const httpBase = `http://${host}:${port}`;
// Companion file holding the track outline the web app normally fetches from
// the bridge's HTTP API; in demo mode there is no bridge, so TrackMap reads
// this instead.
const mapOutPath = outPath.replace(/\.json$/i, "") + ".map.json";
const recording: Recording = [];
let mapAssets: { meta: unknown; edges: unknown } | null = null;
let mapFetched = false;
let startedAt: number | null = null;
let wrote = false;

const captureMap = async (): Promise<void> => {
  if (mapFetched) return;
  mapFetched = true;
  const get = async (p: string): Promise<unknown> => {
    try {
      const res = await fetch(`${httpBase}${p}`);
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  };
  const [meta, edges] = await Promise.all([
    get("/api/track-map/meta"),
    get("/api/track-map/edges"),
  ]);
  if (meta || edges) {
    mapAssets = { meta, edges };
    console.log(
      `[record] captured track map (meta:${!!meta} edges:${!!edges})`,
    );
  } else {
    console.log("[record] no track map served by the bridge for this track");
  }
};

const write = (): void => {
  if (wrote) return;
  wrote = true;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(recording));
  if (mapAssets) fs.writeFileSync(mapOutPath, JSON.stringify(mapAssets));
  const counts = recording.reduce<Record<string, number>>((acc, { msg }) => {
    acc[msg.type] = (acc[msg.type] ?? 0) + 1;
    return acc;
  }, {});
  const spanMs = recording.length ? recording[recording.length - 1].t : 0;
  console.log(
    `[record] wrote ${recording.length} messages (${(spanMs / 1000).toFixed(1)}s) to ${outPath}`,
  );
  console.log(`[record] by type: ${JSON.stringify(counts)}`);
  if (mapAssets) console.log(`[record] wrote track map to ${mapOutPath}`);
};

console.log(`[record] connecting to ${url} …`);
const socket = new WebSocket(url);

socket.on("open", () => {
  console.log("[record] connected — capturing. Stop with Ctrl-C.");
  if (durationSec) {
    setTimeout(() => {
      console.log(`[record] duration ${durationSec}s elapsed`);
      socket.close();
    }, durationSec * 1000);
  }
});

socket.on("message", (data) => {
  let msg: BridgeMessage;
  try {
    msg = JSON.parse(data.toString());
  } catch {
    return;
  }
  const now = performance.now();
  if (startedAt === null) startedAt = now;
  recording.push({ t: Math.round(now - startedAt), msg });
  if (msg.type === "session") void captureMap();
  if (recording.length % 600 === 0) {
    console.log(`[record] ${recording.length} messages…`);
  }
});

socket.on("close", () => {
  write();
  process.exit(0);
});

socket.on("error", (err) => {
  console.error(`[record] socket error: ${err.message}`);
  console.error(
    "[record] is the bridge running? (npm run dev, or npm run mock + npm run start)",
  );
  write();
  process.exit(1);
});

const shutdown = (): void => {
  console.log("\n[record] stopping…");
  socket.close();
  // Fallback in case close never fires.
  setTimeout(() => {
    write();
    process.exit(0);
  }, 500);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
