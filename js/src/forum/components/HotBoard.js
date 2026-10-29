import Component from 'flarum/common/Component';
import app from 'flarum/forum/app';

import HotBoardColumn from './HotBoardColumn';
import HotBoardCoverColumn from './HotBoardCoverColumn';
import { discussionImage } from '../../common/thumbnail';

const MIN_COUNT = 5;
const MAX_COUNT = 10;
const DEFAULT_COUNT = 5;

/**
 * 条数达到这个值后行高放不下 40px 缩略图（行高约 46px 以下），
 * 切换为简易样式：缩略图缩小、字号收紧。
 */
const DENSE_FROM = 7;

const DEFAULT_INTERVAL = 5;
const MIN_INTERVAL = 2;
const MAX_INTERVAL = 30;

/** 图片模式下最多扫描多少条来凑够带图的讨论 */
const MAX_SCAN = 50;

function t(key) {
  return app.translator.trans(`xiaogan80-hot-board.forum.${key}`);
}

/** 未设置时视为开启 */
function isOn(key) {
  return app.forum.attribute(key) !== false;
}

/** 区块展示方式：'list' | 'image' */
function modeOf(key) {
  return app.forum.attribute(key) === 'image' ? 'image' : 'list';
}

function clampInt(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function itemCount() {
  return clampInt(app.forum.attribute('xiaogan80-hot-board.count'), DEFAULT_COUNT, MIN_COUNT, MAX_COUNT);
}

function slideInterval() {
  return clampInt(app.forum.attribute('xiaogan80-hot-board.slideInterval'), DEFAULT_INTERVAL, MIN_INTERVAL, MAX_INTERVAL);
}

/*
 * 模块级缓存（stale-while-revalidate）。
 *
 * Flarum 是 SPA：从帖子页返回首页时 IndexPage 会重新挂载，
 * HotBoard 的 oninit 会再跑一次。没有缓存的话每次返回都要先闪一下
 * 加载指示器，等三个请求回来才出现看板，体验很差。
 *
 * 这里把上一次的结果留在模块作用域里：返回时立刻用缓存渲染，
 * 再在后台静默刷新一次（数据没变就几乎无感）。
 * 缓存按「配置签名」区分，后台改了设置会自然失效。
 */
const CACHE_TTL_MS = 60 * 1000;
let boardCache = null;

function configSignature() {
  return [
    `n=${itemCount()}`,
    `i=${slideInterval()}`,
    `r=${isOn('xiaogan80-hot-board.showRecommended')}${modeOf('xiaogan80-hot-board.recommendedMode')}`,
    `l=${isOn('xiaogan80-hot-board.showLatest')}${modeOf('xiaogan80-hot-board.latestMode')}`,
    `p=${isOn('xiaogan80-hot-board.showPopular')}${modeOf('xiaogan80-hot-board.popularMode')}`,
    // 手动推荐列表变了，缓存必须失效
    `f=${featuredIds().join('.')}`,
  ].join('|');
}

/** 后台手动指定的推荐讨论 ID（后端已清洗成数组） */
function featuredIds() {
  const raw = app.forum.attribute('xiaogan80-hot-board.featuredIds');

  if (Array.isArray(raw)) return raw.map((n) => parseInt(n, 10)).filter((n) => n > 0);
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n > 0);
  }

  return [];
}

/** 站点是否允许访客自己关掉看板 */
function allowDismiss() {
  return app.forum.attribute('xiaogan80-hot-board.allowDismiss') !== false;
}

/*
 * 「用户可关闭」是本机偏好，存在 localStorage 里 ——
 * 和 Flarum 自己的欢迎横幅一样，属于这台设备的个人选择，不进数据库。
 */
const DISMISS_KEY = 'xiaogan80-hot-board.dismissed';

function isDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch (e) {
    // 隐私模式下 localStorage 可能抛错，当作没关过
    return false;
  }
}

/** 比较两次结果是否一致，用于跳过无意义的重绘 */
function sameSections(a, b) {
  if (!a || !b || a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const x = a[i];
    const y = b[i];

    if (x.key !== y.key || x.mode !== y.mode || x.title !== y.title) return false;
    if (x.items.length !== y.items.length) return false;

    for (let j = 0; j < x.items.length; j++) {
      if (x.items[j].id() !== y.items[j].id()) return false;
    }
  }

  return true;
}

/**
 * 讨论列表上方的三列看板：推荐 / 最新 / 热门浏览。
 *
 * 每个区块可以**独立**选择展示方式：
 *  - list   紧凑列表（缩略图 + 标题 + meta）
 *  - image  图片帖子（只保留首帖有图的讨论，图片占满区块并自动轮播，
 *                     区块标题也变成「图片帖子」）
 *
 * 三个区块各自独立请求数据，单块失败不影响其他块；没有数据的块整块不渲染。
 */
