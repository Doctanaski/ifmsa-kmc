/* ============================================================
   IFMSA · Khyber Medical College — Achievements & Awards page
   ("The trophy cabinet"). Renders the council's awards from the
   loaded site data (Supabase → falls back to projects-data.js):
   • hero stat counters (awards, publications, partners, seasons)
   • a Hall of Fame podium for the featured wins
   • a sticky category shelf-nav
   • six category shelves: Officer of the Year, Best Project,
     Research Publications, International Recognition,
     National Partnerships and Community Impact
   • a detail modal per entry (story, gallery, links)
   ============================================================ */

(function () {
  'use strict';

  var CATS = [
    { key: 'officer',       num: '01', label: 'Officer of the Year',   sub: 'The people the council crowned — officers, tutors and organisers whose year deserved a trophy.',       color: '#d29922',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8"></path><path d="M12 17v4"></path><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"></path><path d="M7 6H4v1a4 4 0 0 0 3 4"></path><path d="M17 6h3v1a4 4 0 0 1-3 4"></path></svg>' },
    { key: 'project',       num: '02', label: 'Best Project',          sub: 'The projects and campaigns that won — judged by impact, reach and the room they filled.',                     color: '#0f9c15',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21 1.18.54 2.03 2.03 2.03 3.79"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"></path></svg>' },
    { key: 'research',      num: '03', label: 'Research Publications', sub: 'Accepted abstracts, papers and journal credits written by students who started at KMC.',                          color: '#6d28d9',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>' },
    { key: 'international', num: '04', label: 'International Recognition', sub: 'Peshawar carried onto the world stage — assemblies, national teams and global seats.',                      color: '#1d4ed8',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>' },
    { key: 'national',      num: '05', label: 'National Partnerships', sub: 'The MoUs and collaborations that turn council work into lasting, joined-up impact.',                             color: '#0d9488',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>' },
    { key: 'community',     num: '06', label: 'Community Impact',      sub: 'Numbers that don\'t need a trophy — people screened, kilos moved, lives touched.',                                color: '#db2777',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>' }
  ];
  var CAT_BY_KEY = {};
  CATS.forEach(function (c) { CAT_BY_KEY[c.key] = c; });

  var MEDALS = {
    gold:   { label: 'Gold',   star: 3 },
    silver: { label: 'Silver', star: 2 },
    bronze: { label: 'Bronze', star: 1 }
  };
  var MEDAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6"></circle><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"></path></svg>';

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

  var catKey = function (a) {
    return String(a.category || 'project').toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  var catOf = function (a) {
    return CAT_BY_KEY[catKey(a)] || CAT_BY_KEY.project;
  };

  var medalOf = function (a) {
    return MEDALS[String(a.medal || '').toLowerCase()] || null;
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

  var state = {
    list: []
  };

  var els = {
    total: document.getElementById('aw-stat-total'),
    pubs: document.getElementById('aw-stat-pubs'),
    partners: document.getElementById('aw-stat-partners'),
    seasons: document.getElementById('aw-stat-seasons'),
    fame: document.getElementById('aw-fame'),
    catnav: document.getElementById('aw-catnav'),
    cats: document.getElementById('aw-cats'),
    modalRoot: document.getElementById('aw-modal-root')
  };

  /* ---------- little builders ---------- */
  var catBadge = function (a) {
    var c = catOf(a);
    return '<span class="aw-cat-badge">' + c.icon + esc(c.label) + '</span>';
  };

  var medalBadge = function (a, cls) {
    var m = medalOf(a);
    if (!m) return '';
    return '<span class="' + cls + '">' + MEDAL_ICON + esc(m.label) + '</span>';
  };

  var metaBits = function (a) {
    var bits = [];
    if (a.year) bits.push(esc(a.year));
    if (a.location) bits.push(esc(a.location));
    return bits.join('<i aria-hidden="true"></i>');
  };

  var sourceHtml = function (a) {
    return a.source ? '<span class="aw-card-source">' + esc(a.source) + '</span>' : '';
  };

  var openTag = function (a) {
    return '<span class="aw-card-open">' + (catKey(a) === 'research' ? 'Read the paper &#8594;' : 'View recognition &#8594;') + '</span>';
  };

  /* ---------- generic card (project / international / national / community) ---------- */
  var genericCard = function (a) {
    var c = catOf(a);
    var blocks = splitBlocks(a.about);
    var img = blocks.images[0] || {};
    var media = img.src
      ? '<img src="' + esc(img.src) + '" alt="' + esc(a.title) + '" loading="lazy" decoding="async" />'
      : '<div class="aw-card-media-empty"></div>';

    return (
      '<article class="aw-card" data-id="' + esc(a.id) + '" style="--aw-cat:' + esc(c.color) + '">' +
        '<div class="aw-card-media">' + media +
          medalBadge(a, 'aw-card-medal') +
          '<span class="aw-card-motif">' + c.icon + '</span>' +
        '</div>' +
        '<div class="aw-card-body">' +
          '<div class="aw-card-kicker">' + metaBits(a) + '</div>' +
          '<h4 class="aw-card-title">' + esc(a.title) + '</h4>' +
          (a.awardee ? '<p class="aw-card-awardee">' + esc(a.awardee) + (a.role ? ' · ' + esc(a.role) : '') + '</p>' : '') +
          '<p class="aw-card-summary">' + esc(a.summary) + '</p>' +
          '<div class="aw-card-footer">' + sourceHtml(a) + openTag(a) + '</div>' +
        '</div>' +
      '</article>'
    );
  };

  /* ---------- officer cards (people) ---------- */
  var personCard = function (a) {
    var c = catOf(a);
    var blocks = splitBlocks(a.about);
    var img = blocks.images[0] || {};
    var media = img.src
      ? '<img src="' + esc(img.src) + '" alt="' + esc(a.awardee) + '" loading="lazy" decoding="async" />'
      : '<div class="aw-person-avatar"><span>' + esc(initials(a.awardee)) + '</span></div>';

    return (
      '<article class="aw-card" data-id="' + esc(a.id) + '" style="--aw-cat:' + esc(c.color) + '">' +
        '<div class="aw-person-media">' + media +
          medalBadge(a, 'aw-card-medal') +
        '</div>' +
        '<div class="aw-card-body">' +
          '<div class="aw-card-kicker">' + metaBits(a) + '</div>' +
          '<h4 class="aw-card-title">' + esc(a.title) + '</h4>' +
          (a.awardee ? '<p class="aw-card-awardee">' + esc(a.awardee) + '</p>' : '') +
          (a.role ? '<p class="aw-card-role" style="font-family:var(--aw-mono);font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;color:var(--aw-fg-faint);margin-bottom:.65rem">' + esc(a.role) + '</p>' : '') +
          '<p class="aw-card-summary">' + esc(a.summary) + '</p>' +
          '<div class="aw-card-footer">' + sourceHtml(a) + openTag(a) + '</div>' +
        '</div>' +
      '</article>'
    );
  };

  /* ---------- research papers (publication list) ---------- */
  var paperCard = function (a) {
    var c = catOf(a);
    var meta = [];
    if (a.source) meta.push(esc(a.source));
    if (a.year) meta.push(esc(a.year));
    var doi = a.link
      ? '<a class="aw-paper-doi" href="' + esc(a.link) + '" target="_blank" rel="noopener" onclick="event.stopPropagation()">' + esc(/^https?:\/\//i.test(a.link) ? 'Open link' : 'DOI ' + a.link) + '</a>'
      : '';

    return (
      '<article class="aw-paper" data-id="' + esc(a.id) + '" style="--aw-cat:' + esc(c.color) + '">' +
        '<div class="aw-paper-main">' +
          '<div class="aw-paper-meta">' + meta.join('<i aria-hidden="true"></i>') + '</div>' +
          '<h4 class="aw-paper-title">' + esc(a.title) + '</h4>' +
          (a.awardee ? '<p class="aw-paper-authors">' + esc(a.awardee) + '</p>' : '') +
          (a.summary ? '<p class="aw-card-summary">' + esc(a.summary) + '</p>' : '') +
        '</div>' +
        doi +
      '</article>'
    );
  };

  /* ---------- Hall of Fame podium ---------- */
  var podHtml = function (a) {
    var c = catOf(a);
    var blocks = splitBlocks(a.about);
    var img = blocks.images[0] || {};
    var media = img.src
      ? '<img src="' + esc(img.src) + '" alt="' + esc(a.title) + '" loading="lazy" decoding="async" />'
      : '<div class="aw-pod-avatar"><span>' + esc(initials(a.awardee || a.title)) + '</span></div>';

    return (
      '<article class="aw-pod" data-id="' + esc(a.id) + '" style="--aw-cat:' + esc(c.color) + '">' +
        '<div class="aw-pod-media">' + media + medalBadge(a, 'aw-pod-medal') + '</div>' +
        '<div class="aw-pod-body">' +
          '<div class="aw-pod-kicker">' + catBadge(a) + '</div>' +
          '<h3 class="aw-pod-title">' + esc(a.title) + '</h3>' +
          (a.awardee ? '<p class="aw-pod-awardee">' + esc(a.awardee) + '</p>' : '') +
          (a.role ? '<p class="aw-pod-role">' + esc(a.role) + '</p>' : '') +
          '<p class="aw-pod-summary">' + esc(a.summary) + '</p>' +
          '<span class="aw-pod-more">Read the full story &#8594;</span>' +
        '</div>' +
      '</article>'
    );
  };

  var podMiniHtml = function (a) {
    var c = catOf(a);
    var blocks = splitBlocks(a.about);
    var img = blocks.images[0] || {};
    var media = img.src
      ? '<img src="' + esc(img.src) + '" alt="' + esc(a.title) + '" loading="lazy" decoding="async" />'
      : '<div class="aw-pod-mini-avatar"><span>' + esc(initials(a.awardee || a.title)) + '</span></div>';

    return (
      '<article class="aw-pod-mini" data-id="' + esc(a.id) + '" style="--aw-cat:' + esc(c.color) + '">' +
        '<div class="aw-pod-mini-media">' + media + '</div>' +
        '<div class="aw-pod-mini-body">' +
          '<div class="aw-pod-mini-kicker">' + catBadge(a) + medalBadge(a, 'aw-card-medal') + '</div>' +
          '<h4 class="aw-pod-mini-title">' + esc(a.title) + '</h4>' +
          (a.awardee ? '<p class="aw-pod-mini-awardee">' + esc(a.awardee) + (a.role ? ' · ' + esc(a.role) : '') + '</p>' : '') +
          '<span class="aw-pod-mini-more">Full story &#8594;</span>' +
        '</div>' +
      '</article>'
    );
  };

  function renderFame() {
    if (!els.fame) return;
    var featured = state.list.filter(function (a) { return a.featured; });
    var pool = featured.length ? featured : state.list.slice(0, 2);
    var main = pool[0];
    var rest = pool.slice(1);

    var html = podHtml(main);
    if (rest.length) {
      html += '<div class="aw-fame-side">' + rest.map(podMiniHtml).join('') + '</div>';
    }
    els.fame.innerHTML = html;
    bindOpen(els.fame);
  }

  /* ---------- category shelves ---------- */
  function renderCats() {
    if (!els.cats) return;

    var html = CATS.map(function (c) {
      var items = state.list
        .filter(function (a) { return catKey(a) === c.key; })
        .sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); });

      var body;
      if (!items.length) {
        body = '<div class="aw-empty">Nothing filed on this shelf yet &mdash; check back after the next assembly.</div>';
      } else if (c.key === 'research') {
        body = '<div class="aw-grid">' + items.map(paperCard).join('') + '</div>';
      } else if (c.key === 'officer') {
        body = '<div class="aw-grid">' + items.map(personCard).join('') + '</div>';
      } else {
        body = '<div class="aw-grid">' + items.map(genericCard).join('') + '</div>';
      }

      return (
        '<section class="aw-cat" id="aw-cat-' + c.key + '" style="--aw-cat:' + esc(c.color) + '" aria-labelledby="aw-cat-title-' + c.key + '">' +
          '<div class="aw-cat-head">' +
            '<div class="aw-cat-head-left">' +
              '<p class="aw-cat-label">' + c.num + ' &mdash; ' + esc(c.label) + '</p>' +
              '<h3 class="aw-cat-title" id="aw-cat-title-' + c.key + '">' + esc(c.label) + '</h3>' +
            '</div>' +
            '<p class="aw-cat-head-right">' + esc(c.sub) + '</p>' +
          '</div>' +
          body +
        '</section>'
      );
    }).join('');

    els.cats.innerHTML = html;
    bindOpen(els.cats);
  }

  /* ---------- category nav ---------- */
  function renderCatnav() {
    if (!els.catnav) return;
    els.catnav.innerHTML = CATS.map(function (c) {
      return '<button class="aw-catnav-chip" data-target="aw-cat-' + c.key + '" type="button" style="--aw-cat:' + esc(c.color) + '"><i></i>' + esc(c.label) + '</button>';
    }).join('');

    els.catnav.querySelectorAll('.aw-catnav-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var target = document.getElementById(btn.getAttribute('data-target'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ---------- modal ---------- */
  function openModal(a) {
    var c = catOf(a);
    var m = medalOf(a);
    var blocks = splitBlocks(a.about);
    var hero = blocks.images[0] || {};
    var gallery = blocks.images.slice(1);

    var pills = [];
    pills.push('<span class="aw-meta-pill aw-meta-pill--cat">' + c.icon + esc(c.label) + '</span>');
    if (m) pills.push('<span class="aw-meta-pill">' + MEDAL_ICON + esc(m.label) + '</span>');
    if (a.year) pills.push('<span class="aw-meta-pill">' + esc(a.year) + '</span>');
    if (a.location) pills.push('<span class="aw-meta-pill">' + esc(a.location) + '</span>');
    if (a.source) pills.push('<span class="aw-meta-pill">' + esc(a.source) + '</span>');

    var galleryHtml = gallery.length
      ? '<div class="aw-modal-gallery" aria-label="Image gallery">' +
          gallery.map(function (g) {
            return '<figure class="aw-modal-g-img">' +
              '<img src="' + esc(g.src) + '" alt="' + esc(g.alt) + '" loading="lazy" decoding="async" />' +
              (g.alt ? '<figcaption>' + esc(g.alt) + '</figcaption>' : '') +
            '</figure>';
          }).join('') +
        '</div>'
      : '';

    var links = '';
    if (a.link) {
      var href = /^[a-z]+:/i.test(String(a.link)) ? a.link : 'https://' + a.link;
      var linkLabel = catKey(a) === 'research' ? 'Open the paper' : 'Find out more';
      links =
        '<div class="aw-modal-links">' +
          '<a class="aw-link-btn" href="' + esc(href) + '" target="_blank" rel="noopener">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>' +
            esc(linkLabel) + '</a>' +
        '</div>';
    }

    els.modalRoot.innerHTML =
      '<div class="aw-modal-back">' +
        '<div class="aw-modal" style="--aw-cat:' + esc(c.color) + '" role="dialog" aria-modal="true" aria-labelledby="aw-modal-title">' +
          '<button class="aw-modal-close" id="aw-modal-close" type="button" aria-label="Close">&#215;</button>' +
          '<div class="aw-modal-hero">' +
            (hero.src
              ? '<img src="' + esc(hero.src) + '" alt="' + esc(hero.alt || a.title) + '" loading="lazy" decoding="async" />'
              : '<div class="aw-modal-avatar"><span>' + esc(initials(a.awardee || a.title)) + '</span></div>') +
          '</div>' +
          '<div class="aw-modal-body">' +
            '<div class="aw-modal-kicker">' + catBadge(a) + (m ? '<span class="aw-meta-pill">' + MEDAL_ICON + esc(m.label) + '</span>' : '') + '</div>' +
            '<h2 class="aw-modal-title" id="aw-modal-title">' + esc(a.title) + '</h2>' +
            (a.awardee ? '<p class="aw-modal-awardee">' + esc(a.awardee) + (a.role ? ' &mdash; ' + esc(a.role) : '') + '</p>' : '') +
            '<div class="aw-modal-meta">' + pills.join('') + '</div>' +
            '<div class="aw-modal-prose">' + blocks.paras + '</div>' +
            galleryHtml +
            links +
            '<div class="aw-modal-cta">' +
              '<a href="join.html" class="aw-btn aw-btn-white">Join the council</a>' +
              '<a href="index.html" class="aw-btn aw-btn-ghost-white">Back to home</a>' +
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
    document.getElementById('aw-modal-close').addEventListener('click', close);
    els.modalRoot.querySelector('.aw-modal-back').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) close();
    });
    document.addEventListener('keydown', onKey, true);
  }

  /* bind card clicks inside a container */
  function bindOpen(root) {
    root.querySelectorAll('[data-id]').forEach(function (card) {
      card.addEventListener('click', function () {
        var a = state.list.find(function (x) { return x.id === card.getAttribute('data-id'); });
        if (a) openModal(a);
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
    var pubs = state.list.filter(function (a) { return catKey(a) === 'research'; }).length;
    var partners = state.list.filter(function (a) { return catKey(a) === 'national'; }).length;
    var seasons = new Set();
    state.list.forEach(function (a) { if (a.year) seasons.add(String(a.year)); });
    countUp(els.total, state.list.length);
    countUp(els.pubs, pubs);
    countUp(els.partners, partners);
    countUp(els.seasons, seasons.size);
  }

  /* ---------- init ---------- */
  window.loadSiteData().then(function (data) {
    window.applySiteSettings(data);
    var list = (data.awardsList && data.awardsList.length)
      ? data.awardsList
      : ((window.IFMSA_DATA && window.IFMSA_DATA.awards) || []);
    state.list = list.slice();

    /* keep featured entries at the top of the Hall of Fame, in order */
    state.list.sort(function (a, b) {
      var fa = a.featured ? 0 : 1;
      var fb = b.featured ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    renderStats();
    renderFame();
    renderCatnav();
    renderCats();

    /* smooth anchor from the hero CTA */
    var cta = document.getElementById('aw-scroll-cta');
    if (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById('fame');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  });
})();
