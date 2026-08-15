/* ============================================================
   IFMSA · Khyber Medical College — Events Calendar
   Reads the same data as the committee project cards
   (Supabase → falls back to projects-data.js), parses each
   project's timeframe into concrete dates, and renders a
   monthly grid plus executed / upcoming / planned lists.
   ============================================================ */

(function () {
  'use strict';

  var MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];

  var MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
                 jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

  /* matches the STATUS_TAG mapping used by the homepage carousels */
  var STATUS_TAG = {
    'Planned': 'planned',
    'Upcoming': 'upcoming',
    'Applications open': 'executed',
    'Applications closed': 'upcoming',
    'Open': 'executed',
    'Accepting tutors': 'executed',
    'Recruiting': 'executed',
    'Live': 'executed',
    'Beta': 'executed',
    'On hold': 'planned',
    'Completed': 'executed',
    'Cancelled': 'planned'
  };

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var allEvents = [];
  var filterCommittee = 'all';
  var viewYear = today.getFullYear();
  var viewMonth = today.getMonth();

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function monthIndex(abbr) {
    return MONTHS[String(abbr || '').toLowerCase().slice(0, 3)];
  }

  function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  /* ---------- timeframe → concrete anchor dates ---------- */
  function anchorsFor(tf, year) {
    var t = String(tf || '').trim();
    var out = [];
    var m, y;
    if (!t) return out;

    /* All year / Ongoing / Monthly → first of every month in the site year */
    if (/all year/i.test(t) || /ongoing/i.test(t) || /monthly/i.test(t)) {
      for (var i = 0; i < 12; i++) out.push(new Date(year, i, 1));
      return out;
    }

    /* range "May – Aug 2026" */
    m = t.match(/^([A-Za-z]{3,9})\s*(?:\u2013|\u2014|-)\s*([A-Za-z]{3,9})\s+(\d{4})$/);
    if (m) {
      y = +m[3];
      out.push(new Date(y, monthIndex(m[1]), 1));
      out.push(new Date(y, monthIndex(m[2]), 1));
      return out;
    }

    /* ampersand range "Apr & Nov 2026" */
    m = t.match(/^([A-Za-z]{3,9})\s*&\s*([A-Za-z]{3,9})\s+(\d{4})$/);
    if (m) {
      y = +m[3];
      out.push(new Date(y, monthIndex(m[1]), 1));
      out.push(new Date(y, monthIndex(m[2]), 1));
      return out;
    }

    /* single day "21 Oct 2026" */
    m = t.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{4})$/);
    if (m) {
      out.push(new Date(+m[3], monthIndex(m[2]), +m[1]));
      return out;
    }

    /* month only "Mar 2026" */
    m = t.match(/^([A-Za-z]{3,9})\s+(\d{4})$/);
    if (m) {
      out.push(new Date(+m[2], monthIndex(m[1]), 1));
      return out;
    }

    /* year only "2027" */
    m = t.match(/^(\d{4})$/);
    if (m) {
      out.push(new Date(+m[1], 0, 1));
      return out;
    }

    return out;
  }

  /* ---------- flatten projects into dated events ---------- */
  function buildEvents(data) {
    var committees = data.committees || {};
    var projects = data.projects || [];
    var siteYear = parseInt(data.year, 10);
    if (!siteYear || isNaN(siteYear)) siteYear = today.getFullYear();

    var events = [];

    projects.forEach(function (p) {
      var com = committees[p.committee] || {};
      var tag = STATUS_TAG[p.status] || 'planned';
      var anchors = anchorsFor(p.timeframe, siteYear);
      if (!anchors.length) return;

      var earliest = anchors.reduce(function (a, b) { return b < a ? b : a; });

      anchors.forEach(function (d) {
        var chipStatus = tag === 'planned'
          ? 'planned'
          : (d < today ? 'executed' : 'upcoming');

        events.push({
          id: p.id,
          title: p.title,
          committee: p.committee,
          acronym: com.acronym || String(p.committee || '').toUpperCase(),
          color: com.accent || com.color || '#58a6ff',
          date: d,
          status: chipStatus,   /* colour used on the grid chip */
          group: tag,           /* grouping used in the lists */
          timeframe: p.timeframe,
          repDate: earliest
        });
      });
    });

    return events;
  }

  /* ---------- calendar grid ---------- */
  function chipHtml(e) {
    return '<a class="cal-chip cal-chip--' + e.status + '" style="--chip-c:' + esc(e.color) + '"' +
      ' href="projects.html?id=' + encodeURIComponent(e.id) + '" title="' + esc(e.title) + '">' +
      '<span class="cal-chip-dot"></span>' +
      '<span class="cal-chip-name">' + esc(e.title) + '</span>' +
      '</a>';
  }

  function renderGrid() {
    var daysEl = document.getElementById('cal-days');
    var first = new Date(viewYear, viewMonth, 1);
    var startDay = (first.getDay() + 6) % 7;            /* Monday-first */
    var daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    var cells = [];
    var d, i, date, isToday, dayEvents, chips, more, moreHtml;

    for (i = 0; i < startDay; i++) {
      cells.push('<div class="cal-cell cal-cell-empty"></div>');
    }

    for (d = 1; d <= daysInMonth; d++) {
      date = new Date(viewYear, viewMonth, d);
      isToday = sameDay(date, today);
      dayEvents = allEvents.filter(function (e) {
        return sameDay(e.date, date) &&
          (filterCommittee === 'all' || e.committee === filterCommittee);
      });

      chips = dayEvents.slice(0, 3).map(chipHtml).join('');
      more = dayEvents.length - 3;
      moreHtml = more > 0 ? '<span class="cal-more">+' + more + ' more</span>' : '';

      cells.push(
        '<div class="cal-cell' + (isToday ? ' is-today' : '') + '" data-day="' + date.getTime() + '">' +
          '<span class="cal-date">' + d + '</span>' +
          '<div class="cal-chips">' + chips + moreHtml + '</div>' +
        '</div>'
      );
    }

    while (cells.length % 7 !== 0) {
      cells.push('<div class="cal-cell cal-cell-empty"></div>');
    }

    daysEl.innerHTML = cells.join('');
    document.getElementById('cal-month-label').textContent =
      MONTH_NAMES[viewMonth] + ' ' + viewYear;
  }

  /* ---------- side panel: executed / upcoming / planned ---------- */
  function renderPanel() {
    var panel = document.getElementById('cal-panel');
    var groups = { executed: [], upcoming: [], planned: [] };
    var seen = {};

    allEvents.forEach(function (e) {
      if (filterCommittee !== 'all' && e.committee !== filterCommittee) return;
      var key = e.id + '|' + e.group;
      if (seen[key]) return;
      seen[key] = true;
      groups[e.group].push(e);
    });

    ['executed', 'upcoming', 'planned'].forEach(function (g) {
      groups[g].sort(function (a, b) {
        return g === 'executed'
          ? b.repDate - a.repDate
          : a.repDate - b.repDate;
      });
    });

    var statIds = {
      executed: 'cal-stat-executed',
      upcoming: 'cal-stat-upcoming',
      planned: 'cal-stat-planned'
    };
    ['executed', 'upcoming', 'planned'].forEach(function (g) {
      var el = document.getElementById(statIds[g]);
      if (el) el.textContent = groups[g].length;
    });

    var labels = { executed: 'Executed', upcoming: 'Upcoming', planned: 'Planned' };
    var html = ['executed', 'upcoming', 'planned'].map(function (g) {
      var items = groups[g];
      var rows = items.map(function (e) {
        return '<li class="cal-ev">' +
          '<a class="cal-ev-link" href="projects.html?id=' + encodeURIComponent(e.id) + '">' +
            '<span class="cal-ev-dot" style="background:' + esc(e.color) + '"></span>' +
            '<span class="cal-ev-main">' +
              '<span class="cal-ev-title">' + esc(e.title) + '</span>' +
              '<span class="cal-ev-meta">' + esc(e.acronym) + ' &middot; ' + esc(e.timeframe || '') + '</span>' +
            '</span>' +
            '<span class="cal-ev-arrow">&#8594;</span>' +
          '</a>' +
        '</li>';
      }).join('');

      var body = rows
        ? '<ul class="cal-ev-list">' + rows + '</ul>'
        : '<div class="cal-empty">No ' + labels[g].toLowerCase() + ' projects yet.</div>';

      return '<section class="cal-panel-section cal-panel-section--' + g + '">' +
        '<h4><i aria-hidden="true"></i> ' + labels[g] +
        ' <span>' + items.length + '</span></h4>' + body +
        '</section>';
    }).join('');

    panel.innerHTML = html;
  }

  /* ---------- committee filter chips ---------- */
  function renderCommittees(data) {
    var wrap = document.getElementById('cal-committees');
    var committees = data.committees || {};
    var html = '<button class="cal-com-chip is-active" data-committee="all" type="button">All</button>';

    Object.keys(committees).forEach(function (slug) {
      var c = committees[slug];
      html += '<button class="cal-com-chip" data-committee="' + esc(slug) + '" type="button">' +
        esc(c.acronym || String(slug).toUpperCase()) + '</button>';
    });

    wrap.innerHTML = html;
    wrap.querySelectorAll('.cal-com-chip').forEach(function (btn) {
      btn.addEventListener('click', function () {
        filterCommittee = btn.dataset.committee;
        wrap.querySelectorAll('.cal-com-chip').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
        });
        renderGrid();
        renderPanel();
      });
    });
  }

  /* ---------- interactions ---------- */
  function initGrid() {
    var daysEl = document.getElementById('cal-days');
    daysEl.addEventListener('click', function (e) {
      if (e.target.closest('.cal-chip')) return;   /* anchor handles it */
      var cell = e.target.closest('.cal-cell');
      if (!cell || cell.classList.contains('cal-cell-empty')) return;
      var wasSelected = cell.classList.contains('is-selected');
      daysEl.querySelectorAll('.cal-cell.is-selected').forEach(function (c) {
        c.classList.remove('is-selected');
      });
      if (!wasSelected) cell.classList.add('is-selected');
    });
  }

  function initNav() {
    document.getElementById('cal-prev').addEventListener('click', function () {
      var m = viewMonth - 1;
      var y = viewYear;
      if (m < 0) { m = 11; y -= 1; }
      viewYear = y; viewMonth = m;
      renderGrid();
    });
    document.getElementById('cal-next').addEventListener('click', function () {
      var m = viewMonth + 1;
      var y = viewYear;
      if (m > 11) { m = 0; y += 1; }
      viewYear = y; viewMonth = m;
      renderGrid();
    });
    document.getElementById('cal-today').addEventListener('click', function () {
      viewYear = today.getFullYear();
      viewMonth = today.getMonth();
      renderGrid();
    });
  }

  /* ---------- init ---------- */
  window.loadSiteData().then(function (data) {
    window.applySiteSettings(data);
    allEvents = buildEvents(data);
    renderCommittees(data);
    initNav();
    initGrid();
    renderGrid();
    renderPanel();
  });
})();
