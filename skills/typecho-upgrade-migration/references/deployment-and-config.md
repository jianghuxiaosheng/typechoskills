# 部署运维与 config.inc.php 深入参考

本文件是 `../SKILL.md` 的深度参考，覆盖 Web 服务器伪静态规则、
`config.inc.php` 的全部可调常量与目录权限。伪静态规则事实来源：
Typecho 1.3.0 核心 `var/Widget/Options/Permalink.php`（Apache 规则由核心
自动生成）与官方 FAQ <https://docs.typecho.org/faq>（Nginx 推荐配置）。

## 1. 伪静态（rewrite）原理

后台「设置 → 永久链接」开启地址重写后，核心会发出一次远程回环请求
（POST `/action/ajax`，带 `X-Requested-With`）验证规则是否生效：

- 验证通过，链接不再带 `index.php`；
- 验证失败，后台会提示并允许"强制开启"（`enableRewriteAnyway=1`），
  但规则仍需你自己配好，否则内页全部 404。

任何规则的本质都一样：**文件 / 目录真实存在时直接返回静态文件，
其余请求全部转给 `index.php`**（PATH_INFO 形态或转发形态）。

## 2. Apache

### 2.1 核心自动写入的规则

在 Apache SAPI 且根目录可写时，Typecho 会自动在站点根创建 `.htaccess`，
首选 PATH_INFO 形态（`<站点子路径>` 由核心按站点 URL 计算，根目录为 `/`）：

```apache
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^(.*)$ /index.php/$1 [L]
</IfModule>
```

FastCGI 模式下 PATH_INFO 兼容性差、验证失败时，核心会改写为 WordPress 式
转发规则（对 FastCGI 兼容性更好，但多一次 redirect）：

```apache
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteBase /
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.php [L]
</IfModule>
```

子目录部署时把 `RewriteBase` 与 `index.php` 前的路径换成实际子路径
（例如 `/blog/`），核心生成时会自动处理；手写时必须自己改。

### 2.2 前提与常见错误

- 需要 `mod_rewrite` 已启用，且虚拟主机允许 `.htaccess`
 （`AllowOverride All`）。
- 核心无法写根目录时后台会明确提示"无法创建 .htaccess"，此时按上面的内容
  手工创建。
- 报 `No input file specified`（官方 FAQ）：在根目录建 / 改 `php5.ini`
  （或对应 `php.ini`）加 `cgi.fix_pathinfo = 1`。

## 3. Nginx

官方 FAQ 推荐的 server 段（把域名、root 路径换成实际值）：

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /home/yourdomain/www/;
    index index.html index.htm index.php;

    if (!-e $request_filename) {
        rewrite ^(.*)$ /index.php$1 last;
    }

    location ~ .*\.php(\/.*)*$ {
        include fastcgi.conf;
        fastcgi_pass 127.0.0.1:9000;
    }

    access_log logs/yourdomain.log combined;
}
```

两个必考点：

1. **PHP 的 location 正则必须是 `~ .*\.php(\/.*)*$`**，不能是
   `~ .*\.php$`。后者不匹配 `index.php/action/...` 形态的 PATH_INFO，
   表现为前台内页 / 后台登录 404。老版本 PHP 可能还需在 `php.ini`
   打开 `cgi.fix_pathinfo = 1`。
2. **后台登录报 405 Method Not Allowed**：Nginx 版本低于 0.7，
   升级到 0.7 及以上（官方 FAQ 原文）。

## 4. IIS

核心不自动生成 IIS 规则，需先安装 **URL Rewrite** 模块，再在站点根的
`web.config` 手工写入与上面等价的规则（依据 Apache / Nginx 规则等价
转换，非核心生成）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="Typecho Rewrite" stopProcessing="true">
          <match url="^(.*)$" ignoreCase="false" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" ignoreCase="false" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" ignoreCase="false" negate="true" />
          </conditions>
          <action type="Rewrite" url="index.php/{R:1}" appendQueryString="true" />
        </rule>
      </rules>
    </rewrite>
  </system.webServer>
</configuration>
```

FastCGI 下若 PATH_INFO 形态异常，把 action 的 `url` 改为 `index.php`
（等价于 Apache 的转发式回退规则）。IIS 排错同样先确认 PHP 处理程序映射
对 `index.php/...` 生效。

## 5. config.inc.php 全景

### 5.1 安装程序生成的最小模板

以下为 1.3.0 安装程序 `install.php` 实际生成的内容（连接参数按向导填写
替换；源码中的英文注释一并保留）：

