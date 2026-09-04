---
name: 'OPSX: Tweak'
description: Land a small change through a delta-only change — no proposal, no design
category: Workflow
tags: [workflow, artifacts, lightweight]
---

Land a small change that needs no new capability — widening a threshold, adding a telemetry field,
adjusting a gate — without the full `/opsx:propose` ceremony.

**This command is not "a change without a spec." It is "a change with only the spec."** The
expensive part of the full flow is `proposal.md` + `design.md`. The delta is cheap — about eight
lines — and it is the only thing standing between a small change and a behaviour record that quietly
stops being true.

Read `.claude/workflow.yaml`'s `git` block before Step 2 (branch conventions) and its `checks` block
in Step 4 (the fix loop). `/opsx:verify` owns the gate itself.

---

**Input**: a description of the small change after `/opsx:tweak` (e.g.
`/opsx:tweak raise the cut speed threshold to 15 km/h`). If omitted, ask with the
**AskUserQuestion tool** (open-ended) what the change is. Do not guess.

---

## Step 1 — Find the owner (this is the whole command)

**Everything downstream turns on one question: does a spec already describe the behaviour you are
about to change?** Do not answer it from judgement. Answer it by search, because the failure this
command exists to prevent is precisely the one that feels like it isn't happening.

Take the identifiers the change will touch — the field, the constant, the endpoint, the component,
the env var — and grep the behaviour record for each:

```bash
git grep -ril "<identifier>" -- openspec/specs
git grep -n  "<identifier>" -- openspec/specs | head -30
```

Grep **concepts as well as identifiers**. The same behaviour is often specified in prose that never
names the symbol: search `cut`, `follow`, `zoom`, `sector`, `invalid` — not only `numberOfTyresOut`.
This matters more here than in a typical repo: Rivazza's specs cite AC's vocabulary and wire-format
field names far more often than they cite file paths, so an identifier search that comes back empty
is weak evidence.

Then route on what you found. Print the routing decision before doing anything else.

| What you found | Route |
| --- | --- |
| **A capability owns the behaviour** | This is a tweak. Continue to Step 2. Name the spec and the requirement heading. |
| **Nothing in `openspec/specs/` describes it** | This is not an OpenSpec change at all — see **The 3b exit** below. Stop. |
| **It needs a capability that does not exist** | This is not a tweak. Stop and send the user to `/opsx:propose`. |
| **Two or more capabilities own parts of it** | Judgement call: it is still a tweak if each delta is a few lines, but say so and let the user confirm before proceeding. |
| **An active change already touches it** | Stop. Offer `/opsx:apply <name>` on that change instead of opening a second one against the same behaviour. |

**Worked example — the shape this command is for.** "Raise the speed floor below which a cut is
ignored" feels like a one-line constant edit. It is specified:

```
openspec/specs/cut-detection/spec.md:25
  ### Requirement: The bridge emits exactly one cut event per off-track excursion
    … the shared-memory speed is at or above a small threshold (~10 km/h) — so teleports,
    garage states, and frozen pages never produce events.
```

Changing the constant without a delta does not leave that spec incomplete — it leaves it **false**.
That is the whole reason this command writes a delta.

### The 3b exit

When nothing in `openspec/specs/` describes the behaviour — a colour, a margin, a log line, a
comment — there is no delta to write and no change to create. Say so and hand the work back:

```
No capability under openspec/specs/ describes this. Skipping OpenSpec entirely.
  1. branch per .claude/workflow.yaml git.*_prefix
  2. make the edit
  3. npm run build -w bridge && npx tsc -b web --noEmit && npm run lint -w web
  4. npm run format
```

Do not create an empty change to keep the ritual intact. `/opsx:verify` skips delta validation on a
change with no deltas, so a change created here with nothing in `specs/` produces a change directory
that exists only to be archived — cost with no record.

---

## Step 2 — Put the work on its own branch

Read `.claude/workflow.yaml`'s `git` block. If it is missing or `git.host` is unset, skip this step
with a one-line note.

```bash
git rev-parse --abbrev-ref HEAD
```

- **HEAD is not in `git.protected_branches`** → keep it. Print
  `Branch: <current> (not protected — staying put)`.
- **HEAD is in `git.protected_branches`** → create the change branch from the base. Prefix:
  `git.fix_prefix` when the tweak fixes a defect, `git.feature_prefix` otherwise.

```bash
git fetch origin
git switch --no-track -c "<prefix><name>" "origin/<git.default_base_branch>"
```

**`--no-track` is load-bearing, and it goes before `-c`.** The reasoning lives in
`.claude/rules/git-workflow.md` — read it there rather than re-deriving it, and never drop the flag.
The short version: branching _from_ `origin/<base>` without it makes the _base_ the new branch's
upstream, so a later bare `git push` (or VS Code's Sync button) fast-forwards the shared branch.
`-c` takes the next token as the branch name, so the flag cannot go after it.

If the switch fails on conflicting local edits, **stop and report it — never `stash`, never
`--force`, never `--discard-changes`.** The uncommitted work is the user's.

**Creating or switching a branch is the only git write this command makes.** Never `git add`,
`git commit` or `git push` — see **Guardrails**.

---

## Step 3 — Create the change, with only two files

Derive a kebab-case `<name>` from the tweak itself (`raise-cut-speed-floor`, not `tweak-1`).

```bash
openspec new change "<name>"
```

**This creates only `.openspec.yaml` — no stubs** (verified against openspec 1.4.1). Nothing has to
be deleted; the artifacts are whatever you write next. Write exactly two files:

**a) The delta** at `openspec/changes/<name>/specs/<capability>/spec.md`.

