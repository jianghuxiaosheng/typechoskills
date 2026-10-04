# 内容渲染链路与输出 Hook

事实来源：Typecho 1.3.0 源码 `var/Widget/Base/Contents.php`、
`var/Typecho/Http/Client.php`。本文回答两个问题：

1. 一篇文章从数据库行到模板里 `$this->content` 的 HTML，中间经过哪些处理、
   插件可以在哪些 Hook 上介入；
2. 密码文章、`<!--more-->`、`<!--markdown-->`、自定义字段分别在哪一层生效。

## 1. 四个数据层次

| 属性 / 方法 | 含义 | 是否已渲染 |
| --- | --- | --- |
| `$this->row['text']` | 数据库原始文本，可能带 `<!--markdown-->` 前缀 | 否（原始） |
| `$this->text` | 去掉 markdown 前缀的正文；附件 / 密码文章有特殊形态 | 否 |
| `$this->content` | 最终 HTML（markdown 转换或 autoP 之后，再过末端 Hook） | 是 |
| `$this->excerpt` | `<!--more-->` 之前的部分，或经摘要 Hook 处理的结果 | 是（HTML） |

模板里 `$this->content('阅读更多')` 是**输出方法**（直接 echo），不是取字符串；
要拿字符串用 `$this->content` 属性访问（触发 `___content()` 惰性解析）。

## 2. 入栈：push() → filter()

每行数据压栈时（Contents.php L341-363）：

1. 补默认空值：`title` / `text` / `slug` / `password` 缺省为 `''`；
2. `$row['date'] = new Date($row['created'])`；
3. 末端交给 Hook：`filter('filter', $row, $this)`（handle
   `Widget\Base\Contents`，归一化后与
   `\Typecho\Plugin::factory('Widget\Base\Contents')` 同一 key）。

想在**所有内容属性被访问之前**统一改写行数据（注入虚拟字段、改默认值），
挂这个 `filter` Hook，回调签名 `function (array $row, $host): array`。

## 3. content 渲染链（重点）

`___content()`（L846-860）的完整顺序：

```text
hidden（密码文章未解锁）？ ──是──▶ 直接返回 $this->text（密码表单 HTML）
        │否
        ▼
trigger filter 'content' ($this->text, $this)
        │
        ├─ 被插件接管（$plugged = true）：用插件返回值，跳过内置渲染
        │
        └─ 未接管：
              isMarkdown ──是──▶ markdown()：trigger filter 'markdown'，
              │                  未接管则回退 \Utils\Markdown::convert()
              │否
              └──▶ autoP()：trigger filter 'autoP'，
                              未接管则回退 \Utils\AutoP->parse()
        ▼
末端 filter 'contentEx' ($content, $this) ──▶ 返回
```

要点：

- **`content` 是 trigger（可接管）型 Hook**：一旦有插件注册并返回，核心的
  markdown / autoP 渲染整体跳过，由插件负责产出 HTML。
- **`markdown` / `autoP` 也是 trigger 型**：可替换解析器（例如换成自己的
  Markdown 引擎），不接管时核心用内置实现。
- **`contentEx` 是普通 filter**：在渲染结果上做后处理（追加版权、加阅读时间等），
  多个插件可叠加。本仓库示例插件 DemoKit 就挂 `contentEx` 追加"阅读时长"。
- `content` / `contentEx` 回调第二参数都是内容宿主 widget（通常是
  `Widget\Archive`），可用 `$host->is('post')` 等判断场景。

## 4. `<!--markdown-->` 前缀

- 判定（`___isMarkdown()` L583-586）：
  `0 === strpos($this->row['text'], '<!--markdown-->')`。
- 该前缀固定 **15 个字符**，`___text()`（L577）在 markdown 文章上
  `substr($this->row['text'], 15)` 去掉它，所以 `$this->text` 不含前缀。
- 写导入 / 同步插件时：想让文章按 Markdown 渲染，落库 text 必须以此前缀开头；
  不带前缀则按 autoP（纯文本自动分段）处理。

## 5. `<!--more-->` 与 content() / excerpt

- 输出方法 `content($more = false)`（L380-386）：当正文含 `<!--more-->`
  且 `$more !== false` 时，输出 `$this->excerpt` 并追加
  `<p class="more"><a href="永久链接">{$more}</a></p>`；否则输出完整 `$this->content`。
- `___excerpt()`（L777-787）链路：

  ```text
  hidden ──是──▶ 返回 $this->text
        │否
        ▼
  filter 'excerpt' ($this->content, $this)
        ▼
  explode('<!--more-->', ...) 取第一段
        ▼
  Common::fixHtml(...) 修复被截断的 HTML 标签
        ▼
  filter 'excerptEx' ($excerpt, $this)
  ```

- 输出方法 `excerpt(int $length = 100, string $trim = '...')`（L394-397）
  输出的是 `subStr(strip_tags($this->excerpt), 0, $length, $trim)`——**纯文本**。
- `$this->plainExcerpt`（L794-799）：对 `excerpt` 去标签、去换行，截 100 字；
  为空时退化为标题。常用于 feed / meta description。
- `$this->summary`（L867-876）：取渲染后内容的第一个块级元素（p / blockquote /
  q / pre / table 及其闭合标签），不是按 `<!--more-->` 切的。

