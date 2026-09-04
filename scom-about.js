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

      /* Populate Local Officer contact card from committee record */
      if (siteData && siteData.committees && siteData.committees.scom) {
        var c = siteData.committees.scom;
        var nameEl = document.getElementById('sme-officer-name');
        var emailEl = document.getElementById('sme-officer-email');
        if (nameEl && c.officer_name) nameEl.textContent = c.officer_name;
        if (emailEl && c.officer_email) {
          emailEl.textContent = c.officer_email;
          emailEl.setAttribute('href', 'mailto:' + c.officer_email);
        }
      }

      /* Load committee members */
      if (siteData && siteData.committeeMembers) {
        var track = document.getElementById('sme-members-track');
        if (track) {
          var members = siteData.committeeMembers.filter(function (m) { return m.committee === 'scom'; });
          if (!members.length) {
            track.innerHTML = '<p class="sme-members-empty">No members added yet.</p>';
          } else {
            track.innerHTML = members.map(function (m) {
              var initials = (m.name || '').split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join('');
              var photo = m.photo
                ? '<img src="' + m.photo.replace(/"/g, '&quot;') + '" alt="Portrait of ' + (m.name || '').replace(/"/g, '&quot;') + '" loading="lazy" decoding="async" />'
                : '<span class="sme-member-initials">' + initials + '</span>';
              return '<article class="sme-member-card">' +
                '<div class="sme-member-photo">' + photo + '</div>' +
                '<h3 class="sme-member-name">' + (m.name || '') + '</h3>' +
                '<p class="sme-member-role">' + (m.role || '') + '</p>' +
                (m.quote ? '<p class="sme-member-quote">&ldquo;' + m.quote + '&rdquo;</p>' : '') +
              '</article>';
            }).join('');
          }
        }
      }
    });
  }

})();
