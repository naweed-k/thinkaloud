// Facts about each AI tool that change between releases, kept in one place: commands, folders, guardrail files
// and links. Each record says when it was last checked against the tool's official docs. MAINTAINING.md has
// the refresh routine; `thinkaloud doctor` prints the newest date and says when it's getting old.

export const TOOLS = [
  {
    id: 'claude',
    name: 'Claude Code',
    command: 'claude',
    installDocs: 'https://code.claude.com/docs/en/setup',
    start: 'claude   then type: start   (or /start)',
    skillDir: '.claude/skills',
    // Read by Claude Code only; the ask rules are built in lib/guardrails.mjs.
    guardrailFile: '.claude/settings.json',
    usage: {
      usage: '/usage',
      usageNote: 'plan limits, session cost and activity; /cost and /stats are the same screen',
      context: '/context',
      contextNote: 'a grid of what fills the context window',
      extra: '/statusline can keep context % and your 5-hour and weekly limits on screen',
    },
    checked: '2026-10-13',
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    command: 'codex',
    installDocs: 'https://learn.chatgpt.com/docs/codex/cli',
    start: 'codex    then type: start   (or $start)',
    skillDir: '.agents/skills',
    // Loads once the project's .codex/ layer is trusted.
    guardrailFile: '.codex/rules/thinkaloud.rules',
    usage: {
      usage: '/status',
      usageNote: 'token use, context left, and your 5-hour and weekly limits',
      context: '/status',
      contextNote: 'the "Context window" line',
      extra: '/usage shows your account usage; also https://chatgpt.com/codex/settings/usage',
    },
    checked: '2026-10-13',
  },
  {
    id: 'antigravity',
    name: 'Antigravity CLI',
    command: 'agy',
    installDocs: 'https://antigravity.google/docs/cli/install/',
    start: 'agy      then type: start   (or /start)',
    // Best effort: it reads AGENTS.md and .agents/skills/, but hasn't had a full real session yet.
    bestEffort: true,
    skillDir: '.agents/skills',
    // The older folder, where impeccable puts its skill for Antigravity.
    alsoReads: ['.agent/skills'],
    // No project-level rules file we could confirm, so AGENTS.md alone covers it.
    guardrailFile: null,
    usage: {
      usage: '/usage',
      usageNote: 'usage limits and remaining requests or tokens for each model',
      context: '/context',
      contextNote: 'a panel showing what fills the context window',
      extra: '/statusline can keep this on screen (best effort: not yet tried in a real session)',
    },
    checked: '2026-10-13',
  },
];

// The chat apps' menus and limits in chat/README.md and guide/usage.md have no code, only this date.
export const CHAT_APPS_CHECKED = '2026-10-13';

export const AGENT_TOOLS = TOOLS.map((t) => t.id);
export const toolById = (id) => TOOLS.find((t) => t.id === id);

export const SKILL_DIRS = Object.fromEntries(TOOLS.map((t) => [t.id, t.skillDir]));
export const GUARDRAIL_FILES = Object.fromEntries(TOOLS.filter((t) => t.guardrailFile).map((t) => [t.id, t.guardrailFile]));
export const USAGE = TOOLS.map((t) => ({ tool: t.id, name: t.name, ...t.usage }));

// The newest check, as an ISO date. guide/models.md, guide/usage.md and chat/README.md print it (a test keeps them in step).
export const FACTS_CHECKED = [...TOOLS.map((t) => t.checked), CHAT_APPS_CHECKED].sort().at(-1);

// After about a quarter, commands and menus have usually moved somewhere.
export const STALE_AFTER_DAYS = 90;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// '2026-10-13' → '13 Oct 2026', the way the guides write dates.
export function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function factsAgeDays(now = new Date(), checked = FACTS_CHECKED) {
  return Math.floor((now.getTime() - Date.parse(`${checked}T00:00:00Z`)) / 86_400_000);
}
