# 翻译工作流详解

事实来源：<http://docs.typecho.org/translate/start>、官方语言包仓库
<https://github.com/typecho/languages>、核心引擎 `var/Typecho/I18n.php`
与 `var/Typecho/I18n/GetTextMulti.php`。

## gettext 三件套

| 文件 | 含义 |
| --- | --- |
| `messages.pot` | 模板：从源码扫描出的全部待译字符串，**不含译文** |
| `{locale}.po` | 某语言的翻译源文件（人 / Poedit 编辑），如 `ja_JP.po` |
| `{locale}.mo` | `.po` 编译后的二进制，运行时真正加载的文件 |

- 引擎是 gettext 兼容实现（`GetTextMulti`），运行时只读 `.mo`。
- 官方仓库中 `messages.pot` 为最新待译模板，`en_US.po` 常作为翻译起点
  （再从 `messages.pot` 同步新增串）。

### 典型 .po 条目

```po
msgid "欢迎语"
msgstr "Welcome Message"

msgid "共有 %d 篇文章"
msgstr "There are %d articles"
```

- `msgid` 必须与源码里 `_t()` 的原文**逐字一致**（含标点、空格、占位符）。
- 占位符 `%s/%d` 在译文中保留，顺序可用 `%1$s` 等显式位置参数适配语序。

## locale 命名

- 语言_区域，下划线分隔：`zh_CN`、`zh_TW`、`en_US`、`ja_JP`、`fr_FR`、
  `ru_RU`、`pt_BR` 等；少数无区域区分的语言只有语言码（如 `ceb`）。
- 文件名即 `{locale}.po` / `{locale}.mo`，必须与后台语言选项对应。
- 完整可用 locale 以官方仓库现有 `.po` 文件为准。

## 翻译函数

| 函数 | 行为 |
| --- | --- |
| `_t(string $msg, mixed ...$args): string` | 翻译；其余参数按 `sprintf` 替换 `%s/%d` |
| `_e(string $msg, mixed ...$args): void` | `echo` 翻译结果 |
| `_n(string $single, string $plural, int $number): string` | 复数形式，底层 `I18n::ngettext()` |

复数示例：

```php
$word = _n('一篇文章', '%d 篇文章', $count);
echo str_replace('%d', $count, $word);   // _n 不自动回填数字
// 或
echo sprintf(_n('一篇文章', '%d 篇文章', $count), $count);
```

无翻译命中时：`_t()` 原样返回 `msgid`；`_n()` 在 `$number > 1` 时返回复数形式。
因此即便没装任何语言包，代码也能正常显示原文。

## 可翻译代码规则

1. **句子完整包裹**，不拆词、不在翻译后拼接：

```php
// 差
_t('文章') . ' ' . $count;
// 好
_t('文章数量：%d', $count);
```

2. 动态值用占位符，绝不插值进 `msgid`：

```php
// 差：每个标题产生一个无法翻译的 msgid
_t("编辑文章：{$title}");
// 好
_t('编辑文章：%s', $title);
```

3. 不依赖语序：多占位符用位置参数 `%1$s %2$s`，允许译者调换顺序。
4. 统一术语与大小写，减少重复 / 近义条目。
5. 下列位置的可见文案都要包裹：插件头注释的名称 / 描述、`addPanel` 菜单名、
   表单元素 `label` / `description`、`addRule` 错误信息、Action / 面板 / 主题
   模板中的硬编码文字。
6. 复数不要用 `if ($n > 1)` 在业务代码里自己判断中文单复数——交给 `_n()`，
   各语言复数规则由 `.po` 头部 `Plural-Forms` 决定。
7. 不要对翻译结果再做 `htmlspecialchars` 之外的字符串假设；变量输出仍需转义。

## Poedit 配置

新建目录翻译项目时：

- 源语言 / 字符串编码：UTF-8。
- 提取关键词（sources keywords）加入：`_t`、`_e`、`_n`
  （`_n` 的单 / 复数字符串分别是第 1、2 个参数）。
- 源码字符集 UTF-8；扫描 `.php`。
- 复数表单按语言设置 `Plural-Forms`（日语等 `nplurals=1`；多数欧洲语言
  `nplurals=2`；俄语等更多）。
- 保存 `.po` 时让 Poedit 自动编译同名 `.mo`。

## 安装语言包

1. 下载官方 release 或自备 `.mo`。
2. 上传到 `<站点根>/usr/langs/`（不存在则创建目录）。
3. 后台「设置 → 基本」底部选择语言并保存。

## 插件自带翻译

核心通过 `\Typecho\I18n` 管理语言文件：

- `I18n::setLang($moFile)`：设置主语言文件（由核心启动流程完成，插件不要改）。
- `I18n::addLang($moFile)`：**追加**一个 `.mo`，多文件词条合并
  （GetTextMulti）。插件可在加载阶段把自带的
  `languages/{当前locale}.mo` 追加进去。
- 注意：`addLang()` 依赖主语言对象已初始化，调用不能早于核心的语言初始化；
  时机不确定时，最稳妥的方式仍是让用户把 `.mo` 放入 `usr/langs`。
- 不要假设后台语言常量名；需要当前 locale 时以 `I18n::getLang()` / 核心启动
  流程为准。

## 向官方语言仓库贡献

1. Fork <https://github.com/typecho/languages> 并克隆。
2. 用 Poedit 打开对应 `{locale}.po`（新语言以 `en_US.po` 为基础），从
   `messages.pot` 同步新增字符串。
3. 完成翻译后提交到 Fork，向 `typecho/languages` 发起 Pull Request。
4. 提交前确认：无未翻译的 fuzzy 条目、占位符与原文一一对应、复数规则正确、
   文件编码 UTF-8。
