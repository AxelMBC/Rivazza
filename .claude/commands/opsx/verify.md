---
name: 'OPSX: Verify'
description: Gate a change on typecheck, lint, formatting and valid spec deltas before sync/archive
category: Workflow
tags: [workflow, quality-gate]
---

Confirm that the implementation for a change is actually correct before its specs are merged.

This step sits **after `/opsx:apply` and before `/opsx:sync` / `/opsx:archive`**. Once a change is
archived its deltas are folded into `openspec/specs/` and the change directory moves away — verify
is the last cheap place to catch a break.

**This repo has no test framework.** The automated gate is four read-only checks; everything that
needs frames arriving and a canvas repainting is manual, and Step 7 is where that gets named rather
than quietly skipped. See `.claude/rules/verification.md`.

---

## The commands come from config, not from this file

**Read `.claude/workflow.yaml`'s `checks` block before Step 2 and run what it resolves to.** The
literals below are this repo's current values, shown so the file stays readable — they are the
**fallback**, used only when the file or the block is missing. In that case name the fallback you
used; don't stop, and don't send the user to a bootstrap command that doesn't exist here.

| Step | What runs | Config key | Fallback literal |
| --- | --- | --- | --- |
| 2 | bridge typecheck | `checks.typecheck_bridge_command` | `npm run build -w bridge` |
| 3 | web typecheck | `checks.typecheck_web_command` | `npx tsc -b web --noEmit` |
| 4 | lint | `checks.lint_command` | `npm run lint -w web` |
| 5 | formatting | `checks.format_check_command` | `npm run format:check` |
| 6 | spec-delta validation | `checks.validate_change_command` (`{change}` → change name) | `openspec validate "<change>" --type change` |

**Print the resolved commands once before Step 2.** A mis-pointed config should be visible here
rather than three steps later as a confusing failure.

Only the command _strings_ live in the config. Everything else in this file — why the bridge is
checked first, why `npm run build -w web` is not the web check, what each failure usually means — is
judgement that belongs in the command.

---

**Input**: Optionally a change name after `/opsx:verify` (e.g. `/opsx:verify split-track-map`). If
omitted, resolve the active change from `openspec list`.

---

## Step 1 — Resolve the change

```bash
openspec list --json
```

**Use `list`, not `status`, to find the change.** Bare `openspec status --json` cannot do this job —
it behaves backwards from what you'd expect:

- with **no** active change it _succeeds_ (exit 0), returning
  `{"changes": [], "message": "No active changes."}`
- with **one or more** active changes it _fails_ (exit 1) with `Missing required option --change`

So it errors in exactly the case you care about. `openspec list --json` works in both.

- **Empty array** → nothing to verify. Say so, and offer to run Steps 2–5 standalone against the
  working tree; the change-scoped steps simply don't apply.
- **One entry** → use it. Announce `Verifying change: <name>` and how to override.
- **Several** → ask with the **AskUserQuestion tool**. Never auto-pick.

Then resolve the details:

```bash
openspec status --change "<name>" --json
```

This form _does_ exit 1 on an unknown name, so a nonzero exit here is a genuine "no such change".
Keep two fields: `changeRoot` (Step 8 writes the receipt there, Step 7 reads `tasks.md` from it) and
`artifactPaths.specs.existingOutputPaths` (Step 6 needs it). Note the change's name comes back as
`changeName`, not `name`.

---

## Step 2 — Typecheck the bridge (and stop here if it's red)

Run **`checks.typecheck_bridge_command`**:

```bash
npm run build -w bridge   # fallback if the `checks` block is missing
```

**This runs first because it is the only thing that ever type-checks `bridge/src/`.** The bridge is
executed by `tsx` and never compiled to JS, so its "build" script _is_ `tsc --noEmit` — there is no
other artifact whose production would catch a type error there. For a change that only touches the
bridge, this step is most of the automated gate.

**If it fails, stop. Do not run the remaining checks.** Types are the cheaper signal and a type
error usually explains whatever the later steps would have reported.

---

## Step 3 — Typecheck the web app

Run **`checks.typecheck_web_command`**:

```bash
npx tsc -b web --noEmit   # fallback if the `checks` block is missing
```

