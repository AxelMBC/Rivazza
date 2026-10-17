# Review: protocol-version-handshake

Snapshot: edf5ba3954356af14cec17e39feddd6bd3e25af7

1. [defect] web/src/App.tsx:142 (screen at :28) — a mismatched demo recording renders `DemoUnavailableScreen`, whose "Reload the page to try again" can never help, against the demo-replay spec ("no instruction the viewer cannot act on") · fixed
   Fix: for `status === "mismatch"`, render the screen without the reload sentence (e.g. a `reason` prop); version details stay console-only.
2. [rule] web/src/lib/protocolCheck.ts:3 — `ProtocolCheck = { ok: boolean; received: unknown }` is loose fields rather than a discriminated result, and `received` repeats `status.protocol` the caller already holds · fixed
   Fix: `{ ok: true } | { ok: false; received: unknown }`, or return a plain boolean and log `message.protocol` in `admit`; adjust the three tests.
3. [duplicate] web/src/lib/protocolCheck.test.ts:30-35 — reads and casts the committed recording exactly like web/src/hooks/useLapHistory.test.ts:314-318 · fixed
   Fix: one test-only helper (e.g. `loadDemoRecording()`) used by both, named so `tsconfig.test.json`'s `src/**/*.test.ts` include and the app tsconfig handle it.
4. [rule] CLAUDE.md:118 — still says "both sides `import type` from it" while the same paragraph adds a runtime value both sides import · fixed
   Fix: "both sides import from it (types via `import type`, plus the one value `PROTOCOL_VERSION`)".
