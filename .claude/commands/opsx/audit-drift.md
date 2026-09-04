---
name: 'OPSX: Audit drift'
description: Find spec claims that no longer hold — dead symbols, dead paths, a broken type mirror
category: Workflow
tags: [workflow, specs, maintenance]
---

Find claims made in `openspec/specs/` that the code no longer supports.

`openspec/specs/` is the thing every agent in this repo trusts most, and nothing checks it. `tsc`
can't see it, oxlint can't see it, and `/opsx:verify` only validates delta _shape_ — never whether a
spec still describes the code. This command closes three narrow, mechanical parts of that hole.

**Scope is deliberately narrow.** Read **What this does not catch** before relying on a clean run.
It is a claim-resolution checker, not a spec-versus-code checker. A clean run means "no spec names
something that vanished, and the wire contract is still mirrored" — nothing more.

**Read-only. It finds and ranks; it never edits a spec and never edits code.** Repairs go through
`/opsx:tweak`, one capability at a time, so each one lands as a reviewed delta rather than a silent
rewrite. See **Guardrails**.

---

**Input**: optionally a capability name after `/opsx:audit-drift` (e.g.
`/opsx:audit-drift cut-detection`) to scope detectors 1 and 2 to one spec. If omitted, sweep all of
`openspec/specs/`. Detector 3 is repo-wide either way.

---

## Why this repo needs a different detector than a path checker

The obvious sweep — every file path a spec cites, checked against `git ls-files` — finds nothing
here. **Measured: the specs cite 3 file paths in total, and all 3 resolve.** Rivazza's specs are
written in terms of _symbols and protocol vocabulary_, not locations: `lapCount`, `bestLapMs`,
`normalizedPos`, `TelemetryFrame`, `map.ini`, `VITE_DEMO_MODE`. That is where the drift is, so that
is what detector 1 checks. Keep the path detector anyway — it is three lines and it costs nothing —
but do not expect it to be the one that fires.

---

## Step 1 — Run the three detectors

### Detector 1 — backticked symbols that no longer resolve

```bash
grep -ohE '`[A-Za-z][A-Za-z0-9_]{3,}`' openspec/specs/*/spec.md | tr -d '`' | sort -u > /tmp/syms.txt
: > /tmp/symmiss.txt
while IFS= read -r s; do
  git grep -qw -- "$s" bridge/src web/src 2>/dev/null || echo "$s" >> /tmp/symmiss.txt
