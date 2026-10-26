# Contributing

Thanks for helping. Issues and pull requests are welcome. For anything bigger than a fix, open an issue first, so
we can agree the shape before you build it.

## The rules the code keeps

- **Windows, macOS and Linux, all three.** Scripts are Node (22 or newer) ES modules. No bash-only or
  PowerShell-only paths. Build paths with `path.join`, never with hard-coded separators. Don't rely on symlinks
  (Windows needs admin rights for them): copy files instead.
- **Zero runtime dependencies.** Only Node's built-in modules. A dependency is something every person who runs
  `npx thinkaloud` downloads and has to trust.
- **Never run the project's code.** `preflight` reads a project; it never runs its scripts or loads its config code.
  Start every outside program by its full path (`spawnTool` in `lib/detect.mjs`).
- **Token budgets are acceptance criteria.** What a workspace loads at the start of every session costs the person
  usage in every session. The budgets live in `lib/budgets.mjs` and are checked by the tests and by
  `thinkaloud doctor`. `template/AGENTS.md` has a hard cap of 7,600 characters, so anything added needs an equal
  cut. Measure with characters ÷ 4, and say the before and after in your pull request.
- **Every behaviour rule carries its reason.** A rule in `AGENTS.md` or a skill says why, in a clause, so a model
  can apply it to cases the words don't cover.
- **Tool facts live in one dated place.** Commands, folders, menus and limits change. They go in `lib/tools.mjs`
  and the three guides that carry a "Last checked" date. See [MAINTAINING.md](MAINTAINING.md).
- **Credit third-party work.** Install third-party skills and tools from their source at a pinned version, and add
  them to [CREDITS.md](CREDITS.md) with their licence. Don't copy their files into this repo unless the licence
  allows it and there's a reason.
- **British English**, plain and calm: no hype, no exclamation marks.

## The six promises

The promises in `template/AGENTS.md` (and `chat/full.md`) are the product. Changes to their wording need the
maintainer's sign-off, so raise them in an issue first.

## Tests

```
npm test
```

The tests use Node's built-in `node:test`, and CI runs them on all three systems with Node 22 and 24. Add a test
with every fix. For a security fix, check the test fails without the fix.