**Not `npm run build -w web`.** That is `tsc -b && vite build`, and the vite half writes `web/dist/`
— a gate that modifies the tree cannot attest to the tree it measured (see **Guardrails**).
`tsc -b <dir> --noEmit` gives identical type coverage and touches nothing. The flag combination
needs a recent tsc; this repo is on TypeScript 6.0.3.

**Run it exactly as written.** Two plausible-looking variants are both wrong, and one of them fails
silently:

| Variant | What happens |
| --- | --- |
| `npm --prefix web exec -- tsc -b --noEmit` | Resolves packages from `web/` but leaves cwd at the repo root, so tsc looks for `./tsconfig.json` and dies with `TS5083`. Loud, at least. |
| `npm exec -w web -- tsc -b --noEmit` | Runs in the right place and **prints** the errors — then **exits 0**. npm swallows tsc's exit code, so a red typecheck reads as green and the receipt gets written anyway. |

Verified by injecting a type error: only `npx tsc -b web --noEmit` exits non-zero (2). If you ever
change this command, re-run that test before trusting it — an exit code is not something to assume.

Stop on failure, same reasoning as Step 2.

---

## Step 4 — Lint

Run **`checks.lint_command`**:

```bash
npm run lint -w web   # fallback if the `checks` block is missing
```

oxlint, the repo's only linter, and it has **no `--fix`** — safe inside a read-only gate, unlike the
eslint/prettier `--write` scripts other repos ban here. The bridge has no linter at all, so a
bridge-only change gets no signal from this step; say so rather than implying coverage.

---

## Step 5 — Formatting

Run **`checks.format_check_command`**:

```bash
npm run format:check   # fallback if the `checks` block is missing
```

`prettier --check`, never `--write`. A failure here is a real finding, not noise: Prettier owns
import order through `@ianvs/prettier-plugin-sort-imports`, so a red check usually means the change
hand-sorted imports or a file was written outside the formatter. The fix is `npm run format` — which
the user or `/opsx:apply` runs, **not this command**.

---

## Step 6 — Validate the spec deltas

First check `artifactPaths.specs.existingOutputPaths` from Step 1.

**If it's empty, skip this step** — the change has no spec deltas, so there's nothing for
`/opsx:sync` to merge. Say that plainly and move on. Do **not** run the validator on it: it reports
`Change must have at least one delta` and exits 1, which reads as a failure when it's really just a
change that doesn't touch any capability.

**If there are deltas**, run **`checks.validate_change_command`** with `{change}` substituted:

```bash
openspec validate "<change>" --type change
```

Read-only, instant, and exits 1 on a malformed delta. `/opsx:sync` is about to merge these into
`openspec/specs/`, so a delta missing its `## ADDED/MODIFIED/REMOVED Requirements` headers or a
requirement with no `#### Scenario:` block should surface here, not halfway through a merge.

Treat a failure as a gate failure — but report it as its own category, not as a code failure. The
fix is in the change's `specs/` files.

---

## Step 7 — Surface what the automation can't check

### The manual half

Read `tasks.md` from `changeRoot` and collect the **unchecked `- [ ]` items**.

**These are not failures.** In this repo an unchecked box is normally something only a running app
can confirm, and it survives into the archive by design. `/opsx:archive` already counts checkboxes
and prompts about them; verify must not duplicate that gate or fail on it.

List them, plus anything else that fell on the manual side:

- Anything that needs frames arriving — the position dot, the driving-line gradient, follow-cam, the
  sector ribbon. Four green checks say nothing about whether the dot moves.
- Canvas repaint behaviour: `TrackMap`, `PedalTrace` and `GForceMeter` dirty-gate their rAF loops,
  and a broken gate is invisible to `tsc` — it shows up as a pegged CPU, not an error.
- Hover-only interaction (a click would steal focus from the game), touch parity, the `lg:` desktop
  breakpoint.
- Cut detection: Windows + same-PC only, silently off everywhere else.
- Demo-mode builds (`VITE_DEMO_MODE`), which take a different input path entirely.

The procedure for actually checking these is `.claude/skills/verify/SKILL.md` — mock on UDP 9996,
`npm run dev`, puppeteer-core against installed Edge, roughly four minutes end to end. Point at it;
don't restate it, and don't run it as part of the gate unless the user asks.

### Duplication scan — the check nothing else performs

