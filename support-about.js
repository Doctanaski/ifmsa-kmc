/* ============================================================
   IFMSA KMC — Support Division About page JavaScript
   • IntersectionObserver scroll reveals
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

  document.querySelectorAll('.spd-reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ─── Load members from Supabase ────────────────────────── */
  if (typeof window.loadSiteData === 'function') {
    window.loadSiteData().then(function (data) {
      if (!data) return;

      /* Populate Head contact card from committee record */
      if (data.committees && data.committees.support) {
        var c = data.committees.support;
        var nameEl = document.getElementById('spd-officer-name');
        var emailEl = document.getElementById('spd-officer-email');
        if (nameEl && c.officer_name) nameEl.textContent = c.officer_name;
        if (emailEl && c.officer_email) {
          emailEl.textContent = c.officer_email;
          emailEl.setAttribute('href', 'mailto:' + c.officer_email);
        }
      }

      if (!data.committeeMembers) return;
      var track = document.getElementById('spd-members-track');
      if (!track) return;
      var members = data.committeeMembers.filter(function (m) { return m.committee === 'support'; });
      if (!members.length) {
        track.innerHTML = '<p class="spd-members-empty">No members added yet.</p>';
        return;
      }
      track.innerHTML = members.map(function (m) {
        var initials = (m.name || '').split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join('');
        var photo = m.photo
          ? '<img src="' + m.photo.replace(/"/g, '&quot;') + '" alt="Portrait of ' + (m.name || '').replace(/"/g, '&quot;') + '" loading="lazy" decoding="async" />'
          : '<span class="spd-member-initials">' + initials + '</span>';
        return '<article class="spd-member-card">' +
          '<div class="spd-member-photo">' + photo + '</div>' +
          '<h3 class="spd-member-name">' + (m.name || '') + '</h3>' +
          '<p class="spd-member-role">' + (m.role || '') + '</p>' +
          (m.quote ? '<p class="spd-member-quote">&ldquo;' + m.quote + '&rdquo;</p>' : '') +
        '</article>';
      }).join('');
    }).catch(function () {});
  }

})();
