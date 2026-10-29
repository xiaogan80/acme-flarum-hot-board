# Acme Hot Board

在讨论列表**上方**显示三列看板：**推荐帖子 / 最新帖子 / 热门浏览**。
每条前面自动填充缩略图（帖子内容里的第一张图）或用户头像，不会出现空白圆圈。
列显隐与每列数量可在后台配置。

---

## 已在真实环境验证

本扩展在 **Flarum 2.0.2 + SQLite** 上完整跑通：

| 验证项 | 结果 |
|---|---|
| 看板横跨左栏+内容整宽（位于左侧标签栏之上） | ✅ |
| 讨论详情页不显示看板 | ✅ |
| 缩略图取帖子首图（置顶帖橙色封面、配色帖蓝色封面） | ✅ |
| 无图条目回退为 Avatar 首字母圆圈 | ✅ |
| 浏览量 `viewCount` 自增 + 按浏览量排序 | ✅ 21 / 15 / 12 / 9 / 8 降序正确 |
| 「推荐」列置顶优先、用最新补足 | ✅ |
| 关掉「推荐」列 → 布局收窄为 2 列 | ✅ |
| `count=2` → 每列 2 条 | ✅ |

截图：`../../preview/hotboard-3-fullwidth.png`（当前全宽版）、`hotboard-2-settings.png`（关推荐+count=2）、
`hotboard-1.png`（早期只占右列的版本，留作对比）、`hotboard-discussion-page.png`（详情页不显示）。

---

## 三列的数据来源

| 列 | 数据来源 | 右侧 meta |
|---|---|---|
| **推荐帖子** | 置顶（Sticky）讨论优先，不足用最新讨论补足 | 回复数 |
| **最新帖子** | `sort=-lastPostedAt` | 相对时间 |
| **热门浏览** | `sort=-viewCount` | 浏览量 |

> **为什么「推荐」用置顶**：Flarum 没有内置的「编辑推荐」标记，而 Sticky 扩展（内置）本身就是站长的编辑手段。
> 这样零额外配置即可用，且语义合理。站点未启用 Sticky 时自动降级为「最新」。
> 缺口补齐逻辑保证这一列不会空着（截图里第 1 条是置顶帖，后面 4 条是最新补齐的）。

---

## 缩略图逻辑（核心需求）

优先取**首帖 HTML 里的第一张图**，取不到就回退 Flarum 原生 `Avatar` 组件：

```
首帖 contentHtml 中的 <img src="...">
  ↓ 没有
Flarum Avatar 组件（有上传头像用头像；没有则渲染「首字母 + 用户组颜色」的彩色圆）
  ↓ 连用户都没有
通用图标占位
```

所以任何情况下都有内容，不会出现截图里那种空白圆圈。

实现细节：
- 前端请求时带 `include=user,firstPost`，因此能拿到 `firstPost().contentHtml()` —— **不需要新增 API 字段**，也不影响其他列表的性能。
- 正则忽略 `data:` URI（太大）和协议相对地址（自动补 `https:`）。

---

## 浏览量是怎么来的

Flarum 核心**不统计浏览量**（`flarum/statistics` 只是实时聚合，不落库）。本扩展自己维护：

1. 迁移给 `discussions` 加 `view_count` 整数列（默认 0）
2. 扩展 `DiscussionResource` 的 `show` 端点，在 `beforeSerialization` 里自增
3. 同时暴露 `viewCount` 字段和 `viewCount` 排序

自增用的是 query builder 的 `increment()`，并发下不会丢更新；并把内存中的值同步 +1，让本次响应返回的就是自增后的值（否则显示的数会比实际少 1）。

**已知局限**：每次 `GET /api/discussions/{id}` 都会 +1，包括爬虫和一些客户端重复请求。如需更精确，可改成前端在 `sessionStorage` 里去重后调用专用端点。

---

## 后台设置

后台 → 扩展 → **Hot Board**：

