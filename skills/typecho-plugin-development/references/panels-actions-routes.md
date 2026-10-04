# 面板、动作与路由（Helper）

需要后台页面或前台可编程入口时，用 `Helper` 在 `activate()` 注册、在
`deactivate()` 对称注销。1.3.0 中 Helper 真身是 `Utils\Helper`
（`var/Utils/Helper.php`），核心通过类别名让全局 `\Helper` 可直接调用
（`var/Widget/Init.php` 的 `__TYPECHO_CLASS_ALIASES__` 中
`'Helper' => '\Utils\Helper'`）；1.1 老项目对应 `var/Helper.php`。
可运行的完整范例见仓库 `../../../examples/plugins/DemoKit/`。

## addPanel / removePanel —— 后台菜单面板

签名（Helper.php）：

```php
\Helper::addPanel(
    int $index,          // 1 控制台；2 撰写；3 管理；4 设置
    string $fileName,    // 'DemoKit/panel.php'，相对插件目录
    string $title,
    string $subTitle,
    string $level,       // 用户组名，如 'administrator'
    bool $hidden = false,
    string $addLink = ''
);
\Helper::removePanel($index, $fileName);
```

```php
public static function activate()
{
    \Helper::addPanel(1, 'DemoKit/panel.php', _t('DemoKit'), _t('示例面板'), 'administrator');
}

public static function deactivate()
{
    \Helper::removePanel(1, 'DemoKit/panel.php');
}
```

`$level` 有**双重作用**：渲染菜单时对不达标用户隐藏入口；当前 URL 与面板
注册 URL 匹配时菜单组件还会以终止模式强制执行一次 `pass()`。即便如此，
面板文件内仍须自行鉴权（defense-in-depth）。完整语义见 `permissions.md`。

### 面板文件的加载契约

面板由 `admin/extending.php` 加载，它在 `require_once` 面板**之前**已经
`include 'common.php'`，因此：

- `$options` / `$user` / `$security` / `$menu` / `$request` / `$response`
  等全局变量已就绪，常量 `__TYPECHO_ADMIN__` 已定义；
- **面板里禁止再 include `admin/common.php`**（重复加载会出错）；
- extending.php 会先做白名单校验（`panelTable` 中必须有该面板注册），
  再按 `explode('/', $panel, 2)` 得到的插件名拼出插件目录路径 require；
- 面板头部自行鉴权，并用**绝对路径**包含后台样式骨架：

```php
<?php
if (!defined('__TYPECHO_ADMIN__')) {
    exit;
}
/** @var \Widget\User $user */
$user->pass('administrator');

$adminDir = __TYPECHO_ROOT_DIR__ . __TYPECHO_ADMIN_DIR__;
include $adminDir . 'header.php';
include $adminDir . 'menu.php';
// ...面板主体...
include $adminDir . 'copyright.php';
include $adminDir . 'common-js.php';
include $adminDir . 'footer.php';
```

完整面板范例：`../../../examples/plugins/DemoKit/panel.php`。

## addAction / removeAction —— 动作端点

动作通过 `index.php/action/<name>` 访问（路由名固定为 `do`）。

```php
// 在 namespace TypechoPlugin\DemoKit; 的 activate() 内：
\Helper::addAction('demokit-sync', Action\Sync::class);
\Helper::removeAction('demokit-sync');
```

命名空间内相对类名 `Action\Sync::class` 会解析为
`TypechoPlugin\DemoKit\Action\Sync`。

### 动作类的正确骨架（1.3.0）

调度器 `Widget\Action::execute()` 合并内置 `$map` 与选项 `actionTable` 后，
用 `Widget::widget()` 实例化指定类（构造器调 `init()`，随后调 `execute()`），
**只有实例 `instanceof Widget\ActionInterface` 才调用 `action()`，否则 404**。
`Widget\ActionInterface` 在命名空间 `Widget`，只有一个方法
`public function action();`。因此动作类的正确形态是：

```php
namespace TypechoPlugin\DemoKit\Action;

use Widget\ActionInterface;
use Widget\Base;

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class Sync extends Base implements ActionInterface
{
    // 注意：必须 public（覆盖 Base 的 execute 时可见性不能收窄）
    public function execute()
    {
        $this->user->pass('administrator'); // Action 入口不自动鉴权
        $this->security->protect();         // 也不自动做 CSRF 校验
    }

    public function action()                // 必须 public，契约要求
    {
        // ...处理 $this->request...
        $this->response->throwJson(['ok' => true]);
    }
}
```

常见错误对照：

- **不要 `extends Typecho\Widget\Action`**：那是调度器自身，不是动作基类；
  需要 `$user` / `$security` / `$options` 装配就 `extends Widget\Base`，
  只想要最轻壳子可直接 `extends Typecho\Widget`。
- **不要写 `protected function action()`**：ActionInterface 要求 public，
  可见性收窄会导致致命错误。
- 动作名带插件前缀（如 `demokit-sync`）避免与其他插件冲突。
- 禁用时必须 `removeAction`，否则类文件消失后命中该动作会致命错误。

### 动作 URL（带 CSRF token 的正典写法）

后台表单 POST 到动作时，用 Security 拼 token URL（对照 `admin/backup.php`）：

```php
$actionUrl = $security->getTokenUrl(
    \Typecho\Router::url('do',
        ['action' => 'demokit-sync', 'widget' => 'Sync'],
        \Typecho\Common::url('index.php', $options->rootUrl))
);
```

## addRoute / removeRoute —— 自定义路由

```php
\Helper::addRoute(
    'demokit_latest',                  // 唯一名（全局，建议带插件前缀）
    '/demokit/latest.json',            // 路径规则，:id 为参数
    Widget\LatestFeed::class,          // 处理 widget（插件命名空间内相对名）
    'action'                           // 命中后调用的方法；可省略
);
\Helper::removeRoute('demokit_latest');
```

Router 命中后实例化该 widget；路由声明里带 action 键时调用
`$widget->{$route['action']}()`。作为可编程端点，处理类同样
`implements Widget\ActionInterface`，鉴权与输出约定与动作一致：

```php
namespace TypechoPlugin\DemoKit\Widget;

use Typecho\Widget;
use Widget\ActionInterface;

class LatestFeed extends Widget implements ActionInterface
{
    public function action()
    {
        // 公开端点可按需鉴权；从 $this->request->id 取路径参数
        $this->response->throwJson(['items' => []]);
    }
}
```

- 注册 / 注销路由后系统需要重建路由表：重新启用插件即可。
- 范例：`../../../examples/plugins/DemoKit/Widget/LatestFeed.php`。

## 安全提醒

- 面板：文件头自行 `$user->pass(...)`，不要只依赖菜单隐藏 / Menu 的间接拦截。
- 动作 / 路由：写操作先 `$this->user->pass(...)` 再 `$this->security->protect()`；
  Action 入口两者都不会自动发生（XML-RPC 通道是唯一例外，见 `xml-rpc.md`）。
- 输出经 `htmlspecialchars` 转义，JSON 用 `$this->response->throwJson()`，
  详见 `security.md`。

## 静态自检

启用前可用审计脚本检查 add/remove 是否配对、Hook 回调是否存在：
`../scripts/audit_plugin.mjs`（对项目根或插件目录运行）。
