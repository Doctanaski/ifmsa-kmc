/* ============================================================
   IFMSA KMC — admin panel logic.
   Supabase Auth (email/password) + CRUD for committees,
   projects and site settings. Writes are restricted by RLS to
   users listed in the admin_users table.
   ============================================================ */

(function () {
  'use strict';

  var cfg = window.SUPABASE_CONFIG || {};
  var app = document.getElementById('app');
  var sb = null;

  if (!cfg.url || !cfg.anonKey) {
    app.innerHTML = '<div class="warn">Set your Supabase project URL and anon key in <code>supabase-config.js</code> first.</div>';
    return;
  }
  if (!window.supabase) {
    app.innerHTML = '<div class="warn">supabase-js failed to load. Check your internet connection or the CDN link.</div>';
    return;
  }
  try {
    sb = window.supabase.createClient(cfg.url, cfg.anonKey);
  } catch (err) {
    var em = (err && err.message) ? String(err.message).replace(/</g, '&lt;') : 'Invalid config';
    app.innerHTML = '<div class="warn">Could not initialise Supabase. Check the URL in <code>supabase-config.js</code>.<br /><code>' + em + '</code></div>';
    return;
  }

  var state = {
    user: null,
    isAdmin: false,
    committees: [],
    projects: [],
    settings: { site: {}, hero: {}, about: {}, join: {} },
    tab: 'projects',
    search: ''
  };

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
  var tagOf = function (raw) { return STATUS_TAG[raw] || 'planned'; };
  var STATUS_OPTIONS = [
    'Planned', 'Upcoming', 'Applications open', 'Applications closed',
    'Open', 'Accepting tutors', 'Recruiting', 'Live', 'Beta',
    'On hold', 'Completed', 'Cancelled'
  ];

  var esc = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };
  var el = function (id) { return document.getElementById(id); };
  var val = function (id) { return el(id) ? el(id).value : ''; };
  var slugify = function (s) {
    return String(s || '').toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };
  var splitLines = function (s) {
    return String(s || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  };

  /* ---------- project live preview (mirrors projects.js rendering) ---------- */
  var IMG_LINE = /^!\[([^\]]*)\]\(([^)]+)\)$/;

  var isLightColor = function (hex) {
    var m = String(hex || '').trim().match(/^#?([0-9a-f]{6})$/i);
    var r, g, b;
    if (m) {
      var n = parseInt(m[1], 16);
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

  var splitBlocks = function (blocks) {
    var list = Array.isArray(blocks) ? blocks : (blocks ? [blocks] : []);
    var images = [];
    var paras = list.map(function (t) {
      var m = t && t.match ? t.match(IMG_LINE) : null;
      if (m) { images.push({ src: m[2], alt: m[1] || '' }); return ''; }
      return '<p>' + esc(t) + '</p>';
    }).filter(Boolean);
    return { paras: paras.join(''), images: images };
  };

  var renderGallery = function (images) {
    if (!images.length) return '';
    return '<aside class="proj-gallery" aria-label="Image gallery">' +
      images.map(function (im) {
        return '<figure class="proj-g-img">' +
          '<img src="' + esc(im.src) + '" alt="' + esc(im.alt) + '" loading="lazy" decoding="async" />' +
          (im.alt ? '<figcaption>' + esc(im.alt) + '</figcaption>' : '') +
        '</figure>';
      }).join('') +
    '</aside>';
  };

  var statusOptions = function (selected) {
    var list = STATUS_OPTIONS.slice();
    if (selected && list.indexOf(selected) === -1) list.unshift(selected);
    return list.map(function (s) {
      return '<option value="' + esc(s) + '"' + (s === selected ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('');
  };

  var renderProjectPreview = function () {
    var pre = el('proj-preview');
    if (!pre) return;
    var com = {};
    state.committees.forEach(function (c) { if (c.slug === val('f-committee')) com = c; });
    var row = {
      title: val('f-title').trim(),
      type: val('f-type').trim(),
      status: val('f-status'),
      timeframe: val('f-timeframe').trim(),
      theme: val('f-theme').trim(),
      summary: val('f-summary').trim(),
      about: splitLines(val('f-about')),
      goals: splitLines(val('f-goals'))
    };
    pre.className = 'proj-preview' + (isLightColor(com.color) ? ' proj-light' : '');
    pre.style.setProperty('--proj-bg', com.color || '');
    pre.style.setProperty('--proj-accent', com.accent || com.color || '');
    var goals = row.goals.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('');
    var blocks = splitBlocks(row.about);
    pre.innerHTML =
      '<main class="proj-page"><article class="proj-post">' +
        '<header class="proj-head">' +
          '<h1>' + (row.title ? esc(row.title) : '<span class="proj-empty">Untitled project</span>') + '</h1>' +
          '<p class="lead">' + esc(row.summary) + '</p>' +
          '<div class="proj-pills">' +
            (row.type ? '<span class="pill">' + esc(row.type) + '</span>' : '') +
            (row.status ? '<span class="pill pill-live">' + esc(row.status) + '</span>' : '') +
            (row.timeframe ? '<span class="pill">' + esc(row.timeframe) + '</span>' : '') +
            (row.theme ? '<span class="pill">' + esc(row.theme) + '</span>' : '') +
          '</div>' +
          (goals ? '<section class="proj-goals"><span class="proj-label">Goals</span><ul>' + goals + '</ul></section>' : '') +
        '</header>' +
        '<div class="proj-body' + (blocks.images.length ? '' : ' proj-body--full') + '">' +
          '<div class="proj-main">' + blocks.paras + '</div>' +
          renderGallery(blocks.images) +
        '</div>' +
      '</article></main>';
  };

  /* ============ auth ============ */
  function boot() {
    sb.auth.getSession().then(function (r) {
      var session = r.data && r.data.session;
      if (!session) { showLogin(); return; }
      state.user = session.user;
      sb.from('admin_users').select('id').eq('id', session.user.id).maybeSingle()
        .then(function (ar) {
          state.isAdmin = !ar.error && !!ar.data;
          renderShell();
          loadData().then(renderTab);
        });
    });
  }

  function showLogin() {
    app.innerHTML =
      '<div class="card login-card">' +
        '<h1>KMC × IFMSA</h1>' +
        '<p class="muted">Admin panel — sign in with your Supabase account.</p>' +
        '<form id="login-form">' +
          '<label>Email<input type="email" id="login-email" required autocomplete="email" /></label>' +
          '<label>Password<input type="password" id="login-password" required autocomplete="current-password" /></label>' +
          '<button type="submit" class="btn btn-primary">Sign in</button>' +
          '<p class="error" id="login-error"></p>' +
        '</form>' +
        '<p style="margin-top:1rem">' +
          '<button id="show-signup" class="link">Create an account</button> &middot; ' +
          '<button id="forgot" class="link">Forgot password</button>' +
        '</p>' +
        '<p class="hint">After your first sign-in, grant yourself admin once by running this in the Supabase SQL editor:<br />' +
          '<code>INSERT INTO admin_users (id) VALUES (&#39;your-user-id&#39;);</code></p>' +
      '</div>';

    el('login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      sb.auth.signInWithPassword({
        email: val('login-email'),
        password: val('login-password')
      }).then(function (r) {
        if (r.error) { el('login-error').textContent = r.error.message; return; }
        boot();
      });
    });

    el('show-signup').addEventListener('click', function () {
      var email = val('login-email');
      var pass = val('login-password');
      if (!email || !pass) { alert('Fill in an email and password first.'); return; }
      sb.auth.signUp({ email: email, password: pass }).then(function (r) {
        if (r.error) { alert(r.error.message); return; }
        alert('Account created. Confirm your email, then sign in.');
        boot();
      });
    });

    el('forgot').addEventListener('click', function () {
      var email = val('login-email');
      if (!email) { alert('Enter your email first.'); return; }
      sb.auth.resetPasswordForEmail(email).then(function (r) {
        if (r.error) { alert(r.error.message); return; }
        alert('Password reset email sent.');
      });
    });
  }

  function logout() {
    sb.auth.signOut().then(boot);
  }

  /* ============ shell ============ */
  function renderShell() {
    var hint = state.isAdmin ? '' :
      '<div class="warn" style="margin-bottom:1.4rem">You are signed in but not an admin yet. Your user id: ' +
        '<code>' + state.user.id + '</code><br />Run this once in the Supabase SQL editor to grant access:<br />' +
        '<code>INSERT INTO admin_users (id) VALUES (&#39;' + state.user.id + '&#39;);</code></div>';

    app.innerHTML =
      hint +
      '<header class="bar">' +
        '<div><h1>Content Admin</h1><div class="sub">' + esc(state.user.email) + '</div></div>' +
        '<div class="actions">' +
          '<a class="btn" href="../index.html" target="_blank" rel="noopener">View site</a>' +
          '<button class="btn" id="logout-btn">Sign out</button>' +
        '</div>' +
      '</header>' +
      '<nav class="tabs" id="tabs">' +
        '<button data-tab="projects" class="active">Projects</button>' +
        '<button data-tab="committees">Committees</button>' +
        '<button data-tab="settings">Settings</button>' +
      '</nav>' +
      '<main id="tab-projects" class="tab-pane"></main>' +
      '<main id="tab-committees" class="tab-pane" hidden></main>' +
      '<main id="tab-settings" class="tab-pane" hidden></main>' +
      '<div id="modal-root"></div>';

    el('logout-btn').addEventListener('click', logout);
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tab = b.getAttribute('data-tab');
        document.querySelectorAll('#tabs button').forEach(function (x) {
          x.classList.toggle('active', x === b);
        });
        ['projects', 'committees', 'settings'].forEach(function (t) {
          el('tab-' + t).hidden = t !== state.tab;
        });
        renderTab();
      });
    });
  }

  function loadData() {
    return Promise.all([
      sb.from('committees').select('*').order('sort_order'),
      sb.from('projects').select('*').order('sort_order'),
      sb.from('site_settings').select('key, value')
    ]).then(function (rs) {
      if (rs[0].error) throw rs[0].error;
      if (rs[1].error) throw rs[1].error;
      if (rs[2].error) throw rs[2].error;
      state.committees = rs[0].data || [];
      state.projects = rs[1].data || [];
      state.settings = { site: {}, hero: {}, about: {}, join: {} };
      (rs[2].data || []).forEach(function (s) { state.settings[s.key] = s.value || {}; });
    });
  }

  function committeeOptions(selected) {
    return state.committees.map(function (c) {
      return '<option value="' + esc(c.slug) + '"' + (c.slug === selected ? ' selected' : '') + '>' +
        esc(c.acronym) + ' &mdash; ' + esc(c.name) + '</option>';
    }).join('');
  }

  /* ============ tab dispatch ============ */
  function renderTab() {
    if (state.tab === 'projects') renderProjects();
    else if (state.tab === 'committees') renderCommittees();
    else renderSettings();
  }

  /* ============ projects ============ */
  function renderProjects() {
    var pane = el('tab-projects');
    var q = state.search.toLowerCase();
    var comBySlug = {};
    state.committees.forEach(function (c) { comBySlug[c.slug] = c; });

    var rows = state.projects.filter(function (p) {
      return !q ||
        (p.title || '').toLowerCase().indexOf(q) !== -1 ||
        (p.committee || '').indexOf(q) !== -1;
    });

    pane.innerHTML =
      '<div class="toolbar">' +
        '<div class="search"><input type="text" id="proj-search" placeholder="Search projects…" value="' + esc(state.search) + '" /></div>' +
        '<button class="btn btn-primary" id="proj-new">+ New project</button>' +
      '</div>' +
      '<div class="count">' + rows.length + ' project' + (rows.length === 1 ? '' : 's') + '</div>' +
      '<table class="table">' +
        '<thead><tr><th>Title</th><th>Committee</th><th>Status</th><th class="actions-cell">Actions</th></tr></thead>' +
        '<tbody>' + rows.map(function (p) {
          var com = comBySlug[p.committee] || {};
          var tag = tagOf(p.status);
          return '<tr>' +
            '<td><strong>' + esc(p.title) + '</strong></td>' +
            '<td>' + esc(com.acronym || p.committee) + '</td>' +
            '<td><span class="tag tag-' + tag + '">' + esc(p.status || tag) + '</span></td>' +
            '<td class="actions-cell">' +
              '<button class="btn btn-small" data-edit="' + esc(p.id) + '">Edit</button> ' +
              '<button class="btn btn-small btn-danger" data-del="' + esc(p.id) + '">Delete</button>' +
            '</td></tr>';
        }).join('') +
        (rows.length ? '' : '<tr><td colspan="4" class="empty">No projects yet.</td></tr>') +
        '</tbody>' +
      '</table>';

    el('proj-search').addEventListener('input', function () {
      state.search = el('proj-search').value;
      renderProjects();
      var inp = el('proj-search');
      inp.focus();
      inp.setSelectionRange(inp.value.length, inp.value.length);
    });
    el('proj-new').addEventListener('click', function () { projectModal(null); });
    pane.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        projectModal(state.projects.find(function (p) { return p.id === b.getAttribute('data-edit'); }));
      });
    });
    pane.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { delProject(b.getAttribute('data-del')); });
    });
  }

  function projectModal(p) {
    p = p || {
      id: '', committee: (state.committees[0] || {}).slug || '',
      title: '', type: '', status: 'Planned', timeframe: '', theme: '',
      summary: '', about: [], goals: [], sort_order: state.projects.length
    };
    openModal(
      '<h2>' + (p.id ? 'Edit project' : 'New project') + '</h2>' +
      '<div class="modal-body">' +
        '<div class="modal-form">' +
          '<div class="form-grid">' +
            '<label class="full">Title<input type="text" id="f-title" value="' + esc(p.title) + '" required /></label>' +
            '<label>Committee<select id="f-committee">' + committeeOptions(p.committee) + '</select></label>' +
            '<label>Sort order<input type="number" id="f-sort" value="' + (p.sort_order || 0) + '" /></label>' +
            '<label>Type<input type="text" id="f-type" value="' + esc(p.type) + '" /></label>' +
            '<label>Status<select id="f-status">' + statusOptions(p.status || '') + '</select></label>' +
            '<label class="full">Timeframe<input type="text" id="f-timeframe" value="' + esc(p.timeframe) + '" /></label>' +
            '<label class="full">Theme<input type="text" id="f-theme" value="' + esc(p.theme) + '" /></label>' +
            '<label class="full">Summary<textarea id="f-summary">' + esc(p.summary) + '</textarea></label>' +
            '<label class="full">About — one paragraph per line; insert a picture on its own line as <code>![caption](image-url)</code><textarea id="f-about">' + esc((p.about || []).join('\n')) + '</textarea></label>' +
            '<label class="full">Goals — one per line<textarea id="f-goals">' + esc((p.goals || []).join('\n')) + '</textarea></label>' +
            '<label class="full">ID (leave blank to auto-generate)<input type="text" id="f-id" value="' + esc(p.id) + '" placeholder="e.g. scope-2026-summer-exchange" /></label>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button class="btn" id="m-cancel">Cancel</button>' +
            '<button class="btn btn-primary" id="m-save">Save project</button>' +
          '</div>' +
        '</div>' +
        '<div class="preview-pane">' +
          '<div class="preview-label">Live preview</div>' +
          '<div class="proj-preview" id="proj-preview"></div>' +
        '</div>' +
      '</div>',
      'modal--wide'
    );

    ['f-title', 'f-committee', 'f-type', 'f-status', 'f-timeframe', 'f-theme',
     'f-summary', 'f-about', 'f-goals'].forEach(function (id) {
      var input = el(id);
      if (!input) return;
      input.addEventListener('input', renderProjectPreview);
      input.addEventListener('change', renderProjectPreview);
    });
    renderProjectPreview();

    el('m-save').addEventListener('click', function () {
      var row = {
        id: val('f-id').trim(),
        committee: val('f-committee'),
        title: val('f-title').trim(),
        type: val('f-type').trim() || null,
        status: val('f-status').trim() || null,
        timeframe: val('f-timeframe').trim() || null,
        theme: val('f-theme').trim() || null,
        summary: val('f-summary').trim() || null,
        about: splitLines(val('f-about')),
        goals: splitLines(val('f-goals')),
        sort_order: parseInt(val('f-sort'), 10) || 0
      };
      if (!row.title || !row.committee) { alert('Title and committee are required.'); return; }
      if (!row.id) {
        row.id = slugify(row.title);
        if (!row.id) { alert('Give the project an ID.'); return; }
      }
      sb.from('projects').upsert(row).then(function (r) {
        if (r.error) { alert(r.error.message); return; }
        closeModal();
        loadData().then(renderProjects);
      });
    });
  }

  function delProject(id) {
    if (!confirm('Delete this project?')) return;
    sb.from('projects').delete().eq('id', id).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      loadData().then(renderProjects);
    });
  }

  /* ============ committees ============ */
  function renderCommittees() {
    var pane = el('tab-committees');
    pane.innerHTML =
      '<div class="toolbar"><div></div><button class="btn btn-primary" id="com-new">+ New committee</button></div>' +
      '<table class="table">' +
        '<thead><tr><th>Acronym</th><th>Name</th><th>Colour</th><th>Logo</th><th class="actions-cell">Actions</th></tr></thead>' +
        '<tbody>' + state.committees.map(function (c) {
          return '<tr>' +
            '<td><strong>' + esc(c.acronym) + '</strong></td>' +
            '<td>' + esc(c.name) + '</td>' +
            '<td><span class="color-chip" style="background:' + esc(c.color || '#fff') + '"></span>' + esc(c.color || '') + '</td>' +
            '<td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.logo || '') + '</td>' +
            '<td class="actions-cell">' +
              '<button class="btn btn-small" data-edit="' + esc(c.slug) + '">Edit</button> ' +
              '<button class="btn btn-small btn-danger" data-del="' + esc(c.slug) + '">Delete</button>' +
            '</td></tr>';
        }).join('') + '</tbody>' +
      '</table>';

    el('com-new').addEventListener('click', function () { committeeModal(null); });
    pane.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        committeeModal(state.committees.find(function (c) { return c.slug === b.getAttribute('data-edit'); }));
      });
    });
    pane.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { delCommittee(b.getAttribute('data-del')); });
    });
  }

  function committeeModal(c) {
    c = c || { slug: '', acronym: '', name: '', color: '', accent: '', logo: '', sort_order: state.committees.length };
    openModal(
      '<h2>' + (c.slug ? 'Edit committee' : 'New committee') + '</h2>' +
      '<div class="form-grid">' +
        '<label>Slug<input type="text" id="c-slug" value="' + esc(c.slug) + '" ' + (c.slug ? 'readonly' : 'required') + ' placeholder="e.g. scope" /></label>' +
        '<label>Sort order<input type="number" id="c-sort" value="' + (c.sort_order || 0) + '" /></label>' +
        '<label>Acronym<input type="text" id="c-acronym" value="' + esc(c.acronym) + '" required /></label>' +
        '<label>Name<input type="text" id="c-name" value="' + esc(c.name) + '" required /></label>' +
        '<label>Colour<input type="text" id="c-color" value="' + esc(c.color) + '" placeholder="#0180C8" /></label>' +
        '<label>Accent<input type="text" id="c-accent" value="' + esc(c.accent) + '" placeholder="#0180C8" /></label>' +
        '<label class="full">Logo path<input type="text" id="c-logo" value="' + esc(c.logo) + '" placeholder="assets/sc-SCOPE.png" /></label>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button class="btn" id="m-cancel">Cancel</button>' +
        '<button class="btn btn-primary" id="m-save">Save committee</button>' +
      '</div>'
    );

    el('m-save').addEventListener('click', function () {
      var row = {
        slug: val('c-slug').trim().toLowerCase(),
        acronym: val('c-acronym').trim(),
        name: val('c-name').trim(),
        color: val('c-color').trim() || null,
        accent: val('c-accent').trim() || null,
        logo: val('c-logo').trim() || null,
        sort_order: parseInt(val('c-sort'), 10) || 0
      };
      if (!row.slug || !row.acronym || !row.name) { alert('Slug, acronym and name are required.'); return; }
      sb.from('committees').upsert(row).then(function (r) {
        if (r.error) { alert(r.error.message); return; }
        closeModal();
        loadData().then(renderCommittees);
      });
    });
  }

  function delCommittee(slug) {
    if (!confirm('Delete this committee and ALL of its projects?')) return;
    sb.from('committees').delete().eq('slug', slug).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      loadData().then(renderCommittees);
    });
  }

  /* ============ settings ============ */
  function renderSettings() {
    var pane = el('tab-settings');
    var s = state.settings.site || {};
    var h = state.settings.hero || {};
    var a = state.settings.about || {};
    var j = state.settings.join || {};

    pane.innerHTML =
      '<div class="card settings-section"><h3>Site</h3>' +
        '<div class="form-grid">' +
          '<label>Year<input type="text" id="s-year" value="' + esc(s.year || '') + '" /></label>' +
          '<label class="full">Footer line 1<input type="text" id="s-foot1" value="' + esc(s.footer1 || '') + '" /></label>' +
          '<label class="full">Footer line 2<input type="text" id="s-foot2" value="' + esc(s.footer2 || '') + '" /></label>' +
        '</div></div>' +

      '<div class="card settings-section"><h3>Hero (homepage)</h3>' +
        '<div class="form-grid">' +
          '<label>Eyebrow pill<input type="text" id="h-pill" value="' + esc(h.eyebrowPill || '') + '" /></label>' +
          '<label>Eyebrow rest<input type="text" id="h-rest" value="' + esc(h.eyebrowRest || '') + '" /></label>' +
          '<label>Title line 1<input type="text" id="h-t1" value="' + esc(h.title1 || '') + '" /></label>' +
          '<label>Title line 2<input type="text" id="h-t2" value="' + esc(h.title2 || '') + '" /></label>' +
          '<label class="full">Sub text<textarea id="h-sub">' + esc(h.sub || '') + '</textarea></label>' +
          '<label>Button 1 text<input type="text" id="h-btn1t" value="' + esc(h.btn1Text || '') + '" /></label>' +
          '<label>Button 1 href<input type="text" id="h-btn1h" value="' + esc(h.btn1Href || '') + '" /></label>' +
          '<label>Button 2 text<input type="text" id="h-btn2t" value="' + esc(h.btn2Text || '') + '" /></label>' +
          '<label>Button 2 href<input type="text" id="h-btn2h" value="' + esc(h.btn2Href || '') + '" /></label>' +
          '<label>Stat 1 number<input type="text" id="h-m1n" value="' + esc(h.mini1Num || '') + '" /></label>' +
          '<label>Stat 1 label<input type="text" id="h-m1l" value="' + esc(h.mini1Label || '') + '" /></label>' +
          '<label>Stat 2 number<input type="text" id="h-m2n" value="' + esc(h.mini2Num || '') + '" /></label>' +
          '<label>Stat 2 label<input type="text" id="h-m2l" value="' + esc(h.mini2Label || '') + '" /></label>' +
          '<label>Stat 3 number<input type="text" id="h-m3n" value="' + esc(h.mini3Num || '') + '" /></label>' +
          '<label>Stat 3 label<input type="text" id="h-m3l" value="' + esc(h.mini3Label || '') + '" /></label>' +
        '</div></div>' +

      '<div class="card settings-section"><h3>About tab (homepage)</h3>' +
        '<div class="form-grid">' +
          '<label>Eyebrow pill<input type="text" id="a-eyebrow" value="' + esc(a.eyebrow || '') + '" /></label>' +
          '<label class="full">Title<input type="text" id="a-title" value="' + esc(a.title || '') + '" /></label>' +
          '<label class="full">Body text<textarea id="a-body">' + esc(a.body || '') + '</textarea></label>' +
        '</div></div>' +

      '<div class="card settings-section"><h3>Join tab (homepage)</h3>' +
        '<div class="form-grid">' +
          '<label>Eyebrow<input type="text" id="j-eyebrow" value="' + esc(j.eyebrow || '') + '" /></label>' +
          '<label class="full">Title<input type="text" id="j-title" value="' + esc(j.title || '') + '" /></label>' +
          '<label class="full">Sub text<textarea id="j-sub">' + esc(j.sub || '') + '</textarea></label>' +
          '<label>Button 1 text<input type="text" id="j-btn1t" value="' + esc(j.btn1Text || '') + '" /></label>' +
          '<label>Button 1 href<input type="text" id="j-btn1h" value="' + esc(j.btn1Href || '') + '" /></label>' +
          '<label>Button 2 text<input type="text" id="j-btn2t" value="' + esc(j.btn2Text || '') + '" /></label>' +
          '<label>Button 2 href<input type="text" id="j-btn2h" value="' + esc(j.btn2Href || '') + '" /></label>' +
        '</div>' +
        '<div class="form-actions"><button class="btn btn-primary" id="settings-save">Save settings</button></div>' +
      '</div>';

    el('settings-save').addEventListener('click', saveSettings);
  }

  function saveSettings() {
    var rows = [
      {
        key: 'site',
        value: { year: val('s-year').trim(), footer1: val('s-foot1').trim(), footer2: val('s-foot2').trim() }
      },
      {
        key: 'hero',
        value: {
          eyebrowPill: val('h-pill').trim(), eyebrowRest: val('h-rest').trim(),
          title1: val('h-t1').trim(), title2: val('h-t2').trim(),
          sub: val('h-sub').trim(),
          btn1Text: val('h-btn1t').trim(), btn1Href: val('h-btn1h').trim(),
          btn2Text: val('h-btn2t').trim(), btn2Href: val('h-btn2h').trim(),
          mini1Num: val('h-m1n').trim(), mini1Label: val('h-m1l').trim(),
          mini2Num: val('h-m2n').trim(), mini2Label: val('h-m2l').trim(),
          mini3Num: val('h-m3n').trim(), mini3Label: val('h-m3l').trim()
        }
      },
      {
        key: 'about',
        value: {
          eyebrow: val('a-eyebrow').trim(), title: val('a-title').trim(),
          body: val('a-body').trim()
        }
      },
      {
        key: 'join',
        value: {
          eyebrow: val('j-eyebrow').trim(), title: val('j-title').trim(),
          sub: val('j-sub').trim(),
          btn1Text: val('j-btn1t').trim(), btn1Href: val('j-btn1h').trim(),
          btn2Text: val('j-btn2t').trim(), btn2Href: val('j-btn2h').trim()
        }
      }
    ];
    sb.from('site_settings').upsert(rows, { onConflict: 'key' }).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      alert('Settings saved.');
      loadData();
    });
  }

  /* ============ modal ============ */
  function openModal(html, cls) {
    var root = el('modal-root');
    root.innerHTML = '<div class="modal-back"><div class="modal' + (cls ? ' ' + cls : '') + '">' + html + '</div></div>';
    var cancel = root.querySelector('#m-cancel');
    if (cancel) cancel.addEventListener('click', closeModal);
    root.querySelector('.modal-back').addEventListener('click', function (e) {
      if (e.target === e.currentTarget) closeModal();
    });
    var first = root.querySelector('input, select, textarea');
    if (first) first.focus();
  }

  function closeModal() {
    el('modal-root').innerHTML = '';
  }

  /* ============ auth state changes ============ */
  sb.auth.onAuthStateChange(function (event) {
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
      if (!state.user) boot();
    } else if (event === 'SIGNED_OUT') {
      state.user = null;
      state.isAdmin = false;
      showLogin();
    }
  });

  boot();
})();
