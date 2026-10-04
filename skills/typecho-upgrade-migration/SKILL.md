---
name: typecho-upgrade-migration
description: "Use for installing Typecho, upgrading versions, server/domain relocation, backup/restore, and importing content from other blog systems: server requirements (PHP 7.4+ for 1.3.0, MySQL/PostgreSQL/SQLite, cURL/Socket, mbstring/iconv), running install.php, generated config.inc.php and initial admin password, the standard upgrade procedure (delete admin/var/index.php/install.php, NEVER delete usr/, re-upload, run the admin upgrader), disabling plugins/themes to isolate post-upgrade 500 errors, the 1.1 underscore-style to 1.2 namespace code migration, database + usr/ backup strategy, and the official WordpressToTypecho / MagikeToTypecho importers."
compatibility: "Verified against Typecho 1.3.0 (minimum PHP 7.4); covers 1.1/1.2.x -> 1.3.0 upgrades. File-replacement paths and the usr/ preservation rule apply to modern releases; legacy GAE/SAE/BAE/ACE engine notes are outdated and flagged. Filesystem/ops agent; verify version from var/Typecho/Common.php."
---

# Typecho 安装、升级与迁移

## When to use

- 全新安装 Typecho，或安装前核对服务器环境。
- 升级到新版本（含 1.1 → 1.2），或升级后出现 500 / 白屏需要排查。
- 更换服务器、更换域名、整站备份与恢复。
- 从 WordPress / Magike 等其他博客系统导入内容。
- 指导用户把第三方主题 / 插件从下划线风格迁移到 1.2 命名空间。

不要用于：编写新插件（`typecho-plugin-development`）、主题
（`typecho-theme-development`）、日常数据库操作（`typecho-database`）。

## Inputs required

- 目标版本（以 <https://typecho.org/download> 的稳定版为准）与当前版本
  （读 `var/Typecho/Common.php` 的 `VERSION`，或先跑 triage）。
- 服务器环境：PHP 版本、数据库类型与版本、相关扩展。
- 迁移场景下：数据库备份、`usr/` 目录、`config.inc.php`，以及源系统的数据库
  连接信息。

## Procedure

### 0) 核对版本与环境

- PHP：1.3.0 需 **7.4.0+**（官方 README 明示，无运行时强制拦截，老环境会在
  解析阶段直接致命错误）。
- 数据库：MySQL / PostgreSQL / SQLite 任一，并装好对应 PHP 扩展。
- 扩展：cURL 或 Socket 二选一；mbstring 或 iconv 二选一。
- 当前版本用 triage 或 `var/Typecho/Common.php` 中的 `const VERSION` 确认。

### 1) 全新安装

1. 从 <https://typecho.org/download> 下载稳定版并解压，得到
   `admin/`、`install/`、`usr/`、`var/`、`index.php`、`install.php` 等。
2. 全部上传到 Web 目录，用浏览器访问站点目录，自动进入安装向导。
3. 按向导填写数据库地址 / 类型 / 账号 / 库名 / 表前缀与管理员信息。
4. 安装成功后**立即记录初始密码**并登录后台修改；安装程序会生成
   `config.inc.php`。

详见 `references/install-and-upgrade.md`。

### 2) 标准升级（文件替换 + 后台升级程序）

1. **先完整备份**数据库与 `usr/` 目录（见步骤 4）。
2. 删除服务器上的旧文件：`admin/`、`var/`、`index.php`、`install.php`。
3. **绝对不要删除 `usr/`**——主题、插件、上传文件都在这里，不参与核心升级。
4. 上传新版中同名的 `admin/`、`var/`、`index.php`、`install.php`（即覆盖）。
5. 用管理员登录后台，系统提示检测到新版本，点击「完成升级」。
   升级期间前台报错可忽略，进后台完成升级即恢复。
6. 升级后若首页 500：进后台**禁用所有插件 + 启用默认主题**，再逐个启用排查。

### 3) 1.1 → 1.2 代码迁移（主题 / 插件层）

- 数据库结构由后台升级程序自动迁移；需要人工改的是**代码命名风格**：
  `Typecho_Plugin` → `\Typecho\Plugin`、`Typecho_Db` → `\Typecho\Db`、
  `Typecho_Widget_Helper_*` → `\Typecho\Widget\Helper\*` 等。
- 内置 Widget 短名（如 `'Widget_Options'`）两版通用，可优先保留。
- 完整映射见 `../typecho-router/references/decision-tree.md` 与
  `../typecho-plugin-development/references/structure.md`。

### 4) 备份、换服务器 / 换域名

- 一份完整备份 = **数据库导出** + **整个 `usr/` 目录** + `config.inc.php`。
- 换服务器：在新机装同版本 Typecho → 导入数据库 → 覆盖 `usr/` →
  按新机环境修改 `config.inc.php` 的数据库连接与前缀。
- 换域名：更新后台站点地址设置；正文 / 附件中的绝对 URL 需另行批量处理。

详见 `references/install-and-upgrade.md`。伪静态规则（Nginx/Apache/IIS）、
`config.inc.php` 常量全集（站点 URL、附件目录 / CDN、Cookie、调试模式等）
与目录权限见 `references/deployment-and-config.md`。

### 5) 从其他系统导入

- **WordPress**：官方插件 `WordpressToTypecho`，填源库连接信息后在控制台
  一键转换。
- **Magike**：官方插件 `MagikeToTypecho`。
- 官方未提供 emlog 等系统的导入器，需第三方方案或自行写转换，导入前务必备份。

完整步骤与注意事项见 `references/import-migration.md`。

## Verification

- 安装：向导无环境告警；前台首页、后台登录、固定链接、发表文章均正常。
- 升级：后台版本号已更新；前台文章 / 分类 / 评论 / 附件数量与升级前一致；
  默认主题 + 无插件状态正常，再逐个恢复插件 / 主题。
- 迁移：新机首页、后台、上传文件可访问；`config.inc.php` 连接正确；
  旧域名链接（如保留）按预期跳转。
- 导入：文章 / 页面 / 分类 / 标签 / 评论数量与源系统吻合，附件可显示，
  导入后已禁用导入插件。

## Failure modes / debugging

- 安装白屏 / 环境检测不过：PHP 版本过低或缺扩展（pdo 驱动、mbstring/iconv、
  cURL/Socket）。
- 忘记初始密码：删除安装生成的 `config.inc.php` 后重新安装，并选择**保留原有
  数据库**。
- 升级后 500 / 白屏：旧插件 / 主题不兼容；禁用全部插件、启用默认主题后逐个
  定位。
- 升级后样式错乱或文件丢失：误删了 `usr/`；从备份恢复该目录。
- 导入失败：多为源数据库连接信息（地址 / 端口 / 账号 / 库名 / 表前缀）填错；
  更正后重试，转换是幂等排查前提是已备份。
- 换服务器后数据库连接错误：`config.inc.php` 仍指向旧库或前缀不一致。
- 首页正常但所有内页 404：伪静态规则缺失，Nginx/Apache/IIS 规则见
  `references/deployment-and-config.md`。
- 排错需要完整错误堆栈：转 `typecho-debugging` 技能
  （`../typecho-debugging/SKILL.md`）。

## Escalation

- 安装 <https://docs.typecho.org/install>
- 升级 <https://docs.typecho.org/upgrade>
- 从 WordPress 导入 <https://docs.typecho.org/import>
- 下载 <https://typecho.org/download>
- 官方导入插件 <https://github.com/typecho/plugins/tree/master/WordpressToTypecho>
- 社区求助 <http://forum.typecho.org/>