| 界面字段 | 设置 key | 类型 | 默认 |
|---|---|---|---|
| 显示「推荐帖子」区块 | `yingweigan-hot-board.showRecommended` | 开关 | `true` |
| 显示「最新帖子」区块 | `yingweigan-hot-board.showLatest` | 开关 | `true` |
| 显示「热门浏览」区块 | `yingweigan-hot-board.showPopular` | 开关 | `true` |
| 「推荐帖子」展示方式 | `yingweigan-hot-board.recommendedMode` | 下拉：列表 / 图片帖子 | `list` |
| 「最新帖子」展示方式 | `yingweigan-hot-board.latestMode` | 下拉：列表 / 图片帖子 | `list` |
| 「热门浏览」展示方式 | `yingweigan-hot-board.popularMode` | 下拉：列表 / 图片帖子 | `list` |
| 每列显示数量 | `yingweigan-hot-board.count` | 数字 1–10 | `5` |
| 图片自动切换间隔（秒） | `yingweigan-hot-board.slideInterval` | 数字 2–30 | `5` |

前端读取：`app.forum.attribute('yingweigan-hot-board.count')` 等。

布局是 `grid-template-columns: repeat(auto-fit, minmax(268px, 1fr))`，所以关掉一列会自动收窄，不会留下空位。

---

## 两种展示模式（每个区块独立设置）

三个区块（推荐 / 最新 / 热门浏览）各自有一个 `*Mode` 设置，可选 **列表** 或 **图片帖子**，互不影响。

### 列表模式（默认）

紧凑列表：`缩略图 + 标题 + meta（回复数 / 时间 / 浏览量）`。

缩略图优先取首帖第一张图，没有则回退 Flarum 原生 `Avatar`（首字母彩圈），不会出现空白圆圈。

### 图片帖子模式（`*Mode = image`）

该区块变成**图片轮播**，区块标题也随之变成「**图片帖子**」：

- **只显示带图片的帖子** —— 首帖里没有 `<img>` 的讨论直接排除
- **图片占满整个区块**并留一定边距（卡片自身的 padding 就是边距）
- **自动切换**不同帖子的图片，间隔由 `slideInterval` 控制（2–30 秒）
- **图片下方显示帖子标题**，再下面是 meta
- 图片下方有指示点，点击可跳到指定图片；鼠标悬停整个区块时暂停
- 图片加载失败自动回退到作者头像
- 该区块没有任何带图讨论时，整块隐藏

典型用法：只把「推荐帖子」设成图片帖子，其余两列保持列表 —— 既有一张大图吸睛，又保持信息密度。

### 返回首页不闪加载态（stale-while-revalidate）

Flarum 是 SPA，从帖子页返回首页时 `IndexPage` 会重新挂载，`HotBoard` 的 `oninit` 会再跑一次。
如果每次都重新请求，返回首页就会先闪一下加载指示器。

处理方式：在**模块作用域**留一份上次结果的缓存。

- 命中缓存 → 立刻用缓存渲染，**不出现加载态**，同时在后台静默刷新
- 刷新回来数据没变（比较每个分栏的 key/mode/title 与条目 id）→ **跳过重绘**，几乎无感
- 缓存按「配置签名」区分（数量、间隔、三个区块的开关与模式），后台改设置后自然失效
- TTL 60 秒

缓存里存的是**模型实例引用**，所以浏览帖子导致的浏览量变化会自动反映到看板上
（`app.store` 更新的是同一个对象），不需要等刷新。

### 近 7 天热门（而非全站累计）

`discussions.view_count` 是全站累计，只增不减，表达不了滑动窗口。所以：

| 组件 | 作用 |
|---|---|
| `acme_hot_board_view_days` 表 | 按 `(discussion_id, day)` 聚合每天的浏览量，一次访问只在当天行 +1 |
| `discussions.view_count_recent` | 物化列，**「热门浏览」按它排序** |
| `php flarum yingweigan-hot-board:recount` | 每天 03:10 用「窗口内按天求和」覆盖物化列，并删除窗口外明细 |

必须物化一列的原因：Flarum 的 `SortColumn` 只能对 `discussions` 自己的列做 `orderBy`，
没法按另一张表的聚合值排序。

**命名陷阱**：字段名不能用 `viewCount7d` —— `Str::snake()` 会得到 `view_count7d`
（数字前不加下划线），和列名 `view_count_7d` 对不上，导致**字段静默消失、排序失效**。
所以统一用 `viewCountRecent` → `view_count_recent`。

`view_count` 仍然保留并在访问时一起 +1，只是不再用于排序。

## 访客可关闭（本机偏好）

看板右上角有 `×`。点一下写入 `localStorage['yingweigan-hot-board.dismissed'] = '1'`，立即隐藏。

- 这是**本机偏好**，不进数据库、不影响其他访客
- 后台「允许访客关闭看板」关掉后，即使之前关过也会重新显示
- 恢复显示：清掉该 localStorage 键（或换个浏览器/无痕窗口）

