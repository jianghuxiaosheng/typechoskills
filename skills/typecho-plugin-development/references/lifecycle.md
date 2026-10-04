# 生命周期：activate / deactivate / config

`Typecho\Plugin\PluginInterface` 要求实现四个静态方法，外加你自定义的回调方法。

## activate()

插件启用时执行**一次**，负责登记扩展点：

- 注册 Hook（`Plugin::factory()->hook = callback`）。
- 注册后台面板、前台动作、自定义路由（`Helper::add*`）。
- 必要时初始化选项、创建自定义表。

```php
public static function activate()
{
    \Typecho\Plugin::factory('admin/menu.php')->navBar = [__CLASS__, 'render'];
    \Typecho\Plugin::factory('Widget\Base\Contents')->content = [__CLASS__, 'parse'];

    Helper::addPanel(1, 'HelloWorld/panel.php', _t('示例'), _t('示例'), 'administrator');
}
```

要点：

- 回调统一用 `[__CLASS__, '方法名']`，避免硬编码类名导致改名后失效。
- 注册逻辑只在启用时写入，不要放到文件加载阶段。
- 建表 / 写选项要可重复启用（先判断是否已存在），避免二次启用报错。

## deactivate()

禁用时执行，与 `activate()` **成对**释放：

- `Helper::removePanel()` / `removeAction()` / `removeRoute()` 对应注销。
- 删除临时资源、清空缓存。

```php
public static function deactivate()
{
    Helper::removePanel(1, 'HelloWorld/panel.php');
}
```

- 一般**保留**用户数据（文章、配置），除非插件明确声明“禁用即清理”。
- 漏注销是常见 bug：禁用后后台菜单仍在、旧路由仍可访问。

## config($form)

后台“插件配置”面板，用表单助手声明配置项；Typecho 负责持久化：

```php
public static function config(\Typecho\Widget\Helper\Form $form)
{
    $word = new Text('word', null, 'Hello World', _t('欢迎语'));
    $form->addInput($word);
}
```

## personalConfig($form)

针对单个用户的配置面板，绝大多数插件留空实现即可（接口要求方法存在）。

## 读取插件配置

字段名即 `config()` 中表单元素的 `name`：

```php
// 通过 Options Widget
$word = Widget::widget('Widget_Options')->plugin('HelloWorld')->word;

// 通过 Helper（等价）
$word = Helper::options()->plugin('HelloWorld')->word;
```

- `plugin('HelloWorld')` 传入的是**插件目录名（不带 _Plugin）**，必须与目录一致。
- 读取不到时，先核对目录名、字段名，再检查是否已保存过配置（未保存时取默认值）。

## 启用 / 禁用自检

完成后做一次循环验证：启用 → 配置保存 → 前台 / 后台生效 → 禁用 → 残留清理 → 再次启用，
确认整个过程幂等、无重复注册或重复建表错误。
