# Refuse a bridge or demo recording from another protocol version, loudly and once per connection

## 1. Wire contract

- [x] 1.1 In `packages/protocol/src/index.ts`, export `PROTOCOL_VERSION = 1`, with the bump rule from the spec beside it,
      and add `protocol: number` to the `status` variant of `BridgeMessage`
- [x] 1.2 Drop "types only" from `packages/protocol/package.json`'s description and from CLAUDE.md's "Type contract" paragraph
      (the package now exports one value, `PROTOCOL_VERSION`; everything else stays `import type`)

## 2. Bridge

- [x] 2.1 Stamp `protocol: PROTOCOL_VERSION` on every `status` message the bridge sends (`bridge/src/session.ts`
      `greeting()`, plus any other status construction found by grepping `type: "status"` in `bridge/`)
- [x] 2.2 Confirm `bridge/scripts/record.ts` needs no change (it writes messages verbatim)

## 3. Web check

- [x] 3.1 Add the pure `web/src/lib/protocolCheck.ts`: given a `status` message, return whether its `protocol`
      matches `PROTOCOL_VERSION` (`matchesProtocol`; the caller logs the received value)
- [x] 3.2 Add `web/src/lib/protocolCheck.test.ts`: matching version accepted, different version refused, missing field
      refused; and every `status` message in `web/public/demo/imola.json` carries the current `PROTOCOL_VERSION`
      (failure names both versions)
- [x] 3.3 Migrate `web/public/demo/imola.json`: add `"protocol":1` to each `status` message, leaving every other byte unchanged

## 4. useTelemetry

- [x] 4.1 Add `mismatch` to `ConnectionStatus`
- [x] 4.2 Add an `accepted` flag, reset on each `connect()` and at the start of each replay loop. Until it is set, drop
      every message except `status`. The first `status` either sets it or enters `mismatch`: clear session and frame,
      log one `console.error` with the received and expected versions, and ignore the rest of that connection
      (keep the socket open). Implemented as a three-state `gate` (`pending | accepted | refused`) rather than a
      boolean, so a refused connection also ignores its later `status` messages
- [x] 4.3 In replay, a mismatch stops the loop (no further `replayTimer`)
- [x] 4.4 Replace the silent `default` branch with a `console.warn` once per unknown `type` per page load (module-level `Set`)

## 5. UI

- [x] 5.1 `ConnectionBadge`: add a `mismatch` entry with an error-coloured dot and text and a distinct label (e.g. "Version mismatch")
- [x] 5.2 `App.tsx` live branch: a mismatch screen ("Bridge and dashboard versions differ" + restart both from the same
      checkout with `npm run dev`) instead of `WaitingScreen` when `status === "mismatch"`
- [x] 5.3 `App.tsx` demo branch: `mismatch` renders `DemoUnavailableScreen`, like `waiting`

## 6. Verification

- [x] 6.1 Run `/axl:verify`
- [x] 6.2 `npm run dev:demo`: the Imola replay loads and loops as before, with no console error
- [x] 6.3 `npm run dev` with the mock: the dashboard goes Live as before. Then temporarily change `PROTOCOL_VERSION`
      only in the bridge's view (e.g. stamp `0` in `session.ts`) and restart the bridge: the header shows the mismatch
      badge, the main area shows the restart instruction, the console shows exactly one error naming 0 and 1, and no
      telemetry renders. Revert, restart the bridge: the app returns to Live without a page reload
- [x] 6.4 Demo with a mismatched recording (temporarily edit the status message's `protocol` in `imola.json`): the "Recorded
      session unavailable" screen appears, one console error, no looping. Revert
