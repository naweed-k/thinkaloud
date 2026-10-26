// Third-party install plans (S6): pure checks, no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BROWSER, CORE, DESIGN, planInstalls, runInstalls, THIRD_PARTY_SKILLS, UIUX } from '../lib/packs.mjs';
import { SKILLS } from '../lib/workspace.mjs';

test('no third-party skill has a companion skill\'s name', () => {
  const ours = new Set(SKILLS);
  for (const name of THIRD_PARTY_SKILLS) assert.ok(!ours.has(name), name);
});

test('every install is pinned to an exact version', () => {
  const exact = /@\d+\.\d+\.\d+$/;
  assert.match(CORE.tag, /^\d+\.\d+\.\d+$/);
  assert.match(CORE.ref, /^[0-9a-f]{40}$/, 'agent-skills is pinned to a commit, not a tag');
  for (const pkg of [CORE.cli, DESIGN.impeccable, UIUX.cli, BROWSER.cli]) assert.match(pkg, exact, pkg);
  for (const step of planInstalls(['claude', 'codex', 'antigravity'], ['core', 'design', 'uiux', 'browser'])) {
    assert.ok(!step.args.some((a) => /@latest\b/.test(a)), step.label);
  }
});

test('ui-ux-pro-max runs for Antigravity only when Codex isn\'t there to share .agents/skills', () => {
  const ai = (tools) => planInstalls(tools, ['uiux']).filter((s) => s.args.includes('--ai')).map((s) => s.args.at(-1));
  assert.deepEqual(ai(['antigravity']), ['antigravity']);
  assert.deepEqual(ai(['codex', 'antigravity']), ['codex']);
});

test('runInstalls keeps going after a failure and returns only the packs that fully worked', () => {
  const steps = planInstalls(['claude'], ['core', 'design', 'uiux']);
  let out = '';
  const writer = { write: (s) => { out += s; } };
  const done = runInstalls(steps, '.', writer, (step) => ({ ok: !step.label.startsWith('impeccable'), detail: 'network down' }));
  assert.deepEqual(done, ['core', 'uiux']);
  assert.match(out, /impeccable .*didn't work\.\n {4}network down\n/);
  assert.match(out, /ui-ux-pro-max for claude .*done\./, 'later steps still ran');
});

test('--with-design is impeccable only; ui-ux-pro-max is its own pack', () => {
  const design = planInstalls(['claude'], ['design']);
  assert.deepEqual(design.map((st) => st.args[1]), [DESIGN.impeccable]);
  assert.ok(planInstalls(['claude'], ['uiux']).every((st) => st.pack === 'uiux' && st.args[1] === UIUX.cli));
});
