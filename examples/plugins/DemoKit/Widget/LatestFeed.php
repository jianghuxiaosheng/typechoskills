<?php

namespace TypechoPlugin\DemoKit\Widget;

use Typecho\Widget;
use Widget\ActionInterface;
use Widget\Contents\Post\Recent;

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

/**
 * DemoKit 前台自定义路由端点（基于 Typecho 1.3.0 源码核验）。
 *
 * 调度链：GET /demokit/latest.json
 *   → Router 命中 addRoute('demokit_latest', ...)
 *   → 核心实例化本类并调用指定的 action 方法 'action'
 *
 * 与后台 Action 相同，自定义路由端点同样以 ActionInterface 为入口契约。
 * 本类直接继承 Typecho\Widget（不经过 Widget\Base 的组件装配），
 * 所需数据通过沙箱实例化 Recent 组件获取。
 *
 * @package DemoKit
 */
class LatestFeed extends Widget implements ActionInterface
{
    /**
     * 输出最新 5 篇已发布文章的 JSON 列表。
     */
    public function action()
    {
        // Recent::execute() 默认 pageSize=options->postsListSize，此处覆盖为 5。
        $posts = Recent::alloc(['pageSize' => 5]);

        $items = [];
        while ($posts->next()) {
            $items[] = [
                'cid'       => (int) $posts->cid,
                'title'     => $posts->title,
                'permalink' => $posts->permalink,
                // filter 阶段 date 被装配为 Typecho\Date 对象。
                'date'      => $posts->date->format('c'),
            ];
        }

        $this->response->throwJson(['items' => $items]);
    }
}
