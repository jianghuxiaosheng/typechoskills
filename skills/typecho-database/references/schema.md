# 核心表结构与建表约定

事实来源：<https://docs.typecho.org/database>，以及核心安装逻辑
`install.php` / `var/Typecho/Db/` 中的建表语句。下列字段为常用字段说明，
**任何字段名、类型、长度以当前版本安装 SQL 为最终权威**，改动前务必核对。

所有表在代码中以 `table.表名` 引用，实际表名带前缀（默认 `typecho_`）。

## 核心表一览

| 表名（table.） | 用途 | 主键 |
| --- | --- | --- |
| `table.contents` | 文章、页面、附件等内容主体 | `cid` |
| `table.comments` | 评论与 Pingback/Trackback | `coid` |
| `table.metas` | 分类、标签、链接分类等元数据 | `mid` |
| `table.users` | 用户 | `uid` |
| `table.options` | 系统与插件配置（键值） | `name`(+`user`) |
| `table.relationships` | 内容与元数据多对多关联 | `cid`+`mid` |
| `table.fields` | 内容自定义字段（多态值列） | `cid`+`name` |

## contents（内容）

常用字段：

- `cid`：自增主键。
- `title`：标题；`slug`：URL 缩略名；`text`：正文。
- `type`：内容类型，如 `post`（文章）、`page`（页面）、`attachment`（附件）。
- `status`：状态，如 `publish`、`draft`、`private`、`waiting`。
- `created` / `modified`：Unix 时间戳（整数）。
- `authorId`：作者 `users.uid`；`parent`：父内容（页面层级、附件归属）。
- `order`：排序权重；`template`：页面使用的自定义模板文件名。
- `commentsNum`：评论数冗余计数；`viewsNum`：浏览量（部分版本 / 插件维护）。
- `allowComment` / `allowPing` / `allowFeed`：是否允许评论 / 引用 / 聚合。
- `password`：访问密码（无密码为空）。

## comments（评论）

- `coid` 主键；`cid` 关联 `contents.cid`。
- `created`：时间戳；`status`：如 `approved`、`waiting`、`spam`。
- `type`：评论类型（评论 / pingback / trackback）。
- `author` / `mail` / `url`：访客填写的昵称 / 邮箱 / 网址；
  登录用户评论时 `authorId` 关联 `users.uid`，`ownerId` 记录内容作者。
- `ip` / `agent`：来源 IP 与 User-Agent；`text`：评论正文；`parent`：楼中楼父评论。

## metas（分类 / 标签 / 链接分类）

- `mid` 主键；`name` 显示名；`slug` 缩略名。
- `type`：`category`（分类）、`tag`（标签）、`link` 相关类型等。
- `description`：描述；`count`：内容计数（冗余）；`parent`：父级（分类层级）；
  `order`：排序。

分类与标签都存在此表，靠 `type` 区分；与文章的挂载关系在 `relationships`。

## users（用户）

- `uid` 主键；`name` 登录名（唯一）；`screenName` 昵称；`password` 密码哈希。
- `mail` / `url`：邮箱 / 网址。
- `group`：用户组，取值 `administrator` / `editor` / `contributor` /
  `subscriber` / `visitor`。
- `created` / `activated` / `logged`：注册 / 激活 / 最近登录时间戳；
  `authCode`：登录态相关。

## options（配置）

- 键值结构：`name` 配置名、`value` 配置值、`user` 作用域（系统配置为 0）。
- 插件配置存放在约定的插件配置名下；**读取插件配置优先用
  `Widget::widget('Widget_Options')->plugin('插件名')`**，不要直接裸查，
  见 `../../typecho-plugin-development/references/lifecycle.md`。

## relationships（关系）

- `cid` + `mid`：把文章 / 页面挂到分类、标签。
- 增删内容的分类标签时需同步维护此表及 `metas.count` 计数——优先走核心逻辑，
  避免手工写导致计数不一致。

## fields（自定义字段）

- 以 `cid` + `name` 定位某篇内容的某个自定义字段。
- 多态值列：按 `type` 分别写入 `str_value` / `int_value` / `float_value`。
- 读写自定义字段优先通过核心 Widget / 字段机制，确需裸 SQL 时要同时正确处理
  `type` 与对应值列。

## 建表与改表约定

### 优先复用，而非新建

- 小量配置 → `options` / 插件配置。
- 内容附属数据 → 评估能否用 `fields`、分类标签、自定义模板表达。
- 只有独立结构、大量行列数据才建自定义表。

### 自定义表命名

- 表名带清晰的插件语义前缀，避免与核心表或其他插件冲突。
- 代码中仍以 `table.` 前缀引用，建表时用 `$db->getPrefix()` 拼真实表名。

### 跨适配器（MySQL / PostgreSQL / SQLite）

- 类型只选通用集合：整数主键、普通整数、定长 / 变长文本、长文本、时间戳整数。
- 时间统一用 Unix 时间戳整数（与核心表一致），不依赖数据库日期函数。
- 避免反引号、`AUTO_INCREMENT` 写法、`ENGINE=` 子句等 MySQL 专有语法；
- 自增主键、索引的 DDL 要按适配器区分，参考核心安装 SQL 对三种适配器的处理。

### 生命周期语义

- `activate()` 建表 / 写初始数据；升级时做增量结构迁移（先 `SHOW/检查列`
  再变更，保证可重复执行）。
- `deactivate()` 默认**保留**数据；是否提供“卸载并删表”要在插件说明中明示，
  删表 / 清 options 前要求管理员二次确认。
