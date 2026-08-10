# Technical Diagnostic — Rivazza (AC Live Telemetry)

**Date:** 2026-08-09 · **Commit:** `989cec5` · **Branch:** `master`
**Purpose:** a complete, itemized backlog of improvements, each one verified against
primary sources or measured locally, and written so it can be fed directly into the
project's OpenSpec (`/opsx:propose`) flow.

---

## How to use this document

Each item is a self-contained candidate change with a stable ID (`A1`, `C4`, …).
The structure of every entry mirrors what `/opsx:propose` needs:

| Field | Feeds into |
|---|---|
| **Where** | `tasks.md` file references |
| **Observed** | `proposal.md` — the "why now" |
| **Why this is objectively an improvement** | `proposal.md` — the justification, with citation |
| **Proposed change** | `design.md` |
| **Acceptance criteria** | `specs/<capability>/spec.md` — already phrased as SHALL requirements |
| **Affected capability** | which spec folder the delta lands in |

IDs are stable. When a change is proposed, reference the ID in the change name
(e.g. `2026-08-10-a1-a4-bridge-error-handling`) so this document stays the index.

**Grouping advice:** items marked with the same **Bundle** tag are best proposed
together — they touch the same files and share a verification pass.

---

## Verification method

Nothing in this document is asserted from memory. Every claim is either:

- **Measured** on this machine against commit `989cec5`, or
- **Cited** to primary documentation (Node.js, React, MDN, oxc, ws, Vitest, Vercel).

Measurements taken:

```
npm run build              → PASS. bridge tsc --noEmit clean; web tsc -b + vite build clean.
                             Bundle 245.48 kB raw / 78.14 kB gzip, 42 modules, 508 ms.
npm run lint -w web        → PASS, zero diagnostics.
git ls-files               → 225 tracked files. No .github/ — no CI.
git log                    → 27 commits, 2026-07-03 → 2026-08-09.
web/public/demo/imola.json → 16.66 MB raw / 3.26 MB gzip. 26,351 entries
                             (26,345 telemetry, 1 session, 1 status, 4 cut), 439.1 s span.
                             28 fields/frame, ~636 bytes/frame.
JSON.parse of that file    → 88.5 ms on desktop Node; ~37 MB heapUsed retained.
grep sweep                 → 0 `any`, 0 `@ts-ignore`, 0 `TODO/FIXME`, 0 `console.*` in web/src,
                             0 `function` declarations (100% arrow functions).
```