## 手动指定「推荐帖子」

后台填讨论 ID（英文逗号分隔，最多 20 个），**顺序即展示顺序**。

来源优先级：`手动指定 → 置顶 → 最新`。不足设定数量时自动用后两者补齐，
所以这一列永远不会空着；某个 ID 被删或无权访问时会被跳过，不影响其他条。

## 高度锁定（区块高度恒定）

共用一个面板意味着**三列必须等高**。这里用两个 CSS 变量把三列的上下边缘都锁死：

```less
--hb-gap-top: 16px;    /* 标题线到内容的统一上间距 */
--hb-list-h: 306px;    /* 列表区固定高度 */

.HotBoard-list       { margin-top: var(--hb-gap-top); height: var(--hb-list-h); }
.HotBoard-coverFrame { margin-top: var(--hb-gap-top); flex: 1 1 auto; }
```

- **上边缘**：图片和列表共用 `--hb-gap-top`，所以首行不会比图片上边缘高出一截
- **下边缘**：图片用 `flex: 1` 吃掉「分栏高度 − 表头 − gap-top」，正好等于列表的
  `gap-top + list-h`，两者底边严格对齐
- 与条数、图片原始尺寸都无关

> 只给图片加 `margin-top` 而列表不加，会出现「列表首行比图片高一截」的错位 —— 这就是为什么两边必须用同一个变量。

### 标题叠在图片内 + 渐变蒙版

标题、meta、指示点都不再占用图片下方的垂直空间，全部绝对定位叠在图片里：

| 元素 | 定位 | 说明 |
|---|---|---|
| `.HotBoard-coverScrim` | 图片底部，高 62% | 四段线性渐变（0.82 → 0），任何亮暗图上标题都可读 |
| `.HotBoard-coverCaption` | 图片底部 | 标题 2 行截断 + meta，带文字阴影 |
| `.HotBoard-dots` | 图片右上角 | 白点 + 描边，避开底部标题 |

图片本身 `object-fit: cover`：等比缩放填满固定框，超出部分裁切，不拉伸变形。

### 圆角

统一取 Flarum 的全局变量 --border-radius（就是「发起讨论」按钮用的那个值），
面板、图片框、骨架屏、关闭按钮全部引用 ar(--border-radius, 4px)，
这样跟主题换皮时能跟着一起变，不写死像素。

### 两行布局（条数 5–6）

行高宽裕时改为「上面标题、下面作者与时间」，贴近 Flarum 自己的讨论列表：

`
[圆]  怎么管理社区里的灌水帖
      admin 发布于 1 小时前
`

条数 ≥7 时行高被压缩，自动退回单行；此时「最新帖子」右侧的重复时间也会去掉
（副标题已经写了时间）。
### 条数 5–10 与简易样式

数量范围限制为 **5–10**（`min: 5, max: 10`）。

条数 ≥ 7 时行高被压缩到约 46px，放不下 40px 的圆形容器，
前端给面板加 `HotBoard--dense` 类切换简易样式：缩略图 24px、字号 12.5px、上下内边距归零。

| 条数 | 行高（约） | 样式 |
|---|---|---|
| 5 | 64px | 常规 |
| 6 | 54px | 常规 |
| 7–10 | 46→32px | 简易（`HotBoard--dense`）|

实现要点：服务端无法按「有无图片」过滤，所以只要有任一区块是图片模式，就会把请求条数放大
（`max(count × 5, 20)`，上限 50），在前端筛出带图的再截断到 `count`。
取太少会经常筛不出内容，这是有意的取舍。

---

## 安装

```bash
# 1. 放进 packages 目录
cp -r yingweigan-hot-board /path/to/flarum/packages/

# 2. 让 Composer 认这个目录（只需一次）
cd /path/to/flarum
composer config repositories.0 path "packages/*"

# 3. 编译前端
cd packages/yingweigan-hot-board/js
npm install && npm run build

# 4. 安装 + 启用（启用时会自动跑迁移）
cd /path/to/flarum
composer require yingweigan/flarum-hot-board "*@dev"
php flarum extension:enable yingweigan-hot-board
php flarum cache:clear
```

> 迁移在**扩展启用时**自动执行。若之后新增迁移，需手动 `php flarum migrate`。
> 回滚：后台 Purge，或 `php flarum migrate:reset`。

---

## 文件结构

