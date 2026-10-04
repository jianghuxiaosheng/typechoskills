# Typecho 排错剧本（症状 → 定位 → 修复）

本文件是 `../SKILL.md` 的深度参考，按"症状"组织。每个剧本给出定位顺序与
依据；底层机制（异常处理器、自动加载、日志位置）见
`debug-mode-and-exceptions.md`。

## 1. 白屏（整页空白，无任何输出）

白屏几乎都是 PHP fatal 被 Web 服务器吞掉，Typecho 来不及渲染错误页。

1. `php -l` 检查最近修改的文件（插件 `Plugin.php`、主题 `functions.php`
   是高发区）。
2. 查 PHP error log（位置见机制参考第 4 节），搜索 `Fatal error` /
   `Parse error`。
3. 临时开 `display_errors` 或 `__TYPECHO_DEBUG__` 复现。
4. 常见根因：
   - PHP 版本不够（1.3.0 需 7.4+，用了箭头函数 / 类型属性等新语法）；
   - 文件上传不完整（升级时传了一半）——按文件大小 / 重新上传排查；
   - 插件 / 主题类找不到、函数重名（两个插件定义同名函数）；
   - 内存不足（`Allowed memory size exhausted`）——查插件的大查询 /
     大循环，必要时临时调大 `memory_limit`。

## 2. 升级后 500 / 后台前台全挂

标准升级只换 `admin/`、`var/`、`index.php`、`install.php`，
`usr/` 原样保留，所以升级后炸点集中在"旧代码跑新核心"：

1. 确认后台升级程序是否已执行（管理员登录后台点「完成升级」）。
   没跑完升级 → 表结构旧 → `Database Query Error`。
2. 禁用全部插件、启用默认主题（后台进不去用目录重命名隔离法，见
   `../SKILL.md` 步骤 3 与机制参考第 5 节）。
3. 确认恢复后逐个启用，锁定不兼容项，找该插件的新版本或按 1.3.0 命名规范适配
   （`../../typecho-plugin-development/references/structure.md`）。
4. 权限类 500：官方 FAQ 建议先 `chmod -Rf 644 *`，仍不行再
   `chmod -Rf 755 *`。
5. 「找不到模板」类异常：后台重新选择一次主题，刷新主题路径记录。

## 3. 数据库连接错误（503）

现象：`Error establishing a database connection`。

1. 用 `config.inc.php` 中**完全相同**的参数在命令行连接验证
   （`mysql -h <host> -P <port> -u <user> -p`）。
2. 常见原因：
   - 账号 / 密码错、库名错、主机不允许远程连接；
   - 数据库服务未运行或端口不对；
   - SQLite：`.db` 文件路径变了或无写权限（默认在 `usr/` 下，
     文件名是安装时 `uniqid()` 生成的）；
   - PHP 缺少对应扩展（MySQL 用 `mysqli`，另可选 PDO 系适配器），
     用 `php -m` 确认。
3. 换服务器后出现：`config.inc.php` 还指着旧库，按新机环境改连接信息。

## 4. 数据库查询错误（500 Database Query Error）

现象：库能连，但某条 SQL 执行失败。开 DEBUG 后异常消息是引擎原文，
堆栈指向调用处。

1. 刚升级完 → 先跑后台升级程序（表结构 / 字段缺失的头号原因）。
2. 表前缀不符：`new \Typecho\Db('Mysqli', 'typecho_')` 第二参数必须与
   实际表名前缀一致；跨环境迁移常见前缀不同。
3. 自定义插件查询：
   - 确认所有表名都用 `'table.xxx'` 让 Db 加前缀，而不是写死
     `typecho_xxx`（见 `../../typecho-database/references/query-builder.md`）；
   - 用 `$query->prepare($query)` 打印最终 SQL，拿去数据库客户端直接执行，
     观察引擎报错；
   - 检查字段名（升级后字段有变过时）、保留字是否用引号列名包裹。
4. 数据损坏类错误：用 `mysqlcheck` / 后台备份核对，先备份再修复。

## 5. Hook（插件回调）不生效

按链路上的每一环逐个排除：

1. **插件已启用？** 后台插件页确认；重命名过目录等于没启用。
2. **Hook 点存在？** 到 `var/` 全局搜 `Plugin::factory('句柄')` 与
   `->方法名(`。核心没触发的钩子，注册了也永远不会响。
3. **句柄和方法名拼对？** 注册时 `Plugin::factory('Widget_Archive')->foo`
   的 `foo` 必须与核心触发处方法名逐字符一致（区分大小写）。
4. **回调可加载？** `Plugin::factory(...)->foo = 'Foo_Plugin::bar';`
   要求 `Foo_Plugin` 能从 `usr/plugins/Foo/Plugin.php` 自动加载、
   `bar` 是 public 静态方法。
5. **签名匹配？** 核心怎么传参就得怎么接；需要"接管"语义的钩子
   （核心侧 `$this->pluginHandle()->trigger($plugged)->xxx(...)` 后
   判断 `$plugged`）必须正常返回值，否则核心会继续执行默认逻辑，
   看起来像"没生效"。
6. **被别的插件覆盖？** 多个插件挂同一钩子时按启用顺序依次回调，
   后一个拿到的是前一个的返回值；临时禁用其他插件验证。
