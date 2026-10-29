import { extend } from 'flarum/common/extend';
import PageStructure from 'flarum/forum/components/PageStructure';

import HotBoard from './components/HotBoard';

/**
 * 这里必须导出 extend —— Flarum 才会执行 extend.js 里的
 * Model 扩展（注册 viewCount 属性）。少了这行 viewCount 读不到。
 */
export { default as extend } from './extend';

app.initializers.add('xiaogan80-hot-board', () => {
  /*
   * 注入点：PageStructure.mainItems()
   *
   * 为什么不是 IndexPage.contentItems()：
   * IndexPage 的内容被塞进 PageStructure 的 Page-content 里，
   * 而 Page-content 是 Page-container 的右半边（左边是 Page-sidebar）。
   * 所以从 contentItems() 注入，看板只会占右半宽，左侧标签栏在它旁边。
   *
   * PageStructure 的层级（framework/core/js/src/forum/components/PageStructure.tsx）：
   *
   *   .Page
   *   └── .Page-main
   *       ├── skipToMainContent
   *       ├── .Page-hero            priorities 100
   *       └── .Page-container.container
   *           ├── .Page-sidebar     priorities 100
   *           └── .Page-content     priorities 10
   *
   * mainItems() 里 hero 是 100、container 是 10，用 50 落在二者之间，
   * 即「hero 之下、侧边栏+内容行之上」。再自己套一层 .container，
   * 宽度就和下面的 Page-container 对齐（= 左侧标签 + 右侧内容的总宽）。
   */
  extend(PageStructure.prototype, 'mainItems', function (items) {
    // 只在实际用到 IndexPage 的页面渲染（讨论列表页 / 标签筛选页）
    const className = String(this.attrs.className || '');
    if (!className.split(/\s+/).includes('IndexPage')) {
      return;
    }

    items.add(
      'hotBoard',
      <div className="container HotBoard-wrap">
        <HotBoard />
      </div>,
      50
    );
  });
});
