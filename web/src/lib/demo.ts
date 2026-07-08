// Build-time demo flag. Set `VITE_DEMO_MODE=1` for the portfolio build (e.g. on
// Vercel) to replay a recorded session instead of connecting to the live bridge
// — which can't exist on a static host. Unset in normal/local builds, so the
// live WebSocket path in useTelemetry is taken and this is `false`. This is a
// build-time constant, not a runtime toggle: live mode is simply the default
// build with the flag absent.
export const IS_DEMO = Boolean(import.meta.env.VITE_DEMO_MODE);

// Where the committed recording is served from. BASE_URL keeps it correct under
// a subpath deploy. Produced by `npm run record -w bridge` (bridge/src/record.ts).
export const DEMO_RECORDING_URL = `${import.meta.env.BASE_URL}demo/imola.json`;

// Companion track outline (map.ini bounds + AI-spline edges), which the live app
// fetches from the bridge's HTTP API — absent in demo mode, so TrackMap reads
// this static file instead. Written alongside the recording by the recorder.
export const DEMO_MAP_URL = `${import.meta.env.BASE_URL}demo/imola.map.json`;
