/* ============================================================
   IFMSA KMC — SCORE About page scripts
   IntersectionObserver, smooth scroll, Supabase data loading
   ============================================================ */

(function () {
  'use strict';

  /* ---------- IntersectionObserver: scroll-reveal ---------- */
  function initReveal() {
    var els = document.querySelectorAll('.sre-reveal');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      for (var i = 0; i < els.length; i++) els[i].classList.add('is-visible');
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    els.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- smooth scroll for anchor CTA ---------- */
  function initSmoothScroll() {
    var cta = document.getElementById('sre-scroll-cta');
    if (!cta) return;
    cta.addEventListener('click', function (e) {
      var href = cta.getAttribute('href');
      if (href && href.charAt(0) === '#') {
        e.preventDefault();
        var target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  }

  /* ---------- Supabase data loading ---------- */
  function initSupabase() {
    if (typeof window.loadSiteData !== 'function') return;

    window.loadSiteData().then(function (data) {
      if (!data) return;

      if (data.site) {
        var s = data.site;
        if (s.footer1) {
          var f1 = document.querySelector('.sre-footer p:first-child');
          if (f1) f1.textContent = s.footer1;
        }
        if (s.footer2) {
          var f2 = document.querySelector('.sre-footer p:last-child');
          if (f2) f2.textContent = s.footer2;
        }
      }

      if (data.committees) {
        var score = data.committees.score || data.committees['score'] || null;
        if (score) {
          if (score.name) {
            var pill = document.querySelector('.sre-eyebrow-rest');
            if (pill) pill.textContent = score.name;
          }
          if (score.title) {
            var title = document.getElementById('sre-hero-title');
            if (title) title.textContent = score.title;
          }
          if (score.description) {
            var sub = document.querySelector('.sre-hero-sub');
            if (sub) sub.textContent = score.description;
          }
          if (score.img) {
            var avatar = document.querySelector('.sre-contact-avatar img');
            if (avatar) {
              avatar.src = score.img;
              avatar.alt = (score.name || 'SCORE') + ' logo';
            }
          }
        }
      }

      /* Load committee members */
      if (data.committeeMembers) {
        var track = document.getElementById('sre-members-track');
        if (track) {
          var members = data.committeeMembers.filter(function (m) { return m.committee === 'score'; });
          if (!members.length) {
            track.innerHTML = '<p class="sre-members-empty">No members added yet.</p>';
          } else {
            track.innerHTML = members.map(function (m) {
              var initials = (m.name || '').split(/\s+/).filter(Boolean).map(function (w) { return w.charAt(0).toUpperCase(); }).slice(0, 2).join('');
              var photo = m.photo
                ? '<img src="' + m.photo.replace(/"/g, '&quot;') + '" alt="Portrait of ' + (m.name || '').replace(/"/g, '&quot;') + '" loading="lazy" decoding="async" />'
                : '<span class="sre-member-initials">' + initials + '</span>';
              return '<article class="sre-member-card">' +
                '<div class="sre-member-photo">' + photo + '</div>' +
                '<h3 class="sre-member-name">' + (m.name || '') + '</h3>' +
                '<p class="sre-member-role">' + (m.role || '') + '</p>' +
                (m.quote ? '<p class="sre-member-quote">&ldquo;' + m.quote + '&rdquo;</p>' : '') +
              '</article>';
            }).join('');
          }
        }
      }
    });
  }

  /* ---------- boot ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    initReveal();
    initSmoothScroll();
    initSupabase();
  });
})();