Full citation list in [References](#references).

---

## Index by priority

### P0 — Correctness / availability. Do these first.

| ID | Title | Effort | Bundle |
|---|---|---|---|
| [A1](#a1) | Unhandled `'error'` on client WebSocket crashes the bridge | XS | BRIDGE-ERR |
| [A2](#a2) | Unhandled `'error'` on `WebSocketServer` crashes the bridge | XS | BRIDGE-ERR |
| [A3](#a3) | Unhandled `'error'` on the HTTP server crashes the bridge | XS | BRIDGE-ERR |
| [A4](#a4) | Unhandled `'error'` on the map-image read stream crashes the bridge | XS | BRIDGE-ERR |
| [G1](#g1) | `BRIDGE_PORT` is documented as configurable but hardcoded in the web app | XS | CONFIG |

### P1 — Verification infrastructure. The largest single quality gain.

| ID | Title | Effort | Bundle |
|---|---|---|---|
| [C1](#c1) | No test framework — adopt Vitest | S | TEST-FOUNDATION |
| [C2](#c2) | Binary UDP parsers have zero tests | S | TEST-PURE |
| [C3](#c3) | AI-spline parser has zero tests despite six validation rules | S | TEST-PURE |
| [C4](#c4) | Lap-analysis math has zero tests | S | TEST-PURE |
| [C5](#c5) | Formatters and speed scale have zero tests | XS | TEST-PURE |
| [C6](#c6) | Lap state machines have zero tests | M | TEST-STATE |
| [C7](#c7) | No CI pipeline | XS | CI |
| [C8](#c8) | `react/exhaustive-deps` is not enabled | XS | CI |

### P2 — Structural debt that blocks future features.

| ID | Title | Effort | Bundle |
|---|---|---|---|
| [D1](#d1) | Session-restart detection duplicated in four places | S | DRY-LAP |
| [D2](#d2) | Lap-wrap detection duplicated in two places | S | DRY-LAP |
| [D3](#d3) | `useLapDelta` is largely subsumed by `useLapRecordings` | M | DRY-LAP |
| [D4](#d4) | Wire-protocol types hand-mirrored across workspaces | S | PROTOCOL |
| [D5](#d5) | Canvas color literals duplicated across components | XS | DRY-COLOR |
| [E1](#e1) | `TrackMap.tsx` is 2,096 lines with a ~1,530-line effect | L | TRACKMAP-SPLIT |
| [E3](#e3) | Dead "LEARNING LOG" code in the 60 Hz packet path | XS | CLEANUP |

### P3 — Hardening, correctness-under-concurrency, resilience.

| ID | Title | Effort | Bundle |
|---|---|---|---|
| [B1](#b1) | Unvalidated remote strings build filesystem paths served over HTTP | S | HARDENING |
| [B2](#b2) | Bridge binds all network interfaces by default | XS | HARDENING |
| [B3](#b3) | Wildcard CORS on the bridge | XS | HARDENING |
| [A5](#a5) | No WebSocket backpressure handling | S | BRIDGE-ERR |
| [F1](#f1) | Refs read during render — concurrent-rendering hazard | M | REACT-PURITY |
| [F2](#f2) | No error boundaries | S | REACT-RESILIENCE |

### P4 — Performance and data volume.

| ID | Title | Effort | Bundle |
|---|---|---|---|
| [H1](#h1) | Demo recording is 16.66 MB / 88 ms parse / ~37 MB retained | M | DEMO-PAYLOAD |
| [H2](#h2) | Lap hit-test is an unindexed linear scan | M | MAP-PERF |
| [H3](#h3) | Driven line stored twice in different shapes | M | MAP-PERF |
| [H4](#h4) | "Ring buffer" implemented with `Array.shift()` | XS | CLEANUP |
| [H5](#h5) | Synchronous file reads inside an async resolution path | XS | CLEANUP |

### P5 — Reach, accessibility, product scalability.

| ID | Title | Effort | Bundle |
|---|---|---|---|
| [I1](#i1) | Canvas elements have no fallback content or accessible alternative | S | A11Y |
| [I2](#i2) | No keyboard path to any interaction | M | A11Y |
| [I3](#i3) | No `prefers-reduced-motion` handling | S | A11Y |
| [J1](#j1) | No persistence — a page reload destroys the session | L | PERSISTENCE |
| [J2](#j2) | Recording format has no schema version | XS | DEMO-PAYLOAD |
| [J3](#j3) | `SUBSCRIBE_SPOT` defined but never used; single-car by construction | L | MULTI-CAR |
| [E2](#e2) | Bridge state is module-level mutable globals | M | MULTI-CAR |

---

# P0 — Correctness and availability

## Bundle: BRIDGE-ERR

### A1
## Unhandled `'error'` on client WebSocket crashes the bridge

**Severity:** High · **Effort:** XS · **Type:** Robustness · **Confidence:** Verified

**Where:** `bridge/src/index.ts:76-81`

**Observed**

```ts
wss.on('connection', (socket) => {
  const hello: BridgeMessage[] = session ? [...] : [...];
  for (const message of hello) socket.send(JSON.stringify(message));
});
```

No `socket.on('error', …)` is registered. A grep across the whole bridge finds
exactly one `'error'` listener, on the UDP socket (`acClient.ts:36`).

**Why this is objectively an improvement**

Two facts compose into a crash:

1. The `ws` documentation states plainly: *"This class represents a WebSocket. It
   extends the `EventEmitter`."* — so `WebSocket` instances are Node EventEmitters.
2. The Node.js documentation states: *"If an `EventEmitter` does **not** have at
   least one listener registered for the `'error'` event, and an `'error'` event is
   emitted, the error is thrown, a stack trace is printed, and the Node.js process
   exits."* It adds: *"As a best practice, listeners should always be added for the
   `'error'` events."*

The trigger is mundane, not exotic: a browser tab closed abruptly, a laptop
sleeping, or a Wi-Fi drop produces `ECONNRESET` on the socket, which `ws` surfaces
as `'error'`. **A viewer closing a tab can kill telemetry for every other viewer
and for the driver.** For a service whose entire job is to stay up for the duration
of a racing session, this is the highest-value fix in the document relative to its
cost.

**Proposed change**

Register a per-connection error listener that logs and lets `ws` clean up the
socket. Do not attempt recovery — the connection is gone; the point is only that
its death must not be the process's death.

**Acceptance criteria**

- The bridge SHALL register an `'error'` listener on every accepted WebSocket
  connection before any data is sent on it.
- WHEN a connected client's socket errors (abrupt disconnect, reset, protocol
  error), THEN the bridge SHALL log the error and continue serving all other
  clients, and the process SHALL remain alive.
- WHEN the errored client's socket closes, THEN it SHALL be excluded from
  subsequent broadcasts (already guaranteed by the `readyState` check at
  `index.ts:72`; the test must confirm it still holds).

**Affected capability:** new `bridge-resilience` spec (none of the 21 existing
specs covers process lifetime).

**Risk:** None. Purely additive.

---

### A2
## Unhandled `'error'` on `WebSocketServer` crashes the bridge

**Severity:** Medium · **Effort:** XS · **Type:** Robustness · **Confidence:** Verified

**Where:** `bridge/src/index.ts:67`

**Observed**

```ts
const wss = new WebSocketServer({ server, path: '/ws' });
```

No `wss.on('error', …)`.

**Why this is objectively an improvement**

Same mechanism as [A1](#a1). The `ws` docs: *"This class represents a WebSocket
server. It extends the `EventEmitter`."* and document a server-level `'error'`
event *"Emitted when an error occurs on the underlying server."* Combined with the
Node EventEmitter rule, an unhandled server error terminates the process.

Lower severity than A1 only because it is rarer — server-level errors mostly
originate from the underlying HTTP server, which A3 also covers.

**Proposed change**

Register `wss.on('error', …)` with a log line naming the subsystem, consistent with
the existing `[ac]` / `[map]` / `[shm]` log prefixes — add `[ws]`.

**Acceptance criteria**

- The WebSocket server SHALL have an `'error'` listener registered at construction.
- WHEN the WebSocket server emits `'error'`, THEN the bridge SHALL log it with the
  `[ws]` prefix and SHALL NOT exit.

**Affected capability:** `bridge-resilience`. **Bundle with A1, A3, A4.**

---

### A3
## Unhandled `'error'` on the HTTP server crashes the bridge

**Severity:** Medium · **Effort:** XS · **Type:** Robustness / DX · **Confidence:** Verified

**Where:** `bridge/src/index.ts:150-153`

**Observed**

```ts
server.listen(PORT, () => {
  console.log(`[bridge] http + ws listening on http://localhost:${PORT}`);
  ac.start();
});
```

No `server.on('error', …)`. The most common real-world trigger is `EADDRINUSE` —
starting `npm run dev` while a previous bridge is still running, which is a normal
occurrence during development.

**Why this is objectively an improvement**

Same EventEmitter rule (`http.Server` extends `net.Server` extends `EventEmitter`).
Today the failure mode is a raw stack trace; the improvement is a one-line
actionable message. This is the item with the best ratio of developer-experience
gain to effort in the whole document: the current output does not tell the reader
that `BRIDGE_PORT` exists.

**Proposed change**

Register `server.on('error', …)` that special-cases `EADDRINUSE` with a message
naming the port and the `BRIDGE_PORT` env var, and exits with a non-zero code
rather than throwing.

**Acceptance criteria**

- WHEN the configured port is already in use, THEN the bridge SHALL print a
  single-line message naming the port and the `BRIDGE_PORT` override, and SHALL
  exit with a non-zero status code without a stack trace.
- WHEN any other HTTP server error occurs, THEN the bridge SHALL log it with the
  `[bridge]` prefix.

**Affected capability:** `bridge-resilience`. **Bundle with A1, A2, A4.**

---

### A4
## Unhandled `'error'` on the map-image read stream crashes the bridge

**Severity:** Medium · **Effort:** XS · **Type:** Robustness · **Confidence:** Verified

**Where:** `bridge/src/index.ts:52-61`

**Observed**

```ts
if (pathname === '/api/track-map/image') {
  if (!trackAssets?.mapImagePath) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': 'image/png' });
  fs.createReadStream(trackAssets.mapImagePath).pipe(res);
  return;
}
```

The stream has no `'error'` handler. There is a genuine TOCTOU window: existence
was checked at session start in `trackAssets.ts:83` (`fs.existsSync`), while the
read happens whenever a client requests it — potentially many minutes later, after
a game update, a mod uninstall, or a Steam verify has moved the file.

**Why this is objectively an improvement**

`fs.ReadStream` is an EventEmitter; the same Node rule applies. `pipe()` does not
forward source errors to the destination, so nothing else catches it.

Note the deeper point: this endpoint's payload is *deliberately never rendered* by
the web app (documented at `TrackMap.tsx:34-38` and in `CLAUDE.md`). So the bridge
currently carries **a crash vector on a code path nothing consumes**.

**Proposed change**

Two options, in preference order:

1. **Remove the endpoint.** It is dead surface area. `SessionInfo.mapAvailable`
   (`types.ts:7`) would need to be reviewed for other consumers first — a grep
   shows it is currently unused in `web/src`.
2. If it is kept for external/third-party consumers, attach
   `.on('error', …)` that responds 404/500 if headers are unsent and destroys the
   response otherwise.

**Acceptance criteria**

- Either: the `/api/track-map/image` endpoint SHALL be removed along with
  `mapImagePath` resolution and the now-unused `mapAvailable` flag;
- Or: WHEN the map image cannot be read after headers are sent, THEN the bridge
  SHALL destroy the response and log the failure, and SHALL NOT exit.

**Affected capability:** `track-asset-resolution` (removal path) or
`bridge-resilience` (handler path). **Bundle with A1–A3.**

**Non-goal:** re-introducing the map image into the rendered map. That decision is
already specified and justified.

---

## Bundle: CONFIG

### G1
## `BRIDGE_PORT` is documented as configurable but hardcoded in the web app

**Severity:** Medium · **Effort:** XS · **Type:** Correctness / DX · **Confidence:** Verified

**Where:** `web/src/hooks/useTelemetry.ts:11-12`

**Observed**

```ts
export const BRIDGE_HTTP = `http://${window.location.hostname}:3001`;
const BRIDGE_WS = `ws://${window.location.hostname}:3001/ws`;
```

`3001` is a literal in both. Meanwhile `bridge/src/index.ts:10` reads
`BRIDGE_PORT`, and both `README.md` (configuration table) and `CLAUDE.md` present
it as a supported knob.

**Why this is objectively an improvement**

The documentation currently describes behaviour the software does not have.
Setting `BRIDGE_PORT=3002` produces a bridge that works and a dashboard that
silently retries forever against 3001 — the `useTelemetry` reconnect loop
(`RECONNECT_MS = 1500`) shows "Connecting to telemetry bridge…" indefinitely with
no diagnostic. A configuration option that breaks the app when used is worse than
no option at all; making it real costs two lines.

Note the host is already derived correctly from `window.location.hostname`, which
is what makes the tablet-as-second-screen scenario work. Only the port is wrong.

**Proposed change**

Introduce `VITE_BRIDGE_PORT` with a `3001` default, mirroring the `demo.ts` pattern
for build-time constants. Document it in the README table next to `BRIDGE_PORT`
with a note that the two must match.

**Acceptance criteria**

- The web app SHALL derive the bridge port from `VITE_BRIDGE_PORT`, defaulting to
  `3001` when unset.
- WHEN `VITE_BRIDGE_PORT` matches the bridge's `BRIDGE_PORT`, THEN the dashboard
  SHALL connect over both HTTP and WebSocket on that port.
- The README configuration table SHALL list both variables and state that they
  must agree.

**Affected capability:** new `bridge-connection` spec, or an addition to
`racer-dashboard`.

---

# P1 — Verification infrastructure

> This bundle is the single highest-value investment in the repository. The
> codebase contains an unusual proportion of **pure, deterministic, trivially
> testable** logic that currently has zero assertions. `CLAUDE.md` and `README.md`
> both state there is no test framework — a documented, deliberate choice. This
> diagnostic argues the choice should be revisited, and gives the specific reason
> for each module rather than a generic coverage argument.

## Bundle: TEST-FOUNDATION

### C1
## No test framework — adopt Vitest

**Severity:** High · **Effort:** S · **Type:** Process · **Confidence:** Verified

**Where:** repository-wide. `README.md:113`, `CLAUDE.md` ("There is **no test
framework** in this repo — do not invent test commands.")

**Observed**

Neither workspace declares a test runner. `git ls-files` shows no `*.test.ts`,
`*.spec.ts`, or test config anywhere among the 225 tracked files.

**Why this is objectively an improvement**

The argument here is *not* "all projects need tests". It is specific to what this
codebase is:

1. **The core is byte-offset binary parsing.** `CLAUDE.md` itself calls
   `parsers.ts` "The delicate core" and warns that corrupt strings "silently break
   track-folder lookups". Silent breakage is precisely the failure class automated
   tests exist to catch, and precisely the class manual play-testing misses.
2. **Lap validity is reconstructed by heuristics**, because the protocol has no
   lap list and no invalid flag (`useLapHistory.ts:34-41`). Heuristics accumulate
   edge cases; each edge case is a regression risk for every other one.
3. **The verification loop is expensive.** `.claude/skills/verify/SKILL.md` exists
   precisely because exercising this app means launching a mock, two dev servers,
   and a headless browser. A unit test on `interpolateTimeAt` runs in
   microseconds.

Vitest is the correct runner for this repo specifically: the Vitest documentation
states it *"uses the same configuration of your App (through `vite.config.js`),
sharing a common transformation pipeline during dev, build, and test time"*, and
*"aims to position itself as the Test Runner of choice for Vite projects, and as a
solid alternative even for projects not using Vite."* That last clause matters —
one runner covers both the Vite web workspace and the plain-TypeScript bridge, so
this does not fragment the toolchain.

**Proposed change**

- Add `vitest` as a dev dependency at the repo root.
- Add `test` scripts to both workspaces and a root `test` script mirroring the
  existing `build` script's shape.
- Node environment for `bridge`; `node` environment for `web`'s pure `lib/`
  modules (no DOM needed for the P1 test targets — see C2–C5).
- Update `README.md` and `CLAUDE.md`, which currently instruct the reader (and any
  AI agent) that no test command exists. **This documentation update is part of
  the change, not an afterthought** — leaving it stale would actively misdirect.

**Acceptance criteria**

- `npm test` at the repo root SHALL run both workspaces' suites and exit non-zero
  on any failure.
- The test runner SHALL require no separate transform configuration beyond the
  existing `vite.config.ts`.
- `README.md` and `CLAUDE.md` SHALL describe the test command and SHALL no longer
  state that no test framework exists.

**Affected capability:** new `test-infrastructure` spec.

**Non-goal:** coverage thresholds, E2E/browser automation, or testing the canvas
rendering output. Those are separate proposals; this one only establishes the
foundation.

---

## Bundle: TEST-PURE

> C2–C5 are four thin slices of the same work and can be proposed as one change or
> four. They share one property that makes them cheap: **every function under test
> is pure, synchronous, and dependency-free.** No mocks, no fake timers, no DOM.

### C2
## Binary UDP parsers have zero tests

**Severity:** High · **Effort:** S · **Type:** Test coverage · **Confidence:** Verified

**Where:** `bridge/src/parsers.ts` (86 lines, 4 exported functions)

**Observed**

`parseRTCarInfo` reads 24 fields at hardcoded byte offsets spanning 0–328.
`parseHandshakerResponse` reads 6 fields across a 408-byte struct.
`readWideString` implements the garbage-tolerance rule. None is exercised by any
assertion.

**Why this is objectively an improvement**

The failure mode is uniquely bad here: an offset typo does not throw. It produces a
plausible-looking float. A `speedKmh` read four bytes off yields a number, the
gauge renders it, and nothing anywhere reports a fault. The bug ships and is
discovered by a human noticing the needle "feels wrong".

The test is also unusually easy to write correctly, because the mock already
proves the technique: `bridge/scripts/mock-ac.js:12-23` constructs a valid
408-byte handshake buffer with the exact `NUL + 'garbage%'` trailing-garbage
pattern real AC emits. **That fixture construction is the test fixture** — it
already exists and is already known-good.

**Proposed change**

A round-trip test suite:

- **Handshake:** build a 408-byte buffer with known values (reusing the mock's
  `writeWStr` helper, extracted to a shared test fixture), assert every field of
  `parseHandshakerResponse`.
- **`readWideString` table:** clean string; string with trailing `NUL` + garbage;
  string with a stray `%`; string with a control character; empty string; a string
  that fills all 50 wchars with no terminator. Each asserts the exact cut point.
- **`parseRTCarInfo`:** build a 328-byte buffer writing a distinct sentinel value
  at every documented offset, assert all 24 fields map to their sentinels. This
  single test pins the entire offset table.
- **Wheel blocks:** assert FL/FR/RL/RR ordering for `tyreSlip` (offset 148) and
  `wheelLoad` (offset 180) — the ordering is documented in a comment
  (`types.ts:39`) and consumed by `TyreOverlay`, so it is a real contract.
- **`buildHandshakePacket`:** assert the 12-byte layout and each `OperationId`.

**Acceptance criteria**

- The parser suite SHALL construct fixture buffers of exactly
  `HANDSHAKE_RESPONSE_SIZE` and `RT_CAR_INFO_SIZE` bytes and assert every field
  parsed from them.
- The suite SHALL assert `readWideString` cuts at the first control character and
  at `%`, and trims surrounding whitespace.
- The suite SHALL assert wheel-array ordering is FL, FR, RL, RR.
- WHEN any byte offset in `parsers.ts` is changed, THEN at least one test SHALL
  fail.

**Affected capability:** new `test-infrastructure`, or a `Testing` requirement
added to `extended-telemetry`.

---

### C3
## AI-spline parser has zero tests despite six validation rules

**Severity:** Medium · **Effort:** S · **Type:** Test coverage · **Confidence:** Verified

**Where:** `bridge/src/aiSpline.ts` (133 lines)

**Observed**

`parseSpline` + `resolveTrackEdges` implement six independent rejection rules,
every one of which exists because a real track file broke something:

| Rule | Line | Origin documented in-code |
|---|---|---|
| `version !== AI_VERSION` | 44 | header format |
| `count < MIN_POINTS` | 44 | *"drift ships a 12-byte stub"* |
| buffer too short for extras | 46 | truncated file |
| extra-count ≠ point count | 47 | malformed file |
| `usable / points < MIN_USABLE_RATIO` | 99 | tracks with no side data |
| `!insideMapBounds` | 103 | *"copied verbatim from another track"* |

Plus `median3` smoothing (line 31) and the left/right normal derivation (line 115,
annotated *"validated empirically"*).

**Why this is objectively an improvement**

Each rule is a guard that either fires or does not. Untested, there is no way to
know whether a future refactor silently disables one — and a disabled guard does
not crash, it draws a wrong track outline that looks like a rendering bug.
`insideMapBounds` in particular is subtle arithmetic (`-meta.xOffset ± span *
margin`) that is easy to get sign-wrong.

`median3` deserves particular attention: it is written as a one-line
`Math.max(Math.min(a,v), Math.min(Math.max(a,v), c))` median-of-three, correct but
non-obvious, with clamped edges via `Math.max(0, i-1)` / `Math.min(len-1, i+1)`. A
five-case table test documents it better than the comment does.

**Proposed change**

Synthetic spline buffers built by a helper (`makeSpline({version, points, sides})`)
with one test per rejection rule, plus:

- a valid closed circuit → asserts `closed === true` and left/right point counts;
- a valid open spline (endpoints > `CLOSED_GAP` apart) → asserts `closed === false`
  and that no closing segment is implied;
- `median3` table test including both clamped edges;
- non-finite coordinates → returns `null` rather than propagating `NaN`;
- side values above `MAX_SIDE` → clamped to 50, not rejected.

**Acceptance criteria**

- Each of the six rejection rules SHALL have a test that triggers exactly that rule
  and asserts `null` is returned.
- A valid closed spline and a valid open spline SHALL each produce edges with
  `left.length === right.length === points.length`.
- WHEN a spline contains non-finite coordinates, THEN `resolveTrackEdges` SHALL
  return `null` and SHALL NOT emit `NaN` coordinates.

**Affected capability:** `track-limits`, `track-asset-resolution`.

---

### C4
## Lap-analysis math has zero tests

**Severity:** High · **Effort:** S · **Type:** Test coverage · **Confidence:** Verified

**Where:** `web/src/lib/lapAnalysis.ts` (154 lines, 7 exported functions)

**Observed**

Pure functions with documented edge cases and no assertions:
`bracket` (binary search), `interpolateTimeAt`, `sampleNear`, `worldPointAt`,
`resolveReference`, `sectorTimes`, `bestSectors`, `theoreticalBestMs`.

**Why this is objectively an improvement**

This module has the highest test-value-per-line in the repo, for three reasons:

1. **The comments already are the test cases.** `sectorTimes` (line 99-103)
   documents: *"The 0.0 boundary is pinned to 0 ms (and 1.0 to the lap time) only
   when the recording genuinely starts (ends) at the line — sampling never lands
   exactly on the boundary, and without the pin the first and last slices would
   never resolve."* That is a specification. Writing the test is transcription.
2. **Validity rules are safety-critical to the product's meaning.** Three separate
   functions enforce "an invalid lap must never stand in as best/reference"
   (`resolveReference:83-85`, `bestSectors:126-127`, and the parallel rule in
   `LapTimes.tsx:117-127`). If that rule regresses, the dashboard confidently
   reports a cut lap as the driver's best — actively misleading, not merely broken.
3. **`bracket` is a hand-rolled binary search** (`lo`/`hi`/`>> 1`). Off-by-one
   errors in binary search are the canonical silent bug.

**Proposed change**

- `bracket`: below range, above range, exact first, exact last, exact interior
  boundary, single-element array, empty array, two-element array.
- `interpolateTimeAt`: midpoint interpolation with known values; zero-width span
  (`b.pos === a.pos`) returns `a.timeMs`; out-of-range returns `null`.
- `sampleNear`: asserts nearest-not-interpolated, including exact-tie behaviour
  (currently `<=` favours the earlier sample — pin it).
- `worldPointAt`: linear interpolation of `x`/`z`; zero-span fallback.
- `resolveReference`: invalid lap excluded even when fastest; incomplete recording
  excluded; `timeMs === null` excluded; empty input returns `null`.
- `sectorTimes`: the 0.0/1.0 pin logic on both a full-coverage and a
  partial-coverage recording; uncovered slices yield `null`, never a number.
- `bestSectors`: a cut lap never contributes; a partial lap contributes only its
  covered slices.
- `theoreticalBestMs`: returns `null` if any slice is `null`; sums otherwise.

**Acceptance criteria**

- Every exported function in `lapAnalysis.ts` SHALL have at least one
  boundary-condition test.
- The suite SHALL assert that an invalid lap is never selected by
  `resolveReference` and never contributes to `bestSectors`, even when its raw time
  is the fastest.
- The suite SHALL assert `sectorTimes` returns `null` — never a fabricated number —
  for slices the recording does not cover.

**Affected capability:** `lap-analysis`, `mini-sector-timing`.

---

### C5
## Formatters and speed scale have zero tests

**Severity:** Low · **Effort:** XS · **Type:** Test coverage · **Confidence:** Verified

**Where:** `web/src/lib/format.ts` (25 lines), `web/src/lib/speedScale.ts` (32 lines)

**Observed**

`formatLapTime`, `formatGear`, `formatGearCompact`, `prettifyName`, `speedScale` —
all pure, all untested.

**Why this is objectively an improvement**

Small, but three of these have real edge cases already encoded in the source:

- `formatLapTime` guards `!ms || ms <= 0` → `'--:--.---'`. That guard is load-bearing
  in at least five call sites and its exact output string is a visual contract.
- `formatGear` encodes AC's convention `0 = R, 1 = N, 2+ = gear n-1`
  (`format.ts:9`). An off-by-one here mislabels every gear on screen.
- `speedScale` has an explicitly documented absurd-input branch (*"Absurdly fast
  mod (>~800 km/h)"*) that no human will ever exercise manually.
- `prettifyName` will throw on an empty segment if the `.filter(Boolean)` guard is
  ever removed — `word[0].toUpperCase()` on `undefined`.

Cost: roughly 30 lines of table-driven tests. There is no reason not to.

**Acceptance criteria**

- `formatLapTime` SHALL be tested for `0`, `null`, `undefined`, negative, sub-second,
  and multi-minute inputs.
- `formatGear`/`formatGearCompact` SHALL be tested for reverse, neutral, and first
  through top gear.
- `speedScale` SHALL be tested for `null`, `0`, a typical road car, a typical race
  car, and an input above 800 km/h, asserting division count never exceeds
  `MAX_DIVISIONS`.
- `prettifyName` SHALL be tested for the `ks_` prefix, underscores, hyphens, and
  consecutive separators.

**Affected capability:** `racer-dashboard`, `car-spec-resolution`.

---

## Bundle: TEST-STATE

### C6
## Lap state machines have zero tests

**Severity:** High · **Effort:** M · **Type:** Test coverage · **Confidence:** Verified

**Where:** `web/src/hooks/useLapHistory.ts` (150), `useLapRecordings.ts` (252),
`useLapDelta.ts` (101)

**Observed**

Three hooks reconstruct lap state from a raw frame stream. Between them they handle
at least eight distinct edge cases, every one documented in a comment and none
asserted:

| Edge case | Where |
|---|---|
| `lastLapMs` still stale on the frame that increments `lapCount` | `useLapHistory.ts:11-14` |
| Back-to-back identical lap times never refresh `lastLapMs` | `useLapHistory.ts:124-125` |
| Session restart via lap counter running backwards | all three |
| Session restart via lap clock running backwards | all three |
| Position wrap arrives before the `lapCount` tick | `useLapRecordings.ts:196-219` |
| Out-lap first line crossing (lapCount stays 0) | `useLapRecordings.ts:200-204` |
| Would-be-PB the game didn't adopt = cut lap | `useLapHistory.ts:129-130` |
| Eviction at `MAX_RECORDED_LAPS` must pin the best valid lap | `useLapRecordings.ts:175-188` |

**Why this is objectively an improvement**

These are the most bug-prone lines in the project and the most expensive to verify
by hand. Reproducing "back-to-back identical lap times" manually requires driving
two laps to the millisecond. As a fixture it is four lines of JSON.

**And the fixtures already exist.** `web/public/demo/imola.json` is a captured
26,345-frame real session including 4 cut events and a full lap sequence. A short
recording sliced from it — or purpose-built synthetic sequences in the same shape —
gives deterministic, replayable input for every case above.

**Proposed change**

Two layers:

1. **Extract the state machines from the hooks.** Each hook's effect body is
   already a pure `(previousState, frame) → nextState` reducer wearing a `useRef`
   costume. Extracting `lapHistoryReducer`, `lapRecordingsReducer` to `lib/` makes
   them testable without React at all, and is a prerequisite that also serves
   [D1](#d1), [D2](#d2), and [D3](#d3).
2. **Frame-sequence fixture tests.** A helper `feed(reducer, frames[])` returning
   final state; one test per edge case in the table above.

Optionally add `@testing-library/react`'s `renderHook` for a thin integration test
per hook, but the reducer tests carry the value.

**Acceptance criteria**

- Lap bookkeeping SHALL be expressed as pure reducer functions testable without
  a React renderer.
- Each of the eight edge cases in the table SHALL have a dedicated test with an
  explicit frame sequence.
- WHEN the session restarts mid-lap, THEN the tests SHALL assert stored laps are
  cleared, unconsumed cut events are discarded, and the in-progress recording is
  dropped.
- WHEN eviction fires at `MAX_RECORDED_LAPS`, THEN the tests SHALL assert the
  session-best valid complete lap survives.

**Affected capability:** `lap-history`, `lap-telemetry-recording`.

**Dependency:** best proposed after [C1](#c1); shares its extraction work with
[D1](#d1)–[D3](#d3), so consider one combined change.

---

## Bundle: CI

### C7
## No CI pipeline

**Severity:** Medium · **Effort:** XS · **Type:** Process · **Confidence:** Verified

**Where:** repository root — `.github/` does not exist.

**Observed**

`npm run build` and `npm run lint -w web` both pass cleanly today (measured). But
nothing enforces that on the next commit, and the project has 27 commits with no
gate.

**Why this is objectively an improvement**

The repo already has all the commands a pipeline needs — `build` type-checks both
workspaces, `lint` runs oxlint. The gap is purely that nobody runs them
automatically. Given `bridge`'s build *is* `tsc --noEmit`, CI is the only thing
that would catch a bridge type error before it reaches a running session, since the
bridge executes via `tsx` and never compiles.

`engines.node` is already declared as `>=20.19` at the root, so the matrix is
already specified.

**Proposed change**

One workflow, triggered on push and pull request:
`npm ci` → `npm run lint -w web` → `npm run build` → `npm test` (once [C1](#c1)
lands). Node version from `engines`. `koffi` is a native dependency but is
optional-by-design at runtime (`sharedMemory.ts:42-43`) and its install should be
verified on `ubuntu-latest`; if it complicates CI, `npm ci --ignore-scripts`
combined with type-check-only jobs is an acceptable fallback.

**Acceptance criteria**

- A CI workflow SHALL run on every push and pull request to `master`.
- The workflow SHALL fail if lint, type-check, build, or tests fail.
- The workflow SHALL use the Node version declared in root `engines.node`.

**Affected capability:** `test-infrastructure`.

---

### C8
## `react/exhaustive-deps` is not enabled

**Severity:** Medium · **Effort:** XS · **Type:** Static analysis · **Confidence:** Verified

**Where:** `web/.oxlintrc.json`

**Observed**

```json
{
  "plugins": ["react", "typescript", "oxc"],
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

Two rules. `react/exhaustive-deps` is absent.

**Why this is objectively an improvement**

The oxc documentation lists `react/exhaustive-deps` under the **correctness**
category, states it is *not enabled by default* and requires explicit
configuration, and shows the exact config shape. Crucially, **the `react` plugin is
already enabled in this config** — turning the rule on is a one-line change with no
new dependency and no new tooling.

There is a concrete latent case it would flag. `TrackMap.tsx:409` defines
`resetLines` in the component body; it is therefore a new function identity on
every render. The effect at line 474 captures the *first* instance and calls it
from the rAF loop at line 1531 and on session change at line 433, while its
dependency array (line 2005) does not list it. This is currently harmless —
`resetLines` only touches refs and the stable `setFollow`/`setState` — but it is
exactly the pattern the rule exists to surveil, in the single most complex effect
in the codebase.

**Caveat, stated honestly:** the oxc issue tracker documents behavioural
differences from `eslint-plugin-react-hooks`, including false positives on object
members (issue #20664) and error-line placement differences (#18328). Enable it at
`"warn"` first, triage the output, then promote to `"error"` once the codebase is
clean. Do not enable it at `error` blind and then start adding suppressions — that
inverts the value.

**Proposed change**

Add `"react/exhaustive-deps": "warn"` to `.oxlintrc.json`. Triage every warning.
Fix real ones (likely by wrapping `resetLines` in `useCallback` or, better, moving
it inside the effect as part of [E1](#e1)). Promote to `"error"` and add it to CI.

**Acceptance criteria**

- `react/exhaustive-deps` SHALL be enabled in `.oxlintrc.json`.
- `npm run lint -w web` SHALL report zero violations of it.
- The rule SHALL be at severity `error` once the codebase is clean.

**Affected capability:** `test-infrastructure` / `render-efficiency`.

---

# P2 — Structural debt

## Bundle: DRY-LAP

### D1
## Session-restart detection duplicated in four places

**Severity:** High · **Effort:** S · **Type:** Maintainability · **Confidence:** Verified

**Where:**
- `web/src/hooks/useLapHistory.ts:83-86`
- `web/src/hooks/useLapDelta.ts:54-58`
- `web/src/hooks/useLapRecordings.ts:113-116`
- `web/src/components/TrackMap.tsx:1525-1529`

**Observed**

The same predicate, character-for-character in structure, four times:

```ts
const restarted =
  prevLap !== null &&
  (frame.lapCount < prevLap ||
    (frame.lapCount === prevLap && frame.lapTimeMs + 1000 < lapTimeRef.current));
```

`CLAUDE.md` documents the situation explicitly: *"AC's 'restart session' does not
re-handshake — restarts are detected by the lap counter or lap clock running
backwards, a signature duplicated in `useLapHistory`, `useLapDelta`, and `TrackMap`.
Keep them in sync if you change one."*

Note the documentation itself lists only three sites; the fourth
(`useLapRecordings`) was added later and the note was not updated. **The
documented invariant has already drifted from reality — which is the argument in
miniature.**

**Why this is objectively an improvement**

An invariant enforced by a sentence in a markdown file is not enforced. It relies
on every future contributor (human or agent) reading `CLAUDE.md`, remembering the
list, finding all four sites, and updating each identically. The magic constant
`1000` (the lap-clock tolerance) is the specific hazard: tuning it in three places
and missing one produces a dashboard where the map resets on restart but the lap
list does not, or vice versa — a state inconsistency that is confusing to diagnose
because each component "works".

Extracting it converts a documentation obligation into a compiler-checked one.

**Proposed change**

Add `web/src/lib/lapState.ts`:

```ts
export const RESTART_CLOCK_TOLERANCE_MS = 1000;

export const isSessionRestart = (
  prev: { lapCount: number; lapTimeMs: number } | null,
  frame: { lapCount: number; lapTimeMs: number },
): boolean => ...
```

Replace all four sites. The function is pure, so it gets a test in the same change
(covers counter-backwards, clock-backwards, clock-forward-within-tolerance,
first-frame `null`).

**Acceptance criteria**

- Session-restart detection SHALL exist in exactly one module.
- All four current call sites SHALL delegate to it.
- The restart tolerance SHALL be a single named constant.
- `CLAUDE.md` SHALL be updated to describe the shared helper instead of the
  keep-in-sync obligation.
- A `grep` for the inline predicate SHALL return no matches outside the helper.

**Affected capability:** `lap-history`, `lap-telemetry-recording`,
`track-map-viewport`.

---

### D2
## Lap-wrap detection duplicated in two places

**Severity:** Medium · **Effort:** S · **Type:** Maintainability · **Confidence:** Verified

**Where:** `web/src/hooks/useLapDelta.ts:69-83`, `web/src/hooks/useLapRecordings.ts:196-219`

**Observed**

Both implement the identical rule: a backwards jump in `normalizedPos` greater than
`0.5` without a `lapCount` tick means either (a) the finish line of a completed lap
whose tick hasn't arrived, or (b) an out-lap's first crossing or a teleport. Both
use the same `0.5` threshold, the same `COVERAGE_START`/`COVERAGE_END` span check,
and the same `wrappedRef` hold-for-next-tick mechanism. Both carry near-identical
20-line explanatory comments.

**Why this is objectively an improvement**

Same class as [D1](#d1) with an extra wrinkle: the `0.5` threshold is an unnamed
magic number in both files. The two comments are long and nearly identical, which
means a future edit is likely to improve one and leave the other stale — the
comments will disagree before the code does, which is worse than either.

**Proposed change**

Move to `lib/lapState.ts` alongside [D1](#d1):

```ts
export const POSITION_WRAP_THRESHOLD = 0.5;
export const classifyWrap = (samples, frame) => 'none' | 'completed-lap' | 'discard';
```

`useLapDelta` and `useLapRecordings` branch on the returned tag. The long comment
lives once, on the shared function.

**Acceptance criteria**

- Lap-wrap classification SHALL exist in exactly one module with a named threshold
  constant.
- Both consumers SHALL branch on its result rather than reimplementing the check.
- Tests SHALL cover: no wrap; wrap with full lap coverage; wrap without coverage
  (out-lap); teleport mid-lap.

**Affected capability:** `lap-telemetry-recording`, `lap-history`. **Bundle with D1.**

---

### D3
## `useLapDelta` is largely subsumed by `useLapRecordings`

**Severity:** Medium · **Effort:** M · **Type:** Redundancy · **Confidence:** Verified

**Where:** `web/src/hooks/useLapDelta.ts` (101 lines) vs `useLapRecordings.ts` (252 lines)

**Observed**

`useLapDelta` independently: builds a `{pos, timeMs}[]` series per lap; detects
restarts; detects wraps; applies the monotonic-position guard; selects the fastest
covering lap as reference; interpolates.

`useLapRecordings` already does all of the same bookkeeping while capturing a
strictly richer superset (`pos, timeMs, speedKmh, gas, brake, gear, steerAngle, x,
z`). And `lapAnalysis.ts:86` already exports `resolveReference()`, which selects the
reference lap with *stricter and more correct* rules than `useLapDelta` uses.

**This is a real behavioural discrepancy, not just duplication.**
`useLapDelta:49-52` selects its reference on `lastLapMs < referenceTimeRef` with no
validity check — **it will happily use a cut lap as the delta reference.**
`resolveReference` explicitly refuses to (`lapAnalysis.ts:83-85`: *"An invalid lap
must never stand in as 'best'/reference"*). So the Delta tile in `LapTimes` and the
delta trace in `LapAnalysis` can currently be measured against **different reference
laps** in the same session.

**Why this is objectively an improvement**

This is the strongest DRY case in the document because the duplication has already
produced a user-visible correctness inconsistency. Consolidating removes ~100 lines
*and* fixes the discrepancy.

**Proposed change**

Reduce `useLapDelta` to a consumer:

```ts
useLapDelta(telemetry, recordingsRef, lapsRef, version)
  → reference = resolveReference(recordingsRef.current, lapsRef.current)
  → delta = telemetry.lapTimeMs - interpolateTimeAt(reference.samples, telemetry.normalizedPos)
```

All bookkeeping — restart, wrap, monotonic guard, reference selection — comes from
`useLapRecordings` + `lapAnalysis`. The hook shrinks to roughly 25 lines.

**Verify carefully:** `useLapRecordings` rides the full-rate `subscribeFrame` while
`useLapDelta` rides the ~30 Hz throttled state. Confirm the delta still updates at
the display rate and that reading `recordingsRef` from the 30 Hz effect gives the
same visual result. Requires an explicit before/after comparison during the verify
step.

**Acceptance criteria**

- The live delta SHALL be computed against the same reference lap the analysis
  panel uses.
- An invalid (cut) lap SHALL NOT be used as the delta reference under any
  circumstances.
- `useLapDelta` SHALL NOT maintain its own per-lap sample series, restart
  detection, or wrap detection.
- WHEN no valid complete lap exists, THEN the delta SHALL read as unavailable
  rather than comparing against an invalid lap.

**Affected capability:** `lap-history`, `lap-analysis`, `racer-dashboard`.

**Risk:** Medium — this changes user-visible delta values in sessions containing a
fast cut lap. That change is the *point*, but it must be called out in the proposal
as intentional.

---

## Bundle: PROTOCOL

### D4
## Wire-protocol types hand-mirrored across workspaces

**Severity:** High · **Effort:** S · **Type:** Maintainability / Correctness · **Confidence:** Verified

**Where:** `bridge/src/types.ts` (91 lines) and `web/src/types.ts` (85 lines)

**Observed**

The two files are byte-identical for `SessionInfo`, `TelemetryFrame`, `CutEvent`,
`BridgeMessage`, `MapMeta`, `TrackEdges` — including the comments. `web/src/types.ts:1`
says *"Mirrors bridge/src/types.ts — keep the two in sync."* `CLAUDE.md` repeats the
obligation in bold.

**Why this is objectively an improvement**

Both sides are TypeScript. Both live in the same npm workspaces monorepo (root
`package.json:11-14`). The infrastructure to eliminate this entirely is already
installed and requires no new tooling.

The failure mode is worse than most duplication because **it type-checks on both
sides while being wrong**. Add `fuelLevel: number` to the bridge's
`TelemetryFrame`, forget the web copy: bridge compiles, web compiles, the field
arrives over the wire and is silently invisible to the app. Conversely, add it to
the web copy only and every component reads `undefined` typed as `number` — a
guaranteed `NaN` on screen with no compiler complaint anywhere. Standard monorepo
guidance is that a shared package is the single source of truth for exactly this
category of cross-boundary contract.

**Proposed change**

Add a third workspace, `protocol/`:

```
protocol/
  package.json     { "name": "@rivazza/protocol", "type": "module", "main": "src/index.ts" }
  src/index.ts     the union + all shared types, moved verbatim
```

Add `"protocol"` to root `workspaces`. Both `bridge` and `web` depend on it.
Types-only, so no build step is needed — `bridge` runs under `tsx` and `web` under
Vite, both of which resolve TypeScript sources through the workspace symlink.

Keep web-only types (`ConnectionStatus`) in `web/src/types.ts`, re-exporting from
the shared package so no import site churns.

**Acceptance criteria**

- The `BridgeMessage` union and every type it references SHALL be declared exactly
  once, in a shared workspace package.
- Both `bridge` and `web` SHALL import them from that package.
- WHEN a field is added to a shared type, THEN both workspaces SHALL see it
  without any additional edit.
- `npm run build` SHALL continue to pass for both workspaces with no new build step.
- `CLAUDE.md` SHALL be updated to remove the keep-in-sync instruction.

**Affected capability:** new `wire-protocol` spec.

**Risk:** Low, but touches every import in both workspaces. Best done as its own
change with no other content.

---

## Bundle: DRY-COLOR

### D5
## Canvas color literals duplicated across components

**Severity:** Low · **Effort:** XS · **Type:** Maintainability · **Confidence:** Verified

**Where:** `TrackMap.tsx:162-177`, `LapAnalysis.tsx:36-42`, `GForceMeter.tsx` (inline)

**Observed**

The pedal palette exists twice with identical values in different notations:

| Meaning | `TrackMap.tsx` | `LapAnalysis.tsx` |
|---|---|---|
| Throttle | `[18, 190, 60]` (line 176) | `'rgb(18, 190, 60)'` (line 38) |
| Brake | `[235, 55, 45]` (line 177) | `'rgb(235, 55, 45)'` (line 39) |
| Coast | `[250, 178, 25]` (line 175) | `'#fab219'` (line 40) |

`TrackMap.tsx:2019-2034` then hardcodes the same three as inline `style` props in
the JSX legend. Note that coast is `rgb(250,178,25)` in one place and `#fab219`
(= 250,178,25) in the other — the same color in two notations, which no search will
correlate.

**Why this is objectively an improvement**

`CLAUDE.md` mandates semantic design tokens (`web/src/index.css` `@theme`) and
forbids raw hex. Canvas genuinely cannot consume Tailwind classes, so these
literals are a legitimate exception — but the exception should be *one* module, not
scattered constants that silently disagree. `index.css:17` already defines
`--color-coast: #fab219`, so the token exists and the canvas simply is not using it.

**Proposed change**

`web/src/lib/canvasColors.ts` exporting the pedal ramp as RGB tuples plus derived
CSS strings, with a comment explaining why canvas bypasses Tailwind. Consumers:
`TrackMap`, `LapAnalysis`, `GForceMeter`, and the JSX legend swatches. Keep the
values byte-identical so this change is provably pixel-neutral.

**Acceptance criteria**

- Every canvas color literal used by more than one component SHALL be defined once
  in a shared module.
- The rendered output SHALL be pixel-identical to the current build.
- The JSX legend swatches SHALL read from the same source as the canvas strokes.

**Affected capability:** `driving-line-gradient`.

---

## Bundle: TRACKMAP-SPLIT

### E1
## `TrackMap.tsx` is 2,096 lines with a ~1,530-line effect

**Severity:** High · **Effort:** L · **Type:** Maintainability / Scalability · **Confidence:** Verified

**Where:** `web/src/components/TrackMap.tsx`

**Observed**

2,096 lines — measured. The next largest file in the repo is `LapAnalysis.tsx` at
599, and the median component is under 120. A single `useEffect` spans lines
474–2005 (~1,530 lines, 73% of the file) and contains:

| Concern | Lines |
|---|---|
| Edge-view bounds + static ribbon geometry | 491–552 |
| Projection types, zoom composition, affine extraction | 554–610 |
| Layer sizing / blitting | 612–626 |
| Track ribbon layer | 641–681 |
| Completed-laps layer | 685–716 |
| Current-lap bucket layer | 718–796 |
| Live tail | 798–841 |
| Hit-test | 843–919 |
| Hover readout | 921–992 |
| Draw orchestration | 1001–1058 |
| Brake ticks, rings, cut markers | 1060–1156 |
| Heading tracking + car marker | 1158–1251 |
| Dirty-gate state | 1253–1288 |
| Follow camera | 1290–1446 |
| rAF loop + three projection modes | 1455–1777 |
| Wheel handler | 1787–1835 |
| Touch handlers | 1836–1984 |
| Listener wiring + teardown | 1986–2004 |

**Why this is objectively an improvement**

Three concrete, non-aesthetic consequences:

1. **Nothing in it is testable.** Every one of those functions is a closure over
   effect-local `let` bindings. The follow camera is nearly pure — its inputs are
   `(base, width, height, dt)` plus refs — yet cannot be tested because it cannot
   be imported. This blocks [C6](#c6)-style coverage for the most intricate maths
   in the project.
2. **Nothing in it is reusable.** `affineOf`/`strokeWorldPath`/`zoomed` are
   general-purpose and would serve `LapAnalysis`, but are unreachable.
3. **Every map feature lands in the same closure.** The archived change list shows
   `follow-cam`, `zoom-steps`, `wheel-zoom`, `heading-marker`, `cut-markers`,
   `mobile-touch-parity` all landed here. The trend line is clear and the file is
   the growth ceiling.

Also relevant: the effect's dependency array (line 2005) lists 7 refs plus
`mapData`. Refs are stable, so in practice only `mapData` retriggers — but that
teardown/rebuild destroys all three offscreen layers, all cached `Path2D` geometry,
and every event listener. That is correct today and fine; it is worth an explicit
comment as part of this work so the next reader does not "optimize" it.

**Proposed change**

Extract along the seams the code already has. Suggested target:

```
web/src/lib/map/projection.ts      Project, Affine, affineOf, zoomed,
                                   the three base projections as factories
web/src/lib/map/followCamera.ts    createFollowCamera() → { tick(base,w,h,dt), retarget(), limits }
web/src/lib/map/layers.ts          sizeLayer, blitLayer, strokeWorldPath, buildLapPath,
                                   the three layer renderers as a LayerSet class/factory
web/src/lib/map/hitTest.ts         hitTestLaps + HoverRow/HitResult types
web/src/lib/map/markers.ts         drawDot, drawRing, drawCutMarker, drawBrakeTicks, trackHeading
web/src/hooks/useMapGestures.ts    wheel + touch + dwell, returns handlers
web/src/components/TrackMap.tsx    composition + JSX (~250 lines target)
```

**Sequencing matters.** Do this in ordered slices, each independently verified,
never as one commit:

1. `projection.ts` (pure, zero behaviour change, easiest to prove)
2. `markers.ts` (pure draw functions taking `ctx`)
3. `layers.ts`
4. `hitTest.ts`
5. `followCamera.ts` (most intricate — do it once the rest is stable)
6. `useMapGestures.ts`

**Acceptance criteria**

- `TrackMap.tsx` SHALL be under 400 lines.
- Projection, camera, layer rendering, hit-testing and gesture handling SHALL each
  live in their own module with an explicit interface.
- The rendered output SHALL be visually identical at every step: same draw order
  (ribbon → previous laps → current lap → tail → focus emphasis → brake ticks →
  cut markers → scrub ring → hover ring → readout → car marker), same dirty-gating
  behaviour, same idle-at-rest guarantee.
- The follow camera SHALL be unit-testable without a canvas.
- All `render-efficiency` spec scenarios SHALL still hold.

**Affected capability:** `render-efficiency`, `track-map-viewport`,
`track-map-follow-cam`, `track-map-zoom`, `touch-interaction`, `car-heading-marker`,
`cut-markers`, `driving-line-gradient`. **This change touches more specs than any
other in the document** — which is itself the argument for doing it.

**Risk:** High if done in one pass, low if sliced. The `render-efficiency` spec's
scenarios are the regression suite; run them at each slice.

---

## Bundle: CLEANUP

### E3
## Dead "LEARNING LOG" code in the 60 Hz packet path

**Severity:** Low · **Effort:** XS · **Type:** Cleanup · **Confidence:** Verified

**Where:** `bridge/src/acClient.ts:32`, `73-78`

**Observed**

```ts
private lastFrameLogAt = 0; // LEARNING LOG throttle; delete with the log below
...
// LEARNING LOG: the same bytes you saw in hex, now decoded. Throttled to
// ~2/s so it's readable (the real stream is ~60/s). Delete when done.
const now = Date.now();
if (now - this.lastFrameLogAt > 500) {
  this.lastFrameLogAt = now;
}
```

The log statement was removed; the throttle scaffolding was not. What remains is a
`Date.now()` call, a comparison, and an assignment, executed on every RTCarInfo
packet — roughly 60 times per second — accomplishing nothing.

**Why this is objectively an improvement**

The performance cost is negligible and is not the argument. The argument is that
the code carries a self-identifying deletion marker ("Delete when done") in the
project's hottest loop, and a comment describing a log that no longer exists.
For a codebase whose defining strength is that its comments are trustworthy, a
comment describing absent behaviour is a real defect. It is also the only
`TODO`-shaped thing in a repo that otherwise has zero.

**Proposed change**

Delete lines 32 and 73–78. Verify the field is not referenced elsewhere (it is
not).

**Acceptance criteria**

- `ACClient` SHALL contain no unused fields.
- `onMessage` SHALL perform no work beyond parsing, emitting, and refreshing the
  stale timer.
- The bridge SHALL continue to type-check and run against the mock unchanged.

**Affected capability:** none — pure cleanup.

---

# P3 — Hardening and resilience

## Bundle: HARDENING

### B1
## Unvalidated remote strings build filesystem paths served over HTTP

**Severity:** Medium (low exploitability, real exposure) · **Effort:** S · **Type:** Security · **Confidence:** Verified

**Where:** `bridge/src/trackAssets.ts:71`, `115-116`; `bridge/src/carAssets.ts:16`

**Observed**

```ts
// trackAssets.ts:71
const trackRoot = path.join(AC_PATH, 'content', 'tracks', track);
// carAssets.ts:16
const uiPath = path.join(AC_PATH, 'content', 'cars', carName, 'ui', 'ui_car.json');
```

`track`, `trackConfig`, and `carName` all originate from `parseHandshakerResponse`
— i.e. from bytes received on UDP 9996. `readWideString` (`parsers.ts:16-27`) cuts
at the first control character or `%` and trims, but performs **no filtering of
`.`, `/`, or `\`**. The resulting path flows into `mapImagePath`, which is streamed
to any HTTP client at `/api/track-map/image`.

**Why this is objectively an improvement**

Node path-traversal guidance is unambiguous that `path.join`/`path.normalize` are
not security controls — they resolve `..` rather than reject it — and that the
correct pattern is to `path.resolve()` the candidate and verify it remains inside
the permitted base, comparing against `base + path.sep` so that `/uploads` does not
match `/uploads-evil`. The recommended stronger form is to avoid user-supplied path
segments entirely in favour of ID-based lookup against a known set.

**Realistic threat assessment, stated plainly:** exploitation requires an attacker
able to answer the UDP handshake before the game does, or an operator who has
pointed `AC_HOST` at a hostile machine. The impact ceiling is reading files the
bridge process can read. This is **not** an urgent vulnerability. It is worth
fixing because the mitigation is ~5 lines, the code already validates far more
exotic things (see `aiSpline.ts`'s six checks), and combined with [B2](#b2) the
endpoint is reachable from the whole LAN.

**Proposed change**

In `parsers.ts` or a new `lib/safePath.ts`:

1. Reject any handshake identifier not matching `/^[A-Za-z0-9 ._-]+$/` (AC folder
   ids are conservative; `prettifyName` already assumes `[_-]` separators).
2. After `path.join`, `path.resolve` and assert the result starts with
   `path.resolve(AC_PATH) + path.sep`.
3. Log the rejection with the same `JSON.stringify` treatment `trackAssets.ts:103`
   already uses to expose invisible characters, and degrade to "no map data" —
   the fallback path that already exists and is already specified.
4. Prefer the ID-lookup form where cheap: `listTrackConfigs` (line 115) already
   enumerates the real subdirectories, so `trackConfig` can be validated by set
   membership rather than by string rules.

**Acceptance criteria**

- Track, layout, and car identifiers derived from the handshake SHALL be validated
  against a conservative character allowlist before use in any filesystem path.
- Every resolved asset path SHALL be verified to remain within `AC_PATH`.
- WHEN validation fails, THEN the bridge SHALL log the rejected value with escaped
  invisible characters and SHALL fall back to the existing no-map-data behaviour.
- `trackConfig` SHALL be validated by membership in the enumerated layout folders
  where that list is available.
- Tests SHALL cover `..`, absolute paths, and separator injection for both track
  and car names.

**Affected capability:** `track-asset-resolution`, `car-spec-resolution`.

---

### B2
## Bridge binds all network interfaces by default

**Severity:** Low–Medium · **Effort:** XS · **Type:** Security posture · **Confidence:** Verified

**Where:** `bridge/src/index.ts:150`

**Observed**

```ts
server.listen(PORT, () => { console.log(`... http://localhost:${PORT}`); });
```

No host argument. The log line says `localhost`, which is misleading.

**Why this is objectively an improvement**

Node's documentation: *"If `host` is omitted, the server will accept connections on
the unspecified IPv6 address (`::`) when IPv6 is available, or the unspecified IPv4
address (`0.0.0.0`) otherwise."* And: *"In most operating systems, listening to the
unspecified IPv6 address (`::`) may cause the `net.Server` to also listen on the
unspecified IPv4 address (`0.0.0.0`)."*

So the bridge is reachable from the entire local network while telling the operator
it is on `localhost`. Combined with [B3](#b3)'s wildcard CORS and [B1](#b1)'s
unvalidated paths, that is three defaults compounding.

**Important nuance — do not simply lock it down.** The responsive layout
(`App.tsx:94` `lg:` breakpoints), the whole `touch-interaction` and
`responsive-header` specs, and `useTelemetry`'s use of `window.location.hostname`
rather than `localhost` all strongly indicate that **LAN access is an intended
feature** (phone or tablet as a second screen). The fix is therefore to make the
binding *explicit and opt-in*, not to remove it.

**Proposed change**

Add `BRIDGE_HOST`, defaulting to `127.0.0.1`. Document that binding to `0.0.0.0`
enables second-screen access on the local network and should be used on trusted
networks only. Correct the startup log to print the address actually bound.

**Acceptance criteria**

- The bridge SHALL bind `127.0.0.1` by default.
- The bridge SHALL bind the address given in `BRIDGE_HOST` when set.
- The startup log SHALL name the interface actually bound, never a hardcoded
  `localhost`.
- The README SHALL document `BRIDGE_HOST` including the second-screen use case and
  its trust assumption.

**Affected capability:** new `bridge-connection` spec. **Bundle with B3, G1.**

---

### B3
## Wildcard CORS on the bridge

**Severity:** Low · **Effort:** XS · **Type:** Security posture · **Confidence:** Verified

**Where:** `bridge/src/index.ts:25`

**Observed**

```ts
res.setHeader('Access-Control-Allow-Origin', '*');
```

Unconditional, on every response including `/api/track-map/image`.

**Why this is objectively an improvement**

With `*`, any web page the user visits while the bridge runs can read the track
metadata and map image endpoints from script. The data is low-sensitivity (track
geometry from a commercial game), so severity is genuinely low. But the header is
broader than the need: the only legitimate consumers are the Vite dev server
(`:5173`) and same-origin production builds.

Note this is *only* a hardening item once [B2](#b2) is in place — with a loopback
bind, the exposure narrows to the local machine.

**Proposed change**

Echo the origin only when it matches an allowlist derived from `BRIDGE_HOST` and a
configurable dev-server port, defaulting to `http://localhost:5173` and
`http://127.0.0.1:5173`. Keep `*` available behind an explicit env opt-in for
users running unusual setups, so nobody's working configuration breaks silently.

**Acceptance criteria**

- The bridge SHALL respond with a specific allowed origin rather than `*` by
  default.
- The default allowlist SHALL include the Vite dev server origin so
  `npm run dev` works unchanged.
- WHEN an explicit opt-in env var is set, THEN the wildcard SHALL be restored.

**Affected capability:** `bridge-connection`. **Bundle with B2.**

---

### A5
## No WebSocket backpressure handling

**Severity:** Medium · **Effort:** S · **Type:** Robustness · **Confidence:** Verified

**Where:** `bridge/src/index.ts:69-74`

**Observed**

```ts
const broadcast = (message: BridgeMessage): void => {
  const payload = JSON.stringify(message);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  }
};
```

`readyState` is checked; `bufferedAmount` is not. At 60 Hz with ~636 bytes per
telemetry frame (measured), the bridge produces roughly **38 KB/s per client**.

**Why this is objectively an improvement**

The `ws` documentation defines `bufferedAmount` as *"The number of bytes of data
that have been queued using calls to `send()` but not yet transmitted to the
network"* — i.e. the exact signal needed and already available. Node WebSocket
practice for real-time streams converges on the same pattern: check
`bufferedAmount` before sending and drop rather than queue, because for telemetry a
stale frame has no value; and unbounded queuing is the documented path to
out-of-memory under slow consumers.

This project is an unusually good fit for drop-on-backpressure, because
**the whole pipeline is already built on "keep only the newest frame"** — that is
precisely what `latestFrame`/`frameDirty` (`index.ts:21-22, 116-135`) does upstream.
Extending the same policy to the socket is consistent rather than novel.

**Proposed change**

Skip `telemetry` messages for any client whose `bufferedAmount` exceeds a threshold
(a few frames' worth — e.g. 64 KB). **Never skip `status`, `session`, or `cut`**:
those are stateful events, not samples, and dropping one corrupts client state
permanently. Optionally log once per client when it starts dropping.

**Acceptance criteria**

- WHEN a client's `bufferedAmount` exceeds the configured threshold, THEN
  `telemetry` frames for that client SHALL be dropped rather than queued.
- `status`, `session`, and `cut` messages SHALL always be sent regardless of
  buffered amount.
- A slow client SHALL NOT cause unbounded memory growth in the bridge.
- Other clients SHALL be unaffected by one slow client.

**Affected capability:** `bridge-resilience`. **Bundle with A1–A4.**

---

## Bundle: REACT-PURITY

### F1
## Refs read during render — concurrent-rendering hazard

**Severity:** Medium · **Effort:** M · **Type:** Correctness · **Confidence:** Verified

**Where:** `LapTimes.tsx:121-126, 136, 158`; `LapAnalysis.tsx:80-89, 453-458`

**Observed**

```ts
// LapTimes.tsx:121
const laps = lapsRef.current;                    // ← render body
const validTimes = laps.filter((l) => !l.invalid).map((l) => l.timeMs);
...
invalid={currentLapInvalidRef.current}           // ← render body

// LapAnalysis.tsx:80-81
const recordings = recordingsRef.current;        // ← render body
const laps = lapsRef.current;                    // ← render body
```

`main.tsx:7` wraps the app in `<StrictMode>`, and `web/package.json` pins React
`^19.2.7`.

**Why this is objectively an improvement**

The React documentation is explicit:

> **Do not write _or read_ `ref.current` during rendering.** React expects that the
> body of your component behaves like a pure function… Reading or writing a ref
> **during rendering** breaks these expectations.

And on why it matters for external mutable data: if a store mutates mid-render,
different components can read different versions — *tearing*.
`useSyncExternalStore` exists for exactly this, and guarantees consistency:
*"for every Transition update, React will call `getSnapshot` a second time just
before applying changes to the DOM. If it returns a different value… React will
restart the update… to ensure that every component on screen is reflecting the same
version of the store."*

**Be precise about the current impact.** This is not a live bug today: the app uses
no Transitions, no Suspense-driven concurrent boundaries, and the ~30 Hz telemetry
state (`useTelemetry.ts:18`) re-renders these components frequently enough that
stale reads self-correct within ~33 ms. The ref-first architecture is a deliberate,
well-documented, and genuinely effective performance decision — this item does not
propose abandoning it.

What it proposes is closing the specific gap where **render-phase** reads occur.
Those are the ones the documentation prohibits, and they are the ones that would
break the moment anyone adopts `startTransition`, `useDeferredValue`, or a
Suspense boundary — a change that would appear entirely unrelated to lap times.

**Proposed change**

Distinguish two categories:

- **rAF/effect/event-handler reads** (`TrackMap`'s loop, `useInputHistory`
  consumers, `useLapHistory`'s effect): **leave exactly as they are.** These are
  explicitly sanctioned by the docs and are the core of the performance design.
- **Render-phase reads** (`LapTimes`, `LapAnalysis`): convert to
  `useSyncExternalStore`, subscribing to the existing change signals the codebase
  already maintains — `cutSeq` and `version` are already exactly this kind of
  signal. The `getSnapshot` must return a cached value that only changes identity
  when the data does, which the existing version counters make straightforward.

Consider a small `useRefStore(ref, version)` helper so the pattern is applied
identically in both places.

**Acceptance criteria**

- No component SHALL read `ref.current` in its render body.
- Render-phase access to lap history and lap recordings SHALL go through
  `useSyncExternalStore` with a snapshot that is stable under `Object.is` when the
  underlying data has not changed.
- rAF and effect-based ref reads SHALL be unchanged.
- Re-render frequency SHALL NOT increase measurably; the `render-efficiency` spec's
  idle-at-rest scenario SHALL still hold.

**Affected capability:** `render-efficiency`, `racer-dashboard`, `lap-analysis`.

**Risk:** Medium. `getSnapshot` returning a fresh object each call causes an
infinite render loop — the classic mistake. The version-counter caching must be
correct, and this needs an explicit test.

---

## Bundle: REACT-RESILIENCE

### F2
## No error boundaries

**Severity:** Medium · **Effort:** S · **Type:** Robustness · **Confidence:** Verified

**Where:** `web/src/App.tsx`, `web/src/main.tsx`

**Observed**

No class component and no error boundary anywhere in `web/src`. A single throw in
any component unmounts the entire React tree, leaving a blank page.

**Why this is objectively an improvement**

The two largest canvas components perform arithmetic on live telemetry with a
number of division and array-index operations —
`TrackMap.tsx:1340` (`(wanted - a.at) / (b.at - a.at)`),
`1358` (`pxPerMeter`, guarded), `1076-1080` (normal length, guarded),
`LapAnalysis.tsx:245` (`d / deltaRange`),
`lapAnalysis.ts:47` (`span`, guarded).

Most are guarded — the code is careful. But `TrackMap.tsx:1332`
(`trail[trail.length - 1]`) and `1333` (`trail[0].at`) both index a buffer that is
cleared on teleport at line 1325, and a malformed frame reaching an unguarded path
takes down the gauges, lap list, and pedal trace along with the map.

React's own documentation states: *"There is currently no way to write an Error
Boundary as a function component. However, you don't have to write the Error
Boundary class yourself. For example, you can use `react-error-boundary` instead."*
So a class component is required, and the official docs name the package to avoid
writing one.

Given the app's context — a driver glancing at a second screen mid-session — the
difference between "the map panel shows an error" and "the screen is blank" is
substantial.

**Proposed change**

One small `ErrorBoundary` class component (no dependency needed for this scope),
wrapping each top-level panel independently: `InstrumentCluster`, `LapTimes`,
`PedalTrace`, `GForceMeter`/`SteeringBar`, `TrackMap`, `LapAnalysis`. Fallback:
a bordered panel matching the surrounding design tokens, naming the panel, with
the error logged to console.

**Acceptance criteria**

- Each top-level dashboard panel SHALL be wrapped in an error boundary.
- WHEN one panel throws during render, THEN the remaining panels SHALL continue
  rendering and updating with live telemetry.
- The fallback SHALL use the existing semantic design tokens and SHALL identify
  which panel failed.
- The error SHALL be logged to the console with a component stack.

**Affected capability:** `racer-dashboard`.

**Note:** error boundaries do **not** catch errors thrown inside `requestAnimationFrame`
callbacks or event handlers. Since most canvas work happens in rAF, this item
should be paired with a guard inside the rAF loops themselves, or its value will be
smaller than expected. State that explicitly in the proposal.

---

# P4 — Performance and data volume

## Bundle: DEMO-PAYLOAD

### H1
## Demo recording is 16.66 MB / 88 ms parse / ~37 MB retained

**Severity:** Medium · **Effort:** M · **Type:** Performance · **Confidence:** Measured

**Where:** `web/public/demo/imola.json`, produced by `bridge/src/record.ts`,
consumed by `useTelemetry.ts:174-186`

**Observed (all measured on this machine)**

```
Raw size            16.66 MB
gzip                 3.26 MB
Entries             26,351  (26,345 telemetry / 1 session / 1 status / 4 cut)
Span                439.1 s (7m 19s)
Fields per frame    28
Bytes per frame     ~636
JSON.parse          88.5 ms (desktop Node)
Heap after parse    ~37 MB retained
Git history         4 revisions of this file (commits ad07a1a, e476106, 74ca466, 59ff331)
```

**Why this is objectively an improvement — with the overstatement removed**

Vercel's CDN documentation confirms `application/json` **is** on the automatic
compression allowlist, and no size threshold for compression is documented. So the
*wire* cost is ~3.26 MB gzip (less with Brotli, which Vercel prefers), not 16.66 MB.
The transfer is therefore not as bad as the raw number suggests, and any claim to
the contrary would be wrong.

The costs that remain real:

1. **Parse blocks the main thread.** 88.5 ms measured on desktop Node. Mobile
   browsers are commonly 3–5× slower on this workload, putting a realistic phone in
   the 300–450 ms range — a visible stall during which `DemoLoadingScreen`
   (`App.tsx:23`) is frozen, since the parse is synchronous on the main thread.
2. **~37 MB retained for the session's lifetime**, and the replay loops forever
   (`useTelemetry.ts:160-166`), so it is never released. On a memory-constrained
   phone this contributes to tab eviction.
3. **Repo weight is permanent.** Four revisions of a ~17 MB file are in git history
   and cannot be removed without a rewrite. Every clone pays for all of them.
4. **The payload carries fields the replay never needs at full precision.** Each
   frame serialises 28 fields including `tyreSlip` and `wheelLoad` (4-element float
   arrays each) at full float precision — `x`, `y`, `z` to ~7 significant digits
   when the map samples at 1 m spacing.

**Proposed change**

A versioned compact format ([J2](#j2) is the prerequisite):

- **Quantize:** positions to cm (`Math.round(v*100)`), pedals/inputs to 3 decimals,
  speed to 1 decimal. The AI-spline parser already establishes cm precision as the
  project's convention (`aiSpline.ts:38` `roundCm`).
- **Delta-encode** monotonic fields (`t`, `lapTimeMs`) — these dominate and are
  nearly linear.
- **Columnar layout:** arrays per field rather than an object per frame. Removes
  26,345 repetitions of every key name — likely the single largest win.
- Keep the decoder in `useTelemetry` reconstructing exact `TelemetryFrame` objects,
  so **nothing downstream changes**.

Realistic target: under 2 MB raw, sub-20 ms parse. Verify by measurement, and state
the achieved numbers in the change's verify step.

**Consider also:** parsing off the main thread in a Worker, or streaming the first
few seconds so playback starts before the whole file lands. Both are follow-ups,
not part of this change.

**Acceptance criteria**

- The demo recording SHALL be under 3 MB raw.
- Decoded frames SHALL be numerically equivalent to today's within the documented
  quantization tolerance (cm for position, 1e-3 for normalized inputs).
- Parse-and-decode time SHALL be measured before and after and reported.
- The replay SHALL be visually indistinguishable from the current build: same lap
  count, same 4 cut markers, same lap times.
- The recorder SHALL emit the new format and the loader SHALL reject unknown
  schema versions with the existing `DemoUnavailableScreen`.

**Affected capability:** `demo-replay`, `lap-telemetry-recording`.

**Bundle with [J2](#j2)** — do not ship a new format without a version field.

---

### J2
## Recording format has no schema version

**Severity:** Low · **Effort:** XS · **Type:** Maintainability · **Confidence:** Verified

**Where:** `bridge/src/record.ts:27`, `useTelemetry.ts:22`

**Observed**

```ts
type Recording = { t: number; msg: BridgeMessage }[];   // bridge
type RecordedEntry = { t: number; msg: BridgeMessage }; // web
```

A bare array. No envelope, no version, no metadata. The type is also duplicated
across workspaces (a further instance of [D4](#d4)).

**Why this is objectively an improvement**

The recording embeds `BridgeMessage` verbatim. Any change to `TelemetryFrame` — a
new field, a renamed field, a unit change — silently invalidates every committed
recording, and the failure surfaces as wrong values on screen rather than a load
error. The 26,345 frames in the current file are a real captured Imola session that
cannot be re-recorded without the car, the track, and the driving.

An envelope also creates the natural home for what the recorder currently prints to
the console and then discards (`record.ts:98-107`): message counts, duration, track,
car. Today `App.tsx` cannot show "Imola · Ferrari · 7m 19s" during loading because
that information is not in the file.

**Proposed change**

```ts
type Recording = {
  version: 1;
  recordedAt: string;      // ISO
  track: string;
  car: string;
  durationMs: number;
  entries: RecordedEntry[];
};
```

Loader validates `version` and shows `DemoUnavailableScreen` on mismatch. Move the
type into the shared `protocol` package from [D4](#d4).

**Acceptance criteria**

- The recording format SHALL carry an explicit numeric schema version.
- WHEN the loader encounters an unknown version, THEN it SHALL show the unavailable
  screen rather than replaying malformed data.
- The envelope SHALL carry track, car, duration and recording timestamp.
- The format type SHALL be declared once and shared by recorder and player.

**Affected capability:** `demo-replay`. **Prerequisite for [H1](#h1).**

---

## Bundle: MAP-PERF

### H2
## Lap hit-test is an unindexed linear scan

**Severity:** Low–Medium · **Effort:** M · **Type:** Performance · **Confidence:** Verified (analysis)

**Where:** `web/src/components/TrackMap.tsx:865-919`

**Observed**

```ts
laps.forEach(({ lap, samples }, index) => {
  for (let i = 0; i < samples.length; i += 3) {
    const { px, py } = project(samples[i]);
    const d = (px - m.x) ** 2 + (py - m.y) ** 2;
    ...
  }
});
```

Every stored lap, every third sample, every dirty frame while the cursor is over
the canvas. With `MAX_LAPS = 40` (line 79) and `SAMPLE_SPACING = 1` m (line 77), a
5 km circuit gives ~5,000 samples per lap → **~66,000 projection calls and distance
computations per frame**.

**Why this is objectively an improvement**

Two mitigations already keep this acceptable today: the `i += 3` stride, and the
dirty gate (line 1481) which means it only runs on frames where something changed.
Measured frame times are fine and no user-visible problem exists — **this is not a
current bug.**

It matters as a *ceiling*. It scales as `laps × track_length`, and three plausible
future changes each push it over: raising `MAX_LAPS`, reducing `SAMPLE_SPACING` for
finer corner shapes, or the Nordschleife (~20.8 km → ~20,800 samples per lap → over
270,000 operations per frame with the current constants).

**Proposed change**

Cheap, high-leverage, in order:

1. **Per-lap bounding box.** Store `{minX, maxX, minZ, maxZ}` when a lap is stored
   (line 1538) — the data is already being accumulated in `boundsRef` for the
   fallback view. Project the cursor into world space (the projection is affine and
   invertible — `affineOf` already exposes `k`, `tx`, `ty`) and skip any lap whose
   box does not contain the cursor plus the hover radius. On a zoomed-in view this
   eliminates nearly every lap immediately.
2. **Uniform world-space grid** per lap, built lazily alongside the existing lazy
   `path` (line 706 `entry.path ??=`). Bucket size ≈ hover radius in world meters;
   the query touches 9 cells.
3. **Cache the result** across frames where neither the mouse position nor the
   projection changed. Both are already tracked as dirty-gate terms
   (`lastMouse`, `lastZoom`), so the cache key exists.

Step 1 alone likely suffices and is ~15 lines.

**Acceptance criteria**

- Hover picking SHALL produce identical results to the current implementation:
  same nearest lap, same readout rows, same marker point.
- Hit-test cost SHALL NOT grow linearly with the number of stored laps when the
  cursor is near only one of them.
- Hover SHALL remain responsive with 40 stored laps on a 20 km circuit.

**Affected capability:** `render-efficiency`, `lap-line-comparison`.

---

### H3
## Driven line stored twice in different shapes

**Severity:** Low · **Effort:** M · **Type:** Memory · **Confidence:** Verified

**Where:** `TrackMap.tsx:263-274, 78-79` vs `useLapRecordings.ts:6-31, 36-39`

**Observed**

Two independent per-lap stores of overlapping data:

| | `TrackMap` `Sample[]` | `useLapRecordings` `LapTelemetrySample[]` |
|---|---|---|
| Fields | `x, z, gas, brake, speedKmh, gear, jump` | `pos, timeMs, speedKmh, gas, brake, gear, steerAngle, x, z` |
| Rate | 1 m spacing | full stream rate |
| Cap | `MAX_LAPS 40` × `MAX_SAMPLES 25000` | `MAX_RECORDED_LAPS 30` × `MAX_LAP_SAMPLES 12000` |
| Self-declared worst case | — | *"~20 MB"* (`useLapRecordings.ts:35`) |

Six of seven `Sample` fields are present in `LapTelemetrySample`; only `jump` is
unique, and it is derivable from consecutive positions (`TELEPORT_DIST`, line 81).

**Why this is objectively an improvement**

Both stores are explicitly bounded with documented caps, so this is *not* an
unbounded leak and the code is responsible about it. The improvement is that a
long session pays twice for nearly the same data, and — more importantly — the two
can *disagree*: they use different caps (40 vs 30 laps), different sampling rules,
and independent restart handling ([D1](#d1)). A lap can exist on the map and not in
the analysis panel, which is currently true and mildly confusing.

**Proposed change**

Investigate — do not assume — whether `TrackMap` can consume `recordingsRef` as its
source of stored-lap geometry, with the 1 m spatial decimation applied as a derived
view (computed once per lap, cached beside the existing lazy `Path2D`) rather than
as a separately captured stream. The current lap's live line still needs its own
append path for latency reasons, so scope this to *completed* laps.

**Flagged as genuinely uncertain.** The two stores have different lifecycles, caps,
and reset triggers, and `TrackMap`'s spacing-based sampling exists precisely so the
map is resolution-independent of the frame rate. This may turn out not to be worth
it. The proposal should begin with a spike, and abandoning it is an acceptable
outcome.

**Acceptance criteria (if pursued)**

- Completed-lap geometry SHALL have a single source of truth.
- Map rendering SHALL remain visually identical, including 1 m effective sampling
  and teleport breaks.
- The lap set shown on the map and the lap set in the analysis panel SHALL be
  consistent.
- Peak memory over a 60-minute session SHALL be measured before and after.

**Affected capability:** `lap-telemetry-recording`, `render-efficiency`,
`lap-line-comparison`.

---

### H4
## "Ring buffer" implemented with `Array.shift()`

**Severity:** Very Low · **Effort:** XS · **Type:** Cleanup · **Confidence:** Verified

**Where:** `web/src/hooks/useInputHistory.ts:16, 37`

**Observed**

```ts
// "Ring buffer of recent driver inputs…"
history.push({...});
if (history.length > CAPACITY) history.shift();
```

`CAPACITY = 360`.

**Why this is objectively an improvement**

`Array.prototype.shift()` removes the first element and re-indexes the remainder —
it is not the O(1) operation a ring buffer promises. At 360 elements and ~30 Hz the
real cost is negligible and this is **not a performance problem**.

The issue is that the comment says "ring buffer" and the code implements a shifting
array, in a codebase whose defining quality is that its comments are precise. Either
implement the ring (fixed array + head index) or amend the comment to "bounded
FIFO". Both are correct outcomes; the current state is the only wrong one.

**Acceptance criteria**

- The buffer's implementation SHALL match its documented description.
- The consumers (`PedalTrace`, `GForceMeter`) SHALL observe identical sample
  ordering and count.

**Affected capability:** `racer-dashboard`. **Bundle with [E3](#e3).**

---

### H5
## Synchronous file reads inside an async resolution path

**Severity:** Very Low · **Effort:** XS · **Type:** Consistency · **Confidence:** Verified

**Where:** `trackAssets.ts:19, 53, 78, 95, 119, 128-129`; `aiSpline.ts:89`;
`carAssets.ts:19`

**Observed**

`resolveTrackAssetsForSession` is `async` and awaited from the session handler
(`index.ts:89`), yet every filesystem operation beneath it is synchronous:
`readFileSync`, `existsSync`, `readdirSync`. `aiSpline.ts:89` reads an entire
`fast_lane.ai` — which can be several MB — with `readFileSync`.

**Why this is objectively an improvement**

This runs once per session, during the handshake, before any telemetry is flowing.
So the event-loop stall has **no practical impact today** and the code is not
wrong. It is listed for one reason: it is the only place in the project where an
`async` signature hides fully synchronous work, which misleads a reader into
thinking the path is non-blocking. If asset resolution ever moves onto a hot path
(track switching mid-session, multi-layout probing), the stall becomes real.

**Proposed change**

Either convert to `fs.promises` throughout (small, mechanical, matches the `async`
signature), or document at the function level that the `async` exists solely for
`readStaticPage` and that all I/O is deliberately synchronous because it runs once
at session start. **Both are acceptable**; the point is that the reader should not
have to check.

**Acceptance criteria**

- Asset resolution SHALL either use asynchronous file I/O throughout, or SHALL
  document explicitly why synchronous I/O is intentional and where it runs.
- Session-start latency SHALL NOT regress.

**Affected capability:** `track-asset-resolution`.

---

# P5 — Accessibility and product scalability

## Bundle: A11Y

> Context first, because it changes what "correct" means here. The hover-only
> interaction model is **not an oversight** — it is a documented product constraint
> (`TrackMap.tsx:120-122`: *"never a click — clicks would focus the browser and
> steal controller input from the game"*). Any accessibility proposal must preserve
> that. The items below are all additive: they add reachable alternatives without
> introducing focus-stealing interactions into the live build.

### I1
## Canvas elements have no fallback content or accessible alternative

**Severity:** Medium · **Effort:** S · **Type:** Accessibility · **Confidence:** Verified

**Where:** `TrackMap.tsx:2093`, `LapAnalysis.tsx:557`, `PedalTrace.tsx`,
`GForceMeter.tsx`

**Observed**

```tsx
<canvas ref={canvasRef} className="size-full touch-none" />
```

Self-closing, empty, no `role`, no `aria-label`, no fallback children. All four
canvases follow this pattern. Substantial information — the entire track map, lap
lines, hover readouts, delta traces, sector bars — exists only as pixels.

**Why this is objectively an improvement**

MDN is direct: *"The `<canvas>` element, like the `<img>`, `<video>`, `<audio>`,
and `<picture>` elements, **must be made accessible by providing fallback text** to
be displayed when the media doesn't load or the user is unable to experience it as
intended."* And: *"Providing useful fallback text or sub DOM adds accessibility to
an otherwise non-accessible element."*

The mechanism is trivial — content placed *inside* the `<canvas>` tags is ignored
by browsers that render the canvas and exposed to assistive technology:

```html
<canvas id="stockGraph" width="150" height="150">
  current stock price: $3.15 + 0.15
</canvas>
```

This project has an unusually good story available, because **the data is already
computed and already formatted**. `LapTimes` renders lap times as real DOM.
`legend` state (`TrackMap.tsx:406`) already holds `{lap, color, timeMs, invalid}`
per colored lap as a React array. A textual summary inside the canvas is close to
free.

**Proposed change**

- `TrackMap` canvas: children summarizing session state — track name, current lap,
  and the legend entries as text. The legend array already exists; render it inside
  the canvas element as well as in the overlay.
- `LapAnalysis` canvas: children naming the selected lap, the reference lap, and
  the delta at the lap end.
- `PedalTrace` / `GForceMeter`: `aria-label` describing the visualization plus a
  brief current-value summary.
- Add `role="img"` where the canvas is presentational rather than interactive.

**Acceptance criteria**

- Every `<canvas>` SHALL contain fallback content or carry an accessible label.
- The track map's fallback SHALL convey track, current lap, and recorded lap times.
- The analysis panel's fallback SHALL convey the selected and reference laps.
- The fallback SHALL update as the session progresses, not be static text.
- Rendered visual output SHALL be unchanged.

**Affected capability:** new `accessibility` spec.

---

### I2
## No keyboard path to any interaction

**Severity:** Medium · **Effort:** M · **Type:** Accessibility · **Confidence:** Verified (analysis)

**Where:** `LapAnalysis.tsx:524-533`, `LapTimes.tsx:66-79`, `InstrumentCluster.tsx:48-53`,
`TrackMap.tsx:2063-2091`

**Observed**

| Control | Element | Activation |
|---|---|---|
| Lap chips (analysis) | `<span>` | `onMouseEnter` / `onPointerUp` |
| Session lap rows | `<li>` | `onMouseEnter` / `onMouseLeave` |
| Lap analysis panel | `<div>` | `onPointerEnter` / `onPointerUp` |
| Tyre overlay | `<section>` | `onPointerUp` |
| Follow-cam | `<button>` | `onMouseEnter` dwell / `onPointerUp` |

Only the follow-cam control is a `<button>`. It is the sole focusable interactive
element in the application, and in the live (non-demo) build it activates on
**hover dwell**, not on click or key — so even it has no keyboard activation path.

**Why this is objectively an improvement**

`lib/interaction.ts` already establishes exactly the right architectural pattern:
`CLICK_MODE` is derived from the build (`IS_DEMO`), and `isImmediateActivation`
branches per-event rather than per-device. **Keyboard is a third modality that
slots into the existing abstraction** — it does not require rethinking anything.

And the constraint that motivates hover-only does not apply to keyboard in the same
way: the concern is *browser window focus stealing controller input*. A user
navigating by keyboard has already focused the browser deliberately. On the demo
build (`CLICK_MODE === true`) there is no constraint at all — that build is a public
portfolio piece and is currently keyboard-inoperable for no reason.

**Proposed change**

Staged, lowest-risk first:

1. **Demo build only:** make chips and rows real `<button>` elements with keyboard
   activation. Zero risk to the live path, immediate benefit to the public artifact.
2. **Live build:** add `tabIndex`, `role`, and `onKeyDown` (Enter/Space) alongside
   the existing hover handlers. Hover behaviour unchanged; keyboard becomes an
   additional path.
3. Add a `focus-visible` treatment using the existing `--color-accent` token.
4. Extend `isImmediateActivation` (or add `isKeyboardActivation`) so the branching
   stays centralized rather than spreading per-component.

**Acceptance criteria**

- Every interactive control SHALL be reachable by keyboard and activatable with
  Enter or Space.
- Focus SHALL be visibly indicated using existing design tokens.
- Existing hover and touch behaviour SHALL be unchanged in both builds.
- Keyboard activation SHALL NOT be gated behind `CLICK_MODE`.
- Tab order SHALL follow visual reading order.

**Affected capability:** `touch-interaction` (rename or extend to
`input-modalities`), `racer-dashboard`, new `accessibility`.

---

### I3
## No `prefers-reduced-motion` handling

**Severity:** Low · **Effort:** S · **Type:** Accessibility · **Confidence:** Standard practice (not source-verified in this pass)

**Where:** `TrackMap.tsx:1290-1446` (follow camera), `1734-1737` (view easing),
`AnalogGauge.tsx` (`transition: transform 100ms`, `animate-pulse`),
`InstrumentCluster.tsx:81` (`animate-pulse`), `App.tsx:25` (`animate-spin`)

**Observed**

Several sustained animations with no reduced-motion query anywhere in
`web/src/index.css` or any component: the follow camera glides and continuously
tracks, the fallback viewport eases, the rev-limiter pulses, the loading spinner
spins.

**Why this is objectively an improvement**

A continuously panning, zooming map is among the motion patterns most likely to
affect users with vestibular sensitivity, and the follow camera is *sustained*
rather than transient. Honouring the OS-level preference is the standard mechanism.

**Stated honestly:** unlike every other item above, I did not verify this one
against a primary source in this research pass. The mechanism
(`@media (prefers-reduced-motion: reduce)`) and the general guidance are
well-established, but **confirm current WCAG guidance and browser support before
proposing**, and treat the specific remedies below as a starting point rather than
a specification.

**Proposed change (draft)**

- Under `prefers-reduced-motion: reduce`, make the follow camera snap rather than
  glide (`FOLLOW_TAU_S → 0`) and the fallback view snap rather than ease
  (`VIEW_EASE → 1`).
- Replace `animate-pulse` on the rev limiter with a static high-contrast state.
- Replace `animate-spin` with a static indicator.
- Keep the needle transition — 100 ms is transient and arguably below the threshold
  of concern; verify this.

**Acceptance criteria (draft)**

- WHEN the user has requested reduced motion, THEN the follow camera SHALL track
  without a sustained glide animation.
- WHEN reduced motion is requested, THEN looping animations SHALL be replaced by
  static equivalents that convey the same state.
- All information conveyed by motion SHALL remain available without it.

**Affected capability:** `track-map-follow-cam`, new `accessibility`.

---

## Bundle: PERSISTENCE

### J1
## No persistence — a page reload destroys the session

**Severity:** Medium (product) · **Effort:** L · **Type:** Feature / Architecture · **Confidence:** Verified

**Where:** `useLapHistory.ts`, `useLapRecordings.ts`, `TrackMap.tsx` — all state in
refs and component state

**Observed**

No `localStorage`, `IndexedDB`, `sessionStorage`, or export path anywhere in
`web/src`. Every lap time, driving line, sector table, and cut marker exists only
in memory. `useLapHistory.ts:36-38` documents the consequence: *"only laps driven
while the app is open exist."*

A browser refresh, a tab crash, an OS update, or closing the tab to check something
destroys an entire session's data irrecoverably.

**Why this is objectively an improvement**

This is the largest gap between what the application does and what it is *for*.
The product's purpose — stated in `README.md` — is improving lap times. The
canonical questions a driver asks are "am I faster than yesterday?" and "what did I
do differently on my best lap last week?" Neither is answerable, and no groundwork
exists for them: there is no session id, no serialization format, no schema.

Everything else needed is already present. `useLapRecordings` captures exactly the
right data at exactly the right rate. `lapAnalysis.ts` already computes sectors,
references, and theoretical bests over arbitrary recording sets — it takes
`readonly LapRecording[]`, with no assumption that they came from the live session.
**The analysis layer is already session-agnostic.** Only storage is missing.

**Proposed change**

Deliberately staged; each stage is independently valuable and independently
shippable:

1. **Export / import** — a JSON download of the current session and a file picker
   to load one. Smallest, immediately useful, forces the serialization format to
   exist (reuse the [J2](#j2) envelope). No storage-quota questions.
2. **Auto-persist to IndexedDB** — keyed by track + car + date. `localStorage` is
   unsuitable: its ~5 MB quota is well below the ~20 MB a single session's
   recordings can reach (`useLapRecordings.ts:35`). This is a real constraint that
   must be checked before choosing a mechanism.
3. **Cross-session comparison** — a previous session's best lap as an additional
   reference in `LapAnalysis` and an extra ghost line on the map. This is where the
   user value actually lands.
4. **Retention policy** — bounded like every other buffer in this codebase, in the
   `MAX_SAMPLES` tradition.

**Acceptance criteria**

- A completed session SHALL be exportable to a single versioned file and
  re-importable into the analysis view.
- Sessions SHALL persist across page reloads without user action.
- Stored data SHALL be scoped by track and car so comparisons are meaningful.
- Storage SHALL be bounded by an explicit, documented retention policy.
- WHEN storage is unavailable or full, THEN the app SHALL degrade to today's
  in-memory behaviour with a non-blocking notice — matching the project's existing
  graceful-degradation convention.

**Affected capability:** new `session-persistence`; extends `lap-analysis`,
`lap-line-comparison`.

**Non-goal:** any server, account, or cloud sync. Local-first only.

---

## Bundle: MULTI-CAR

### J3
## `SUBSCRIBE_SPOT` defined but never used; single-car by construction

**Severity:** Low (scoping) · **Effort:** L · **Type:** Architecture · **Confidence:** Verified

**Where:** `bridge/src/parsers.ts:9`, `bridge/src/acClient.ts:29`

**Observed**

```ts
export const OperationId = {
  HANDSHAKE: 0,
  SUBSCRIBE_UPDATE: 1,
  SUBSCRIBE_SPOT: 2,   // ← defined, never referenced
  DISMISS: 3,
} as const;
```

`SUBSCRIBE_SPOT` is AC's protocol operation for lap/spot events including other
cars. `ACClient` only ever sends `SUBSCRIBE_UPDATE` (`acClient.ts:65`) and its
state type is `'handshaking' | 'subscribed'` — no representation for a second
subscription.

**Why this is objectively an improvement**

Not a defect — it is an honest scope boundary. It is listed so the boundary is
*recorded* rather than discovered later. Any future feature touching other cars —
opponent positions on the map, gaps, multiplayer — requires protocol work that does
not exist yet, and it is worth knowing that before such a feature is proposed.

**Proposed change**

No code change now. Instead:

1. Document in `CLAUDE.md` that the bridge is deliberately single-car and that
   `SUBSCRIBE_SPOT` is unimplemented.
2. Either remove the unused constant or annotate it as reserved-and-unimplemented,
   so a reader does not assume support exists.
3. If multi-car is ever wanted, treat it as its own OpenSpec proposal with
   [E2](#e2) as a hard prerequisite.

**Acceptance criteria**

- The single-car scope SHALL be stated explicitly in project documentation.
- `SUBSCRIBE_SPOT` SHALL be either removed or annotated as unimplemented.

**Affected capability:** `extended-telemetry` (documentation only).

---

### E2
## Bridge state is module-level mutable globals

**Severity:** Low (today) · **Effort:** M · **Type:** Architecture · **Confidence:** Verified

**Where:** `bridge/src/index.ts:19-22`

**Observed**

```ts
let session: SessionInfo | null = null;
let trackAssets: TrackAssets | null = null;
let latestFrame: TelemetryFrame | null = null;
let frameDirty = false;
```

Plus `nextDueAt` (line 116). All module scope, mutated from three different event
handlers and one interval.

**Why this is objectively an improvement**

For one game, one car, one process this is simple and correct, and simplicity is a
virtue — this item does **not** argue the current design is wrong for its scope.

It is listed because it is the concrete blocker for three otherwise-plausible
directions, and knowing that in advance is worth the entry:

- Multiple AC instances / multiple `AC_HOST` targets ([J3](#j3))
- Integration-testing the bridge — the module cannot be instantiated twice in one
  process, so any test importing it inherits global state from the previous test
- Running bridge logic inside another host process

**Proposed change**

Not now. When a driver for it appears, encapsulate into a `TelemetrySession` class
owning `session`, `trackAssets`, `latestFrame`, `frameDirty`, and the flush
accumulator, with `index.ts` reduced to wiring. **Do not do this speculatively** —
it adds indirection with no present payoff, which would be a genuine regression in
readability for this codebase's standards.

**Acceptance criteria (when triggered)**

- Bridge session state SHALL be instantiable more than once per process.
- Two instances SHALL NOT share telemetry, session, or asset state.
- Startup and shutdown SHALL be symmetric with no leaked timers or handles.

**Affected capability:** new `bridge-resilience`.

---

# Suggested sequencing

Each row is one OpenSpec change proposal.

| Order | Change | Items | Why here |
|---|---|---|---|
| 1 | `bridge-error-handling` | A1, A2, A3, A4 | Availability. Four one-liners, one verify pass. |
| 2 | `bridge-connection-config` | G1, B2, B3 | Fixes documented-but-false config; same files. |
| 3 | `test-foundation` | C1, C7 | Unblocks everything below. |
| 4 | `test-pure-modules` | C2, C3, C4, C5 | Highest value per hour in the repo. |
| 5 | `cleanup-dead-code` | E3, H4, H5 | Trivial; do while tests are fresh. |
| 6 | `shared-protocol-package` | D4 | Touches every import — isolate it. |
| 7 | `lap-state-consolidation` | D1, D2, C6 | Extraction + tests together. |
| 8 | `lap-delta-unification` | D3 | Depends on 7. Changes visible values — call out. |
| 9 | `exhaustive-deps` | C8 | Do after 7 so fewer warnings to triage. |
| 10 | `bridge-hardening` | B1, A5 | Needs the parser tests from 4. |
| 11 | `trackmap-decomposition` | E1, D5 | Six ordered slices. Largest change here. |
| 12 | `react-purity` | F1, F2 | Easier once 11 has reduced surface area. |
| 13 | `map-hit-test-index` | H2 | Natural follow-on to 11. |
| 14 | `demo-payload-format` | J2, H1 | Version first, then compress. |
| 15 | `accessibility-foundation` | I1, I2, I3 | I3 needs its own research pass first. |
| 16 | `session-persistence` | J1 | Largest product gain; wants 6 and 7 done. |
| — | `scope-documentation` | J3, E2 | Documentation only; fold into any change above. |

---

# References

All external claims in this document trace to these sources.

- Node.js — [`events`: error events](https://nodejs.org/api/events.html#error-events) — unhandled `'error'` throws and exits the process. *(A1–A4)*
- Node.js — [`net.Server.listen`](https://nodejs.org/api/net.html#serverlistenoptions-callback) — default binding to `::` / `0.0.0.0`. *(B2)*
- ws — [API documentation](https://github.com/websockets/ws/blob/master/doc/ws.md) — `WebSocket` and `WebSocketServer` both extend `EventEmitter`; `bufferedAmount` definition. *(A1, A2, A5)*
- React — [`useRef`](https://react.dev/reference/react/useRef) — "Do not write **or read** `ref.current` during rendering." *(F1)*
- React — [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) — external-store subscription and tearing prevention. *(F1)*
- React — [`Component`](https://react.dev/reference/react/Component) — no function-component error boundaries; `react-error-boundary` named as the alternative. *(F2)*
- oxc — [`react/exhaustive-deps`](https://oxc.rs/docs/guide/usage/linter/rules/react/exhaustive-deps) — correctness category, not on by default, exact config shape. *(C8)*
- oxc issues [#18328](https://github.com/oxc-project/oxc/issues/18328), [#17765](https://github.com/oxc-project/oxc/issues/17765), [#20664](https://github.com/oxc-project/oxc/issues/20664) — known divergences from `eslint-plugin-react-hooks`. *(C8 caveat)*
- Vitest — [Why Vitest](https://vitest.dev/guide/why) — shares `vite.config.js`, Jest-compatible API. *(C1)*
- MDN — [Canvas basic usage](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Basic_usage) — canvas must provide fallback content; sub-DOM for assistive technology. *(I1)*
- Vercel — [CDN Compression](https://vercel.com/docs/how-vercel-cdn-works/compression) — `application/json` is auto-compressed; Brotli preferred. *(H1 — this corrected an overstatement in the earlier assessment)*
- Node path-traversal prevention guidance — [nodejsdesignpatterns.com](https://nodejsdesignpatterns.com/blog/nodejs-path-traversal-security/), [StackHawk](https://www.stackhawk.com/blog/node-js-path-traversal-guide-examples-and-prevention/) — `path.join`/`normalize` are not security controls; resolve-and-verify-prefix with `path.sep`; prefer ID lookup. *(B1)*
- WebSocket backpressure practice — [Medium: Node.js + WebSockets Backpressure](https://medium.com/@hadiyolworld007/node-js-websockets-backpressure-flow-control-patterns-for-stable-real-time-apps-27ab522a9e69), [DEV: UDP-like telemetry over WebSockets](https://dev.to/rpi1337/building-udp-like-telemetry-with-auto-remediation-over-websockets-57h1) — check `bufferedAmount`, drop rather than queue for telemetry. *(A5)*
- Monorepo shared-types practice — [Nx: Managing TypeScript packages in monorepos](https://nx.dev/blog/managing-ts-packages-in-monorepos), [ts-npm-monorepo](https://github.com/RandomEngy/ts-npm-monorepo) — a shared package as single source of truth for cross-boundary contracts. *(D4)*

---

## What this document deliberately does not recommend

Stated so future readers do not re-open settled questions:

- **Rendering `map.png` on the track map.** Already specified and justified —
  AC strokes it at constant width around the AI line and misrepresents track limits.
- **Replacing the ref-first data flow with state.** It is a correct and effective
  performance architecture. [F1](#f1) narrows only render-phase reads.
- **Removing the hover-only interaction model in live builds.** It is a real
  product constraint. [I2](#i2) adds keyboard as an additional path, not a
  replacement.
- **Adding a state-management library.** There is no state-management problem here.
- **Compiling the bridge to JavaScript.** Running under `tsx` with `tsc --noEmit`
  as the build is a deliberate, documented, and reasonable choice.
- **Speculatively refactoring the bridge for multi-car** ([E2](#e2)) — indirection
  without a payoff would reduce readability against this codebase's standards.

---

*Generated with Claude Code. Every measurement reproducible against commit `989cec5`.*
