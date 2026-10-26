// Finds commands on PATH without running them, so detection is fast and has no side effects.

import { spawnSync } from 'node:child_process';
import { accessSync, constants, statSync } from 'node:fs';
import path from 'node:path';
import { AGENT_TOOLS, toolById } from './tools.mjs';

function isExecutable(file, platform) {
  try {
    if (!statSync(file).isFile()) return false;
    if (platform !== 'win32') accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

// Returns the full path of `cmd` on PATH, or null. On Windows it tries each PATHEXT extension
// (npm installs `.cmd` shims; native installs are `.exe`). Relative PATH entries ('.') are skipped: they'd mean
// whatever folder Thinkaloud runs in.
export function findOnPath(cmd, env = process.env, platform = process.platform) {
  const pathVar = env.PATH ?? env.Path ?? '';
  const exts = platform === 'win32'
    ? (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
    : [''];
  const sep = platform === 'win32' ? ';' : ':';
  const isAbs = platform === 'win32' ? path.win32.isAbsolute : path.posix.isAbsolute;
  for (const dir of pathVar.split(sep).filter((d) => d && isAbs(d))) {
    for (const ext of exts) {
      const file = path.join(dir, cmd + ext);
      if (isExecutable(file, platform)) return file;
    }
  }
  return null;
}

// Runs a command found on PATH, by its full path. On Windows, cmd.exe looks in the current folder before PATH,
// so a program saved in the workspace under the same name would run instead; the full path and
// NoDefaultCurrentDirectoryInExePath (for the lookups inside npm's own .cmd files) stop that. `.cmd` and `.bat`
// files need cmd.exe; every argument passed here is a constant, never text from a file.
export function spawnTool(cmd, args, options = {}) {
  const file = findOnPath(cmd);
  if (!file) return { status: null, stdout: '', stderr: '', error: Object.assign(new Error(`${cmd} isn't installed (or isn't on PATH)`), { code: 'ENOENT' }) };
  const shell = process.platform === 'win32' && /\.(cmd|bat)$/i.test(file);
  return spawnSync(shell ? `"${file}"` : file, args, {
    encoding: 'utf8',
    windowsHide: true,
    ...options,
    shell,
    env: { ...process.env, ...options.env, NoDefaultCurrentDirectoryInExePath: '1' },
  });
}

export function detectTools(env, platform) {
  return AGENT_TOOLS.filter((t) => findOnPath(toolById(t).command, env, platform));
}

// Parses "--tools=claude,antigravity" (or "none"). Returns { tools } or { error }.
export function parseTools(value) {
  const names = value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (names.length === 1 && names[0] === 'none') return { tools: [] };
  if (names.includes('gemini')) {
    return { error: 'Gemini CLI no longer lets personal Google accounts sign in; Google replaced it with Antigravity CLI. Use antigravity instead.' };
  }
  const unknown = names.filter((n) => !AGENT_TOOLS.includes(n));
  if (unknown.length) return { error: `unknown tool "${unknown.join(', ')}". Use ${AGENT_TOOLS.join(', ')} or none.` };
  return { tools: AGENT_TOOLS.filter((t) => names.includes(t)) };
}
