/* ============================================================
   IFMSA KMC — SCORP About page JavaScript
   • IntersectionObserver reveals for .srp-reveal elements
   • Smooth scroll for hero CTA
   • Supabase data loading via data.js
   ============================================================ */

(function () {
  'use strict';

  /* ─── IntersectionObserver for reveal blocks ───────────── */
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

  document.querySelectorAll('.srp-reveal').forEach((el) => revealObserver.observe(el));

  /* ─── Smooth scroll for hero CTA ───────────────────────── */
  const heroCta = document.getElementById('srp-scroll-cta');
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
      if (data.committees && data.committees.scorp) {
        var sc = data.committees.scorp;
        if (sc.name) {
          var eyebrowRest = document.querySelector('.srp-eyebrow-rest');
          if (eyebrowRest) eyebrowRest.textContent = sc.name;
        }
      }
    }).catch(function () {
      /* Supabase unavailable — static content remains */
    });
  }

})();
