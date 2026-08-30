/* ============================================================
   IFMSA KMC — SCOPH About page JavaScript
   • IntersectionObserver for scroll reveals
   • Smooth scroll for hero CTA
   • Supabase data loading
   ============================================================ */

(function () {
  'use strict';

  /* ─── Generic reveal observer ───────────────────────────── */
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

  document.querySelectorAll('.sph-reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ─── Smooth scroll for hero CTA ───────────────────────── */
  var heroCta = document.getElementById('sph-scroll-cta');
  if (heroCta) {
    heroCta.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('what-we-do');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* ─── Load Supabase data ────────────────────────────────── */
  if (typeof window.loadSiteData === 'function') {
    window.loadSiteData().then(function (data) {
      if (!data) return;

      /* Apply site-wide settings if the helper is available */
      if (typeof window.applySiteSettings === 'function') {
        window.applySiteSettings(data);
      }

      /* SCOPH committee-specific data (if available) */
      var scoph = data.committees && data.committees.scoph;
      if (scoph) {
        /* Could populate dynamic content from the scoph committee record */
        var titleEl = document.querySelector('.sph-hero-title');
        if (titleEl && scoph.title) {
          titleEl.textContent = scoph.title;
        }
      }
    });
  }

})();
