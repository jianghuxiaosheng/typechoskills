---
name: typecho-theme-development
description: "Use when developing or modifying Typecho themes: required index.php header and file structure with template fallbacks, the post loop ($this->next()), template tags and options output, is() conditional syntax, archiveTitle/pageNav, functions.php, themeFields theme config, custom comments/404/error pages, custom page title, header/footer/sidebar includes, and safe output."
compatibility: "Verified against Typecho 1.3.0 (minimum PHP 7.4); APIs also apply to 1.2.x. Templates mostly echo Widget helpers; underscore Widget short names (Widget_Options) remain valid in 1.2+."
---

# Typecho Theme Development

## When to use

- 新建或修改 `usr/themes/<Name>/` 下的模板：首页、文章页、独立页面、归档、页头页脚、侧边栏。
- 用 `is()` 让不同归档类型显示不同布局；自定义 404 / 错误页 / 评论区。
- 给主题加可配置项（LOGO、广告位、开关）——使用 `functions.php` 中的 `themeFields()`。
- 调整文章循环、分页、标题、面包屑、相关文章、标签云等前台输出。

不要用于：后台插件逻辑（转 `typecho-plugin-development`）、自定义数据查询
（配合 `typecho-database` / `typecho-widget-helper-api`）。

## Inputs required

- 站点根目录 + 目标主题目录（`usr/themes/<Name>`）。
- 设计稿 / HTML 结构，以及需要支持的归档类型（首页、分类、标签、作者、搜索、页面）。
- 是否需要后台主题配置项（`themeFields`）。

## Procedure

### 0) 先 triage 并定位主题目录

- `node skills/typecho-project-triage/scripts/detect_typecho_project.mjs`
- 整站仓库先收窄到具体 `usr/themes/<Name>` 再改。

### 1) 从正确的文件骨架开始

- `index.php` **必需**，文件头注释（`@package/@author/@version/@link`）即主题信息。
- 其余模板按需添加，利用回退规则，不必一次建全（见 `references/file-structure.md`）。
- 用 `include('header.php')` / `sidebar.php` / `footer.php` 拆分公共部分。

### 2) 主循环与模板标签

- 列表用 `while ($this->next()): ... endwhile;` 遍历当前归档的文章。
- 常用输出：`title()`、`permalink()`、`author()`、`date()`、`category()`、
  `tags()`、`commentsNum()`、`content()`、`excerpt()`。
- 系统选项走 `$this->options->`：`title()`、`siteUrl()`、`themeUrl()`、
  `charset()`、`description()`、`feedUrl()`。
- 头部务必调用 `$this->header()`，否则 RSS 声明、客户端与插件 Hook 会失效。
- 列表结尾加分页 `$this->pageNav()`。

详见 `references/template-tags.md`。

### 3) 用 is() 做条件判断

- `$this->is('index'|'archive'|'single'|'post'|'page'|'category'|'tag'|...)`。
- 第二参数传缩略名 / ID 精确匹配：`$this->is('page', 'about')`、`$this->is('post', 1)`。
- 用 `if (...): ... endif;` 控制布局，不要硬改路由。

详见 `references/is-syntax.md`。

### 4) 主题配置 themeFields

- 在 `functions.php` 定义 `themeFields($layout)`，用表单元素 `$layout->addItem(...)`。
- 模板中通过 `$this->options->字段名`（如 `$this->options->logoUrl`）读取。

详见 `references/themefields.md`。

### 5) 评论区与自定义页面

- 评论列表与表单放 `comments.php`，文章页 `include('comments.php')`。
- 评论循环用 `$comments->next()`，输出 `theId()/author()/date()/content()`；
  表单 `action` 用 `$this->commentUrl()`，未登录字段用 `$this->remember()` 回填。
- 自定义 404：`404.php`；自定义独立页面模板可在页面模板中结合 `is()` / 自定义文件。
- 仅当 `$this->allow('comment')` 时输出评论表单。

详见 `references/comments.md`。

### 6) 安全与静态资源

- 主题以输出为主：所有来自外部 / 用户的值输出到 HTML 前用
  `htmlspecialchars($v, ENT_QUOTES, 'UTF-8')` 转义。
- 静态资源路径用 `$this->options->themeUrl('style.css')`，不要写死域名。
- 表单沿用主题评论表单的既有隐藏字段与 `commentUrl()`，不要自造提交端点。

## Verification

- 后台“外观”中能看到主题（头注释被正确解析），可启用且无白屏。
- 首页 / 文章 / 页面 / 分类 / 搜索 / 404 各类型都能命中预期模板。
- `$this->header()` 已输出；文章列表有分页；RSS / 评论链接正常。
- `themeFields` 配置项可保存、前台读取正确；未设置时回退默认值。
- `php -l` 校验所有改动模板；在开启评论 / 关闭评论两种文章上检查评论区。

## Failure modes / debugging

- 后台看不到主题：`index.php` 缺失或头注释没有 `@package`。
- 插件不生效 / RSS 异常：头部漏了 `$this->header()`。
- 某归档类型布局不对：缺少 `category.php/search.php/tag.php` 时会回退到
  `archive.php`，再回退到 `index.php`；按回退顺序补模板。
- `is('page','slug')` 不命中：第二参数是**缩略名**而非标题；文章可传 ID。
- 主题配置读不到：`functions.php` 未定义 `themeFields`，或字段名与模板里不一致。
- 评论提交异常：表单 `action` 没用 `commentUrl()`，或漏了隐藏字段 / 未判断 `allow('comment')`。

## Escalation

- 模板标签完整行为以默认主题 `usr/themes/default` 与官方文档为准：
  - 快速入门 <https://docs.typecho.org/themes/quick-tutorial>
  - 文件结构 <https://docs.typecho.org/themes/file-structures>
  - is 语法 <https://docs.typecho.org/themes/is-syntax>
  - themeFields <https://docs.typecho.org/themes/custom-themefields>