## 6. 密码保护文章（hidden）

`___hidden()`（L593-605）在**同时满足**以下四条时为 `true`：

1. 文章设置了非空 `password`；
2. Cookie `protectPassword_{cid}` 的值不等于文章密码；
3. 当前用户不是作者（`authorId != $this->user->uid`）；
4. `$this->user->pass('editor', true)` 不通过（编辑以上始终可见）。

hidden 时各层表现：

- `$this->title` 变成「此内容被密码保护」（L549-552）；
- `$this->text` 变成带 CSRF token 的密码输入表单（POST 到文章永久链接，
  字段 `protectPassword` / `protectCID`，L567-575），而不是正文；
- `$this->content` 与 `$this->excerpt` 直接返回这个 `$this->text`，
  **不经过任何内容 Hook**——因此挂 `content` / `contentEx` 的插件在
  未解锁访客读到的密码表单上不会运行，不要假设 Hook 必然触发。

访客提交密码后由核心验证并种 `protectPassword_{cid}` Cookie。

## 7. 标题 Hook

输出方法 `title(int $length = 0, string $trim = '...')`（L405-413）：

- trigger filter `title`（`$this->title, $this`）：被接管则 echo 插件返回值；
- 未接管：`$length > 0` 时按字符截断，否则原样输出。

## 8. 自定义字段（fields）

`___fields()`（L758-770）按 `cid` 查 `table.fields` 表，逐行返回
`Typecho\Config`：

```php
// $row['type'] === 'json'：解码 str_value
json_decode($row['str_value'], true)
// 其它类型（int/str/...）：取 "{type}_value" 列
$row[$row['type'] . '_value']
```

模板 / 插件中 `$this->fields->字段名` 读取；主题侧声明字段的表单写法见
`../../typecho-theme-development/references/themefields.md`。
字段是惰性查询：访问 `$this->fields` 才查库，一次访问后缓存于行数据。

## 9. 内容相关 Hook 速查

handle 一律为 `Widget\Base\Contents`：

| Hook | 类型 | 签名 | 典型用途 |
| --- | --- | --- | --- |
| `filter` | filter | `($row, $host): array` | 入栈前改写整行 |
| `title` | trigger filter | `($title, $host)` | 接管标题输出 |
| `content` | **trigger** filter | `($text, $host)` | 完全接管正文渲染 |
| `markdown` | **trigger** filter | `($text)` | 替换 Markdown 解析器 |
| `autoP` | **trigger** filter | `($text)` | 替换纯文本分段器 |
| `contentEx` | filter | `($html, $host)` | 渲染后追加 / 改写 HTML |
| `excerpt` | filter | `($html, $host)` | 改摘要来源（在 more 切分前） |
| `excerptEx` | filter | `($html, $host)` | 摘要切分后的后处理 |

trigger 与普通 filter 的差别及注册写法见
`../../typecho-plugin-development/references/hooks.md`。

## 10. 发起 HTTP 请求：Typecho\Http\Client

核心自带 HTTP 客户端（`var/Typecho/Http/Client.php`，基于 curl 扩展）：

```php
use Typecho\Http\Client;

/** @var Client|null $client 无 curl 扩展时为 null，必须判空 */
$client = Client::get();

$response = $client
    ->setHeader('X-Token', $token)
    ->setQuery(['page' => 1])          // query string
    // ->setData(['a' => 1])           // 表单 body，默认 POST
    // ->setJson(['a' => 1], Client::METHOD_PUT)  // JSON body
    ->setTimeout(10)
    ->send('https://example.com/api');

$response->getResponseStatus();        // int 状态码
$response->getResponseHeader('Content-Type');
$response->getResponseBody();          // string
```

方法常量：`Client::METHOD_GET / METHOD_POST / METHOD_PUT / METHOD_DELETE`；
链式方法还有 `setMethod()`、`setCookie()`、`setFiles()`、`setAgent()`、
`setMultipart()`、`setOption()`（透传 curl 选项）。

## 11. 核心没有 Mail 类

1.3.0 的 `var/Typecho/` 下**不存在任何邮件组件**。注册验证信、评论通知、
SMTP 发送全部由第三方插件实现（通常在 `comment` / 用户注册相关 Hook 中
自行用上面的 HTTP Client 调邮件 API，或引入 Composer 邮件库）。
排查"邮件发不出去"不要在核心找开关，见
`../../typecho-debugging/references/debugging-playbook.md` 第 11 节。

## 12. 常见错误

- **挂 `contentEx` 却在密码文章上不生效**：hidden 时渲染链整体短路（见第 6 节）。
- **在 `content` trigger 里返回原文不管渲染**：接管后核心不再做 Markdown 转换，
  插件必须自己产出 HTML；只想追加内容应挂普通 filter `contentEx`。
- **导入文章忘记 `<!--markdown-->` 前缀**：Markdown 源码被当纯文本 autoP，
  符号原样露出。
- **摘要里出现半截 HTML 标签**：直接截 `$this->content` 会截断标签；用
  `$this->excerpt`（有 `fixHtml`）或 `plainExcerpt`（纯文本）。
- **`Client::get()` 当请求方法用**：它是返回客户端实例的静态工厂（可能为
  `null`），发请求要在实例上调 `->send($url)`。
