---
name: typecho-debugging
description: "Use when a Typecho site, plugin, or theme is broken and needs diagnosis: white screen (blank page), HTTP 500/503/404/403, 'Database Server Error' / 'Error establishing a database connection' / 'Database Query Error', fatal errors after an upgrade or plugin install, hooks that never fire, plugin/theme conflicts, login or session problems, permalink/rewrite 404s (including Nginx 405 on the admin login), file-permission 500s, inaccurate category/tag counts, or XML-RPC offline-publishing failures. Covers enabling __TYPECHO_DEBUG__ to expose full exception traces, how production masking maps exception types to status codes, locating PHP and web-server error logs, isolating plugins/themes by renaming directories (ghost entries can then be disabled on the plugins admin page), SQL error diagnosis via the query builder, and a hook troubleshooting checklist."
compatibility: "Mechanisms verified against Typecho 1.3.0 source (var/Widget/Init.php, var/Typecho/Common.php, var/Typecho/Db, var/Typecho/Plugin.php). The two-stage exception handler behavior applies to 1.2+; symptom-level guidance (rewrite rules, file permissions, counter refresh) applies broadly to modern releases. Filesystem/ops agent."
---

# Typecho 调试与排错

## When to use

- 前台白屏、500 / 503 / 403 / 404，或后台打不开、登录异常。
- 升级、安装插件 / 主题、迁移服务器之后站点报错。
- 自己写的插件 Hook 不生效、面板 / 路由 404、SQL 查询报错。
- 固定链接失效、Nginx 后台登录 405、分类 / 标签文章数不对。
- XML-RPC 离线发布客户端连不上。

不要用于：**如何实现**某个功能（转 `typecho-plugin-development` /
`typecho-theme-development`）、安装升级的标准流程本身
（`typecho-upgrade-migration`）；本技能只负责"坏了怎么定位"。

## Inputs required

- 症状：错误页原文（含 HTTP 状态码）、出问题的 URL、前台还是后台。
- 变更历史：最近是否升级、启用 / 更新过插件或主题、换过服务器 / PHP 版本。
- 服务器访问：能否编辑根目录 `config.inc.php`、能否看 PHP / Web 服务器错误日志、
  能否重命名 `usr/plugins/` 下的目录。
- Typecho 版本（读 `var/Typecho/Common.php` 的 `const VERSION`）。

## Procedure

### 0) 先界定问题边界

1. 记录错误页原文与状态码：Typecho 生产页的措辞本身就是分流信号
   （`Database Server Error` / `Database Query Error` /
   `Error establishing a database connection` 各有含义，见步骤 2）。
2. 判断影响面：仅某篇文章？整个前台？后台？还是只有某个插件页面？
   - 全站挂 + 刚动过文件 → 核心 / 环境 / 数据库连接问题；
   - 仅特定功能挂 → 多半是某个插件或主题。
3. 问清最近一次变更：升级、装插件、改配置、换服务器 / 域名 / PHP 版本。
   排错优先级永远是"最近变更的东西"。

### 1) 打开调试模式，让完整异常暴露出来

在根目录 `config.inc.php` 中（`\Typecho\Common::init();` 之前之后均可）加入：

```php
define('__TYPECHO_DEBUG__', true);
```

- 机制（已对照 1.3.0 源码确认）：`Common::init()` 注册的异常处理器会打印
  异常 message 与完整 `__toString()` 堆栈；`Widget\Init::execute()`
  **仅在未定义或 `__TYPECHO_DEBUG__` 为 falsy 时**才用生产脱敏处理器覆盖它。
  所以打开常量后，页面直接显示异常类、消息、文件行号与调用栈。
- 刷新出问题的页面，读堆栈最顶端（异常抛出点）与其中出现的
  `usr/plugins/<Name>`、`usr/themes/<Name>` 路径——通常就是肇事者。
- **排查结束后立即删掉这行**：调试页会暴露绝对路径与代码结构，不能长期开在
  生产环境。

如果开 DEBUG 后仍然白屏（连异常都没有），说明是 PHP 级 fatal 或语法错误，
按步骤 3 查 PHP 错误日志。

### 2) 按生产错误页措辞分流

调试模式关闭时，`Common::error()` 会按异常类型脱敏，状态码与文案对应关系：

