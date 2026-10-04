---
name: typecho-database
description: "Use for direct Typecho database access: obtaining the Db singleton (Typecho\\Db::get()), the query builder (select/insert/update/delete), fetchRow/fetchAll/fetchObject, WHERE/OR/GROUP/ORDER/LIMIT/OFFSET/page chaining, table. prefix placeholders, cross-adapter MySQL/PostgreSQL/SQLite portability, field expressions, transactions, raw SQL with bound parameters, schema of core tables (contents/comments/metas/users/options/relationships/fields), and SQL injection safety."
compatibility: "Verified against Typecho 1.3.0 (minimum PHP 7.4); APIs also apply to 1.2.x. 1.2+ uses \\Typecho\\Db; 1.1 uses Typecho_Db. Query-builder chaining is identical across versions; only the class name style changes. Filesystem-based agent; PHP syntax check with php -l."
---

# Typecho Database Access

## When to use

- 插件 / 主题中需要绕过 Widget，直接读写数据库（统计、批量更新、自定义表）。
- 编写跨 MySQL / PostgreSQL / SQLite 都能运行的查询。
- 插件激活时建表、升级时改表结构、写入种子数据。
- 排查 SQL 报错、表前缀问题、`table.` 占位符不生效问题。
- 审计已有代码中的 SQL 注入风险与不可移植写法。

不要用于：普通文章 / 分类 / 评论的前台展示（优先用内置 Widget 与主题标签，见
`typecho-theme-development`）；插件配置的存取（用 `options` 表封装的插件配置，
见 `../typecho-plugin-development/references/lifecycle.md`）。

## Inputs required

- 站点根目录与目标插件 / 主题目录。
- 目标 Typecho 版本与命名空间风格（先跑 triage，决定用 `\Typecho\Db` 还是 `Typecho_Db`）。
- 数据库适配器类型（MySQL / PostgreSQL / SQLite）与表前缀（`config.inc.php` 中的
  `__TYPECHO_DB_PREFIX__`，默认 `typecho_`）。
- 要操作的表与字段：优先复用核心表结构（见 `references/schema.md`），不要臆造字段。

## Procedure

### 0) 先 triage，确认版本与适配器

1. `node skills/typecho-project-triage/scripts/detect_typecho_project.mjs`
2. 查看 `config.inc.php` 确认适配器（`__TYPECHO_DB_ADAPTER__`）与前缀
   （`__TYPECHO_DB_PREFIX__`）。

新代码一律使用 1.2+ / 1.3.0 的 `\Typecho\Db`；仅在维护 1.1 代码时使用 `Typecho_Db`。

### 1) 获取 Db 单例，禁止自己 new PDO

```php
use Typecho\Db;
$db = Db::get();
```

- 整个请求共享一个连接，不要自行 `new PDO()` 或读 `config.inc.php` 里的密码。
- 1.1 写法：`$db = Typecho_Db::get();`，后续链式调用完全相同。

### 2) 一律走查询构造器与占位符

- 查询：`$db->fetchAll($db->select()->from('table.contents')->where('type = ?', 'post'))`
- 插入：`$db->query($db->insert('table.contents')->rows([...]))`，返回 insertId。
- 更新：`$db->query($db->update('table.contents')->rows([...])->where('cid = ?', $cid))`
- 删除：`$db->query($db->delete('table.contents')->where('cid = ?', $cid))`
- 所有用户输入以 `?` 占位符绑定，`table.` 前缀会被替换为真实表前缀。

完整链式方法、取值方式、字段表达式、事务见 `references/query-builder.md`。

### 3) 遵守核心表结构，跨适配器可移植

- 核心表：`contents`、`comments`、`metas`、`users`、`options`、`relationships`、
  `fields`。字段含义与关联见 `references/schema.md`，权威定义见
  <https://docs.typecho.org/database>。
- 不要在代码里硬编码 `typecho_`；一律写 `table.表名`，需要前缀时用
  `$db->getPrefix()`。
- 建表 / 改表要考虑三种适配器，避免 MySQL 专有类型与函数。

### 4) 安全底线

- 任何来自 `$_GET/$_POST/$_COOKIE` 的值进 SQL 必须占位符绑定，禁止字符串拼接。
- `ORDER BY`、字段名、`IN` 列表不能直接占位的，先做白名单校验。
- 写操作（insert/update/delete）必须有授权与 CSRF 校验（见
  `../typecho-plugin-development/references/security.md`）。

详见 `references/sql-safety.md`。

### 5) 建表与升级（插件 activate / 升级钩子）

- 优先复用核心表与 `options`；确有必要再建自定义表，表名加插件自己的语义前缀。
- 建表通过适配器执行 DDL，并在文档中说明卸载是否删表（默认保留用户数据）。
- 字段类型选三适配器通用的类型（整数、文本、时间戳整数），详细注意事项见
  `references/schema.md`。

## Verification

- `php -l` 语法检查通过。
- 在目标适配器（至少 MySQL；声明支持时再加 PostgreSQL / SQLite）下手动执行一次
  查询、插入、更新、删除，结果与 insertId 正确。
- 全局搜索确认无字符串拼接的 SQL：`where("...{$_`、`query(".*$` 等模式应为零。
- 把表前缀改成非默认值后功能仍正常（验证全部走了 `table.` 占位）。
- 未授权访问写操作入口时被权限 / Token 拦截。

## Failure modes / debugging

- 报 “table xxx doesn't exist”：表名漏了 `table.` 前缀，或硬编码了 `typecho_`。
- 查询返回空 / 字段不存在：臆造了字段名，对照 `references/schema.md` 与
  <https://docs.typecho.org/database> 核对。
- 换数据库后报错：用了 MySQL 专有语法 / 函数 / 反引号，改为查询构造器与通用表达式。
- 插入中文乱码：绕过 Db 自己建了连接；统一用 `Db::get()` 由核心处理字符集。
- LIKE 查询不到：通配符要拼在绑定值里（`'%关键词%'`），不能写在占位符语句中。
- `IN (?)` 传字符串导致失效：要传数组 `where('cid IN (?)', [1, 2, 3])`。
- 更新 / 删除影响了全表：漏写 `where()`；写操作前先打印生成的 SQL 自查。

## Escalation

- 数据库操作手册 <https://docs.typecho.org/plugins/database-operations>
- 数据库结构设计 <https://docs.typecho.org/database>
- 适配器与查询构造器源码：核心仓库 `var/Typecho/Db/`（Adapter、Query 等）
  <https://github.com/typecho/typecho>