7. **缓存 / opcache？** 清静态化缓存，重启 PHP-FPM。
8. 仍不确认：回调首行 `error_log('fired')`，看日志区分"没进来"与
   "进来了但内部提前 return"。

## 6. 固定链接 / 404 类

- **首页正常，所有内页 404**：Web 服务器缺少把不存在路径转给
  `index.php` 的 rewrite 规则。Nginx 用
  `if (!-e $request_filename) { rewrite ^(.*)$ /index.php$1 last; }`；
  各服务器完整规则见
  `../../typecho-upgrade-migration/references/deployment-and-config.md`。
- **Nginx 后台登录 405**：Nginx 版本低于 0.7，升级 Nginx。
- **PHP location 不匹配 PATH_INFO**：必须写成
  `location ~ .*\.php(\/.*)*$`，写成 `~ .*\.php$` 会导致
  `index.php/action/...` 形态的路径不被当 PHP 处理。
- **Apache `No input file specified`**：`cgi.fix_pathinfo = 1`。
- **单篇文章 404、列表正常**：文章本身状态（草稿 / 未发布 / 权限）
  或自定义路由被插件改乱；禁用最近装的路由类插件验证。

## 7. 登录、会话与权限

- **登录后马上掉线 / 后台一直跳登录**：Cookie 域 / 路径与站点地址不符
  （换域名后后台站点地址没改）；服务器时间错误导致会话 Cookie 立即过期；
  核心以 rootUrl 作为 Cookie 前缀，子目录迁移后需更新站点地址。
- **403「禁止访问」**：已登录但组等级不够。组等级
  administrator(0) < editor(1) < contributor(2) < subscriber(3) < visitor(4)，
  `pass()` 按数字 `<=` 比较；后台面板 / XML-RPC 方法的权限要求见
  `../../typecho-plugin-development/references/permissions.md`。
- **忘记管理员密码**：删除 `config.inc.php` 重装并选择保留原数据库
  （会重建管理员入口），或用数据库工具改用户密码哈希。
- **session 只对登录用户启动**：未登录访客没有 session，这是设计行为，
  调试"会话不生效"类插件时不要误判。

## 8. 后台 / 编辑器 / 上传

- **附件上传失败**：`usr/uploads`（或 `__TYPECHO_UPLOAD_DIR__`
  指向的目录）不存在或无写权限；`php.ini` 的 `upload_max_filesize`、
  `post_max_size` 过小。
- **附件图片不显示**：换域名 / 换协议（http→https）后旧绝对 URL 失效；
  或目录被 Web 服务器规则拦截。
- **后台样式错乱、JS 404**：CDN / 反向代理改写了静态资源路径，
  或升级时 `admin/` 上传不完整。

## 9. 计数、缓存与"显示的内容是旧的"

- **分类 / 标签文章数不准**：后台分类 / 标签管理页全选 →
  【选中项】→【刷新】，重建计数元数据。
- **改了模板不生效**：主题缓存 / 静态化插件 / opcache；逐一清理。
- **文章数 / 评论数对不上**：导入或直接改过库之后，同样用后台刷新重建；
  导入流程见
  `../../typecho-upgrade-migration/references/import-migration.md`。

## 10. XML-RPC / 离线发布

- 404：接口被关（`allowXmlRpc = 0`）或 URL 错。地址为站点的
  `xmlRpcUrl`（通常 `index.php/action/xmlrpc`，伪静态后形态变化）。
- 发文正常但 Pingback 不通：`allowXmlRpc = 1`，后台标签是
  **「仅关闭 Pingback 接口」**——发文 / 管理类方法全部可用，只注销
  `pingback.ping`；Pingback 链路完整需要 `2`（默认值）。
  完整三档语义见
  `../../typecho-plugin-development/references/xml-rpc.md`。
- 鉴权失败：客户端用户名密码即后台账号；未列入权限表的方法默认要求
  contributor，即 subscriber / 访客不能发文，editor 也不能调
  `wp.getOptions` 等（完整方法 / 权限映射同见
  `../../typecho-plugin-development/references/xml-rpc.md`）。
- RSD / WLW 发现地址：`xmlrpc.php?rsd`、`xmlrpc.php?wlw` 形式
  （随路由形态变化），客户端可据此自动发现接口。

## 11. 邮件 / 通知不工作

Typecho 1.3.0 核心**没有 Mail 类**（`var/Typecho/` 下不存在邮件组件），
所有注册通知、评论通知都由第三方插件实现。排查顺序：

1. 确认通知插件已启用且配置了 SMTP / 发送服务；
2. 看插件自己的发送日志与 PHP error log；
3. 用同一 SMTP 参数在独立邮件客户端验证（主机端口、SSL、授权码）；
4. 云主机厂商常封 25 端口，改用 465 / 587。

## 12. 请求外部接口失败（cURL / Socket）

- 安装环境要求 cURL 扩展或 Socket 支持二选一；1.3.0 代码侧统一用
  `\Typecho\Http\Client`（链式 `setHeader/setQuery/setJson/send`），
  不要在新代码里裸写 cURL。
- 典型失败：目标 HTTPS 证书校验失败（CA 包过旧）、超时过短、
  主机出方向防火墙拦截。调试时打印 `getResponseStatus()` 与
  `getResponseBody()`，而不是只看"没反应"。
