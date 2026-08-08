/* ============================================================
   IFMSA Pakistan — Khyber Medical College
   Dynamic scroll-based navigation
   Each "scroll key" (mouse wheel / arrows / swipes) advances
   exactly one standing committee section.
   ============================================================ */

(function () {
  'use strict';

  const main = document.getElementById('sections');
  const panels = Array.from(document.querySelectorAll('.panel'));
  const dotNav = document.getElementById('dotNav');
  const progressBar = document.getElementById('progressBar');
  const menuBtn = document.getElementById('menuBtn');
  const html = document.documentElement;

  // Debounce / lock helper -------------------------------------------------
  const throttle = (fn, wait) => {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= wait) {
        last = now;
        fn(...args);
      }
    };
  };

  let isAnimating = false;
  let activeIndex = 0;

  /* ---------- Build dot navigation ---------- */
  panels.forEach((panel, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', 'Go to ' + panel.dataset.title);
    dot.innerHTML = '<span class="dot-label">' + panel.dataset.title + '</span>';
    dot.addEventListener('click', () => goTo(i));
    dotNav.appendChild(dot);
  });

  const dots = Array.from(dotNav.querySelectorAll('button'));

  /* ---------- Core: reveal current section ---------- */
  const activate = (i) => {
    i = Math.max(0, Math.min(panels.length - 1, i));
    activeIndex = i;

    panels.forEach((p, idx) => p.classList.toggle('is-active', idx === i));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === i));

    const panel = panels[i];
    const accent = getComputedStyle(document.documentElement)
                    .getPropertyValue('--slide-' + panel.dataset.slide)
                    .trim();
    if (accent) {
      document.documentElement.style.setProperty('--accent', accent);
    }

    // Progress bar width
    const pct = ((i + 1) / panels.length) * 100;
    progressBar.style.width = pct + '%';
  };

  /* ---------- Scroll to a section (the single "go" function) ---------- */
  const goTo = (index) => {
    if (isAnimating) return;
    index = Math.max(0, Math.min(panels.length - 1, index));
    if (index === activeIndex) return;

    isAnimating = true;
    main.style.scrollBehavior = 'smooth';
    panels[index].scrollIntoView({ behavior: 'smooth', block: 'start' });

    // allow native smooth scroll to finish before accepting new input
    window.setTimeout(() => {
      isAnimating = false;
    }, 800);
  };

  const next = () => goTo(activeIndex + 1);
  const prev = () => goTo(activeIndex - 1);

  /* ---------- Wheel navigation (one notch = one committee) ---------- */
  let wheelBusy = false;
  main.addEventListener('wheel', (e) => {
    e.preventDefault();

    // If user is mid-flight ignore
    if (isAnimating) return;

    // Read actual scroll position (in case user dragged scrollbar)
    syncActiveFromScroll();

    const delta = e.deltaY;
    if (Math.abs(delta) < 8) return;

    if (!wheelBusy) {
      wheelBusy = true;
      if (delta > 0) {
        next();
      } else {
        prev();
      }
      window.setTimeout(() => { wheelBusy = false; }, 150);
    }
  }, { passive: false });

  /* ---------- Keyboard navigation ---------- */
  window.addEventListener('keydown', (e) => {
    const keys = {
      ArrowDown: () => next(),
      ArrowUp: () => prev(),
      PageUp: () => prev(),
      PageDown: () => next(),
      ' ': () => next(),
      Home: () => goTo(0),
      End: () => goTo(panels.length - 1),
    };
    const target = e.key === ' ' ? ' ' : e.key;
    if (e.key === ' ' && e.target && e.target.tagName === 'BUTTON') return;
    if (keys[target]) {
      e.preventDefault();
      keys[target]();
    }
  });

  /* ---------- Touch / swipe support ---------- */
  let touchStartY = null;
  main.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  main.addEventListener('touchmove', (e) => {
    if (touchStartY === null) return;
    const dy = touchStartY - e.touches[0].clientY;
    if (Math.abs(dy) > 34) {
      if (isAnimating) { touchStartY = null; return; }
      if (dy > 0) next(); else prev();
      touchStartY = null;
    }
  }, { passive: true });

  main.addEventListener('touchend', () => { touchStartY = null; });

  /* ---------- Menu button = next ---------- */
  menuBtn.addEventListener('click', next);

  /* ---------- Sync active section as the browser scrolls ---------- */
  const syncActiveFromScroll = () => {
    let best = 0;
    let bestScore = Infinity;
    const half = window.innerHeight / 2;
    panels.forEach((p, idx) => {
      const rect = p.getBoundingClientRect();
      const dist = Math.abs(rect.top - 0);
      if (dist < bestScore) { bestScore = dist; best = idx; }
    });
    if (best !== activeIndex) activate(best);
  };

  const onScroll = throttle(() => {
    syncActiveFromScroll();
  }, 100);
  main.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- Init ---------- */
  activate(0);
})();