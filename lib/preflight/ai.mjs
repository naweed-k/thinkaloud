// AI-01, AI-02: AI keys that reach the browser, and AI routes anyone can call.

import { AI_PACKAGES, AI_PY_PACKAGES } from './files.mjs';

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const JS_SDK = new RegExp(`(?:from\\s+|require\\(\\s*|import\\s*\\(?\\s*)['"](${AI_PACKAGES.map(esc).join('|')})(?:/[^'"]*)?['"]`);
const PY_SDK = new RegExp(`^\\s*(?:from|import)\\s+(${AI_PY_PACKAGES.map((p) => p.replace(/-/g, '[._]')).join('|')})\\b`, 'm');
const AI_URL = /https:\/\/(?:api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.groq\.com|api\.mistral\.ai|openrouter\.ai\/api|api\.x\.ai|api\.deepseek\.com)/;

const usesAi = (rel, text) => (/\.py$/.test(rel) ? PY_SDK.test(text) : JS_SDK.test(text)) || AI_URL.test(text);

function lineOf(text, re) {
  return text.split('\n').findIndex((l) => re.test(l)) + 1 || undefined;
}

// Code that ends up in the browser: 'use client' files, client-only apps' src/, static HTML and public/ scripts.
function isClient(rel, text, stack) {
  if (/^\s*['"]use client['"]/.test(text)) return true;
  if (/\.html$/.test(rel) || /^public\//.test(rel)) return true;
  if (/^(dist|build|out|\.output|\.next\/static)\//.test(rel)) return true;
  return stack.clientOnly && /^(src|app|components)\//.test(rel) && !/(^|\/)(server|api|functions|backend)\//.test(rel);
}

function isServerRoute(rel, text) {
  if (/(^|\/)pages\/api\/|(^|\/)app\/(.*\/)?route\.(m?[jt]s)$|^api\/|(^|\/)functions\//.test(rel)) return true;
  return /\b(app|router|server)\.(post|get|put|all|route)\s*\(|@(app|router)\.(post|get|put|route)\s*\(/.test(text);
}

// Signs of a login check or rate limit. "Authorization" headers don't count: calls to the AI API carry one.
const GUARDED = /requireAuth|isAuthenticated|getServerSession|getSession|\bauth\(\)|currentUser|getUser|requireUser|verifyToken|jwt\.verify|clerk|supabase\.auth|passport\.authenticate|login_required|Depends\(|rate.?limit|limiter|slowapi|throttle/i;

export function aiChecks(project) {
  const findings = [];
  for (const [rel, text] of project.texts) {
    const direct = /dangerouslyAllowBrowser\s*:\s*true/.test(text);
    if (!direct && !usesAi(rel, text)) continue;
    if (direct || isClient(rel, text, project.stack)) {
      findings.push({
        id: 'AI-01', severity: 'fail', file: rel,
        line: lineOf(text, direct ? /dangerouslyAllowBrowser/ : new RegExp(`${JS_SDK.source}|${AI_URL.source}`)),
        what: 'This code calls an AI API from the browser, so the API key goes to every visitor.',
        why: 'Anyone can open the browser tools, copy the key, and spend your credit, sometimes thousands in a day.',
        fix: 'Move the call to a server route (an API route or backend function) that reads the key from `.env`, '
          + 'and have the page call your route instead. Then rotate the key.',
      });
    } else if (isServerRoute(rel, text) && !GUARDED.test(text)) {
      findings.push({
        id: 'AI-02', severity: 'warn', file: rel,
        what: 'This server route calls an AI API, and there\'s no sign of a login check or rate limit in it.',
        why: 'If anyone can call it, anyone can spend your AI credit through it. The check may live elsewhere '
          + '(middleware, the host), so the AI review looks at it next.',
        fix: 'Require a logged-in user, add a rate limit (per user or IP), and set a monthly spend cap in the provider\'s dashboard.',
      });
    }
  }
  return findings;
}
