<#
.SYNOPSIS
  PreToolUse guard. Blocks the two workflow rules that must never be negotiable.

.DESCRIPTION
  Both rules were already written down — RULE 1 in `/opsx:archive` step 7, RULE 2 nowhere at all —
  but prose in a command file is context, not enforcement: it is only read when that command runs.
  This script moves them to the one layer the model cannot talk itself out of.

  RULE 1 — Claude never commits.
    The user owns the commit history and the commit boundaries; they commit themselves at the end,
    after `/opsx:archive`. A `tasks.md` step that says "Commit: ..." is satisfied by leaving the
    work in the working tree, not by committing.
    Blocked: any form of `git commit`, including inside a compound command
    (`git add . && git commit -m x`) and with global options (`git -C <path> commit`).
    NOT blocked: `git add` (needed for `git mv`), and `git push` — this repo has no /opsx:pr, so a
    push is always something the user asked for explicitly.

  RULE 2 — no git worktrees.
    Work is reviewed in VS Code's Source Control pointed at the main repo. From there a worktree
    shows up only as an untracked directory, so the modified files are invisible and the work looks
    lost. Implementation always happens in the main repo, on the change branch.
    Blocked here: `git worktree add`, and the Agent tool with `isolation: "worktree"`.
    Blocked in settings.json `permissions.deny`: the `EnterWorktree` tool.
    NOT blocked: `git worktree list` / `remove` / `unlock` — those are the recovery path when a
    session is inherited with work already stranded in a worktree.

  ESCAPE HATCH: there is none inside the session, by design. When the user genuinely wants a
  commit, they run it themselves — typing `! git commit -m "..."` in the prompt runs it in the
  session, so the output still lands in the conversation. Claude may draft the message; how it is
  written is `.claude/rules/git-workflow.md`.

  FAILS OPEN. A guard that fails closed on a parse bug bricks every Bash call in the session. The
  duplicate patterns in settings.json `permissions.deny` are the backstop for the common forms if
  this script ever stops running.

.NOTES
  Wired from .claude/settings.json as a PreToolUse hook on `Bash|PowerShell|Agent`.
  Contract: reads the hook payload as JSON on stdin, writes a `permissionDecision` object on
  stdout, exits 0 either way.
#>

$ErrorActionPreference = 'Stop'

function Deny {
    param([Parameter(Mandatory = $true)][string]$Reason)

    $decision = @{
        hookSpecificOutput = @{
            hookEventName            = 'PreToolUse'
            permissionDecision       = 'deny'
            permissionDecisionReason = $Reason
        }
    }
    Write-Output ($decision | ConvertTo-Json -Depth 5 -Compress)
    exit 0
}

$WORKTREE_REASON = @'
Blocked by .claude/guard-workflow.ps1 (RULE 2): this project does not use git worktrees.

Work is reviewed in VS Code's Source Control pointed at the main repo, where a worktree is only an
untracked directory and the changed files are invisible - the work looks lost. Implement in the
main repo, on the change branch (feat/... / fix/... per git.*_prefix in .claude/workflow.yaml).

`git worktree list` / `remove` / `unlock` stay allowed: they are the recovery path when a session
is inherited with work already stranded in a worktree.
'@

$COMMIT_REASON = @'
Blocked by .claude/guard-workflow.ps1 (RULE 1): Claude does not commit in this repo.

The user owns the commit history and commits themselves at the end, after /opsx:archive. This
overrides any "Commit: ..." step baked into a change's tasks.md - treat such a step as satisfied by
leaving the work in the working tree, and mark it done noting that the commit is deferred to the
user.

Leave the changes as they are and report what is ready. If the user asked for this commit
explicitly, hand them the exact line to run themselves: ! git commit -m "..."
Draft the message per .claude/rules/git-workflow.md.
'@

try {
    $raw = [Console]::In.ReadToEnd()
} catch {
    exit 0
}
if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

try {
    $payload = $raw | ConvertFrom-Json
} catch {
    exit 0
}

$toolName = [string]$payload.tool_name

# --- Agent tool: worktree isolation ------------------------------------------------------
if ($toolName -eq 'Agent') {
    if ([string]$payload.tool_input.isolation -eq 'worktree') {
        Deny -Reason $WORKTREE_REASON
    }
    exit 0
}

# --- Bash / PowerShell: git commit, git worktree add --------------------------------------
if ($toolName -ne 'Bash' -and $toolName -ne 'PowerShell') { exit 0 }

$command = [string]$payload.tool_input.command
if ([string]::IsNullOrWhiteSpace($command)) { exit 0 }

# `git`, then any number of GLOBAL options (`-C <path>`, `--no-pager`, ...), then the subcommand.
# Anchoring on the subcommand this way keeps read-only lookalikes such as `git log --grep=commit`
# out of the match.
$gitPrefix   = '(?i)\bgit\s+(?:-[a-zA-Z]\s+\S+\s+|--[^\s]+\s+)*'
$commitRe    = $gitPrefix + 'commit\b'
$worktreeRe  = $gitPrefix + 'worktree\s+add\b'

if ($command -match $commitRe)   { Deny -Reason $COMMIT_REASON }
if ($command -match $worktreeRe) { Deny -Reason $WORKTREE_REASON }

exit 0
