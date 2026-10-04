# SQL 安全与可移植性清单

配合 `../../typecho-plugin-development/references/security.md` 使用。本篇只聚焦
数据库层。事实来源：<https://docs.typecho.org/plugins/database-operations>。

## 铁律

1. **任何用户输入进 SQL 必须用 `?` 占位符绑定**，禁止字符串插值 / 拼接。
2. **表名一律 `table.` 前缀**，禁止硬编码 `typecho_`。
3. **写操作（insert/update/delete）必须先过授权与 CSRF**，且必须带 `where()`。
4. **不能占位的部分（列名、排序方向、IN 结构）走白名单**，绝不直接用输入。

## 占位符的正确用法

值（WHERE 条件、插入 / 更新的数据值）可以绑定：

```php
// 正确
$db->select()->from('table.contents')
    ->where('authorId = ?', $uid)
    ->where('title LIKE ?', '%' . $kw . '%');

// 错误：把输入拼进语句
$db->query("SELECT * FROM typecho_contents WHERE title = '{$_GET['title']}'");
```

LIKE 的通配符 `%` 拼在**绑定值**里，而不是 SQL 语句模板里。`IN` 传数组：

```php
->where('cid IN (?)', [1, 2, 3]);
```

## 不能用占位符的位置：白名单

占位符只能绑定“值”，不能绑定列名、表名、排序方向、SQL 关键字。这些位置的输入
必须先校验是否在固定白名单内：

```php
$sortable = ['created', 'commentsNum', 'title'];
$orderCol = in_array($_GET['order'] ?? 'created', $sortable, true)
    ? $_GET['order'] : 'created';
$dir = ($_GET['dir'] ?? 'desc') === 'asc' ? Db::SORT_ASC : Db::SORT_DESC;

$db->select()->from('table.contents')
    ->order($orderCol, $dir);
```

- 列名 / 排序字段：与一张允许列表比对，非法值回退到默认值。
- 排序方向：映射到 `Db::SORT_ASC` / `Db::SORT_DESC` 常量。
- 表名：只能来自代码常量，不接受外部传入。

## 写操作的防护

```php
// 后台 / 动作入口内：先鉴权，再校验 CSRF Token
$user->pass('editor');
$this->security->protect();

$db->query(
    $db->delete('table.contents')->where('cid = ?', $cid)   // 必须有 where
);
```

- update / delete 在执行前确认 `where()` 非空，避免误清整表。
- 用动作（`Helper::addAction`）或后台面板承载写请求，不要放在可被 GET 直接触发的
  公开路径（见 `../../typecho-plugin-development/references/panels-actions-routes.md`）。
- 涉及多条关联数据（内容 + 评论 + 关系 + 计数）优先调用核心删除 / 更新流程，
  避免裸删造成脏数据。

## 输出也要转义

从数据库取出的数据回显到 HTML 时仍是不可信数据，必须转义：

```php
echo htmlspecialchars($row['title'], ENT_QUOTES, 'UTF-8');
```

占位符只保证“安全写入 / 查询”，不等于“安全输出”。

## 可移植性要点

- 用查询构造器，不写反引号、`AUTO_INCREMENT`、`ENGINE=` 等 MySQL 专有语法。
- 排序方向用 `Db::SORT_*` 常量；分页用 `page()` / `limit()` / `offset()`。
- 时间存 Unix 时间戳整数；需要数据库时间函数时评估 SQLite 兼容性
  （如 `NOW()` 不可移植）。
- 建表 DDL 按适配器区分，参考核心安装 SQL 对 MySQL / PostgreSQL / SQLite 的处理。

## 代码审计搜索词

复查既有代码时搜索以下高危模式：

- `{$_GET`、`{$_POST`、`{$_REQUEST`、`$_COOKIE` 直接出现在 SQL 字符串里。
- `query(".*\$`、`where(".*\$` 中用双引号插值变量而非 `?` 绑定。
- 硬编码的 `typecho_`、裸 `FROM contents`（缺 `table.`）。
- update / delete 链上找不到 `->where(`。
- `expression(..., ..., false)` 的表达式片段中混入外部输入。
- 取到数据后直接 `echo` 而未 `htmlspecialchars`。
