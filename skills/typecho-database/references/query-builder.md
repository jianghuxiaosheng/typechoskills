# 查询构造器（Typecho\Db Query Builder）

事实来源：<https://docs.typecho.org/plugins/database-operations>，并以核心源码
`var/Typecho/Db/` 为准。1.2 使用 `\Typecho\Db`；1.1 使用 `Typecho_Db`，链式 API 相同。

## 获取实例

```php
use Typecho\Db;

$db = Db::get();          // 1.2+
// $db = Typecho_Db::get();   // 1.1
```

- 全请求单例，共享核心已建立的连接与字符集配置。
- 不要自己 `new PDO()`，不要直接读取数据库密码。

## 表名与前缀

- 所有表名写 `table.表名`，查询构造器会把 `table.` 替换为真实前缀
  （`config.inc.php` 的 `__TYPECHO_DB_PREFIX__`，默认 `typecho_`）。

```php
$db->select()->from('table.contents');          // => typecho_contents
echo $db->getPrefix();                          // 需要直接拼前缀时使用
```

## 查询（SELECT）

### 基本查询

```php
$posts = $db->fetchAll(
    $db->select()
        ->from('table.contents')
        ->where('type = ?', 'post')
        ->where('status = ?', 'publish')
);
```

- `fetchAll()`：返回全部行（数组的数组）。
- `fetchRow()`：返回单行。
- `fetchObject()`：返回单行对象。

### 取值方式

- `select()` 不传参数等价于 `SELECT *`。
- 指定列与别名：

```php
$db->select('status, COUNT(*) AS count')
   ->from('table.contents')
   ->group('status');
```

### WHERE 链

```php
->where('cid = ?', $cid)                       // AND
->orWhere('cid = ?', $otherCid)               // OR
->where('title LIKE ?', '%关键词%')            // 通配符放在绑定值里
->where('cid IN (?)', [1, 2, 3])              // IN 传数组
```

多个 `where()` 之间是 AND；`orWhere()` 表示 OR。复杂的括号分组不要硬拼，
拆成多条可表达的查询或在核心源码确认构造器能力后再用。

### 排序 / 分页 / 分组

```php
->order('created', Db::SORT_DESC)   // 1.1 用 Typecho_Db::SORT_DESC
->limit(10)
->offset(20)
->page(2, 10)                       // 第 2 页、每页 10 条（等价于 limit/offset 组合）
->group('status')
```

`order()` 第二参数用 `Db::SORT_ASC` / `Db::SORT_DESC` 常量，不要手写，
以适配不同适配器。

## 插入（INSERT）

```php
$insertId = $db->query(
    $db->insert('table.contents')->rows([
        'title'    => '标题',
        'text'     => '正文内容',
        'slug'     => 'hello-world',
        'type'     => 'post',
        'status'   => 'publish',
        'created'  => time(),
        'modified' => time(),
        'authorId' => 1,
    ])
);
```

- `rows()` 传关联数组，键为字段名。
- 返回值为新行的自增 ID（`contents.cid` 等）。
- 时间字段 `created` / `modified` 存 Unix 时间戳（整数），不是数据库日期类型。

## 更新（UPDATE）

```php
$db->query(
    $db->update('table.contents')
        ->rows(['title' => '新标题', 'modified' => time()])
        ->where('cid = ?', 1)
);
```

### 字段表达式（自增、函数值）

不希望值被当成绑定参数、而是写成 SQL 表达式时用 `expression()`：

```php
$update = $db->update('table.contents')->where('cid = ?', 1);
$update->expression('viewsNum', 'viewsNum + 1');          // 浏览量 +1
$update->expression('modified', 'NOW()', false);          // 第三个参数 false：不做转义/绑定
$db->query($update);
```

- 第三个参数为 `false` 时直接作为 SQL 片段，因此该表达式内容绝不能包含用户输入。
- 跨适配器尽量用整数自增这类通用表达式；`NOW()` 在 SQLite 上不可用，需谨慎。

## 删除（DELETE）

```php
$db->query(
    $db->delete('table.contents')->where('cid = ?', 1)
);
```

- 务必带 `where()`，否则清空整表。
- 删除核心数据通常应同步清理关联（如 `relationships`、评论、字段），
  优先考虑调用核心删除逻辑而不是裸删。

## 原生 SQL

查询构造器无法表达时，可执行原生 SQL，但用户输入仍必须占位绑定：

```php
$db->fetchAll($db->select(...));          // 优先
// 原生语句也要用表前缀占位，并用 ? 绑定参数
$db->query('DELETE FROM ' . $db->getPrefix() . 'contents WHERE cid = ?', ...)
```

- 具体原生查询方法签名（`query` 的参数绑定形式）以 `var/Typecho/Db/Adapter/`
  与适配器源码为准；能不用就不用。
- 原生 SQL 最容易写出不可移植 / 不安全代码，仅作为最后手段。

## 事务

需要“多条写语句全部成功或全部回滚”时，通过适配器连接使用事务：

```php
$db->getAdapter()->beginTransaction();  // 具体方法以当前适配器源码为准
try {
    // ... 多条 $db->query(...)
    $db->getAdapter()->commit();
} catch (\Throwable $e) {
    $db->getAdapter()->rollBack();
    throw $e;
}
```

注意 SQLite 事务与锁的行为与 MySQL 不同；确切事务 API 以
`var/Typecho/Db/Adapter/` 下适配器实现为准，不要假设 PDO 方法一定直接透传。

## 调试技巧

- 查询构造器对象可被打印 / 转型为字符串查看生成的 SQL 与绑定值，写操作前先自查。
- 出现 “table doesn't exist” 先检查表名是否漏写 `table.`。
- 出现字段错误先对照 `schema.md`，不要凭记忆猜字段。
