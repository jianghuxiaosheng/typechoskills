<?php

namespace TypechoPlugin\DemoKit\Action;

use Widget\ActionInterface;
use Widget\Base;

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

/**
 * DemoKit 后台 Action（基于 Typecho 1.3.0 源码核验）。
 *
 * 调度链：POST /index.php/action/demokit-sync
 *   → Widget\Action::execute() 查 actionTable 找到本类
 *   → 核心先实例化并执行 execute()，再调用 action()
 *
 * 注意：
 *  1. 必须 implements Widget\ActionInterface（全局 namespace Widget），
 *     否则核心 instanceof 校验失败直接返回 404；
 *  2. Action 入口不做任何自动鉴权，必须在 execute()/action() 中手动
 *     $this->user->pass() 与 $this->security->protect()（CSRF）；
 *  3. execute() 覆盖父类 Typecho\Widget::execute()，可见性必须保持 public，
 *     收窄为 protected 会触发致命错误。
 *
 * @package DemoKit
 */
class Sync extends Base implements ActionInterface
{
    /**
     * 组件初始化阶段执行：鉴权 + CSRF 校验。
     *
     * 实例化后由核心统一调用；未通过 pass() 会被 302/403 拦截，
     * 未通过 protect() 会被 response->goBack() 拦回来源页。
     */
    public function execute()
    {
        $this->user->pass('administrator');
        $this->security->protect();
    }

    /**
     * Action 实际入口（ActionInterface 要求）。
     */
    public function action()
    {
        // 示例动作：真实项目中在此执行同步任务。
        $this->response->throwJson([
            'ok'      => true,
            'message' => _t('同步完成（示例）'),
            'time'    => $this->options->time,
        ]);
    }
}
