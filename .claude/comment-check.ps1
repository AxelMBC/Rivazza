<#
.SYNOPSIS
  PostToolUse check. Flags every comment line an Edit/Write/MultiEdit adds to source.

.DESCRIPTION
  `.claude/rules/comments.md` is prose: it shapes intent but cannot see the edit that was just
  made. This script can. After an edit to a source file under bridge/, web/ or packages/, it
  collects the comment lines (`//`, `/* */`, ` * `, JSX `{/* */}`) present in the new text but not
  in the old, and hands them back as `additionalContext` with the rule's test attached.

  It never blocks: some comments are load-bearing (AC's formats, Windows/browser behaviour, tuned
  constants). The point is that every added one is looked at again, deliberately.

  FAILS OPEN. Any parse problem exits 0 with no output, so a bug here never interferes with edits.

.NOTES
  Wired from .claude/settings.json as a PostToolUse hook on `Edit|Write|MultiEdit`.
  Contract: reads the hook payload as JSON on stdin, writes a hookSpecificOutput object on stdout
  only when there is something to report, exits 0 either way.
#>

$ErrorActionPreference = 'Stop'

try {
    $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
    $toolInput = $payload.tool_input
    $path = ([string]$toolInput.file_path) -replace '\\', '/'

    if ($path -notmatch '/(bridge|web|packages)/' -or $path -match '/node_modules/|/dist/') { exit 0 }
    if ($path -notmatch '\.(ts|tsx|js|jsx|mjs|cjs|css)$') { exit 0 }

    $oldText = ''
    $newText = ''
    switch ($payload.tool_name) {
        'Write' { $newText = [string]$toolInput.content }
        'Edit' {
            $oldText = [string]$toolInput.old_string
            $newText = [string]$toolInput.new_string
        }
        'MultiEdit' {
            foreach ($e in $toolInput.edits) {
                $oldText += "`n" + [string]$e.old_string
                $newText += "`n" + [string]$e.new_string
            }
        }
        default { exit 0 }
    }

    $commentPattern = '^\s*(//|/\*|\*(?!\s*\{)(\s|/|$)|\{/\*)|\S\s+//\s'
    $oldLines = @{}
    foreach ($line in ($oldText -split "`r?`n")) { $oldLines[$line.Trim()] = $true }

    $added = @(
        $newText -split "`r?`n" |
            Where-Object { $_ -match $commentPattern -and $_ -notmatch 'https?://' -and -not $oldLines.ContainsKey($_.Trim()) } |
            ForEach-Object { $_.Trim() }
    )
    if ($added.Count -eq 0) { exit 0 }

    $listing = ($added | Select-Object -First 15 | ForEach-Object { "  $_" }) -join "`n"
    $message = @"
comment-check: this edit to $path added $($added.Count) comment line(s):
$listing

Apply .claude/rules/comments.md to each: can a reader recover it by reading the code harder? If yes,
delete it. If it names a block, a magic value or a condition, replace it with a function, a named
constant or a predicate. Keep only AC/Windows/browser constraints and tuned-constant tradeoffs, short.
"@

    $result = @{
        hookSpecificOutput = @{
            hookEventName     = 'PostToolUse'
            additionalContext = $message
        }
    }
    Write-Output ($result | ConvertTo-Json -Depth 5 -Compress)
}
catch {}
exit 0
