import Extend from 'flarum/common/extenders';
import Discussion from 'flarum/common/models/Discussion';

/**
 * 把后端新增的计数注册到前端 Discussion 模型上。
 *
 * Flarum 的前端 Model 只暴露显式声明的属性：没有这些声明的话
 * discussion.viewCount() / viewCountRecent() 不存在，API 返回的值读不出来。
 *
 * viewCount   全站累计
 * viewCountRecent 近 7 天（「热门浏览」的排序依据）
 */
export default [
  new Extend.Model(Discussion).attribute('viewCount'),
  new Extend.Model(Discussion).attribute('viewCountRecent'),
];
