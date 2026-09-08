/* ============================================================
   IFMSA KMC — Project Hope About page JavaScript
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

  document.querySelectorAll('.hp-reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ─── Smooth scroll for hero CTA ───────────────────────── */
  var heroCta = document.getElementById('hp-scroll-cta');
  if (heroCta) {
    heroCta.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('our-story');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* ─── Populate contact from SCORP committee data ────────── */
  if (typeof window.loadSiteData === 'function') {
    window.loadSiteData().then(function (data) {
      if (!data) return;

      if (data.committees && data.committees.scorp) {
        var c = data.committees.scorp;
        var nameEl = document.getElementById('hp-officer-name');
        var emailEl = document.getElementById('hp-officer-email');
        if (nameEl && c.officer_name) nameEl.textContent = c.officer_name;
        if (emailEl && c.officer_email) {
          emailEl.textContent = c.officer_email;
          emailEl.setAttribute('href', 'mailto:' + c.officer_email);
        }
        var avatarImg = document.querySelector('.hp-contact-avatar-img');
        if (avatarImg && c.officer_photo) {
          avatarImg.src = c.officer_photo;
          avatarImg.alt = (c.officer_name || 'Project Hope Lead') + ' photo';
          avatarImg.style.display = 'block';
          var svg = avatarImg.parentElement.querySelector('svg');
          if (svg) svg.style.display = 'none';
        }
      }
    }).catch(function () {});
  }

})();
