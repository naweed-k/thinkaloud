// Secret shapes for SEC-01, SEC-03 and SEC-04. The one list; test/preflight.test.mjs
// checks each entry against a generated sample. Order matters: the first match on a line wins, so the more
// specific shapes (Anthropic) come before the looser ones (OpenAI).
//
// This folder is also copied into every workspace as skills/preflight/scripts/, so it imports only node:
// built-ins and its own siblings.

import { createHash } from 'node:crypto';

export const KEY_PATTERNS = [
  { name: 'Anthropic API key', re: /\bsk-ant-[A-Za-z0-9_-]{20,}/ },
  // Shapes from gitleaks and trufflehog (checked 13 Oct 2026). OpenRouter and DeepSeek keys
  // also start with sk-, so they come before OpenAI.
  { name: 'OpenRouter API key', re: /\bsk-or-v1-[0-9a-f]{64}\b/ },
  { name: 'DeepSeek API key', re: /\bsk-[0-9a-f]{32}\b/ },
  // A project, service-account or admin key, or any sk- key with OpenAI's marker (T3BlbkFJ, "OpenAI" in base64).
  // A bare `sk-` and a long word isn't enough: CSS classes like sk-loading-spinner-container look like that.
  { name: 'OpenAI API key', re: /\bsk-(?:(?:proj|svcacct|admin)-[A-Za-z0-9_-]{40,}|[A-Za-z0-9_-]{8,}T3BlbkFJ[A-Za-z0-9_-]{8,})/ },
  { name: 'xAI API key', re: /\bxai-[0-9A-Za-z_]{80}\b/ },
  { name: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { name: 'AWS access key ID', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: 'AWS secret access key', re: /aws_secret_access_key\s*[:=]\s*['"]?[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/i },
  { name: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/ },
  { name: 'Stripe live key', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b/ },
  // Test keys can't move money, but they still belong in .env, so they warn instead of failing.
  { name: 'Stripe test key', re: /\b(?:sk|rk)_test_[A-Za-z0-9]{16,}\b/, severity: 'warn' },
  { name: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/ },
  // Webhook URLs are keys too: whoever has one can post as your app. These six shapes were checked against gitleaks
  // and trufflehog on 21 Oct 2026. Google doesn't publish the length of a GOCSPX- secret, so it's a range.
  { name: 'Slack webhook URL', re: /\bhooks\.slack\.com\/(?:services\/T[A-Z0-9]{8,12}\/B[A-Z0-9]{8,12}\/[A-Za-z0-9]{23,25}|workflows\/T[A-Z0-9]{8,12}\/A[A-Z0-9]{8,12}\/[0-9]{17,19}\/[A-Za-z0-9]{23,25}|triggers\/[A-Za-z0-9+/]{43,56})\b/ },
  { name: 'Discord webhook URL', re: /\b(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d{17,20}\/[A-Za-z0-9_-]{60,}/ },
  { name: 'Telegram bot token', re: /(?<![0-9])[0-9]{8,10}:A[A-Za-z0-9_-]{34}(?![A-Za-z0-9_-])/ },
  { name: 'Google OAuth client secret', re: /\bGOCSPX-[A-Za-z0-9_-]{24,40}(?![A-Za-z0-9_-])/ },
  // The upper-case letter rules out snake_case names that happen to start re_.
  { name: 'Resend API key', re: /\bre_(?=[A-Za-z0-9_]*[A-Z])[A-Za-z0-9]{8}_[A-Za-z0-9]{20,}\b/ },
  { name: 'Perplexity API key', re: /\bpplx-[A-Za-z0-9]{40,}\b/ },
  // Supabase's secret keys skip every row-level security rule, so they must never leave the server. The new
  // format is sb_secret_…; the legacy one is a JWT whose payload says "role": "service_role". Anon and
  // publishable keys are meant to be public and aren't flagged.
  { name: 'Supabase secret key', re: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: 'Supabase service-role key', re: /\beyJ[A-Za-z0-9_-]{10,}\.(eyJ[A-Za-z0-9_-]{10,})\.[A-Za-z0-9_-]{10,}/, ignore: (m) => !isServiceRole(m[1]) },
  { name: 'Hugging Face token', re: /\bhf_[A-Za-z]{34,}\b/ },
  { name: 'Groq API key', re: /\bgsk_[A-Za-z0-9]{48,}\b/ },
  { name: 'Replicate API token', re: /\br8_[A-Za-z0-9]{30,}\b/ },
  { name: 'SendGrid API key', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/ },
  // Twilio writes the 32 hex digits in lower case. Allowing upper case too matched hashes that happen to start "SK".
  { name: 'Twilio API key', re: /\bSK[0-9a-f]{32}\b/ },
  { name: 'npm access token', re: /\bnpm_[A-Za-z0-9]{36}\b/ },
  { name: 'private key', re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/ },
  {
    name: 'connection string with a password',
    re: /\b(?:postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|amqps?|mssql):\/\/[^\s:@/'"]+:([^\s@/'"]+)@([^\s/:'"]+)/,
    // Local development strings and template placeholders aren't leaks.
    ignore: (m) => isPlaceholder(m[1]) || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|db|database|postgres|mysql|redis|mongo)$/i.test(m[2]),
  },
];

// `password = "..."`-style literals. Well-known defaults (admin, changeme…) are CFG-04 instead. The name can have a
// prefix (OPENAI_API_KEY, STRIPE_SECRET_KEY), but not run on into a longer word (apiKeyName).
const PASSWORD_LITERAL = /(?:^|[^a-z0-9])(?:password|passwd|pwd|secret(?:_?key)?|client_secret|api_?key|auth_?token|access_token)\b['"]?\s*[:=]\s*['"]([^'"\s]{8,})['"]/i;

// Translation files, where `password` is a label: a locale folder, or gettext's .po and .pot.
export const LOCALE_FILE = /(^|\/)(locales?|i18n|lang|translations)\/|\.pot?$/i;

export const DEFAULT_PASSWORDS = ['admin', 'admin123', 'password', 'password1', 'password123', '123456', '12345678',
  'changeme', 'secret', 'letmein', 'qwerty', 'root', 'toor', 'test', 'default', 'pass'];

export function isPlaceholder(value) {
  const v = value.trim();
  if (!v) return true;
  if (/^(<.*>|\$\{.*\}|\{\{.*\}\}|%\(.*\)s|\$[A-Z_]+|[x*.]+|\.{3})$/i.test(v)) return true;
  if (/your|example|placeholder|dummy|sample|redacted|replace|xxxx|…|process\.env|os\.environ|getenv/i.test(v)) return true;
  return DEFAULT_PASSWORDS.includes(v.toLowerCase());
}

// Does a JWT's payload (base64url) claim the service_role? Malformed payloads don't.
function isServiceRole(payload) {
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))?.role === 'service_role';
  } catch {
    return false;
  }
}

// A short, one-way reference to a secret, so an accepted risk can name *this* key without copying it.
// A different key in the same file gets a different reference, so it isn't accepted by mistake.
export function fingerprint(secret) {
  return createHash('sha256').update(String(secret)).digest('hex').slice(0, 8);
}

// Finds the first secret on a line. Returns { name, match, severity } or null. Password literals only when asked,
// because they're too noisy for history scans.
export function findSecret(line, { literals = false } = {}) {
  for (const p of KEY_PATTERNS) {
    const m = line.match(p.re);
    if (m && !(p.ignore && p.ignore(m))) return { name: p.name, match: m[0], severity: p.severity ?? 'fail' };
  }
  if (literals) {
    const m = line.match(PASSWORD_LITERAL);
    if (m && !isPlaceholder(m[1])) return { name: 'hard-coded password or key', match: m[1], severity: 'fail' };
  }
  return null;
}

// Never copy a secret into a report: keep the first 4 characters as a hint, hide the rest.
export function redact(secret) {
  const s = String(secret);
  return s.length <= 8 ? '****' : `${s.slice(0, 4)}…(${s.length - 4} more characters hidden)`;
}
