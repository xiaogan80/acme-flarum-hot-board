# 更新日志

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

> **注意**：v1.2.0 之前用过 `acme/` 和 `yingweigan/` 两个包名，均未正式发布。
> `acme` 在 Packagist 上已被他人占用，`yingweigan` 是已废弃的 GitHub 用户名。
> 正式发布从 `xiaogan80/flarum-hot-board` v1.2.0 开始，**v1.2.0 是第一个可用版本**。

## v1.2.1

- 文档：安装说明改为 Packagist 直装（`composer require xiaogan80/flarum-hot-board`）
- 新增本更新日志

## v1.2.0

首个正式版本。发布到 Packagist：`xiaogan80/flarum-hot-board`。

功能：

- 讨论列表上方的三列看板：推荐帖子 / 最新帖子 / 热门浏览
- 缩略图优先取正文首图，回退用户头像，永不空白
- 任意单列可切换图片模式（轮播 + 渐变遮罩标题）
- 「热门浏览」按近 7 天浏览量统计，每日定时重算滚动窗口
- 每列 5–10 条，**区块高度恒定**，切换配置不跳动
- 首页骨架屏，返回列表不闪加载态（60 秒内存缓存）
- 后台可手动指定推荐讨论 ID 及顺序
- 访客可通过右上角 `×` 关闭看板（localStorage，本机偏好）
- 中英双语语言包，深色模式适配

数据变更：

- `discussions.view_count`（全站累计）
- `discussions.view_count_recent`（近 7 天，物化列，用于排序）
- `xiaogan80_hot_board_view_days`（按天聚合明细）

定时任务：

- `php flarum xiaogan80-hot-board:recount` 每天 03:10 执行，需要 `schedule:run` 由 cron 驱动

### 破坏性变更（仅对早期测试安装）

- 扩展 ID 由 `acme-hot-board` → `yingweigan-hot-board` → `xiaogan80-hot-board`
- 设置键与语言包键随扩展 ID 同步变更
- 明细表由 `acme_hot_board_view_days` 改为 `xiaogan80_hot_board_view_days`

由于这些早期版本从未正式发布，没有真实用户受影响。
