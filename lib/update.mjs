// `thinkaloud update [folder]`: replace the tool-owned files, never the person's: their memory and rules are
// the point of the workspace, and an edited Thinkaloud file is kept as .mine.

import path from 'node:path';
import { parseTools } from './detect.mjs';
import { applyFiles, compareVersions, INSTALL_CMD, packageVersion, PKG_ROOT, printReport, readManifest, recordPacks } from './install.mjs';
import { PACK_VERSIONS, planInstalls, runInstalls } from './packs.mjs';

export const UPDATE_OPTIONS = {
  tools: { type: 'string' },
  'with-design': { type: 'boolean' },
  'with-uiux': { type: 'boolean' },
  'with-browser': { type: 'boolean' },
};

// Packs to (re)install: missing ones (core is always wanted), ones whose pin moved, and all of them when
// the tools changed, so each tool gets its copies.
function packsToInstall(recorded, wanted, toolsChanged) {
  return [...new Set(['core', ...Object.keys(recorded), ...wanted])]
    .filter((p) => toolsChanged || recorded[p] !== PACK_VERSIONS[p]);
}

export function notAWorkspace(ws, err) {
  err.write(`thinkaloud: ${ws} isn't a Thinkaloud workspace (there's no .thinkaloud/manifest.json).\n`
    + `Run this inside your workspace folder, or create one with: ${INSTALL_CMD} init\n`);
}

export function update(values, positionals, out = process.stdout, err = process.stderr) {
  const ws = path.resolve(positionals[0] ?? '.');
  const manifest = readManifest(ws);
  if (!manifest) {
    notAWorkspace(ws, err);
    return 1;
  }
  let tools = Array.isArray(manifest.tools) ? manifest.tools : [];
  if (values.tools !== undefined) {
    const parsed = parseTools(values.tools);
    if (parsed.error) {
      err.write(`thinkaloud: ${parsed.error}\n`);
      return 2;
    }
    tools = parsed.tools;
  }

  const from = manifest.version ?? 'unknown';
  const to = packageVersion(PKG_ROOT);
  // An older copy of Thinkaloud (an old global install, or a cached npx) would put older files back.
  if (compareVersions(from, to) === 1) {
    err.write(`thinkaloud: this workspace already has Thinkaloud ${from}, and you're running ${to}, which is older. `
      + `Nothing was changed. Run the latest instead: ${INSTALL_CMD} update\n`);
    return 1;
  }
  if (Object.keys(manifest.pending).length) out.write('The last update didn\'t finish. This one completes it.\n');
  const report = applyFiles(ws, PKG_ROOT, tools, manifest);
  const changed = report.added.length + report.updated.length + report.removed.length + report.kept.length;

  out.write(from === to ? `Thinkaloud ${to}.\n` : `Updated Thinkaloud from ${from} to ${to}.\n`);
  out.write(`Set up for: ${tools.length ? tools.join(', ') : 'any agent that reads AGENTS.md'}.\n`);
  if (!changed && !report.warnings.length) out.write('Everything was already up to date.\n');
  printReport(report, out);

  const toolsChanged = [...tools].sort().join() !== [...(manifest.tools ?? [])].sort().join();
  const wanted = ['design', 'uiux', 'browser'].filter((p) => values[`with-${p}`]);
  const steps = planInstalls(tools, packsToInstall(manifest.packs ?? {}, wanted, toolsChanged));
  if (steps.length) {
    out.write('Third-party skills:\n');
    recordPacks(ws, runInstalls(steps, ws, out), PACK_VERSIONS);
  }
  out.write('Never overwritten: MY-RULES.md, memory/, projects/ and learn/ (those are yours; a missing starter file is re-created).\n');
  return 0;
}
