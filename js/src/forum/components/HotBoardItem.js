import Component from 'flarum/common/Component';
import app from 'flarum/forum/app';
import Link from 'flarum/common/components/Link';
import Avatar from 'flarum/common/components/Avatar';
import humanTime from 'flarum/common/helpers/humanTime';

import { discussionImage } from '../../common/thumbnail';
import { viewsOf } from '../../common/metrics';

/**
 * 看板中的一条。
 *
 * 左侧圆位优先填「帖子内容里的第一张图」，
 * 没有图时退回 Flarum 原生 Avatar 组件（有头像用头像，无头像自动渲染
 * 首字母 + 用户组颜色），所以永远不会有空白圆圈。
 */
export default class HotBoardItem extends Component {
  view() {
    const discussion = this.attrs.discussion;
    const href = app.route.discussion(discussion);
    const image = this.findImage();
    const user = this.author();

    return (
      <li className="HotBoard-item">
        <Link className="HotBoard-thumb" href={href} tabindex="-1" aria-hidden="true">
          {image ? (
            <img className="HotBoard-thumbImage" src={image} alt="" loading="lazy" />
          ) : user ? (
            <Avatar user={user} className="HotBoard-thumbAvatar" />
          ) : (
            <span className="HotBoard-thumbFallback">
              <i className="fas fa-comments" aria-hidden="true" />
            </span>
          )}
        </Link>

        <div className="HotBoard-content">
          <Link className="HotBoard-link" href={href}>
            {discussion.title()}
          </Link>

          {/*
           * 「作者 发布于 时间」这一行只在宽裕模式（条数 5–6）显示，
           * 由 .HotBoard--stacked 控制显示；条数 7–10 时行高不够，CSS 隐藏。
           * 文案复用 Flarum 核心的讨论列表用词，保持全站一致。
           */}
          <div className="HotBoard-sub">{this.subContent()}</div>
        </div>

        {/*
         * 堆叠模式下副标题已经写了发布时间，右侧再显示一次就重复了。
         * 回复数 / 浏览量是额外信息，照常显示。
         */}
        {!(this.attrs.stacked && this.attrs.meta === 'time') && (
          <div className="HotBoard-meta">{this.metaContent()}</div>
        )}
      </li>
    );
  }

  /**
   * 副标题：作者 + 发布时间。
   *
   * 两个坑：
   *  1. humanTime() 返回的是 <time> 的 vnode，拼进字符串会变成 "[object Object]"
   *  2. Flarum 的 trans() 一旦发现参数里有 `user`，就会拿它调 displayName()
   *     自动生成 username —— 所以这里必须传**用户模型**，不能传姓名字符串，
   *     否则报 "t.displayName is not a function"。文案里用 {username}。
   */
  subContent() {
    const discussion = this.attrs.discussion;
    const user = this.author();
    const ago = humanTime(discussion.lastPostedAt());

    if (!user) return ago;

    return app.translator.trans('xiaogan80-hot-board.forum.sub_author_time', { user, ago });
  }

  /** 首帖 HTML 里的第一张图 */
  findImage() {
    return discussionImage(this.attrs.discussion);
  }

  author() {
    const discussion = this.attrs.discussion;
    return typeof discussion.user === 'function' ? discussion.user() : null;
  }

  metaContent() {
    const discussion = this.attrs.discussion;

    switch (this.attrs.meta) {
      case 'replies':
        return [
          <i className="far fa-comment" aria-hidden="true" />,
          <span className="HotBoard-metaValue">{Number(discussion.commentCount() || 0)}</span>,
        ];

      case 'time':
        return humanTime(discussion.lastPostedAt());

      case 'views':
        // 「热门浏览」用近 7 天计数，和排序依据保持一致
        return [
          <i className="far fa-eye" aria-hidden="true" />,
          <span className="HotBoard-metaValue">{viewsOf(discussion)}</span>,
        ];

      default:
        return null;
    }
  }
}
