import Component from 'flarum/common/Component';

import HotBoardItem from './HotBoardItem';

/**
 * 看板中的一列。列头沿用截图里的样式：图标 + 标题 + 下划线。
 */
export default class HotBoardColumn extends Component {
  view() {
    const { icon, title, items, meta, stacked } = this.attrs;

    return (
      <section className="HotBoard-column">
        <h3 className="HotBoard-heading">
          <i className={`HotBoard-headingIcon ${icon}`} aria-hidden="true" />
          <span className="HotBoard-headingText">{title}</span>
        </h3>

        <ul className="HotBoard-list">
          {items.map((discussion) => (
            <HotBoardItem key={discussion.id()} discussion={discussion} meta={meta} stacked={stacked} />
          ))}
        </ul>
      </section>
    );
  }
}
