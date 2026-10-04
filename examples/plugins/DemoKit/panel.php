<?php

/**
 * DemoKit 后台面板（基于 Typecho 1.3.0 源码核验）。
 *
 * 由 admin/extending.php 在白名单校验通过后 require_once 加载：
 *  - common.php 已被 extending.php 包含，此处【禁止】再次 include，
 *    否则 __TYPECHO_ADMIN__ 等常量重复定义会触发致命错误；
 *  - $options / $user / $security / $menu / $request / $response 已在全局作用域可用；
 *  - 面板必须自行调用 $user->pass() 鉴权（extending.php 不做权限校验）；
 *  - 后台模板使用绝对路径包含，避免依赖运行时工作目录。
 *
 * 访问地址：/admin/extending.php?panel=DemoKit%2Fpanel.php
 */

if (!defined('__TYPECHO_ADMIN__')) {
    exit;
}

$user->pass('administrator');

// 正典 Action URL：Router::url 生成 /index.php/action/demokit-sync，
// 再经 getTokenUrl 追加 CSRF token（与 admin/backup.php 写法一致）。
$actionUrl = $security->getTokenUrl(
    \Typecho\Router::url(
        'do',
        ['action' => 'demokit-sync', 'widget' => 'Sync'],
        \Typecho\Common::url('index.php', $options->rootUrl)
    )
);

// 前台自定义路由端点（在固定链接下即 /demokit/latest.json）。
$feedUrl = \Typecho\Common::url('demokit/latest.json', $options->rootUrl);

$adminDir = __TYPECHO_ROOT_DIR__ . __TYPECHO_ADMIN_DIR__;
include $adminDir . 'header.php';
include $adminDir . 'menu.php';
?>

<main class="main">
    <div class="body container">
        <div class="typecho-page-title">
            <h2><?php echo _t('DemoKit 示例面板'); ?></h2>
        </div>
        <div class="row typecho-page-main" role="main">
            <div class="col-mb-12 col-tb-8">
                <div id="demokit-sync">
                    <form action="<?php echo $actionUrl; ?>" method="post">
                        <h3><?php echo _t('手动同步'); ?></h3>
                        <ul>
                            <li>
                                <p class="description"><?php echo _t('点击按钮向 demokit-sync Action 发起带 CSRF token 的 POST 请求（示例动作，返回 JSON）。'); ?></p>
                            </li>
                        </ul>
                        <p>
                            <button class="btn primary" type="submit"><?php echo _t('立即同步 &raquo;'); ?></button>
                        </p>
                    </form>
                </div>
            </div>

            <div class="col-mb-12 col-tb-4">
                <h3><?php echo _t('前台端点'); ?></h3>
                <p>
                    <a href="<?php echo $feedUrl; ?>" target="_blank" rel="noopener"><?php echo _t('最新文章 JSON'); ?></a>
                </p>
                <p class="description"><?php echo _t('由自定义路由 demokit_latest 映射到 LatestFeed 组件。'); ?></p>
            </div>
        </div>
    </div>
</main>

<?php
include $adminDir . 'copyright.php';
include $adminDir . 'common-js.php';
include $adminDir . 'footer.php';
