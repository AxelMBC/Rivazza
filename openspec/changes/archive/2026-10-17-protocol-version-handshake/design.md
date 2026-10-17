## Context

`useTelemetry` (`web/src/hooks/useTelemetry.ts:113`) parses every WebSocket message with `as BridgeMessage`, and the
demo path does the same for the fetched recording (`:157`). Bridge and web come from one monorepo and share
`@rivazza/protocol`, so a skewed pair takes a stale process or a stale file. The committed demo recording is the stale
file that is guaranteed to exist: it is replayed by the demo build and by `useLapHistory.test.ts`. The bridge greeting
(`bridge/src/session.ts:62-69`) always begins with a `status` message, with or without a game session.

## Goals / Non-Goals

**Goals:** a skewed bridge or recording fails loudly, once, at connect time; zero per-frame cost; no new dependency.

**Non-Goals:** field-level validation, negotiation with older peers, catching a forgotten version bump.

## Decisions

### 1. A version handshake, not schema validation

A single integer compared once per connection. Per-message guards (zod or hand-written) would catch field drift
without relying on a bump, but they add a dependency or a parallel runtime description of every wire type, and they
allocate on the 60 Hz telemetry path and walk thousands of edge points on `session`. The handshake catches the realistic
cases (stale bridge, stale recording) at O(1).

### 2. Stamp on `status`, not `session`

`status` opens every greeting and is the only message a bridge sends while the game is closed. Stamped on `session`, a
mismatched bridge would look like an ordinary "Waiting for Assetto Corsa" until a session started. The recorder captures
the stamp verbatim, so recordings carry it with no recorder change.

### 3. `PROTOCOL_VERSION` lives in `@rivazza/protocol` as a value

Both sides need the number at runtime, and the package already exports `.ts` source that `tsx`, Vite and both
compilers consume directly, so one `export const` works with no build step. The alternative, a literal type in the
package plus a local constant on each side, keeps the package types-only but declares the number three times. The
package and CLAUDE.md drop the "types only" wording. Every other export stays a type.

### 4. Gate the stream; don't drop the socket

A per-connection (and per-replay-loop) `accepted` flag starts false. The first `status` either sets it or moves to
`mismatch`. Until it is set, everything else is ignored. On a mismatch the socket stays open and its messages are
ignored. Closing it would trigger the 1.5 s reconnect and flicker between "connecting" and "mismatch" forever.
Restarting the bridge closes the socket, which reconnects and runs the check again. The comparison is a pure function
in `web/src/lib/protocolCheck.ts` so `node:test` can cover it: `useTelemetry.ts` reads `window` and `import.meta.env` at
module load and cannot be imported under Node.

### 5. Demo mismatch reuses the unavailable screen

The demo spec forbids instructions a viewer cannot act on, so a mismatched recording shows "Recorded session
unavailable" and the version details go only to the console. Replay stops instead of looping into the same refusal.

## Risks / Trade-offs

- A forgotten bump lets a skewed pair through, exactly as today. → The bump rule sits beside the constant, and a
  recording test fails whenever a bump lands without migrating the demo.
- An old bridge (no `protocol` field) against a new web is refused. → This is intended: any skew is refused.
- Migrating the recording by hand edits a captured file. → Only `status` messages gain one field. Everything else stays
  byte-identical, and the recording test pins it.

## Open Questions

- none