```php
<?php
// site root path
define('__TYPECHO_ROOT_DIR__', dirname(__FILE__));

// plugin directory (relative path)
define('__TYPECHO_PLUGIN_DIR__', '/usr/plugins');

// theme directory (relative path)
define('__TYPECHO_THEME_DIR__', '/usr/themes');

// admin directory (relative path)
define('__TYPECHO_ADMIN_DIR__', '/admin/');

// register autoload
require_once __TYPECHO_ROOT_DIR__ . '/var/Typecho/Common.php';

// init
\Typecho\Common::init();

// config db
$db = new \Typecho\Db('Mysqli', 'typecho_');
$db->addServer(
    ['host' => 'localhost', 'port' => 3306, 'user' => '...',
     'password' => '...', 'database' => '...', 'charset' => 'utf8mb4'],
    \Typecho\Db::READ | \Typecho\Db::WRITE
);
\Typecho\Db::set($db);
```

要点：

- `new \Typecho\Db($adapter, $prefix)` 第二参数是**表前缀字符串**
  （默认 `typecho_`），不是连接配置；连接配置走 `addServer()`。
- 适配器名：MySQL 为 `'Mysqli'`，PostgreSQL / SQLite 为对应 PDO 适配器；
  SQLite 的配置键是 `dbFile`，默认指向
  `__TYPECHO_ROOT_DIR__ . '/usr/' . uniqid() . '.db'`。
- 注册全局连接用的是 `\Typecho\Db::set($db)`，不是 `setAdapter`。
- 该文件含数据库密码，确保 Web 进程外不可被外部直接读取（正常情况下
  PHP 文件只解析不回显源码，但不应放宽文件权限或把它放进静态目录）。

### 5.2 可在 config.inc.php 使用的常量全集

均已对照 1.3.0 核心源码确认消费点；除"安装模板自带"的 4 个外，其余按需要
再加。

| 常量 | 默认 / 含义 | 消费点 |
| --- | --- | --- |
| `__TYPECHO_ROOT_DIR__` | 站点根绝对路径，模板自带 | 全局路径拼接 |
| `__TYPECHO_PLUGIN_DIR__` | `/usr/plugins`，相对 root，模板自带 | autoloader 加载插件 |
| `__TYPECHO_THEME_DIR__` | `/usr/themes`，模板自带 | 主题扫描 |
| `__TYPECHO_ADMIN_DIR__` | `/admin/`，模板自带 | 后台 URL 与 rootUrl 推算 |
| `__TYPECHO_DEBUG__` | 未定义即生产模式；置 `true` 显示完整异常堆栈 | `Widget\Init::execute()` |
| `__TYPECHO_EXCEPTION_FILE__` | 未定义时输出内置错误页；指向自定义 PHP 模板替换它 | `Common::error()` |
| `__TYPECHO_LANG_DIR__` | `usr/langs`，语言包目录 | `Widget\Init::execute()` |
| `__TYPECHO_BACKUP_DIR__` | `usr/backups`，后台备份输出目录 | 同上 |
| `__TYPECHO_UPLOAD_DIR__` | `/usr/uploads`（`Widget\Upload::UPLOAD_DIR`），附件相对目录 | `Widget\Upload` |
| `__TYPECHO_UPLOAD_ROOT_DIR__` | `__TYPECHO_ROOT_DIR__`，附件物理根；可指向站外存储盘 | `Widget\Upload` |
| `__TYPECHO_UPLOAD_URL__` | 站点 URL；附件访问 URL 前缀，可接 CDN 域名 | `Widget\Upload` |
| `__TYPECHO_COOKIE_OPTIONS__` | PHP `setcookie` 参数数组（expires/path/domain/secure/httponly/samesite） | `Widget\Init::execute()` → `Cookie::setOptions()` |
| `__TYPECHO_SITE_URL__` | 未定义则按请求动态推算；**写死站点 URL**，反代 / 多域名环境常用 | `Widget\Options::execute()` |
| `__TYPECHO_DYNAMIC_SITE_URL__` | 置 `true` 时每请求用当前 rootUrl，适合站点 URL 不固定的环境 | 同上 |
| `__TYPECHO_ROOT_URL__` | 未定义则按请求推算；安装环境设为 `http://localhost`，生产一般不手动定义 | 同上 |
| `__TYPECHO_PLUGIN_URL__` | 未定义则按插件目录 + siteUrl 拼；可改写插件静态资源前缀 | `Widget\Options::___pluginUrl()` |
| `__TYPECHO_THEME_URL__` | 未定义则按主题目录 + siteUrl 拼；可改写主题静态资源前缀 | `Widget\Options::themeUrl()` |
| `__TYPECHO_REWRITE__` | 定义后**忽略后台表单提交的 rewrite 值**（改由配置文件侧控制），适合配置即代码的部署 | `Widget\Options\Permalink` 与 `Options::___index()` |
| `__TYPECHO_GRAVATAR_PREFIX__`（1.3.0） | 头像 URL 前缀，定义后整体替换默认的 `https://secure.gravatar.com/avatar/`，可指向国内镜像 / 自建反代 | `Common::gravatarUrl()` |
| `__TYPECHO_THEME_WRITEABLE__`（1.3.0） | 显式置 `false` 关闭后台在线编辑主题文件（主题编辑器 / 文件修改）；未定义或 `true` 可写 | `Widget\Themes\Edit`、`Widget\Themes\Files` |
| `__TYPECHO_SERVICE_URL__`（1.3.0） | 重写核心服务回调地址（`/action/service` 的外部可达基址），子目录 / 反代场景下修正服务端主动请求地址 | `Widget\Service::getServiceUrl()` |

