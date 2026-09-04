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

        /* Populate Local Officer contact card */
        var nameEl = document.getElementById('srp-officer-name');
        var emailEl = document.getElementById('srp-officer-email');
        if (nameEl && sc.officer_name) nameEl.textContent = sc.officer_name;
        if (emailEl && sc.officer_email) {
          emailEl.textContent = sc.officer_email;
          emailEl.setAttribute('href', 'mailto:' + sc.officer_email);
        }
      }

      /* Load committee members */
      if (data.committeeMembers) {
        var track = document.getElementById('srp-members-track');
        if (track) {
          var members = data.committeeMembers.filter(function (m) { return m.committee === 'scorp'; });
          if (!members.length) {
            track.innerHTML = '<p class="srp-members-empty">No members added yet.</p>';
          } else {
            track.innerHTML = members.map(function (m) {
              var initials = (m.name || '').split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join('');
              var photo = m.photo
                ? '<img src="' + m.photo.replace(/"/g, '&quot;') + '" alt="Portrait of ' + (m.name || '').replace(/"/g, '&quot;') + '" loading="lazy" decoding="async" />'
                : '<span class="srp-member-initials">' + initials + '</span>';
              return '<article class="srp-member-card">' +
                '<div class="srp-member-photo">' + photo + '</div>' +
                '<h3 class="srp-member-name">' + (m.name || '') + '</h3>' +
                '<p class="srp-member-role">' + (m.role || '') + '</p>' +
                (m.quote ? '<p class="srp-member-quote">&ldquo;' + m.quote + '&rdquo;</p>' : '') +
              '</article>';
            }).join('');
          }
        }
      }
    }).catch(function () {
      /* Supabase unavailable — static content remains */
    });
  }

})();
