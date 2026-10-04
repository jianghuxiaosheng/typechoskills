# 调试模式与异常处理机制深入参考

本文件是 `../SKILL.md` 的深度参考。机制描述基于 Typecho 1.3.0 源码：
`var/Typecho/Common.php`、`var/Widget/Init.php`、`var/Typecho/Db.php` 与
`var/Typecho/Db/Adapter/*`。排查具体症状的剧本见 `debugging-playbook.md`。

## 1. 两个异常处理器的覆盖关系

Typecho 启动时会先后设置两个异常处理器，后者覆盖前者：

### 1.1 调试处理器（`Common::init()` 始终注册）

入口文件一开始就执行 `\Typecho\Common::init()`，其中：

```php
set_exception_handler(function (\Throwable $exception) {
    echo '<pre><code>';
    echo '<h1>' . htmlspecialchars($exception->getMessage()) . '</h1>';
    echo htmlspecialchars($exception->__toString());
    echo '</code></pre>';
    exit;
});
```

特点：原样输出异常 message 与**完整调用栈**（含文件路径、行号、参数类型），
并 `exit` 结束。这是开发期想要的信息密度。

### 1.2 生产处理器（`Widget\Init::execute()` 条件覆盖）

核心初始化 Widget 执行时：

```php
if (!defined('__TYPECHO_DEBUG__') || !__TYPECHO_DEBUG__) {
    set_exception_handler(function (\Throwable $exception) {
        // 清缓冲、重建输出缓冲
        if (404 == $exception->getCode()) {
            ExceptionHandle::alloc();       // 交给主题的 404 异常页
        } else {
            Common::error($exception);       // 脱敏错误页
        }
        exit;
    });
}
```

关键推论：

- **未定义 `__TYPECHO_DEBUG__`，或定义为 `false` / `0` / `''`**：
  生产处理器生效，错误信息被脱敏。
- **`define('__TYPECHO_DEBUG__', true)`**：跳过覆盖，1.1 的调试处理器保留，
  完整异常直接打印到页面。
- 判断是 falsy 比较，所以 `define('__TYPECHO_DEBUG__', false)` 与不定义等价；
  要关调试直接删掉常量定义最稳妥。

## 2. 生产错误页如何脱敏：`Common::error()`

`Common::error(\Throwable $exception)` 按异常类型映射状态码与文案：

| 异常类型 | HTTP 状态码 | 页面文案 |
| --- | --- | --- |
| `Typecho\Db\Adapter\ConnectionException` | 503 | Error establishing a database connection |
| `Typecho\Db\Adapter\SQLException` | 500 | Database Query Error |
| 其他 `Typecho\Db\Exception` | 500 | Database Server Error |
| `Widget\Exception`（如权限不足 403） | 异常自带 code | **显示异常原始 message**（如「禁止访问」） |
| 其余 `Throwable` | code 非数字 / ≤200 时按 500 | 异常 message（生产环境多数致命错误在此暴露为通用页） |

数据库异常被刻意改写文案，避免把库账号、SQL、表结构泄露给访客。
`Response::setStatus()` 设置 HTTP 状态码后输出内置极简错误页并 `exit(1)`。

### 2.1 404 走主题，不走错误页

生产处理器对 `getCode() == 404` 的异常调用
`Widget\ExceptionHandle::alloc()`——最终渲染当前主题的 `404.php`
（没有则回退）。所以"404 页面样式变了 / 报错"属于**主题层问题**，
按主题技能排查，而不是按核心错误排查。

### 2.2 自定义异常模板

`Common::error()` 在输出前检查：

```php
if (defined('__TYPECHO_EXCEPTION_FILE__')) {
    require_once __TYPECHO_EXCEPTION_FILE__;
}
```

在 `config.inc.php` 中定义该常量指向一个 PHP 文件，即可替换生产错误页。
模板内可直接使用 `$code`（状态码）与 `$message`（已脱敏、已 `nl2br`）。
用途：品牌化错误页，或在受限主机上把异常详情**写入站点外的私有日志文件**
（不要写进 Web 可访问目录）。

## 3. SQL 异常里到底有什么

适配器抛异常的位置（以 `var/Typecho/Db/Adapter/Mysqli.php` 为例）：

```php
// 连接失败
throw new ConnectionException("Couldn't connect to database.", mysqli_connect_errno());

// 查询失败
throw new SQLException($this->dbLink->error, $this->dbLink->errno);
```

即：

- 异常 message 是**数据库引擎自身的错误文本**（如 `Table 'xxx.typecho_foo' doesn't exist`），
  异常 code 是引擎错误号；
