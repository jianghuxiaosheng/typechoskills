<?php

/**
 * BareBones 主题函数文件（基于 Typecho 1.3.0 源码核验）。
 *
 * functions.php 在主题启用期间由核心自动加载，约定两个钩子函数：
 *  - themeConfig($form)：后台「外观 → 设置外观」的主题级配置表单，用 addInput()；
 *  - themeFields($layout)：文章/页面编辑页的自定义字段，用 addItem()。
 * 二者均为可选；不存在时后台不显示对应入口。
 */

if (!defined('__TYPECHO_ROOT_DIR__')) {
    exit;
}

/**
 * 主题级配置表单。
 *
 * @param \Typecho\Widget\Helper\Form $form
 */
function themeConfig($form)
{
    $footerNote = new \Typecho\Widget\Helper\Form\Element\Text(
        'footerNote',
        null,
        null,
        _t('页脚备注'),
        _t('显示在全站页脚的一行文字，例如备案号')
    );
    $form->addInput($footerNote);

    $showSearch = new \Typecho\Widget\Helper\Form\Element\Radio(
        'showSearch',
        [
            '1' => _t('显示'),
            '0' => _t('隐藏'),
        ],
        '1',
        _t('是否显示搜索框')
    );
    $form->addInput($showSearch);
}

/**
 * 文章/页面编辑页自定义字段。
 *
 * 与 themeConfig 的区别：字段随每篇内容单独保存，
 * 模板中通过 $this->fields->fieldName 读取。
 *
 * @param \Typecho\Widget\Helper\Layout $layout
 */
function themeFields($layout)
{
    $sourceUrl = new \Typecho\Widget\Helper\Form\Element\Url(
        'sourceUrl',
        null,
        null,
        _t('原文链接'),
        _t('转载文章可在此填写原文 URL')
    );
    $layout->addItem($sourceUrl);
}