| 生产页面现象 | 真实异常 | 含义 / 首要怀疑 |
| --- | --- | --- |
| 503 `Error establishing a database connection` | `Db\Adapter\ConnectionException` | 数据库连不上：`config.inc.php` 地址 / 端口 / 账号 / 密码错、数据库服务挂了、PHP 驱动缺失 |
| 500 `Database Server Error` | 其他 `Db\Exception` | 数据库层面通用错误 |
| 500 `Database Query Error` | `Db\Adapter\SQLException` | 连上了但 SQL 执行失败：表缺失 / 表前缀不对 / 字段不存在 / 升级未完成 |
| 404 跳到主题异常页 | code = 404 的异常 | 路由 / 内容不存在，或伪静态规则错误 |
| 403「禁止访问」 | `Widget\Exception`(403) | 已登录但用户组权限不足 |
| 其他 500 `Server Error` | 其余 `Throwable` | 插件 / 主题 / PHP 运行时错误，需开 DEBUG 看真身 |

注意：SQL 异常消息只含数据库引擎报错（如 MySQL 的 `$this->dbLink->error`），
**不含出错的 SQL 语句本身**；要拿到语句需在代码层捕获并打印，见步骤 5。

### 3) 白屏 / fatal：查日志 + 隔离插件与主题

白屏 = PHP fatal 被 Web 服务器吞掉，Typecho 的异常处理器来不及输出。

1. 先做语法检查：对刚改过的文件执行 `php -l path/to/File.php`。
2. 查错误日志（按部署形态）：
   - Nginx + PHP-FPM：Nginx `error.log` 与 PHP-FPM 的 `php-fpm.log` /
     慢日志所在池日志（常见 `/var/log/nginx/error.log`、
     `/var/log/php-fpm/`）；
   - Apache：`error.log`（cPanel 等面板多在站点 `logs/` 目录）；
   - IIS：事件查看器与 PHP 配置的 `error_log` 文件；
   - 也可在 `php.ini` 或临时在 `config.inc.php` 顶部加
     `ini_set('display_errors', '1'); error_reporting(E_ALL);`
     在**可接受短暂暴露**的环境复现。
3. 插件隔离（升级后 500 的头号原因）：
   - 能进后台：禁用全部插件 → 刷新确认恢复 → 逐个启用，每启用一个刷新一次。
   - 后台进不去：在 `usr/plugins/` 下把可疑插件目录**重命名**（如 `Foo` →
     `Foo.disabled`）。其 Hook 回调类将无法自动加载；随后访问一次
     **后台插件管理页**，已激活但文件缺失的"幽灵插件"会出现在已装列表并带
     「禁用」链接，点击禁用即可彻底清掉激活记录。
4. 主题隔离：后台启用默认主题；后台进不去时，重命名 `usr/themes/<当前主题>`
   目录，再访问后台外观设置。
5. 文件权限：官方 FAQ 对升级后权限类 500 的建议是先 `chmod -Rf 644 *`，
   仍不行再 `chmod -Rf 755 *`（目录需要可进入权限，部分主机需要 755）。

### 4) 数据库连接 / 查询类排错

- **503 连接错误**：用 `config.inc.php` 里同一组参数在命令行
  `mysql -h host -P port -u user -p` 验证；查 PHP 是否装了对应扩展
  （1.3.0 MySQL 走 `mysqli`，另有 PDO 系适配器）；SQLite 用户检查
  `usr/*.db` 文件路径与写权限。
- **500 Query Error**：
  - 升级后出现 → 大概率升级程序没跑完，进后台点「完成升级」；
  - 表前缀错误 → 核对 `config.inc.php` 中 `new \Typecho\Db($adapter, '前缀')`
    的第二参数与实际表名；
  - 自己写的查询报错 → 用调试模式拿到抛出点，把 Query 对象转成语句检查：
    `$sql instanceof \Typecho\Db\Query ? $sql->prepare($sql) : $sql`。
- 任何动手修库之前先导出备份。

### 5) Hook 不生效排查清单

按顺序核对，命中一个修一个：

1. 插件是否真的**已启用**（后台插件页，或 `typecho_options` 表 plugins 配置）；
   重命名过目录要重新启用。
2. Hook 名是否与核心触发点完全一致——到 `var/` 里搜
   `Plugin::factory('...')` 与 `->hookName(`，不要凭记忆拼写。
