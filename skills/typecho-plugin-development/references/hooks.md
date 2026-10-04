# Hook 参考

权威完整清单以官方手册为准：<https://docs.typecho.org/plugins/hooks>。
下列内容为高频 Hook 点速查；参数签名务必到核心源码触发点核对后再实现。

## 基本注册语法

在 `activate()` 中注册：

```php
// 动作型：执行操作，无返回值要求
\Typecho\Plugin::factory('admin/menu.php')->navBar = [__CLASS__, 'addMenu'];

// 过滤器型：必须返回处理后的数据
\Typecho\Plugin::factory('Widget\Base\Contents')->content = [__CLASS__, 'parseContent'];

// 带权重：数字越小越早执行（此处优先级为 5）
\Typecho\Plugin::factory('Widget\Base\Contents')->content_5 = [__CLASS__, 'earlyFilter'];
```

## 三种 Hook 类型

- **call（动作型）**：执行操作，可直接输出；不要求返回值。
- **filter（过滤器型）**：接收数据并 `return` 修改结果；不改时也要返回原值。
  内容过滤常见签名为 `($content, $widget, $lastResult)`。
- **trigger（条件型）**：返回 `false` 可阻止默认处理（如自定义上传、头像、密码校验）。

## 回调示例

```php
// 动作型
public static function addMenu()
{
    echo '<a href="#">自定义功能</a>';
}

// 过滤器型：不修改时必须把原值返回
public static function parseContent($content, $widget, $lastResult)
{
    $content = str_replace('[hello]', '<b>你好</b>', $content);
    return $content;
}
```

## 常用 Hook 点速查

### 后台页面

| Hook 点 | Hook 名 | 类型 | 说明 |
|---------|---------|------|------|
| `index.php` | `begin` / `end` | call | 系统启动 / 结束 |
| `admin/common.php` | `begin` | call | 后台公共初始化 |
| `admin/menu.php` | `navBar` | call | 后台导航栏扩展 |
| `admin/header.php` | `header` | filter | 过滤后台头部 |
| `admin/footer.php` | `begin` / `end` | call | 后台底部 |
| `admin/write-post.php` | `content` / `option` / `advanceOption` / `bottom` | call | 写文章页扩展 |
| `admin/write-page.php` | `content` / `option` / `advanceOption` / `bottom` | call | 写页面页扩展 |
| `admin/write-post.php` | `richEditor` | call+trigger | 替换富文本编辑器 |

### 内容归档（Widget\Archive）

`select`(filter, 过滤查询)、`handleInit`、`handle`、`header`、`footer`、
`beforeRender`、`afterRender`，以及各类归档处理：
`indexHandle`、`singleHandle`、`categoryHandle`、`tagHandle`、
`authorHandle`、`dateHandle`、`searchHandle`、`error404Handle`。

### 内容 / 评论数据过滤（Widget\Base\Contents、Widget\Base\Comments）

`filter`、`title`、`excerpt`、`excerptEx`、`markdown`、`autoP`、
`content`、`contentEx`；评论侧同名过滤器作用于评论内容。
另含 `gravatar`（评论头像，trigger）。

### 内容写入与管理（Widget\Contents\Post\Edit / Page\Edit）

`write`(filter, 过滤写入数据)、`finishPublish`、`finishSave`、
`mark`、`finishMark`、`delete`、`finishDelete`。

### 评论反馈（Widget\Feedback）

`comment`(filter)、`finishComment`、`reply`、`cancelReply`、
`trackback` / `finishTrackback`、`pingback` / `finishPingback`。

### 用户与登录（Widget\User / Widget\Login）

`register`(filter)、`finishRegister`、`logout`、
`login`、`hashValidate`(trigger, 自定义密码校验)、
`loginSucceed`、`loginFail`、`simpleLoginSucceed`、`simpleLoginFail`。

### 文件上传（Widget\Upload）

`beforeUpload`、`upload`、`uploadHandle`(trigger)、
`beforeModify`、`modify`、`modifyHandle`(trigger)、
`deleteHandle`(trigger)、`attachmentHandle`(trigger)、`attachmentDataHandle`(trigger)。

## Widget 动态扩展

### 动态属性（三个下划线前缀）

```php
// 注册：模板中以 $this->readTime 访问
\Typecho\Plugin::factory('Widget\Archive')->___readTime = [__CLASS__, 'getReadTime'];

public static function getReadTime($archive)
{
    $words = mb_strlen(strip_tags($archive->content), 'UTF-8');
    return (int) ceil($words / 300);
}
```

### 动态方法（call 前缀 + 首字母大写方法名）

```php
// 注册：模板中以 $this->customMethod() 调用
\Typecho\Plugin::factory('Widget\Archive')->callCustomMethod = [__CLASS__, 'handleCustomMethod'];

public static function handleCustomMethod($archive, $args)
{
    echo '<div>' . htmlspecialchars($archive->title, ENT_QUOTES, 'UTF-8') . '</div>';
}
```

## 排错

- Hook 不触发：Hook 点字符串、Hook 名拼写与源码触发点不一致；未在 `activate()` 注册。
- 内容被清空：过滤器忘记 `return`。
- 顺序不符预期：多个插件挂同一 Hook 时，用 `_数字` 权重显式控制。
