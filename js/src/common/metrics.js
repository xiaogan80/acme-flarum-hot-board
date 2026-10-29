/**
 * 「热门浏览」的计数口径。
 *
 * 排序依据是近 7 天（后端 view_count_recent），所以显示也用同一个口径，
 * 否则会出现「数字大但排在后面」的错乱。
 *
 * viewCountRecent 不存在时（后端未迁移 / 降级）退回全站累计，保证不显示 0。
 */
export function viewsOf(discussion) {
  if (!discussion) return 0;

  const recent = typeof discussion.viewCountRecent === 'function' ? discussion.viewCountRecent() : null;

  if (recent !== null && recent !== undefined) {
    return Number(recent) || 0;
  }

  const total = typeof discussion.viewCount === 'function' ? discussion.viewCount() : 0;

  return Number(total) || 0;
}

export default viewsOf;