Use the capability Step 1 named. The requirement heading must match the one in the main spec
**character for character**, or `/opsx:sync` will add a second requirement instead of merging into
the existing one.

```markdown
## MODIFIED Requirements

### Requirement: <heading copied verbatim from the main spec>

<the changed sentence — restate only what changes; SHALL or MUST is required>

#### Scenario: <the new or corrected scenario>

- **WHEN** …
- **THEN** …
```

Three rules the validator enforces:

- The requirement body **must contain `SHALL` or `MUST` on the first line after the heading.** The
  validator reads only that line, so a hard-wrapped opening sentence that pushes `SHALL` onto line 2
  fails with `must contain SHALL or MUST` even though the word is plainly there. Leave the opening
  sentence unwrapped — the main specs do, which is why they pass.
- Every requirement needs at least one `#### Scenario:` block.
- The delta is **intent, not a wholesale replacement**. Under `MODIFIED` you restate only what
  changes; `/opsx:sync` preserves scenarios you did not mention. Do not paste the whole requirement
  back.

**Also fix the scenarios the change falsifies.** A changed threshold usually makes an existing
"below this, nothing happens" scenario wrong. Carrying that scenario forward unchanged is the drift
this command prevents — state the correction in the delta.

**b) A minimal `tasks.md`** at `openspec/changes/<name>/tasks.md`.

It is small but not optional: `/opsx:verify` Step 7 reads it to surface manual checks, and
`/opsx:archive` counts its checkboxes and reads the change's summary for the commit-message title. A
tweak with no `tasks.md` makes both of them read a file that isn't there.

```markdown
# <one-line summary of the tweak — archive uses this for the commit title>

## 1. Implementation

- [ ] <the code edit>

## 2. Verification

- [ ] Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec delta
- [ ] <what only a running app can confirm; omit the section if there is genuinely nothing>
```

There are no paired test tasks: this repo has no test framework. See
`.claude/rules/verification.md` before writing anything that assumes otherwise.

**Do not write `proposal.md` or `design.md`.** If you find yourself wanting either — because the
change needs a rationale recorded, or has a design decision worth arguing — that is the signal that
it was never a tweak. Stop and say so; `/opsx:propose` exists for that.

---

## Step 4 — Implement

Make the edit, following `.claude/rules/code-style.md` (arrow functions, comments only for
constraints outside the repo, Tailwind tokens).

Iterate with the individual commands from `.claude/workflow.yaml`'s `checks` block rather than
running the whole gate each time — the bridge typecheck alone is the fast loop for a bridge edit:

```bash
npm run build -w bridge
npx tsc -b web --noEmit
```

Run `npm run format` when you're done editing; Prettier owns import order and `/opsx:verify` checks
it. Tick the boxes in `tasks.md` as you go. A `- [ ]` that needs the app running stays unchecked, by
design.

---

## Step 5 — Hand off to the existing chain

Nothing further is bespoke. The tweak now looks like any other change to every downstream command:

```
/opsx:verify <name>    # typecheck + lint + format + delta validation, writes .verified.json
/opsx:sync   <name>    # merges the delta into openspec/specs/
/opsx:archive <name>   # moves the change to openspec/changes/archive/
```

Print those three lines as the final output, with `<name>` substituted, so the user can continue in
one keystroke. There is no `/opsx:pr` in this repo — the user opens the PR themselves after
committing.

---

**Output**

```
Owner:    openspec/specs/<capability>/spec.md → "<requirement heading>"
          (or: none — 3b exit, no OpenSpec change created)
Branch:   <prefix><name> from origin/<base> | <current> (unchanged) | not configured
Change:   openspec/changes/<name>/
Wrote:    specs/<capability>/spec.md  (## MODIFIED, N scenarios)
          tasks.md                    (N implementation, M verification)
Next:     /opsx:verify <name>
```

---

## Guardrails

- **The delta is not the optional part.** If Step 1 found an owner, the delta gets written. A tweak
  that skips it is indistinguishable from a manual edit and produces exactly the drift this repo
  already has: `extended-telemetry` cites a field the code does not define.
- **Escalate rather than stretch.** A new capability, a design argument, more than a couple of small
  deltas, or a requirement you cannot state in one sentence — all of those mean `/opsx:propose`.
  This command is deliberately narrow; widening it recreates `propose` badly.
- **Never commit.** `.claude/guard-workflow.ps1` blocks it, and the user owns the commit boundary —
  they commit after `/opsx:archive`. A `tasks.md` step that says "Commit: …" is satisfied by leaving
  the work in the tree.
- **Never create a worktree.** Same guard, RULE 2. Implementation happens in the main repo on the
  change branch.
- **Do not invent tests.** There is no runner here. Verification that needs the app running is a
  manual item in `tasks.md` plus `.claude/skills/verify/SKILL.md`.
