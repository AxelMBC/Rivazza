---
name: "OPSX: Apply"
description: Implement tasks from an OpenSpec change (Experimental)
category: Workflow
tags: [workflow, artifacts, experimental]
---

Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name (e.g., `/opsx:apply add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/opsx:apply <other>`).

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - `planningHome`, `changeRoot`, and `actionContext`: planning scope and edit constraints
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

3. **Get apply instructions**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   This returns:
   - `contextFiles`: artifact ID -> array of concrete file paths (varies by schema)
   - Progress (total, complete, remaining)
   - Task list with status
   - Dynamic instruction based on current state

   **Handle states:**
   - If `state: "blocked"`: **name the missing artifacts** (from the status JSON, not from a guess)
     and route to `/opsx:propose "<name>"` — its artifact loop fills in what's missing for a change
     that already exists. If what's actually missing is *understanding* rather than a file,
     `/opsx:explore` comes first. **There is no `/opsx:continue` in this repo** — the eight commands
     are `explore`, `propose`, `apply`, `verify`, `sync`, `archive`, `tweak`, `audit-drift`. The name
     was inherited from an upstream skill that never existed here; don't offer it, and don't add it back.
   - If `state: "all_done"`: congratulate, suggest `/opsx:verify` next (it gates on typecheck, lint,
     formatting and the spec deltas before sync/archive)
   - Otherwise: proceed to implementation

   **Workspace guard:** If status JSON reports `actionContext.mode: "workspace-planning"` and `allowedEditRoots` is empty, explain that full workspace apply is not supported in this slice. Treat linked repos and folders as read-only context, ask the user to select an affected area through an explicit implementation workflow, and STOP before editing files.

4. **Read context files**

   Read every file path listed under `contextFiles` from the apply instructions output.
   The files depend on the schema being used:
   - **spec-driven**: proposal, specs, design, tasks
   - Other schemas: follow the contextFiles from CLI output

5. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

6. **Implement tasks (loop until done or blocked)**

   **Before you create anything new, search for it first.**

   The dominant failure mode of agent-written code in a codebase this size is not a wrong line —
   it's a second copy of something that already exists. Nothing downstream catches it: `tsc` is
   happy, oxlint is happy, and `/opsx:verify` reports a clean run. The only place it can be
   prevented is here, before the file is written.

   So whenever a task would introduce a **new** hook, component, util, type, constant or wire
   field, search before writing:

   ```bash
   git grep -n "<behaviour keyword>" -- bridge/src web/src
   git grep -n "export \(const\|function\|type\|interface\) <Name>" -- bridge/src web/src
   ```

   Search wider than the name you were about to use — the thing that already exists is rarely
   called what you would have called it. Search the **behaviour** ("restart", "invalid lap",
   "project", "throttle"), and the module that owns the state.

   | What you found | What to do |
   |---|---|
   | An exact match | Use it. Don't wrap it in a passthrough either — that's the same duplicate with an extra hop. |
   | A near match | Extend or parameterise the existing one, and note in the task that you did. Two 90%-identical helpers is the worst of the three outcomes: both get maintained, only one gets fixed. |
   | Nothing | Create it, following the placement rules in `.claude/rules/code-style.md`. |

   Three shapes in this repo are duplication even when they share no code, so check for them by
   behaviour rather than by name:

   - **A derived-data hook.** `useInputHistory`, `useLapHistory` and `useLapDelta` all follow one
     pattern — bookkeeping in an effect keyed on the throttled `telemetry`, result exposed as a ref
     for rAF consumers. A fourth hook recomputing lap state is a duplicate of one of them.
   - **Restart detection.** The lap-counter-runs-backwards signature already lives in
     `useLapHistory`, `useLapDelta` and `TrackMap`, and `CLAUDE.md` flags keeping them in sync. Do
     not add a fourth copy — extend, or note explicitly why a fourth is unavoidable.
   - **A wire field.** `bridge/src/types.ts` and `web/src/types.ts` are hand-mirrored. Adding a
     field means editing **both**; adding it to one side compiles fine and breaks at runtime.

   For each pending task:
   - Show which task is being worked on
   - Make the code changes required
   - Keep changes minimal and focused
   - Mark task complete in the tasks file: `- [ ]` → `- [x]`
   - Continue to next task

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

7. **On completion or pause, show status**

   Display:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: suggest `/opsx:verify` — never route straight to archive; nothing has been checked yet
   - If paused: explain why and wait for guidance

**Output During Implementation**

```
## Implementing: <change-name> (schema: <schema-name>)

Working on task 3/7: <task description>
[...implementation happening...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

All tasks complete! Run `/opsx:verify` to gate on typecheck, lint, formatting and the
spec deltas, then `/opsx:sync` and `/opsx:archive`.
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**
- Keep going through tasks until done or blocked
- **Search before creating** - never introduce a new hook, component, util, type or wire field without grepping for an existing one first. Duplication is invisible to `tsc` and to oxlint, so this is the only step in the pipeline that can prevent it
- **Never commit** - `.claude/guard-workflow.ps1` blocks it. A "Commit: ..." task is satisfied by leaving the work in the working tree; mark it done and note the commit is deferred to the user
- Follow `.claude/rules/code-style.md`; run `npm run format` after editing, since Prettier owns import order and `/opsx:verify` checks it
- Always read context files before starting (from the apply instructions output)
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Update task checkbox immediately after completing each task
- Pause on errors, blockers, or unclear requirements - don't guess
- Use contextFiles from CLI output, don't assume specific file names

**Fluid Workflow Integration**

This command supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly
