<?php
/**
 * BareBones —— Typecho Agent Skills 配套最小主题骨架（基于 Typecho 1.3.0 源码核验）。
 *
 * 本文件注释头由核心 Plugin::parseInfo() 解析，在后台外观页展示主题信息：
 *   @package → 主题名称，@author → 作者，@version → 版本，@link → 主页
 *
 * 单模板主题：Typecho 在缺少 post.php / page.php 时会统一回退到 index.php，
 * 因此本骨架用一个文件覆盖首页、文章页、页面、归档与搜索结果。
 *
 * @package BareBones
 * @author Typecho Agent Skills
 * @version 1.0.0
 * @link https://github.com/typecho/typecho
 */

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

// need() 相对于当前主题目录包含模板，并把当前 Archive 组件绑定为 $this。
$this->need('header.php');
?>

<main id="main" role="main">
    <?php if (!$this->is('index') && !$this->is('post') && !$this->is('page')): ?>
        <h1 class="archive-title"><?php $this->archiveTitle([
            'category' => _t('分类 %s 下的文章'),
            'search'   => _t('包含关键字 %s 的文章'),
            'tag'      => _t('标签 %s 下的文章'),
            'author'   => _t('%s 发布的文章'),
        ], '', ''); ?></h1>
    <?php endif; ?>

    <?php if ($this->have()): ?>
        <?php while ($this->next()): ?>
            <article class="post" itemscope itemtype="http://schema.org/BlogPosting">
                <h2 class="post-title" itemprop="headline">
                    <a href="<?php $this->permalink(); ?>" rel="bookmark"><?php $this->title(); ?></a>
                </h2>
                <ul class="post-meta">
                    <li><?php _e('作者'); ?>: <?php $this->author(); ?></li>
                    <li><time datetime="<?php $this->date('c'); ?>"><?php $this->date(); ?></time></li>
                    <li><?php _e('分类'); ?>: <?php $this->category(','); ?></li>
                </ul>
                <div class="post-content" itemprop="articleBody">
                    <?php
                    // content() 输出渲染后的 HTML；含 <!--more--> 时在列表页截断并生成“阅读全文”链接。
                    $this->content(_t('阅读剩余部分'));
                    ?>
                </div>
            </article>

            <?php if ($this->is('post') || $this->is('page')): ?>
                <?php $this->need('comments.php'); ?>
            <?php endif; ?>
        <?php endwhile; ?>
    <?php else: ?>
        <article class="post">
            <h2 class="post-title"><?php _e('没有找到内容'); ?></h2>
        </article>
    <?php endif; ?>

    <?php
    // 分页导航（列表页生效，单篇文章页自动为空）。
    $this->pageNav('&laquo; ' . _t('前一页'), _t('后一页') . ' &raquo;');
    ?>
</main>

<?php $this->need('footer.php'); ?>
