// What preflight reads: the files that go into git (or every file, without git), the build output, env files,
// and the stack. Paths are '/'-separated and relative to the project, so reports match on every OS.

import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const REPORT_JSON = 'preflight-report.json';
export const REPORT_MD = 'PREFLIGHT.md';

const MAX_FILE_BYTES = 1_000_000;
// Built bundles are often bigger than that, and a key the build inlined sits in one of them.
const MAX_OUTPUT_BYTES = 10_000_000;
const SKIP_DIRS = new Set(['node_modules', '.git', '.venv', 'venv', 'env', '__pycache__', '.pytest_cache', '.mypy_cache',
  '.tox', '.cache', '.turbo', '.parcel-cache', 'coverage', '.idea', '.vscode']);
// Folders that get deployed. They're scanned even when git ignores them.
const OUTPUT_DIRS = ['dist', 'build', 'out', '.output', '.next/static', '.vercel/output', 'public'];

// The deploy folder a path is in, or undefined.
export const outputDir = (rel) => OUTPUT_DIRS.find((out) => rel.startsWith(`${out}/`));

// An audit or git call that takes longer than this is stopped and reported as not run, instead of hanging
// preflight. THINKALOUD_PREFLIGHT_TIMEOUT_MS is for the tests.
const TOOL_TIMEOUT_MS = 120_000;
export const TIMED_OUT = 'It took longer than 2 minutes, so preflight stopped it.';
export const timedOut = (r) => r.error?.code === 'ETIMEDOUT';

export const CODE_EXT = /\.(m?js|cjs|jsx|ts|tsx|mts|cts|vue|svelte|astro|py|html)$/i;
export const ENV_FILE = /(^|\/)\.env(\.[^/]*)?$/;
export const ENV_EXAMPLE = /(^|\/)\.env\.(example|sample|template)$/;

export const toNative = (base, rel) => path.join(base, ...rel.split('/').filter(Boolean));

// Preflight checks a project it must not trust: an AI wrote it, and parts may be cloned. So it never runs code from
// the project folder. Each switch below was tried for real against a planted payload (13 Oct 2026):
// - Windows: cmd.exe looks in the current folder before PATH, so a planted npm.cmd would run. Tools are started by
//   their full PATH location, and NoDefaultCurrentDirectoryInExePath stops the shims' own lookups (node) there too.
// - Yarn 1 runs the `yarn-path` script a project's .yarnrc names, even for `yarn audit`.
// - pnpm loads the project's .pnpmfile.cjs for `pnpm audit` (the command-line switch is in deps.mjs, because a
//   project's pnpm-workspace.yaml overrides this one).
// - Corepack runs whatever version, or URL, a project's packageManager field and .corepack.env ask for.
const SAFE_ENV = {
  NoDefaultCurrentDirectoryInExePath: '1',
  YARN_IGNORE_PATH: '1',
  npm_config_ignore_pnpmfile: 'true',
  COREPACK_ENV_FILE: '0',
  COREPACK_ENABLE_PROJECT_SPEC: '0',
};

// git reads the project's own .git/config, which can name programs to run: an fsmonitor, or an ssh command for a
// partial clone's lazy fetch. Preflight's git calls only read, so both are switched off (diff programs are off
// in each call: --no-ext-diff, --no-textconv).
const GIT_SAFE = ['-c', 'core.fsmonitor=false', '-c', 'protocol.allow=never'];

