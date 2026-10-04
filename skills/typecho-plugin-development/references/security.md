# 插件安全基线

四个原则：**授权（能做吗）、防 CSRF（是本人主动提交吗）、输入过滤、输出转义**。
SQL 安全见 `typecho-database` 技能。

## 1. 授权：校验登录与用户组

通过用户 Widget 判断，不要只靠“菜单没显示”：

```php
/** @var \Widget\User $user */
$user = \Typecho\Widget::widget('Widget_User');

// 未达标直接抛错终止（后台常用）
$user->pass('administrator');

// 只需要布尔结果时第二参数传 true
if ($user->pass('editor', true) && $user->hasLogin()) {
    // ...
}
```

用户组由高到低：`administrator` > `editor` > `contributor` > `subscriber`，
未登录为 `visitor`。面板、动作、AJAX 端点都要在**服务端**校验。

## 2. CSRF：表单令牌

- 使用 Typecho 表单助手（`config()` 中的 `Form`）会自动携带并校验安全字段。
- 自定义表单 / 动作写操作：

```php
// 表单内输出隐藏令牌（在后台 Widget 上下文中）
$this->security->protect();

// 处理 POST 的动作入口处校验
$this->security->protect(); // 令牌不合法时会终止
```

绝不要在 GET 请求上执行删除、修改、同步等状态变更。

## 3. 输入过滤

- 优先用请求对象取值，不直接信任 `$_GET/$_POST/$_COOKIE`：

```php
$id = $this->request->get('id');
if (null !== $id) {
    $id = (int) $id;                 // 数值强制转型
}
$name = $this->request->get('name');
$name = is_string($name) ? trim($name) : '';
```

- 按目标用途校验：数字用 `(int)` / `filter_var`，枚举用白名单，
  URL 用 `filter_var(..., FILTER_VALIDATE_URL)`，邮箱用 `FILTER_VALIDATE_EMAIL`。
- 富文本 / HTML 要走与后台一致的过滤流程，不要原样落库或输出。
- 上传：校验扩展名白名单、MIME、大小，并通过系统上传 Widget 处理，避免自行落盘。

## 4. 输出转义

- 输出到 HTML 文本 / 属性：

```php
echo htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
```

- 输出到 JS：用 `json_encode($value, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_QUOT)`。
- 输出 JSON 响应：用 `$this->response->throwJson(...)` / 响应对象，设置正确头。
- 注意过滤器链：Typecho 的 `content` 过滤后通常是已处理 HTML，不要二次转义，
  也不要把未经处理的用户输入直接拼进 `content` 输出。

## 5. SQL

- 一律查询构造器 + 占位符，表名用 `table.` 前缀；禁止把用户输入拼进 SQL：

```php
$db->select()->from('table.contents')->where('cid = ?', $cid);
```

详见 `../../typecho-database/references/sql-safety.md`。

## 发布前安全自检

- [ ] 所有写操作都有登录 + 用户组校验
- [ ] 自定义表单 / 动作有 CSRF 令牌，且写操作只接受 POST
- [ ] 所有外部输入按用途校验 / 强转
- [ ] 所有回显经转义；JSON 走响应对象
- [ ] 所有查询使用占位符，无字符串拼接 SQL
- [ ] 卸载 / 禁用不执行未授权的删除
