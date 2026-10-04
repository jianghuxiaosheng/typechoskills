# Agent Skills for Typecho

[English](README.md) | **简体中文**

**教会 AI 编码助手以正确的方式进行 Typecho 开发。**

Agent Skills 是可移植的指令、清单与脚本集合，帮助 AI 助手（Claude、Copilot、Codex、Cursor、Trae 等）理解 Typecho 的插件 / 主题开发模式、Hook 体系、数据库抽象层与安全基线，避免凭空臆造 API 或写出已过时的写法。

> 本技能集的结构对标官方 [WordPress/agent-skills](https://github.com/WordPress/agent-skills) 的分层设计（router → triage → 领域技能），内容以 [Typecho 官方文档](https://docs.typecho.org/) 为事实来源。

## 为什么需要 Agent Skills？

AI 编码助手在 Typecho 项目上经常：

- 混用 Typecho 1.1 的下划线伪命名空间（`Typecho_Plugin`）与 1.2+ 的命名空间（`\Typecho\Plugin`、插件正典 `TypechoPlugin\<Name>`）写法
- 在插件主类文件里 `use Typecho\Plugin;`，与本插件 `class Plugin` 短名冲突直接致命错误
- 忘记插件必须实现 `Typecho_Plugin_Interface` 并在 `activate()` 中注册 Hook
- 在 `deactivate()` 中遗漏注销面板 / 动作 / 路由，造成残留
- 直接拼接 SQL，而不是使用 `table.` 前缀与查询构造器的占位符
- 主题里漏写 `$this->header()`，或在模板中输出未转义内容
- 不知道 `is()` 语法、`themeFields`、动态属性（`___x`）/ 动态方法（`callX`）等 Typecho 特有机制

Agent Skills 把这些专家级知识以 AI 可直接遵循的形式提供出来。

## 可用技能

| 技能 | 教授内容 |
|------|----------|
| **typecho-router** | 对 Typecho 代码库分类（插件 / 主题 / 整站 / 核心），路由到正确的工作流 |
| **typecho-project-triage** | 自动检测项目类型、Typecho 版本、PHP 版本与现有工具链 |
| **typecho-plugin-development** | 插件结构、`Plugin_Interface` 生命周期、Hook、配置表单、面板/动作/路由、安全与打包 |
| **typecho-theme-development** | 主题文件结构、`is()` 语法、模板标签、`themeFields`、自定义评论区与错误页 |
| **typecho-database** | `Typecho\Db` 抽象层、查询构造器、系统表、表前缀、SQL 安全 |
| **typecho-widget-helper-api** | Widget 调用、`Helper`/`Options`、表单助手元素、动态属性与方法 |
| **typecho-i18n** | `_t()` 翻译、POT 文件、多语言资源组织 |
| **typecho-upgrade-migration** | 安装、升级、部署运维、备份迁移、从 WordPress / Magike 导入 |
| **typecho-debugging** | 白屏 / 500 / 404 / 403、伪静态、登录会话、XML-RPC、上传、邮件等排错剧本与异常机制 |

## 工作方式

每个技能都是自包含文件夹，内含主指令、深度参考文档与可选的确定性脚本：

```
skills/typecho-plugin-development/
├── SKILL.md            # 主指令（何时使用、流程、验证、失败模式）
├── references/         # 特定主题的深度文档
│   ├── hooks.md
│   ├── lifecycle.md
│   ├── structure.md
│   ├── panels-actions-routes.md
│   ├── permissions.md
│   ├── xml-rpc.md
│   ├── config-form.md
│   └── security.md
└── scripts/            # 确定性辅助脚本（检测、校验）
    ├── detect_plugins.mjs
    └── audit_plugin.mjs
```

当你让 AI 助手处理 Typecho 代码时，它会读取对应技能并遵循文档化流程，而不是猜测。

## 可运行示例（examples/）

`examples/` 提供两个全部通过 `php -l` 的完整范例，供对照与复制：

```
examples/
├── plugins/DemoKit/         # 完整插件：配置表单 + contentEx Hook + 后台面板
│   │                        # + Action（手动鉴权/CSRF）+ 自定义路由 JSON 端点
│   ├── Plugin.php           # activate/deactivate 对称注册与注销
│   ├── Action/Sync.php
│   ├── Widget/LatestFeed.php
│   └── panel.php
└── themes/BareBones/        # 主题骨架：index/header/footer/comments/functions
                            # （themeConfig + themeFields + 自定义页面导航）
```

## 自带脚本

| 脚本 | 作用 |
| --- | --- |
| `scripts/lint_skill_links.mjs` | 扫描全部 Markdown 的相对引用（含反引号路径与跨技能 `../../typecho-*` 链接），报告死链，有死链时退出码非零 |
| `skills/typecho-project-triage/scripts/detect_typecho_project.mjs` | 检测项目类型、版本线索、命名空间风格、工具链 |
| `skills/typecho-plugin-development/scripts/detect_plugins.mjs` | 枚举插件并汇总生命周期、Hook、Helper 注册情况 |
| `skills/typecho-plugin-development/scripts/audit_plugin.mjs` | 审计 Hook 回调是否存在且为静态、add/remove 是否配对、`use Typecho\Plugin` 短名冲突等 |

脚本均为零依赖 Node.js（>= 18）ESM，只读不执行项目代码。提交前自检：

```bash
node scripts/lint_skill_links.mjs .
node skills/typecho-plugin-development/scripts/audit_plugin.mjs /path/to/typecho
```

## 目录约定

Typecho 默认目录：

```
usr/
├── plugins/     # 插件：每个插件一个文件夹，内含 Plugin.php
└── themes/      # 主题：每个主题一个文件夹，内含 index.php
```

## 安装

### 手动安装（通用）

把所需技能文件夹从 `skills/` 复制到你所用 AI 助手的项目指令目录，例如：

- `.claude/skills/`（Claude Code）
- `.cursor/skills/`（Cursor）
- `.github/skills/`（VS Code / GitHub Copilot）
- `.codex/skills/`（OpenAI Codex）
- `.trae/skills/`（Trae）

### 全局安装

复制到用户主目录下对应助手的全局 `skills/` 目录即可在所有项目中生效。

建议至少安装 **typecho-router**、**typecho-project-triage**，再按任务选择插件 / 主题等领域技能。

## 版本与兼容性

- 事实基线为 **Typecho 1.3.0**（需 PHP 7.4.0+），API 写法同样适用于 1.2.x
- 同时标注与 1.1（下划线伪命名空间）写法的差异，便于维护老项目
- 数据库抽象层支持 MySQL、PostgreSQL、SQLite

## 事实来源与升级

技能内容引用以下权威来源，当行为不确定时应回到源头核对，不要臆造模式：

- 官方文档：<https://docs.typecho.org/>
- 开发文档：<https://docs.typecho.org/develop>
- 数据库设计：<https://docs.typecho.org/database>
- 编码规范：<https://docs.typecho.org/phpcoding>
- 源码：<https://github.com/typecho/typecho>

## 许可

本技能集文档以与 Typecho 项目一致的精神发布，可自由学习与修改。
