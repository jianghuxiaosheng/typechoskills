# 主题文件结构与回退

主题位于 `usr/themes/<Name>/`。仅 `index.php` 为必需文件，其余按需添加，
Typecho 按类型回退：缺少专用模板时用 `archive.php`，再缺则用 `index.php`。

| 文件 | 作用 | 必需 |
|------|------|------|
| `index.php` | 首页，同时是主题说明文件（头注释） | 是 |
| `style.css` | 主题样式 | 否 |
| `screenshot.png` | 后台缩略图 | 否 |
| `header.php` | 页头公共模板 | 否 |
| `footer.php` | 页脚公共模板 | 否 |
| `sidebar.php` | 侧边栏 | 否 |
| `functions.php` | 主题函数（`themeFields` 等） | 否 |
| `post.php` | 文章（post）内容页 | 否 |
| `page.php` | 独立页面（page） | 否 |
| `archive.php` | 通用归档（分类 / 搜索 / 标签 / 作者） | 否 |
| `category.php` | 分类归档 | 否 |
| `search.php` | 搜索结果 | 否 |
| `tag.php` | 标签归档 | 否 |
| `author.php` | 作者归档 | 否 |
| `404.php` | 404 页面 | 否 |
| `comments.php` | 评论列表与表单 | 否 |

## index.php 头部注释

后台“外观”页据此展示主题，前两行注释是简短介绍：

```php
/**
 * 这是一套示例主题。
 *
 * @package Example Theme
 * @author  you
 * @version 1.0.0
 * @link    https://example.com
 */
```

## 公共模板组装

```php
<?php $this->need('header.php'); ?>
  ...主循环...
<?php $this->need('sidebar.php'); ?>
<?php $this->need('footer.php'); ?>
```

也可使用 `include('header.php')`；推荐用 `$this->need()`，主题内引用更一致。

## 回退顺序（排障用）

- 首页：`index.php`
- 文章：`post.php` → 单内容通用模板 → `index.php`
- 独立页面：`page.php` → `post.php` → `index.php`
- 分类：`category.php` → `archive.php` → `index.php`
- 标签：`tag.php` → `archive.php` → `index.php`
- 搜索：`search.php` → `archive.php` → `index.php`
- 作者：`author.php` → `archive.php` → `index.php`

新增模板后若前台未变化，优先按此回退链判断是不是命中了别的文件。
