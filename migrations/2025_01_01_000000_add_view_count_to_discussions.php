<?php

use Flarum\Database\Migration;

/*
 * 给 discussions 加浏览量列。
 *
 * Flarum 核心不统计浏览量（flarum/statistics 只是实时聚合，不落库），
 * 所以「热门浏览」需要自己维护一个计数器。
 */
return Migration::addColumns('discussions', [
    'view_count' => ['integer', 'unsigned' => true, 'default' => 0],
]);
