#!/usr/bin/env node
/**
 * Typecho 插件 Hook / 注册配对审计 —— 只读、静态正则分析，不执行 PHP。
 *
 * 用法：
 *   node audit_plugin.mjs [项目根或插件目录]
 *
 * 检查项（基于 Typecho 1.3.0 插件契约）：
 *   1. Plugin::factory('handle')->hook = callback 的回调目标是否真实存在，
 *      且为静态方法 / 可调用函数（支持 __CLASS__.'::m'、'Class::m'、
 *      [Class::class, 'm']、'functionName' 四种写法）；
 *   2. Helper::addAction / addRoute 的 key 是否在 deactivate() 中有对应
 *      removeAction / removeRoute；addPanel / removePanel 按面板文件配对；
 *   3. addPanel / addAction / addRoute 是否出现在 activate() 中（正典位置）；
 *   4. 插件主类文件是否 use Typecho\Plugin —— 短名 Plugin 与本插件
 *      `class Plugin` 冲突，会造成致命错误，必须用全限定 \Typecho\Plugin。
 *
 * 输出 JSON。存在 error 级问题时退出码为 1。
 * 要求：Node.js >= 18，零依赖。
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
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

/** 递归收集目录下全部 .php 文件 */
function walkPhp(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkPhp(full));
    else if (ent.isFile() && ent.name.toLowerCase().endsWith('.php')) out.push(full);
  }
  return out;
}

function findPlugins() {
  const plugins = [];
  const pluginsDir = path.join(root, 'usr', 'plugins');
  if (exists(pluginsDir)) {
    for (const name of listDirs(pluginsDir)) {
      const entry = path.join(pluginsDir, name, 'Plugin.php');
      if (exists(entry)) plugins.push({ name, dir: path.join(pluginsDir, name), entry });
    }
  }
  if (!plugins.length && exists(path.join(root, 'Plugin.php'))) {
    plugins.push({ name: path.basename(root), dir: root, entry: path.join(root, 'Plugin.php') });
  }
  return plugins;
}

/** 从 method 关键字位置做花括号配平，返回方法体 [bodyStart, bodyEnd) */
function methodBodyRange(src, methodName) {
  const sig = new RegExp(`function\\s+${methodName}\\s*\\(`).exec(src);
  if (!sig) return null;
  const open = src.indexOf('{', sig.index);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return [open + 1, i];
  }
  return null;
}

function sliceMethod(src, name) {
  const r = methodBodyRange(src, name);
  return r ? src.slice(r[0], r[1]) : '';
}

