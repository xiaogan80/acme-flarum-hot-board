<?php

use Xiaogan80\HotBoard\Console\RecountRecentViewsCommand;
use Xiaogan80\HotBoard\RecentViews;
use Flarum\Api\Context;
use Flarum\Api\Endpoint;
use Flarum\Api\Resource;
use Flarum\Api\Schema;
use Flarum\Api\Sort\SortColumn;
use Flarum\Discussion\Discussion;
use Flarum\Extend;
use Illuminate\Database\ConnectionInterface;

return [
    (new Extend\Frontend('forum'))
        ->js(__DIR__ . '/js/dist/forum.js')
        ->css(__DIR__ . '/less/forum.less'),

    (new Extend\Frontend('admin'))
        ->js(__DIR__ . '/js/dist/admin.js'),

    // Flarum 2.x 不会自动发现 locale/，必须显式注册
    (new Extend\Locales(__DIR__ . '/locale')),

    /*
     * 默认值 + 下发到 admin/forum 前端。
     * 变换函数显式处理 null，避免 default() 与 serializeToForum() 时序不同导致的误判。
     */
    (new Extend\Settings())
        ->default('xiaogan80-hot-board.showRecommended', true)
        ->default('xiaogan80-hot-board.showLatest', true)
        ->default('xiaogan80-hot-board.showPopular', true)
        ->default('xiaogan80-hot-board.count', 5)
        ->default('xiaogan80-hot-board.recommendedMode', 'list')
        ->default('xiaogan80-hot-board.latestMode', 'list')
        ->default('xiaogan80-hot-board.popularMode', 'list')
        ->default('xiaogan80-hot-board.slideInterval', 5)
        ->default('xiaogan80-hot-board.allowDismiss', true)
        ->default('xiaogan80-hot-board.featuredIds', '')

        ->serializeToForum('xiaogan80-hot-board.showRecommended', 'xiaogan80-hot-board.showRecommended', fn ($v) => $v === null ? true : (bool) $v)
        ->serializeToForum('xiaogan80-hot-board.showLatest', 'xiaogan80-hot-board.showLatest', fn ($v) => $v === null ? true : (bool) $v)
        ->serializeToForum('xiaogan80-hot-board.showPopular', 'xiaogan80-hot-board.showPopular', fn ($v) => $v === null ? true : (bool) $v)
        ->serializeToForum('xiaogan80-hot-board.count', 'xiaogan80-hot-board.count', function ($v) {
            $n = (int) $v;
            return $n >= 5 && $n <= 10 ? $n : 5;
        })
        ->serializeToForum('xiaogan80-hot-board.recommendedMode', 'xiaogan80-hot-board.recommendedMode', fn ($v) => in_array($v, ['list', 'image'], true) ? $v : 'list')
        ->serializeToForum('xiaogan80-hot-board.latestMode', 'xiaogan80-hot-board.latestMode', fn ($v) => in_array($v, ['list', 'image'], true) ? $v : 'list')
        ->serializeToForum('xiaogan80-hot-board.popularMode', 'xiaogan80-hot-board.popularMode', fn ($v) => in_array($v, ['list', 'image'], true) ? $v : 'list')
        ->serializeToForum('xiaogan80-hot-board.slideInterval', 'xiaogan80-hot-board.slideInterval', function ($v) {
            $n = (int) $v;
            return $n >= 2 && $n <= 30 ? $n : 5;
        })
        ->serializeToForum('xiaogan80-hot-board.allowDismiss', 'xiaogan80-hot-board.allowDismiss', fn ($v) => $v === null ? true : (bool) $v)
        // 下发清洗后的 ID 数组，前端不用再解析字符串
        ->serializeToForum('xiaogan80-hot-board.featuredIds', 'xiaogan80-hot-board.featuredIds', function ($v) {
            $ids = array_filter(array_map('intval', explode(',', (string) $v)), fn ($n) => $n > 0);

            return array_slice(array_values(array_unique($ids)), 0, 20);
        }),

    /*
     * 扩展 Discussion 资源：
     *  - viewCount       全站累计（**只读**，见下方说明）
     *  - viewCountRecent 近 7 天（本扩展自己的物化列，「热门浏览」按它排序）
     *  - show 端点序列化前给近 7 天计数 +1，并按天记一条明细
     *
     * 关于 viewCount：
     * 这一列不由本扩展创建。fof/discussion-views 已经在 discussions 上加了
     * view_count 并且自己维护自增；很多论坛都装了它。如果本扩展也去建这一列，
     * 迁移会抛 "Duplicate column name 'view_count'"，而 Flarum 只会显示
     * 一个笼统的「数据库查询失败」页面，几乎无法排查。
     * 所以这里只「读」不「写」：装了 fof/discussion-views 就能显示它的数据，
     * 没装则返回 0，绝不与它抢同一列。
     *
     * 同理不注册 viewCount 的排序 —— 按一个可能不存在的列 ORDER BY 会直接 SQL 报错。
     */
    (new Extend\ApiResource(Resource\DiscussionResource::class))
        ->fields(fn () => [
            Schema\Integer::make('viewCount')->get(fn (Discussion $d) => (int) ($d->view_count ?? 0)),
            Schema\Integer::make('viewCountRecent'),
        ])
        ->sorts(fn () => [
            SortColumn::make('viewCountRecent'),
        ])
        ->endpoint('show', function (Endpoint\Show $endpoint) {
            return $endpoint->beforeSerialization(function (Context $context, mixed $data) {
                if (! $data instanceof Discussion) {
                    return;
                }

                $id = (int) $data->getKey();
                $db = resolve(ConnectionInterface::class);

                /*
                 * 只维护本扩展自己的两个计数：view_count_recent 与按天明细。
                 * view_count（全站累计）交给 fof/discussion-views 之类的扩展，
                 * 这里碰都不碰，避免重复计数。
                 */
                Discussion::query()->whereKey($id)->increment('view_count_recent');

                RecentViews::record($db, $id);
                $data->view_count_recent = (int) $data->view_count_recent + 1;
            });
        }),

    /*
     * 定时任务：每天用「窗口内按天求和」重算 view_count_recent，
     * 并淘汰窗口外的历史明细。
     */
    (new Extend\Console())
        ->command(RecountRecentViewsCommand::class)
        ->schedule(RecountRecentViewsCommand::class, fn ($event) => $event->dailyAt('03:10')),
];
