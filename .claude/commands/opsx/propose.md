---
name: "OPSX: Propose"
description: Propose a new change - create it and generate all artifacts in one step
category: Workflow
tags: [workflow, artifacts, experimental]
---

Propose a new change - create the change and generate all artifacts in one step.

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

When ready to implement, run /opsx:apply

Read `.claude/workflow.yaml` before Step 2: its `git` block carries the branch conventions this
command uses. If the block is missing, the step that reads it says so and is skipped — never
half-guess a config value.

---

**Input**: The argument after `/opsx:propose` is the change name (kebab-case), OR a description of what the user wants to build.

**Steps**

1. **If no input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" → `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Put the work on its own branch**

   Read `.claude/workflow.yaml`'s `git` block. **If it's missing or `git.host` is unset, skip this
   step entirely** with a one-line note that branch-per-change conventions aren't configured.

   ```bash
   git rev-parse --abbrev-ref HEAD
   ```

   - **HEAD is not in `git.protected_branches`** → keep it. Print
     `Branch: <current> (not protected — staying put)` and go to Step 3. An existing working branch
     is assumed deliberate; this command does not second-guess it.
   - **HEAD is in `git.protected_branches`** → this is the case the step exists for. Nearly every
     commit in this repo landed directly on `master`, so starting a change there is the default
     mistake, and it gets more expensive the longer it goes unnoticed: here it is one `git switch`;
     after the archive commit it is history surgery.

   1. **Pick the prefix.** `git.fix_prefix` when the change repairs a defect, `git.feature_prefix`
      otherwise. Both values must appear in `git.branch_prefixes`.
   2. **Propose `<prefix><slug>` from `origin/<git.default_base_branch>`** and confirm with
      **AskUserQuestion**:

      | Option | Meaning |
      | --- | --- |
      | **Create `<prefix><slug>` from `origin/<base>`** *(Recommended)* | Run the commands below. |
      | **Use a different name** | Ask for it, then create that instead. |
      | **Stay on `<protected>`** | Continue without branching. Warn once that the change and the base branch will share a history. |

   3. **Create it.**

      ```bash
      git fetch origin
      git switch --no-track -c <prefix><slug> origin/<git.default_base_branch>
      ```

      The branch starts from the **remote** base, never from local HEAD — a stale local `master`
      would otherwise drag unrelated commits along.

      **`--no-track` is load-bearing — never drop it.** Branching *from* `origin/<base>` is what
      makes it necessary: without the flag, `git switch -c <branch> origin/<base>` sets the new
      branch's upstream to `origin/<base>` — the *base*, not the branch. Every later push that
      follows that upstream (VS Code's Sync/Publish button, `git push origin HEAD`, most GUIs) then
      fast-forwards the shared branch instead of publishing yours.

      **Order matters: `--no-track` goes before `-c`.** `-c` takes the very next token as the new
      branch name, so `git switch -c --no-track <slug> …` would create a branch literally called
      `--no-track`.

      Verify it took, and say so, before moving on:

      ```bash
      git rev-parse --abbrev-ref '@{u}' 2>/dev/null && echo "UPSTREAM SET — expected none" || echo "no upstream (correct)"
      ```

      - **The branch already exists** → `git switch <name>` instead, and say you reused it. Check
        its upstream with the command above; if it points at `origin/<base>`, run
        `git branch --unset-upstream` and say you did.
      - **`git switch` fails on local modifications** → report the git output verbatim, state that
        **no change directory was created**, and stop. Never `stash`, never `--force`, never
        `--discard-changes`: the uncommitted work is the user's, and losing it is not recoverable
        from anything this command wrote.
      - Uncommitted work that doesn't conflict comes along with the switch. That is intended.

   **Creating or switching a branch is the only git write this command makes. Never `git add`,
   `git commit` or `git push`** — `.claude/guard-workflow.ps1` blocks the commit, and the boundary
   belongs to the user.

3. **Check nothing already covers it, then create the change directory**

   **Search before creating.** A change that duplicates an archived one, or that re-specs a
   capability that already exists, is expensive to unwind after the artifacts are written.

   ```bash
   openspec list --specs
   openspec list --json
   ls openspec/changes/archive
   git grep -ril "<concept>" -- openspec/specs openspec/changes/archive
   ```

   | What you found | What to do |
   | --- | --- |
   | A capability already owns the behaviour and the change is a few lines | Stop — this is `/opsx:tweak`, not a proposal. |
   | An **active** change already touches it | Stop. Offer `/opsx:apply <name>` on that one. |
   | An **archived** change did something similar | Read it. Reuse its vocabulary and capability ids; say what is different this time. |
   | Nothing | Proceed. |

   ```bash
   openspec new change "<name>"
   ```

   This creates only `.openspec.yaml` — no stubs. The artifacts are whatever Step 5 writes.
   If a change directory with that name already exists, ask whether to continue it rather than
   overwriting it.

4. **Get the artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (e.g., `["tasks"]`)
   - `artifacts`: list of all artifacts with their status and dependencies
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context. Use these instead of assuming repo-local paths.

5. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is `ready` (dependencies satisfied)**:
      - Get instructions:
        ```bash
        openspec instructions <artifact-id> --change "<name>" --json
        ```
      - The instructions JSON includes:
        - `context`: Project background (constraints for you - do NOT include in output)
        - `rules`: Artifact-specific rules (constraints for you - do NOT include in output)
        - `template`: The structure to use for your output file
        - `instruction`: Schema-specific guidance for this artifact type
        - `resolvedOutputPath`: Resolved path or pattern to write the artifact
        - `dependencies`: Completed artifacts to read for context
      - Read any completed dependency files for context
      - Create the artifact file using `template` as the structure and write it to `resolvedOutputPath`
      - Apply `context` and `rules` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until all `applyRequires` artifacts are complete**
      - After creating each artifact, re-run `openspec status --change "<name>" --json`
      - Check if every artifact ID in `applyRequires` has `status: "done"` in the artifacts array
      - Stop when all `applyRequires` artifacts are done

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify
      - Then continue with creation

6. **Show final status**
   ```bash
   openspec status --change "<name>"
   ```

**How `tasks.md` closes**

There is **no test framework in this repo** — no vitest, no jest, no `npm test`. Do not write paired
test tasks and do not invent a runner; see `.claude/rules/verification.md`. What replaces them is an
explicit verification section, always last:

```markdown
## N. Verification

- [ ] N.1 Run `/opsx:verify` — bridge and web typecheck, lint, formatting and the spec deltas
- [ ] N.2 <what only a running app can confirm: what to do, and what you expect to see>
```

Write N.2 and beyond as concrete observations, not as "check it works": *"with the mock running,
confirm the position dot completes a lap without the map re-fitting"*. These stay unchecked until a
human runs them, and that is correct — `/opsx:verify` surfaces them and `/opsx:archive` prompts
about them. The procedure is `.claude/skills/verify/SKILL.md`.

**Output**

After completing all artifacts, summarize:
- Change name and location
- List of artifacts created with brief descriptions
- What's ready: "All artifacts created! Ready for implementation."
- Branch: the branch the work is on, and whether this command created it
- Prompt: "Run `/opsx:apply` to start implementing."

**Artifact Creation Guidelines**

- Follow the `instruction` field from `openspec instructions` for each artifact type
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- Use `template` as the structure for your output file - fill in its sections
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file
  - Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Guardrails**
- Create ALL artifacts needed for implementation (as defined by schema's `apply.requires`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer making reasonable decisions to keep momentum
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next
- **Search before creating** - an archived change or an existing capability usually already carries the vocabulary; reuse it rather than coining a second name for the same thing
- **Never drop `--no-track`**, and never put it after `-c` - see Step 2
- **Never commit and never push** - `.claude/guard-workflow.ps1` blocks the commit; the user owns the boundary
- **No test tasks** - there is no runner here. Close `tasks.md` with the verification section above