3. 注册回调的字符串与类 / 方法是否真实存在且可自动加载
   （`usr/plugins/<Name>/Plugin.php`，类名与路径的下划线映射，详见
   `../typecho-plugin-development/references/hooks.md`）。
4. 回调签名是否匹配：核心传几个参数、引用传递的参数有没有接
   （`trigger($plugged)` 信号位是核心用来判断"是否有插件接管"的关键）。
5. 缓存：主题 / 插件有静态化缓存时先清缓存；opcache 开启时重启 PHP-FPM
   或等 opcache 过期。
6. 临时在回调第一行写 `error_log('hook fired: ' . __METHOD__);`，
   再去 PHP 错误日志确认到底有没有被调用——区分"没注册上"和
   "注册了但回调内部提前返回"。

### 6) 高频症状速查

- **后台登录 405（Nginx）**：老版本 Nginx（< 0.7）对 PATH_INFO 处理有问题，
  升级 Nginx；并确认 PHP location 写成
  `location ~ .*\.php(\/.*)*$` 而不是 `~ .*\.php$`。
- **前台所有子页面 404、只有首页正常**：伪静态规则缺失，见
  `../typecho-upgrade-migration/references/deployment-and-config.md`。
- **Apache 报 `No input file specified`**：`php5.ini` / `php.ini` 设
  `cgi.fix_pathinfo = 1`。
- **分类 / 标签文章数不准**：后台分类 / 标签管理页全选 →
  【选中项】→【刷新】重建计数。
- **附件上传失败 / 想换附件目录**：默认在 `usr/uploads`；可在
  `config.inc.php` 定义 `__TYPECHO_UPLOAD_DIR__`，注意目录权限。
- **XML-RPC 客户端连不上**：确认「设置 → 基本设置」的 XML-RPC 接口
  （`allowXmlRpc`：0 关闭 / 1 仅关闭 Pingback（发文仍可用）/ 2 全部打开），
  地址为 `index.php/action/xmlrpc`（依固定链接形态变化），详见
  `../typecho-plugin-development/references/xml-rpc.md`。
- **邮件通知收不到**：Typecho 1.3.0 核心**不内置**邮件类，通知完全依赖
  第三方插件；排查对应插件的 SMTP 配置，不要去核心里找 Mail 类。

### 7) 收尾

1. 删除 `config.inc.php` 里的 `__TYPECHO_DEBUG__` 调试行（或置为 `false`）。
2. 恢复被重命名的插件 / 主题目录，重新启用必要插件，确认站点正常。
3. 如修改过 `display_errors` 等 php.ini 临时项，还原配置。
4. 记录根因；属于插件 / 主题代码缺陷的，按
   `../typecho-plugin-development/SKILL.md` 的规范修复。

## Verification

- 原错误 URL 恢复 200，前台首页、文章页、后台登录、发表文章均正常。
- 调试模式已关闭：再访问一个故意不存在的地址，看到的是生产错误页而非堆栈。
- PHP 错误日志中不再产生新的 fatal / warning。
- 被隔离的插件逐个验证：确认肇事者后，更新 / 卸载它，而不是长期禁用。

## Failure modes / debugging

- 开了 DEBUG 仍白屏：PHP 版本低于代码要求（1.3.0 需 7.4+）导致解析阶段
  直接 fatal，或文件上传不完整——看 PHP error log 与 `php -v`，重新上传
  核心文件。
- 重命名插件目录后整站 fatal：该插件 Hook 挂在每次请求都执行的位置，
  立刻访问后台插件管理页禁用幽灵条目即可恢复；恢复目录名亦可回退。
- 后台插件页看不到「禁用」链接：管理员未登录或权限不足（需要 administrator）。
- 日志里什么都没有：主机禁用了 `error_log` 且不允许 `display_errors`，
  联系空间商开启，或临时用自定义异常模板（见
  `references/debug-mode-and-exceptions.md`）把异常写到私有文件。
- 改了代码不生效：opcache / 静态缓存；重启 PHP-FPM、清缓存后再验证。

## Escalation

- 官方 FAQ（伪静态、权限、计数等）<https://docs.typecho.org/faq>
- 问题反馈（先搜旧 issue）<https://github.com/typecho/typecho/issues>
- 社区论坛 <http://forum.typecho.org/>
- 深入机制见 `references/debug-mode-and-exceptions.md`，
  症状剧本见 `references/debugging-playbook.md`。
