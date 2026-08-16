/* ============================================================
   IFMSA · Khyber Medical College — Meet the Executive Board.
   Renders the board as a full-viewport scroll-snap gallery —
   one member per slide with a portrait (photo or initials
   placeholder), their role underneath, and a quote beside it
   that alternates left / right.

   Member content edit lives here (names, roles, quotes, photo
   URLs).  Add a member by appending an object to EXEC.
   ============================================================ */

(function () {
  'use strict';

  var EXEC = [
    {
      name: "Ahmad Raza",
      role: "President",
      photo: "",
      quote: "A local council works when every member feels they built it. My job is to make sure no one here is just watching."
    },
    {
      name: "Fatima Noor",
      role: "Vice-President",
      photo: "",
      quote: "I joined IFMSA for one project and stayed for the people. Everything on this board starts with saying yes to a student somewhere."
    },
    {
      name: "Hamza Malik",
      role: "Secretary General",
      photo: "",
      quote: "Behind every great event is paperwork no one sees. I keep the council honest, organised, and always one step ahead."
    },
    {
      name: "Zainab Akhtar",
      role: "Treasurer & Finance Officer",
      photo: "",
      quote: "Good ideas deserve good budgets. I make sure every rupee we raise goes back into projects our members actually feel."
    },
    {
      name: "Bilal Shah",
      role: "Local Officer — SCOPE",
      photo: "",
      quote: "Exchanges taught me that medicine is a conversation, not a classroom. I want every KMC student to have a seat in it."
    },
    {
      name: "Ayesha Kanwal",
      role: "Local Officer — SCOME",
      photo: "",
      quote: "We learn medicine best when we teach each other. SCOME is where the lecture hall becomes the classroom."
    },
    {
      name: "Usman Tariq",
      role: "Local Officer — SCORA",
      photo: "",
      quote: "Health is a right, including sexual and reproductive health. Advocacy here starts with honest conversations on campus."
    },
    {
      name: "Mahnoor Khan",
      role: "Local Officer — SCOPH",
      photo: "",
      quote: "Public health is the silent backbone of good medicine. Our campaigns turn knowledge into care for the people around us."
    },
    {
      name: "Hassan Qureshi",
      role: "Local Officer — SCORP",
      photo: "",
      quote: "Human rights and peace are not sidelines in health — they are its foundation. We stand where patients cannot."
    },
    {
      name: "Iqra Yousaf",
      role: "Local Officer — SCORE",
      photo: "",
      quote: "Research is how medicine grows. SCORE is how students get their first taste of asking a question worth answering."
    }
  ];

  var stage = document.getElementById('ex-stage');
  var track = document.getElementById('ex-track');
  var rail = document.getElementById('ex-rail');
  var countEl = document.getElementById('ex-count');

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

  function slideHtml(m, i) {
    var photo = m.photo
      ? '<div class="ex-photo"><img src="' + esc(m.photo) + '" alt="Portrait of ' + esc(m.name) + '" loading="lazy" decoding="async" /></div>'
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

  render();
  refresh();
})();