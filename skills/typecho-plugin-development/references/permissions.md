# 用户组与权限矩阵

事实来源：Typecho 1.3.0 源码 `var/Widget/User.php`、`var/Widget/Menu.php`、
`var/Widget/Logout.php`。安全编码总则见同目录 `security.md`；本文只讲
**权限判定本身**：用户组怎么比、`pass()` 失败后会发生什么、在面板 / Action /
路由三类入口分别在哪里做鉴权。

## 1. 五个用户组

`Widget\User::$groups`（User.php L31-37）：

```php
public array $groups = [
    'administrator' => 0,
    'editor'        => 1,
    'contributor'   => 2,
    'subscriber'    => 3,
    'visitor'       => 4,   // 未登录访客
];
```

**数字越小权限越大**。判定式（User.php L269）：

```php
array_key_exists($group, $this->groups)
    && $this->groups[$this->group] <= $this->groups[$group]
```

即要求 `editor` 时，`administrator`(0) 与 `editor`(1) 通过，
`contributor`(2) 及以下不通过。传入不存在的组名一律不通过。

典型能力边界（供选择 `pass()` 参数时参考）：

| 组 | 典型能力 |
| --- | --- |
| `administrator` | 全站一切：设置、插件、主题、用户、所有内容 |
| `editor` | 审核 / 编辑 / 删除所有文章与评论、写独立页面 |
| `contributor` | 投稿者：写文章，通常不能直接发布 / 审核 |
| `subscriber` | 仅登录、维护自己的资料 |
| `visitor` | 未登录访客，只有前台只读权限 |

## 2. pass() 的签名与三种结局

```php
$user->pass(string $group, bool $return = false): bool
```

| 情形 | `$return = false`（默认，终止模式） | `$return = true`（布尔模式） |
| --- | --- | --- |
| 已登录且达标 | 返回 `true`，继续执行 | 返回 `true` |
| 未登录 | **302 重定向**：后台（定义了 `__TYPECHO_ADMIN__`）跳 `loginUrl`，带 `?referer=`（若 referer 本身已是登录页则不带，防循环）；前台跳 `siteUrl` | 返回 `false` |
| 已登录但等级不够 | **抛 `Widget\Exception('禁止访问', 403)`** | 返回 `false` |

两种用法都常见：

```php
// 入口守卫：不达标就不要继续（后台面板 / Action 首选）
$this->user->pass('editor');

// 条件分支：只想知道能不能做
if ($this->user->hasLogin() && $this->user->pass('administrator', true)) {
    // 管理员专属逻辑
}
```

注意：302 与 403 的区分对调试很重要——**收到登录跳转说明根本没登录**，
**收到 403「禁止访问」说明登录了但组不够**。排查见
`../../typecho-debugging/references/debugging-playbook.md` 第 7 节。

## 3. 三类入口的鉴权位置

核心只负责调度，**不会替你的入口做业务鉴权**（后台菜单除外，见下节）。

### 后台面板（addPanel 注册）

面板文件由 `admin/extending.php` 在 `include 'common.php'` 之后
`require_once` 加载，`$user` 等全局变量已就绪。文件内**必须自己守一行**：

```php
if (!defined('__TYPECHO_ADMIN__')) {
    exit;
}
$user->pass('administrator');   // 按面板实际需要选组
```

### Action（addAction 注册 / 内置 Action 表）

Action 入口没有任何自动鉴权，也没有自动 CSRF 校验。`execute()` 中两件都要做：

```php
public function execute()
{
    $this->user->pass('administrator'); // 鉴权
    $this->security->protect();         // CSRF：token 不合法会 goBack()
}
```

`Widget\Action` 调度时要求实例 `instanceof ActionInterface` 才调用 `action()`，
否则 404；覆盖 `execute()` 时可见性必须保持 `public`。
完整契约见 `panels-actions-routes.md`。

### 自定义路由（addRoute 注册）

路由命中后实例化指定 widget，若路由带 `action` 键则调用该方法。
端点同样要自己鉴权；需要返回 404 式响应时抛 `Widget\Exception` 或用
`$this->response` 的 `throwJson()` / `throwContent()` 等方法。

## 4. addPanel 的 $level：菜单可见性 + 命中时强制鉴权

`Helper::addPanel($index, $fileName, $title, $subTitle, $level, ...)` 的
`$level` 传一个组名，它在 `var/Widget/Menu.php` 中有**两处**作用：

