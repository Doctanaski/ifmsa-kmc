/* ============================================================
   IFMSA · Khyber Medical College
   Project detail page. Reads ?id= from the URL, looks it up in
   the loaded site data (Supabase, falling back to IFMSA_DATA)
   and renders the full project page.
   ============================================================ */

(function () {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  const page = document.getElementById('proj-page');
  const back = document.getElementById('proj-back');

  if (!page) return;

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const IMG_LINE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

  const renderBlocks = (blocks) => (blocks || []).map((t) => {
    const m = t && t.match ? t.match(IMG_LINE) : null;
    if (m) {
      const alt = m[1] || '';
      const src = m[2];
      return '<figure class="proj-figure">' +
        '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" />' +
        (alt ? '<figcaption>' + esc(alt) + '</figcaption>' : '') +
        '</figure>';
    }
    return '<p>' + esc(t) + '</p>';
  }).join('');

  const renderProject = (data, p) => {
    const com = data.committees[p.committee] || {};
    const color = com.accent || com.color || 'var(--accent)';
    const goals = (p.goals || []).map((g) => '<li>' + esc(g) + '</li>').join('');

    document.title = p.title + ' · KMC × IFMSA';
    if (back) {
      back.href = 'index.html#' + (com.slug || 'scope');
      back.textContent = '← Back to chapter';
    }

    page.style.setProperty('--proj-accent', color);

    page.innerHTML =
      '<article class="proj-post">' +
        '<header class="proj-head">' +
          '<h1>' + esc(p.title) + '</h1>' +
          '<p class="lead">' + esc(p.summary) + '</p>' +
          '<div class="proj-pills">' +
            (p.type ? '<span class="pill">' + esc(p.type) + '</span>' : '') +
            (p.status ? '<span class="pill pill-live">' + esc(p.status) + '</span>' : '') +
            (p.timeframe ? '<span class="pill">' + esc(p.timeframe) + '</span>' : '') +
            (p.theme ? '<span class="pill">' + esc(p.theme) + '</span>' : '') +
          '</div>' +
        '</header>' +
        '<div class="proj-content">' + renderBlocks(p.about) + '</div>' +
        (goals ? '<section class="proj-goals"><span class="proj-label">Goals</span><ul>' + goals + '</ul></section>' : '') +
        '<p class="proj-join"><a class="btn btn-primary" href="index.html#join">Join this committee</a></p>' +
      '</article>';
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

  window.loadSiteData().then((data) => {
    window.applySiteSettings(data);
    const project = (data.projects || []).find((p) => p.id === id);
    if (project) renderProject(data, project); else renderMissing();
  });
})();
