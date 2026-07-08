# Assetto Corsa Live Telemetry

Live dashboard for Assetto Corsa (original): gauges, lap times with live delta,
pedal trace, G-meter, and a 2D track map that draws your driving lines in real time.

```
Assetto Corsa ──UDP 9996──▶ bridge (Node) ──WebSocket :3001──▶ React app :5173
                              │
                              └── serves the track's projection metadata over HTTP
```

- **`bridge/`** — Node + TypeScript. Speaks AC's remote telemetry UDP protocol
  (handshake → subscribe → RTCarInfo stream), rebroadcasts frames over WebSocket at
  60 Hz on port **3001**, and serves the current track's map projection metadata
  over HTTP.
- **`web/`** — React + Vite + Tailwind (TypeScript). Connects to the bridge and renders
  the dashboard, including the canvas track map.

## Features

- Analog speedometer scaled to the current car's real top speed (read from the
  game's car data), plus gear, RPM, and fuel readouts
- Lap time log with validity detection and a live delta against your fastest lap
- Pedal trace (throttle / brake / clutch) and lateral/longitudinal G-meter
- 2D track map with pedal-colored driving lines (green throttle, red brake,
  yellow coast), per-lap colored history, cursor-anchored wheel zoom, and a
  hover speed readout on any lap line
- Mock mode to develop and demo without the game running

## Requirements

- **Node.js ≥ 20.19**
- **Assetto Corsa** (the original, not Competizione) — the bridge auto-discovers
  your Steam library; set `AC_PATH` if it's installed somewhere unusual
- No game configuration or mods needed — AC's remote telemetry is built in

## Quick start

```sh
npm install
npm run dev        # starts bridge (:3001) + web app (:5173)
```

Open **http://localhost:5173**, then start Assetto Corsa and enter any session
(practice, race…). The dashboard connects automatically. Exit to the menu and start
a different track/car and it follows along.

## Demo without the game

```sh
npm run mock -w bridge
```

Runs a fake Assetto Corsa on UDP 9996 that streams a car lapping Magione.
**Stop it before playing the real game** — both bind port 9996.

## Hosted demo (Vercel)

The bridge (UDP + WebSocket + native shared memory) can't run on a static host, so
the deployed demo **replays a recorded session** instead of connecting to a bridge.
Nothing about the live path changes — demo mode is a build-time flag, off by default.

**Record a session** (bridge + game or mock running), then commit the file:

```sh
# captures the exact BridgeMessage stream the web app consumes
npm run record -w bridge -- --out web/public/demo/imola.json --duration 180
# (or omit --duration and stop with Ctrl-C)
```

The recorder is just another WebSocket client — it complements `npm run mock` and
touches nothing in the bridge. It writes two files: `imola.json` (the frame
stream) and `imola.map.json` (the track outline — map.ini bounds + AI-spline
edges — which the live app fetches from the bridge but must be static in demo
mode). Commit both.

**Run the demo locally** (replays the recording, no bridge or game needed):

```powershell
# PowerShell (Windows)
$env:VITE_DEMO_MODE=1; npm run dev -w web
```

```sh
# bash / zsh
VITE_DEMO_MODE=1 npm run dev -w web
```

**Deploy to Vercel:** import the repo and set the project's **Root Directory to
`web`** (Settings → General). Vercel then auto-detects Vite (build `npm run
build`, output `dist`) and `web/vercel.json` sets `VITE_DEMO_MODE=1` plus the
SPA rewrite — so any Vercel build is the demo, with no dashboard env var to
configure and no monorepo path juggling. A normal build/dev (without the flag)
is unchanged and connects to the live bridge as always.

## Configuration (env vars for the bridge)

| Variable | Default | Purpose |
|---|---|---|
| `AC_PATH` | auto-discovered from Steam | Game folder (for track/car data) |
| `AC_HOST` | `127.0.0.1` | Machine running the game |
| `AC_PORT` | `9996` | AC remote telemetry port |
| `BRIDGE_PORT` | `3001` | Bridge HTTP/WebSocket port |

## Development

```sh
npm run dev             # bridge + web together (concurrently)
npm run lint -w web     # oxlint
npm run build           # type-checks the bridge, type-checks + builds the web app
```

There is no test framework; the mock server (`npm run mock -w bridge`) is the main
way to exercise the app end-to-end. Architecture notes live in `CLAUDE.md`, and
feature specs in `openspec/specs/` (the project is spec-driven via
[OpenSpec](https://github.com/Fission-AI/OpenSpec)).

## Notes

- The track map draws your driven lines rather than the game's `map.png` — AC's
  map images are stroked at constant width around the AI line, so they misrepresent
  the real track limits. The `data/map.ini` projection metadata alone fixes the
  viewport; tracks without one fall back to an auto-fit view of the driven line.
- The map projection is `pixel = (world + OFFSET) / SCALE_FACTOR` from the track's
  `data/map.ini`. If the dot ever appears mirrored on some track, flip the X term in
  `web/src/components/TrackMap.tsx` (`project`).

## License

[MIT](LICENSE)
