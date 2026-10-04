# 从其他博客系统导入数据

本文件是 `../SKILL.md` 步骤 5 的深度参考。事实来源：官方导入文档
<https://docs.typecho.org/import> 与官方插件仓库
<https://github.com/typecho/plugins>。

## 1. 官方提供的导入器

官方仓库 `typecho/plugins` 中只有两个导入插件：

| 插件目录 | 源系统 | 仓库位置 |
| --- | --- | --- |
| `WordpressToTypecho` | WordPress | <https://github.com/typecho/plugins/tree/master/WordpressToTypecho> |
| `MagikeToTypecho` | Magike | <https://github.com/typecho/plugins/tree/master/MagikeToTypecho> |

**官方没有提供 emlog 等其他系统的导入器**。来自这些系统的数据只能依赖
第三方工具或自行编写转换脚本；任何第三方导入脚本在生产环境运行前，都应先
在备份上验证。

## 2. 从 WordPress 导入（WordpressToTypecho）

该插件直连 WordPress 数据库做转换，因此 Typecho 与 WordPress 数据库必须
网络可达（通常在同一台 MySQL 实例，或源库允许远程连接）。

1. 从官方仓库获取 `WordpressToTypecho` 插件目录。
2. 将整个目录上传到 Typecho 的 `usr/plugins/WordpressToTypecho`
   （目录名与插件名一致，大小写敏感）。
3. 在 Typecho 后台「插件管理」中**启用**该插件。
4. 进入插件设置，填写**源 WordPress 数据库**的连接信息：
   - 数据库地址（主机）；
   - 端口；
   - 数据库用户名；
   - 数据库密码；
   - 数据库名；
   - WordPress 表前缀（默认 `wp_`，被改过就按实际填写）。
5. 在控制台菜单中点击「**从 WordPress 导入数据**」，再点击
   「**开始数据转换**」，等待转换完成。
6. 转换成功并核对数量后，**禁用并可删除**该导入插件，避免长期挂在生产站上。

### 2.1 失败排查

- 转换失败最常见的原因是源数据库连接信息填错（地址 / 端口 / 账号 / 库名 /
  表前缀任一项不符）。逐项核对后重试。
- 若源库在另一台机器上，确认该 MySQL 已对 Typecho 所在服务器授权远程访问，
  且防火墙放行端口。
- 每次重试前确认数据是否已部分写入；必要时清空本次导入产生的数据或恢复
  备份后再跑，避免重复内容。
- 附件（上传的图片 / 文件）不在数据库内，数据库转换后仍需把 WordPress 的
  `wp-content/uploads/` 文件迁移到可访问位置，并按需修正正文里的 URL。

## 3. 从 Magike 导入（MagikeToTypecho）

使用方式与 WordPress 导入器相同：上传到 `usr/plugins/MagikeToTypecho`、
启用、按界面填写源 Magike 数据库连接信息、执行转换、完成后禁用。
排查思路同样以源库连接信息和网络可达性为首要检查点。

## 4. 导入通用清单

无论从哪个系统导入，都按以下顺序操作：

1. **先备份**当前 Typecho 数据库与 `usr/` 目录（见
   `install-and-upgrade.md` 第 4 节）。
2. 确认源数据库可连接、表前缀正确。
3. 在 Typecho 中执行转换。
4. **数量校验**：文章、独立页面、分类、标签、评论的数量与源系统吻合。
5. 抽查内容：正文、发布时间、作者归属、分类标签对应关系正确。
6. 处理附件文件与正文中的绝对 URL。
7. 转换完成后**禁用导入插件**。

## 5. 无官方导入器的系统

对于 emlog 等官方未覆盖的系统：

- 优先寻找社区维护、且明确支持当前 Typecho 1.3.0 的第三方导入脚本；
- 使用前通读脚本，确认它通过 Typecho 的 `Db` / 表结构写入，而不是硬编码
  旧版表名（可结合 `../../typecho-database/references/schema.md` 核对）；
- 务必先在本地或备份上试跑并校验数量，再用于生产；
- 没有现成工具时，可走「源系统导出通用格式（如 RSS/WXR）→ 自行解析 →
  按 Typecho 表结构写入」的路线，写入前先理解
  `contents` / `metas` / `relationships` / `comments` 等表的关联关系。
