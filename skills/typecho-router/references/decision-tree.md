# 路由决策树

按顺序判断，命中即进入对应技能。

## 1. 这是哪种代码库？

```
存在 usr/plugins/<Name>/Plugin.php   ──▶ 插件（plugin）
存在 usr/themes/<Name>/index.php     ──▶ 主题（theme）
存在 config.inc.php + index.php + var/ ──▶ 完整站点或核心源码（full-site / core）
只含一个 Plugin.php 的孤立目录        ──▶ 单插件工程
只含一个 index.php(带模板头) 的目录    ──▶ 单主题工程
都不满足                              ──▶ unknown：人工核对后再路由
```

注意：完整站点里同时含插件与主题目录。改动前先把范围收窄到具体的
`usr/plugins/<Name>` 或 `usr/themes/<Name>`，不要在整站层面盲目改代码。

## 2. 版本与命名空间风格

- 文件中大量出现 `Typecho_Plugin`、`Typecho_Db`、`Typecho_Widget_Helper_*`
  —— 1.1 下划线伪命名空间风格（1.2+ / 1.3.0 仍保留兼容别名）。
- 插件出现 `namespace TypechoPlugin\<Name>;`，或代码中出现 `use Typecho\Db;`、
  `Typecho\Widget\...` —— 1.2+ 命名空间风格。
  （注意：插件主类文件里**不应**出现 `use Typecho\Plugin;`，短名与
  `class Plugin` 冲突是致命错误，这不是版本信号而是错误写法。）

新代码默认用 1.3.0（1.2+）命名空间风格；维护老插件时保持其原有风格，
不要在同一文件内混用。

## 3. 按用户意图路由

### 插件类意图 → typecho-plugin-development
- “写个插件 / 加个后台菜单 / 保存配置 / 激活时建表”
- “在文章保存时 / 评论提交时做点事”（Hook）
- “注册一个前台动作 / 自定义路由”
- 信号词：`Plugin.php`、`activate`、`deactivate`、`config`、
  `Plugin::factory()`、`Helper::addPanel/addAction/addRoute`

### 主题类意图 → typecho-theme-development
- “改模板 / 列表页 / 文章页 / 页头页脚 / 侧边栏”
- “首页和分类页显示不一样 / 自定义 404 / 自定义评论区”
- “给主题加个可配置项（LOGO、广告位）”
- 信号词：`index.php`、`post.php`、`header.php`、`is()`、`themeFields()`、
  `$this->next()`、`$this->options->`

### 数据库意图 → typecho-database
- “查询文章 / 插入记录 / 自定义表 / 统计数据”
- 信号词：`Db::get()`、`->from('table....')`、`fetchAll`、
  `insert/update/delete`、`getPrefix()`

### Widget / Helper 意图 → typecho-widget-helper-api
- “在模板或插件里调用某个 Widget / 读取系统选项 / 生成表单元素”
- “给 Widget 加自定义属性或方法”
- 信号词：`Widget::widget()`、`$this->widget()`、`Helper::options()`、
  `Form\Element`、`___x`、`callX`

### 国际化意图 → typecho-i18n
- “多语言 / 翻译 / 语言包 / `_t()` 文案”

### 安装升级迁移意图 → typecho-upgrade-migration
- “装到服务器 / 升级版本 / 换域名换库 / 从 WordPress、Magike 转过来”
  （官方没有 emlog 导入器，只有第三方方案。）

### 排错意图 → typecho-debugging
- “白屏 / 500 / 报错 / 打开就是异常栈 / 404 / 伪静态不生效”
- “登录后掉线 / 后台跳登录 / 403 禁止访问 / session 问题”
- “附件上传失败 / 后台样式丢失 / 计数不准 / 改了模板不生效”
- “XML-RPC 连不上 / Pingback 不通 / 邮件通知收不到”
- 信号词：异常信息、错误日志、DEBUG、重写规则、Cookie、权限。
  注意：排错技能负责**定位**；定位到具体模块后仍回到对应领域技能做修改。

## 4. 多技能组合

复杂任务按需串联，例如：

- 后台统计插件：plugin-development（面板 + 生命周期）
  → database（查询）→ widget-helper-api（表单与选项）→ i18n（文案）。
- 主题里展示插件数据：theme-development → database / widget-helper-api。

先 triage，再按上表依次应用，并在最后统一回到各技能的 Verification 清单核对。
