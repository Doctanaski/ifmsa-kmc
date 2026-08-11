/* ============================================================
   IFMSA · Khyber Medical College
   Scroll-based section movement.
   One scroll gesture = one section. Committee carousels only
   move via their up/down arrow buttons (or by dragging on touch).
   ============================================================ */

(function () {
  'use strict';

  const stage = document.getElementById('top');
  const panels = Array.from(document.querySelectorAll('.panel'));
  const rail = document.getElementById('rail');

  let isAnimating = false;
  let activeIndex = 0;

  /* ---------- build rail ---------- */
  panels.forEach((panel, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', 'Go to ' + panel.dataset.title);
    dot.addEventListener('click', () => goTo(i));
    rail.appendChild(dot);
  });

  const dots = Array.from(rail.querySelectorAll('button'));

  /* ---------- state ---------- */
  const activate = (i) => {
    i = Math.max(0, Math.min(panels.length - 1, i));
    activeIndex = i;

    panels.forEach((p, idx) => p.classList.toggle('is-active', idx === i));

    const accent = getComputedStyle(panels[i]).getPropertyValue('--panel-accent').trim()
      || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    dots.forEach((d, idx) => {
      d.classList.toggle('active', idx === i);
      if (idx === i) d.style.setProperty('--dot-col', accent);
    });
  };

  /* ---------- navigation ---------- */
  const goTo = (index) => {
    if (isAnimating) return;
    index = Math.max(0, Math.min(panels.length - 1, index));
    if (index === activeIndex) return;

    isAnimating = true;
    panels[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => { isAnimating = false; }, 800);
  };

  const next = () => goTo(activeIndex + 1);
  const prev = () => goTo(activeIndex - 1);

  /* ---------- committee carousels (up/down arrows) ---------- */
  const carousels = new Map();

  const STATUS_TAG = {
    'Planned': 'planned',
    'Upcoming': 'upcoming',
    'Applications open': 'executed',
    'Applications closed': 'upcoming',
    'Open': 'executed',
    'Accepting tutors': 'executed',
    'Recruiting': 'executed',
    'Live': 'executed',
    'Beta': 'executed',
    'On hold': 'planned',
    'Completed': 'executed',
    'Cancelled': 'planned'
  };
  const TAG_LABEL = { upcoming: 'Upcoming', executed: 'Executed', planned: 'Planned' };
  const tagOf = (raw) => STATUS_TAG[raw] || 'planned';

  const buildCarousels = (data) => {
  document.querySelectorAll('.panel-carousel').forEach((panel) => {
    const slug = panel.dataset.committee;
    const com = (data.committees && data.committees[slug]) || {};
    const items = (data.projects || []).filter((p) => p.committee === slug);

    panel.style.setProperty('--car-accent', com.accent || '');

    const track = panel.querySelector('.car-track');
    const count = panel.querySelector('.car-count');

    track.innerHTML = items.map((p, i) => {
      const no = String(i + 1).padStart(2, '0');
      const tag = tagOf(p.status);
      return (
        '<article class="car-card">' +
          '<div class="car-bg" aria-hidden="true">' +
            '<span class="car-bg-blob"></span>' +
            '<span class="car-bg-ring"></span>' +
            '<span class="car-bg-word">' + (com.acronym || 'IFMSA') + '</span>' +
          '</div>' +
          '<div class="car-inner">' +
            '<div class="car-top">' +
              '<h3 class="car-title"><span class="car-no">' + no + '</span>' + p.title + '</h3>' +
              '<span class="car-tag car-tag--' + tag + '">' + TAG_LABEL[tag] + '</span>' +
            '</div>' +
            '<div class="car-bottom">' +
              '<p class="car-summary">' + (p.summary || '') + '</p>' +
              '<a class="car-link" href="projects.html?id=' + encodeURIComponent(p.id) + '">Open Project</a>' +
            '</div>' +
          '</div>' +
        '</article>'
      );
    }).join('');

    if (!items.length) {
      count.textContent = '—';
      return;
    }

    let index = 0;
    const cardEls = Array.from(track.children);
    const render = () => {
      track.style.transform = 'translateY(' + (-index * 100) + '%)';
      count.innerHTML =
        '<span class="car-count-now">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<span class="car-count-slash">/</span>' +
        '<span class="car-count-total">' + String(items.length).padStart(2, '0') + '</span>';
      cardEls.forEach((card, i) => card.classList.toggle('is-active', i === index));
    };
    const step = (dir) => {
      index = (((index + dir) % items.length) + items.length) % items.length;
      render();
    };
    const available = (dir) => (dir > 0 ? index + 1 < items.length : index - 1 >= 0);

    panel.querySelector('.car-btn[data-dir="-1"]').addEventListener('click', () => step(-1));
    panel.querySelector('.car-btn[data-dir="1"]').addEventListener('click', () => step(1));

    render();
    carousels.set(panel, { items, available, step });
  });
  };

  /* ---------- wheel: one gesture per section ---------- */
  let wheelBusy = false;

  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (isAnimating) return;

    syncActiveFromScroll();

    const delta = e.deltaY;
    if (Math.abs(delta) < 8) return;

    if (!wheelBusy) {
      wheelBusy = true;
      if (delta > 0) next(); else prev();
      window.setTimeout(() => { wheelBusy = false; }, 150);
    }
  }, { passive: false });

  /* ---------- keyboard ---------- */
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ' && e.target && e.target.tagName === 'BUTTON') return;

    const keyDir = { ' ': 1, PageDown: 1, ArrowDown: 1, PageUp: -1, ArrowUp: -1 }[e.key];

    if (keyDir) {
      e.preventDefault();
      if (keyDir > 0) next(); else prev();
      return;
    }
    if (e.key === 'Home') { e.preventDefault(); goTo(0); return; }
    if (e.key === 'End') { e.preventDefault(); goTo(panels.length - 1); }
  });

  /* ---------- touch: drag a carousel's cards, otherwise swipe sections ---------- */
  let touchY = null;
  let touchCar = null;

  stage.addEventListener('touchstart', (e) => {
    touchY = e.touches[0].clientY;
    const targetPanel = e.target.closest('.panel-carousel');
    touchCar = targetPanel ? (carousels.get(targetPanel) || null) : null;
  }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (touchY === null) return;
    const dy = touchY - e.touches[0].clientY;
    if (Math.abs(dy) > 34) {
      if (isAnimating) { touchY = null; return; }
      if (touchCar && touchCar.items.length) {
        const dir = dy > 0 ? 1 : -1;
        if (touchCar.available(dir)) {
          touchCar.step(dir);
          touchY = null;
          return;
        }
      }
      if (dy > 0) next(); else prev();
      touchY = null;
    }
  }, { passive: true });
  stage.addEventListener('touchend', () => { touchY = null; });

  /* ---------- keep rail in sync ---------- */
  const syncActiveFromScroll = () => {
    let best = 0;
    let bestDist = Infinity;
    panels.forEach((p, idx) => {
      const d = Math.abs(p.getBoundingClientRect().top);
      if (d < bestDist) { bestDist = d; best = idx; }
    });
    if (best !== activeIndex) activate(best);
  };

  const onScroll = (function () {
    let t;
    return () => {
      clearTimeout(t);
      t = setTimeout(syncActiveFromScroll, 80);
    };
  })();

  stage.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- init ---------- */
  activate(0);

  /* ---------- load live data (falls back to IFMSA_DATA) ---------- */
  window.loadSiteData().then((siteData) => {
    window.applySiteSettings(siteData);
    buildCarousels(siteData);
  });
})();