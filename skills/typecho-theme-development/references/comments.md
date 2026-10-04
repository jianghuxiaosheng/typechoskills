# 评论区 comments.php

文章页通过 `$this->need('comments.php')`（或 `include`）引入评论区。
评论区分两部分：评论列表、评论表单。

## 评论数量与列表

```php
<h4><?php $this->commentsNum('暂无评论', '仅有一条评论', '%d 条评论'); ?></h4>

<?php $this->comments()->to($comments); ?>
<ol id="comment_list">
<?php while ($comments->next()) : ?>
  <li id="<?php $comments->theId(); ?>">
    <div class="comment_data">
      <?php echo $comments->sequence(); ?>.
      <strong><?php $comments->author(); ?></strong>
      <?php $comments->date('Y-m-d H:i'); ?>
    </div>
    <div class="comment_body"><?php $comments->content(); ?></div>
  </li>
<?php endwhile; ?>
</ol>
```

| 标签 | 输出 |
|------|------|
| `$comments->theId()` | 每条评论唯一 DOM id |
| `$comments->sequence()` | 楼层序号 |
| `$comments->author()` | 评论者名（传 `false` 不输出链接） |
| `$comments->date(...)` | 评论日期时间 |
| `$comments->content()` | 评论内容 |
| `$comments->permalink()` | 评论锚点链接 |
| `$comments->responseUrl()` / `responseId()` | 回复地址 / 回复框 id |

## 评论表单

仅在文章允许评论时输出；已登录与未登录字段不同：

```php
<?php if ($this->allow('comment')) : ?>
<form method="post" action="<?php $this->commentUrl() ?>" id="comment_form">
  <?php if ($this->user->hasLogin()) : ?>
    <p>
      已登录为 <a href="<?php $this->options->adminUrl(); ?>">
        <?php $this->user->screenName(); ?></a> ·
      <a href="<?php $this->options->index('Logout.do'); ?>">登出</a>
    </p>
  <?php else : ?>
    <p><input type="text" name="author" value="<?php $this->remember('author'); ?>" /><label>昵称（必填）</label></p>
    <p><input type="text" name="mail"   value="<?php $this->remember('mail'); ?>" /><label>邮箱（必填，不公开）</label></p>
    <p><input type="text" name="url"    value="<?php $this->remember('url'); ?>" /><label>网站</label></p>
  <?php endif; ?>

  <p><textarea name="text" rows="10"><?php $this->remember('text'); ?></textarea></p>
  <p><button type="submit">提交评论</button></p>
</form>
<?php endif; ?>
```

要点：

- `action` 必须用 `$this->commentUrl()`，不要自造提交地址。
- 未登录字段名固定为 `author` / `mail` / `url`，正文为 `text`。
- 用 `$this->remember('字段')` 回填校验失败后的内容。
- 外层用 `$this->allow('comment')` 判断；被关闭评论的文章不显示表单。
- 需要“回复”嵌套时沿用默认主题的回复 JS 与 `responseId()` 锚点。

## 自定义评论输出 / 分离评论与 pingback

- 想把评论与引用通告（trackback/pingback）分开，可在循环中用评论类型判断拆分。
- 评论头像等扩展由插件通过 `Widget\Base\Comments` 的 `gravatar` 等 Hook 处理，
  主题不要硬编码头像服务。

参考：<https://docs.typecho.org/themes/separating-the-comments>、
<https://docs.typecho.org/themes/custom-comments>。
