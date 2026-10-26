// Strictness, accepted risks, and the two reports: preflight-report.json (for the skill) and PREFLIGHT.md (for people).

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const LIMIT = 'Preflight catches common, serious mistakes. It is not a security audit and passing it doesn\'t mean '
  + 'the app is safe. For anything handling payments or sensitive personal data, get a human review too.';

export const STRICTNESS = ['personal', 'small', 'public'];

// What blocks going live at each level. A personal project risks only the owner, so only leaked keys block it.
const BLOCKS = {
  personal: ['secrets'],
  small: ['secrets', 'deps', 'auth'],
  public: ['secrets', 'deps', 'auth', 'config'],
};

// AI-01 is a key in the browser, so it counts as a secret.
function category(id) {
  if (id.startsWith('SEC-') || id === 'AI-01') return 'secrets';
  if (id.startsWith('DEP-')) return 'deps';
  if (id.startsWith('AI-')) return 'auth';
  return 'config';
}

function readIf(file) {
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  } catch {
    return null;
  }
}

// --strictness, else `Audience:` in the project's PLAN.md, else build.audience in the workspace profile,
// else public ("not sure" counts as public). When the level in use is lower than the profile's, `lowered` says so,
// because a lower level means fewer things block, and that should never happen quietly.
export function resolveStrictness(dir, flag) {
  const profile = readIf(path.join(dir, '..', '..', 'memory', 'profile.md'))?.match(/^\s*audience:\s*(personal|small|public)\b/m)?.[1];
  const pick = () => {
    if (flag) return { level: flag, from: '--strictness' };
    const plan = readIf(path.join(dir, 'PLAN.md'))?.match(/^Audience:\s*`?(personal|small|public)\b/im);
    if (plan) return { level: plan[1].toLowerCase(), from: 'PLAN.md' };
    if (profile) return { level: profile, from: 'memory/profile.md' };
    return { level: 'public', from: 'default' };
  };
  const s = pick();
  return profile && STRICTNESS.indexOf(s.level) < STRICTNESS.indexOf(profile) ? { ...s, lowered: profile } : s;
}

// Risks the person accepted, from decision cards in DECISIONS.md. An acceptance counts only when it's a line
// `Accepts: <ID> <file> [ref]` inside a card that has a date in its heading (`## D3 · 2026-10-02 · …`) and a
// `Chosen:` or `Reason:` line. Anything else is returned in `ignored`, with why, so the report can show it.
export function acceptedRisks(dir) {
  const text = (readIf(path.join(dir, 'DECISIONS.md')) ?? '').replace(/\r\n/g, '\n').replace(/<!--[\s\S]*?-->/g, '');
  const accepted = [];
  const ignored = [];
  for (const card of text.split(/^(?=## )/m)) {
    const heading = card.match(/^##\s+(D\d+)\s*[·|–-]\s*(\d{4}-\d{2}-\d{2})\s*[·|–-]\s*(.+)$/m);
    const reason = /^(?:Chosen|Reason):\s*\S/m.test(card);
    for (const m of card.matchAll(/^Accepts:(.*)$/gm)) {
      const [id, file, ref] = m[1].trim().split(/\s+/).map((s) => s.replace(/^`|`$/g, ''));
      const line = m[0].trim();
      if (!/^[A-Z]{2,3}-\d{2}$/.test(id ?? '')) ignored.push({ line, why: 'it doesn\'t start with a finding ID like SEC-01' });
      else if (!file) ignored.push({ line, why: 'it doesn\'t name the file, so it would accept every finding with that ID, including new ones' });
      else if (!heading) ignored.push({ line, why: 'it isn\'t inside a dated decision card (## D1 · 2026-10-02 · …)' });
      else if (!reason) ignored.push({ line, why: 'its decision card has no `Chosen:` or `Reason:` line saying why' });
      else accepted.push({ id, file, ref, decision: heading[1], date: heading[2], title: heading[3].trim() });
    }
  }
  return { accepted, ignored };
}

// Does this acceptance cover this finding? The file must match, and when the finding has a ref (a secret's
// fingerprint, a package name) the acceptance must name it too, so a new key or package isn't accepted in advance.
function covers(a, f) {
  return a.id === f.id && a.file === f.file && (!f.ref || a.ref === f.ref);
}

const ORDER = { fail: 0, warn: 1, info: 2 };

export function buildReport({ findings, strictness, stack, project, date, checked = null, accepted = { accepted: [], ignored: [] } }) {
  const blocks = BLOCKS[strictness.level];
  const list = findings.map((f) => {
    const by = accepted.accepted.find((a) => covers(a, f));
    const status = by ? 'accepted' : 'open';
    return {
      ...f,
      status,
      ...(by ? { acceptedBy: `${by.decision} · ${by.date} · ${by.title}` } : {}),
      blocking: status === 'open' && f.severity === 'fail' && blocks.includes(category(f.id)),
    };
  }).sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.id.localeCompare(b.id) || String(a.file).localeCompare(String(b.file)));
  const count = (fn) => list.filter(fn).length;
  const summary = {
    fail: count((f) => f.severity === 'fail' && f.status === 'open'),
    warn: count((f) => f.severity === 'warn' && f.status === 'open'),
    info: count((f) => f.severity === 'info'),
    accepted: count((f) => f.status === 'accepted'),
    blocking: count((f) => f.blocking),
  };
  return {
    tool: 'thinkaloud-preflight',
    reportVersion: 1,
    date,
    project,
    strictness: strictness.level,
    strictnessFrom: strictness.from,
    ...(strictness.lowered ? { strictnessLowered: strictness.lowered } : {}),
    stage: 'script',
    ready: summary.blocking === 0,
    summary,
    stack,
    ...(checked ? { checked } : {}),
    limit: LIMIT,
    findings: list,
    ignoredAcceptances: accepted.ignored,
  };
}

const ICON = { fail: '✗', warn: '!', info: 'i' };
const where = (f) => (f.file ? ` · \`${f.file}${f.line ? `:${f.line}` : ''}\`` : '');

function section(title, items) {
  if (!items.length) return [];
  const out = [`## ${title}`, ''];
  for (const f of items) {
    const ref = f.ref ? ` · ref \`${f.ref}\`` : '';
    out.push(`### ${ICON[f.severity]} ${f.id}${where(f)}${ref}${f.blocking ? ' · **blocks going live**' : ''}`, '');
    if (f.acceptedBy) out.push(`- **Accepted in:** ${f.acceptedBy}`);
    out.push(`- **What:** ${f.what}`, `- **Why it matters:** ${f.why}`, `- **Fix:** ${f.fix}`, '');
  }
  return out;
}

function lowered(r) {
  if (!r.strictnessLowered) return [];
  const want = r.strictnessLowered;
  return [`**Strictness is lower than your profile's.** It's \`${r.strictness}\` (from ${r.strictnessFrom}), but your profile `
    + `says \`${want}\`, so fewer things block. If that isn't what you decided, set \`Audience: ${want}\` in PLAN.md.`, ''];
}

function lookedAt(r) {
  const c = r.checked;
  if (!c) return [];
  const parts = [
    `${c.files} file${c.files === 1 ? '' : 's'}`,
    c.history ? 'the git history' : 'no git history (not a git repository)',
    c.dependencies.length ? `dependencies (${c.dependencies.join(', ')})` : 'no dependency audit (nothing preflight can audit)',
  ];
  return [`Looked at: ${parts.join(' · ')}.`, ''];
}

function ignoredLines(r) {
  if (!r.ignoredAcceptances?.length) return [];
  return ['## Ignored `Accepts:` lines', '', 'These lines in DECISIONS.md don\'t count, so what they name still shows as open:', '',
    ...r.ignoredAcceptances.map((i) => `- \`${i.line}\`: ${i.why}.`), ''];
}

export function renderMarkdown(r) {
  const s = r.summary;
  const verdict = r.ready
    ? `**No blocking fails at \`${r.strictness}\` strictness.** The AI review comes next; it isn't ready to go live until that's done too.`
    : `**Not ready to go live:** ${s.blocking} fail${s.blocking === 1 ? '' : 's'} block${s.blocking === 1 ? 's' : ''} it at \`${r.strictness}\` strictness.`;
  const open = r.findings.filter((f) => f.status === 'open');
  return [
    `# Preflight: ${r.project}`,
    '',
    `${r.date} · strictness \`${r.strictness}\` (from ${r.strictnessFrom}) · ${s.fail} fail · ${s.warn} warn · ${s.info} info`
      + (s.accepted ? ` · ${s.accepted} accepted` : ''),
    '',
    verdict,
    '',
    ...lowered(r),
    ...lookedAt(r),
    `> ${r.limit}`,
    '',
    ...(r.findings.length ? [] : ['The script found nothing. The AI review still looks at what a script can\'t judge.', '']),
    // Accepted risks come first: waiving a check should be the most visible thing in the report.
    ...section('Accepted risks (see DECISIONS.md)', r.findings.filter((f) => f.status === 'accepted')),
    ...ignoredLines(r),
    ...section('Fails', open.filter((f) => f.severity === 'fail')),
    ...section('Warnings', open.filter((f) => f.severity === 'warn')),
    ...section('For information', open.filter((f) => f.severity === 'info')),
    '---',
    'Made by `thinkaloud preflight` (stage 1, the script). Run it again after each fix. Say `preflight` to your companion for stage 2, the AI review.',
    '',
  ].join('\n');
}
