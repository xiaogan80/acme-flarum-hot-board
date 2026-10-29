import app from 'flarum/admin/app';

/** 必须重新导出 extend，否则 extend.js 里的设置声明不会执行 */
export { default as extend } from './extend';

app.initializers.add('yingweigan-hot-board', () => {
  // 设置全部在 extend.js 里声明式注册，这里没有命令式逻辑
});
