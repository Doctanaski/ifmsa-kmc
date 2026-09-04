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

      /* Load committee members */
      if (data.committeeMembers) {
        var track = document.getElementById('sra-members-track');
        if (track) {
          var members = data.committeeMembers.filter(function (m) { return m.committee === 'scora'; });
          if (!members.length) {
            track.innerHTML = '<p class="sra-members-empty">No members added yet.</p>';
          } else {
            track.innerHTML = members.map(function (m) {
              var initials = (m.name || '').split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join('');
              var photo = m.photo
                ? '<img src="' + m.photo.replace(/"/g, '&quot;') + '" alt="Portrait of ' + (m.name || '').replace(/"/g, '&quot;') + '" loading="lazy" decoding="async" />'
                : '<span class="sra-member-initials">' + initials + '</span>';
              return '<article class="sra-member-card">' +
                '<div class="sra-member-photo">' + photo + '</div>' +
                '<h3 class="sra-member-name">' + (m.name || '') + '</h3>' +
                '<p class="sra-member-role">' + (m.role || '') + '</p>' +
                (m.quote ? '<p class="sra-member-quote">&ldquo;' + m.quote + '&rdquo;</p>' : '') +
              '</article>';
            }).join('');
          }
        }
      }
    });
  }

})();