- 异常**不携带出错的 SQL 语句**。

调试模式下完整堆栈能指出抛出位置（`Db::query()` → 适配器），
但拿到具体语句要在调用侧自行转换。`Db::query()` 内部对 Query 对象的处理是：

```php
$this->adapter->query(
    $query instanceof Query ? $query->prepare($query) : $query,
    $handle, $op, $action, $table
);
```

因此在可疑查询前临时打印：

```php
$debugSql = $query instanceof \Typecho\Db\Query ? $query->prepare($query) : (string) $query;
error_log('[typecho-debug] ' . $debugSql);
```

生产脱敏把引擎文本也藏掉了，所以 SQL 类问题**必须开调试模式或查日志**，
盯着 `Database Query Error` 这行字本身无法定位。

## 4. 日志从哪里找

Typecho 核心本身不写文件日志（除备份等明确功能外），排错依赖的是宿主环境：

| 环境 | 首选位置 / 手段 |
| --- | --- |
| Nginx + PHP-FPM（Linux） | Nginx `error_log`（常见 `/var/log/nginx/error.log`）；FPM 池日志（`/var/log/php-fpm/`、`/var/log/php8.x-fpm.log` 等） |
| Apache（Linux） | `/var/log/apache2/error.log` 或 `/var/log/httpd/error_log`；面板主机多在站点 `logs/` 目录 |
| IIS（Windows） | 事件查看器 → Windows 日志 → 应用程序；PHP `error_log` 指令指定的文件 |
| 宝塔 / cPanel / 虚拟主机 | 面板的"网站日志 / 错误日志"功能；或在文件管理器查看 `logs/` |
| PHP 内置 / CLI | 直接输出到 stderr；先 `php -l` 再 `php index.php` 复现 |

确认当前 PHP 实际把日志写到哪：`phpinfo()` 页面或
`php --ini` 看 `error_log` 配置项。日志被禁用时，临时在
`config.inc.php` 顶部（`Common::init()` 之前）加：

```php
ini_set('display_errors', '1');   // 仅在可短暂暴露的环境使用
error_reporting(E_ALL);
```

这是**临时**手段，定位后立即移除。

## 5. 插件 / 主题隔离为什么有效（自动加载与幽灵插件）

### 5.1 插件类的自动加载

`Common::init()` 注册的 autoloader 把类名映射到插件路径：

- 下划线风格 `Foo_Plugin` → `usr/plugins/Foo/Plugin.php`
  （`Foo_Bar_Baz` → `usr/plugins/Foo/Bar/Baz.php`）；
- 命名空间风格 `\TypechoPlugin\Foo\Plugin` 同样映射到
  `usr/plugins/Foo/Plugin.php`；
- 文件不存在时 autoloader **静默返回**（不报错），随后真正调用回调时
  才因"类不存在"触发 fatal——这正是重命名目录能让插件"停摆"的原理。

### 5.2 幽灵插件的清理解释

后台插件管理页由 `Widget\Plugins\Rows` 渲染：它用 `glob()` 扫描
`usr/plugins/*` 的真实目录，再与 `Plugin::export()` 中的已激活列表比对。
目录已消失但激活记录还在的条目（即"幽灵插件"）会残留到
`$activatedPlugins->activatedPlugins`，页面为其单独渲染「禁用」链接
（`/action/plugins-edit?deactivate=<name>`）。

因此隔离操作的完整闭环是：

1. 重命名肇事目录（让自动加载落空，停止执行坏代码）；
2. 访问一次后台插件管理页（让核心感知文件缺失）；
3. 点击幽灵条目的「禁用」清掉激活记录（恢复时不必先清，改回目录名再启用即可）。

若全站任何页面（包括后台）都在该插件 Hook 上 fatal，无法打开插件页，
最后的手段是由管理员在数据库 `typecho_options` 表中编辑 `plugins` 选项
（PHP serialize 格式），移除对应插件的激活键——操作前务必备份，
且注意序列化长度字段不要手工破坏，优先用 PHP 脚本反序列化改写再写回。

## 6. 调试期安全清单

- `__TYPECHO_DEBUG__`、`display_errors` 只在排错窗口开启，结束立即关闭；
  堆栈里的绝对路径、类名、参数对攻击者是情报。
- 不要把含异常输出的截图 / 日志原样公开发到论坛，先涂掉库地址、账号、绝对路径。
- 所有"动数据库"的排查（改前缀、改 options、修表）之前先导出备份。
- 自定义 `__TYPECHO_EXCEPTION_FILE__` 放在 Web 根之外，且不要在其中输出
  `$exception->getTrace()` 给公网访客。
