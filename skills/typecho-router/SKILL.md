---
name: typecho-router
description: "Use when the user asks about Typecho codebases (plugins under usr/plugins, themes under usr/themes, a full Typecho site, or core checkout) and you need to classify the repo and route to the correct workflow/skill (plugin lifecycle/hooks, theme templates/is-syntax/themeFields, database, widgets/helpers, i18n, upgrade/migration)."
compatibility: "Verified against Typecho 1.3.0 (minimum PHP 7.4); guidance also applies to 1.2.x. Filesystem-based agent; detection helpers are Node.js (>=18) with zero dependencies. Also covers 1.1 underscore-style differences."
---

# Typecho Router

## When to use

在绝大多数 Typecho 任务开始时使用本技能，用于：

- 判断当前代码库属于哪种 Typecho 工程：插件、主题、完整站点、还是核心源码；
- 选择正确的工作流与约束（生命周期、Hook、模板结构、数据库等）；
- 把任务委派给最相关的领域技能。

## Inputs required

- 仓库根目录（当前工作目录）。
- 用户意图（想改什么）与约束：目标 Typecho / PHP 版本、是否需要兼容 1.1、是否要发布。
- 若已知，提供具体插件 / 主题的入口路径。

## Procedure

1. 运行项目检测脚本（确定性扫描，不要靠猜）：
   - `node skills/typecho-project-triage/scripts/detect_typecho_project.mjs`
2. 阅读 triage 输出并分类：
   - 主要工程类型（plugin / theme / full-site / core / unknown）；
   - 可用工具链（Composer、Node、是否带构建步骤）；
   - 版本线索（`var/Typecho/Common.php` 常量、`config.inc.php`、插件 / 主题注释头）；
   - 命名空间风格（1.2 命名空间 vs 1.1 下划线伪命名空间）。
3. 依据“用户意图 + 仓库类型”路由到领域技能，决策树见：
   - `references/decision-tree.md`
4. 修改前先套用护栏：
   - 版本约束不清时先确认（1.2 命名空间写法不能假设 1.1 支持）。
   - 优先遵循仓库既有工具链与编码规范（见 <https://docs.typecho.org/phpcoding>）。
   - 不要臆造 Hook 名或类名：到核心源码 `var/` 中核对 `Typecho_Plugin::factory()` 触发点。

## Routing quick map

| 任务信号 | 路由到 |
|----------|--------|
| 新建 / 改插件、`Plugin.php`、激活禁用、Hook、后台菜单、配置页 | `typecho-plugin-development` |
| 改前台模板、`index.php`/`post.php`、`is()`、`themeFields`、评论区 | `typecho-theme-development` |
| `Db::get()`、查询构造器、建表、`table.` 前缀、SQL | `typecho-database` |
| `$this->widget()`、`Helper::`、`Widget_Options`、表单元素、动态属性 | `typecho-widget-helper-api` |
| `_t()`、语言包、POT、多语言 | `typecho-i18n` |
| 安装、升级、备份恢复、从 WordPress / Magike 导入 | `typecho-upgrade-migration` |
| 白屏 / 报错、500/404、伪静态、登录掉线、权限 403、XML-RPC、邮件不通、上传失败 | `typecho-debugging` |

## Verification

- 在新建或大幅重组文件后，重跑 triage 脚本确认类型判断仍成立。
- 运行仓库中已有的 lint / 测试 / 构建命令（若存在）；Typecho 插件 / 主题多为纯 PHP，至少执行 `php -l` 语法检查。

## Failure modes / debugging

- triage 报告 `kind: unknown`：手动检查 `config.inc.php`、`index.php`、`var/Typecho`、`usr/plugins`、`usr/themes`、`composer.json`。
- 单一目录里既像插件又像主题：通常路径已说明一切——`usr/plugins/<Name>/Plugin.php` 是插件，`usr/themes/<Name>/index.php` 是主题。
- 版本无法判定：查找 `VERSION` 常量（核心 `var/Typecho/Common.php`）或后台“关于 Typecho”；无法确认时默认按 1.3.0 处理并显式向用户确认。

## Escalation

- 路由不明确时只问一个问题：
  - “这是一个 Typecho 插件、主题，还是完整站点 / 核心源码目录？”
- API 行为存疑时，查阅官方开发文档与核心源码后再动手，不要自创模式：
  - <https://docs.typecho.org/develop> · <https://github.com/typecho/typecho>
