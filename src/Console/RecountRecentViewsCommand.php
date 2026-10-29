<?php

namespace Acme\HotBoard\Console;

use Acme\HotBoard\RecentViews;
use Flarum\Console\AbstractCommand;
use Illuminate\Database\ConnectionInterface;

/**
 * 重算 discussions.view_count_recent（热点看板「热门浏览」列的排序依据）。
 *
 * 每天跑一次：用「窗口内按天求和」覆盖物化列，并淘汰窗口外的历史明细。
 */
class RecountRecentViewsCommand extends AbstractCommand
{
    public function __construct(protected ConnectionInterface $db)
    {
        parent::__construct();
    }

    protected function configure(): void
    {
        $this
            ->setName('acme-hot-board:recount')
            ->setDescription('重算热点看板「热门浏览」使用的近 7 天浏览量');
    }

    protected function fire(): int
    {
        $result = RecentViews::recount($this->db);

        $this->info(sprintf(
            '热点看板：已重算 %d 条讨论的近 %d 天浏览量（窗口 %s ~ %s，清理历史明细 %d 行）。',
            $result['recounted'],
            RecentViews::WINDOW_DAYS,
            $result['cutoff'],
            date('Y-m-d'),
            $result['pruned']
        ));

        return 0;
    }
}
