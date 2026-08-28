/* ============================================================
   IFMSA · Khyber Medical College — Highlights page.
   Renders the year's highlights (assemblies members attended,
   exchanges, on-campus events and recognition) from the loaded
   site data (Supabase → falls back to projects-data.js), with:
   • hero stat counters
   • a featured spotlight card
   • category filters (away / campus / win)
   • a detail modal per moment
   ============================================================ */

(function () {
  'use strict';

  var CATS = [
    { key: 'all',   label: 'All moments' },
    { key: 'away',  label: 'We travelled' },
    { key: 'campus', label: 'On campus' },
    { key: 'win',   label: 'Recognised' }
  ];

  var CAT_COLOR = {
    away: '#1d4ed8',
    campus: '#0f9c15',
    win: '#d29922'
  };
  var CAT_LABEL = { away: 'We travelled', campus: 'On campus', win: 'Recognised' };

  var IMG_LINE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

  var pad = function (n) { return n < 10 ? '0' + n : String(n); };

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* split 'about' lines into prose paragraphs + gallery images */
  function splitBlocks(blocks) {
    var list = Array.isArray(blocks) ? blocks : (blocks ? [blocks] : []);
    var images = [];
    var paras = list.map(function (t) {
      var m = t && t.match ? t.match(IMG_LINE) : null;
      if (m) { images.push({ src: m[2], alt: m[1] || '' }); return ''; }
      return '<p>' + esc(t) + '</p>';
    }).filter(Boolean);
    return { paras: paras.join(''), images: images };
  }

  var coverHtml = function (src, alt) {
    return src
      ? '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" />'
      : '';
  };

  var state = {
    list: [],
    committees: {},
    filter: 'all'
  };

  var els = {
    total: document.getElementById('hl-stat-total'),
    away: document.getElementById('hl-stat-away'),
    campus: document.getElementById('hl-stat-campus'),
    win: document.getElementById('hl-stat-win'),
    spotlight: document.getElementById('hl-spotlight'),
    filters: document.getElementById('hl-filters'),
    grid: document.getElementById('hl-grid'),
    modalRoot: document.getElementById('hl-modal-root')
  };

  var committeeOf = function (slug) {
    return state.committees[slug] || {};
  };

  var catColor = function (h) {
    return CAT_COLOR[h.category] || CAT_COLOR.campus;
  };

  var badgeHtml = function (h) {
    var label = h.tag || CAT_LABEL[h.category] || 'Highlight';
    return '<span class="hl-card-badge"><span class="hl-card-cat-dot"></span>' + esc(label) + '</span>';
  };

  var metaHtml = function (h) {
    var bits = [];
    if (h.date) bits.push('<span>' + esc(h.date) + '</span>');
    if (h.date && h.location) bits.push('<i aria-hidden="true"></i>');
    if (h.location) bits.push('<span>' + esc(h.location) + '</span>');
    return '<div class="hl-card-meta">' + bits.join('') + '</div>';
  };

  var cardHtml = function (h) {
    var blocks = splitBlocks(h.about);
    var img = blocks.images[0] || {};
    var com = committeeOf(h.committee);
    var comAccent = com.accent || com.color || '';
    var comChip = h.committee && com.acronym
      ? '<span class="hl-card-committee"><i style="background:' + esc(comAccent) + '"></i>' + esc(com.acronym) + '</span>'
      : '<span class="hl-card-committee"><i style="background:' + esc(catColor(h)) + '"></i>' + esc(CAT_LABEL[h.category] || '') + '</span>';

    return (
      '<article class="hl-card" data-id="' + esc(h.id) + '" style="--hl-cat:' + esc(catColor(h)) + '">' +
        '<div class="hl-card-media">' +
          coverHtml(img.src, img.alt) +
          badgeHtml(h) +
        '</div>' +
        '<div class="hl-card-body">' +
          '<h3 class="hl-card-title">' + esc(h.title) + '</h3>' +
          metaHtml(h) +
          '<p class="hl-card-summary">' + esc(h.summary) + '</p>' +
          '<div class="hl-card-footer">' +
            comChip +
            '<span class="hl-card-open">Open story &#8594;</span>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  };

  var spotlightHtml = function (h) {
    var blocks = splitBlocks(h.about);
    var img = blocks.images[0] || {};
    var tag = h.tag || CAT_LABEL[h.category] || 'Highlight';
    var meta = [];
    if (h.date) meta.push(esc(h.date));
    if (h.location) meta.push(esc(h.location));
    var metaHtml = meta.map(function (m, i) {
      return (i ? '<i aria-hidden="true"></i>' : '') + '<span>' + m + '</span>';
    }).join('');

    return (
      '<article class="hl-spot-card" data-id="' + esc(h.id) + '" style="--hl-cat:' + esc(catColor(h)) + '">' +
        '<div class="hl-spot-media">' + coverHtml(img.src, img.alt) + '</div>' +
        '<div class="hl-spot-body">' +
          '<div class="hl-spot-kicker"><span class="hl-cat-badge"><i class="hl-card-cat-dot"></i>' + esc(tag) + '</span></div>' +
          '<h3 class="hl-spot-title">' + esc(h.title) + '</h3>' +
          '<div class="hl-spot-meta">' + metaHtml + '</div>' +
          '<p class="hl-spot-summary">' + esc(h.summary) + '</p>' +
          '<span class="hl-spot-more">Read the full story &#8594;</span>' +
        '</div>' +
      '</article>'
    );
  };

  /* ---------- modal ---------- */
  function openModal(h) {
    var blocks = splitBlocks(h.about);
    var hero = blocks.images[0] || {};
    var gallery = blocks.images.slice(1);
    var com = committeeOf(h.committee);
    var tag = h.tag || CAT_LABEL[h.category] || 'Highlight';

    var metaPills = [];
    if (h.date) metaPills.push('<span class="hl-meta-pill">' + esc(h.date) + '</span>');
    if (h.location) metaPills.push('<span class="hl-meta-pill">' + esc(h.location) + '</span>');
    metaPills.push('<span class="hl-meta-pill"><i style="background:' + esc(catColor(h)) + '"></i>' + esc(tag) + '</span>');
    if (com.acronym) metaPills.push('<span class="hl-meta-pill"><i style="background:' + esc(com.accent || com.color || '') + '"></i>' + esc(com.acronym) + '</span>');

    var galleryHtml = gallery.length
      ? '<div class="hl-modal-gallery" aria-label="Image gallery">' +
          gallery.map(function (g) {
            return '<figure class="hl-modal-g-img">' +
              '<img src="' + esc(g.src) + '" alt="' + esc(g.alt) + '" loading="lazy" decoding="async" />' +
              (g.alt ? '<figcaption>' + esc(g.alt) + '</figcaption>' : '') +
            '</figure>';
          }).join('') +
        '</div>'
      : '';

    els.modalRoot.innerHTML =
      '<div class="hl-modal-back">' +
        '<div class="hl-modal" role="dialog" aria-modal="true" aria-labelledby="hl-modal-title">' +
          '<button class="hl-modal-close" id="hl-modal-close" type="button" aria-label="Close">&#215;</button>' +
          '<div class="hl-modal-hero">' + coverHtml(hero.src, hero.alt) + '</div>' +
          '<div class="hl-modal-body">' +
            '<h2 class="hl-modal-title" id="hl-modal-title">' + esc(h.title) + '</h2>' +
            '<div class="hl-modal-meta">' + metaPills.join('') + '</div>' +
            '<div class="hl-modal-prose">' + blocks.paras + '</div>' +
            galleryHtml +
            '<div class="hl-modal-cta">' +
              '<a href="join.html" class="hl-btn hl-btn-white">Join the council</a>' +
              '<a href="index.html" class="hl-btn hl-btn-ghost-white">Back to home</a>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    els.modalRoot.hidden = false;
    document.body.style.overflow = 'hidden';

    var close = function () {
      els.modalRoot.hidden = true;
      els.modalRoot.innerHTML = '';
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey, true);
    };
    var onKey = function (e) {
      if (e.key === 'Escape') close();
    };
    document.getElementById('hl-modal-close').addEventListener('click', close);
    els.modalRoot.querySelector('.hl-modal-back').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) close();
    });
    document.addEventListener('keydown', onKey, true);
  }

  /* ---------- spotlight + grid ---------- */
  function renderSpotlight() {
    if (!els.spotlight) return;
    var feat = state.list;
    var chosen = feat[0] || null;
    if (chosen) els.spotlight.innerHTML = spotlightHtml(chosen);
  }

  function renderGrid() {
    if (!els.grid) return;
    var list = state.list;
    if (state.filter !== 'all') {
      list = list.filter(function (h) { return (h.category || 'campus') === state.filter; });
    }
    els.grid.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<div class="hl-grid-empty">No moments in this category yet &mdash; check back soon.</div>';

    els.grid.querySelectorAll('.hl-card').forEach(function (card, i) {
      card.style.animationDelay = Math.min(i * 0.06, 0.4) + 's';
      card.addEventListener('click', function () {
        var id = card.dataset.id;
        var h = state.list.find(function (x) { return x.id === id; });
        if (h) openModal(h);
      });
    });
  }

  /* ---------- filters ---------- */
  function renderFilters() {
    if (!els.filters) return;
    els.filters.innerHTML = CATS.map(function (c) {
      return '<button class="hl-filter' + (c.key === state.filter ? ' is-active' : '') +
        '" data-filter="' + c.key + '" type="button">' + esc(c.label) + '</button>';
    }).join('');
    els.filters.querySelectorAll('.hl-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filter = btn.dataset.filter;
        els.filters.querySelectorAll('.hl-filter').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderGrid();
      });
    });
  }

  /* ---------- hero counters (small count-up) ---------- */
  function countUp(el, target) {
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = pad(target);
      return;
    }
    var duration = 900;
    var start = null;
    var frame = function (now) {
      if (!start) start = now;
      var t = Math.min(1, (now - start) / duration);
      el.textContent = pad(Math.round(t * target));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  function renderStats() {
    var away = state.list.filter(function (h) { return h.category === 'away'; }).length;
    var campus = state.list.filter(function (h) { return h.category === 'campus'; }).length;
    var win = state.list.filter(function (h) { return h.category === 'win'; }).length;
    countUp(els.total, state.list.length);
    countUp(els.away, away);
    countUp(els.campus, campus);
    countUp(els.win, win);
  }

  /* ---------- init ---------- */
  window.loadSiteData().then(function (data) {
    window.applySiteSettings(data);
    state.committees = data.committees || {};
    var list = (data.highlightsList && data.highlightsList.length)
      ? data.highlightsList
      : [];
    state.list = list.slice();

    /* prefer a featured moment in the spotlight, otherwise the newest of each */
    var featured = list.find(function (h) { return h.featured; });
    if (featured && list.length > 1) {
      state.list = [featured].concat(list.filter(function (h) { return h !== featured; }));
    }

    renderStats();
    renderSpotlight();
    renderFilters();
    renderGrid();

    /* spotlight opens the same detail modal */
    var spot = document.querySelector('.hl-spot-card');
    if (spot) {
      spot.addEventListener('click', function () {
        var h = state.list.find(function (x) { return x.id === spot.dataset.id; });
        if (h) openModal(h);
      });
    }

    /* smooth anchor from the hero CTA */
    var cta = document.getElementById('hl-scroll-cta');
    if (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById('spotlight');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });
})();