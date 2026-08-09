/* ============================================================
   IFMSA · Khyber Medical College
   Project detail page. Reads ?id= from the URL, looks it up in
   IFMSA_DATA and renders the full project page.
   ============================================================ */

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const data = window.IFMSA_DATA;
  const page = document.getElementById('proj-page');
  const back = document.getElementById('proj-back');

  if (!page || !data) return;

  const project = (data.projects || []).find((p) => p.id === id);

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const renderProject = (p) => {
    const com = data.committees[p.committee] || {};
    const color = com.accent || com.color || 'var(--accent)';
    const goals = (p.goals || []).map((g) => '<li>' + esc(g) + '</li>').join('');
    const paras = (p.about || []).map((t) => '<p>' + esc(t) + '</p>').join('');

    document.title = p.title + ' · KMC × IFMSA';
    if (back) {
      back.href = 'index.html#' + (com.slug || 'scope');
      back.textContent = '← Back to ' + com.name;
    }

    page.style.setProperty('--proj-accent', color);

    page.innerHTML =
      '<div class="proj-hero">' +
        '<div class="proj-column">' +
          '<span class="slide-no">' + (com.slug ? com.slug.toUpperCase() : '—') + ' · ' + (data.year || '') + '</span>' +
          '<img src="' + esc(com.logo) + '" alt="' + esc(com.acronym) + '" class="sc-logo" />' +
          '<span class="acronym">' + esc(com.acronym) + '</span>' +
        '</div>' +
        '<div class="proj-intro">' +
          '<h1>' + esc(p.title) + '</h1>' +
          '<p class="lead">' + esc(p.summary) + '</p>' +
          '<div class="proj-pills">' +
            (p.type ? '<span class="pill">' + esc(p.type) + '</span>' : '') +
            (p.status ? '<span class="pill pill-live">' + esc(p.status) + '</span>' : '') +
            (p.timeframe ? '<span class="pill">' + esc(p.timeframe) + '</span>' : '') +
            (p.theme ? '<span class="pill">' + esc(p.theme) + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="proj-body">' +
        '<div class="proj-about">' +
          '<span class="proj-label">About</span>' +
          paras +
        '</div>' +
        '<aside class="proj-side">' +
          '<span class="proj-label">Snapshot</span>' +
          '<dl class="proj-snap facts">' +
            (p.type ? '<div class="fact"><span class="fact-label">Type</span><span>' + esc(p.type) + '</span></div>' : '') +
            (p.status ? '<div class="fact"><span class="fact-label">Status</span><span>' + esc(p.status) + '</span></div>' : '') +
            (p.timeframe ? '<div class="fact"><span class="fact-label">Timeline</span><span>' + esc(p.timeframe) + '</span></div>' : '') +
            (p.theme ? '<div class="fact"><span class="fact-label">Theme</span><span>' + esc(p.theme) + '</span></div>' : '') +
          '</dl>' +
          (goals ? '<div class="proj-goals"><span class="proj-label">Goals</span><ul>' + goals + '</ul></div>' : '') +
          '<a class="btn btn-primary" href="index.html#join">Join this committee</a>' +
        '</aside>' +
      '</div>';
  };

  const renderMissing = () => {
    page.innerHTML =
      '<div class="proj-missing">' +
        '<span class="slide-no">404</span>' +
        '<h1>Project not found</h1>' +
        '<p class="lead">The project you are looking for does not exist or has been moved.</p>' +
        '<a class="btn btn-primary" href="index.html#scope">Browse committees</a>' +
      '</div>';
  };

  if (project) renderProject(project); else renderMissing();
})();