done < /tmp/syms.txt
echo "symbols: $(wc -l < /tmp/syms.txt) | unresolved: $(wc -l < /tmp/symmiss.txt)"
```

Baseline on 2026-09-03, after this command's first repair landed: **52 symbols, 1 unresolved** —
and that one is `numberOfTyresOut`, which Step 2 classifies as external vocabulary and discards. So
**a correct run today reports zero findings.** A number far from 52 means either the specs grew a
lot or the extraction broke; check the sample before trusting the run.

The pre-repair baseline was 53 / 2, the extra one being `isAbsInAction` — kept here because the
worked example below is that finding, and because a detector with no recorded true positive is
indistinguishable from a detector that never fires.

`git grep -w` (whole word) is deliberate: without it, `cut` matches `cutsRef`, `absInAction` matches
`isAbsInAction`, and the detector reports nothing forever.

### Detector 2 — file paths that no longer resolve

```bash
grep -ohE '`[A-Za-z0-9_@/.-]+\.(ts|tsx)`' openspec/specs/*/spec.md | tr -d '`' | sort -u > /tmp/claimed.txt
git ls-files > /tmp/tracked.txt
: > /tmp/missing.txt
while IFS= read -r c; do
  grep -qF "/$c" /tmp/tracked.txt || grep -qxF "$c" /tmp/tracked.txt || echo "$c" >> /tmp/missing.txt
done < /tmp/claimed.txt
echo "paths: $(wc -l < /tmp/claimed.txt) | unresolved: $(wc -l < /tmp/missing.txt)"
```

Suffix matching is deliberate: specs cite `types.ts` and `web/src/types.ts` interchangeably.

### Detector 3 — the wire-contract mirror

`CLAUDE.md` states that `bridge/src/types.ts` and `web/src/types.ts` are **hand-mirrored and must be
kept in sync**, and nothing enforces it. A field added to one side and forgotten on the other is a
runtime hole that `tsc` cannot see: each side compiles perfectly against its own copy.

```bash
diff <(grep -vE '^\s*//' bridge/src/types.ts) <(grep -vE '^\s*//' web/src/types.ts)
```

**The diff is not expected to be empty, and an empty-diff check would be wrong.** Each side
legitimately owns types the other must not have:

| Type | Lives in | Why |
| --- | --- | --- |
| `SessionInfo`, `TelemetryFrame`, `CutEvent`, `BridgeMessage`, `MapMeta`, `TrackEdges` | **both** | the wire contract — these must match field for field |
| `HandshakerResponse` | bridge only | AC's UDP handshake struct; never crosses the WebSocket |
| `ConnectionStatus` | web only | UI state for the reconnect indicator; the bridge has no such concept |

So the check is: **the six shared types must match field for field; anything else in the diff is
side-specific and correct.** A new type appearing on one side is a finding only if a
`BridgeMessage` variant references it. Report a shared-type mismatch as a **contradiction** — the
worst bucket, because both files typecheck while the app is broken.

---

## Step 2 — Classify (this is the whole value)

**A raw candidate list is not a result.** The unresolved names carry at least four different
meanings, and reporting them undifferentiated produces noise nobody reads — which is worse than not
running the sweep, because it looks like coverage. In the pre-repair baseline, **1 of the 2
unresolved symbols was not drift at all** — and after the repair, the *only* remaining candidate is
that one. A run that reports it is a run that has stopped being useful.

Read the surrounding line for every candidate:

```bash
grep -rn --include=spec.md -F "<candidate>" openspec/specs
```

Then sort it into exactly one bucket:

| Bucket | How to recognise it | Verdict |
| --- | --- | --- |
| **External vocabulary** | Names something the repo does not own: a field in AC's shared-memory or UDP structs, a game file format, a build-time env var. `numberOfTyresOut`, `packetId`, `map.ini`, `ui_car.json`, `fast_lane.ai`, `libraryfolders.vdf`, `acpmf_physics`, `VITE_DEMO_MODE` | **Not drift.** The spec is quoting the game's vocabulary, which is correct even when the code names its own reader differently. Discard silently. |
| **Inverted assertion** | The spec asserts the thing is _gone_: "no longer", "SHALL NOT", "deliberately never". | **Not drift.** Absence is the spec being satisfied. Discard silently. |
| **Dead symbol or dead path** | A positive claim naming something the repo used to have. | **Drift.** Record what the code calls it now. |
| **Contradiction** | Two specs make incompatible claims, or a spec contradicts the code _and_ another spec. A shared-type mismatch from detector 3 lands here. | **Drift, worst kind.** Rank first — an agent reading either side is misled, and they cannot both be repaired the same way. |

**The external-vocabulary bucket is the one that makes this command usable here**, and it is the
bucket a generic path-checker doesn't have. `numberOfTyresOut` is the canonical case: the spec names
it because that is what AC calls the field, while the code reads it as `OFF_TYRES_OUT` /`tyresOut`.
Reporting that as drift would train the reader to ignore the report.

**Verify an inverted assertion before discarding it.** "X no longer exists" is only satisfied while
X really is gone; if it came back, the sentence is false and the candidate never appears in Step 1
at all. Check the claim, don't just recognise its shape.

### Worked example — the run this command was built from

```
DEAD SYMBOL    isAbsInAction          [repaired 2026-09-03 via /opsx:tweak correct-abs-flag-name]
  extended-telemetry/spec.md:17   "a non-zero byte at a flag offset (e.g. `isAbsInAction`)"
  code                            absInAction  (parsers.ts:62, types.ts:28, InstrumentCluster.tsx:99)
  → a contradiction inside one spec: the requirement three lines above enumerated `absInAction`,
    and the scenario used an `is`-prefixed name that appears nowhere in bridge/src or web/src

