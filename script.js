/* ============================================================
   IFMSA · Khyber Medical College
   Section movement + carousels + about/join tabs.
   The home section is a regular scrollable page; committee
   carousels move via their up/down arrow buttons (or dragging).
   ============================================================ */

(function () {
  'use strict';

  const stage = document.getElementById('top');
  const panels = Array.from(document.querySelectorAll('.panel'));
  const rail = document.getElementById('rail');
  const isMobile = window.matchMedia('(max-width: 640px)');

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

const topbar = document.querySelector('.topbar');

/* ---------- state ---------- */
const activate = (i) => {
  i = Math.max(0, Math.min(panels.length - 1, i));
  activeIndex = i;

  panels.forEach((p, idx) => p.classList.toggle('is-active', idx === i));
  if (topbar) topbar.classList.toggle('is-hidden', i > 0 && !isMobile.matches);

    const accent = getComputedStyle(panels[i]).getPropertyValue('--panel-accent').trim()
      || getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
    dots.forEach((d, idx) => {
      d.classList.toggle('active', idx === i);
      if (idx === i) d.style.setProperty('--dot-col', accent);
    });
  };

  /* ---------- navigation ---------- */
  let animTimer = null;

  /* panel tops are stable in normal flow, so measure once instead of forcing
     a synchronous layout reflow on every scroll frame */
  let panelTops = [];
  const measurePanelTops = () => {
    const sc = isMobile.matches ? document.scrollingElement : stage;
    panelTops = panels.map((p) => p.getBoundingClientRect().top + sc.scrollTop);
  };
  const panelTop = (i) => panelTops[i];
  const isSnapped = (i) => Math.abs(stage.scrollTop - panelTops[i]) < 4;

  /* the home page is free-scrollable, but only as far as the jump button —
     the visitor can never scroll past it into the first committee slide */
  const homeMaxTop = () => Math.max(0, panelTops[1] - stage.clientHeight);

  const beginAnim = () => {
    isAnimating = true;
    window.clearTimeout(animTimer);
    animTimer = window.setTimeout(() => { isAnimating = false; }, 1200);
  };
  const stopAnim = () => {
    window.clearTimeout(animTimer);
    isAnimating = false;
  };

  const goTo = (index) => {
    index = Math.max(0, Math.min(panels.length - 1, index));
    const top = panelTop(index);
    activate(index);

    const sc = isMobile.matches ? document.scrollingElement : stage;
    if (Math.abs(sc.scrollTop - top) < 2) { stopAnim(); return; }

    beginAnim();
    sc.scrollTo({ top, behavior: 'smooth' });
  };

  const next = () => goTo(activeIndex + 1);
  const prev = () => goTo(activeIndex - 1);

  /* drop the animation lock as soon as the browser finishes moving */
  if ('onscrollend' in stage) {
    stage.addEventListener('scrollend', stopAnim);
  }

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

  /* ---------- wheel: free scroll on the home page, then one slide per gesture
     once the visitor reaches the committee area ---------- */
  stage.addEventListener('wheel', (e) => {
    if (isMobile.matches) return;   /* phones scroll natively */
    const delta = e.deltaY;
    if (Math.abs(delta) < 8) return;

    /* home stays a regular scrollable page, halting at the jump button */
    if (activeIndex === 0) {
      if (delta > 0 && stage.scrollTop >= homeMaxTop() - 1) e.preventDefault();
      return;
    }

    const dir = delta > 0 ? 1 : -1;
    const target = activeIndex + dir;

    /* scrolled past the last committee toward the footer → native scroll */
    if (-panels[panels.length - 1].getBoundingClientRect().top > 24) return;

    /* boundaries (SCOPE → home, SCORE → footer) stay free-scrollable */
    if (target <= 0 || target >= panels.length) return;

    e.preventDefault();
    if (isAnimating) return;

    /* lock onto the slide being drifted past, then step one at a time */
    if (!isSnapped(activeIndex)) { goTo(activeIndex); return; }
    goTo(target);
  }, { passive: false });

  /* ---------- keyboard: only jump slides once out of the home page ---------- */
  window.addEventListener('keydown', (e) => {
    if (activeIndex === 0) return;
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
  let touchHero = false;

  stage.addEventListener('touchstart', (e) => {
    if (isMobile.matches) return;   /* phones swipe the page natively */
    touchY = e.touches[0].clientY;
    const targetPanel = e.target.closest('.panel-carousel');
    touchCar = (!isMobile.matches && targetPanel) ? (carousels.get(targetPanel) || null) : null;
    touchHero = !!e.target.closest('.home');
  }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (isMobile.matches || touchY === null) return;
    if (touchHero) { touchY = null; return; }
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
      /* lock onto the slide being passed before advancing */
      if (!isSnapped(activeIndex)) { goTo(activeIndex); touchY = null; return; }
      if (dy > 0) next(); else prev();
      touchY = null;
    }
  }, { passive: true });
  stage.addEventListener('touchend', () => { touchY = null; touchHero = false; });

  /* ---------- keep rail in sync ---------- */
  const syncActiveFromScroll = () => {
    if (isAnimating) return;
    let best = 0;
    const pos = stage.scrollTop + 1;
    panels.forEach((p, idx) => {
      if (panelTops[idx] <= pos) best = idx;
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
  window.addEventListener('resize', () => { measurePanelTops(); onScroll(); });

  /* parallax: the about/join card photos drift as the hero scrolls */
  const cardBgEls = Array.from(document.querySelectorAll('.card-img-bg'));
  const updateCardParallax = () => {
    const y = stage.scrollTop;
    for (let i = 0; i < cardBgEls.length; i++) {
      cardBgEls[i].style.backgroundPosition = 'center ' + (y * 0.12) + 'px';
    }
  };

  /* hard ceiling on the home page: never let the scroll spill past the jump
     button into the committee slides (safe with momentum / touch / scrollbar) */
  stage.addEventListener('scroll', () => {
    if (isMobile.matches || activeIndex !== 0) return;
    updateCardParallax();
    const maxTop = homeMaxTop();
    if (stage.scrollTop > maxTop) stage.scrollTop = maxTop;
  }, { passive: true });

  /* ---------- init ---------- */
  activate(0);
  measurePanelTops();
  updateCardParallax();
  window.addEventListener('load', () => measurePanelTops());

  /* ---------- stat card animations (spin numbers + typewriter labels) ---------- */
  const spinStatValue = (el, onDone) => {
    if (el.dataset.animated) { onDone && onDone(); return; }
    el.dataset.animated = '1';
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const chars = Array.from(el.textContent);
    const cells = chars.map((ch) => {
      const span = document.createElement('span');
      span.textContent = ch;
      if (/\d/.test(ch)) span.className = 'stat-spin-digit';
      return span;
    });
    el.textContent = '';
    cells.forEach((c) => el.appendChild(c));

    const digits = cells.filter((c) => c.classList.contains('stat-spin-digit'));
    if (reduceMotion || !digits.length) { onDone && onDone(); return; }

    const duration = 1300;
    const start = performance.now();
    const rand = () => Math.random();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      digits.forEach((cell, idx) => {
        const settleT = Math.min(1, t * 1.7 - idx * 0.05);
        if (rand() < Math.max(0, 1 - settleT)) {
          cell.textContent = String(Math.floor(rand() * 10));
        }
      });
      if (t < 1) requestAnimationFrame(frame);
      else {
        cells.forEach((c, i) => { c.textContent = chars[i]; });
        onDone && onDone();
      }
    };
    requestAnimationFrame(frame);
  };

  const typewriter = (el) => {
    if (el.dataset.typed) return;
    el.dataset.typed = '1';
    const text = el.textContent;
    el.textContent = '';
    el.classList.add('typing');
    let i = 0;
    const step = () => {
      i++;
      el.textContent = text.slice(0, i);
      if (i < text.length) setTimeout(step, 14);
      else el.classList.remove('typing');
    };
    setTimeout(step, 260);
  };

  const animateStats = () => {
    const cards = document.querySelectorAll('.hero-stat-card');
    let delay = 0;
    cards.forEach((card) => {
      const numEl = card.querySelector('.stat-value');
      const labelEl = card.querySelector('.stat-label');
      if (!numEl) return;
      setTimeout(() => spinStatValue(numEl, () => labelEl && typewriter(labelEl)), delay);
      delay += 220;
    });
  };

  /* ---------- "View the committees" jumps to the first committee slide ---------- */
  const committeesBtn = document.getElementById('btn-committees');
  if (committeesBtn) {
    committeesBtn.addEventListener('click', () => goTo(1));
  }

  /* hash links that target a committee slide must go through goTo(), otherwise
     the native fragment scroll collides with the home scroll ceiling */
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const idx = panels.indexOf(document.getElementById(link.getAttribute('href').slice(1)));
    if (idx > 0) {
      e.preventDefault();
      goTo(idx);
    }
  });



  /* ---------- load live data (falls back to IFMSA_DATA) ---------- */
  window.loadSiteData().then((siteData) => {
    window.applySiteSettings(siteData);
    buildCarousels(siteData);
    measurePanelTops();
    animateStats();
  });
})();