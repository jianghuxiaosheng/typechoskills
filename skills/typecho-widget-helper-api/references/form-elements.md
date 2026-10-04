# 自建表单：Helper\Form 与元素全集

事实来源：核心源码 `var/Typecho/Widget/Helper/Form.php` 与
`var/Typecho/Widget/Helper/Form/Element.php`（1.3.0）。插件声明式
`config($form)` 的入门写法见
`../../typecho-plugin-development/references/config-form.md`；本篇讲在自建后台
面板 / Action 中**手动构建、取值、校验、渲染**表单，以及完整元素 API。

## 创建表单

```php
use Typecho\Widget\Helper\Form;
use Typecho\Widget\Helper\Form\Element\Text;

$form = new Form(
    null,                       // action，默认当前地址
    Form::POST_METHOD,          // Form::GET_METHOD / Form::POST_METHOD
    Form::STANDARD_ENCODE       // 上传文件用 Form::MULTIPART_ENCODE
);
```

编码常量：`STANDARD_ENCODE`、`MULTIPART_ENCODE`（文件上传必须）、`TEXT_ENCODE`。

## 元素通用构造与链式方法

所有元素继承抽象类 `Form\Element`：

```php
new Element(
    ?string $name = null,        // 字段名（提交键）
    ?array  $options = null,     // Select/Radio/Checkbox 的选项；文本类传 null
    mixed   $value = null,       // 默认值
    ?string $label = null,       // 标签
    ?string $description = null  // 说明文字
);
```

链式方法：

- `label(string)` / `description(string)` / `message(string)`（错误提示）
- `value(mixed)`：设值
- `addRule(...$rules)`：追加校验规则，可多次调用
- `setInputsAttribute($attr, $value)`：统一设置底层 input 的 HTML 属性
  （如批量加 `class`、`placeholder`）

## 元素类型

命名空间根 `Typecho\Widget\Helper\Form\Element\`
（1.1：`Typecho_Widget_Helper_Form_Element_*`）。

| 元素 | 类 | `$options` |
| --- | --- | --- |
| 单行文本 | `Text` | 无 |
| 密码 | `Password` | 无 |
| 多行文本 | `Textarea` | 无 |
| 隐藏域 | `Hidden` | 无 |
| 下拉选择 | `Select` | `['值' => '文案']` |
| 单选组 | `Radio` | `[1 => '开', 0 => '关']` |
| 多选组 | `Checkbox` | 选项数组；值为数组 |
| 文件 | `File` | 无（表单需 `MULTIPART_ENCODE`） |
| 提交按钮 | `Submit` | 无 |

完整列表以 `var/Typecho/Widget/Helper/Form/Element/` 目录为准。

```php
use Typecho\Widget\Helper\Form\Element\Textarea;
use Typecho\Widget\Helper\Form\Element\Select;
use Typecho\Widget\Helper\Form\Element\Checkbox;

$note = new Textarea('note', null, '', _t('备注'));
$mode = new Select('mode', ['a' => _t('A'), 'b' => _t('B')], 'a', _t('模式'));
$tags = new Checkbox('tags', ['x' => 'X', 'y' => 'Y'], ['x'], _t('标签'));
$form->addInput($note)->addInput($mode)->addInput($tags);
```

## addInput 与 addItem

- `addInput(Element)`：登记为**参与提交 / 校验 / 持久化**的字段（`config()` 场景下
  会被自动保存）。
- `addItem(...)`：只加入纯展示节点（说明、按钮、分隔），不参与提交。
- `getInput($name)`、`getInputs()`、`getValues()`（当前各元素值）、
  `getAllRequest()`（已登记字段的本次提交值）。

## 校验

```php
$name->addRule('required', _t('名称不能为空'));
```

- 规则名对应 `\Typecho\Validate` 的校验方法（如 `required`）；完整可用规则以
  `var/Typecho/Validate.php` 为准，不确定时查阅源码，不要臆造规则名。
- `Form::validate(): array` 收集所有已登记字段的规则执行校验，**返回错误数组**
  （无错误返回空数组）。错误信息与提交值会通过 Cookie 记录，`render()` 时自动
  回填并在对应元素下显示错误。

```php
if ($form->validate()) {
    // 存在错误：直接渲染（含错误提示与回填），结束
    $form->render();
    return;
}
$data = $form->getAllRequest();   // 仅含已登记字段
```

## 典型 Action 中的完整流程

```php
// 1) 鉴权 + CSRF
$user->pass('administrator');
$this->security->protect();

// 2) 建表单并加字段、规则
$form = new Form(null, Form::POST_METHOD);
$name = new Text('name', null, null, _t('名称'));
$name->addRule('required', _t('名称不能为空'));
$form->addInput($name);

// 3) POST 时校验
if ($this->request->isPost() && !$form->validate()) {
    $data = $form->getAllRequest();
    // 校验类型 / 长度后再落库（查询构造器 + 占位符）
}

// 4) 渲染（出错时自动回填 + 提示）
$form->render();
```

## 安全要点

- 表单承载写操作时，入口必须先 `$user->pass(...)` 并过
  `$this->security->protect()`（CSRF Token）；后台标准页面框架通常已注入安全字段，
  自建 Action 需自行保证。
- Checkbox / Select 的合法值应在服务端再次白名单校验，不能只靠前端选项。
- `message()`、`description()`、`html()` 写入的是原始 HTML，放入用户内容前必须
  自行转义。
- 文件上传配合 `Widget_Upload` 与核心上传能力处理类型 / 大小校验，不要只依赖
  表单 `accept`。
