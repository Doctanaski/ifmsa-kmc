/* ============================================================
   IFMSA · Khyber Medical College — Alumni page ("Where they are now").
   Renders the council's alumni from the loaded site data
   (Supabase → falls back to projects-data.js), with:
   • hero stat counters
   • featured alumni spotlight cards
   • career-track filters + free-text search
   • a detail modal per alumni: their story, meta and links
   ============================================================ */

(function () {
  'use strict';

  var TRACKS = [
    { key: 'clinical',     label: 'Clinical',         color: '#1d4ed8' },
    { key: 'research',     label: 'Research',         color: '#6d28d9' },
    { key: 'publichealth', label: 'Public Health',    color: '#0f9c15' },
    { key: 'leadership',   label: 'Leadership',       color: '#d29922' },
    { key: 'beyond',       label: 'Beyond Medicine',  color: '#db2777' }
  ];
  var TRACK_BY_KEY = {};
  TRACKS.forEach(function (t) { TRACK_BY_KEY[t.key] = t; });

  var IMG_LINE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

  var pad = function (n) { return n < 10 ? '0' + n : String(n); };

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  var initials = function (name) {
    return String(name || '').split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase(); })
      .slice(0, 2).join('');
  };

  var trackKey = function (a) {
    return String(a.track || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };

  var trackOf = function (a) {
    return TRACK_BY_KEY[trackKey(a)] || TRACK_BY_KEY.clinical;
  };

  var splitBlocks = function (blocks) {
    var list = Array.isArray(blocks) ? blocks : (blocks ? [blocks] : []);
    var images = [];
    var paras = list.map(function (t) {
      var m = t && t.match ? t.match(IMG_LINE) : null;
      if (m) { images.push({ src: m[2], alt: m[1] || '' }); return ''; }
      return '<p>' + esc(t) + '</p>';
    }).filter(Boolean);
    return { paras: paras.join(''), images: images };
  };

  /* a story counts only when it has at least one text paragraph */
  var hasStory = function (a) {
    return splitBlocks(a.story).paras.length > 0;
  };

  /* focal point stored by the admin framing tool as #fp=x,y on the URL */
  var posAttr = function (url) {
    var m = String(url || '').match(/#fp=([\d.]+),([\d.]+)/);
    return m ? ' style="object-position:' + m[1] + '% ' + m[2] + '%"' : '';
  };

  var pinIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>';

  var state = {
    list: [],
    filter: 'all',
    search: ''
  };

  var els = {
    total: document.getElementById('al-stat-total'),
    countries: document.getElementById('al-stat-countries'),
    clinical: document.getElementById('al-stat-clinical'),
    cohorts: document.getElementById('al-stat-cohorts'),
    featured: document.getElementById('al-featured'),
    filters: document.getElementById('al-filters'),
    search: document.getElementById('al-search'),
    grid: document.getElementById('al-grid'),
    modalRoot: document.getElementById('al-modal-root')
  };

  var matchesSearch = function (a) {
    var q = state.search.toLowerCase();
    if (!q) return true;
    var hay = [a.name, a.role_now, a.location, a.specialty, a.cohort, a.committees]
      .join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  };

  var trackPill = function (a) {
    var t = trackOf(a);
    return '<span class="al-track-pill"><i class="al-card-dot"></i>' + esc(t.label) + '</span>';
  };

  var mediaHtml = function (a) {
    if (a.photo) return '<img src="' + esc(a.photo) + '" alt="Portrait of ' + esc(a.name) + '"' + posAttr(a.photo) + ' loading="lazy" decoding="async" />';
    return '<div class="al-card-avatar"><span>' + esc(initials(a.name)) + '</span></div>';
  };

  var locHtml = function (a) {
    return a.location
      ? '<span class="al-feat-loc">' + pinIcon + esc(a.location) + '</span>'
      : '';
  };

  /* ---------- featured ---------- */
  var featHtml = function (a) {
    var t = trackOf(a);
    return (
      '<article class="al-feat-card" data-name="' + esc(a.name) + '" style="--al-accent:' + esc(t.color) + '">' +
        '<div class="al-feat-media">' +
          (a.photo
            ? '<img src="' + esc(a.photo) + '" alt="Portrait of ' + esc(a.name) + '"' + posAttr(a.photo) + ' loading="lazy" decoding="async" />'
            : '<div class="al-feat-avatar"><span>' + esc(initials(a.name)) + '</span></div>') +
        '</div>' +
        '<div class="al-feat-body">' +
          '<div class="al-feat-kicker">' + trackPill(a) + (a.cohort ? '<span class="al-track-pill">' + esc(a.cohort) + '</span>' : '') + '</div>' +
          '<h3 class="al-feat-name">' + esc(a.name) + '</h3>' +
          '<p class="al-feat-role">' + esc(a.role_now) + '</p>' +
          locHtml(a) +
          (a.quote ? '<p class="al-feat-quote">' + esc(a.quote) + '</p>' : '') +
          (hasStory(a) ? '<span class="al-feat-more">Read their story &#8594;</span>' : '') +
        '</div>' +
      '</article>'
    );
  };

  /* ---------- grid card ---------- */
  var cardHtml = function (a) {
    var t = trackOf(a);
    var meta = [];
    if (a.cohort) meta.push('<span>' + esc(a.cohort) + '</span>');
    if (a.location) meta.push('<i></i><span>' + esc(a.location) + '</span>');

    return (
      '<article class="al-card" data-name="' + esc(a.name) + '" style="--al-accent:' + esc(t.color) + '">' +
        '<div class="al-card-media">' +
          mediaHtml(a) +
          trackPill(a) +
        '</div>' +
        '<div class="al-card-body">' +
          '<h3 class="al-card-name">' + esc(a.name) + '</h3>' +
          '<p class="al-card-role">' + esc(a.role_now) + '</p>' +
          (meta.length ? '<div class="al-card-meta">' + meta.join('') + '</div>' : '') +
          (a.quote ? '<p class="al-card-quote">' + esc(a.quote) + '</p>' : '') +
          '<div class="al-card-footer">' +
            (a.committees ? '<span class="al-card-committees">' + esc(a.committees) + '</span>' : '') +
            (hasStory(a) ? '<span class="al-card-open">Read story &#8594;</span>' : '') +
          '</div>' +
        '</div>' +
      '</article>'
    );
  };

  /* ---------- modal ---------- */
  function openModal(a) {
    var t = trackOf(a);
    var blocks = splitBlocks(a.story);

    var pills = [];
    pills.push('<span class="al-meta-pill al-meta-pill--track"><i></i>' + esc(t.label) + '</span>');
    if (a.cohort) pills.push('<span class="al-meta-pill">' + esc(a.cohort) + '</span>');
    if (a.location) pills.push('<span class="al-meta-pill">' + esc(a.location) + '</span>');
    if (a.specialty) pills.push('<span class="al-meta-pill">' + esc(a.specialty) + '</span>');
    if (a.committees) pills.push('<span class="al-meta-pill">' + esc(a.committees) + '</span>');

    var links = a.links || {};
    var linkBtns = [];
    if (links.linkedin) linkBtns.push(linkHtml('LinkedIn', 'https://www.linkedin.com/', links.linkedin));
    if (links.twitter) linkBtns.push(linkHtml('Twitter', 'https://twitter.com/', links.twitter));
    if (links.email) linkBtns.push(linkHtml('Email', 'mailto:', links.email));

    els.modalRoot.innerHTML =
      '<div class="al-modal-back">' +
        '<div class="al-modal" style="--al-accent:' + esc(t.color) + '" role="dialog" aria-modal="true" aria-labelledby="al-modal-name">' +
          '<button class="al-modal-close" id="al-modal-close" type="button" aria-label="Close">&#215;</button>' +
          '<div class="al-modal-body">' +
            '<div class="al-modal-kicker">' + trackPill(a) + '</div>' +
            '<h2 class="al-modal-name" id="al-modal-name">' + esc(a.name) + '</h2>' +
            '<p class="al-modal-role">' + esc(a.role_now) + '</p>' +
            '<div class="al-modal-meta">' + pills.join('') + '</div>' +
            '<div class="al-modal-prose">' + blocks.paras + '</div>' +
            (linkBtns.length ? '<div class="al-modal-links">' + linkBtns.join('') + '</div>' : '') +
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
    document.getElementById('al-modal-close').addEventListener('click', close);
    els.modalRoot.querySelector('.al-modal-back').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) close();
    });
    document.addEventListener('keydown', onKey, true);
  }

  function linkHtml(label, base, value) {
    var href = /^[a-z]+:/i.test(String(value)) ? value : base + value;
    var icon = label === 'LinkedIn'
      ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z"/></svg>'
      : label === 'Twitter'
      ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.66l7.73-8.84L1.24 2.25h6.83l4.71 6.23 5.46-6.23zm-1.16 17.52h1.83L7.01 4.13H5.04l12.04 15.64z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>';
    return '<a class="al-link-btn" href="' + esc(href) + '" target="_blank" rel="noopener">' + icon + esc(label) + '</a>';
  }

  /* ---------- featured + grid ---------- */
  function renderFeatured() {
    if (!els.featured) return;
    var featured = state.list.filter(function (a) { return a.featured; });
    var pool = featured.length ? featured : state.list.slice(0, 2);
    els.featured.innerHTML = pool.map(featHtml).join('');

    els.featured.querySelectorAll('.al-feat-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var a = findByName(card.getAttribute('data-name'));
        if (a && hasStory(a)) openModal(a);
      });
    });
  }

  function renderGrid() {
    if (!els.grid) return;
    var list = state.list.slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
    if (state.filter !== 'all') {
      list = list.filter(function (a) {
        return trackKey(a) === state.filter;
      });
    }
    list = list.filter(matchesSearch);

    els.grid.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<div class="al-grid-empty">No alumni match yet &mdash; try another filter, or check back soon.</div>';

    els.grid.querySelectorAll('.al-card').forEach(function (card, i) {
      card.style.animationDelay = Math.min(i * 0.06, 0.4) + 's';
      card.addEventListener('click', function () {
        var a = findByName(card.getAttribute('data-name'));
        if (a && hasStory(a)) openModal(a);
      });
    });
  }

  function findByName(name) {
    return state.list.find(function (a) { return a.name === name; });
  }

  /* ---------- filters ---------- */
  function renderFilters() {
    if (!els.filters) return;
    var chips = [{ key: 'all', label: 'All alumni', color: '' }].concat(TRACKS);
    els.filters.innerHTML = chips.map(function (c) {
      return '<button class="al-filter' + (c.key === state.filter ? ' is-active' : '') +
        (c.key !== 'all' ? ' al-filter--track' : '') +
        '" data-filter="' + c.key + '" type="button"' +
        (c.key !== 'all' ? ' style="--al-filt:' + c.color + '"' : '') + '>' +
        esc(c.label) + '</button>';
    }).join('');
    els.filters.querySelectorAll('.al-filter').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.filter = btn.getAttribute('data-filter');
        els.filters.querySelectorAll('.al-filter').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderGrid();
      });
    });
  }

  /* ---------- hero counters ---------- */
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
    var countries = new Set();
    var cohorts = new Set();
    state.list.forEach(function (a) {
      if (a.location) countries.add(String(a.location).split(',').pop().trim().toLowerCase());
      if (a.cohort) cohorts.add(String(a.cohort));
    });
    var clinical = state.list.filter(function (a) {
      return trackKey(a) === 'clinical';
    }).length;
    countUp(els.total, state.list.length);
    countUp(els.countries, countries.size);
    countUp(els.clinical, clinical);
    countUp(els.cohorts, cohorts.size);
  }

  /* ---------- init ---------- */
  window.loadSiteData().then(function (data) {
    window.applySiteSettings(data);
    var list = (data.alumniList && data.alumniList.length)
      ? data.alumniList
      : [];
    state.list = list.slice();

    renderStats();
    renderFeatured();
    renderFilters();
    renderGrid();

    if (els.search) {
      els.search.addEventListener('input', function () {
        state.search = els.search.value;
        renderGrid();
      });
    }

    /* smooth anchor from the hero CTA */
    var cta = document.getElementById('al-scroll-cta');
    if (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById('featured');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });
})();