/** 提取某方法调用全部实参中出现的字符串字面量（粗略切分第一个实参足够用） */
function callArgs(src, fnName) {
  const calls = [];
  const re = new RegExp(`\\b${fnName}\\s*\\(`, 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    // 从左括号做括号配平，取完整实参串
    let depth = 0;
    let i = m.index + m[0].length - 1;
    for (; i < src.length; i++) {
      if (src[i] === '(') depth++;
      else if (src[i] === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    calls.push(src.slice(m.index + m[0].length, i));
  }
  return calls;
}

/** 取实参串中的第一个字符串字面量 */
function firstString(args) {
  const m = args.match(/(['"])((?:\\.|(?!\1).)*)\1/);
  return m ? m[2] : null;
}

/**
 * 解析 factory 赋值右侧的回调表达式
 * 返回 {kind: 'self'|'static'|'array'|'function', class?, method?} 或 null
 */
function parseCallback(rhs) {
  let m;
  if ((m = /__CLASS__\s*\.\s*['"]::(\w+)['"]/.exec(rhs))) {
    return { kind: 'self', method: m[1] };
  }
  if ((m = /(\[\s*([\w\\]+)::class\s*,\s*['"](\w+)['"]\s*\]|array\s*\(\s*([\w\\]+)::class\s*\s*,\s*['"](\w+)['"]\s*\))/.exec(rhs))) {
    return { kind: 'array', class: m[2] || m[4], method: m[3] || m[5] };
  }
  if ((m = /['"]([A-Za-z_][\w\\]*)::(\w+)['"]/.exec(rhs))) {
    return { kind: 'static', class: m[1], method: m[2] };
  }
  if ((m = /^\s*['"]([A-Za-z_]\w*)['"]\s*$/.exec(rhs))) {
    return { kind: 'function', name: m[1] };
  }
  return null;
}

function auditPlugin({ name, dir, entry }, allPhp) {
  const src = fs.readFileSync(entry, 'utf8');
  const issues = [];
  const push = (level, code, message) => issues.push({ level, code, message });

  // 规则 4：use Typecho\Plugin 与 class Plugin 短名冲突
  if (/\bclass\s+Plugin\b/.test(src) && /^\s*use\s+[\w\\]*\bPlugin\s*;/m.test(src)) {
    push(
      'error',
      'plugin-use-alias-conflict',
      "主类文件内 `use Typecho\\Plugin;` 与本插件 `class Plugin` 短名冲突，" +
        'PHP 会报 "Cannot declare class ... because the name is already in use"；' +
        '删除该 use，核心 Plugin 一律用全限定 \\Typecho\\Plugin。',
    );
  }

  // 建立 类短名 -> 文件 与 文件内容 索引
  const classToFile = new Map();
  const fileContents = new Map();
  for (const f of allPhp) {
    const text = fs.readFileSync(f, 'utf8');
    fileContents.set(f, text);
    for (const cm of text.matchAll(/\bclass\s+(\w+)/g)) {
      classToFile.set(cm[1], f);
    }
  }

  const hasStaticMethod = (file, method) =>
    new RegExp(`static\\s+function\\s+${method}\\s*\\(`).test(fileContents.get(file) || '');
  const hasMethod = (file, method) =>
    new RegExp(`function\\s+${method}\\s*\\(`).test(fileContents.get(file) || '');
  const hasFunctionAnywhere = (fn) =>
    allPhp.some((f) => new RegExp(`function\\s+${fn}\\s*\\(`).test(fileContents.get(f)));

  // 规则 1：factory Hook 回调可达性
  const hooks = [];
  const factoryRe =
    /factory\(\s*(['"])([^'"]+)\1\s*\)\s*->\s*(\w+?)(?:_\d+)?\s*=\s*([\s\S]*?);/g;
  let fm;
  while ((fm = factoryRe.exec(src)) !== null) {
    const [, , handle, hook, rhsRaw] = fm;
    const rhs = rhsRaw.trim();
    const cb = parseCallback(rhs);
    const item = { handle, hook, raw: rhs, callback: cb };
    hooks.push(item);

    if (!cb) {
      push('warning', 'hook-callback-unparsed', `Hook ${handle}::${hook} 的回调表达式无法静态识别：${rhs}`);
      continue;
    }

    if (cb.kind === 'self') {
      // __CLASS__：插件主类 Plugin，静态方法应在 Plugin.php 或同类内
      const targetFile = classToFile.get('Plugin') || entry;
      if (!hasMethod(targetFile, cb.method)) {
        push('error', 'hook-target-missing', `Hook ${handle}::${hook}：本插件类中不存在方法 ${cb.method}()`);
      } else if (!hasStaticMethod(targetFile, cb.method)) {
        push('error', 'hook-target-not-static', `Hook ${handle}::${hook}：方法 ${cb.method}() 必须声明为 static`);
      }
    } else if (cb.kind === 'static' || cb.kind === 'array') {
      const short = cb.class.split('\\').pop();
      const targetFile = classToFile.get(short);
      if (!targetFile) {
        push(
          'error',
          'hook-target-class-missing',
          `Hook ${handle}::${hook}：插件目录内找不到回调类 ${cb.class}（外部类请人工复核）`,
        );
      } else if (!hasMethod(targetFile, cb.method)) {
        push('error', 'hook-target-missing', `Hook ${handle}::${hook}：类 ${short} 中不存在方法 ${cb.method}()`);
      } else if (!hasStaticMethod(targetFile, cb.method)) {
        push('error', 'hook-target-not-static', `Hook ${handle}::${hook}：${short}::${cb.method}() 必须声明为 static`);
      }
    } else if (cb.kind === 'function') {
      if (!hasFunctionAnywhere(cb.name)) {
        push('error', 'hook-target-missing', `Hook ${handle}::${hook}：找不到回调函数 ${cb.name}()`);
      }
    }
  }

  // 规则 2/3：activate / deactivate 配对
  const activateBody = sliceMethod(src, 'activate');
  const deactivateBody = sliceMethod(src, 'deactivate');

  const pairKeys = (addFn, removeFn, body) => {
    const added = callArgs(body || src, addFn).map(firstString).filter(Boolean);
    const removed = callArgs(deactivateBody, removeFn).map(firstString).filter(Boolean);
    // deactivate 缺失时对全部 add 报未配对
    const unpaired = added.filter((k) => !removed.includes(k));
    for (const k of unpaired) {
      push(
        'error',
        'lifecycle-unpaired',
        `${addFn}('${k}', ...) 在 deactivate() 中没有对应 ${removeFn}('${k}', ...)，禁用后残留注册。`,
      );
    }
    return { added, removed, unpaired };
  };

  const actions = pairKeys('Helper::addAction', 'Helper::removeAction', activateBody);
  const routes = pairKeys('Helper::addRoute', 'Helper::removeRoute', activateBody);

  // Panel 按第二个实参（面板文件路径）配对
  const panelAdded = callArgs(activateBody || src, 'Helper::addPanel')
    .map((args) => args.split(',').slice(1).join(','))
    .map(firstString)
    .filter(Boolean);
  const panelRemoved = callArgs(deactivateBody, 'Helper::removePanel')
    .map((args) => args.split(',').slice(1).join(','))
    .map(firstString)
    .filter(Boolean);
  const panels = {
    added: panelAdded,
    removed: panelRemoved,
    unpaired: panelAdded.filter((k) => !panelRemoved.includes(k)),
  };
  for (const k of panels.unpaired) {
    push(
      'error',
      'lifecycle-unpaired',
      `Helper::addPanel(..., '${k}', ...) 在 deactivate() 中没有对应 removePanel 注销同一面板文件。`,
    );
  }

  // 位置提示：add* 出现在 activate 之外（且插件确实定义了 activate）
  if (activateBody) {
    for (const fn of ['Helper::addPanel', 'Helper::addAction', 'Helper::addRoute']) {
      const outside = new RegExp(fn.replace(/::/g, '\\s*::\\s*')).test(src.replace(activateBody, ''));
      if (outside) {
        push('warning', 'registration-outside-activate', `${fn} 出现在 activate() 之外，确认是否有意为之（正典做法是 activate 注册、deactivate 注销）。`);
      }
    }
  }

  return {
    name,
    entry: path.relative(root, entry),
    hooks,
    registrations: { actions, routes, panels },
    issues,
  };
}

const plugins = findPlugins();
if (!plugins.length) {
  console.log(JSON.stringify({ path: root, count: 0, message: '未发现 Typecho 插件（usr/plugins/<Name>/Plugin.php 或当前目录 Plugin.php）' }, null, 2));
  process.exit(0);
}

const reports = plugins.map((p) => auditPlugin(p, walkPhp(p.dir)));
const errorCount = reports.reduce((n, p) => n + p.issues.filter((i) => i.level === 'error').length, 0);

console.log(JSON.stringify({ path: root, count: reports.length, plugins: reports }, null, 2));
process.exit(errorCount > 0 ? 1 : 0);
