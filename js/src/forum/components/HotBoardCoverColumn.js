import Component from 'flarum/common/Component';
import app from 'flarum/forum/app';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
import humanTime from 'flarum/common/helpers/humanTime';

import { discussionImage } from '../../common/thumbnail';
import { viewsOf } from '../../common/metrics';

/**
 * 图片模式下的一个区块：图片轮播。
 *
 * 行为：
 *  - 图片占满整个区块（CSS 里留一定内边距），object-fit: cover
 *  - 图片下方是指示点，再下方是帖子标题与 meta
 *  - 按设定间隔自动切换，鼠标进入整个区块时暂停
 *  - 图片加载失败时回退到作者头像，不会留空白
 *  - 只有一条时不起定时器
 *
 * 标题由父组件传入（图片模式下统一是「图片帖子」）。
 */
export default class HotBoardCoverColumn extends Component {
  oninit(vnode) {
    super.oninit(vnode);

    this.index = 0;
    this.paused = false;
    this.timer = null;
    /** 记录加载失败过的讨论 id，避免反复请求坏图 */
    this.failed = new Set();

    this.startTimer();
  }

  onremove() {
    this.stopTimer();
  }

  startTimer() {
    this.stopTimer();

    const items = this.attrs.items || [];
    const seconds = Number(this.attrs.interval) || 5;

    if (items.length < 2) return;

    this.timer = setInterval(() => {
      if (this.paused) return;
      this.go(this.index + 1);
    }, seconds * 1000);
  }

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  go(next) {
    const items = this.attrs.items || [];
    if (!items.length) return;

    // 环形取模，兼容负数
    const n = ((next % items.length) + items.length) % items.length;
    if (n === this.index) return;

    this.index = n;
    m.redraw();
  }

  current() {
    const items = this.attrs.items || [];
    if (!items.length) return null;

    if (this.index >= items.length) this.index = 0;

    return items[this.index];
  }

  view() {
    const items = this.attrs.items || [];
    if (!items.length) return null;

    const discussion = this.current();
    const image = this.imageFor(discussion);
    const user = typeof discussion.user === 'function' ? discussion.user() : null;
    const href = app.route.discussion(discussion);

    return (
      <section
        className="HotBoard-column HotBoard-column--cover"
        onmouseenter={() => {
          this.paused = true;
        }}
        onmouseleave={() => {
          this.paused = false;
        }}
      >
        <h3 className="HotBoard-heading">
          <i className={`HotBoard-headingIcon ${this.attrs.icon}`} aria-hidden="true" />
          <span className="HotBoard-headingText">{this.attrs.title}</span>
        </h3>

        <div className="HotBoard-coverFrame">
          <Link className="HotBoard-coverLink" href={href} tabindex="-1">
            {/*
             * 这一层的子节点必须「全有 key」或「全无 key」。
             * img 用图片地址当 key，切换时才会重新挂载并重放淡入动画；
             * 因此同级的 span 也都要显式给 key，否则 Mithril 会抛
             * "In fragments, vnodes must either all have keys or none have keys"。
             */}
            {image ? (
              <img
                key={'img:' + image}
                className="HotBoard-coverImage"
                src={image}
                alt=""
                loading="lazy"
                onerror={() => {
                  this.failed.add(discussion.id());
                  m.redraw();
                }}
              />
            ) : user ? (
              <span key="avatar" className="HotBoard-coverFallback">
                <Avatar user={user} className="HotBoard-coverAvatar" />
              </span>
            ) : (
              <span key="empty" className="HotBoard-coverFallback">
                <i className="fas fa-image" aria-hidden="true" />
              </span>
            )}

            {/* 底部渐变蒙版：保证标题在任何图片上都清晰 */}
            <span key="scrim" className="HotBoard-coverScrim" aria-hidden="true" />

            <span key="caption" className="HotBoard-coverCaption">
              <span key="title" className="HotBoard-coverTitle">
                {discussion.title()}
              </span>
              <span key="meta" className="HotBoard-coverMeta">
                {this.metaContent(discussion)}
              </span>
            </span>
          </Link>

          {/* 指示点必须是 Link 的兄弟节点，不能把 button 嵌在 a 里 */}
          <div className="HotBoard-dots">
            {items.length > 1 &&
              items.map((item, i) => (
                <button
                  type="button"
                  className={'HotBoard-dot' + (i === this.index ? ' is-active' : '')}
                  aria-label={app.translator.trans('xiaogan80-hot-board.forum.slide_n', {
                    current: i + 1,
                    total: items.length,
                  })}
                  onclick={() => this.go(i)}
                />
              ))}
          </div>
        </div>
      </section>
    );
  }

  imageFor(discussion) {
    if (this.failed.has(discussion.id())) return null;
    return discussionImage(discussion);
  }

  metaContent(discussion) {
    switch (this.attrs.meta) {
      case 'replies':
        return [
          <i className="far fa-comment" aria-hidden="true" />,
          <span className="HotBoard-metaValue">{Number(discussion.commentCount() || 0)}</span>,
        ];

      case 'time':
        return humanTime(discussion.lastPostedAt());

      case 'views':
        return [
          <i className="far fa-eye" aria-hidden="true" />,
          <span className="HotBoard-metaValue">{viewsOf(discussion)}</span>,
        ];

      default:
        return null;
    }
  }
}
