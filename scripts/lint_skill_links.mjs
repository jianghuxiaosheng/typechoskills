#!/usr/bin/env node
/**
 * Skill 文档相对链接死链自检 —— 只读、确定性。
 *
 * 用法：
 *   node scripts/lint_skill_links.mjs [仓库根目录]
 *
 * 行为：
 *   - 递归扫描根目录下全部 .md 文件；
 *   - 检查两类相对引用（含跨技能的 ../../typecho-xxx/...）：
 *       1. Markdown 链接 / 图片 [text](path)、![alt](path)；
 *       2. 行内代码中的相对路径 `references/foo.md`、`../xx/bar.mjs`
 *          （本技能集的交叉引用约定用反引号书写）；
 *   - 忽略 http(s)/mailto 等绝对 URL、协议相对 URL（//host/...）、纯锚点；
 *   - 剥离围栏代码块后再匹配，代码示例里的演示路径（usr/plugins/... 等）不报；
 *   - 发现死链时以非零码退出，便于 CI / 提交前自检。
 *
 * 要求：Node.js >= 18，零依赖。
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || process.cwd());

/** 递归收集全部 .md 文件 */
function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walk(full));
    } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

/** 去掉围栏代码块（``` 或 ~~~），避免代码示例里的括号被当成链接 */
function stripFencedCode(md) {
  return md.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '');
}

/** 从 Markdown 文本中提取链接目标（含图片语法） */
function extractLinks(md) {
  const links = [];
  // [text](target "title") / ![alt](target)
  const re = /!?\[[^\]]*\]\(\s*([^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    links.push({ raw: m[1], kind: 'link' });
  }
  return links;
}

/**
 * 从行内代码 span 中提取"看起来像相对文件路径"的引用。
 * 只认带扩展名、含路径分隔符、字符集安全的目标，避免把类名 / 命令误判成路径。
 */
function extractInlineCodePaths(md) {
  const out = [];
  // 指向「被分析的 Typecho 站点项目」的源码路径，不属于本技能仓库，不校验
  const typechoSourcePrefixes = ['var/', 'admin/', 'usr/'];
  const re = /`+([^`\n]+?)`+/g;
  let m;
  while ((m = re.exec(md)) !== null) {
    const raw = m[1].trim();
    const target = raw.split('#')[0].split('?')[0];
    if (!target.includes('/')) continue;                 // 裸文件名不检查
    if (target.startsWith('/')) continue;                // 绝对路径
    if (/[\s:*<>{}|"'$]/.test(target)) continue;         // 协议 / 占位符 / 通配演示
    if (!/\.[A-Za-z0-9]{1,8}$/.test(target)) continue;   // 必须有扩展名
    if (typechoSourcePrefixes.some((p) => target.startsWith(p))) continue;
    const segments = target.split('/');
    // 除末段外的目录段若含 "."（父目录 . / .. 除外），通常是 a.php/b.php
    // 这类多目标简写而非单文件路径
    if (segments.slice(0, -1).some((s) => s.includes('.') && s !== '.' && s !== '..')) {
      continue;
    }
    out.push({ raw, kind: 'code' });
  }
  return out;
}

/** 判断是否为应跳过的非相对链接 */
function isExternal(target) {
  return (
    /^[a-z][a-z0-9+.-]*:/i.test(target) || // 带协议：https: / mailto: / tel:
    target.startsWith('//') ||              // 协议相对
    target.startsWith('#')                  // 纯页内锚点
  );
}

/** 去掉锚点与查询串，得到要检查存在性的磁盘路径 */
function toFsTarget(target) {
  return target.split('#')[0].split('?')[0];
}

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

const files = walk(root);
let dead = 0;
let linkCount = 0;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const cleaned = stripFencedCode(text);
  const badHere = [];

  const refs = [...extractLinks(cleaned), ...extractInlineCodePaths(cleaned)];

  for (const { raw, kind } of refs) {
    if (kind === 'link' && isExternal(raw)) continue;
    const fsPart = toFsTarget(raw);
    if (!fsPart) continue; // 只剩锚点
    linkCount++;
    const resolved = path.resolve(path.dirname(file), fsPart);
    if (!exists(resolved)) {
      badHere.push(raw);
      dead++;
    }
  }

  if (badHere.length) {
    const rel = path.relative(root, file);
    console.log(`\u2717 ${rel}`);
    for (const t of badHere) console.log(`    -> ${t}`);
  }
}

console.log(
  `\n扫描 ${files.length} 个 Markdown 文件、${linkCount} 个相对链接，` +
    `发现 ${dead} 个死链。`,
);
process.exit(dead > 0 ? 1 : 0);
