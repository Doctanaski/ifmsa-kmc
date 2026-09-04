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
        /* Populate Local Officer contact card */
        var nameEl = document.getElementById('sph-officer-name');
        var emailEl = document.getElementById('sph-officer-email');
        if (nameEl && scoph.officer_name) nameEl.textContent = scoph.officer_name;
        if (emailEl && scoph.officer_email) {
          emailEl.textContent = scoph.officer_email;
          emailEl.setAttribute('href', 'mailto:' + scoph.officer_email);
        }

        /* Could populate dynamic content from the scoph committee record */
        var titleEl = document.querySelector('.sph-hero-title');
        if (titleEl && scoph.title) {
          titleEl.textContent = scoph.title;
        }
      }

      /* Load committee members */
      if (data.committeeMembers) {
        var track = document.getElementById('sph-members-track');
        if (track) {
          var members = data.committeeMembers.filter(function (m) { return m.committee === 'scoph'; });
          if (!members.length) {
            track.innerHTML = '<p class="sph-members-empty">No members added yet.</p>';
          } else {
            track.innerHTML = members.map(function (m) {
              var initials = (m.name || '').split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join('');
              var photo = m.photo
                ? '<img src="' + m.photo.replace(/"/g, '&quot;') + '" alt="Portrait of ' + (m.name || '').replace(/"/g, '&quot;') + '" loading="lazy" decoding="async" />'
                : '<span class="sph-member-initials">' + initials + '</span>';
              return '<article class="sph-member-card">' +
                '<div class="sph-member-photo">' + photo + '</div>' +
                '<h3 class="sph-member-name">' + (m.name || '') + '</h3>' +
                '<p class="sph-member-role">' + (m.role || '') + '</p>' +
                (m.quote ? '<p class="sph-member-quote">&ldquo;' + m.quote + '&rdquo;</p>' : '') +
              '</article>';
            }).join('');
          }
        }
      }
    });
  }

})();