export default class HotBoard extends Component {
  oninit(vnode) {
    super.oninit(vnode);

    this.dismissed = isDismissed();

    const signature = configSignature();
    this.signature = signature;

    const cached =
      boardCache && boardCache.signature === signature && Date.now() - boardCache.at < CACHE_TTL_MS
        ? boardCache
        : null;

    if (cached) {
      // 有可用缓存：直接渲染上次的结果，不出现加载态
      this.sections = cached.sections;
      this.interval = cached.interval;
      this.count = cached.count;
      this.loading = false;
    } else {
      this.sections = [];
      this.loading = true;
    }

    this.load();
  }

  /**
   * 当前配置下应该显示哪些分栏（不含数据）。
   * 骨架屏和真实渲染共用它，保证两者结构完全一致。
   */
  buildPlan() {
    return [
      {
        key: 'recommended',
        icon: 'fas fa-star',
        show: isOn('xiaogan80-hot-board.showRecommended'),
        mode: modeOf('xiaogan80-hot-board.recommendedMode'),
      },
      {
        key: 'latest',
        icon: 'fas fa-clock',
        show: isOn('xiaogan80-hot-board.showLatest'),
        mode: modeOf('xiaogan80-hot-board.latestMode'),
      },
      {
        key: 'popular',
        icon: 'fas fa-fire',
        show: isOn('xiaogan80-hot-board.showPopular'),
        mode: modeOf('xiaogan80-hot-board.popularMode'),
      },
    ]
      .filter((p) => p.show)
      .map((p) => ({ ...p, title: p.mode === 'image' ? t('image_title') : t(`${p.key}_title`) }));
  }

  async load() {
    const count = itemCount();
    const interval = slideInterval();

    const plan = this.buildPlan();
    const visible = plan;

    if (!visible.length) {
      this.finish([], interval);
      return;
    }

    /*
     * 任一区块是图片模式，就要多取一些——服务端无法按「有无图片」过滤，
     * 只取 count 条经常会一条图都筛不出来。
     */
    const needWide = visible.some((p) => p.mode === 'image');
    const scanLimit = needWide ? Math.min(MAX_SCAN, Math.max(count * 5, 20)) : count;
    const base = { page: { limit: scanLimit, offset: 0 }, include: 'user,firstPost' };

    const tasks = {};

    // 最新列表同时用于「推荐」区块的兜底
    if (visible.some((p) => p.key === 'latest' || p.key === 'recommended')) {
      tasks.latest = app.store.find('discussions', { ...base, sort: '-lastPostedAt' });
    }

    if (visible.some((p) => p.key === 'popular')) {
      // 近 7 天浏览量，而非全站累计
      tasks.popular = app.store.find('discussions', { ...base, sort: '-viewCountRecent' });
    }

    // 手动指定的推荐讨论（按后台填写的顺序）
    const featured = featuredIds();
    if (visible.some((p) => p.key === 'recommended') && featured.length) {
      tasks.featured = Promise.all(
        featured.map((id) =>
          // 单条取详情；某条被删或无权访问时跳过，不影响其他条
          app.store.find('discussions', String(id)).catch(() => null)
        )
      ).then((list) => list.filter(Boolean));
    }

    // sticky 过滤器由 flarum/sticky 提供，未启用时请求会被拒绝
    const stickyAvailable = typeof flarum !== 'undefined' && flarum.extensions && 'flarum-sticky' in flarum.extensions;
    if (visible.some((p) => p.key === 'recommended') && stickyAvailable) {
      tasks.sticky = app.store.find('discussions', {
        ...base,
        filter: { sticky: true },
        sort: '-lastPostedAt',
      });
    }

    const result = {};
    await Promise.all(
      Object.keys(tasks).map((key) =>
        tasks[key]
          .then((models) => {
            result[key] = models || [];
          })
          .catch((e) => {
            console.warn(`[xiaogan80-hot-board] failed to load "${key}":`, e);
            result[key] = [];
          })
      )
    );

    const latest = result.latest || [];
    const popular = result.popular || [];

    // 按区块自己的模式准备数据
    const prepare = (list, mode) => {
      const usable = mode === 'image' ? list.filter((d) => discussionImage(d)) : list;
      return usable.slice(0, count);
    };

    const sourceFor = (p) => {
      switch (p.key) {
        case 'recommended':
          /*
           * 推荐来源优先级：手动指定 > 置顶 > 最新。
           * 手动指定的排在最前且保持后台填写的顺序，
           * 数量不够时再用置顶和最新补齐，保证这一列不会空着。
           */
          return this.mergeUnique(this.mergeUnique(result.featured || [], result.sticky || []), latest);
        case 'latest':
          return latest;
        case 'popular':
          return popular;
        default:
          return [];
      }
    };

    const metaFor = { recommended: 'replies', latest: 'time', popular: 'views' };

    const sections = [];

    visible.forEach((p) => {
      const items = prepare(sourceFor(p), p.mode);
      if (!items.length) return;

      sections.push({
        key: p.key,
        icon: p.icon,
        mode: p.mode,
        // 图片模式下标题统一变成「图片帖子」
        title: p.title,
        items,
        meta: metaFor[p.key],
      });
    });

    this.finish(sections, interval);
  }

