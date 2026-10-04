# 配置表单（config / personalConfig）

插件通过 `config(\Typecho\Widget\Helper\Form $form)` 声明后台配置项，
Typecho 负责渲染、校验与持久化，开发者不需要手写建表或保存逻辑。

## 表单元素构造参数

大多数元素共用签名：

```php
new Element($name, $options = null, $value = null, $label = null, $description = null);
```

| 参数 | 含义 |
|------|------|
| `$name` | 配置项名（保存后用 `->plugin('Name')->$name` 读取） |
| `$options` | 选项数组，仅 Select / Radio / Checkbox 需要；文本类传 `null` |
| `$value` | 默认值 |
| `$label` | 表单标签文案，用 `_t()` 包裹 |
| `$description` | 字段说明（可选） |

## 常用元素

命名空间根：`Typecho\Widget\Helper\Form\Element\`（1.1：`Typecho_Widget_Helper_Form_Element_*`）

```php
use Typecho\Widget\Helper\Form\Element\Text;
use Typecho\Widget\Helper\Form\Element\Textarea;
use Typecho\Widget\Helper\Form\Element\Password;
use Typecho\Widget\Helper\Form\Element\Select;
use Typecho\Widget\Helper\Form\Element\Radio;
use Typecho\Widget\Helper\Form\Element\Checkbox;

// 文本框
$word = new Text('word', null, 'Hello World', _t('欢迎语'), _t('显示在导航栏'));
$form->addInput($word);

// 下拉选择
$mode = new Select('mode', ['a' => _t('模式 A'), 'b' => _t('模式 B')], 'a', _t('模式'));
$form->addInput($mode);

// 单选
$open = new Radio('open', [1 => _t('开启'), 0 => _t('关闭')], 1, _t('是否开启'));
$form->addInput($open);

// 多行文本
$note = new Textarea('note', null, '', _t('备注'));
$form->addInput($note);
```

可用元素类型以源码为准：
`var/Typecho/Widget/Helper/Form/Element.php` 及 `Element/` 目录
（Text、Textarea、Password、Hidden、Select、Radio、Checkbox、File、Submit 等）。

## addInput 与 addItem

- `$form->addInput($element)`：登记一个**需要持久化**的配置项。
- `$form->addItem($element)`：加入一个不参与保存的元素（如说明、按钮）。

## 校验规则

```php
$word->addRule('required', _t('欢迎语不能为空'));
```

规则按 Form 助手提供的校验器执行；自定义校验可传回调。需要保存前处理时，
优先考虑在读取处或过滤器里处理，而不是改表单提交逻辑。

## 读取配置

```php
$options = \Typecho\Widget::widget('Widget_Options');
echo htmlspecialchars(
    $options->plugin('HelloWorld')->word,
    ENT_QUOTES,
    'UTF-8'
);
```

- 插件名参数是**目录名**，区分大小写，与 `@package` 对应。
- 用户从未保存配置时，取元素的默认值。

## personalConfig

签名同为 `personalConfig(\Typecho\Widget\Helper\Form $form)`，用于“每个用户各自一份”
的配置，普通插件留空实现即可（接口要求方法存在）。
