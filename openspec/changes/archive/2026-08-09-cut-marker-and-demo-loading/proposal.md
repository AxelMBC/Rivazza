## Why

Two defects surfaced while reviewing a recorded Imola session.

A single off-track can paint several × markers on the track map. In the committed demo
recording, lap 3 carries three `cut` events inside one continuous 2-second excursion (396 ms
and ~6 m apart) because AC's `numberOfTyresOut` chatters 4→3→4 as the car bounces across
gravel and kerb, and the bridge's onset flag re-arms on any single sub-4 sample. The map
shows a cluster of crosses where the driver went off once.

Separately, a demo build with no session yet renders the live-mode waiting screen — "Waiting
for Assetto Corsa · Start Assetto Corsa and enter a session", or "Connecting to telemetry
bridge… · Make sure the bridge is running". In demo mode there is no bridge and no game;
both messages instruct a viewer to do something impossible. This is the same principle the
spec already applies to the connection badge: a recorded replay must never be presented as a
live session.

## What Changes

- **Cut markers become one-per-lap.** The marker's meaning changes from "where you went off"
  to "where this lap died": only the first `cut` event of a lap is attached and drawn;
  later events for the same lap are dropped. A lap can be invalidated once, so it gets at
  most one ×, positioned at the moment it happened.
- The rule is enforced **web-side at attach time** in `TrackMap`, not in the bridge. The
  committed demo recording already contains the duplicate events, so a bridge-side dedup
  would leave demo replay still showing the cluster. The web rule fixes live mode, demo
  replay, and every recording already on disk, with no wire-format or mirrored-type change.
- **The bridge's `cut` stream is unchanged** — it keeps emitting one event per detected
  excursion onset. Lap validity is unaffected: any cut during a lap still invalidates it.
- **Demo mode gets its own pre-session state.** While the recording is being fetched and
  parsed, the demo build shows a loading indicator instead of live-mode copy. If the
  recording fails to load or is empty, it shows a demo-appropriate failure message rather
  than telling the viewer to start Assetto Corsa.
- **Live builds are untouched** — the existing waiting and connecting screens render exactly
  as they do today.

Explicitly out of scope, by decision: laps that Assetto Corsa invalidates without ever
raising `numberOfTyresOut` to 4 (observed once on lap 5 of the same recording) go on
producing no marker. AC's remote telemetry UDP protocol carries no lap-validity, cut,
penalty, or tyres-out field in any of its three messages (`handshakerResponse`, `RTCarInfo`,
`RTLap`), so there is no telemetry event to listen for, and this change does not attempt a
heuristic substitute.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `cut-markers`: markers associate with laps at most one per lap — the first cut of the lap —
  instead of every cut event being attached and drawn.
- `demo-replay`: adds a demo-specific pre-session state (loading indicator, demo-appropriate
  failure copy) so a demo build never shows live-mode waiting or connecting copy.

## Impact

- `web/src/components/TrackMap.tsx` — cut attachment (`currentCutsRef` push, stored-lap
  back-attach) keeps only the first cut per lap.
- `web/src/App.tsx` — pre-session rendering branches on the demo flag.
- `web/src/hooks/useTelemetry.ts` — the demo fetch/empty-recording failure paths need a
  status distinguishable from the live `waiting` state.
- No change to `bridge/`, to the `BridgeMessage` wire format, or to the hand-mirrored
  `types.ts` pair. `useLapHistory` is unchanged.
