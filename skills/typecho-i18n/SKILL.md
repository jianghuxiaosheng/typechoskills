---
name: typecho-i18n
description: "Use to internationalize Typecho plugins/themes and to work with language packs: wrapping user-visible strings with _t() (translate + sprintf placeholders), _e() (echo translated), and _n() (plural via ngettext), writing translatable code (no concatenated/split sentences, locale-safe placeholders), extracting strings into a messages.pot template, translating with Poedit/gettext into {locale}.po, compiling to .mo, installing language files into usr/langs, selecting language in admin, appending plugin language files via I18n::addLang(), and contributing to the official typecho/languages repository."
compatibility: "Verified against Typecho 1.3.0 (minimum PHP 7.4); APIs also apply to 1.2.x. The _t/_e/_n functions and the gettext-based I18n engine (Typecho\\I18n, GetTextMulti) work the same in 1.1 (Typecho_I18n). Language files are compiled gettext .mo placed in usr/langs. Filesystem-based agent."
---

# Typecho 国际化（i18n）

## When to use

- 让插件 / 主题中所有**面向用户可见**的文案可被翻译（后台菜单、配置标签、
  提示、错误信息、模板文案）。
- 抽取待翻译字符串生成 `messages.pot`，用 Poedit 翻译成 `.po` 并编译 `.mo`。
- 安装 / 调试语言包（放到 `usr/langs`，后台切换语言）。
- 插件需要携带或追加自己的语言文件（`I18n::addLang()`）。
- 向官方语言仓库 `typecho/languages` 贡献翻译。

不要用于：纯内部日志、不输出给用户的标识符；数据库内容（文章 / 配置值本身
不通过 `_t()` 翻译）。

## Inputs required

- 插件 / 主题目录与所有含可见文案的文件。
- 源语言（Typecho 内置文案以中文为基准，`en_US.po` 是常用翻译起点）。
- 目标语言的 locale 代码（如 `zh_CN`、`zh_TW`、`en_US`、`ja_JP`）。

## Procedure

### 0) 确认范围与版本

- 先跑 triage 确认版本；`_t()/_e()/_n()` 与 gettext 引擎在 1.1 / 1.2 行为一致，
  文案包裹与语言包流程与版本无关。
- 列出所有用户可见文案：插件头注释的名称 / 描述、后台菜单与配置 `label`、
  校验提示、Action / 面板输出、主题模板硬编码文字。

### 1) 用 _t() 包裹所有可见字符串

```php
$label = _t('欢迎语');                       // 返回译文
_e('保存');                                  // 直接输出译文

// 带占位符：sprintf 风格，变量永远作为参数传入，不要拼进句子
echo _t('共有 %d 篇文章', $count);
echo _t('你好，%s', $name);

// 复数
echo _n('一篇文章', '%d 篇文章', $count);    // 数字占位按下方说明回填
```

- `_t($msg, ...$args)`：翻译后按 `sprintf` 用后续参数替换 `%s/%d` 占位。
- `_e()`：等价于 `echo _t(...)`。
- `_n($single, $plural, $number)`：按数字返回复数形式；返回串中的 `%d`
  需要自行回填（如 `sprintf(_n('一篇', '%d 篇', $n), $n)` 或 `str_replace`）。

### 2) 写出“可翻译”的代码

- 句子完整交给 `_t()`，**不要拆词拼接**（语序因语言而异）：

```php
// 错误：__('文章') . $count ...  语序被写死
// 正确：
_t('文章 %s 已发布', $title);
```

- 变量 / 数字一律用占位符，不做字符串插值进待译句子。
- 同一个英文 / 中文概念全文统一拼写，避免同义碎片增加翻译量。
- 含 HTML 的长文案，把标签放在翻译串外或保证各语言可保留占位。
- 头注释、`addRule` 错误信息、表单 `label/description` 也都要包裹。

详见 `references/translation-guide.md`。

### 3) 抽取与翻译（gettext 工作流）

1. 用 Poedit / gettext 工具从 PHP 源码扫描 `_t/_e/_n` 调用，生成或更新
   `messages.pot`（官方 `typecho/languages` 仓库提供最新 `messages.pot`）。
2. 以 `messages.pot` 为模板建立 `{locale}.po`（实际翻译可从 `en_US.po` 起步再
   补 `messages.pot` 的新增串）。
3. 在 Poedit 中翻译，保存时自动编译出 `{locale}.mo`。

### 4) 安装与启用语言包

- 将编译好的 `*.mo` 上传到站点 `usr/langs/`（目录不存在则创建）。
- 后台「设置 → 基本」中会出现语言选择器，切换后生效。
- 核心语言包直接用官方仓库 release 的 `.mo`；locale 文件名与后台选项对应。

### 5) 插件携带翻译（按需）

- 插件文案同样用 `_t()`；可在插件加载阶段用 `\Typecho\I18n::addLang($moPath)`
  追加自带 `.mo`（GetTextMulti 支持多语言文件合并）。注意调用时机与主语言已
  初始化的顺序，具体以 `var/Typecho/I18n.php` 源码为准；不确定时优先让用户把
  `.mo` 放入 `usr/langs`。

## Verification

- 切换到目标语言后，后台菜单、配置标签、提示、主题文案均显示译文，无遗漏的
  源语言串。
- 带占位符的句子中，数字 / 变量出现在正确位置，无残留 `%s/%d`。
- 复数在 0 / 1 / 多个数量下形式正确。
- `.mo` 已放入 `usr/langs` 且文件名 locale 与后台选项一致；切回源语言正常。
- 代码中搜索可见文案，确认不存在未包裹的硬编码中文 / 英文句子。

## Failure modes / debugging

- 译文不生效：`.mo` 未放进 `usr/langs`；locale 文件名与后台选择不一致；
  Poedit 未真正编译（只存了 `.po`）；服务器对 `.mo` 无读权限。
- 新增字符串“翻译不到”：更新了 `.po` 但未重新编译 / 上传 `.mo`，或未重新扫描
  生成 `messages.pot`。
- 句子语序在其他语言下错乱：把句子拆成多段拼接或把变量写死进了串中；改为完整
  句子 + 占位符。
- 输出残留 `%s`：`_t()` 传了占位符但参数数量 / 顺序不匹配。
- 插件 `addLang()` 报错：主语言对象尚未初始化就调用；调整加载时机，或改用
  `usr/langs` 安装方式。

## Escalation

- 翻译入门 <http://docs.typecho.org/translate/start>
- 官方语言包仓库（`messages.pot`、各语言 `.po`、release `.mo`）
  <https://github.com/typecho/languages>
- 引擎源码 `var/Typecho/I18n.php` 与 `var/Typecho/I18n/GetTextMulti.php`
  <https://github.com/typecho/typecho>
- 工具 <http://poedit.net/>
