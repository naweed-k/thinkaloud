#!/usr/bin/env node
// Thinkaloud CLI entry.

import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { budget } from '../lib/budget.mjs';
import { doctor } from '../lib/doctor.mjs';
import { init, INIT_OPTIONS } from '../lib/init.mjs';
import { INSTALL_CMD } from '../lib/install.mjs';
import { preflight, PREFLIGHT_OPTIONS } from '../lib/preflight/preflight.mjs';
import { UIUX } from '../lib/packs.mjs';
import { update, UPDATE_OPTIONS } from '../lib/update.mjs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const TOOLS = ['--tools=<list>', 'which tools to set up: claude, codex, antigravity (comma-separated), or none'];
const PACKS = [
  ['--with-design', 'add impeccable, for better-looking interfaces (optional)'],
  ['--with-uiux', `add ui-ux-pro-max, ${UIUX.skills.length} skills of styles and palettes (optional)`],
  ['--with-browser', 'add Playwright CLI so your AI can open web pages; installs for your whole computer (optional)'],
];

// One entry per command: what it does, its options and examples, for `thinkaloud <command> --help`.
const COMMANDS = {
  init: {
    args: '[folder]',
    summary: 'Create a Thinkaloud workspace (default: ./Thinkaloud)',
    about: 'Creates a new folder with your companion\'s rules, skills and memory, and starts a local git repository in it. '
      + 'It asks which AI tools to set up, unless you say with --tools.',
    options: INIT_OPTIONS,
    help: [TOOLS, ['--profile=<file>', 'import the profile.md you saved from the interview page'], ...PACKS,
      ['-y, --yes', 'skip the questions and use the defaults']],
    examples: ['thinkaloud init', 'thinkaloud init "My Workspace" --tools=claude,codex', 'thinkaloud init --profile=profile.md -y'],
    run: init,
  },
  update: {
    args: '[folder]',
    summary: 'Update the tool-owned files in this workspace',
    about: 'Replaces the files Thinkaloud owns (AGENTS.md, skills, guide). Your MY-RULES.md, memory, projects and learn '
      + 'folders are never touched, and if you edited a Thinkaloud file, your copy is kept next to the new one as .mine.',
    options: UPDATE_OPTIONS,
    help: [TOOLS, ...PACKS],
    examples: ['thinkaloud update', 'thinkaloud update --tools=claude', 'thinkaloud update "C:\\Users\\me\\Thinkaloud" --with-design'],
    run: update,
  },
  doctor: {
    args: '[folder]',
    summary: 'Check tools, skills and budgets, and suggest fixes',
    about: 'Checks Node.js, git, the AI tools, the workspace\'s files, the rules that ask before publishing, and the token '
      + 'budgets. It changes nothing; each problem comes with the command that fixes it.',
    options: {},
    help: [],
    examples: ['thinkaloud doctor', 'thinkaloud doctor path/to/workspace'],
    run: doctor,
  },
  preflight: {
    args: '[project]',
    summary: 'Run the security check before something goes live',
    about: 'Looks for keys in code and git history, risky settings, AI keys that reach the browser, and known-vulnerable '
      + 'dependencies. It reads the project and never runs its code. Writes PREFLIGHT.md and preflight-report.json into the '
      + 'project. Exit code 0: nothing blocks going live at this strictness; 1: something does; 2: it couldn\'t run.',
    options: PREFLIGHT_OPTIONS,
    help: [['--strictness=<level>', 'personal, small or public (default: from the project\'s PLAN.md or your profile)']],
    examples: ['thinkaloud preflight', 'thinkaloud preflight projects/my-app --strictness=small'],
    run: preflight,
  },
  budget: {
    args: '[folder]',
    summary: 'Show token budgets and how to check your usage',
    about: 'Measures what the workspace loads at the start of every session, and shows how to check your usage in each tool.',
    options: {},
    help: [],
    examples: ['thinkaloud budget'],
    run: budget,
  },
};

const HELP_OPTION = { help: { type: 'boolean', short: 'h' } };

function table(rows) {
  const width = Math.max(...rows.map(([name]) => name.length));
  return rows.map(([name, desc]) => `  ${name.padEnd(width)}  ${desc}`);
}

