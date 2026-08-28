/* ============================================================
   IFMSA · Khyber Medical College — Meet the Executive Board.
   Renders the board as a full-viewport scroll-snap gallery —
   one member per slide with a portrait (photo or initials
   placeholder), their role underneath, and a quote beside it
   that alternates left / right.

   Member content is loaded from the site data (Supabase → falls
   back to projects-data.js).  Edit members from the admin panel;
   the bundled list here is only a safe default.
   ============================================================ */

(function () {
  'use strict';

  var stage = document.getElementById('ex-stage');
  var track = document.getElementById('ex-track');
  var rail = document.getElementById('ex-rail');
  var countEl = document.getElementById('ex-count');

  var EXEC = [];

  var pad = function (n) { return n < 10 ? '0' + n : String(n); };

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  var initials = function (name) {
    return String(name || '').split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase(); })
      .slice(0, 2).join('');
  };

  /* focal point stored by the admin framing tool as #fp=x,y on the URL */
  var posAttr = function (url) {
    var m = String(url || '').match(/#fp=([\d.]+),([\d.]+)/);
    return m ? ' style="object-position:' + m[1] + '% ' + m[2] + '%"' : '';
  };

  function slideHtml(m, i) {
    var photo = m.photo
      ? '<div class="ex-photo"><img src="' + esc(m.photo) + '" alt="Portrait of ' + esc(m.name) + '"' + posAttr(m.photo) + ' loading="lazy" decoding="async" /></div>'
      : '<div class="ex-photo ex-photo--avatar"><span class="ex-avatar">' + esc(initials(m.name)) + '</span></div>';

    return (
      '<section class="ex-slide' + (i % 2 ? ' is-flip' : '') + '" data-index="' + i + '">' +
        '<div class="ex-slide-num" aria-hidden="true">' + pad(i + 1) + '</div>' +
        '<div class="ex-slide-inner">' +
          '<div class="ex-quote">' +
            '<span class="ex-quote-mark" aria-hidden="true">&ldquo;</span>' +
            '<blockquote class="ex-quote-text">' + esc(m.quote) + '</blockquote>' +
            '<p class="ex-quote-attr">' + esc(m.role) + ' &middot; KMC &times; IFMSA</p>' +
          '</div>' +
          '<figure class="ex-photo-block">' +
            photo +
            '<figcaption class="ex-photo-cap">' +
              '<span class="ex-photo-name">' + esc(m.name) + '</span>' +
              '<span class="ex-photo-role">' + esc(m.role) + '</span>' +
            '</figcaption>' +
          '</figure>' +
        '</div>' +
      '</section>'
    );
  }

  function render() {
    track.innerHTML = EXEC.map(slideHtml).join('');

    rail.innerHTML = EXEC.map(function (m, i) {
      return '<button type="button" class="ex-rail-dot" data-index="' + i +
        '" aria-label="Jump to ' + esc(m.name) + '"></button>';
    }).join('');

    countEl.textContent = '01 / ' + pad(EXEC.length);

    rail.querySelectorAll('.ex-rail-dot').forEach(function (dot) {
      dot.addEventListener('click', function () {
        goTo(+dot.dataset.index);
      });
    });
  }

  function current() {
    var h = stage.clientHeight || 1;
    return Math.max(0, Math.min(EXEC.length - 1, Math.round(stage.scrollTop / h)));
  }

  function refresh() {
    var i = current();
    countEl.textContent = pad(i + 1) + ' / ' + pad(EXEC.length);

    rail.querySelectorAll('.ex-rail-dot').forEach(function (dot) {
      dot.classList.toggle('is-active', +dot.dataset.index === i);
    });
  }

  function goTo(i) {
    i = Math.max(0, Math.min(EXEC.length - 1, i));
    var r = stage.getBoundingClientRect();
    var onScreen = r.top < window.innerHeight && r.bottom > 0;
    if (onScreen) {
      stage.scrollTo({ top: i * stage.clientHeight, behavior: 'smooth' });
      refresh();
      return;
    }
    var board = document.getElementById('board');
    if (board) board.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(function () {
      stage.scrollTo({ top: i * stage.clientHeight, behavior: 'smooth' });
      refresh();
    }, 200);
  }

  stage.addEventListener('scroll', function () {
    refresh();
  }, { passive: true });

  window.addEventListener('resize', refresh);

  function start() {
    render();
    refresh();
  }

  if (window.loadSiteData) {
    window.loadSiteData().then(function (data) {
      var list = (data.execBoard && data.execBoard.length) ? data.execBoard : [];
      EXEC = list.slice();
      start();
    }).catch(function () {
      EXEC = [];
      start();
    });
  } else {
    start();
  }
})();