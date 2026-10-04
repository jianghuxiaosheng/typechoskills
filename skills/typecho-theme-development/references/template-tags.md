# 模板标签速查

以默认主题 `usr/themes/default` 为权威范例。以下为最常用标签。

## 文章主循环

```php
<?php while ($this->next()) : ?>
<article class="post">
  <h2><a href="<?php $this->permalink() ?>"><?php $this->title() ?></a></h2>
  <div class="meta">
    <?php $this->author(); ?> ·
    <?php $this->date('F j, Y'); ?> ·
    <?php $this->category(','); ?> ·
    <?php $this->commentsNum('%d 条评论'); ?>
  </div>
  <div class="text"><?php $this->content('继续阅读...'); ?></div>
</article>
<?php endwhile; ?>

<?php $this->pageNav(); ?>
```

| 标签 | 输出 |
|------|------|
| `$this->permalink()` | 当前文章固定链接 |
| `$this->title()` | 标题 |
| `$this->author()` | 作者名；`$this->author->permalink()` 作者链接 |
| `$this->date('F j, Y')` | 日期（格式同 PHP `date`） |
| `$this->category(',')` | 所属分类 |
| `$this->tags(',', true, 'none')` | 标签（仅单篇） |
| `$this->commentsNum()` | 评论数与链接 |
| `$this->content('更多...')` | 正文；摘要时显示“更多”链接 |
| `$this->excerpt(120, '...')` | 摘要 |
| `$this->pageNav()` | 列表分页 |

## 头部 header.php

```php
<meta charset="<?php $this->options->charset(); ?>" />
<title><?php $this->options->title(); ?><?php $this->archiveTitle(); ?></title>
<link rel="stylesheet" href="<?php $this->options->themeUrl('style.css'); ?>" />
<?php $this->header(); ?>
```

- `$this->header()` **不能漏**：输出 RSS 声明、meta 与插件头部 Hook。
- `$this->archiveTitle()` 输出当前归档标题，配合站点名组成 `<title>`。
- 静态资源一律 `$this->options->themeUrl(相对路径)`，不要写死域名。

## 系统选项 options

```php
$this->options->title();         // 站点名
$this->options->description();   // 站点描述
$this->options->siteUrl();       // 首页地址
$this->options->charset();       // 编码
$this->options->feedUrl();       // 文章 RSS
$this->options->commentsFeedUrl();// 评论 RSS
$this->options->adminUrl();      // 后台地址
$this->options->index('Logout.do'); // 构造站内动作地址
```

## 侧栏常用 Widget

`widget()` 取 Widget，`parse()` 用占位符模板批量渲染：

```php
// 最新文章
$this->widget('Widget_Contents_Post_Recent')
     ->parse('<li><a href="{permalink}">{title}</a></li>');

// 分类列表
$this->widget('Widget_Metas_Category_List')
     ->parse('<li><a href="{permalink}">{name}</a> ({count})</li>');

// 按月归档
$this->widget('Widget_Contents_Post_Date', 'type=month&format=F Y')
     ->parse('<li><a href="{permalink}">{date}</a></li>');

// 最新评论（需要循环）
$this->widget('Widget_Comments_Recent')->to($comments);
while ($comments->next()) {
    echo $comments->author(false), '：', $comments->excerpt(10, '[...]');
}

// 独立页面导航
$this->widget('Widget_Contents_Page_List')
     ->parse('<li><a href="{permalink}">{title}</a></li>');
```

## 登录状态

```php
<?php if ($this->user->hasLogin()) : ?>
  <a href="<?php $this->options->adminUrl(); ?>"><?php $this->user->screenName(); ?></a>
  <a href="<?php $this->options->index('Logout.do'); ?>">登出</a>
<?php else : ?>
  <a href="<?php $this->options->adminUrl('login.php'); ?>">登录</a>
<?php endif; ?>
```

## 搜索表单

传统主题使用 POST 到当前页，搜索框 `name="s"`：

```php
<form method="post" action="">
  <input type="text" name="s" />
  <button type="submit">搜索</button>
</form>
```

完整标签清单以默认主题与源码为准：
<https://docs.typecho.org/themes/quick-tutorial>。
