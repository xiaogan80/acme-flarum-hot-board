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
                $table->unsignedInteger('view_count_recent')->default(0);
                $table->index('view_count_recent');
            });
        }

        if (! $schema->hasTable('yingweigan_hot_board_view_days')) {
            $schema->create('yingweigan_hot_board_view_days', function (Blueprint $table) {
                $table->unsignedInteger('discussion_id');
                $table->date('day');
                $table->unsignedInteger('views')->default(0);

                // 每个讨论每天只有一行，自增时不需要先查再插
                $table->primary(['discussion_id', 'day']);
            });
        }
    },

    'down' => function (Builder $schema) {
        if ($schema->hasTable('yingweigan_hot_board_view_days')) {
            $schema->drop('yingweigan_hot_board_view_days');
        }

        if ($schema->hasColumn('discussions', 'view_count_recent')) {
            $schema->table('discussions', function (Blueprint $table) {
                $table->dropColumn('view_count_recent');
            });
        }
    },
];
