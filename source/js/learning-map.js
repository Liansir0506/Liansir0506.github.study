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
     3. 分类页改造（叶子分类：系列/模块 两级）
     ============================================================ */
  function shortLabel(title) {
    var s = title.split(/[:：|(（——,，]/)[0].trim();
    if (s.length > 9) { s = s.slice(0, 9) + '…'; }
    return s;
  }

  function initCategory(seriesName, moduleName) {
    var catBox = $('#category');
    var sort = catBox && $('.article-sort', catBox);
    if (!sort) { return; }

    var items = $$('.article-sort-item.no-article-cover', sort);
    if (!items.length) { return; }

    /* 收集文章（此时已按学习顺序正序排列） */
    var posts = items.map(function (item) {
      var a = $('.article-sort-item-title', item);
      return {
        title: a ? a.textContent.trim() : '',
        href: a ? a.getAttribute('href') : '#',
        node: item
      };
    });

    /* 提示条 */
    var note = el('p', 'lm-cat-note');
    note.innerHTML = '<b>' + moduleName + '</b> · 共 ' + posts.length + ' 篇 · 按学习顺序排列，建议从第 1 篇开始读';
    sort.parentNode.insertBefore(note, sort);

    /* 学习路线图 */
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

    /* 序号徽章 */
    posts.forEach(function (p, i) {
      var ord = el('span', 'lm-ord', String(i + 1).padStart(2, '0') + '<i>/ ' + posts.length + '</i>');
      p.node.insertBefore(ord, p.node.firstChild);
    });
  }

  /* ============================================================
     启动
     ============================================================ */
  if (isPostPage) {
    markVisited(pathname);
  } else if (isHome) {
    initHome();
  } else if (leafCatMatch) {
    try {
      initCategory(decodeURIComponent(leafCatMatch[1]), decodeURIComponent(leafCatMatch[2]));
    } catch (e) { /* 解码失败时静默跳过 */ }
  }
})();
