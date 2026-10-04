<?php if (!defined('__TYPECHO_ROOT_DIR__')) exit; ?>

<footer id="footer" role="contentinfo">
    &copy; <?php echo date('Y'); ?>
    <a href="<?php $this->options->siteUrl(); ?>"><?php $this->options->title(); ?></a>
    <?php if ($this->options->footerNote): ?>
        &mdash; <?php $this->options->footerNote(); ?>
    <?php endif; ?>
</footer>

<?php
/**
 * footer() 输出核心与插件注入的页脚内容（如统计 JS），
 * 与 header() 成对出现，主题必须调用。
 */
$this->footer();
?>
</body>
</html>
