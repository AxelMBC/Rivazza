## Why

The web app trusts every WebSocket message through a bare cast (`JSON.parse(...) as BridgeMessage`), so a bridge, or a
committed demo recording, from a different protocol revision fails quietly: unknown message types are dropped by the
`never` default and renamed fields render as `NaN`. The realistic drift source is the frozen demo recording
(`web/public/demo/imola.json`), which is replayed by the demo build and by the unit tests against current code.

## What Changes

- `@rivazza/protocol` exports a runtime `PROTOCOL_VERSION` integer alongside its types, bumped whenever a change to
  `BridgeMessage` would be misread by a peer built before it.
- Every `status` message carries `protocol: number`. The bridge stamps it in its greeting and on every status
  broadcast, so a mismatch shows the moment a client connects, with or without a game session.
- `useTelemetry` accepts nothing on a connection (or replay loop) until it has seen a `status` whose `protocol` equals
  its own `PROTOCOL_VERSION`. On a mismatch, or a `status` without the field, it enters a new `mismatch` connection
  status, logs both versions once with `console.error`, and ignores the rest of that connection. A reconnect checks
  again.
- Live builds show a dedicated mismatch screen and header badge. Demo builds treat a mismatched recording as
  unavailable and stop replaying.
- An unknown message `type` logs `console.warn` once per type instead of vanishing.
- The committed recording is migrated to carry the stamp, and a unit test pins its `status` messages to the current
  `PROTOCOL_VERSION`.

## Capabilities

### New Capabilities

- `protocol-compatibility`: the version stamp, the once-per-connection check, the mismatch state and the
  unknown-type warning.

### Modified Capabilities

- `demo-replay`: "Demo builds show a demo-specific pre-session state" also covers a recording captured under a
  different protocol version.

## Out of Scope

- Per-message schema validation (zod or hand-written guards). It costs a dependency and an allocation per 60 Hz
  frame, and `session` carries thousands of edge points.
- Automatic detection of a forgotten version bump. The bump stays a manual rule, stated beside the constant.
- Backwards compatibility: no negotiation and no support for older peers. Any mismatch is refused.

## Impact

- `packages/protocol/src/index.ts`: `PROTOCOL_VERSION`, `protocol` field on the `status` variant. The package is no
  longer types-only (`package.json` description, CLAUDE.md "Type contract" paragraph).
- `bridge/src/session.ts`: status messages carry the stamp.
- `web/src/lib/protocolCheck.ts` (new, pure) with `protocolCheck.test.ts`; `web/src/hooks/useTelemetry.ts`
  (`ConnectionStatus` gains `mismatch`); `web/src/App.tsx`; `web/src/components/SessionHeader/ConnectionBadge.tsx`.
- `web/public/demo/imola.json`: `protocol` added to its `status` message(s).
- No new dependency.
