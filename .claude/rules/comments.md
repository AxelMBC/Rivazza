# Comments

No `paths:` — this loads every session. Path-scoped rules only load after a matching file is
*read*, so a fresh `Write`, a subagent, or an edit made before reading never saw this rule when it
lived in `code-style.md`. It applies to every source file: `.ts`, `.tsx`, `.js`, config files, and
JSX `{/* … */}` alike. `.claude/comment-check.ps1` flags every comment line an edit adds.

Comments explain **constraints that live outside the repo** — things no rename can express:
AC's protocol and file formats, Windows/browser behaviour, and tuned constants whose value was
chosen against a tradeoff (a reader who "cleans up" `FOLLOW_WINDOW_HEADROOM = 0.95` to `1`
reintroduces a bug).

Never comment what the code already says. In particular:

- No JSDoc on internal functions — strict TS types carry it.
- No section banners (`// ---- helpers ----`); that is a signal to split the file.
- No comments narrating the next line, an effect's steps, or a function's name restated in prose.
- Rationale about how two subsystems relate belongs in `CLAUDE.md` or in `openspec/specs/`, not in
  a source comment. Before writing one, check whether the relevant spec already states it.

Test before keeping a comment: _can a reader recover this by reading the code harder?_ If yes,
delete it. If no, it is load-bearing — keep it, and keep it short.

**When the answer is "reading the code harder wouldn't recover it", the fix is usually still not a
comment.** Explicit code replaces the comment:

| If you were about to comment… | Do this instead |
| --- | --- |
| what a block does | extract it to a named function |
| a magic number or string | a named constant (`FOLLOW_WINDOW_HEADROOM`, `OFF_TYRES_OUT`) |
| a compound condition | a named predicate (`isStale`, `hasFreshPacket`) |
| what a variable holds | rename the variable |
| what a function takes or returns | explicit types |
| the sections of a long file | split the file |
