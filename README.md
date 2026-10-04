# Agent Skills for Typecho

**English** | [简体中文](README.zh-CN.md)

**Teach AI coding assistants to do Typecho development the right way.**

Agent Skills are portable bundles of instructions, checklists, and scripts that help AI assistants (Claude, Copilot, Codex, Cursor, Trae, etc.) understand Typecho's plugin/theme development patterns, hook system, database abstraction layer, and security baseline — instead of hallucinating APIs or writing outdated code.

> The structure of this skill set mirrors the official [WordPress/agent-skills](https://github.com/WordPress/agent-skills) layered design (router → triage → domain skills). All facts are sourced from the [Typecho official documentation](https://docs.typecho.org/) and the Typecho source code.

## Why Agent Skills?

AI coding assistants working on Typecho projects frequently:

- Mix the Typecho 1.1 underscore pseudo-namespace (`Typecho_Plugin`) with the 1.2+ namespaces (`\Typecho\Plugin`, canonical plugin namespace `TypechoPlugin\<Name>`)
- Add `use Typecho\Plugin;` in the plugin's main class file, where the short name `Plugin` collides with the plugin's own `class Plugin` — a fatal error
- Forget that a plugin must implement `Typecho_Plugin_Interface` and register hooks inside `activate()`
- Forget to unregister panels / actions / routes in `deactivate()`, leaving residue behind
- Concatenate raw SQL instead of using the `table.` prefix and the query builder's placeholders
- Omit `$this->header()` in themes, or output unescaped content in templates
- Be unaware of Typecho-specific mechanisms such as `is()` syntax, `themeFields`, dynamic properties (`___x`) / dynamic methods (`callX`)

Agent Skills package this expert knowledge in a form AI assistants can follow directly.

## Available Skills

| Skill | What it teaches |
|------|----------|
| **typecho-router** | Classify a Typecho codebase (plugin / theme / full site / core) and route to the right workflow |
| **typecho-project-triage** | Automatically detect project type, Typecho version, PHP version, and existing toolchain |
| **typecho-plugin-development** | Plugin structure, `Plugin_Interface` lifecycle, hooks, config forms, panels/actions/routes, security, and packaging |
| **typecho-theme-development** | Theme file structure, `is()` syntax, template tags, `themeFields`, custom comment area and error pages |
| **typecho-database** | The `Typecho\Db` abstraction layer, query builder, system tables, table prefix, SQL safety |
| **typecho-widget-helper-api** | Widget invocation, `Helper`/`Options`, form helper elements, dynamic properties and methods |
| **typecho-i18n** | `_t()` translation, POT files, multilingual resource organization |
| **typecho-upgrade-migration** | Installation, upgrades, deployment & operations, backup & migration, importing from WordPress / Magike |
| **typecho-debugging** | Troubleshooting playbooks for WSOD / 500 / 404 / 403, pretty URLs, login sessions, XML-RPC, uploads, mail, and the exception mechanism |

## How It Works

Each skill is a self-contained folder with a main instruction file, deep reference docs, and optional deterministic scripts:

```
skills/typecho-plugin-development/
├── SKILL.md            # Main instructions (when to use, procedure, verification, failure modes)
├── references/         # Deep-dive docs per topic
│   ├── hooks.md
│   ├── lifecycle.md
│   ├── structure.md
│   ├── panels-actions-routes.md
│   ├── permissions.md
│   ├── xml-rpc.md
│   ├── config-form.md
│   └── security.md
└── scripts/            # Deterministic helper scripts (detection, validation)
    ├── detect_plugins.mjs
    └── audit_plugin.mjs
```

When you ask an AI assistant to work on Typecho code, it reads the relevant skill and follows the documented procedure instead of guessing.

## Runnable Examples (examples/)

`examples/` ships two complete samples that all pass `php -l`, for reference and copying:

```
examples/
├── plugins/DemoKit/         # Complete plugin: config form + contentEx hook + admin panel
│   │                        # + Action (manual auth/CSRF) + custom route JSON endpoint
│   ├── Plugin.php           # Symmetric register/unregister in activate/deactivate
│   ├── Action/Sync.php
│   ├── Widget/LatestFeed.php
│   └── panel.php
└── themes/BareBones/        # Theme skeleton: index/header/footer/comments/functions
                            # (themeConfig + themeFields + custom page navigation)
```

## Bundled Scripts

| Script | Purpose |
| --- | --- |
| `scripts/lint_skill_links.mjs` | Scans all Markdown relative references (including backtick paths and cross-skill `../../typecho-*` links), reports dead links, exits non-zero on any |
| `skills/typecho-project-triage/scripts/detect_typecho_project.mjs` | Detects project type, version clues, namespace style, toolchain |
| `skills/typecho-plugin-development/scripts/detect_plugins.mjs` | Enumerates plugins and summarizes lifecycle, hooks, Helper registrations |
| `skills/typecho-plugin-development/scripts/audit_plugin.mjs` | Audits whether hook callbacks exist and are static, whether add/remove calls pair up, `use Typecho\Plugin` short-name collisions, etc. |

All scripts are zero-dependency Node.js (>= 18) ESM and read-only — they never execute project code. Self-check before committing:

```bash
node scripts/lint_skill_links.mjs .
node skills/typecho-plugin-development/scripts/audit_plugin.mjs /path/to/typecho
```

## Directory Conventions

Typecho default directories:

```
usr/
├── plugins/     # Plugins: one folder per plugin, containing Plugin.php
└── themes/      # Themes: one folder per theme, containing index.php
```

## Installation

### Manual Installation (Universal)

Copy the skill folders you need from `skills/` into your AI assistant's project instruction directory, e.g.:

- `.claude/skills/` (Claude Code)
- `.cursor/skills/` (Cursor)
- `.github/skills/` (VS Code / GitHub Copilot)
- `.codex/skills/` (OpenAI Codex)
- `.trae/skills/` (Trae)

### Global Installation

Copy them into the assistant's global `skills/` directory under your home folder to make them available in every project.

It is recommended to install at least **typecho-router** and **typecho-project-triage**, then pick domain skills such as plugin / theme development per task.

## Versions & Compatibility

- Fact baseline is **Typecho 1.3.0** (requires PHP 7.4.0+); the APIs also apply to 1.2.x
- Differences from 1.1 (underscore pseudo-namespace) are annotated throughout, for maintaining legacy projects
- The database abstraction layer supports MySQL, PostgreSQL, and SQLite

## Fact Sources & Upgrading

Skill content cites the following authoritative sources. When behavior is uncertain, go back to the source instead of inventing patterns:

- Official docs: <https://docs.typecho.org/>
- Developer docs: <https://docs.typecho.org/develop>
- Database design: <https://docs.typecho.org/database>
- Coding standards: <https://docs.typecho.org/phpcoding>
- Source code: <https://github.com/typecho/typecho>

## License

This skill set is published in the same spirit as the Typecho project — free to learn from and modify.
