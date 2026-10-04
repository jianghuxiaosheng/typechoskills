---
name: typecho-widget-helper-api
description: "Use for Typecho's Widget runtime and Helper APIs: instantiating built-in widgets via Widget::widget()/alloc() with string short names (Widget_Options, Widget_Archive, Widget_User, Widget_Security, recent posts/categories/comments, etc.), iterating the data stack (next/have/push), template()/parse() token rendering, toColumn()/toArray(), on()/to()/alt(), dynamic ___property and plugin callMethod extension, custom Widget subclasses, reading system/plugin options, request/response access, and building standalone backend forms with Widget\\Helper\\Form + Element and validators."
compatibility: "Verified against Typecho 1.3.0 (minimum PHP 7.4); APIs also apply to 1.2.x. 1.2+ uses \\Typecho\\Widget and \\Typecho\\Widget\\Helper\\* (the plugin Helper is \\Utils\\Helper aliased as \\Helper); 1.1 uses Typecho_Widget / Typecho_Widget_Helper_*. Built-in widget string short names (e.g. 'Widget_Options') work on both versions. Filesystem-based agent; PHP syntax check with php -l."
---

# Typecho Widget & Helper API

## When to use

- 在插件 / 主题 `functions.php` / 自定义代码中调用内置组件（取配置、当前用户、
  近期文章 / 分类 / 评论、安全 Token 等）。
- 遍历一个 Widget 的数据堆栈，或用 `template()/parse()` 渲染列表。
- 编写自定义 Widget 子类（`execute()` + `push()`）。
- 用 `\Typecho\Widget\Helper\Form` 在自建后台面板 / Action 中搭建表单并校验。
- 读取系统选项或某插件的配置值。
- 需要区分 1.2 命名空间类名与两版通用的 Widget 短名。

不要用于：插件配置表单的声明式 `config($form)`（见
`../typecho-plugin-development/references/config-form.md`，本篇是它的深入底层）；
直接数据库查询（`typecho-database`）；主题模板里的循环标签
（`../typecho-theme-development/references/template-tags.md`）。

## Inputs required

- 站点根目录与调用点所在文件（插件 / 主题 / 自定义面板）。
- 目标 Typecho 版本与命名空间风格（先跑 triage）。
- 要调用的内置组件名或要实现的数据结构；要读取的选项名。

## Procedure

### 0) 先 triage，确定类名风格

1. `node skills/typecho-project-triage/scripts/detect_typecho_project.mjs`
2. 新代码用 1.3.0（1.2+）的 `\Typecho\*` 类；**内置组件一律用短名字符串**
   （如 `'Widget_Options'`），1.1 / 1.2+ 通用，最省心。

### 1) 用 Widget::widget() 取组件，不要自己 new

```php
$options = \Typecho\Widget::widget('Widget_Options');   // 1.2+ / 1.3.0
// \Typecho_Widget::widget('Widget_Options');           // 1.1
echo htmlspecialchars($options->title, ENT_QUOTES, 'UTF-8');

// 带构造参数（第二参数，字符串或数组）
$recent = \Typecho\Widget::widget('Widget_Contents_Post_Recent', 'pageSize=10');
```

- `widget()` 返回对象池中的单例；`alloc()` 为当前 Widget 子类取实例；
  `destroy()` 释放。详见 `references/widgets.md`。
- 在另一个 Widget 内部，可用实例方法 `$this->widget('Widget_xxx')`。

### 2) 遍历数据堆栈

```php
while ($recent->next()) {
    echo $recent->title;          // __get 经 ___title / 行数据 / 插件钩子取值
}
$recent->toColumn('cid');        // 单列
$recent->toArray(['cid','title']); // 多列数组
```

堆栈机制、`have()/push()/on()/alt()/template()/parse()`、动态属性
`___name` 与插件方法 `callName` 见 `references/widgets.md`。
文章从原始 text 到渲染后 HTML 的完整链路（`content` / `contentEx` /
`markdown` / `autoP` / `excerpt` 等 Hook、`<!--more-->`、
`<!--markdown-->`、密码文章、自定义字段）见
`references/content-pipeline.md`。

### 3) 读配置与当前请求

- 系统 / 插件配置：`Widget_Options`，插件配置用 `->plugin('目录名')`。
- 当前请求参数与响应：组件内 `$this->request->get(...)`，不要直接碰
  `$_GET/$_POST`。详见 `references/options-and-helper.md`。

### 4) 需要后台面板 / 动作 / 路由

用插件助手 `\Helper`（1.3.0 真身 `\Utils\Helper`）的
`addPanel/addAction/addRoute` 注册，完整用法在
`../typecho-plugin-development/references/panels-actions-routes.md`。

### 5) 在面板 / Action 里自建表单

`config($form)` 只适用于插件配置页；自建页面用 `Helper\Form` 手动构建、
取值、校验、渲染：

```php
use Typecho\Widget\Helper\Form;
use Typecho\Widget\Helper\Form\Element\Text;

$form = new Form(null, Form::POST_METHOD);
$name = new Text('name', null, null, _t('名称'));
$name->addRule('required', _t('名称不能为空'));
$form->addInput($name);

if ($form->validate()) { /* 有错误，render 会自动回填并提示 */ }
$form->render();
```

元素全集、文件上传编码、取值、校验器与回填机制见
`references/form-elements.md`。

### 6) 安全底线

- 写操作先鉴权（`$user->pass(...)`）再校验 CSRF
  （`$this->security->protect()` / 表单自带安全字段）。
- 取到的任何数据输出到 HTML 前 `htmlspecialchars(..., ENT_QUOTES, 'UTF-8')`。
- 输入经 `$this->request->get()` 取得后仍要按类型校验。

## Verification

- `php -l` 语法检查通过。
- 用短名调用的组件在 1.3.0 命名空间代码中能正确返回；1.1 代码用下划线类名。
- 自建表单：必填为空时提示且回填；正常提交后写入路径有授权 + Token 保护。
- 列表 `while($w->next())` 在无数据时不输出、不报错（先 `have()` 判断）。
- 输出全部转义，无 XSS。

## Failure modes / debugging

- 类找不到：1.2+ 代码里误用了 `Typecho_Widget_Helper_*`（或反之）；内置组件改用
  短名字符串可同时规避。
- `widget()` 返回空 / 属性为 null：组件短名拼错，或取的数据当前上下文不存在；
  对照 `references/widgets.md` 与 `var/Widget/` 源码。
- 循环只跑一次 / 不循环：忘记 `while ($w->next())`，或对象池单例的堆栈已被
  遍历过（需重新取实例或重置）。
- 表单提交后无反应：方法不是 POST、没调 `validate()`、写入口缺
  `security->protect()`。
- 自定义 `___name` 不生效：方法名必须是三个下划线开头且属性名大小写一致。
- 插件配置读不到：`plugin('目录名')` 大小写与插件目录不符。

## Escalation

- Widget 基类源码 `var/Typecho/Widget.php`；助手 `var/Typecho/Widget/Helper/`
  <https://github.com/typecho/typecho>
- 内置组件清单见核心 `var/Widget/`（1.3.0）目录下各类。
- 数据库操作见 <https://docs.typecho.org/plugins/database-operations>
