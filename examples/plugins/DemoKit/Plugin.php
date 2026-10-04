<?php

namespace TypechoPlugin\DemoKit;

// 注意：不能 use Typecho\Plugin —— 其短名 Plugin 与本插件类同名会发生致命冲突；
// 需要核心 Plugin 时一律用全限定 \Typecho\Plugin（官方 HelloWorld 即此写法）。
use Typecho\Plugin\PluginInterface;
use Typecho\Widget\Helper\Form;
use Typecho\Widget\Helper\Form\Element\Checkbox;
use Typecho\Widget\Helper\Form\Element\Radio;
use Typecho\Widget\Helper\Form\Element\Text;
use Widget\Archive;
use Widget\Options;

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

/**
 * DemoKit —— Typecho Agent Skills 配套可运行示例插件（基于 Typecho 1.3.0 源码核验）。
 *
 * 演示点：
 *  1. 正典命名空间 TypechoPlugin\DemoKit（Plugin::portal() 固定实例化该前缀）；
 *  2. activate() 注册面板 / Action / 自定义路由，deactivate() 成对注销；
 *  3. config() 配置表单（Text + Radio + Checkbox）；
 *  4. 内容链 contentEx filter Hook，在渲染末端追加“预计阅读时间”。
 *
 * @package DemoKit
 * @author Typecho Agent Skills
 * @version 1.0.0
 * @link https://github.com/typecho/typecho
 */
class Plugin implements PluginInterface
{
    /**
     * 激活插件：注册后台面板、Action、前台路由与 Hook。
     *
     * 注册项会写入 options 表持久化，因此 deactivate() 中必须逐项注销。
     * Hook 回调由核心随插件停用自动清除，无需手动反注册。
     */
    public static function activate(): string
    {
        // 后台面板：$index=1 控制台分组；$level=administrator 限制管理员可见。
        \Helper::addPanel(
            1,
            'DemoKit/panel.php',
            _t('DemoKit'),
            _t('示例面板'),
            'administrator'
        );

        // 后台 Action：POST /index.php/action/demokit-sync（需带 CSRF token）。
        \Helper::addAction('demokit-sync', Action\Sync::class);

        // 前台自定义路由：/demokit/latest.json，命中后调用 LatestFeed::action()。
        \Helper::addRoute(
            'demokit_latest',
            '/demokit/latest.json',
            Widget\LatestFeed::class,
            'action'
        );

        // 内容链 filter Hook：handle 经 Common::nativeClassName() 归一化为 Widget_Base_Contents。
        \Typecho\Plugin::factory('Widget\Base\Contents')->contentEx = __CLASS__ . '::appendReadTime';

        return _t('DemoKit 已启用，请先在插件设置中填写阅读速度');
    }

    /**
     * 禁用插件：与 activate() 严格成对注销面板、Action、路由。
     */
    public static function deactivate(): void
    {
        \Helper::removePanel(1, 'DemoKit/panel.php');
        \Helper::removeAction('demokit-sync');
        \Helper::removeRoute('demokit_latest');
    }

    /**
     * 插件级配置表单。
     *
     * @param Form $form 核心注入的配置表单
     */
    public static function config(Form $form): void
    {
        $speed = new Text(
            'wordsPerMinute',
            null,
            '300',
            _t('阅读速度（字/分钟）'),
            _t('用于计算文章预计阅读时长，建议 200-500')
        );
        $form->addInput($speed->addRule('required', _t('请填写阅读速度')));

        $position = new Radio(
            'position',
            [
                'bottom' => _t('文末'),
                'top'    => _t('文首'),
            ],
            'bottom',
            _t('阅读时长显示位置')
        );
        $form->addInput($position);

        $scope = new Checkbox(
            'scope',
            [
                'post' => _t('仅文章页显示'),
            ],
            ['post'],
            _t('生效范围')
        );
        // multiMode() 让 Checkbox 的多选项以数组形式持久化。
        $form->addInput($scope->multiMode());
    }

    /**
     * 个人用户配置面板（本例无个人配置，保留空实现）。
     *
     * @param Form $form
     */
    public static function personalConfig(Form $form): void
    {
    }

    /**
     * contentEx filter 回调：内容链末端，HTML 已渲染完成。
     *
     * @param string|null $content 渲染后的 HTML
     * @param mixed       $host    触发渲染的 Widget（前台为 Widget\Archive，XMLRPC 等场景为其他子类）
     */
    public static function appendReadTime(?string $content, $host): ?string
    {
        // 仅在前台文章页处理；XMLRPC / Feed 等场景下 $host 不是 Archive。
        if (!($host instanceof Archive) || !$host->is('post')) {
            return $content;
        }

        $config = Options::alloc()->plugin('DemoKit');

        $words = max(1, mb_strlen((string) strip_tags($host->text)));
        $speed = max(1, (int) $config->wordsPerMinute);
        $minutes = (int) ceil($words / $speed);

        $html = '<p class="demokit-read-time">'
            . htmlspecialchars(sprintf(_t('预计阅读时间：%d 分钟'), $minutes))
            . '</p>';

        return 'top' === $config->position ? $html . $content : $content . $html;
    }
}