function isExecutable(file, platform) {
  try {
    if (!statSync(file).isFile()) return false;
    if (platform !== 'win32') accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// The full path of `cmd` from PATH, or null. Only absolute PATH entries count: a relative one ('.') would mean
// the project folder.
export function which(cmd, env = process.env, platform = process.platform) {
  const win = platform === 'win32';
  const sep = win ? ';' : ':';
  const isAbs = win ? path.win32.isAbsolute : path.posix.isAbsolute;
  const exts = win ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean) : [''];
  for (const dir of (env.PATH ?? env.Path ?? '').split(sep)) {
    if (!dir || !isAbs(dir)) continue;
    for (const ext of exts) {
      const file = path.join(dir, cmd + ext);
      if (isExecutable(file, platform)) return file;
    }
  }
  return null;
}

// Is `cmd` on PATH? Checked by hand so a missing tool never costs a spawn.
export function onPath(cmd) {
  return which(cmd) !== null;
}

// Runs a tool by its full path. Windows .cmd and .bat shims (npm, pnpm, yarn) need cmd.exe, so their quoted path
// goes through the shell; every argument is a constant from this folder, never text from the project.
export function exec(cmd, args, options = {}) {
  const file = which(cmd);
  if (!file) {
    return { status: null, stdout: '', stderr: `${cmd}: not found`, error: Object.assign(new Error(`${cmd} not found`), { code: 'ENOENT' }) };
  }
  const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(file);
  const r = spawnSync(shell ? `"${file}"` : file, cmd === 'git' ? [...GIT_SAFE, ...args] : args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
    timeout: Number(process.env.THINKALOUD_PREFLIGHT_TIMEOUT_MS) || TOOL_TIMEOUT_MS,
    ...options,
    shell,
    env: { ...process.env, ...options.env, ...SAFE_ENV },
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error };
}

// Writes a report without following a link: a project could ship PREFLIGHT.md as a link to a file elsewhere.
// A new file is created next to it (never an existing one), then renamed over the old name.
export function writeFileSafe(file, text) {
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text, { flag: 'wx' });
  try {
    renameSync(tmp, file);
  } catch (e) {
    try {
      unlinkSync(tmp);
    } catch { /* already gone */ }
    throw e;
  }
}

function walk(dir, prefix = '', out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), rel, out);
    } else if (e.isFile()) out.push(rel);
  }
  return out;
}

// UTF-16 text, from its byte-order mark: Windows PowerShell 5.1's `>` writes UTF-16LE. Its NUL bytes would
// otherwise make it look binary.
function utf16(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.subarray(2).toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) return Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  return null;
}

function readText(dir, rel) {
  try {
    const file = toNative(dir, rel);
    if (statSync(file).size > (outputDir(rel) ? MAX_OUTPUT_BYTES : MAX_FILE_BYTES)) return null;
    const buf = readFileSync(file);
    const wide = buf.length % 2 === 0 ? utf16(buf) : null;
    if (wide !== null) return wide.replace(/\r\n/g, '\n');
    if (buf.subarray(0, 8000).includes(0)) return null; // binary
    return buf.toString('utf8').replace(/\r\n/g, '\n');
  } catch {
    return null;
  }
}

function inGit(dir, run) {
  const r = run('git', ['rev-parse', '--show-toplevel'], { cwd: dir });
  return r.status === 0;
}

// Everything preflight needs to know about the project, read once.
export function loadProject(dir, run = exec) {
  const git = inGit(dir, run);
  let committable;
  if (git) {
    // Tracked files plus new files git would pick up: what the next commit and push can contain.
    const r = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: dir });
    committable = r.stdout.split('\0').filter(Boolean);
  } else {
    committable = walk(dir).filter((rel) => !ENV_FILE.test(rel) || ENV_EXAMPLE.test(rel));
  }
  const ours = new Set([REPORT_JSON, REPORT_MD]);
  committable = committable.filter((rel) => !ours.has(rel) && !rel.split('/').some((p) => SKIP_DIRS.has(p)));

  const output = [];
  for (const out of OUTPUT_DIRS) {
    const abs = toNative(dir, out);
    if (existsSync(abs)) {
      output.push(...walk(abs, out));
      if (existsSync(path.join(abs, '.git'))) output.push(`${out}/.git`);
    }
  }

  const scan = [...new Set([...committable, ...output.filter((r) => !r.endsWith('/.git'))])].sort();
  const texts = new Map();
  for (const rel of scan) {
    const t = readText(dir, rel);
    if (t !== null) texts.set(rel, t);
  }

  // Env files are read from disk even when ignored, for SEC-04's value check; they're never scanned by SEC-01.
  const envFiles = walk(dir).filter((rel) => ENV_FILE.test(rel));
  const env = new Map();
  for (const rel of envFiles) {
    const t = readText(dir, rel);
    if (t !== null) env.set(rel, t);
  }

  return { dir, git, committable: new Set(committable), output, texts, env, stack: detectStack(dir, texts) };
}

