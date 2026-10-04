# Widget 运行时与内置组件

事实来源：核心源码 `var/Typecho/Widget.php`（1.3.0）。1.1 对应
`Typecho_Widget`（`var/Typecho/Widget.php` 的下划线风格），运行模型一致。

## 获取组件实例

### Widget::widget()（静态工厂，对象池单例）

```php
public static function widget(
    string $alias,            // 组件短名或类名（可带 @别名）
    mixed $params = null,     // 构造参数：数组或 'a=1&b=2' 查询串
    mixed $request = null,    // 沙箱请求参数
    bool|callable $disableSandboxOrCallback = true
): Widget
```

```php
use Typecho\Widget;

$options = Widget::widget('Widget_Options');
$recent  = Widget::widget('Widget_Contents_Post_Recent', ['pageSize' => 10]);
// 等价的查询串写法：
$recent  = Widget::widget('Widget_Contents_Post_Recent', 'pageSize=10');
```

- 返回值缓存在对象池中，同一别名默认共享同一实例。
- 在某个 Widget 内部可直接用实例方法 `$this->widget('Widget_Xxx')`。

### alloc() / destroy()

- `MyWidget::alloc($params, $request, ...)`：以 `static::class` 取本类实例
  （自定义 Widget 常用）。`allocWithAlias($alias, ...)` 可带池别名。
- `Widget::destroy('Widget_Xxx')`：从对象池释放；不传别名清空池。
- 历史拼写 `destory()` 已废弃，新代码用 `destroy()`。

### 沙箱参数

第四参数传 `false` 或回调时，会用 `$request` 开启请求 / 响应沙箱执行，结束后恢复，
适合“在任意上下文中模拟一组请求参数来跑某个组件”。常规调用保持默认 `true` 即可。

## 数据堆栈（stack）

Widget 内部把若干“行”压入堆栈，模板 / PHP 用游标逐行读取。

| 方法 | 作用 |
| --- | --- |
| `push(array $row)` | 压入一行，长度 +1 |
| `pushAll(array $rows)` | 压入多行 |
| `next()` | 指针前进一行并返回该行；到末尾重置并返回 `false` |
| `have(): bool` | 堆栈是否非空 |
| `toColumn($col)` | 当前行单列（传数组则取多列的关联数组） |
| `toArray($col): array` | 遍历 `next()` 收集单列 / 多列 |
| `sequence`（属性） | 当前行序号，从 1 开始 |
| `length`（属性） | 数据总行数 |
| `alt(...$args)` | 按序号循环输出参数（斑马纹 class） |
| `on(bool $cond)` | 条件为真返回 `$this`，否则返回空对象（链式条件渲染） |
| `to(&$var)` | 把自身赋给变量并返回 |

```php
if ($recent->have()) {
    while ($recent->next()) {
        echo $recent->sequence . ': ' . $recent->title;
        $recent->alt('odd', 'even');
    }
}

$ids   = $recent->toColumn('cid');
$pairs = $recent->toArray(['cid', 'title']);

$recent->on($recent->have())->title;   // 无数据时安全降级为空对象
```

注意：对象池单例的堆栈一旦被 `next()` 遍历到末尾会重置；需要重复遍历时重新获取
实例或用 `toArray()` 先固化结果。

## 动态属性 ___name 与插件方法 callName

读取 `$widget->name` 时，`__get` 依次尝试：

1. 行数据中的 `#name` 内部键；
2. 本类方法 `___name()`（三个下划线，结果会缓存进行数据）；
3. 行数据中的普通键 `name`；
4. 触发该 Widget 的插件钩子 `___name`（插件可返回值）。

调用 `$widget->someMethod()` 且类上无此方法时，`__call` 触发插件钩子
`callSomeMethod`；若没有插件接管，则等价于 `echo $widget->someMethod`。

```php
class MyWidget extends Widget
{
    protected function ___permalink(): string
    {
        /* $this->permalink 首次访问时计算并缓存 */
    }
}
```

插件侧如何挂载这些钩子见
`../../typecho-plugin-development/references/hooks.md`。

## 模板渲染 template() / parse()

- `template(string $tpl): string`：把模板中的 `{字段}` 占位替换为当前行属性。
- `parse(string $tpl)`：`while ($this->next()) echo $this->template($tpl);`

```php
$recent->parse('<li><a href="{permalink}">{title}</a></li>');
```

占位名匹配 `[_a-z0-9]+`，同样走动态属性取值。

## 自定义 Widget

1.2：

```php
namespace MyPlugin;

use Typecho\Widget;

class Latest extends Widget
{
    public function execute()
    {
        // 取参数：$this->parameter->pageSize（由第二构造参数注入）
        // 拉数据并压栈：
        $this->push(['cid' => 1, 'title' => '示例']);
    }
}

// 调用：
$w = Latest::alloc(['pageSize' => 5]);
// 或 Widget::widget(\MyPlugin\Latest::class, ['pageSize' => 5]);
```

- 构造时已注入 `$this->request`、`$this->response`，构造参数在
  `$this->parameter`（一个 `Config` 对象）。
- `execute()` 在基类是空方法（不再是抽象方法），按需重写；初始化可重写
  `init()`。
- 1.1：`class Latest extends Typecho_Widget`，其余模型相同。
- 想给自定义类注册短名，用 `Widget::alias($widgetClass, $aliasClass)`。

## 常用内置组件短名（1.1 / 1.2 通用）

以下短名由核心注册为别名，调用方式 `Widget::widget('短名')`：

| 短名 | 用途 |
| --- | --- |
| `Widget_Options` | 站点系统配置 + 插件配置（`->plugin('Name')`） |
| `Widget_Archive` | 前台归档主组件（文章 / 页面 / 列表上下文） |
| `Widget_User` | 当前登录用户、登录态、权限判断 |
| `Widget_Security` | CSRF Token、`protect()` / `token()` |
| `Widget_Contents_Post_Recent` | 最新文章（参数 `pageSize`、`type`） |
| `Widget_Contents_Page_List` | 独立页面列表 |
| `Widget_Contents_Post_Date` | 按月 / 日期归档（`type=month&format=F Y`） |
| `Widget_Metas_Category_List` | 分类列表 |
| `Widget_Metas_Tag_Cloud` | 标签云 |
| `Widget_Comments_Recent` | 最新评论 |
| `Widget_Feedback` | 评论提交处理 |
| `Widget_Upload` | 文件上传处理 |
| `Widget_Contents_Post_Edit` / `Widget_Contents_Page_Edit` | 后台文章 / 页面编辑 |

这是常用稳定子集，**完整清单以核心 `var/Widget/`（1.3.0）目录下的类与短名注册为准**，
不要臆造短名。各组件支持的构造参数同样以对应类源码为准。

## 请求与响应

组件内通过属性访问，不要直接用超全局数组：

```php
$this->request->get('cid', 0);     // 取值带默认值
$this->request->isPost();
// $this->response 用于响应输出
```

`$this->request` / `$this->response` 由基类以动态属性提供
（`___request` / `___response`）。
