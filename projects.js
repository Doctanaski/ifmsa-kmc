/* ============================================================
   IFMSA · Khyber Medical College
   Project detail page. Reads ?id= from the URL, looks it up in
   the loaded site data (Supabase) and renders the full project page.
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

  /* ---------- committee theming ---------- */
  const isLightColor = (hex) => {
    let m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
    let r, g, b;
    if (m) {
      const n = parseInt(m[1], 16);
      r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255;
    } else {
      m = String(hex || '').trim().match(/^#?([0-9a-f]{3})$/i);
      if (m) {
        r = parseInt(m[1][0] + m[1][0], 16);
        g = parseInt(m[1][1] + m[1][1], 16);
        b = parseInt(m[1][2] + m[1][2], 16);
      } else {
        m = String(hex || '').trim().match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
        if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
        else return false;
      }
    }
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.7;
  };

  const clearTheme = () => {
    const body = document.body;
    body.classList.remove('proj-light');
    body.style.removeProperty('--proj-bg');
    body.style.removeProperty('--proj-accent');
  };

  const applyTheme = (com) => {
    const body = document.body;
    clearTheme();
    if (com.color) {
      body.style.setProperty('--proj-bg', com.color);
      body.classList.toggle('proj-light', isLightColor(com.color));
    }
    if (com.accent || com.color) {
      body.style.setProperty('--proj-accent', com.accent || com.color);
    }
  };

  /* ---------- split about blocks into prose + gallery images ---------- */
  const splitBlocks = (blocks) => {
    const list = Array.isArray(blocks) ? blocks : (blocks ? [blocks] : []);
    const images = [];
    const paras = list.map((t) => {
      const m = t && t.match ? t.match(IMG_LINE) : null;
      if (m) {
        images.push({ src: m[2], alt: m[1] || '' });
        return '';
      }
      return '<p>' + esc(t) + '</p>';
    }).filter(Boolean);
    return { paras: paras.join(''), images: images };
  };

  const renderGallery = (images) => {
    if (!images.length) return '';
    return '<aside class="proj-gallery" aria-label="Image gallery">' +
      images.map((im) =>
        '<figure class="proj-g-img">' +
          '<img src="' + esc(im.src) + '" alt="' + esc(im.alt) + '" loading="lazy" decoding="async" />' +
          (im.alt ? '<figcaption>' + esc(im.alt) + '</figcaption>' : '') +
        '</figure>'
      ).join('') +
    '</aside>';
  };

  /* ---------- phone: interleave gallery images into the prose ---------- */
  const mobileQuery = window.matchMedia('(max-width: 640px)');

  const redistributeGallery = () => {
    const body = document.querySelector('.proj-body');
    if (!body) return;
    const main = body.querySelector('.proj-main');
    const gallery = body.querySelector('.proj-gallery');
    if (!main || !gallery) return;

    const figures = body.querySelectorAll('.proj-g-img');
    if (mobileQuery.matches) {
      if (gallery.dataset.inlined === '1') return;
      const paras = main.querySelectorAll('p');
      const total = paras.length;
      const step = total / (figures.length + 1);
      Array.prototype.forEach.call(figures, (fig, i) => {
        const anchor = total ? paras[Math.min(Math.ceil(step * (i + 1)) - 1, total - 1)] : null;
        if (anchor) anchor.insertAdjacentElement('afterend', fig);
        else main.appendChild(fig);
      });
      gallery.dataset.inlined = '1';
    } else if (gallery.dataset.inlined === '1') {
      Array.prototype.forEach.call(figures, (fig) => gallery.appendChild(fig));
      delete gallery.dataset.inlined;
    }
  };

  const initRedistribute = () => {
    const run = () => redistributeGallery();
    if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', run);
    else if (mobileQuery.addListener) mobileQuery.addListener(run);
    window.addEventListener('resize', run);
    run();
  };

  const renderProject = (data, p) => {
    const com = data.committees[p.committee] || {};
    const goals = (p.goals || []).map((g) => '<li>' + esc(g) + '</li>').join('');
    const { paras, images } = splitBlocks(p.about);

    document.title = p.title + ' · KMC × IFMSA';
    if (back) {
      back.href = 'index.html';
      back.textContent = '← Back to homepage';
    }

    applyTheme(com);

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
          (goals ? '<section class="proj-goals"><span class="proj-label">Goals</span><ul>' + goals + '</ul></section>' : '') +
        '</header>' +
        '<div class="proj-body' + (images.length ? '' : ' proj-body--full') + '">' +
          '<div class="proj-main">' + paras + '</div>' +
          renderGallery(images) +
        '</div>' +
      '</article>';
  };

  const renderMissing = () => {
    clearTheme();
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
    initRedistribute();
  });
})();
