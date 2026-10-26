// Third-party installs (credited in CREDITS.md). Each one runs
// its own installer from source at a pinned version; nothing is bundled. A failed install is reported with the
// command to retry, and never stops init or update. MAINTAINING.md says how to bump a pin.

import { spawnTool } from './detect.mjs';

// When the pins, installer flags and description costs below were last checked against each project's source.
export const PACKS_CHECKED = '2026-09-24';

// addyosmani/agent-skills, MIT. The companion skills route engineering work here.
export const CORE = {
  source: 'addyosmani/agent-skills',
  // The commit tag 0.6.10 points to. A tag can be moved; a commit can't, and these skills are loaded every session.
  tag: '0.6.10',
  ref: 'c004a74784a08295d52749b04cda634125b9a581',
  cli: 'skills@1.7.0',
  skills: [
    'using-agent-skills', 'interview-me', 'idea-refine', 'spec-driven-development',
    'planning-and-task-breakdown', 'incremental-implementation', 'test-driven-development',
    'debugging-and-error-recovery', 'code-review-and-quality', 'security-and-hardening',
    'source-driven-development', 'documentation-and-adrs', 'frontend-ui-engineering',
  ],
};

// descTokens: what a pack's skill descriptions add to every session at this pin (characters ÷ 4), measured on an
// installed workspace. `init` quotes it before installing; `doctor` measures the real cost afterwards.
export const DESIGN = { impeccable: 'impeccable@4.1.0', skills: ['impeccable'], descTokens: 225 };
// Its own pack: its descriptions alone would put the design pack over the description budget.
export const UIUX = {
  cli: 'ui-ux-pro-max-cli@2.15.0',
  skills: ['ui-ux-pro-max', 'banner-design', 'brand', 'design', 'design-system', 'slides', 'ui-styling'],
  descTokens: 690,
};
export const BROWSER = { cli: '@playwright/cli@0.1.21', skills: ['playwright-cli'] };

// The names each pack adds, so tests can check none of them clashes with a companion skill.
export const THIRD_PARTY_SKILLS = [...CORE.skills, ...DESIGN.skills, ...UIUX.skills, ...BROWSER.skills];

// The pinned version of each pack, stored in the manifest so `update` knows when to reinstall.
export const PACK_VERSIONS = {
  core: `${CORE.tag} (${CORE.ref.slice(0, 7)})`,
  design: DESIGN.impeccable,
  uiux: UIUX.cli,
  browser: BROWSER.cli,
};

const SKILLS_AGENT = { claude: 'claude-code', codex: 'codex', antigravity: 'antigravity-cli' };
const PW_TARGET = { claude: 'claude', codex: 'agents', antigravity: 'agents' };

// The steps for the chosen packs, in order. Pure, so tests can check the exact commands.
export function planInstalls(tools, packs) {
  const steps = [];
  if (!tools.length) return steps;
  if (packs.includes('core')) {
    steps.push({
      pack: 'core',
      label: `engineering skills (${CORE.source} ${CORE.tag})`,
      cmd: 'npx',
      args: ['-y', CORE.cli, 'add', `${CORE.source}#${CORE.ref}`, '--skill', ...CORE.skills,
        '--agent', ...tools.map((t) => SKILLS_AGENT[t]), '--copy', '-y'],
    });
  }
  if (packs.includes('design')) {
    // --no-hooks: impeccable's hooks run after every edit, and its Claude Code hook needs a POSIX shell.
    steps.push({
      pack: 'design',
      label: `impeccable (${DESIGN.impeccable})`,
      cmd: 'npx',
      args: ['-y', DESIGN.impeccable, 'install', '-y', '--project', '--no-hooks', `--providers=${tools.join(',')}`],
    });
  }
  if (packs.includes('uiux')) {
    // One --ai per run. Codex's .agents/skills/ also serves Antigravity, so skip Antigravity when Codex is there.
    for (const t of tools.filter((t) => !(t === 'antigravity' && tools.includes('codex')))) {
      steps.push({ pack: 'uiux', label: `ui-ux-pro-max for ${t} (${UIUX.cli})`, cmd: 'npx', args: ['-y', UIUX.cli, 'init', '--ai', t] });
    }
  }
  if (packs.includes('browser')) {
    // Global on purpose: the skill calls `playwright-cli`, and otherwise installs @latest itself.
    steps.push({ pack: 'browser', label: `Playwright CLI for your whole computer (${BROWSER.cli})`, cmd: 'npm', args: ['install', '-g', BROWSER.cli] });
    for (const target of [...new Set(tools.map((t) => PW_TARGET[t]))]) {
      steps.push({ pack: 'browser', label: `Playwright skill (${target})`, cmd: 'npx', args: ['-y', BROWSER.cli, 'install', `--skills=${target}`] });
    }
  }
  return steps;
}

function commandLine({ cmd, args }) {
  return [cmd, ...args].join(' ');
}

// Runs a step in the workspace, by the command's full path (lib/detect.mjs says why). Arguments are constants
// from planInstalls, never user input, so the shell (needed on Windows for npm/npx .cmd shims) can't be handed
// anything unexpected.
function runStep(step, cwd) {
  const r = spawnTool(step.cmd, step.args, {
    cwd,
    timeout: 10 * 60 * 1000,
    // Opt out of the installers' usage telemetry: Thinkaloud sends nothing about the person.
    env: { DO_NOT_TRACK: '1', DISABLE_TELEMETRY: '1' },
  });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { ok: r.status === 0, detail: r.error?.message ?? lastLines(output) };
}

function lastLines(text, n = 4) {
  // Strip colour codes and box drawing so the message stays readable.
  const clean = text.replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '').split(/\r?\n/).map((l) => l.replace(/^[\s│├└◇╮╯─]+/, '').trim());
  return clean.filter(Boolean).slice(-n).join('\n');
}

// Runs the steps, prints one line each, and returns the packs that fully succeeded.
export function runInstalls(steps, cwd, out, run = runStep) {
  const failed = new Set();
  for (const step of steps) {
    out.write(`Installing ${step.label}... `);
    const r = run(step, cwd);
    if (r.ok) {
      out.write('done.\n');
      continue;
    }
    failed.add(step.pack);
    out.write('didn\'t work.\n');
    if (r.detail) out.write(`${r.detail.split('\n').map((l) => `    ${l}`).join('\n')}\n`);
    out.write(`  Your workspace is fine without it. To try again later, run this inside the workspace:\n    ${commandLine(step)}\n`);
  }
  return [...new Set(steps.map((s) => s.pack))].filter((p) => !failed.has(p));
}
