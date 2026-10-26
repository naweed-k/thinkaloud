// CFG-01 … CFG-04: debug mode, open CORS with credentials, source maps or .git in the deploy, default logins.

import { CODE_EXT, ENV_FILE } from './files.mjs';
import { DEFAULT_PASSWORDS, LOCALE_FILE } from './patterns.mjs';

function firstLine(text, re) {
  const i = text.split('\n').findIndex((l) => re.test(l));
  return i === -1 ? null : i + 1;
}

const DEBUG_RULES = [
  { test: (rel) => /\.py$/.test(rel), re: /^\s*DEBUG\s*=\s*True\b/, label: 'Django `DEBUG = True`' },
  { test: (rel) => /\.py$/.test(rel), re: /\.run\([^)]*\bdebug\s*=\s*True/, label: 'Flask `debug=True`' },
  { test: (rel) => /\.py$/.test(rel), re: /config\[['"]DEBUG['"]\]\s*=\s*True/, label: 'Flask `DEBUG = True`' },
  { test: (rel) => CODE_EXT.test(rel), re: /process\.env\.NODE_ENV\s*=\s*['"]development['"]/, label: '`NODE_ENV` forced to development' },
  { test: (rel) => /(^|\/)\.env\.production$/.test(rel), re: /^\s*NODE_ENV\s*=\s*['"]?development/, label: '`NODE_ENV=development` in the production env file' },
];

function debugOn(project) {
  const out = [];
  for (const [rel, text] of project.texts) {
    for (const rule of DEBUG_RULES) {
      if (!rule.test(rel)) continue;
      const line = firstLine(text, rule.re);
      if (!line) continue;
      out.push({
        id: 'CFG-01', severity: 'fail', file: rel, line,
        what: `Debug mode is switched on in code that ships: ${rule.label}.`,
        why: 'Debug pages show visitors your code, settings and sometimes secrets. Flask\'s debugger even lets them run code on your server.',
        fix: 'Read it from the environment instead, off by default: for example `DEBUG = os.environ.get("DEBUG") == "1"`, and never set it in production.',
      });
      break;
    }
  }
  const start = project.stack.scripts?.start ?? '';
  if (/NODE_ENV=development/.test(start)) {
    out.push({
      id: 'CFG-01', severity: 'fail', file: 'package.json',
      what: 'The `start` script forces `NODE_ENV=development`.',
      why: 'Most Node frameworks show detailed error pages and skip optimisations in development mode.',
      fix: 'Remove `NODE_ENV=development` from `start`; hosting platforms set `production` for you.',
    });
  }
  return out;
}

const ANY_ORIGIN = /origin\s*:\s*(['"]\*['"]|true\b)|Access-Control-Allow-Origin['"]?\s*[,:]\s*['"]\*['"]|allow_origins\s*=\s*\[\s*['"]\*['"]\s*\]|CORS_ALLOW_ALL_ORIGINS\s*=\s*True|CORS_ORIGIN_ALLOW_ALL\s*=\s*True/;
const CREDENTIALS = /credentials\s*:\s*true|Access-Control-Allow-Credentials['"]?\s*[,:]\s*['"]?true|allow_credentials\s*=\s*True|CORS_ALLOW_CREDENTIALS\s*=\s*True/;
// flask-cors allows every origin unless `origins=` narrows it.
const FLASK_OPEN = /\bCORS\(\s*app\s*,[^)]*supports_credentials\s*=\s*True/;

function openCors(project) {
  const out = [];
  for (const [rel, text] of project.texts) {
    if (!CODE_EXT.test(rel)) continue;
    let line = CREDENTIALS.test(text) ? firstLine(text, ANY_ORIGIN) : null;
    if (!line && !/origins\s*=/.test(text)) line = firstLine(text, FLASK_OPEN);
    if (!line) continue;
    out.push({
      id: 'CFG-02', severity: 'fail', file: rel, line,
      what: 'CORS lets any website call this server with the visitor\'s cookies or login.',
      why: 'A page on any site could then read or change your users\' data while they\'re logged in to yours.',
      fix: 'List the exact origins that may call it, e.g. `origin: ["https://myapp.com"]`. Keep `*` only for public, login-free APIs, and then without credentials.',
    });
  }
  return out;
}

function deployLeaks(project) {
  const out = [];
  const gitDirs = project.output.filter((r) => r.endsWith('/.git'));
  for (const rel of gitDirs) {
    out.push({
      id: 'CFG-03', severity: 'fail', file: rel,
      what: `There's a \`.git\` folder inside the deploy folder \`${rel.slice(0, -5)}\`.`,
      why: 'If it gets uploaded, anyone can download your whole repository, history and all, from the live site.',
      fix: 'Delete it from the output folder and make sure the build doesn\'t copy it there.',
    });
  }
  const maps = project.output.filter((r) => /\.(js|css)\.map$/.test(r));
  if (maps.length) {
    out.push({
      id: 'CFG-03', severity: 'warn', file: maps[0],
      what: `The build output has ${maps.length} source map${maps.length === 1 ? '' : 's'} (\`.map\` files).`,
      why: 'Source maps let anyone read your original code, comments included. That\'s fine for open-source projects, not for private ones.',
      fix: 'Turn them off for production builds (e.g. `build.sourcemap: false` in Vite), or don\'t upload `.map` files.',
    });
  }
  return out;
}

const DEFAULT_CRED = new RegExp(`\\b(password|passwd|pwd|pass)\\b['"]?\\s*[:=]\\s*['"](${DEFAULT_PASSWORDS.join('|')})['"]`, 'i');
const DEFAULT_ENV = new RegExp(`^\\s*[A-Z_]*(PASSWORD|PASS)\\s*=\\s*['"]?(${DEFAULT_PASSWORDS.join('|')})['"]?\\s*$`, 'i');

// `"password": "Password"` is a label (a translation, a form field), not a login. `password: 'password'` in code
// still is one, unless it's in a translation file, and so is `ADMIN_PASSWORD=password` in an env file.
function isLabel(m, rel) {
  return m[2].toLowerCase() === m[1].toLowerCase() && (m[2] !== m[1] || LOCALE_FILE.test(rel));
}

function defaultLogins(project) {
  const out = [];
  for (const [rel, text] of project.texts) {
    if (/(^|\/)(README|CHANGELOG)[^/]*$|\.md$/i.test(rel) || /(^|\/)(tests?|__tests__|spec)\//.test(rel) || /\.(test|spec)\./.test(rel)) continue;
    const re = ENV_FILE.test(rel) ? DEFAULT_ENV : DEFAULT_CRED;
    const lines = text.split('\n');
    const i = lines.findIndex((l) => {
      const m = l.match(re);
      return m && !(re === DEFAULT_CRED && isLabel(m, rel));
    });
    if (i === -1) continue;
    const line = i + 1;
    out.push({
      id: 'CFG-04', severity: 'fail', file: rel, line,
      what: `A well-known default password ("${lines[i].match(re)[2]}") is set here.`,
      why: 'Attackers try these first, automatically. If this account exists on the live app, it\'s an open door.',
      fix: 'Make the seed script read the password from `.env`, or generate a random one and print it once. Change it on any live copy.',
    });
  }
  return out;
}

export function configChecks(project) {
  return [...debugOn(project), ...openCors(project), ...deployLeaks(project), ...defaultLogins(project)];
}
