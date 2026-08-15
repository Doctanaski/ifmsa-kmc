/* ============================================================
   IFMSA KMC — About Us page JavaScript
   • Scroll-driven line fill (% height of .ab-line-fill)
   • IntersectionObserver reveals milestones + generic blocks
   ============================================================ */

(function () {
  'use strict';

  /* ─── Line fill on scroll ──────────────────────────────── */
  const milestones = document.getElementById('ab-milestones');
  const lineFill   = document.getElementById('ab-line-fill');

  function updateLineFill () {
    if (!milestones || !lineFill) return;

    const rect   = milestones.getBoundingClientRect();
    const winH   = window.innerHeight;
    const trackH = rect.height;

    const scrolled = (winH - rect.top) / (winH + trackH);
    const clamped  = Math.max(0, Math.min(1, scrolled));
    const pct      = Math.round(clamped * 100);
    lineFill.style.height = pct + '%';
  }

  /* ─── IntersectionObserver for timeline milestones ─────── */
  const milestoneObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          milestoneObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25 }
  );

  document.querySelectorAll('.ab-milestone').forEach((m) => milestoneObserver.observe(m));

  /* ─── Generic reveal for council cards / objectives ────── */
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.ab-reveal').forEach((el) => revealObserver.observe(el));

  /* ─── Scroll listener (throttled with rAF) ─────────────── */
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

  /* ─── Smooth scroll for hero CTA ───────────────────────── */
  const heroCta = document.getElementById('ab-scroll-cta');
  if (heroCta) {
    heroCta.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('history');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

})();
