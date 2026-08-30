/* ============================================================
   IFMSA KMC — SCOME About page JavaScript
   • IntersectionObserver reveals
   • Smooth scroll for hero CTA
   • Data loading from Supabase via data.js
   ============================================================ */

(function () {
  'use strict';

  /* ─── IntersectionObserver for scroll reveals ──────────── */
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

  document.querySelectorAll('.sme-reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ─── Smooth scroll for hero CTA ───────────────────────── */
  var heroCta = document.getElementById('sme-scroll-cta');
  if (heroCta) {
    heroCta.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('what-we-do');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* ─── Load data from Supabase ──────────────────────────── */
  if (typeof window.loadSiteData === 'function') {
    window.loadSiteData().then(function (siteData) {
      if (typeof window.applySiteSettings === 'function') {
        window.applySiteSettings(siteData);
      }
    });
  }

})();