1. **菜单渲染时**（L216）：`!$this->user->pass($access, true)` 为真则
   把该菜单项标记隐藏——低权限用户在侧边栏看不到入口。
2. **当前 URL 与注册面板 URL 匹配时**（L243-246）：只要 `$access` 不是
   `'visitor'`，菜单组件会以**终止模式**调用 `$this->user->pass($access)`
   ——即未登录跳登录页、等级不够直接 403。

因此面板被直接访问（不靠点菜单）时也有一层来自 Menu 的强制鉴权。
但这属于框架层的间接保护，**面板文件内仍应显式 `pass()`**（defense-in-depth），
不要依赖"菜单组件恰好会拦"这一实现细节。

## 5. 登录、临时登录与 Cookie

完整签名（User.php）：

```php
public function login(
    string $name,
    string $password,
    bool $temporarily = false,
    int $expire = 0
): bool;

public function simpleLogin(
    $uid,                       // 用户 uid（int）或完整 user 行（array）
    bool $temporarily = true,   // 注意默认值与 login() 相反
    int $expire = 0
): bool;
```

- `login()`：先按 `name` 查用户，查不到且名字含 `@` 时回退按邮箱 `mail` 查；
  密码哈希以 `$P$` 开头走 `PasswordHash`，其余走 `Common::hashValidate()`
  （两者均可被 `hashValidate` Hook 接管）。
- **持久登录**（`$temporarily = false`）由 `commitLogin()` 种两个 Cookie：
  `__typecho_uid` 与 `__typecho_authCode`（存库的是随机 authCode，
  Cookie 里放其哈希），并更新用户行的 `logged`/`authCode`。
- **临时登录**（`$temporarily = true`）只在当次请求内 push 用户数据、
  置 `hasLogin`，不写 Cookie——XML-RPC 每调用一次方法就是这样临时登录的。
- `simpleLogin()`：供插件等特殊场合免密切换身份（如 SSO 回调），
  默认就是临时登录；传完整 user 行时不再查库。用户不存在时触发
  `simpleLoginFail` 并返回 `false`。

## 6. 登录 / 登出相关 Hook 一览

Hook handle 均为 `Widget\User`（归一化 key 与
`Plugin::factory('Widget\User')` 一致）：

| Hook | 类型 | 触发位置与参数 |
| --- | --- | --- |
| `login` | **trigger（可接管）** | `login()` 开头，参数 `($name, $password, $temporarily, $expire)`；插件返回 true 即完全接管登录流程 |
| `hashValidate` | **trigger（可接管）** | 校验密码前，参数 `($password, $hash)`；插件返回 true 即视为密码正确 |
| `loginSucceed` | 普通 call | 登录成功后，`($this, $name, $password, $temporarily, $expire)` |
| `loginFail` | 普通 call | 登录失败后，参数同上 |
| `simpleLoginSucceed` | 普通 call | `($this, $user)` |
| `simpleLoginFail` | 普通 call | `($this)` |
| `logout` | **trigger（可接管）** | `User::logout()` 开头；被接管时核心不删除登录 Cookie |

另有一个**容易混淆的同名 Hook**：handle `Widget\Logout` 上的普通 call
`logout`，在 `var/Widget/Logout.php` 的 `action()` 中、
`$this->security->protect()`（CSRF）通过且调用完 `$this->user->logout()`
之后触发。想在"用户点了登出且登出动作完成"时做事，用这个；
想接管/改写登出流程，用 `Widget\User` 上的 trigger 版。

## 7. XML-RPC 的权限

XML-RPC 方法由 `beforeRpcCall` 用反射从方法参数中收集 `userName` /
`password`，调 `login(..., true)` 临时登录，再按方法名映射组做
`pass($group, true)`，失败抛 403；未列入映射的方法默认要求 `contributor`。
完整方法 / 组映射表见 `xml-rpc.md`。

## 8. 常见错误

- **只在菜单里藏入口，不在面板 / Action 里 `pass()`**：直接构造 URL 仍可访问。
- **Action 只 `pass()` 不 `protect()`**：存在 CSRF 风险；写操作两者都要。
- **用 `$this->user->group` 自己比数字 / 字符串**：应一律走 `pass()`，
  避免组名拼写错误或等级语义记反。
- **把 `simpleLogin()` 当持久登录**：它默认 `temporarily = true`，
  需要记住登录态必须显式传第二参数 `false`。
- **在 trigger `login` / `hashValidate` 里无条件 return true**：等于放开任意密码，
  接管后必须自行完成等价校验。
