// `thinkaloud budget [folder]`: the workspace's fixed token cost, and how to check usage in each tool
// It can't read plan limits itself: only the tools can, so it points to them.

import path from 'node:path';
import { writeBudgets } from './doctor.mjs';
import { readManifest } from './install.mjs';
import { USAGE } from './tools.mjs';
import { LEFT } from './usage.mjs';

export function budget(values, positionals, out = process.stdout) {
  const ws = path.resolve(positionals[0] ?? '.');
  const manifest = readManifest(ws);
  const tools = Array.isArray(manifest?.tools) ? manifest.tools : [];

  if (manifest) {
    const notes = writeBudgets(ws, tools, manifest.packs ?? {}, out);
    for (const n of notes) out.write(`note ${n}\n`);
  } else {
    out.write(`${ws} isn't a Thinkaloud workspace, so there are no budgets to measure here.\n`);
  }

  // Tools set up here first; outside a workspace (or with none), all of them.
  const shown = tools.length ? USAGE.filter((u) => tools.includes(u.tool)) : USAGE;
  out.write('\nCheck how much usage you have left (inside the tool):\n');
  for (const u of shown) {
    out.write(`  ${u.name}: ${u.usage}  (${u.usageNote})\n`);
    out.write(`    context: ${u.context}  (${u.contextNote})\n`);
    out.write(`    also: ${u.extra}\n`);
  }
  out.write('\nThen, with what is left:\n');
  const width = Math.max(...LEFT.map(([left]) => left.length));
  for (const [left, todo] of LEFT) out.write(`  ${left.padEnd(width)}  ${todo}\n`);
  out.write('\nMore in guide/usage.md. Your companion can do this with you: say "budget".\n');
  return 0;
}
