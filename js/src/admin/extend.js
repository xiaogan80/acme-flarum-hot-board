import Extend from 'flarum/common/extenders';
import app from 'flarum/admin/app';

function t(key) {
  return app.translator.trans(`acme-hot-board.admin.${key}`, {}, true);
}

/** 区块展示方式：列表 / 图片帖子 */
function modeOptions() {
  return {
    list: t('mode_list'),
    image: t('mode_image'),
  };
}

export default [
  new Extend.Admin()
    // ---------- 推荐帖子 ----------
    .setting(
      () => ({
        setting: 'acme-hot-board.showRecommended',
        label: t('show_recommended_label'),
        help: t('show_recommended_help'),
        type: 'boolean',
      }),
      100
    )
    .setting(
      () => ({
        setting: 'acme-hot-board.recommendedMode',
        label: t('mode_recommended_label'),
        help: t('mode_help'),
        type: 'select',
        options: modeOptions(),
        default: 'list',
      }),
      95
    )

    // ---------- 最新帖子 ----------
    .setting(
      () => ({
        setting: 'acme-hot-board.showLatest',
        label: t('show_latest_label'),
        help: t('show_latest_help'),
        type: 'boolean',
      }),
      90
    )
    .setting(
      () => ({
        setting: 'acme-hot-board.latestMode',
        label: t('mode_latest_label'),
        help: t('mode_help'),
        type: 'select',
        options: modeOptions(),
        default: 'list',
      }),
      85
    )

    // ---------- 热门浏览 ----------
    .setting(
      () => ({
        setting: 'acme-hot-board.showPopular',
        label: t('show_popular_label'),
        help: t('show_popular_help'),
        type: 'boolean',
      }),
      80
    )
    .setting(
      () => ({
        setting: 'acme-hot-board.popularMode',
        label: t('mode_popular_label'),
        help: t('mode_help'),
        type: 'select',
        options: modeOptions(),
        default: 'list',
      }),
      75
    )

    // ---------- 推荐列表来源 ----------
    .setting(
      () => ({
        setting: 'acme-hot-board.featuredIds',
        label: t('featured_label'),
        help: t('featured_help'),
        type: 'text',
        placeholder: 'e.g. 12, 8, 3',
      }),
      70
    )

    // ---------- 通用 ----------
    .setting(
      () => ({
        setting: 'acme-hot-board.count',
        label: t('count_label'),
        help: t('count_help'),
        type: 'number',
        min: 5,
        max: 10,
      }),
      60
    )
    .setting(
      () => ({
        setting: 'acme-hot-board.allowDismiss',
        label: t('allow_dismiss_label'),
        help: t('allow_dismiss_help'),
        type: 'boolean',
      }),
      40
    )
    .setting(
      () => ({
        setting: 'acme-hot-board.slideInterval',
        label: t('slide_interval_label'),
        help: t('slide_interval_help'),
        type: 'number',
        min: 2,
        max: 30,
      }),
      50
    ),
];
