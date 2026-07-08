## Context

The dashboard's data source is a long-lived Node bridge on the same PC as Assetto Corsa: it ingests AC's UDP telemetry, maps AC's `acpmf_physics` shared memory (native `koffi`, Windows-only) for cut detection, and rebroadcasts a `BridgeMessage` stream (`status` | `session` | `telemetry` | `cut`) over WebSocket. The React app (`useTelemetry`) is the sole consumer of that wire stream and fans it out to every visual.

Vercel hosts static assets and short-lived serverless functions — it cannot run a persistent UDP listener, a long-lived WebSocket server, or native shared-memory FFI. So a hosted demo cannot "connect to a bridge that isn't there." It must instead **replay a previously recorded stream** entirely in the browser.

The clean seam is the WebSocket message boundary: the web app already treats `BridgeMessage` as its contract. If we capture that exact stream once and replay it into the same state/refs, every downstream visual works with zero changes.

## Goals / Non-Goals

**Goals:**

- Publish a public, install-free demo on Vercel that faithfully shows the dashboard driving ~3 laps of Imola.
- Reuse the existing `BridgeMessage` contract end to end — no new wire types, no `types.ts` divergence.
- Zero behavior change for the live path: a normal build is byte-for-byte what it is today.
- Keep the demo recording current with the app on a single branch (no divergent long-lived branch).

**Non-Goals:**

- Interactivity beyond playback (no scrubbing, no speed control) — out of scope for a first demo; can be added later.
- Server-side demo data or a serverless replay endpoint — the recording is a static asset.
- Recording the raw UDP or shared-memory layer — we record at the WebSocket boundary, which is higher-level and already the app's contract.
- Making the recorder a production bridge feature — it is a dev/authoring tool.

## Decisions

**Record at the WebSocket boundary, not UDP.** The recorder is a plain WS client (`bridge/src/record.ts`) that subscribes like the browser does and appends `{ t, msg }` entries (relative ms + verbatim message) to a JSON file. *Alternative considered:* teeing UDP frames or shared-memory samples — rejected because it would duplicate all of `parsers.ts`/`sharedMemory.ts` derivation logic in the replay path and re-introduce the exact fragility the bridge exists to hide. Recording the already-derived `BridgeMessage` stream means replay is trivially faithful.

**Build-time Vite flag, not runtime env or branch.** Demo selection is `import.meta.env.VITE_DEMO_MODE`, resolved at build time and set in Vercel's project env. *Alternatives considered:* (a) a runtime env var — a static SPA has no server to read one, so this doesn't exist without adding serverless indirection; (b) a dedicated `demo` branch — it would diverge from `master`, rot, and force merges to keep the demo abreast of features. A build flag keeps one branch and one code path with a guarded fork.

**Replay drives the same state/refs as the live path.** In demo mode `useTelemetry` takes an early branch: instead of `connect()`, it `fetch`es `/demo/imola.json`, then schedules emissions honoring recorded inter-frame deltas, calling the same `setStatus`/`setSession`/`setTelemetry`+`telemetryRef`/`cutsRef`+`setCutSeq` sinks. Looping re-runs the sequence, using the existing `clearFrame()` reset semantics so a loop reads as a fresh session. The reconnect timer and `WebSocket` are never touched in this branch.

**Recording committed as a static public asset.** `web/public/demo/imola.json` ships in the build and is served by Vercel at `/demo/imola.json`. It lives on `master`, so it updates alongside the code that consumes it.

**Timing via accumulated `setTimeout` against recorded deltas.** Simple and adequate for playback; frame cadence need not be perfect (the live path is already throttled/interpolated downstream). A drift-corrected scheduler (compare wall-clock to expected offset) keeps long recordings from lagging.

## Risks / Trade-offs

- **Recording size / repo bloat** → ~3 laps at 60 Hz is tens of thousands of small JSON objects. Mitigation: it is telemetry numbers, gzips well over the wire, and can be minified (no whitespace) / trimmed to the fields the app reads; keep a single track. If it grows uncomfortable, switch to JSONL + streamed parse later.
- **Recording drifts from the wire contract** → if `BridgeMessage` shapes change later, an old recording could miss new fields. Mitigation: recording is on `master` and re-recordable in minutes; downstream already tolerates optional/absent fields. Document a re-record step.
- **Demo build accidentally shipping to the live/local path** (or vice-versa) → Mitigation: single flag, defaulting off; live behavior is the untouched fall-through. Add the flag only in Vercel's env, never in local `.env`.
- **Loop seam looks abrupt** → a hard restart may snap the car position. Mitigation: reuse `clearFrame()` so it reads as a new session; optionally record a clean out-lap→in-lap so start and end positions are close.
- **Viewer mistakes recorded data for live** → Mitigation: the required "Demo" indicator.

## Migration Plan

1. Add the recorder script + npm script; verify it captures against the existing mock (`npm run mock`) with no bridge changes.
2. Add the `VITE_DEMO_MODE`-guarded replay branch to `useTelemetry` and the demo indicator; confirm a normal build is unchanged and a `VITE_DEMO_MODE=1 npm run dev -w web` build replays a mock recording.
3. Record ~3 real laps of Imola; commit `web/public/demo/imola.json`.
4. Configure Vercel: build the `web` workspace with `VITE_DEMO_MODE=1`; document root/build settings.
5. **Rollback:** unset the Vercel env var (reverts to live/blank behavior) or revert the `useTelemetry` diff — the live path is untouched either way.

## Open Questions

- Final recording location/name if multiple demo tracks are wanted later (`/demo/<track>.json` + a selector) — start with a single Imola file.
- Whether to minify/trim the recording in the recorder itself or as a build step — default to writing compact JSON from the recorder.
