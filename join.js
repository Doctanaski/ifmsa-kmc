/* ============================================================
   IFMSA KMC — Join Us page JavaScript
   • Scroll-driven line fill (% height of .jn-line-fill)
   • IntersectionObserver activates each step card
   • FAQ accordion toggle
   ============================================================ */

(function () {
  'use strict';

  /* ─── Line fill on scroll ──────────────────────────────── */
  const timeline  = document.getElementById('jn-timeline');
  const lineFill  = document.getElementById('jn-line-fill');
  const steps     = Array.from(document.querySelectorAll('.jn-step'));

  function updateLineFill () {
    if (!timeline || !lineFill) return;

    const rect       = timeline.getBoundingClientRect();
    const winH       = window.innerHeight;
    const trackH     = rect.height;

    // How far has the user scrolled into the timeline?
    // 0 = top of timeline at bottom of screen
    // 1 = bottom of timeline at top of screen
    const scrolled   = (winH - rect.top) / (winH + trackH);
    const clamped    = Math.max(0, Math.min(1, scrolled));

    // Convert to a percentage with a bit of look-ahead so the line
    // feels like it "arrives" at the next step slightly ahead of view.
    const pct = Math.round(clamped * 100);
    lineFill.style.height = pct + '%';
  }

  /* ─── IntersectionObserver for step entry animation ──── */
  const stepObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          // Once visible, no need to keep watching
          stepObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25 }
  );

  steps.forEach((step) => stepObserver.observe(step));

  /* ─── Scroll listener (throttled with rAF) ───────────── */
  let ticking = false;

  function onScroll () {
    if (!ticking) {
      window.requestAnimationFrame(() => {
        updateLineFill();
        ticking = false;
      });
      ticking = true;
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  updateLineFill(); // run once on load

  /* ─── Smooth scroll for hero CTA ─────────────────────── */
  const heroCta = document.getElementById('jn-scroll-cta');
  if (heroCta) {
    heroCta.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('steps');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* ─── FAQ accordion ──────────────────────────────────── */
  const faqBtns = Array.from(document.querySelectorAll('.jn-faq-q'));

  faqBtns.forEach((btn) => {
    const panelId = btn.getAttribute('aria-controls');
    const panel   = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;

    btn.addEventListener('click', () => {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';

      // Close all others
      faqBtns.forEach((b) => {
        if (b === btn) return;
        b.setAttribute('aria-expanded', 'false');
        const pId = b.getAttribute('aria-controls');
        const p   = pId ? document.getElementById(pId) : null;
        if (p) p.setAttribute('hidden', '');
      });

      // Toggle this one
      if (isOpen) {
        btn.setAttribute('aria-expanded', 'false');
        panel.setAttribute('hidden', '');
      } else {
        btn.setAttribute('aria-expanded', 'true');
        panel.removeAttribute('hidden');
      }
    });
  });

})();
