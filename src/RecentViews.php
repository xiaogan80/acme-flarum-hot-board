<?php

namespace Acme\HotBoard;

use Illuminate\Database\ConnectionInterface;

/**
 * 「热门浏览」的近 N 天浏览量统计。
 *
 * 为什么不能只用 discussions.view_count：
 * 那是全站累计，只增不减，没法表达「最近 7 天」这种滑动窗口。
 *
 * 方案：
 *  1. 每次访问 +1 到按天聚合表 acme_hot_board_view_days（按天一行，增量很小）
 *  2. 同时 +1 到 discussions.view_count_recent（物化列，保证实时排序）
 *  3. 定时任务用「窗口内按天求和」覆盖物化列，纠正漂移并淘汰过期数据
 *
 * 物化列的存在是被迫的：Flarum 的 SortColumn 只能对 discussions 自己的列排序，
 * 没法按另一张表的聚合值排序。
 */
class RecentViews
{
    /** 统计窗口：含今天在内共 7 天 */
    public const WINDOW_DAYS = 7;

    public const TABLE = 'acme_hot_board_view_days';

    /** 窗口起点，格式 Y-m-d */
    public static function cutoff(): string
    {
        return date('Y-m-d', strtotime('-' . (self::WINDOW_DAYS - 1) . ' days'));
    }

    /**
     * 记录一次访问。
     *
     * 正常路径只有一次 UPDATE（当天行已存在）。
     * 首次访问当天需要 INSERT；并发插入撞主键时退回 increment，
     * 既不会丢计数也不会抛错。
     */
    public static function record(ConnectionInterface $db, int $discussionId, ?string $day = null): void
    {
        $day = $day ?? date('Y-m-d');

        $affected = $db->table(self::TABLE)
            ->where('discussion_id', $discussionId)
            ->where('day', $day)
            ->increment('views');

        if ($affected > 0) {
            return;
        }

        try {
            $db->table(self::TABLE)->insert([
                'discussion_id' => $discussionId,
                'day' => $day,
                'views' => 1,
            ]);
        } catch (\Throwable $e) {
            $db->table(self::TABLE)
                ->where('discussion_id', $discussionId)
                ->where('day', $day)
                ->increment('views');
        }
    }

    /**
     * 重算所有讨论的 view_count_recent，并清理窗口外的明细。
     *
     * @return array{recounted:int, pruned:int, cutoff:string}
     */
    public static function recount(ConnectionInterface $db): array
    {
        $cutoff = self::cutoff();

        $pruned = $db->table(self::TABLE)->where('day', '<', $cutoff)->delete();

        $sums = $db->table(self::TABLE)
            ->selectRaw('discussion_id, SUM(views) as total')
            ->where('day', '>=', $cutoff)
            ->groupBy('discussion_id')
            ->pluck('total', 'discussion_id');

        // 先整体归零，再把窗口内有数据的写回去，否则早已过期的计数会一直留着
        $db->table('discussions')->update(['view_count_recent' => 0]);

        foreach ($sums as $discussionId => $total) {
            $db->table('discussions')
                ->where('id', (int) $discussionId)
                ->update(['view_count_recent' => (int) $total]);
        }

        return [
            'recounted' => count($sums),
            'pruned' => (int) $pruned,
            'cutoff' => $cutoff,
        ];
    }
}
