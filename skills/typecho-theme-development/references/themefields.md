# themeFields 主题配置

在 `functions.php` 中定义 `themeFields($layout)`，即可在后台“外观 → 启用主题”
处自动生成与该主题绑定的配置表单。用户保存后，模板里直接通过
`$this->options->字段名` 读取。

## 基本写法

```php
<?php
function themeFields($layout)
{
    $logoUrl = new \Typecho\Widget\Helper\Form\Element\Text(
        'logoUrl',                          // 字段名
        null,                               // 选项（文本框为 null）
        null,                               // 默认值
        _t('站点 LOGO 地址'),                // 标签
        _t('填入图片 URL，在站点标题前显示')  // 说明
    );
    $layout->addItem($logoUrl);
}
```

1.1 旧式类名等价为 `Typecho_Widget_Helper_Form_Element_Text`。

## 支持的元素

与插件配置表单一致，命名空间 `Typecho\Widget\Helper\Form\Element\`：

- `Text`：单行文本（URL、名称）
- `Textarea`：多行文本（统计代码、自定义 CSS）
- `Select` / `Radio`：枚举开关（带选项数组）
- `Checkbox`：多选
- `Password`、`Hidden` 等

开关示例：

```php
$showSidebar = new \Typecho\Widget\Helper\Form\Element\Radio(
    'showSidebar',
    [1 => _t('显示'), 0 => _t('隐藏')],
    1,
    _t('是否显示侧栏')
);
$layout->addItem($showSidebar);
```

## 模板中读取

```php
<?php if (!empty($this->options->logoUrl)) : ?>
  <img src="<?php echo htmlspecialchars($this->options->logoUrl, ENT_QUOTES, 'UTF-8'); ?>" alt="logo" />
<?php endif; ?>

<?php if (empty($this->options->showSidebar)) : /* 隐藏侧栏 */ endif; ?>
```

## 护栏

- 字段名全局唯一且只用合法变量名字符（如 `logoUrl`），避免与系统选项冲突，建议加主题前缀。
- 用户未保存时字段为默认值或 `null`，模板必须做 `empty()` / `isset()` 判空。
- URL / 文本输出到 HTML 前转义；自定义 CSS / JS 类字段要明确信任边界。
- `functions.php` 内只做定义与轻量辅助函数，避免在加载期执行查询或输出。

参考：<https://docs.typecho.org/themes/custom-themefields>。
