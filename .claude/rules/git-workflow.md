# Git conventions

No `paths:` — this loads every session, because any piece of work ends in a commit or a branch.
Keep it short: every line added here is paid for in context, always.

## Claude does not commit

`.claude/guard-workflow.ps1` (PreToolUse) blocks commit creation. The user owns the history and
commits at the end, after `/opsx:archive`. A "Commit: …" step in a `tasks.md` is satisfied by
leaving the work in the working tree. This file defines **how the suggested message is written** —
it does not authorise running it.

When the user wants the commit made now, they type it themselves: `! git commit -m "..."` runs in
the session, so the output still lands in the conversation.

## Commit format

```
<type>: <:emoji:> <subject in English>
```

No scope. Colon after the type, then the emoji **shortcode**, then the subject.

**The subject:**

- English, imperative or plain descriptive noun phrase, lowercase initial, no trailing period,
  ≤ 72 characters. ✅ `align the sector ribbon with the analysis traces`
- Describes the **observable effect**, not the file touched. ❌ `changes in TrackMap` ❌ `ico updated`

**Body** (optional, after a blank line): the *why*, when the subject doesn't carry it. Wrap at 100
columns. `BREAKING CHANGE: <description>` goes in the footer, and the subject takes `:boom:`.

## Three mistakes already in this history — don't repeat them

1. **A subject that names the artifact instead of the effect.** The log has
   `feat: :sparkles: ico updated` and `new laps for deployment`.
2. **Skipping the convention entirely.** The log has `record con Ferrari en Imola` — no type, no
   emoji, and in Spanish while the rest of the log is English.
3. **Deriving the convention by reading `git log`.** Because of 1 and 2, the log is not a reliable
   sample. The table below is the source of truth. This applies to `/opsx:archive` step 7, which
   suggests the commit title: the prevailing style is **this file**, not `git log --oneline -10`.

## Type → emoji

One default column. The alternatives are used only when the intent is more specific *and* still
consistent with the type.

| type | default | alternatives by intent |
| --- | --- | --- |
| `feat` | `:sparkles:` | `:necktie:` business logic · `:children_crossing:` usability · `:lipstick:` UI · `:loud_sound:` logs · `:triangular_flag_on_post:` feature flag · `:safety_vest:` validation · `:dizzy:` animations · `:boom:` breaking change |
| `fix` | `:bug:` | `:ambulance:` critical hotfix · `:adhesive_bandage:` trivial fix · `:lock:` security · `:rotating_light:` lint/compiler warnings · `:green_heart:` broken CI build · `:pencil2:` typos · `:goal_net:` error handling |
| `docs` | `:memo:` | `:bulb:` in-code comments · `:page_facing_up:` license |
| `style` | `:art:` | `:lipstick:` style files |
| `refactor` | `:recycle:` | `:fire:` remove code or files · `:coffin:` dead code · `:truck:` move or rename · `:building_construction:` architectural change · `:label:` types · `:mute:` remove logs · `:wastebasket:` deprecate |
| `perf` | `:zap:` | `:thread:` concurrency |
| `build` | `:package:` | `:arrow_up:` / `:arrow_down:` bump deps · `:heavy_plus_sign:` / `:heavy_minus_sign:` add/remove dep · `:pushpin:` pin a version · `:bookmark:` version tag |
| `ci` | `:construction_worker:` | `:green_heart:` fix the CI build · `:rocket:` deploy |
| `chore` | `:wrench:` | `:hammer:` dev scripts · `:see_no_evil:` `.gitignore` · `:technologist:` DX · `:card_file_box:` archive/records |
| `revert` | `:rewind:` | — |

Always the shortcode, never the raw glyph: `:wrench:`, not 🔧. Full list: https://gitmoji.dev — an
emoji not on that list is not used. There is no `test` type here; this repo has no test framework.

**Fixed case:** the `/opsx:archive` commit is always
`chore: :card_file_box: archive <change-id> and sync the specs`.

## Branches

**Create** — always from the remote, never from local HEAD:

```bash
git fetch origin
git switch --no-track -c <prefix><slug> origin/<base>
```

`--no-track` is load-bearing and goes **before** `-c` (`-c` takes the next token as the branch
name, so `git switch -c --no-track <slug>` would create a branch literally called `--no-track`).
Without the flag, branching *from* `origin/<base>` leaves the new branch tracking `origin/<base>` —
the base, not the branch — and a later bare `git push` (or VS Code's Sync button) fast-forwards the
shared branch, skipping review entirely.

Verify it took:

```bash
git rev-parse --abbrev-ref '@{u}' 2>/dev/null && echo "UPSTREAM SET — expected none" || echo "no upstream (correct)"
```

**`<base>` and `<prefix>` are read from `.claude/workflow.yaml`** (`git.default_base_branch`,
`git.branch_prefixes`, `git.feature_prefix`, `git.fix_prefix`). They are deliberately not repeated
here: two sources of truth for the base branch is worse than one.

**`<slug>`** — kebab-case, English, matching the change name so the requirement, the change
directory and the branch all carry the same slug: `feat/split-track-map`, `fix/cut-marker-dedupe`.

**Never work directly on** the branches in `git.protected_branches`. If HEAD is one of them, create
the branch first.
