#!/usr/bin/env node
/**
 * Typecho project triage — deterministic, read-only detection.
 *
 * Usage:
 *   node detect_typecho_project.mjs [path]
 *
 * Prints a JSON report describing whether the folder is a Typecho plugin,
 * theme, full site, or core checkout, along with version hints, namespace
 * style, and available tooling. The script never executes project code.
 *
 * Requires Node.js >= 18. Zero dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());

const IGNORE_DIRS = new Set([
  'node_modules', 'vendor', '.git', '.svn', 'runtime', 'cache',
  '.cache', 'dist', 'build', '.idea', '.vscode',
]);

const MAX_PHP_SCAN = 400; // cap files inspected for namespace sampling

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readSafe(p, limitBytes = 512 * 1024) {
  try {
    const stat = fs.statSync(p);
    if (stat.size > limitBytes) return null;
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

function listDirs(p) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !IGNORE_DIRS.has(d.name))
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function listPhpFiles(dir, max = MAX_PHP_SCAN) {
  const out = [];
  const walk = (d, depth) => {
    if (out.length >= max || depth > 6) return;
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!IGNORE_DIRS.has(e.name)) walk(full, depth + 1);
      } else if (e.isFile() && e.name.toLowerCase().endsWith('.php')) {
        out.push(full);
        if (out.length >= max) break;
      }
    }
  };
  walk(dir, 0);
  return out;
}

/** Detect plugin entries: a directory containing Plugin.php */
function detectPlugins(pluginsDir) {
  const found = [];
  if (!exists(pluginsDir)) return found;
  for (const name of listDirs(pluginsDir)) {
    const pluginFile = path.join(pluginsDir, name, 'Plugin.php');
    if (exists(pluginFile)) {
      found.push({ name, entry: path.relative(root, pluginFile) });
    }
  }
  return found;
}

/** Detect theme entries: a directory whose index.php carries a @package header */
function detectThemes(themesDir) {
  const found = [];
  if (!exists(themesDir)) return found;
  for (const name of listDirs(themesDir)) {
    const indexFile = path.join(themesDir, name, 'index.php');
    if (!exists(indexFile)) continue;
    const head = readSafe(indexFile, 4096) || '';
    if (/@package\b/.test(head)) {
      found.push({ name, entry: path.relative(root, indexFile) });
    }
  }
  return found;
}

/** Pull the Typecho VERSION constant from core source, when present. */
function detectTypechoVersion(varDir) {
  const candidates = [
    path.join(varDir, 'Typecho', 'Common.php'),
    path.join(varDir, 'Typecho.php'),
  ];
  for (const file of candidates) {
    const src = readSafe(file);
    if (!src) continue;
    const m = src.match(/const\s+VERSION\s*=\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
  }
  return null;
}

function detectPhpVersion() {
  const composer = readSafe(path.join(root, 'composer.json'));
  if (!composer) return null;
  try {
    const json = JSON.parse(composer);
    return json?.require?.php || null;
  } catch {
    return null;
  }
}

/** Sample PHP sources to determine 1.2 namespaced vs 1.1 underscore style. */
function detectNamespaceStyle(scanDirs) {
  let namespaced = 0;
  let underscore = 0;
  for (const dir of scanDirs) {
    if (!exists(dir)) continue;
    for (const file of listPhpFiles(dir)) {
      const src = readSafe(file, 256 * 1024);
      if (!src) continue;
      if (/use\s+Typecho\\|Typecho\\Plugin|Typecho\\Db|Typecho\\Widget/.test(src)) namespaced++;
      if (/\bTypecho_Plugin\b|\bTypecho_Db\b|\bTypecho_Widget_Helper\b/.test(src)) underscore++;
    }
  }
  if (namespaced === 0 && underscore === 0) return 'none';
  if (namespaced > 0 && underscore > 0) return 'mixed';
  return namespaced > underscore ? 'namespaced' : 'underscore';
}

// ---- Assemble the report ---------------------------------------------------

const signals = [];
const usrDir = path.join(root, 'usr');
const pluginsDir = path.join(usrDir, 'plugins');
const themesDir = path.join(usrDir, 'themes');
const varDir = path.join(root, 'var');

const plugins = detectPlugins(pluginsDir);
const themes = detectThemes(themesDir);

const hasRootIndex = exists(path.join(root, 'index.php'));
const hasConfig = exists(path.join(root, 'config.inc.php'));
const hasVar = exists(varDir);
const hasInstaller = exists(path.join(root, 'install.php'));
const isolatedPlugin = exists(path.join(root, 'Plugin.php'));
const rootIndexHead = hasRootIndex ? readSafe(path.join(root, 'index.php'), 4096) || '' : '';
const isolatedTheme = hasRootIndex && /@package\b/.test(rootIndexHead) && !hasVar;

if (isolatedPlugin) signals.push('root Plugin.php');
if (isolatedTheme) signals.push('root index.php with @package theme header');
if (plugins.length) signals.push(`usr/plugins (${plugins.length})`);
if (themes.length) signals.push(`usr/themes (${themes.length})`);
if (hasConfig) signals.push('config.inc.php');
if (hasVar) signals.push('var/ core source');
if (hasInstaller) signals.push('install.php');

let kind = 'unknown';
if (plugins.length || themes.length || (hasRootIndex && hasConfig)) {
  kind = hasConfig || (hasRootIndex && hasVar) ? 'full-site' : 'extension-bundle';
}
if (isolatedPlugin && !plugins.length && !themes.length) kind = 'plugin';
if (isolatedTheme && !plugins.length && !themes.length) kind = 'theme';
if (hasRootIndex && hasVar && hasInstaller && !hasConfig) kind = 'core';
if (kind === 'extension-bundle') {
  if (plugins.length && !themes.length) kind = 'plugins-bundle';
  if (themes.length && !plugins.length) kind = 'themes-bundle';
}

const scanDirs = [pluginsDir, themesDir];
if (isolatedPlugin) scanDirs.push(root);

const report = {
  path: root,
  kind,
  entries: {
    plugins,
    themes,
  },
  typechoVersion: hasVar ? detectTypechoVersion(varDir) : null,
  phpRequirement: detectPhpVersion(),
  namespaceStyle: detectNamespaceStyle(scanDirs),
  tooling: {
    composer: exists(path.join(root, 'composer.json')),
    node: exists(path.join(root, 'package.json')),
  },
  signals,
};

process.stdout.write(JSON.stringify(report, null, 2) + '\n');
