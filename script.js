/* ============================================================
   IFMSA · Khyber Medical College
   Scroll-based section movement + Embla parallax project
   carousels inside each committee slide.
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

  /* ---------- Embla parallax carousel per committee ---------- */
  const emblas = new Map();

  const ARROW_PREV =
    '<svg class="embla__button__svg" viewBox="0 0 532 532"><path fill="currentColor" ' +
    'd="M355.66 11.354c13.793-13.805 36.208-13.805 50.001 0 13.785 13.804 13.785 36.238 0 50.034L201.22 266l204.442 204.61c13.785 13.805 13.785 36.239 0 50.044-13.793 13.796-36.208 13.796-50.002 0a5994246.277 5994246.277 0 0 0-229.332-229.454 35.065 35.065 0 0 1-10.326-25.126c0-9.2 3.393-18.26 10.326-25.2C172.192 194.973 332.731 34.31 355.66 11.354Z"/></svg>';
  const ARROW_NEXT =
    '<svg class="embla__button__svg" viewBox="0 0 532 532"><path fill="currentColor" ' +
    'd="M176.34 520.646c-13.793 13.805-36.208 13.805-50.001 0-13.785-13.804-13.785-36.238 0-50.034L330.78 266 126.34 61.391c-13.785-13.805-13.785-36.239 0-50.044 13.793-13.796 36.208-13.796 50.002 0 22.928 22.947 206.395 206.507 229.332 229.454a35.065 35.065 0 0 1 10.326 25.126c0 9.2-3.393 18.26-10.326 25.2-45.865 45.901-206.404 206.564-229.332 229.52Z"/></svg>';

  function setupEmbla(panel) {
    if (typeof window.EmblaCarousel === 'undefined') return null;

    const el = panel.querySelector('.embla');
    if (!el) return null;

    const data = window.IFMSA_DATA || {};
    const slug = panel.dataset.committee;
    const com = (data.committees && data.committees[slug]) || {};
    const items = (data.projects || []).filter((p) => p.committee === slug);
    if (!items.length) return null;

    const viewport = document.createElement('div');
    viewport.className = 'embla__viewport';
    const container = document.createElement('div');
    container.className = 'embla__container';
    viewport.appendChild(container);

    container.innerHTML = items.map((p, i) => {
      const type = p.type ? '<span class="car-type">' + p.type + '</span>' : '';
      const status = p.status ? '<span class="car-status">' + p.status + '</span>' : '';
      return (
        '<div class="embla__slide">' +
          '<div class="embla__parallax" style="--car-accent:' + (com.accent || 'var(--accent)') + '">' +
            '<div class="embla__parallax__layer">' +
              '<div class="embla__parallax__img">' +
                '<span class="car-kicker">Project ' + String(i + 1).padStart(2, '0') + '</span>' +
                '<h3 class="car-title">' + p.title + '</h3>' +
                '<p class="car-summary">' + (p.summary || '') + '</p>' +
                '<span class="car-pills">' + type + status + '</span>' +
                '<div class="car-foot">' +
                  '<span class="car-theme">' + (p.theme || '') + '</span>' +
                  '<a class="car-link" href="projects.html?id=' + encodeURIComponent(p.id) + '">Open project &rarr;</a>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    const controls = document.createElement('div');
    controls.className = 'embla__controls';

    const buttons = document.createElement('div');
    buttons.className = 'embla__buttons';
    buttons.innerHTML =
      '<button class="embla__button embla__button--prev" type="button" aria-label="Previous project">' + ARROW_PREV + '</button>' +
      '<button class="embla__button embla__button--next" type="button" aria-label="Next project">' + ARROW_NEXT + '</button>';

    const dotsEl = document.createElement('div');
    dotsEl.className = 'embla__dots';

    controls.appendChild(buttons);
    controls.appendChild(dotsEl);
    el.appendChild(viewport);
    el.appendChild(controls);

    const embla = window.EmblaCarousel.create(viewport, { dragFree: true, loop: true });
    const prevBtn = buttons.querySelector('.embla__button--prev');
    const nextBtn = buttons.querySelector('.embla__button--next');

    /* ----- parallax tween (ported from the Embla parallax example) ----- */
    const TWEEN_FACTOR_BASE = 0.2;
    let tweenFactor = 0;
    let tweenNodes = [];

    const setTweenNodes = (api) => {
      tweenNodes = api.slideNodes().map((node) => node.querySelector('.embla__parallax__layer'));
    };

    const setTweenFactor = (api) => {
      tweenFactor = TWEEN_FACTOR_BASE * api.scrollSnapList().length;
    };

    const tweenParallax = (api, eventName) => {
      const engine = api.internalEngine();
      const scrollProgress = api.scrollProgress();
      const slidesInView = api.slidesInView();
      const isScrollEvent = eventName === 'scroll';

      api.scrollSnapList().forEach((scrollSnap, snapIndex) => {
        let diffToTarget = scrollSnap - scrollProgress;
        const slidesInSnap = engine.slideRegistry[snapIndex];
        if (!slidesInSnap) return;

        slidesInSnap.forEach((slideIndex) => {
          if (isScrollEvent && slidesInView.indexOf(slideIndex) === -1) return;

          if (engine.options.loop) {
            engine.slideLooper.loopPoints.forEach((loopItem) => {
              const target = loopItem.target();
              if (slideIndex === loopItem.index && target !== 0) {
                const sign = Math.sign(target);
                if (sign === -1) diffToTarget = scrollSnap - (1 + scrollProgress);
                if (sign === 1) diffToTarget = scrollSnap + (1 - scrollProgress);
              }
            });
          }

          const translate = diffToTarget * (-1 * tweenFactor) * 100;
          const node = tweenNodes[slideIndex];
          if (node) node.style.transform = 'translateX(' + translate + '%)';
        });
      });
    };

    /* ----- dots + buttons ----- */
    const onSelect = () => {
      const selected = embla.selectedScrollSnap();
      Array.from(dotsEl.children).forEach((dot, i) => {
        dot.classList.toggle('embla__dot--selected', i === selected);
      });
      prevBtn.disabled = !embla.canScrollPrev();
      nextBtn.disabled = !embla.canScrollNext();
    };

    embla.scrollSnapList().forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'embla__dot';
      dot.setAttribute('aria-label', 'Go to project ' + (i + 1));
      dot.addEventListener('click', () => embla.scrollTo(i));
      dotsEl.appendChild(dot);
    });

    prevBtn.addEventListener('click', () => embla.scrollPrev());
    nextBtn.addEventListener('click', () => embla.scrollNext());

    setTweenNodes(embla);
    setTweenFactor(embla);
    tweenParallax(embla, 'init');

    embla.on('reInit', setTweenNodes)
      .on('reInit', setTweenFactor)
      .on('reInit', tweenParallax)
      .on('reInit', onSelect)
      .on('scroll', tweenParallax)
      .on('select', onSelect)
      .on('slideFocus', tweenParallax);

    onSelect();
    return embla;
  }

  document.querySelectorAll('.panel-carousel').forEach((panel) => {
    const embla = setupEmbla(panel);
    if (embla) emblas.set(panel, embla);
  });

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

    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const activeCarousel = emblas.get(panels[activeIndex]);
      if (activeCarousel) {
        e.preventDefault();
        if (e.key === 'ArrowLeft') activeCarousel.scrollPrev();
        else activeCarousel.scrollNext();
        return;
      }
    }

    const map = {
      ' ': next,
      PageDown: next,
      ArrowDown: next,
      PageUp: prev,
      ArrowUp: prev,
      Home: () => goTo(0),
      End: () => goTo(panels.length - 1),
    };
    const fn = map[e.key];
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
})();