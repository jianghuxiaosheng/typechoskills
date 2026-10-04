---
name: typecho-plugin-development
description: "Use when developing Typecho plugins: Plugin.php structure and Typecho_Plugin_Interface lifecycle (activate/deactivate/config/personalConfig), hook registration via Typecho\\Plugin::factory(), action vs filter hooks, priorities, dynamic ___property/callMethod extension, admin panels/actions/routes, config forms, plugin options access, security (CSRF/permission/escaping/SQL placeholders), and packaging."
compatibility: "Verified against Typecho 1.3.0 (minimum PHP 7.4); APIs also apply to 1.2.x. Uses namespaced Typecho\\* / TypechoPlugin\\* classes for new code while documenting 1.1 underscore-style equivalents. Filesystem-based agent; PHP syntax check with php -l."
---

# Typecho Plugin Development

## When to use

- 新建或重构插件结构（`usr/plugins/<Name>/Plugin.php`、引导、包含文件）。
- 注册 Hook / 动作 / 过滤器，或实现激活、禁用、卸载逻辑。
- 添加插件配置页（后台配置表单）或个人用户配置。
- 添加后台面板、前台动作（`Action`）或自定义路由。
- 安全修复（CSRF、权限、输入过滤、输出转义、SQL 占位符）。
- 读取插件配置项、打包发布插件。

不要用于：纯前台模板（转 `typecho-theme-development`）、直接的数据库查询
（配合 `typecho-database`）、翻译（配合 `typecho-i18n`）。

## Inputs required

- 站点根目录 + 目标插件目录（`usr/plugins/<Name>`）。
- 目标 Typecho 版本与命名空间风格（先跑 triage；1.1 / 1.2 写法不同）。
- 插件运行位置：单站，以及所需的最低用户等级（administrator/editor/...）。

## Procedure

### 0) 先 triage 并定位插件入口

1. `node skills/typecho-project-triage/scripts/detect_typecho_project.mjs`
2. 确定性扫描插件头与接口实现：
   - `node skills/typecho-plugin-development/scripts/detect_plugins.mjs [路径]`

整站仓库中，先收窄到具体 `usr/plugins/<Name>` 再改代码。

### 1) 遵循可预测的结构

- 一个插件一个目录，核心逻辑放在 `Plugin.php`；目录名、插件名、类名一致。
- 顶部用文档注释声明 `@package/@author/@version/@link`，后台据此展示信息。
- 类必须实现插件接口（1.2+ / 1.3.0：
  `namespace TypechoPlugin\<Name>;` +
  `implements \Typecho\Plugin\PluginInterface`；
  1.1：`implements Typecho_Plugin_Interface`）。
- 不要在文件加载阶段产生重副作用；Hook 一律在 `activate()` 中注册。

详见 `references/structure.md`。

### 2) 生命周期：activate / deactivate / config

- `activate()`：注册所有 Hook、面板、动作、路由；需要时建表 / 初始化选项。
- `deactivate()`：注销面板、动作、路由，释放资源；不要随意删除用户数据。
- `config($form)`：用表单助手构建后台配置项；`personalConfig($form)` 极少用。
- 配置读取：`Helper::options()->plugin('插件名')->字段名`。

注册与注销必须成对出现，否则禁用后残留路由 / 菜单。

详见 `references/lifecycle.md`、`references/config-form.md`。

### 3) 正确注册与实现 Hook

- 注册语法：`\Typecho\Plugin::factory('Hook点')->Hook名称 = [__CLASS__, '方法名'];`
- 区分类型：
  - **动作型（call）**：执行操作，直接 echo 或处理，无返回要求。
  - **过滤器型（filter）**：必须 `return` 处理后的数据，常见签名
    `($content, $widget, $lastResult)`，无修改时至少 `return $content;`。
  - **trigger 条件型**：返回 `false` 可阻止默认处理。
- 优先级：在 Hook 名后加 `_数字`（如 `content_5`），数字越小越早执行。
- 动态扩展 Widget：`___name` 定义属性、`callName` 定义方法。
- Hook 名 / Hook 点不要臆造，到核心源码的触发点核对（常见点见
  `references/hooks.md`，权威清单以 <https://docs.typecho.org/plugins/hooks> 为准）。

### 4) 后台面板、前台动作、自定义路由

需要后台页或前台可编程入口时，在 `activate()` 用 `Helper` 注册，并在
`deactivate()` 用对应 remove 方法注销：

- `Helper::addPanel()` 后台菜单面板；`Helper::addAction()` 前台动作；
  `Helper::addRoute()` 自定义路由。

详见 `references/panels-actions-routes.md`。

### 5) 安全基线（始终遵守）

- 后台表单输出 Token 并校验：使用后台表单助手自动携带的安全字段；
  自写表单提交必须走 `$this->security->protect()` / `$this->security->can(...` 体系。
- 授权：后台动作先校验当前用户等级 / `$user->hasLogin()`，不能只靠“页面藏得深”。
- 输入早过滤，输出晚转义：写入前校验类型，输出到 HTML 前转义。
- SQL 一律占位符 + `table.` 前缀，禁止字符串拼接用户输入（见 `typecho-database`）。
- 过滤器返回内容要考虑是否已被转义，避免双重转义或 XSS。

详见 `references/security.md`。用户组等级、`pass()` 的 302/403 语义、
`addPanel` 的 `$level` 双重作用、登录 / 登出 Hook、Action 手动鉴权位置，
见 `references/permissions.md`；XML-RPC 离线发布接口的开关、方法族与
权限映射见 `references/xml-rpc.md`。

### 6) 数据存储、建表、卸载（按需）

- 小配置优先用插件配置（`options` 表），确有必要再建自定义表。
- 建表用 `Db::get()->getAdapter()` 配合前缀，跨 MySQL / PostgreSQL / SQLite。
- 卸载语义：`deactivate()` 通常保留数据；是否删表 / 删选项要在插件说明中讲清。

## Verification

- 插件可正常启用、禁用，无 fatal / warning；禁用后后台无残留菜单、路由 404 已清理。
- 配置项能保存并被正确读取（权限与 Token 生效）。
- 过滤器在“不修改内容”的边界情况下原样返回，不破坏正文。
- 用 `php -l Plugin.php` 做语法检查；存在 `composer.json` 时运行其 lint / 测试。
- 再次启用 / 禁用循环一次，确认注册 / 注销幂等，不产生重复路由或重复表错误。

## Failure modes / debugging

- Hook 不生效：注册写在了非 `activate()` 处；Hook 点或 Hook 名拼错；
  类名回调与实际方法不一致（优先用 `__CLASS__`）。
- 启用后白屏：接口方法未全部实现、类名与目录名不匹配、1.1/1.2 类名混用。
- 过滤器把正文吃掉了：忘记 `return $content`，或没按 `($content, $widget, $lastResult)` 接参。
- 禁用后菜单仍在 / 路由仍可访问：`deactivate()` 漏调 `removePanel/removeAction/removeRoute`。
- 配置读不到：`plugin('插件名')` 传入的名字与目录名不一致，或字段名与 `config()` 中不符。

## Escalation

- Hook 清单、参数与版本行为不确定时，先查官方手册与核心源码，不要自创：
  - Hook 手册 <https://docs.typecho.org/plugins/hooks>
  - 入门 <https://docs.typecho.org/plugins/hello-world>
  - 高级技巧 <https://docs.typecho.org/plugins/advanced>
  - 源码 <https://github.com/typecho/typecho>