Four green checks say nothing about whether this change added a second copy of something the repo
already had. Typecheck can't see it, oxlint can't see it, and once `/opsx:sync` runs it's in the
behaviour record too. So before writing the receipt, look at what the change actually introduced:

```bash
git diff --stat "origin/<git.default_base_branch>"...HEAD
git diff "origin/<git.default_base_branch>"...HEAD | grep "^+.*export \(const\|function\|type\|interface\)"
```

For each newly exported symbol and each new file, ask whether an equivalent already existed:

```bash
git grep -n "export \(const\|function\|type\|interface\) <Name>" -- bridge/src web/src
git grep -rin "<behaviour keyword>" -- bridge/src web/src
```

Two shapes are worth extra attention in this repo, because both are duplication that reads as
ordinary code:

- **A new hook that re-derives what a hook already exposes.** `useTelemetry`, `useLapHistory`,
  `useLapDelta` and `useInputHistory` all follow the same pattern (bookkeeping in an effect, result
  exposed as a ref); a fifth one recomputing lap state from `telemetry` is a duplicate even if it
  shares no code.
- **A restart-detection or projection snippet copied into a third file.** `CLAUDE.md` already flags
  that the lap-counter-runs-backwards signature is duplicated across `useLapHistory`, `useLapDelta`
  and `TrackMap`. A fourth copy is a finding.

**Report hits; never fail on them and never fix them.** Verify is read-only by construction, and
near-duplication is a judgement call that belongs to the user. List each one as
`<new symbol> — possible duplicate of <path>:<line>` so it's actionable in a single read.

Finding nothing is also a result worth stating. This is the only point in the pipeline where anyone
looks, so "scanned N new exports, no duplicates found" is information; silence is indistinguishable
from not having run it.

The point is that "verified" never quietly means "the part a type-checker could reach passed." A
green run with three open manual checks is a real and useful result — as long as the three are
named.

---

## Step 8 — Record the result (the receipt)

A green run must leave evidence behind. `/opsx:archive` needs to know whether this change was
verified, and without a receipt it can only ask "has verify run **this session**?" — which is
unanswerable after a compaction, in a new terminal, or when the change is picked up tomorrow. A
warning that cannot be evaluated degrades into either constant noise or permanent silence.

**On a fully green run** (all four checks passed, deltas valid _or_ legitimately skipped), collect:

```bash
git rev-parse HEAD
git status --porcelain
date -u +%Y-%m-%dT%H:%M:%SZ
```

and write `<changeRoot>/.verified.json`:

```json
{
  "verifiedAt": "<UTC ISO-8601>",
  "head": "<full sha>",
  "dirtyAtVerify": true,
  "typecheckBridge": "pass",
  "typecheckWeb": "pass",
  "lint": "pass",
  "format": "pass",
  "specDeltas": "valid",
  "openManualChecks": 3
}
```

- `specDeltas` is `"valid"`, or `"skipped — no deltas"` when Step 6 was skipped.
- `dirtyAtVerify` records whether `git status --porcelain` was non-empty. **It usually will be**:
  Claude does not commit in this repo, so the normal flow verifies uncommitted work. A receipt
  written against a dirty tree cannot be re-checked by sha afterwards, so consumers report it as
  weaker rather than treating it as equivalent.
- `openManualChecks` is the count from Step 7.
- **No active change** (Step 1 returned an empty array) → there is no `changeRoot`, so write nothing
  and say so. The checks still ran; they just have nowhere to be recorded.

**On a red run, delete any existing `.verified.json`.** A stale attestation is worse than none — it
would tell `/opsx:archive` the tree is verified when this run just proved otherwise.

The receipt travels with the change directory into `openspec/changes/archive/YYYY-MM-DD-<name>/`.

### The staleness rule — `/opsx:archive` applies this

Comparing the receipt's `head` to current `HEAD` naively would report "stale" on every run after the
archive commit. So compare _what_ changed, not _whether_ anything changed:

```bash
git diff --name-only <receipt.head>..HEAD
```

The paths an archive commit may legitimately touch are `openspec/` — this repo has no `archive`
block in `.claude/workflow.yaml` and so no post-archive writes elsewhere. Call that set the
**archive-only paths**; it is config, not a constant.

