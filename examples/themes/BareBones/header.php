<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>
<!DOCTYPE HTML>
<html lang="<?php echo $this->options->lang; ?>">
<head>
    <meta charset="<?php $this->options->charset(); ?>">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title><?php $this->archiveTitle([
        'category' => _t('分类 %s 下的文章'),
        'search'   => _t('包含关键字 %s 的文章'),
        'tag'      => _t('标签 %s 下的文章'),
        'author'   => _t('%s 发布的文章'),
    ], '', ' - '); ?><?php $this->options->title(); ?></title>

    <?php
    /**
     * header() 输出核心与插件注入的 <head> 内容（RSS/RSD/统计代码等），
     * 主题必须调用，否则插件的前台 head Hook 不会生效。
     */
    $this->header();
    ?>
</head>
<body>

<header id="header">
    <div class="site-name">
        <a href="<?php $this->options->siteUrl(); ?>"><?php $this->options->title(); ?></a>
        <p class="description"><?php $this->options->description(); ?></p>
    </div>

    <?php if ($this->options->showSearch === '1'): ?>
    <form id="search" method="post" action="<?php $this->options->siteUrl(); ?>" role="search">
        <label for="s" class="sr-only"><?php _e('搜索关键字'); ?></label>
        <input type="text" id="s" name="s" placeholder="<?php _e('输入关键字搜索'); ?>">
        <button type="submit"><?php _e('搜索'); ?></button>
    </form>
    <?php endif; ?>

    <nav id="nav-menu" role="navigation">
        <a<?php if ($this->is('index')): ?> class="current"<?php endif; ?>
            href="<?php $this->options->siteUrl(); ?>"><?php _e('首页'); ?></a>
        <?php
        // 独立页面通过 Widget\Contents\Page\Rows 输出为导航项。
        \Widget\Contents\Page\Rows::alloc()->to($pages);
        while ($pages->next()):
        ?>
            <a<?php if ($this->is('page', $pages->slug)): ?> class="current"<?php endif; ?>
                href="<?php $pages->permalink(); ?>"
                title="<?php $pages->title(); ?>"><?php $pages->title(); ?></a>
        <?php endwhile; ?>
    </nav>
</header>