```
yingweigan-hot-board/
├── composer.json                        # 元信息（category: forum-widget）
├── extend.php                           # 资源注册 + 设置 + Discussion 资源扩展
├── migrations/
│   └── 2025_01_01_000000_add_view_count_to_discussions.php
├── less/forum.less                      # 三列看板样式
├── locale/{en,zh-Hans}.yml
└── js/
    ├── package.json / webpack.config.js / tsconfig.json
    ├── forum.js  / admin.js
    ├── dist/                            # 构建产物
    └── src/
        ├── common/thumbnail.js          # 从 HTML 提第一张图
        ├── forum/
        │   ├── extend.js                # 注册 viewCount 到前端 Discussion 模型
        │   ├── index.js                 # 注入 PageStructure.mainItems（跨全宽）
        │   └── components/
        │       ├── HotBoard.js          # 三列编排 + 并发加载
        │       ├── HotBoardColumn.js
        │       └── HotBoardItem.js      # 缩略图/头像
        └── admin/{index,extend}.js      # 4 项设置
```

---

## 看板放在哪：为什么是 PageStructure 而不是 IndexPage

这是本扩展唯一一处容易改错的地方，说清楚省得以后再踩。

Flarum 2.x 的页面层级（`framework/core/js/src/forum/components/PageStructure.tsx`）：

```
.Page
└── .Page-main
    ├── skipToMainContent
    ├── .Page-hero                 ← 顶部大标题
    └── .Page-container.container  ← 整行容器
        ├── .Page-sidebar          ← 左侧：Start a Discussion / All Discussions / Tags
        └── .Page-content          ← 右侧：讨论列表
```

**如果注入 `IndexPage.contentItems()`**，你会进到 `.Page-content` 里，
也就是只在右侧内容列中显示，左侧标签栏会横在旁边 —— 这就是最初的版本。

**正确做法是注入 `PageStructure.mainItems()`**：

| item key | 优先级 |
|---|---|
| `skipToMainContent` | 200 |
| `hero` | 100 |
| **`hotBoard`（本扩展）** | **50** |
| `container` | 10 |

落在 hero 与 container 之间，即「hero 之下、左侧栏+内容行之上」。

再看自己套一层 `.container`：

```jsx
<div className="container HotBoard-wrap">{this.attrs.HotBoard}</div>
```

这样宽度就和下面的 `.Page-container.container` 完全对齐
（= 左侧标签栏 + 右侧内容的总宽）。

### 为什么统一注入不会跑到别的页面

`PageStructure` 被很多页面复用。所以做了 className 守卫：

```js
const className = String(this.attrs.className || '');
if (!className.split(/\s+/).includes('IndexPage')) return;
```

各页面的 className：

| 页面 | className | 是否显示看板 |
|---|---|---|
| 讨论列表页 | `IndexPage` | ✅ |
| 讨论详情页 | `DiscussionPage` | ❌ 已实测确认 |
| 标签总览页 | `TagsPage Page--vertical` | ❌ |
| 用户页 | `UserPage` | ❌ |
| 帖子页 | `PostsPage` | ❌ |

---

## 踩坑记录（真实测试才发现）

### `.js` 文件里写 TypeScript 泛型会炸

第一版 `extend.js` 写成了：

```js
new Extend.Model(Discussion).attribute<number>('viewCount')
```

webpack **编译通过**，但运行时整个页面报 `ReferenceError: number is not defined`，看板完全不渲染。
原因是 `.js` 文件启用了 JSX，`<number>` 被当成 JSX 元素解析，`number` 变成了未定义标识符。

**规则**：`.js` 文件里不要写 TS 泛型/类型注解；要写就用 `.ts` / `.tsx` 并把文件改名。
（顺带说明：webpack 编译成功 ≠ 代码能跑，必须真的在浏览器里加载一次。）

### 注入点用 95

`IndexPage.contentItems()` 里 `toolbar` 是 100、`discussionList` 是 90。
插 **95** 正好落在「排序工具栏」和「讨论列表」之间，即需求要的「讨论帖上方」。
`flarum/tags` 的 `TagsPage` 继承 `IndexPage`，所以标签页也会显示看板。

---

## 下一步可做

- 「热门浏览」改成按时间段统计（近 7 天），而不是全站累计
- 增加「用户可关闭」的本地开关
- 缩略图支持从 `og:image` 或帖子附件取图
- 支持手动指定「推荐」列表（而非仅用置顶）
