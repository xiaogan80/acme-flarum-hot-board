<?php

use Acme\HotBoard\Console\RecountRecentViewsCommand;
use Acme\HotBoard\RecentViews;
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
        ->default('acme-hot-board.showRecommended', true)
        ->default('acme-hot-board.showLatest', true)
        ->default('acme-hot-board.showPopular', true)
        ->default('acme-hot-board.count', 5)
        ->default('acme-hot-board.recommendedMode', 'list')
        ->default('acme-hot-board.latestMode', 'list')
        ->default('acme-hot-board.popularMode', 'list')
        ->default('acme-hot-board.slideInterval', 5)
        ->default('acme-hot-board.allowDismiss', true)
        ->default('acme-hot-board.featuredIds', '')

        ->serializeToForum('acme-hot-board.showRecommended', 'acme-hot-board.showRecommended', fn ($v) => $v === null ? true : (bool) $v)
        ->serializeToForum('acme-hot-board.showLatest', 'acme-hot-board.showLatest', fn ($v) => $v === null ? true : (bool) $v)
        ->serializeToForum('acme-hot-board.showPopular', 'acme-hot-board.showPopular', fn ($v) => $v === null ? true : (bool) $v)
        ->serializeToForum('acme-hot-board.count', 'acme-hot-board.count', function ($v) {
            $n = (int) $v;
            return $n >= 5 && $n <= 10 ? $n : 5;
        })
        ->serializeToForum('acme-hot-board.recommendedMode', 'acme-hot-board.recommendedMode', fn ($v) => in_array($v, ['list', 'image'], true) ? $v : 'list')
        ->serializeToForum('acme-hot-board.latestMode', 'acme-hot-board.latestMode', fn ($v) => in_array($v, ['list', 'image'], true) ? $v : 'list')
        ->serializeToForum('acme-hot-board.popularMode', 'acme-hot-board.popularMode', fn ($v) => in_array($v, ['list', 'image'], true) ? $v : 'list')
        ->serializeToForum('acme-hot-board.slideInterval', 'acme-hot-board.slideInterval', function ($v) {
            $n = (int) $v;
            return $n >= 2 && $n <= 30 ? $n : 5;
        })
        ->serializeToForum('acme-hot-board.allowDismiss', 'acme-hot-board.allowDismiss', fn ($v) => $v === null ? true : (bool) $v)
        // 下发清洗后的 ID 数组，前端不用再解析字符串
        ->serializeToForum('acme-hot-board.featuredIds', 'acme-hot-board.featuredIds', function ($v) {
            $ids = array_filter(array_map('intval', explode(',', (string) $v)), fn ($n) => $n > 0);

            return array_slice(array_values(array_unique($ids)), 0, 20);
        }),

    /*
     * 扩展 Discussion 资源：
     *  - viewCount     全站累计（保留，用于展示）
     *  - viewCountRecent   近 7 天（物化列，「热门浏览」按它排序）
     *  - show 端点序列化前给两个计数 +1，并按天记一条明细
     */
    (new Extend\ApiResource(Resource\DiscussionResource::class))
        ->fields(fn () => [
            Schema\Integer::make('viewCount'),
            Schema\Integer::make('viewCountRecent'),
        ])
        ->sorts(fn () => [
            SortColumn::make('viewCount'),
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
                 * 用 query builder 自增，避免并发下的丢更新；
                 * 同时手动把内存里的值 +1，让本次响应返回的计数是自增后的值
                 * （否则显示的数字会比实际少 1）。
                 *
                 * 两个列都必须落库：view_count 是全站累计，view_count_recent 是
                 * 近 7 天。「热门浏览」按后者排序，只改内存会让排序永远不动。
                 */
                Discussion::query()->whereKey($id)->increment('view_count');
                Discussion::query()->whereKey($id)->increment('view_count_recent');
                $data->view_count = (int) $data->view_count + 1;

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
