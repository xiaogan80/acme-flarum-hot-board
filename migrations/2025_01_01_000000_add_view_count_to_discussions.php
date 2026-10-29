<?php

/*
 * 给 discussions 加浏览量列。
 *
 * Flarum 核心不统计浏览量（flarum/statistics 只是实时聚合，不落库），
 * 所以「热门浏览」需要自己维护一个计数器。
 *
 * 用 hasColumn 保护，而不是 Migration::addColumns()：
 * 如果站上已经装了别的浏览量扩展（如 fof/discussion-views），
 * discussions 可能已经有 view_count 列，直接 ADD 会抛
 * "Duplicate column name"，而 Flarum 只会显示一个笼统的
 * 「数据库查询失败。某个扩展程序可能与当前使用的数据库驱动不兼容。」
 * 页面，SQL 细节被完全隐藏，非常难排查。
 */

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Schema\Builder;

return [
    'up' => function (Builder $schema) {
        if (! $schema->hasColumn('discussions', 'view_count')) {
            $schema->table('discussions', function (Blueprint $table) {
                $table->unsignedInteger('view_count')->default(0);
            });
        }
    },

    'down' => function (Builder $schema) {
        if ($schema->hasColumn('discussions', 'view_count')) {
            $schema->table('discussions', function (Blueprint $table) {
                $table->dropColumn('view_count');
            });
        }
    },
];