function readJson(dir, rel) {
  try {
    return JSON.parse(readFileSync(toNative(dir, rel), 'utf8'));
  } catch {
    return null;
  }
}

// Packages that take a provider's API key. The Vercel AI SDK's core (`ai`) and its UI hooks (@ai-sdk/react) aren't
// here: they run in the browser on purpose and call your own route, so they hold no key. Its provider packages do.
export const AI_PACKAGES = ['openai', '@anthropic-ai/sdk', '@google/generative-ai', '@google/genai', 'groq-sdk',
  '@mistralai/mistralai', 'cohere-ai', 'replicate', '@ai-sdk/openai', '@ai-sdk/anthropic', '@ai-sdk/google',
  '@ai-sdk/xai', '@ai-sdk/deepseek', '@ai-sdk/mistral', '@ai-sdk/groq', '@openrouter/ai-sdk-provider', '@openrouter/sdk'];
export const AI_PY_PACKAGES = ['openai', 'anthropic', 'google-generativeai', 'google-genai', 'groq', 'mistralai', 'cohere',
  'replicate', 'xai-sdk'];

function detectStack(dir, texts = new Map()) {
  const pkg = readJson(dir, 'package.json');
  const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};
  const has = (name) => Object.hasOwn(deps, name);
  const py = ['requirements.txt', 'pyproject.toml', 'Pipfile'].filter((f) => existsSync(toNative(dir, f)));
  const pyText = py.map((f) => readText(dir, f) ?? '').join('\n').toLowerCase();

  const frameworks = [];
  for (const [name, dep] of [['next', 'next'], ['vite', 'vite'], ['create-react-app', 'react-scripts'], ['expo', 'expo'],
    ['sveltekit', '@sveltejs/kit'], ['nuxt', 'nuxt'], ['express', 'express'], ['fastify', 'fastify'], ['hono', 'hono']]) {
    if (has(dep)) frameworks.push(name);
  }
  for (const name of ['django', 'flask', 'fastapi']) if (new RegExp(`^\\s*${name}\\b`, 'm').test(pyText)) frameworks.push(name);

  const lockfiles = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb',
    'poetry.lock', 'uv.lock', 'pdm.lock', 'Pipfile.lock'].filter((f) => existsSync(toNative(dir, f)));

  const aiSdk = AI_PACKAGES.some(has) || has('ai') || AI_PY_PACKAGES.some((p) => new RegExp(`^\\s*${p}\\b`, 'm').test(pyText));
  // Only client-only frameworks: there, everything under src/ ends up in the browser.
  const clientOnly = (frameworks.includes('vite') || frameworks.includes('create-react-app') || frameworks.includes('expo'))
    && !frameworks.some((f) => ['next', 'sveltekit', 'nuxt', 'express', 'fastify', 'hono'].includes(f));

  return {
    node: Boolean(pkg),
    python: py.length > 0,
    pythonFiles: py,
    frameworks,
    lockfiles,
    aiSdk,
    clientOnly,
    scripts: pkg?.scripts ?? {},
    readsEnv: [...texts].some(([rel, t]) => CODE_EXT.test(rel) && /process\.env\b|import\.meta\.env\b|os\.environ|os\.getenv|Deno\.env/.test(t)),
  };
}
