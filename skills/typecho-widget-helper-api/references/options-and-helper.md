# 选项读取与常用助手

本篇汇总除“组件实例化 / 表单”之外的高频助手。事实以核心源码
`var/Typecho/`（1.3.0）为准。

## Widget_Options：系统与插件配置

```php
use Typecho\Widget;

$options = Widget::widget('Widget_Options');

$options->title;      // 站点标题
$options->siteUrl;    // 站点地址
$options->description;
$options->keywords;

// 插件配置：参数是插件“目录名”，大小写敏感
$word = $options->plugin('HelloWorld')->word;
```

- 这是读取全局设置与插件配置的**推荐入口**，不要去裸查 `options` 表。
- 系统设置字段以后台“设置”各页写入的 `options.name` 为准；引用前可在
  `Widget_Options` 类 / `options` 表中核对，不要凭记忆拼字段名。
- 插件从未保存配置时，`plugin('Name')->字段` 返回该字段在 `config()` 表单里的默认值。
- 取到的值输出到 HTML 前仍需转义：

```php
echo htmlspecialchars($options->title, ENT_QUOTES, 'UTF-8');
```

插件配置的声明与读取细节见
`../../typecho-plugin-development/references/config-form.md`。

## Config 对象

组件的构造参数被包装成 `\Typecho\Config`（组件内 `$this->parameter`）：

- `Config::factory($params)`：数组、`'a=1&b=2'` 查询串、对象都可转成 Config。
- 属性读取：`$this->parameter->pageSize`；键不存在返回 `null`。

这也是 `Widget::widget('Widget_X', 'pageSize=10')` 能接受查询串的原因。

## Request / Response

组件内：

```php
$this->request->get('cid', 0);   // 带默认值
$this->request->isPost();
$this->request->getMethod();
// $this->response 负责响应输出
```

组件外可用单例：`\Typecho\Request::getInstance()`。

- 一律经请求对象取参，不直接访问 `$_GET/$_POST/$_COOKIE/$_SERVER`。
- 取到的输入仍要按期望类型校验 / 转换后再用于查询或输出。

## Widget\Helper\Layout：HTML 结构助手

表单元素的基类就是 Layout，也可独立用它安全地拼 HTML 节点：

```php
use Typecho\Widget\Helper\Layout;

$box = new Layout('div', ['class' => 'box', 'id' => 'x']);
$box->addItem((new Layout('span'))->html('文本'));
$box->render();      // 或直接 echo $box;
```

常用方法（见 `var/Typecho/Widget/Helper/Layout.php`）：

- `__construct(string $tag, array $attributes = [])`
- `setAttribute($name, $value)` / 属性数组
- `html($content)`：设置内部 HTML（自行确保内容已转义）
- `addItem($node)`：追加子节点
- `setClose(bool)`：是否输出闭合标签
- `render()`：输出

## Helper：面板 / 动作 / 路由 / 选项

1.3.0 中插件助手是 `\Utils\Helper`（`var/Utils/Helper.php`），核心通过类别名
让全局 `\Helper` 可直接调用（`__TYPECHO_CLASS_ALIASES__` 中
`'Helper' => '\Utils\Helper'`）。后台菜单、前台 Action、自定义路由的
`addPanel/addAction/addRoute` 及对应 remove 完整参数与示例在
`../../typecho-plugin-development/references/panels-actions-routes.md`，
本篇不重复。

1.3.0 起还提供一个直接写 `options` 表的助手：

```php
\Helper::setOption(string $name, $value): int
```

- 同步更新内存中的 `Widget_Options` 与数据库 `options` 表（数组自动
  `json_encode`），返回影响行数；`addPanel()` 内部就用它写 `panelTable`。
- 注意它是**系统选项**写入口；插件私有配置仍走插件自己的 config
  （`config()` 表单 + `$options->plugin('Name')`），不要占用系统选项名。

## Common 与版本判断

- `\Typecho\Common::VERSION` 为当前核心版本（triage 脚本即从
  `var/Typecho/Common.php` 读取该常量）。
- 代码中需要按版本分支时，优先判断类 / 方法是否存在，而不是硬比较版本号：

```php
if (class_exists(\Typecho\Plugin::class)) {
    // 1.2 命名空间风格
} else {
    // 1.1 下划线风格
}
```

## 选择助手的优先级

1. 有内置 Widget / 选项能满足 → 用 Widget / Options。
2. 表单类 UI → 用 `Helper\Form` + Element（见 `form-elements.md`）。
3. 简单 HTML 节点 → 用 `Layout`，避免手拼未转义字符串。
4. 数据读写 → 查询构造器（见 `../../typecho-database/references/query-builder.md`），
   不要绕过核心直接连库。
