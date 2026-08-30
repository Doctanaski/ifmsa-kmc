/* ============================================================
   IFMSA KMC — SCORA About page JavaScript
   • IntersectionObserver reveals
   • Smooth scroll for hero CTA
   • Supabase data loading (pulls SCORA committee details)
   ============================================================ */

(function () {
  'use strict';

  /* ─── IntersectionObserver for reveal elements ─────────── */
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

  document.querySelectorAll('.sra-reveal').forEach((el) => {
    revealObserver.observe(el);
  });

  /* ─── Smooth scroll for hero CTA ───────────────────────── */
  const heroCta = document.getElementById('sra-scroll-cta');
  if (heroCta) {
    heroCta.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('what-we-do');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* ─── Supabase data loading ────────────────────────────── */
  if (typeof window.loadSiteData === 'function') {
    window.loadSiteData().then(function (data) {
      if (!data) return;

      // If committee data contains SCORA info, we could populate
      // dynamic fields here in the future
      if (data.committees && data.committees.scora) {
        var scora = data.committees.scora;
        // Example: update hero text from Supabase if stored
        // setText('sra-hero-title', scora.title);
      }

      // Apply site-wide settings (footer, etc.)
      if (typeof window.applySiteSettings === 'function') {
        window.applySiteSettings(data);
      }
    });
  }

})();
