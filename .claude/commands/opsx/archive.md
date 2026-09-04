---
name: "OPSX: Archive"
description: Archive a completed change in the experimental workflow
category: Workflow
tags: [workflow, archive, experimental]
---

Archive a completed change in the experimental workflow.

**Input**: Optionally specify a change name after `/opsx:archive` (e.g., `/opsx:archive add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show only active changes (not already archived).
   Include the schema used for each change if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - `artifacts`: List of artifacts with their status (`done` or other)

   If status reports `actionContext.mode: "workspace-planning"`, explain that workspace archive is not supported in this slice and STOP. Do not move workspace changes into repo-local archives or edit linked repos.

   **If any artifacts are not `done`:**
   - Display warning listing incomplete artifacts
   - Prompt user for confirmation to continue
   - Proceed if user confirms

3. **Check task completion status**

   Read the tasks file (typically `tasks.md`) to check for incomplete tasks.

   Count tasks marked with `- [ ]` (incomplete) vs `- [x]` (complete).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Prompt user for confirmation to continue
   - Proceed if user confirms

   **If no tasks file exists:** Proceed without task-related warning.

   **Then read the verification receipt** at `<changeRoot>/.verified.json`, written by
   `/opsx:verify`. **Do not ask whether verify ran "this session"** — that question is unanswerable
   after a compaction or in a new terminal, and a warning that cannot be evaluated degrades into
   either constant noise or permanent silence. The receipt is the answer.

   Apply the staleness rule — compare *what* changed since the receipt, not *whether* anything did:

   ```bash
   git diff --name-only <receipt.head>..HEAD
   ```

   The archive-only paths are `openspec/` (this repo has no `archive` block in
   `.claude/workflow.yaml`, so nothing else is written post-archive).

   | Condition | Report as | Action |
   | --- | --- | --- |
   | No `.verified.json` | **never verified** | Warn, and offer `/opsx:verify <name>` first via **AskUserQuestion**. Archiving anyway is allowed. |
   | `head` == `HEAD`, tree clean | **verified at `<sha>`** | Proceed silently. |
   | Changed paths all within `openspec/` | **still valid** | Proceed silently — that is the archive commit. |
   | Any changed path outside `openspec/` | **stale — code changed since verify** | Warn and confirm. |
   | `dirtyAtVerify: true` | **verified against uncommitted work at `<time>`** | Note it; do not block. This is the normal case here, since Claude never commits. |

   Archiving an unverified change is possible — it is the user's call — but it must be a stated
   choice, never a silent one.

4. **Assess delta spec sync state**

   Use `artifactPaths.specs.existingOutputPaths` from status JSON to check for delta specs. If none exist, proceed without sync prompt.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at `openspec/specs/<capability>/spec.md`
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Show a combined summary before prompting

   **Prompt options:**
   - If changes needed: "Sync now (recommended)", "Archive without syncing"
   - If already synced: "Archive now", "Sync anyway", "Cancel"

   If the user chooses sync, **perform it in this context by following `/opsx:sync`'s steps
   directly.** Never delegate it to a subagent, and never invoke an `openspec-sync-specs` skill —
   that skill was deleted because it was a stale fork of `/opsx:sync` and had already drifted from
   it. A merge into `openspec/specs/` is a judgement call over text you are already holding; handing
   it to a fresh agent throws that context away. Proceed to archive regardless of choice.

5. **Perform the archive**

   Create an `archive` directory under `planningHome.changesDir` if it doesn't exist:
   ```bash
   mkdir -p "<planningHome.changesDir>/archive"
   ```

   Generate target name using current date: `YYYY-MM-DD-<change-name>`

   **Check if target already exists:**
   - If yes: Fail with error, suggest renaming existing archive or using different date
   - If no: Move `changeRoot` to the archive directory

   ```bash
   mv "<changeRoot>" "<planningHome.changesDir>/archive/YYYY-MM-DD-<name>"
   ```

6. **Display summary**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
   - Spec sync status (synced / sync skipped / no delta specs)
   - Note about any warnings (incomplete artifacts/tasks)

7. **Always suggest a commit title, derived from the uncommitted changes**

   Base the title on what is actually uncommitted in the working tree — not on the proposal's stated intent. The two drift: work gets added or dropped mid-implementation, and the archive move itself is part of the commit.

   Inspect the working tree before writing the title:

   ```bash
   git status --short
   git diff --stat HEAD
   ```

   Read enough of the diff to name what actually changed rather than restating the proposal. Include the archive move and any spec sync in what the title covers.

   **The convention is `.claude/rules/git-workflow.md`, not `git log`.** Read the format and the
   type→emoji table there. Do **not** derive the style from the history: this log contains entries
   that predate the rule and do not follow it (`record con Ferrari en Imola`, `new laps for
   deployment`, `feat: :sparkles: ico updated`), so sampling it reproduces the mistakes.

   For an archive that only moves the change directory and syncs specs, the fixed form is:

   ```
   chore: :card_file_box: archive <change-id> and sync the specs
   ```

   When the commit also carries the implementation, title it after the implementation instead —
   `feat:` / `fix:` / `refactor:` per the table — and mention the archive in the body.

   Append the result to the summary output as a `**Suggested commit:**` line.

   **Edge cases:**
   - Working tree clean: say so instead of inventing a title.
   - The diff spans work unrelated to the archived change: suggest the title for the archived change's files and name the files that fall outside it, so the user can split the commit.

   **Never run `git commit` (or `git add`) yourself as part of this command** — the user
   copy-pastes the title themselves, or runs `! git commit -m "..."` in the prompt so the output
   still lands in the conversation. This applies even if the user has otherwise authorized commits
   elsewhere in the conversation, and `.claude/guard-workflow.ps1` enforces it at the tool layer.

**Output On Success**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs

All artifacts complete. All tasks complete.

**Suggested commit:** <one-line commit title>
```

**Output On Success (No Delta Specs)**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/YYYY-MM-DD-<name>/
**Specs:** No delta specs

All artifacts complete. All tasks complete.

**Suggested commit:** <one-line commit title>
```

**Output On Success With Warnings**

```
## Archive Complete (with warnings)

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/YYYY-MM-DD-<name>/
**Specs:** Sync skipped (user chose to skip)

**Warnings:**
- Archived with 2 incomplete artifacts
- Archived with 3 incomplete tasks
- Delta spec sync was skipped (user chose to skip)

Review the archive if this was not intentional.

**Suggested commit:** <one-line commit title>
```

**Output On Error (Archive Exists)**

```
## Archive Failed

**Change:** <change-name>
**Target:** the archive path derived from `planningHome.changesDir`/YYYY-MM-DD-<name>/

Target archive directory already exists.

**Options:**
1. Rename the existing archive
2. Delete the existing archive if it's a duplicate
3. Wait until a different date to archive
```

**Guardrails**
- Always prompt for change selection if not provided
- Use artifact graph (openspec status --json) for completion checking
- Don't block archive on warnings - just inform and confirm
- Preserve .openspec.yaml when moving to archive (it moves with the directory)
- Show clear summary of what happened
- If sync is requested, follow `/opsx:sync`'s steps in THIS context - never a subagent, never an `openspec-sync-specs` skill (it was deleted as a stale fork)
- If delta specs exist, always run the sync assessment and show the combined summary before prompting
- ALWAYS suggest a commit title after archiving, even on error/failure paths where nothing was archived — skip it only then
- ALWAYS derive that title from the actual uncommitted diff (`git status --short`, `git diff --stat HEAD`) and write it per `.claude/rules/git-workflow.md` — never from the proposal text alone, and never by sampling `git log`
- NEVER commit on the user's behalf (no `git add`/`git commit`) — the user copy-pastes the suggested title themselves; `.claude/guard-workflow.ps1` enforces this at the tool layer
- ALWAYS read `.verified.json` rather than asking whether verify ran "this session" - the receipt outlives the session, the question does not