NOT DRIFT      numberOfTyresOut
  cut-detection/spec.md:10        "reading … `numberOfTyresOut` (offset 244, int32)"
  code                            OFF_TYRES_OUT / tyresOut  (sharedMemory.ts:11,137)
  → external vocabulary: that IS the field's name in AC's physics page
```

---

## Step 3 — Report

Group by capability, contradictions first, then dead symbols and paths. Discard the two "not drift"
buckets entirely — do not list what isn't drift.

```
## Spec drift: <N> findings across <M> capabilities

### <capability>
- CONTRADICTION  <what> — spec says <X>, code says <Y>
- DEAD SYMBOL    <what> — spec cites <old>, code has <new>
- DEAD PATH      <what> — spec cites <old>, code has <new>

Wire mirror: shared types match | <type>.<field> present in <side> only

Scanned: <A> symbols, <B> paths (<C> unresolved, <D> external vocabulary, <E> inverted assertions
discarded).
Not covered by this scan: numeric constants, byte offsets, enumerated sets, threshold values,
ordering claims, and every prose statement about behaviour.

Repair one capability at a time:  /opsx:tweak <describe the correction>
```

**Always print the "not covered" line.** A reader who sees only a finding count will read a clean
run as "the specs are accurate", which this command cannot support.

**Prefer the criterion over the list when repairing.** A spec that enumerates a closed set will
drift again the next time the set grows, and nothing here will catch it. Where the delta can state
the _rule_ instead of the membership, say so in the finding.

---

## What this does not catch

The detectors resolve **names**. They say nothing about whether the claim attached to the name is
still true. Everything below is invisible to this command:

| Kind of drift | Why it's missed |
| --- | --- |
| A byte offset changed (`numberOfTyresOut` moves from 244 to 248) | The symbol still resolves; the number is not checked |
| A tuned constant changed (cut speed floor 10 → 15 km/h) | Same — prose, not a name |
| A field added to `TelemetryFrame` on **both** sides but never specced | Nothing to resolve; a missing claim leaves no trace |
| An enumerated set grew (a new `BridgeMessage` variant) | The old members still resolve |
| A behaviour claim inverted ("SHALL retry every ~3 s" → the code stopped retrying) | Pure prose |
| A spec that describes a capability deleted from the code entirely | Its symbols vanish, so detector 1 fires — but only if the spec names them |

Note the asymmetry that makes the headline number untrustworthy: **making a spec worse can lower the
unresolved count.** Renaming `isAbsInAction` to something that _does_ exist but means the wrong thing
would take the count from 2 to 1. **The count is not a health metric and must never be reported as
one.** Report findings, not the count.

A regex over enumerated sets and numeric constants was considered and rejected: matching
`` `<n>` `` against the code returns hundreds of coincidental hits (array indices, byte offsets,
Tailwind classes), trading one false negative for a hundred false positives. Checking those properly
means resolving each claim against the code that implements it, which is real work, not a pattern.
Until that exists, constants and offsets are reviewed by hand or not at all.

---

## Guardrails

- **Never edit a spec here.** This command reports. Repairs go through `/opsx:tweak`, so every
  correction lands as a reviewed delta with a scenario, and `/opsx:verify` gates it. A sweep that
  rewrites specs directly is indistinguishable from the drift it was built to catch.
- **Never fix the code to match the spec.** When a spec and the code disagree, which one is wrong is
  a judgement for the user. Report both sides and let them decide — especially for detector 3, where
  the right repair might be adding the field to the other side of the mirror rather than removing it.
- **Never claim coverage this command does not have.** A clean run is "no spec names something that
  vanished", never "the specs match the code".
- **The external-vocabulary bucket is not optional.** Skipping it turns a two-finding report into a
  report nobody reads.
- **One capability per repair.** Batching six corrections into one delta makes the review worthless,
  which is how the drift got in.
- **Never commit.** `.claude/guard-workflow.ps1` blocks it; the user owns the commit boundary.
