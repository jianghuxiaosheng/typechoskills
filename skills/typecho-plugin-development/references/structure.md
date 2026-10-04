# 插件结构与命名

## 目录约定

```
usr/plugins/<PluginName>/
└── Plugin.php        # 必需，插件核心文件
```

- 插件目录名、插件名、插件类名三者保持一致。
- **1.2 起（含 1.3.0）插件必须声明正典命名空间 `TypechoPlugin\<插件名>`**，
  主类在该命名空间内叫 `Plugin`——即 `TypechoPlugin\HelloWorld\Plugin`。
  官方自带插件 `usr/plugins/HelloWorld/Plugin.php` 即此写法。
  1.1 老项目用下划线风格的 `类名_Plugin`（无命名空间），新代码不要回退。
- 可按需引入 `assets/`（静态资源）、`Action/`（动作类）、`views/` 等，
  但核心入口始终是 `Plugin.php`。

## 头部注释（后台据此展示信息）

```php
/**
 * 插件一句话描述
 *
 * @package HelloWorld
 * @author  qining
 * @version 1.0.0
 * @link    https://typecho.org
 */
```

| 标记 | 含义 |
|------|------|
| `@package` | 插件名称 |
| `@author` | 作者 |
| `@version` | 版本号 |
| `@link` | 作者 / 插件链接 |

## 接口实现：命名空间风格与 1.1 写法对照

1.2 / 1.3.0 使用命名空间，1.1 使用下划线伪命名空间；新版保留了大量下划线别名，
但**新代码统一使用命名空间风格**，不要在同一文件混用。

| 用途 | 1.2+ / 1.3.0（推荐） | 1.1（老项目） |
|------|-------------|---------------|
| 插件命名空间 | `namespace TypechoPlugin\<Name>;` | 无，类名 `类名_Plugin` |
| 插件接口 | `\Typecho\Plugin\PluginInterface` | `Typecho_Plugin_Interface` |
| Hook 工厂 | `\Typecho\Plugin::factory()` | `Typecho_Plugin::factory()` |
| 数据库 | `\Typecho\Db` | `Typecho_Db` |
| 表单元素 | `Typecho\Widget\Helper\Form\Element\Text` | `Typecho_Widget_Helper_Form_Element_Text` |
| Widget 字符串名 | `'Widget_Options'`（仍用短名） | `'Widget_Options'` |

## 最小骨架（1.3.0 风格，对照官方 HelloWorld）

```php
<?php
/**
 * Hello World
 *
 * @package HelloWorld
 * @author  you
 * @version 1.0.0
 * @link    https://example.com
 */

namespace TypechoPlugin\HelloWorld;

use Typecho\Plugin\PluginInterface;
use Typecho\Widget\Helper\Form\Element\Text;
use Typecho\Widget;

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

class Plugin implements PluginInterface
{
    public static function activate()
    {
        // 注意：全限定调用，不能在文件头 use Typecho\Plugin（见文末陷阱）
        \Typecho\Plugin::factory('admin/menu.php')->navBar = __CLASS__ . '::render';
    }

    public static function deactivate()
    {
        // 释放资源：与 activate 中的注册成对注销
    }

    public static function config(\Typecho\Widget\Helper\Form $form)
    {
        $word = new Text('word', null, 'Hello World', _t('说点什么'));
        $form->addInput($word);
    }

    public static function personalConfig(\Typecho\Widget\Helper\Form $form)
    {
        // 个人用户配置，一般留空
    }

    public static function render()
    {
        echo '<span class="message success">'
            . htmlspecialchars(
                Widget::widget('Widget_Options')->plugin('HelloWorld')->word,
                ENT_QUOTES,
                'UTF-8'
            )
            . '</span>';
    }
}
```

## 结构护栏

- 只有一个引导入口；不要在文件顶层（方法之外）执行输出、SQL 或写操作。
- 注册动作集中放在 `activate()`；运行期逻辑放在回调方法里。
- 遵循官方编码规范：<https://docs.typecho.org/phpcoding>。

## 致命陷阱：主类文件不能 `use Typecho\Plugin`

插件主类自己就叫 `Plugin`（`namespace TypechoPlugin\HelloWorld; class Plugin`）。
若再在文件头写 `use Typecho\Plugin;`，导入短名 `Plugin` 与同类内类名冲突，
启用时直接致命错误：

```text
Cannot declare class TypechoPlugin\HelloWorld\Plugin because the name is already in use
```

正确做法（官方 HelloWorld 即如此）：**不 use 核心 Plugin，需要时一律全限定
`\Typecho\Plugin::factory(...)`**。`use Typecho\Plugin\PluginInterface` 不受影响
（短名是 `PluginInterface`）。可运行的完整示例见仓库
`../../../examples/plugins/DemoKit/Plugin.php`，静态自检用
`../scripts/audit_plugin.mjs`（会直接报这条冲突）。