function helpText() {
  return [
    `thinkaloud ${pkg.version}`,
    'Turn any AI tool into a companion that explains its reasoning, lets you decide,',
    'and teaches you to check its work.',
    '',
    'Usage: thinkaloud <command> [options]',
    `Without installing: ${INSTALL_CMD} <command> [options]`,
    '',
    'Commands:',
    ...table(Object.entries(COMMANDS).map(([name, c]) => [`${name} ${c.args}`, c.summary])),
    '',
    'Options:',
    ...table([['-h, --help', 'Show this help'], ['-v, --version', 'Show the version']]),
    '',
    'For a command\'s own options and examples: thinkaloud <command> --help',
    '',
  ].join('\n');
}

// Word-wraps a paragraph, so a narrow terminal doesn't break it mid-word.
function wrap(text, width = 80) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const last = lines.length - 1;
    if (lines[last] && lines[last].length + word.length + 1 > width) lines.push(word);
    else lines[last] = lines[last] ? `${lines[last]} ${word}` : word;
  }
  return lines;
}

function commandHelp(name) {
  const c = COMMANDS[name];
  return [
    `Usage: thinkaloud ${name} ${c.args} [options]`,
    '',
    c.summary,
    '',
    ...wrap(c.about),
    '',
    'Options:',
    ...table([...c.help, ['-h, --help', 'show this help']]),
    '',
    'Examples:',
    ...c.examples.map((e) => `  ${e}`),
    '',
  ].join('\n');
}

// node:util's parse errors, as one plain sentence each.
function explainParseError(cmd, e) {
  const option = e.message.match(/'(-[^' ]+)/)?.[1];
  const more = `Run "thinkaloud ${cmd} --help" to see its options.`;
  if (e.code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION') {
    return `thinkaloud ${cmd}: "${option ?? e.message}" isn't an option for ${cmd}. ${more}`;
  }
  if (e.code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE') {
    return /argument missing/.test(e.message)
      ? `thinkaloud ${cmd}: ${option} needs a value, like ${option}=<value>. ${more}`
      : `thinkaloud ${cmd}: ${option} doesn't take a value. ${more}`;
  }
  return `thinkaloud ${cmd}: ${e.message} ${more}`;
}

async function main(argv) {
  const [cmd, ...rest] = argv;

  if (!cmd || cmd === '-h' || cmd === '--help') {
    process.stdout.write(helpText());
    return 0;
  }
  if (cmd === 'help') {
    process.stdout.write(COMMANDS[rest[0]] ? commandHelp(rest[0]) : helpText());
    return 0;
  }
  if (cmd === '-v' || cmd === '--version') {
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  const command = Object.hasOwn(COMMANDS, cmd) ? COMMANDS[cmd] : null;
  if (!command) {
    process.stderr.write(`thinkaloud: unknown command "${cmd}". Run "thinkaloud --help".\n`);
    return 2;
  }
  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: { ...command.options, ...HELP_OPTION }, allowPositionals: true });
  } catch (e) {
    process.stderr.write(`${explainParseError(cmd, e)}\n`);
    return 2;
  }
  const { help, ...values } = parsed.values;
  if (help) {
    process.stdout.write(commandHelp(cmd));
    return 0;
  }
  if (parsed.positionals.length > 1) {
    process.stderr.write(`thinkaloud ${cmd}: it takes one ${command.args.slice(1, -1)}, but got ${parsed.positionals.length}: `
      + `${parsed.positionals.map((p) => `"${p}"`).join(', ')}. If the name has spaces, put it in quotes.\n`);
    return 2;
  }
  return command.run(values, parsed.positionals);
}

// The person sees one plain line, never a stack trace. THINKALOUD_DEBUG=1 shows the trace for a bug report.
const PLAIN = {
  EACCES: 'Thinkaloud wasn\'t allowed to change a file. Check the folder\'s permissions',
  EPERM: 'Thinkaloud wasn\'t allowed to change a file. Close any program that has it open, then try again',
  EBUSY: 'A file is in use by another program. Close it, then try again',
  ENOSPC: 'The disk is full',
};

try {
  process.exitCode = await main(process.argv.slice(2));
} catch (e) {
  const where = e?.path ? ` (${e.path})` : '';
  const plain = PLAIN[e?.code] ? `${PLAIN[e.code]}${where}.` : `something went wrong: ${e?.message ?? e}`;
  process.stderr.write(`thinkaloud: ${plain}\n`);
  if (process.env.THINKALOUD_DEBUG) process.stderr.write(`${e?.stack ?? ''}\n`);
  process.exitCode = 2;
}
