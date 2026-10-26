# Credits

Thinkaloud builds on other people's work. No tool below is bundled: each one is installed from its own source at
a pinned version, or used only if it's already on your computer. The pins live in `lib/packs.mjs`.

## Installed by `init` and `update`

| What | Source | Used for | Licence |
|---|---|---|---|
| **agent-skills**, especially `using-agent-skills` | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) (Addy Osmani), tag `0.6.10`, pinned to commit `c004a74` | the engineering skills the companion hands work to: planning, incremental build, test-driven development, debugging, review, security | MIT |
| **skills** CLI | [vercel-labs/skills](https://github.com/vercel-labs/skills) (Vercel), `skills@1.7.0` | installs agent-skills into each tool's skills folder | MIT |

## Optional packs

| What | Source | Added with | Licence |
|---|---|---|---|
| **impeccable** | [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Paul Bakaus), `impeccable@4.1.0` | `--with-design`: better-looking interfaces | Apache-2.0 |
| **ui-ux-pro-max** | [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (Next Level Builder), `ui-ux-pro-max-cli@2.15.0` | `--with-uiux`: styles, palettes and design systems | MIT |
| **Playwright CLI** | [microsoft/playwright-cli](https://github.com/microsoft/playwright-cli) (Microsoft), `@playwright/cli@0.1.21` | `--with-browser`: lets your AI open web pages | Apache-2.0 |

## Used by `preflight` if you have them

Preflight never installs these. It uses them when they're on your PATH, and otherwise falls back to its own scan
or says how to get them.

| What | Source | Used for | Licence |
|---|---|---|---|
| **gitleaks** | [gitleaks/gitleaks](https://github.com/gitleaks/gitleaks) (Zachary Rice and contributors) | a deeper scan of git history for keys | MIT |
| **pip-audit** | [pypa/pip-audit](https://github.com/pypa/pip-audit) (PyPA, Trail of Bits) | known vulnerabilities in pinned Python requirements | Apache-2.0 |
| **osv-scanner** | [google/osv-scanner](https://github.com/google/osv-scanner) (Google) | known vulnerabilities across languages | Apache-2.0 |

## Ideas

- **The behaviour rules and the ten AI patterns** come from Naweed Kabir's essay [*Checkable
  Reasoning*](https://naweedkabir.com/research/checkable-reasoning/): the ten evidence rules, the pattern names and `guide/ai-patterns.md`.
- **The learning methods** in `learn` (retrieval practice, spaced practice, mixing topics, worked examples and
  explaining in your own words) come from learning-science research. A readable overview, free to read: Yana
  Weinstein, Christopher Madan and Megan Sumeracki, "Teaching the science of learning", *Cognitive Research:
  Principles and Implications* 3 (2018), [doi:10.1186/s41235-017-0087-y](https://doi.org/10.1186/s41235-017-0087-y).
- **Agent Skills** (`SKILL.md`), the open format the workspace skills and the chat skill use:
  [agentskills.io](https://agentskills.io).

## In this repo only

The README banner (`.github/assets/`, not part of the npm package) embeds two fonts, as the SIL Open Font
Licence 1.1 allows: [Bricolage Grotesque](https://github.com/ateliertriay/bricolage) (The Bricolage Grotesque
Project Authors) and [DM Sans](https://github.com/googlefonts/dm-fonts) (The DM Sans Project Authors).
