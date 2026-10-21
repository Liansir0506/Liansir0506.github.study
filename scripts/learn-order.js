/* Hexo 生成器：产出「分类 → 学习顺序文章列表」JSON
   供文章页的上一篇/下一篇使用（按分类学习顺序，而非全站时间顺序）
   输出：public/js/learn-order.json
   结构：{ "机器学习": [{u, t, e}, ...], ... }  u=相对路径 t=标题 e=摘要 */
hexo.extend.generator.register('learn_order', function (locals) {
  var out = {};

  function toArray(q) {
    if (!q) { return []; }
    if (typeof q.toArray === 'function') { return q.toArray(); }
    return Array.prototype.slice.call(q);
  }

  function plain(text, len) {
    if (!text) { return ''; }
    return String(text)
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, len || 70);
  }

  locals.categories.forEach(function (cat) {
    var posts = toArray(cat.posts);
    if (!posts.length) { return; }
    /* 按发布时间正序（与分类页展示顺序一致） */
    posts.sort(function (a, b) { return a.date - b.date; });
    out[cat.name] = posts.map(function (p) {
      return {
        u: '/' + p.path,
        t: p.title,
        e: plain(p.excerpt, 70)
      };
    });
  });

  return {
    path: 'js/learn-order.json',
    data: JSON.stringify(out)
  };
});