| Condition | Report as |
| --- | --- |
| No `.verified.json` | **never verified** |
| `head` == `HEAD` and tree clean | **verified at `<sha>`** |
| Changed paths all within the archive-only paths | **still valid** — that is the archive commit |
| Any changed path outside those | **stale — code changed since verify at `<sha>`** |
| `dirtyAtVerify: true` | **verified against uncommitted work at `<time>`** — sha re-check not possible |

Only the last two rows are worth interrupting the user over, and the last one is the common case
here.

---

## Step 9 — Report

**All green:**

```
VERIFY PASSED
─────────────────────────────────────────
  Change:      <name>
  Bridge:      ✓ tsc --noEmit
  Web:         ✓ tsc -b web --noEmit
  Lint:        ✓ oxlint
  Format:      ✓ prettier --check
  Spec deltas: ✓ valid
  Duplication: ✓ <N> new exports scanned, none duplicated

  Manual checks still open — not run by this command:
    □ <item>
    □ <item>
    (procedure: .claude/skills/verify/SKILL.md)

  Receipt:     .verified.json written at <sha short> (dirty tree)

Next: /opsx:sync, then /opsx:archive.
```

Omit the manual block entirely when there is nothing open. When the duplication scan found
candidates, replace that line with the list and keep the run **passed** — it is a finding, not a
failure:

```
  Duplication: ! <N> new exports scanned, <K> possible duplicates
                 <newSymbol> — possible duplicate of <path>:<line>
```

**Anything red:**

```
VERIFY FAILED
─────────────────────────────────────────
  Change:     <name>
  Failed at:  bridge typecheck | web typecheck | lint | format | spec deltas

FAILURES
─────────────────────────────────────────
  <file:line — message, trimmed to the relevant lines>

Any previous .verified.json has been deleted — this change is no longer attested.

Do NOT run /opsx:sync or /opsx:archive until this is green.
```

Diagnose each failure briefly. Start from this repo's usual suspects rather than generic advice:

| Symptom | First suspect |
| --- | --- |
| A field exists on one side of the wire and not the other | `bridge/src/types.ts` and `web/src/types.ts` are hand-mirrored and must be kept in sync. Fix both, not one. |
| `tsc -b` reports an error in a file the change never touched | Project references: a `web/tsconfig.*.json` project was rebuilt. Read the path in the error before assuming it's unrelated. |
| Telemetry values come out as garbage rather than a type error | Not a typecheck failure — a byte offset in `bridge/src/parsers.ts`. Offsets encode MSVC struct padding; only the manual half catches this. |
| `prettier --check` fails on a file with no visible change | Import order. Prettier owns it; never hand-sort. |
| oxlint clean but the bridge is broken | Expected — the bridge has no linter. Say so rather than implying it was checked. |

**Never auto-fix.** Report and diagnose; the edits belong to the user or to `/opsx:apply`. After a
fix, re-run from Step 2 — a change that fixes a lint error can break a type.

---

## Guardrails

- **Read-only with respect to everything it attests to.** Verify never touches source, specs or
  config — if it modified any of those, the attestation would describe a tree that no longer exists.
  The **one** exception is `<changeRoot>/.verified.json` (Step 8): metadata _about_ the run, not part
  of the tree under test. Nothing else may be written. This is why the web check is
  `tsc -b --noEmit` and not `npm run build -w web`.
- **Never `npm run format`, and never prettier with `--write`.** `format:check` is the gate;
  rewriting files mid-gate invalidates the receipt. Running `npm run format` afterwards is fine and
  is the user's or `/opsx:apply`'s job.
- **The receipt is the answer to "was this verified?"** Green writes `.verified.json`, red deletes
  it. Never leave a stale receipt behind, and never let `/opsx:archive` fall back to asking about
  "this session".
- **Cheapest signal first, and stop on red.** Bridge typecheck → web typecheck → lint → format.
- **Duplication is surfaced, never failed on** — it is a judgement call, and verify is read-only.
- **Unchecked boxes are surfaced, never failed on** — they're manual app checks, and `/opsx:archive`
  already prompts.
- **Never claim the manual half was done.** Four green checks are four green checks. If the user
  wants the app driven, that is `.claude/skills/verify/SKILL.md`, run deliberately.
- **No auto-fix**, and never proceed to `/opsx:sync` or `/opsx:archive` on a red run.
- **Never commit.** `.claude/guard-workflow.ps1` blocks it; the user owns the commit boundary.