  /**
   * 面板修饰类。
   *  - stacked：条数 5–6，行高宽裕，标题下方显示「作者 发布于 时间」
   *  - dense  ：条数 7–10，行高被压缩，只显示单行
   */
  modifiedClasses() {
    return this.count >= DENSE_FROM ? 'HotBoard--dense' : 'HotBoard--stacked';
  }
  finish(sections, interval) {
    const count = itemCount();

    // 后台静默刷新回来时数据可能没变，这时不必重绘，避免闪一下
    const unchanged = this.sections.length > 0 && sameSections(this.sections, sections);

    this.loading = false;
    this.interval = interval;
    this.count = count;

    if (!unchanged) {
      this.sections = sections;
      m.redraw();
    }

    // 写回缓存，供下次返回首页时直接渲染
    boardCache = {
      at: Date.now(),
      signature: this.signature || configSignature(),
      sections: unchanged ? this.sections : sections,
      interval,
      count,
    };
  }

  /** 按 id 去重合并，保持 primary 在前 */
  mergeUnique(primary, secondary) {
    const seen = new Set();
    const out = [];

    [...primary, ...secondary].forEach((discussion) => {
      const id = discussion.id();
      if (seen.has(id)) return;
      seen.add(id);
      out.push(discussion);
    });

    return out;
  }

  /**
   * 骨架屏：结构与真实看板完全一致（同样的容器类、同样的行数），
   * 所以高度分毫不差 —— 数据回来时不会出现「加载完成后的跳动」。
   */
  skeleton() {
    const count = itemCount();
    const dense = count >= DENSE_FROM;
    const plan = this.buildPlan();

    if (!plan.length) return null;

    return (
      <div
        className={`HotBoard HotBoard--skeleton${dense ? ' HotBoard--dense' : ''}`}
        aria-busy="true"
      >
        {plan.map((p) =>
          p.mode === 'image' ? (
            <section key={p.key} className="HotBoard-column HotBoard-column--cover">
              <h3 className="HotBoard-heading">
                <i className={`HotBoard-headingIcon ${p.icon}`} aria-hidden="true" />
                <span className="HotBoard-headingText">{p.title}</span>
              </h3>
              <div className="HotBoard-skelCover" />
            </section>
          ) : (
            <section key={p.key} className="HotBoard-column">
              <h3 className="HotBoard-heading">
                <i className={`HotBoard-headingIcon ${p.icon}`} aria-hidden="true" />
                <span className="HotBoard-headingText">{p.title}</span>
              </h3>
              <ul className="HotBoard-list">
                {Array.from({ length: count }).map((_, i) => (
                  <li key={i} className="HotBoard-item">
                    <span className="HotBoard-skelThumb" />
                    <span className="HotBoard-content">
                      <span className="HotBoard-skelLine HotBoard-skelTitle" />
                    </span>
                    <span className="HotBoard-skelLine HotBoard-skelMeta" />
                  </li>
                ))}
              </ul>
            </section>
          )
        )}
      </div>
    );
  }

  view() {
    // 访客自己关掉后就整块不渲染；管理员关闭「允许关闭」时要重新显示
    if (this.dismissed && allowDismiss()) {
      return null;
    }

    if (this.loading) {
      return this.skeleton();
    }

    if (!this.sections.length) {
      return null;
    }

    return (
      <div className={`HotBoard ${this.modifiedClasses()}`}>
        {allowDismiss() && (
          <button
            type="button"
            className="HotBoard-dismiss"
            title={t('dismiss')}
            aria-label={t('dismiss')}
            onclick={() => this.dismiss()}
          >
            <i className="fas fa-times" aria-hidden="true" />
          </button>
        )}

        {this.sections.map((section) =>
          section.mode === 'image' ? (
            <HotBoardCoverColumn key={section.key} {...section} interval={this.interval} />
          ) : (
            <HotBoardColumn key={section.key} {...section} stacked={this.count < DENSE_FROM} />
          )
        )}
      </div>
    );
  }

  /** 关闭看板：写本地存储 + 立即隐藏，无需刷新 */
  dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch (e) {
      // 存不了就只在本次会话隐藏
    }

    this.dismissed = true;
    m.redraw();
  }
}
