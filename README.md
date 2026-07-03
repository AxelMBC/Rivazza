# Assetto Corsa Live Telemetry

Live dashboard for Assetto Corsa (original): track, car, lap times, speed/gear/pedals,
and a 2D track map with a dot showing your car's position in real time.

```
Assetto Corsa ──UDP 9996──▶ bridge (Node) ──WebSocket──▶ React app (browser)
                              │
                              └── serves the track's map.png + map.ini from the game folder
```

- **`bridge/`** — Node + TypeScript. Speaks AC's remote telemetry UDP protocol
  (handshake → subscribe → RTCarInfo stream), rebroadcasts frames over WebSocket at
  30 Hz on port **3001**, and serves the current track's map image and projection
  metadata over HTTP.
- **`web/`** — React + Vite + Tailwind (TypeScript). Connects to the bridge and renders
  the dashboard, including the canvas track map.

## Quick start

```sh
npm install
npm run dev        # starts bridge (:3001) + web app (:5173)
```

Open **http://localhost:5173**, then start Assetto Corsa and enter any session
(practice, race…). The dashboard connects automatically — no game configuration or
mods needed. Exit to the menu and start a different track/car and it follows along.

## Demo without the game

```sh
npm run mock -w bridge
```

Runs a fake Assetto Corsa on UDP 9996 that streams a car lapping Magione.
**Stop it before playing the real game** — both bind port 9996.

## Configuration (env vars for the bridge)

| Variable | Default | Purpose |
|---|---|---|
| `AC_PATH` | `C:\Program Files (x86)\Steam\steamapps\common\assettocorsa` | Game folder (for track maps) |
| `AC_HOST` | `127.0.0.1` | Machine running the game |
| `AC_PORT` | `9996` | AC remote telemetry port |
| `BRIDGE_PORT` | `3001` | Bridge HTTP/WebSocket port |

## Notes

- Tracks without a `map.png` (some partially-installed DLC / mods) fall back to
  drawing your driving line — the outline appears as you drive.
- The map projection is `pixel = (world + OFFSET) / SCALE_FACTOR` from the track's
  `data/map.ini`. If the dot ever appears mirrored on some track, flip the X term in
  `web/src/components/TrackMap.tsx` (`project`).
