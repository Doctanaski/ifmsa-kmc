/* ============================================================
   IFMSA · Khyber Medical College
   Scroll-based section movement.
   One scroll gesture = one section (committee).
   ============================================================ */

(function () {
  'use strict';

  const stage = document.getElementById('top');
  const panels = Array.from(document.querySelectorAll('.panel'));
  const rail = document.getElementById('rail');
  const progress = document.getElementById('progress');

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

    const pct = ((i + 1) / panels.length) * 100;
    progress.style.width = pct + '%';
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

  /* ---------- wheel: one notch = one section ---------- */
  let wheelBusy = false;

  const inScrollableList = (el) => {
    while (el && el !== stage) {
      if (el.classList && el.classList.contains('proj-list')) return true;
      el = el.parentElement;
    }
    return false;
  };

  stage.addEventListener('wheel', (e) => {
    if (inScrollableList(e.target)) {
      const list = e.target.closest('.proj-list');
      const atStart = list.scrollTop <= 0;
      const atEnd = list.scrollTop + list.clientHeight >= list.scrollHeight - 1;
      const scrollingDown = e.deltaY > 0;
      if (!(scrollingDown && atEnd) && !(!scrollingDown && atStart)) {
        e.preventDefault();
        list.scrollTop += e.deltaY;
        return;
      }
    }

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
    const map = {
      ArrowDown: next,
      ArrowUp: prev,
      PageUp: prev,
      PageDown: next,
      Home: () => goTo(0),
      End: () => goTo(panels.length - 1),
    };
    if (e.key === ' ' && e.target && e.target.tagName === 'BUTTON') return;
    const fn = e.key === ' ' ? next : map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  });

  /* ---------- swipe ---------- */
  let touchY = null;
  stage.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchmove', (e) => {
    if (touchY === null) return;
    const dy = touchY - e.touches[0].clientY;
    if (Math.abs(dy) > 34) {
      if (isAnimating) { touchY = null; return; }
      if (dy > 0) next(); else prev();
      touchY = null;
    }
  }, { passive: true });
  stage.addEventListener('touchend', () => { touchY = null; });

  /* ---------- keep rail/progress in sync ---------- */
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

  /* ---------- project lists ---------- */
  try {
    const data = window.IFMSA_DATA;
    document.querySelectorAll('.proj-list').forEach((list) => {
      const slug = list.dataset.committee;
      const items = (data && data.projects || []).filter((p) => p.committee === slug);
      list.innerHTML = items.map((p) => {
        const com = data.committees[p.committee] || {};
        const status = p.status ? '<span class="proj-status">' + p.status + '</span>' : '';
        const type = p.type ? '<span class="proj-type">' + p.type + '</span>' : '';
        return (
          '<li class="proj-item">' +
            '<a class="proj-link" style="--proj-accent:' + (com.accent || com.color || '') + '" href="projects.html?id=' + encodeURIComponent(p.id) + '">' +
              '<span class="proj-top">' +
                '<span class="proj-title">' + p.title + '</span>' +
                '<span class="proj-arrow" aria-hidden="true">→</span>' +
              '</span>' +
              '<span class="proj-tags">' + type + status + '</span>' +
            '</a>' +
          '</li>'
        );
      }).join('');
    });
  } catch (err) { /* list stays empty if data missing */ }
})();