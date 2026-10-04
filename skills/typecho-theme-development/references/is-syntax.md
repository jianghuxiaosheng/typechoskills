# is() 条件判断语法

`$this->is()` 用于在模板中判断当前归档类型，是 Typecho 主题布局分支的核心。

## 基本用法

```php
<?php if ($this->is('post')) : ?>
    这里是文章页
<?php endif; ?>
```

常用判断值：

| 调用 | 命中场景 |
|------|----------|
| `$this->is('index')` | 首页 |
| `$this->is('archive')` | 任意归档页 |
| `$this->is('single')` | 单篇内容（文章或页面） |
| `$this->is('post')` | 文章页 |
| `$this->is('page')` | 独立页面 |
| `$this->is('category')` | 分类归档 |
| `$this->is('tag')` | 标签归档 |
| `$this->is('author')` | 作者归档 |
| `$this->is('date')` | 日期归档 |
| `$this->is('search')` | 搜索结果 |
| `$this->is('404')` | 404 页 |

## 精确匹配（第二参数）

第二个参数是分类 / 页面的**缩略名（slug）**，文章也可传 ID：

```php
$this->is('category', 'default');  // 缩略名为 default 的分类
$this->is('page', 'start');        // 缩略名为 start 的页面
$this->is('post', 1);              // cid 为 1 的文章
```

注意：

- 第二参数不是标题，是后台填写的缩略名；缩略名为中文 / 特殊字符时按实际值传。
- 一次只能精确匹配一个目标；需要“多个之一”时用多个条件 `||` 组合。

## 典型布局

```php
<?php if ($this->is('post') || $this->is('page')) : ?>
    <?php $this->need('post.php'); ?>
<?php elseif ($this->is('archive') || $this->is('search')) : ?>
    <?php $this->need('archive.php'); ?>
<?php else : ?>
    <!-- 首页列表 -->
<?php endif; ?>
```

更多模板分支能力（自定义 title、面包屑等）见官方文档：
<https://docs.typecho.org/themes/is-syntax>。
