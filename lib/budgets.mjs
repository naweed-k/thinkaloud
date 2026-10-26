// Token budgets for always-loaded files: they cost usage in every session, so they stay small on purpose.
// Tokens are estimated as characters ÷ 4.
// Paths are relative to a workspace root, written with '/' and joined with path.join by callers.

export const BUDGETS = [
  { file: 'AGENTS.md', tokens: 1900 },
  { file: 'CLAUDE.md', tokens: 150 },
  { file: 'memory/now.md', tokens: 200, lines: 15 },
  { file: 'memory/profile.md', tokens: 600, lines: 60 },
  { file: 'MY-RULES.md', tokens: 300, lines: 30 },
  { file: 'memory/lessons.md', tokens: 400, lines: 40 },
];

export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export function countLines(text) {
  return text.split('\n').filter((line, i, all) => i < all.length - 1 || line !== '').length;
}
