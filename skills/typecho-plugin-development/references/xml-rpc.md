# XML-RPC 接口与离线发布

事实来源：Typecho 1.3.0 源码 `var/Widget/XmlRpc.php`、`var/Widget/Action.php`、
`var/Widget/Archive.php`、`var/Widget/Options/General.php`。本文覆盖：
开关三档语义、端点与发现地址、方法族、鉴权与权限映射、Pingback 链路，
以及插件能挂哪些 Hook。

## 1. 端点与开关

XML-RPC 是核心内置 Action：`Widget\Action` 的分发表中
`'xmlrpc' => '\Widget\XmlRpc'`。端点 URL 取 `$options->xmlRpcUrl`，
通常形态为 `index.php/action/xmlrpc`（随伪静态设置变化）。

后台「设置 → 基本设置 → XMLRPC 接口」对应选项 `allowXmlRpc`，
官方表单的三个标签（`var/Widget/Options/General.php`）与实际行为：

| 值 | 后台标签 | 实际行为（XmlRpc::action()） |
| --- | --- | --- |
| `0` | 关闭 | 整个端点抛 `Exception('请求的地址不存在', 404)` |
| `1` | **仅关闭 Pingback 接口** | 发文 / 管理类 API **全部可用**，只是从方法表中 `unset($api['pingback.ping'])` |
| `2` | 打开（安装默认值） | 全部方法可用，含 `pingback.ping` |

注意一个反直觉点：**值为 1 时关掉的恰恰只有 Pingback，文章发布照常**。
排查"客户端能发文但收不到 Pingback"或反向问题时，以此表为准。

## 2. 发现地址：RSD 与 WLW

端点 URL 带查询参数即返回发现文档（无需鉴权，`allowXmlRpc != 0` 即可）：

- `xmlrpc...?rsd`：RSD（Really Simple Discoverability）XML，列出
  WordPress / Movable Type / MetaWeblog / Blogger 四组 API 及各自 apiLink；
- `xmlrpc...?wlw`：Windows Live Writer manifest，声明站点支持的编辑能力
  （关键词、附件上传、分类、页面、草稿、Slug 等）。

前台 `Widget\Archive` 输出的发现标签以 `allowXmlRpc` 为条件：

- `<link rel="EditURI">`（RSD）与 `<link rel="wlwmanifest">`：
  `allowXmlRpc > 0` 时输出（Archive.php L1024-1032）；
- `<link rel="pingback">`（L1020）与响应头 `X-Pingback`（L1321-1322）：
  **仅 `allowXmlRpc == 2`** 时输出。

## 3. CSRF 在 XML-RPC 通道被关闭

`XmlRpc::execute()` 中执行 `$this->security->enable(false)` 关闭 CSRF 保护
——XML-RPC 用每请求携带的用户名 / 密码做认证，不走后台表单 token。
这也是为什么你在 XML-RPC 方法里**不会**也不需要 `security->protect()`。

## 4. 方法族

`action()` 内构建的 `$api` 方法表（方法名 => 回调）按协议族分组：

- **WordPress API**：`wp.getPage` / `wp.getPages` / `wp.newPage` /
  `wp.deletePage` / `wp.editPage` / `wp.getPageList` / `wp.getAuthors` /
  `wp.getCategories` / `wp.newCategory` / `wp.suggestCategories` /
  `wp.uploadFile`、`wp.getUsersBlogs` / `wp.getTags` / `wp.deleteCategory` /
  `wp.getCommentCount` / `wp.getPostStatusList` / `wp.getPageStatusList` /
  `wp.getPageTemplates` / `wp.getOptions` / `wp.setOptions` /
  评论一组（`wp.getComment(s)` / `wp.newComment` / `wp.editComment` /
  `wp.deleteComment` / `wp.getCommentStatusList`）、
  以及 `wp.getProfile` / `wp.getPostFormats` / `wp.getMediaLibrary` /
  `wp.getMediaItem` / `wp.editPost`；
- **Blogger API**：`blogger.getUsersBlogs` / `getUserInfo` / `getPost` /
  `getRecentPosts` / `getTemplate` / `setTemplate` / `deletePost`；
- **MetaWeblog API**：`metaWeblog.newPost` / `editPost` / `getPost` /
  `getRecentPosts` / `getCategories` / `newMediaObject`，
  以及对 Blogger 的别名 `metaWeblog.deletePost` / `getTemplate` /
  `setTemplate` / `getUsersBlogs`；
- **MovableType API**：`mt.getCategoryList` / `getRecentPostTitles` /
  `getPostCategories` / `setPostCategories` / `publishPost`；