不要在 `config.inc.php` 定义的**内部常量**（核心自己定义，手动覆盖会破坏
流程）：`__TYPECHO_ADMIN__`（后台入口文件自定义，表示当前运行在 admin
目录）、`__TYPECHO_CLASS_ALIASES__`（`Widget\Init` 定义的旧类名映射）。
安装模板中**不存在** `__TYPECHO_SECURE__` 之类的安全开关，不要凭旧资料添加。

### 5.3 带可选常量的完整示例

```php
<?php
define('__TYPECHO_ROOT_DIR__', dirname(__FILE__));
define('__TYPECHO_PLUGIN_DIR__', '/usr/plugins');
define('__TYPECHO_THEME_DIR__', '/usr/themes');
define('__TYPECHO_ADMIN_DIR__', '/admin/');

// 排错时临时打开，定位后立即删除（详见 typecho-debugging 技能）
// define('__TYPECHO_DEBUG__', true);

// 反代 / 负载均衡后写死对外 URL，避免生成内网地址
// define('__TYPECHO_SITE_URL__', 'https://blog.example.com');

// 附件走独立磁盘与 CDN
// define('__TYPECHO_UPLOAD_ROOT_DIR__', '/data/typecho-uploads');
// define('__TYPECHO_UPLOAD_URL__', 'https://cdn.example.com');
// define('__TYPECHO_UPLOAD_DIR__', '/');   // 相对 UPLOAD_ROOT_DIR 的目录

require_once __TYPECHO_ROOT_DIR__ . '/var/Typecho/Common.php';
\Typecho\Common::init();

$db = new \Typecho\Db('Mysqli', 'typecho_');
$db->addServer([
    'host'     => '127.0.0.1',
    'port'     => 3306,
    'user'     => 'typecho',
    'password' => '********',
    'database' => 'typecho',
    'charset'  => 'utf8mb4',
], \Typecho\Db::READ | \Typecho\Db::WRITE);
\Typecho\Db::set($db);
```

## 6. 目录权限

- 核心原则：PHP 进程只需要对 `usr/`（尤其 `usr/uploads`、`usr/backups`）
  与根目录（自动写 `.htaccess` 时）有写权限；`var/`、`admin/`、
  `index.php` 不应给写权限。
- 升级后因权限出现 500（官方 FAQ）：先对 Typecho 目录 `chmod -Rf 644 *`，
  仍不行再 `chmod -Rf 755 *`。文件给 644、目录给 755 是更精细的常规做法
  （目录需要可执行位才能进入）。
- `usr/uploads` 的写权限缺失会导致附件上传失败，与代码缺陷无关，排错见
  `../../typecho-debugging/SKILL.md`。
- SQLite 部署：`.db` 文件所在目录（默认 `usr/`）必须可写，否则所有写操作
  失败。

## 7. PHP 运行环境速查

| 项目 | 要求（1.3.0） |
| --- | --- |
| PHP | 7.4+ |
| 数据库驱动 | `mysqli`，或 PDO（PostgreSQL / SQLite） |
| 网络 | cURL 扩展或 Socket 支持二选一 |
| 编码 | mbstring 或 iconv 二选一 |
| 文件上传 | `upload_max_filesize` / `post_max_size` 按需调大 |

安装向导会自检这些条件；环境检测项与完整安装流程见
`install-and-upgrade.md` 第 1～2 节。
