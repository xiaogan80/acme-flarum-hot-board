/**
 * 从帖子 HTML 里提取第一张图片的地址，作为讨论缩略图。
 *
 * 为什么在前端做而不是后端加字段：
 * 列表接口只要带 include=firstPost 就能拿到 contentHtml，
 * 不必为所有讨论列表增加一次 N+1 查询，影响面更小。
 */

// 匹配 <img ... src="...">，容忍属性顺序、单双引号、换行
const IMG_RE = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)')/i;

export default function thumbnailFromContent(html) {
  if (!html || typeof html !== 'string') return null;

  const m = IMG_RE.exec(html);
  if (!m) return null;

  let src = (m[1] || m[2] || '').trim();
  if (!src) return null;

  // data URI 太大，不适合当缩略图
  if (/^data:/i.test(src)) return null;

  // 协议相对地址补全，避免 file:// 之类场景下空图
  if (src.startsWith('//')) src = 'https:' + src;

  return src;
}

/**
 * 取某个讨论首帖的第一张图；没有就返回 null。
 * 「只显示带图片的帖子」模式靠它做筛选。
 */
export function discussionImage(discussion) {
  if (!discussion) return null;

  const firstPost = typeof discussion.firstPost === 'function' ? discussion.firstPost() : null;
  if (!firstPost || typeof firstPost.contentHtml !== 'function') return null;

  return thumbnailFromContent(firstPost.contentHtml());
}
