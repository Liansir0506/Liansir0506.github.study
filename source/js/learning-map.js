/* ============================================================
   学习地图（learning-map）交互脚本
   功能：
   1. 首页：首屏数据条 + 入口按钮、四大系列学习路径、
      右下角悬浮大纲（scroll-spy）、入场动画、卡片 3D 微倾
   2. 分类页：学习路线图、序号徽章、阅读进度记忆（localStorage）
   3. 全站：顶部阅读进度条
   依赖：/css/learning-map.css
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 站点根路径（GitHub Pages 项目站） ---------- */
  var ROOT = '/Liansir0506.github.study';
  var STORE_KEY = 'lm-visited-posts';

  /* ---------- 模块结构数据 ----------
     ★ 新增模块时只需在这里加一项（name/count/heat/desc/cat）---------- */
  var SERIES = [
    {
      id: 'basic',
      name: '基础篇',
      tagline: '把地基建牢',
      modules: [
        { name: '机器学习', count: 7, heat: 3, desc: '三大模型 + 评估指标，算法岗的公共语言', cat: ['基础篇', '机器学习'] },
        { name: '深度学习', count: 8, heat: 2, desc: '自动微分、训练全流程、CNN 与词嵌入', cat: ['基础篇', '深度学习'] },
        { name: 'NLP 基础', count: 6, heat: 2, desc: '分词、词向量与 BERT 迁移学习', cat: ['基础篇', 'NLP 基础'] }
      ]
    },
    {
      id: 'apply',
      name: '应用篇',
      tagline: '把能力用出来',
      modules: [
        { name: '提示词工程', count: 6, heat: 3, desc: 'Few-shot、CoT、Function Calling 与 ReAct', cat: ['应用篇', '提示词工程'] },
        { name: 'Coze 智能体', count: 6, heat: 2, desc: '工作流、知识库、Multi-Agent 与项目实战', cat: ['应用篇', 'Coze 智能体'] },
        { name: 'Dify 平台', count: 4, heat: 2, desc: '检索三件套、对话流与法律助手实战', cat: ['应用篇', 'Dify 应用平台'] }
      ]
    },
    {
      id: 'eng',
      name: '工程篇',
      tagline: '把服务做出来',
      modules: [
        { name: 'AI 工程化', count: 10, heat: 3, desc: 'FastAPI、RAG 管线、Docker、vLLM 与 CI/CD', cat: ['工程篇', 'AI 工程化'] }
      ]
    },
    {
      id: 'proj',
      name: '项目篇',
      tagline: '把经验攒下来',
      modules: [
        { name: 'RAG 问答系统', count: 15, heat: 3, desc: '企业级 RAG 全链路：混合检索、编排、治理与评测', cat: ['项目篇', 'RAG 问答系统'] },
        { name: '投满分 NLP', count: 6, heat: 2, desc: '四方案对比、BERT 微调、压缩与面试八步法', cat: ['项目篇', '投满分 NLP 项目'] },
        { name: '智慧旅游 Agent', count: 9, heat: 3, desc: 'MCP、A2A、五层记忆与 Docker 部署', cat: ['项目篇', '智慧旅游 Agent'] }
      ]
    }
  ];

  /* ---------- 工具函数 ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function el(tag, cls, html) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  function catUrl(cat) {
    return ROOT + '/categories/' + cat.map(encodeURIComponent).join('/') + '/';
  }

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  /* ---------- 阅读进度记忆 ---------- */
  function readVisited() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch (e) { return []; }
  }
  function markVisited(path) {
    var list = readVisited();
    if (list.indexOf(path) === -1) {
      list.push(path);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(list)); } catch (e) { /* 忽略存储失败 */ }
    }
  }

  /* ---------- 页面类型判断 ---------- */
  var pathname = location.pathname.replace(/index\.html$/, '').replace(/\/+$/, '') || '/';
  var isHome = new RegExp('^' + ROOT + '(/page/\\d+)?$').test(pathname);
  var leafCatMatch = pathname.match(new RegExp('^' + ROOT + '/categories/([^/]+)/([^/]+)$'));
  var seriesCatMatch = pathname.match(new RegExp('^' + ROOT + '/categories/([^/]+)$'));
  var tagMatch = pathname.match(new RegExp('^' + ROOT + '/tags/([^/]+)$'));
  var isArchive = new RegExp('^' + ROOT + '/archives$').test(pathname);
  var isCategoriesIndex = new RegExp('^' + ROOT + '/categories$').test(pathname);
  var isPostPage = !!$('#article-container');

  /* ============================================================
     1. 顶部阅读进度条（全站）
     ============================================================ */
  (function initProgress() {
    var bar = el('div');
    bar.id = 'lm-progress';
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  })();

  /* ============================================================
     2. 首页改造
     ============================================================ */
  function buildMapSection() {
    var wrap = el('section', 'lm-map-wrap');
    wrap.id = 'lm-map';

    var head = el('div', 'lm-map-head');
    head.appendChild(el('h2', 'lm-map-title', '学习地图'));
    head.appendChild(el('p', 'lm-map-sub', '四个系列，一条路径 —— 点模块卡片进入对应分类'));
    wrap.appendChild(head);

    SERIES.forEach(function (series, si) {
      var count = series.modules.reduce(function (sum, m) { return sum + m.count; }, 0);
      var block = el('section', 'lm-series');
      block.setAttribute('data-series', series.id);

      var shead = el('div', 'lm-series-head');
      shead.appendChild(el('div', 'lm-node', String(si + 1).padStart(2, '0')));
      var info = el('div', 'lm-series-info');
      info.appendChild(el('div', 'lm-series-name',
        series.name + '<span class="lm-series-count">' + count + ' 篇</span>'));
      info.appendChild(el('div', 'lm-series-tagline', series.tagline));
      shead.appendChild(info);
      shead.appendChild(el('div', 'lm-series-badge', '正在浏览'));
      block.appendChild(shead);

      var grid = el('div', 'lm-module-grid');
      series.modules.forEach(function (m, mi) {
        var card = el('a', 'lm-card');
        card.href = catUrl(m.cat);
        card.style.setProperty('--i', mi);
        var heat = '';
        for (var i = 0; i < 3; i++) {
          heat += '<i class="' + (i < m.heat ? 'on' : '') + '"></i>';
        }
        card.innerHTML =
          '<div class="lm-card-top"><span class="lm-card-name">' + m.name + '</span>' +
          '<span class="lm-card-count">' + m.count + ' 篇</span></div>' +
          '<div class="lm-heat" title="岗位相关度">' + heat + '</div>' +
          '<p class="lm-card-desc">' + m.desc + '</p>' +
          '<div class="lm-card-go">进入分类 →</div>';
        grid.appendChild(card);
      });
      block.appendChild(grid);
      wrap.appendChild(block);
    });

    return wrap;
  }

  function buildFab() {
    var fab = el('button', '');
    fab.id = 'lm-fab';
    fab.setAttribute('aria-label', '学习大纲');
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>';

    var panel = el('div', '');
    panel.id = 'lm-panel';
    var head = el('div', 'lm-panel-head');
    head.appendChild(el('span', 'lm-panel-title', '学习大纲'));
    var close = el('button', 'lm-panel-close', '×');
    close.setAttribute('aria-label', '收起');
    head.appendChild(close);
    panel.appendChild(head);

    SERIES.forEach(function (series, si) {
      var row = el('button', 'lm-p-row');
      row.setAttribute('data-target', series.id);
      row.appendChild(el('span', 'lm-p-bar'));
      row.appendChild(el('span', 'lm-p-name', series.name));
      var count = series.modules.reduce(function (sum, m) { return sum + m.count; }, 0);
      row.appendChild(el('span', 'lm-p-count', count + ' 篇'));
      panel.appendChild(row);

      var mods = el('div', 'lm-p-modules');
      series.modules.forEach(function (m) {
        var chip = el('a', 'lm-p-chip', m.name);
        chip.href = catUrl(m.cat);
        mods.appendChild(chip);
      });
      panel.appendChild(mods);
    });

    var foot = el('div', 'lm-panel-foot', '点系列跳到对应区块 · 点模块进分类页');
    panel.appendChild(foot);

    function toggle() {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) { syncSpy(true); }
    }
    fab.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle();
    });
    close.addEventListener('click', function (e) {
      e.stopPropagation();
      panel.classList.remove('open');
    });
    document.addEventListener('click', function (e) {
      if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== fab) {
        panel.classList.remove('open');
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { panel.classList.remove('open'); }
    });

    /* 点系列行 → 平滑滚动到对应区块 */
    $$('.lm-p-row', panel).forEach(function (row) {
      row.addEventListener('click', function () {
        var target = $('.lm-series[data-series="' + row.getAttribute('data-target') + '"]');
        if (target) {
          target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        }
      });
    });

    document.body.appendChild(panel);
    document.body.appendChild(fab);
    return { fab: fab, panel: panel };
  }

  /* scroll-spy：高亮当前视口内的系列 */
  function initSpy(panel) {
    var blocks = $$('.lm-series');
    var rows = $$('.lm-p-row', panel);
    var ticking = false;

    function sync() {
      var mid = window.innerHeight * 0.42;
      var current = null;
      blocks.forEach(function (b) {
        var r = b.getBoundingClientRect();
        if (r.top <= mid && r.bottom >= mid) { current = b; }
      });
      if (!current && blocks.length) {
        /* 未落在任何区块内时，取视线最近的 */
        var best = null;
        var bestDist = Infinity;
        blocks.forEach(function (b) {
          var d = Math.abs(b.getBoundingClientRect().top - mid);
          if (d < bestDist) { bestDist = d; best = b; }
        });
        current = best;
      }
      blocks.forEach(function (b) { b.classList.toggle('active', b === current); });
      rows.forEach(function (r) {
        r.classList.toggle('active', r.getAttribute('data-target') === current.getAttribute('data-series'));
      });
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(sync); }
    }, { passive: true });
    sync();
    return sync;
  }

  /* 入场动画 */
  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      $$('.lm-series').forEach(function (s) { s.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    $$('.lm-series').forEach(function (s) { io.observe(s); });
  }

  /* 卡片 3D 微倾 */
  function initTilt() {
    if (reduceMotion || coarsePointer) { return; }
    $$('.lm-card').forEach(function (card) {
      card.addEventListener('mousemove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5;
        var y = (e.clientY - r.top) / r.height - 0.5;
        card.style.transform = 'translateY(-3px) rotateX(' + (-y * 6).toFixed(2) + 'deg) rotateY(' + (x * 6).toFixed(2) + 'deg)';
      });
      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });
    });
  }

  function initHome() {
    document.documentElement.classList.add('lm-home');

    /* 学习路径（注入到 main 之前，全宽） */
    var main = $('#content-inner');
    if (main) { main.parentNode.insertBefore(buildMapSection(), main); }

    /* 最新更新：包进定宽容器、裁剪为 5 条、去掉分页 */
    var rp = $('#recent-posts');
    if (rp) {
      var wrap = el('div', 'lm-latest-wrap');

      var head = el('div', 'lm-latest-head');
      head.appendChild(el('span', 'lm-latest-title', '最新更新'));
      var more = el('a', 'lm-latest-more', '查看全部 →');
      more.href = ROOT + '/archives/';
      head.appendChild(more);
      wrap.appendChild(head);

      rp.parentNode.insertBefore(wrap, rp);
      wrap.appendChild(rp);
      rp.classList.add('lm-latest');

      var items = $$('.recent-post-item', rp);
      items.forEach(function (item, i) {
        if (i >= 5) { item.remove(); }
      });
      var pag = $('.pagination', rp);
      if (pag) { pag.remove(); }
    }

    var fabRefs = buildFab();
    initSpy(fabRefs.panel);
    initReveal();
    initTilt();
  }

  /* ============================================================
     3. 列表页改造（分类 / 标签 / 归档）
     —— 隐藏右侧挂件栏、内容区居中、顶部加标题块与序号徽章
     ============================================================ */
  function shortLabel(title) {
    var s = title.split(/[:：|(（——,，]/)[0].trim();
    if (s.length > 9) { s = s.slice(0, 9) + '…'; }
    return s;
  }

  function initListPage(cfg) {
    document.documentElement.classList.add('lm-list');

    var box = $(cfg.container);
    if (!box) { return; }
    var sort = $('.article-sort', box);
    if (!sort) { return; }

    var items = $$('.article-sort-item.no-article-cover', sort);
    if (!items.length) { return; }

    /* 收集文章（分类页已按学习顺序正序排列） */
    var posts = items.map(function (item) {
      var a = $('.article-sort-item-title', item);
      return {
        title: a ? a.textContent.trim() : '',
        href: a ? a.getAttribute('href') : '#',
        node: item
      };
    });

    /* 标题块 */
    /* 总篇数优先取主题标题里的数字（如「全部文章 - 78」），否则用当前页数量 */
    var themeTitle = $('.article-sort-title', box);
    var numMatch = themeTitle && themeTitle.textContent.match(/(\d+)/);
    var total = numMatch ? parseInt(numMatch[1], 10) : posts.length;

    var head = el('div', 'lm-page-head');
    if (cfg.kicker) {
      head.appendChild(el('div', 'lm-page-kicker', cfg.kicker));
    }
    head.appendChild(el('h1', 'lm-page-title', cfg.title));
    head.appendChild(el('p', 'lm-page-sub', cfg.sub + ' · 共 ' + total + ' 篇'));
    box.insertBefore(head, box.firstChild);

    /* 提示条 */
    var note = el('p', 'lm-cat-note');
    note.innerHTML = cfg.note || ('<b>' + cfg.title + '</b> · 按学习顺序排列，建议从第 1 篇开始读');
    sort.parentNode.insertBefore(note, sort);

    /* 学习路线图（仅分类叶子页需要） */
    if (cfg.roadmap) {
      var visited = readVisited();
      var roadmap = el('div', 'lm-roadmap');
      var rhead = el('div', 'lm-roadmap-head');
      rhead.appendChild(el('span', 'lm-roadmap-title', '学习路线'));
      var readCount = posts.filter(function (p) { return visited.indexOf(p.href) !== -1; }).length;
      rhead.appendChild(el('span', 'lm-roadmap-progress', '已读 ' + readCount + ' / ' + posts.length));
      roadmap.appendChild(rhead);

      var steps = el('div', 'lm-roadmap-steps');
      posts.forEach(function (p, i) {
        var step = el('button', 'lm-roadmap-step' + (i === 0 ? ' first' : '') + (visited.indexOf(p.href) !== -1 ? ' read' : ''));
        step.setAttribute('data-idx', i);
        step.title = p.title;
        step.appendChild(el('span', 'lm-rm-dot', String(i + 1)));
        step.appendChild(el('span', 'lm-rm-label', shortLabel(p.title)));
        step.addEventListener('click', function () {
          p.node.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
          p.node.classList.remove('lm-flash');
          void p.node.offsetWidth; /* 重启动画 */
          p.node.classList.add('lm-flash');
        });
        steps.appendChild(step);
        if (i < posts.length - 1) {
          steps.appendChild(el('span', 'lm-rm-line'));
        }
      });
      roadmap.appendChild(steps);
      sort.parentNode.insertBefore(roadmap, sort);
    }

    /* 序号徽章 */
    posts.forEach(function (p, i) {
      var ord = el('span', 'lm-ord', String(i + 1).padStart(2, '0') + '<i>/ ' + total + '</i>');
      p.node.insertBefore(ord, p.node.firstChild);
    });
  }

  /* ============================================================
     4. 文章页：按分类学习顺序重写「上一篇 / 下一篇」
     （主题默认按全站时间顺序，会把下一篇显示成上一篇、还会串到站外文章）
     ============================================================ */
  function fillNavCard(a, post) {
    if (!a) { return; }
    a.href = ROOT + post.u;
    a.title = post.t;
    var t2 = $('.info-item-2', a);
    if (t2) { t2.textContent = post.t; }
    var ex = $$('.info-2 .info-item-1', a)[0];
    if (ex && post.e) { ex.textContent = post.e; }
  }

  function initPostNav() {
    var nav = $('#pagination');
    if (!nav) { return; }
    var cards = $$('.pagination-related', nav);
    if (!cards.length) { return; }

    /* 按卡片上的标签识别「上一篇 / 下一篇」：
       不用索引——首/末篇文章可能只有一张卡，且标签语义与时间顺序相反
       （主题的「上一篇」= 更新的文章，「下一篇」= 更早的文章） */
    var prevCard = null, nextCard = null;
    cards.forEach(function (c) {
      var labelEl = $('.info-item-1', c);
      var label = labelEl ? labelEl.textContent : '';
      if (label.indexOf('上一篇') !== -1) { prevCard = c; }
      else if (label.indexOf('下一篇') !== -1) { nextCard = c; }
    });
    if (!prevCard && !nextCard) { return; }

    /* 当前文章所属叶子分类（文章页元信息里的分类链接，取最后一个） */
    var catLinks = $$('.post-meta-categories');
    if (!catLinks.length) { catLinks = $$('.article-meta__categories'); }
    var leaf = catLinks.length ? catLinks[catLinks.length - 1].textContent.trim() : '';
    var currentPath = pathname.replace(ROOT, '');

    fetch(ROOT + '/js/learn-order.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var order = (leaf && data[leaf]) ? data[leaf] : [];

        if (!order.length) {
          /* 无分类的文章（如开张贴）：收起翻页卡，换成「回到学习地图」入口 */
          if (prevCard) { prevCard.style.display = 'none'; }
          if (nextCard) { nextCard.style.display = 'none'; }
          nav.style.display = 'none';
          var cta = el('div', 'lm-post-cta');
          cta.innerHTML =
            '<div class="lm-post-cta-label">这是博客的开篇，不属于任何学习模块</div>' +
            '<a class="lm-post-cta-link" href="' + ROOT + '/">回到学习地图，从第 1 篇开始读 →</a>';
          nav.parentNode.insertBefore(cta, nav);
          return;
        }

        var idx = -1;
        for (var i = 0; i < order.length; i++) {
          if (order[i].u === currentPath || order[i].u === currentPath + '/') { idx = i; break; }
        }
        if (idx === -1) { return; } /* 不在列表里，保持主题原样 */

        /* 学习顺序：上一篇 = 顺序中的前一篇（更早），下一篇 = 后一篇（更晚） */
        var prev = idx > 0 ? order[idx - 1] : null;
        var next = idx < order.length - 1 ? order[idx + 1] : null;

        if (prevCard) {
          if (prev) { fillNavCard(prevCard, prev); } else { prevCard.style.display = 'none'; }
        }
        if (nextCard) {
          if (next) { fillNavCard(nextCard, next); } else { nextCard.style.display = 'none'; }
        }

        /* 两张卡都收起时，整个翻页区一并隐藏 */
        var prevGone = !prevCard || prevCard.style.display === 'none';
        var nextGone = !nextCard || nextCard.style.display === 'none';
        if (prevGone && nextGone) { nav.style.display = 'none'; }
      })
      .catch(function () { /* JSON 加载失败时保持主题默认行为 */ });
  }

  /* ---------- 分类总览页：置顶「开篇」卡片 ---------- */
  function initCategoriesIndex() {
    var main = $('#content-inner');
    if (!main) { return; }
    var card = el('div', 'lm-intro-card');
    card.innerHTML =
      '<div class="lm-intro-kicker">开篇 · 置顶</div>' +
      '<a class="lm-intro-title" href="' + ROOT + '/2026/10/16/hello-my-learning-blog/">开张：从今天开始记录我的 AI 学习之路</a>' +
      '<p class="lm-intro-desc">为什么建这个博客、打算怎么写 —— 开始学习之前，先花两分钟了解这里的背景。</p>' +
      '<a class="lm-intro-go" href="' + ROOT + '/2026/10/16/hello-my-learning-blog/">读这篇 →</a>';
    main.insertBefore(card, main.firstChild);
  }

  /* ============================================================
     启动
     ============================================================ */
  if (isPostPage) {
    markVisited(pathname);
    initPostNav();
  } else if (isHome) {
    initHome();
  } else if (leafCatMatch) {
    /* 叶子分类页：系列/模块 两级 */
    try {
      var series = decodeURIComponent(leafCatMatch[1]);
      var moduleName = decodeURIComponent(leafCatMatch[2]);
      initListPage({
        container: '#category',
        kicker: series,
        title: moduleName,
        sub: '按学习顺序排列',
        note: '<b>' + moduleName + '</b> · 属于「' + series + '」，按学习顺序排列，建议从第 1 篇开始读',
        roadmap: true
      });
    } catch (e) { /* 解码失败时静默跳过 */ }
  } else if (seriesCatMatch) {
    /* 系列页：某一集合下的全部模块 */
    try {
      var seriesName = decodeURIComponent(seriesCatMatch[1]);
      initListPage({
        container: '#category',
        kicker: '系列',
        title: seriesName,
        sub: '该系列下的全部文章',
        note: '<b>' + seriesName + '</b> · 该系列的全部文章，按发布时间排列'
      });
    } catch (e) { /* ignore */ }
  } else if (tagMatch) {
    try {
      var tagName = decodeURIComponent(tagMatch[1]);
      initListPage({
        container: '#tag',
        kicker: '标签',
        title: tagName,
        sub: '所有带此标签的文章',
        note: '<b>#' + tagName + '</b> · 所有带此标签的文章，按发布时间排列'
      });
    } catch (e) { /* ignore */ }
  } else if (isArchive) {
    initListPage({
      container: '#archive',
      kicker: '时间线',
      title: '全部文章',
      sub: '按时间归档',
      note: '<b>全部文章</b> · 按发布时间倒序排列'
    });
  } else if (isCategoriesIndex) {
    /* 分类总览页：置顶开篇文章 */
    document.documentElement.classList.add('lm-list');
    initCategoriesIndex();
  }
})();
