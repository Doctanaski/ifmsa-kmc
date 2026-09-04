/* ============================================================
   IFMSA KMC — SCOPE About page JavaScript
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

  document.querySelectorAll('.scp-reveal').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* ─── Smooth scroll for hero CTA ───────────────────────── */
  var heroCta = document.getElementById('scp-scroll-cta');
  if (heroCta) {
    heroCta.addEventListener('click', function (e) {
      e.preventDefault();
      var target = document.getElementById('what-we-do');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* ─── Load members from Supabase ────────────────────────── */
  if (typeof window.loadSiteData === 'function') {
    window.loadSiteData().then(function (data) {
      if (!data) return;

      /* Populate Local Officer contact card from committee record */
      if (data.committees && data.committees.scope) {
        var c = data.committees.scope;
        var nameEl = document.getElementById('scp-officer-name');
        var emailEl = document.getElementById('scp-officer-email');
        if (nameEl && c.officer_name) nameEl.textContent = c.officer_name;
        if (emailEl && c.officer_email) {
          emailEl.textContent = c.officer_email;
          emailEl.setAttribute('href', 'mailto:' + c.officer_email);
        }
      }

      if (!data.committeeMembers) return;
      var track = document.getElementById('scp-members-track');
      if (!track) return;
      var members = data.committeeMembers.filter(function (m) { return m.committee === 'scope'; });
      if (!members.length) {
        track.innerHTML = '<p class="scp-members-empty">No members added yet.</p>';
        return;
      }
      track.innerHTML = members.map(function (m) {
        var initials = (m.name || '').split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join('');
        var photo = m.photo
          ? '<img src="' + m.photo.replace(/"/g, '&quot;') + '" alt="Portrait of ' + (m.name || '').replace(/"/g, '&quot;') + '" loading="lazy" decoding="async" />'
          : '<span class="scp-member-initials">' + initials + '</span>';
        return '<article class="scp-member-card">' +
          '<div class="scp-member-photo">' + photo + '</div>' +
          '<h3 class="scp-member-name">' + (m.name || '') + '</h3>' +
          '<p class="scp-member-role">' + (m.role || '') + '</p>' +
          (m.quote ? '<p class="scp-member-quote">&ldquo;' + m.quote + '&rdquo;</p>' : '') +
        '</article>';
      }).join('');
    }).catch(function () {});
  }

})();
