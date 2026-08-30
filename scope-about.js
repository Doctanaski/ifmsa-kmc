/* ============================================================
   IFMSA KMC — SCOPE About page JavaScript
   • IntersectionObserver scroll reveals
   • Smooth scroll for hero CTA
   ============================================================ */

(function () {
  'use strict';

  /* ─── Load data from Supabase ───────────────────────────── */
  if (typeof window.loadSiteData === 'function') {
    window.loadSiteData().catch(function () {});
  }

  /* ─── IntersectionObserver for scroll reveals ───────────── */
  var revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.scp-reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ─── Smooth scroll for hero CTA ───────────────────────── */
  var heroCta = document.getElementById('scp-scroll-cta');
  if (heroCta) {
    heroCta.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('what-we-do');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

})();
