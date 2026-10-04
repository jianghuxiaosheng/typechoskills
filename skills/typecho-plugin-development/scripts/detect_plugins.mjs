#!/usr/bin/env node
/**
 * Typecho plugin scanner — deterministic, read-only.
 *
 * Usage:
 *   node detect_plugins.mjs [path]
 *
 * Finds Typecho plugins (usr/plugins/<Name>/Plugin.php, or a root Plugin.php),
 * then inspects each one for:
 *   - doc-block header (@package/@author/@version/@link)
 *   - declared class and PluginInterface implementation
 *   - lifecycle methods (activate/deactivate/config/personalConfig)
 *   - hook points registered via Plugin::factory()
 *   - panels/actions/routes added (and removed) via Helper
 *
 * Parsing is regex-based for triage only; it does not execute PHP.
 * Requires Node.js >= 18. Zero dependencies.
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function readSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return null; }
}

function listDirs(p) {
  try {
    return fs
      .readdirSync(p, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }
}

function findPluginFiles() {
  const files = [];
  const pluginsDir = path.join(root, 'usr', 'plugins');
  if (exists(pluginsDir)) {
    for (const name of listDirs(pluginsDir)) {
      const candidate = path.join(pluginsDir, name, 'Plugin.php');
      if (exists(candidate)) files.push({ name, file: candidate });
    }
  }
  // Isolated single-plugin folder.
  if (!files.length && exists(path.join(root, 'Plugin.php'))) {
    files.push({ name: path.basename(root), file: path.join(root, 'Plugin.php') });
  }
  return files;
}

function header(docblock, tag) {
  const m = docblock.match(new RegExp(`@${tag}\\s+([^\\r\\n*]+)`));
  return m ? m[1].trim() : null;
}

function analyzePlugin({ name, file }) {
  const src = readSafe(file) || '';
  const docblock = (src.match(/\/\*\*[\s\S]*?\*\//) || [''])[0];

  const classMatch = src.match(/\bclass\s+(\w+)([^{]*?)\bimplements\s+([^\s{]+)/);
  const className = classMatch ? classMatch[1] : null;
  const implementsName = classMatch ? classMatch[3].trim() : null;

  const methods = ['activate', 'deactivate', 'config', 'personalConfig'];
  const presentMethods = methods.filter((m) =>
    new RegExp(`function\\s+${m}\\s*\\(`).test(src),
  );

  // Hook points: Plugin::factory('Point')->hook [_priority] = callback
  const hookPoints = new Set();
  const factoryRe = /factory\(\s*['"]([^'"]+)['"]\s*\)\s*->\s*(\w+?)(?:_\d+)?\s*=/g;
  let m;
  while ((m = factoryRe.exec(src))) hookPoints.add(`${m[1]}::${m[2]}`);

  const helperAdds = {
    panel: /Helper::addPanel\s*\(/.test(src),
    action: /Helper::addAction\s*\(/.test(src),
    route: /Helper::addRoute\s*\(/.test(src),
  };
  const helperRemoves = {
    panel: /Helper::removePanel\s*\(/.test(src),
    action: /Helper::removeAction\s*\(/.test(src),
    route: /Helper::removeRoute\s*\(/.test(src),
  };

  const issues = [];
  if (!implementsName || !/PluginInterface/i.test(implementsName)) {
    issues.push('Plugin class does not explicitly implement PluginInterface');
  }
  if (!presentMethods.includes('activate')) issues.push('missing activate()');
  if (!presentMethods.includes('config')) issues.push('missing config() (interface requirement)');
  if ((helperAdds.panel || helperAdds.action || helperAdds.route) &&
      !(helperRemoves.panel || helperRemoves.action || helperRemoves.route)) {
    issues.push('adds panel/action/route but deactivate() appears not to remove it');
  }
  if (/\bTypecho\\/.test(src) && /\bTypecho_Plugin\b/.test(src)) {
    issues.push('mixed 1.2 namespaced and 1.1 underscore class styles in one file');
  }

  return {
    name,
    entry: path.relative(root, file),
    header: {
      package: header(docblock, 'package'),
      author: header(docblock, 'author'),
      version: header(docblock, 'version'),
      link: header(docblock, 'link'),
    },
    className,
    implements: implementsName,
    namespaceStyle: /\bTypecho\\/.test(src)
      ? 'namespaced'
      : /\bTypecho_Plugin\b/.test(src)
        ? 'underscore'
        : 'none',
    lifecycleMethods: presentMethods,
    hooks: [...hookPoints],
    adds: helperAdds,
    removes: helperRemoves,
    issues,
  };
}

const plugins = findPluginFiles().map(analyzePlugin);
process.stdout.write(JSON.stringify({ path: root, count: plugins.length, plugins }, null, 2) + '\n');
