// What to do with the usage that's left. The commands that show usage are tool facts, kept in lib/tools.mjs
// (USAGE). `thinkaloud budget` prints both; template/guide/usage.md holds the same for people, and a test keeps
// them in step. The companion's `budget` skill reads the guide's table.

export const LEFT = [
  ['plenty (more than half)', 'any slice; batch several S slices in one session'],
  ['about half', 'S or M slices; start an L only in a fresh session'],
  ['low (under a fifth)', 'one S slice or a tidy-up, then close'],
  ['nearly out', 'close now'],
];