- **Pingback**：`pingback.ping`（`allowXmlRpc == 1` 时被注销）。

## 5. 鉴权流程与权限映射

服务端对每个被调用的方法执行 `beforeRpcCall($methodName, $reflectionMethod,
$parameters)`（XmlRpc.php L192-230）：

1. **反射扫描方法形参名**，收集名为 `userName` 和 `password` 的实参；
   两个都凑齐（内部计数减到 0）才进行认证。没有这两个参数的方法不认证。
2. 调 `$this->user->login($auth['userName'], $auth['password'], true)`
   **临时登录**（只在本次请求有效，不种 Cookie；登录语义见 `permissions.md`）。
3. 登录失败：抛 `Exception('无法登录, 密码错误', 403)`。
4. 登录成功后按方法名查表做 `pass($group, true)`；
   **未列入表的方法一律默认要求 `contributor`**。
5. 权限不足：抛 `Exception('权限不足', 403)`；通过则 `$this->user->execute()`
   刷新当前用户上下文。
6. 调用结束 `afterRpcCall()` 执行 `Widget::destroy()` 清组件对象池，
   避免多次调用间身份 / 数据串台。

显式权限映射（表外的都按 `contributor`）：

| 要求组 | 方法 |
| --- | --- |
| `editor` | `wp.newPage`、`wp.deletePage`、`wp.getPageList`、`wp.getAuthors`、`wp.deleteCategory`、`wp.getPageStatusList`、`wp.getPageTemplates`、`mt.setPostCategories` |
| `administrator` | `wp.getOptions`、`wp.setOptions` |

组等级与 403 / 重定向语义见 `permissions.md`。注意 XML-RPC 通道的失败形态
只有 **403 异常**（未登录走不到重定向，因为是临时登录 API 调用）。

## 6. Pingback 处理链

`pingbackPing()` 完成来源校验后构造评论行（`type = 'pingback'`，状态按
`commentsRequireModeration` 决定 `waiting` / `approved`），随后：

```php
// 插件可改写整条 pingback 评论数据（filter 型）
$pingback = self::pluginHandle()->filter('pingback', $pingback, $post);
$insertId = Comments::alloc()->insert($pingback);
// 入库完成后的普通 call Hook
self::pluginHandle()->call('finishPingback', $this);
```

- 想**审核 / 改写 / 丢弃**收到的 Pingback：挂 handle `Widget\XmlRpc` 上的
  filter `pingback`（回调 `($pingback, $post)`，返回改写后的数组；
  配合自身校验可抛出 XML-RPC fault）。
- 想在 Pingback 入库后做通知 / 统计：挂普通 call `finishPingback`。
- 出站 Pingback（文章里的链接被通知到对方站点）由核心在发布流程处理，
  是否暴露接收端点只由 `allowXmlRpc == 2` 决定。

## 7. 原文还是渲染后的 HTML：getPostExtended

XML-RPC 读取文章内容时（如 `wp.getPage` / `metaWeblog.getPost`），
客户端拿到的是渲染 HTML 还是原始 Markdown，按 User-Agent 与选项判断：

UA 含 `wp-iphone`、`wp-blackberry`、`wp-andriod`（源码原拼写）、
`plain-text`（留给第三方强制取原始数据的约定），或选项 `xmlrpcMarkdown`
开启时，返回 `$content->text`（原文）；否则返回 `$content->content`
（按内容渲染链处理后的 HTML）。渲染链细节见
`../../typecho-widget-helper-api/references/content-pipeline.md`。

## 8. 常见问题

- **客户端报 404**：`allowXmlRpc = 0`，或端点 URL / 伪静态规则不对
  （`index.php/action/...` 形态需要 Web 服务器把 PATH_INFO 交给 PHP，
  见 `../../typecho-debugging/references/debugging-playbook.md` 第 6 节）。
- **报 403「权限不足」**：账号组低于方法要求（常见于 subscriber 调发文方法，
  或 editor 调 `wp.getOptions`）。
- **报 403「无法登录, 密码错误」**：账号 / 密码错误，或客户端把邮箱、
  昵称当成了登录名（`login()` 支持用户名或邮箱，但不支持 screenName）。
- **能发文但 Pingback 不通**：`allowXmlRpc = 1`；Pingback 链路完整需要 `2`。
- **自己加的 XML-RPC 方法权限不对**：未注册进权限表的方法默认按
  `contributor`；核心方法表是闭在 `action()` 内的数组，插件扩展协议方法
  需自行评估通过其它 Hook / 独立 Action 暴露端点。
- **多次调用后身份错乱**：核心每次调用后 `Widget::destroy()`，自定义代码
  若缓存了用户实例需自行对齐这一生命周期。
