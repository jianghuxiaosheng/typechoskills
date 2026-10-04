---
name: typecho-project-triage
description: "Use to automatically detect what kind of Typecho project a folder is (plugin, theme, full site, or core), the Typecho/PHP version hints, namespace style (1.2 namespaced vs 1.1 underscore), and available tooling. Run before making changes so the right workflow and guardrails are chosen."
compatibility: "Verified against Typecho 1.3.0 (minimum PHP 7.4); also detects 1.2.x / 1.1 projects. Detection is a zero-dependency Node.js (>=18) script that only reads the filesystem; it never executes project code."
---

# Typecho Project Triage

## When to use

- 接到任意 Typecho 相关任务、动手改代码之前。
- 不确定当前目录是插件、主题、完整站点还是核心源码时。
- 需要确认目标版本、命名空间风格与可用工具链时。

## Inputs required

- 待扫描的根目录（默认当前工作目录，可传参覆盖）。

## Procedure

1. 运行确定性检测脚本：
   - `node skills/typecho-project-triage/scripts/detect_typecho_project.mjs [路径]`
2. 读取输出 JSON 的字段：
   - `kind`：`plugin` / `theme` / `full-site` / `core` / `unknown`
   - `entries`：检测到的插件 / 主题入口列表
   - `typechoVersion`、`phpVersion`：从源码或配置中得到的版本线索（可能为 `null`）
   - `namespaceStyle`：`namespaced`（1.2+ / 1.3.0）/ `underscore`（1.1）/ `mixed` / `none`
   - `tooling`：是否存在 `composer.json`、`package.json`、构建脚本等
   - `signals`：用于判定的证据，便于人工复核
3. 把结果交给 `typecho-router` 做路由。

检测依据（与脚本一致）：

- 插件入口：`usr/plugins/<Name>/Plugin.php`，或孤立目录下的 `Plugin.php`。
- 主题入口：`usr/themes/<Name>/index.php`（文件头含 `@package` 模板注释），或孤立主题目录。
- 完整站点 / 核心：根目录 `index.php` + `var/Typecho` + `config.inc.php`（站点）或 `install.php`（核心包）。
- 版本：核心 `var/Typecho/Common.php` 中的 `VERSION` 常量；`composer.json` 的 `require.php`。
- 命名空间：对 PHP 源码做轻量正则，统计 `Typecho\` 与 `Typecho_` 出现情况。

## Verification

- 脚本输出的 `kind` 与 `signals` 能自洽（例如 `plugin` 时必有 `Plugin.php` 证据）。
- 扫描整站时 `entries.plugins` / `entries.themes` 列表与 `usr/` 实际目录一致。

## Failure modes / debugging

- `kind: unknown`：脚本只做只读扫描，可能是目录过深或入口被重命名。
  此时人工列目录并检查 `config.inc.php`、`var/Typecho`、`usr/plugins`、`usr/themes`。
- 版本为 `null`：没有核心源码（只拿到单个插件 / 主题）。此时依据该扩展自身
  代码的命名空间风格判断，并向用户确认其运行的 Typecho 版本。
- `namespaceStyle: mixed`：同一项目混用两种风格，多为老插件升级中；
  不要“顺手统一”，按任务最小改动原则处理，必要时提示风险。

## Escalation

- 脚本证据与用户描述冲突时，以实际文件系统为准并向用户指出差异。
- 需要深入类视图 / 函数表时，查阅开发文档：<https://docs.typecho.org/develop>。
