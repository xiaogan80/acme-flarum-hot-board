<?php

/*
 * 「热门浏览」改成近 7 天统计所需的存储结构。
 *
 * 为什么要在 discussions 上物化一列：
 * Flarum 的 SortColumn 是直接对 discussions 表的列做 orderBy 的，
 * 没法按「另一张表的聚合值」排序。所以把 7 天聚合值物化到
 * view_count_recent，排序就能走普通列（还能加索引）。
 *
 * 按天聚合表用来在窗口滚动时重算，并按天淘汰历史数据，
 * 这样表不会无限增长。
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (! $schema->hasColumn('discussions', 'view_count_recent')) {
            $schema->table('discussions', function (Blueprint $table) {
                /*
                 * 不在这里建索引。
                 * 「加列 + 同一个闭包里加索引」在 MySQL 上会拆成两条 ALTER，
                 * 只要索引那一步因为重名/权限失败，整个迁移就中断，
                 * 而列其实已经加上了，重跑时 hasColumn 为真、索引永远补不上。
                 * 这一列只在「热门浏览」排序时用到，数据量不大时没有索引也能跑，
                 * 需要时手动建：
                 *   CREATE INDEX discussions_view_count_recent_index
                 *     ON discussions (view_count_recent);
                 */
                $table->unsignedInteger('view_count_recent')->default(0);
            });
        }

        if (! $schema->hasTable('xiaogan80_hot_board_view_days')) {
            $schema->create('xiaogan80_hot_board_view_days', function (Blueprint $table) {
                $table->unsignedInteger('discussion_id');
                $table->date('day');
                $table->unsignedInteger('views')->default(0);

                // 每个讨论每天只有一行，自增时不需要先查再插
                $table->primary(['discussion_id', 'day']);
            });
        }
    },

    'down' => function (Builder $schema) {
        if ($schema->hasTable('xiaogan80_hot_board_view_days')) {
            $schema->drop('xiaogan80_hot_board_view_days');
        }

        if ($schema->hasColumn('discussions', 'view_count_recent')) {
            $schema->table('discussions', function (Blueprint $table) {
                $table->dropColumn('view_count_recent');
            });
        }
    },
];
