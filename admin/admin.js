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
    highlights: [],
    execBoard: [],
    alumni: [],
    awards: [],
    settings: { site: {}, hero: {}, about: {}, join: {}, exec: {}, highlights: {}, alumni: {}, awards: {} },
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

  /* ---------- highlights ---------- */
  var HL_CATS = [
    { key: 'away',  label: 'We travelled' },
    { key: 'campus', label: 'On campus' },
    { key: 'win',   label: 'Recognised' }
  ];
  var HL_CAT_LABEL = { away: 'We travelled', campus: 'On campus', win: 'Recognised' };
  var HL_CAT_COLOR = { away: '#1d4ed8', campus: '#0f9c15', win: '#d29922' };
  var HL_CAT_OPTIONS = function (selected) {
    return HL_CATS.map(function (c) {
      return '<option value="' + c.key + '"' + (c.key === selected ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('');
  };

  /* ---------- alumni ---------- */
  var AL_TRACKS = [
    { key: 'clinical',     label: 'Clinical',         color: '#1d4ed8' },
    { key: 'research',     label: 'Research',         color: '#6d28d9' },
    { key: 'publichealth', label: 'Public Health',    color: '#0f9c15' },
    { key: 'leadership',   label: 'Leadership',       color: '#d29922' },
    { key: 'beyond',       label: 'Beyond Medicine',  color: '#db2777' }
  ];
  var AL_TRACK_BY_KEY = {};
  AL_TRACKS.forEach(function (t) { AL_TRACK_BY_KEY[t.key] = t; });
  var AL_TRACK_OPTIONS = function (selected) {
    return AL_TRACKS.map(function (t) {
      return '<option value="' + t.key + '"' + (t.key === selected ? ' selected' : '') + '>' + t.label + '</option>';
    }).join('');
  };

  /* ---------- awards ---------- */
  var AW_CATS = [
    { key: 'officer',       label: 'Officer of the Year',       color: '#d29922' },
    { key: 'project',       label: 'Best Project',              color: '#0f9c15' },
    { key: 'research',      label: 'Research Publications',     color: '#6d28d9' },
    { key: 'international', label: 'International Recognition', color: '#1d4ed8' },
    { key: 'national',      label: 'National Partnerships',     color: '#0d9488' },
    { key: 'community',     label: 'Community Impact',          color: '#db2777' }
  ];
  var AW_CAT_BY_KEY = {};
  AW_CATS.forEach(function (c) { AW_CAT_BY_KEY[c.key] = c; });
  var AW_MEDAL_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };
  var AW_MEDAL_OPTIONS = function (selected) {
    var list = [{ value: '', label: '— none —' }].concat(
      Object.keys(AW_MEDAL_LABEL).map(function (m) { return { value: m, label: AW_MEDAL_LABEL[m] }; })
    );
    return list.map(function (m) {
      return '<option value="' + m.value + '"' + (m.value === selected ? ' selected' : '') + '>' + m.label + '</option>';
    }).join('');
  };
  var AW_CAT_OPTIONS = function (selected) {
    return AW_CATS.map(function (c) {
      return '<option value="' + c.key + '"' + (c.key === selected ? ' selected' : '') + '>' + c.label + '</option>';
    }).join('');
  };
  var awCatOf = function (key) {
    return AW_CAT_BY_KEY[String(key || 'project').toLowerCase().replace(/[^a-z0-9]/g, '')] || AW_CAT_BY_KEY.project;
  };

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

  var parseColorTags = function (text) {
    return String(text || '')
      .replace(/\{(#?[a-zA-Z0-9(),. %]+)\}([\s\S]*?)\{\//g, function (_, colour, inner) {
        var c = colour.trim();
        if (!c) return inner;
        return '<span style="color:' + c.replace(/"/g, '') + ';">' + inner + '</span>';
      });
  };

  /* ============ Supabase storage (image uploads) ============ */
  var IMG_BUCKET = 'images';
  var publicUrlFor = function (path) {
    return sb.storage.from(IMG_BUCKET).getPublicUrl(path).data.publicUrl;
  };

  var uploadImage = function (file) {
    var ext = (file.name.split('.').pop() || 'png').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'].indexOf(ext) === -1) {
      return Promise.reject(new Error('Only image files are supported (png, jpg, gif, webp, svg).'));
    }
    var stamp = Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    var path = 'uploads/' + stamp + '-' + slugify(file.name.replace(/\.[^.]+$/, '')) + '.' + ext;
    return sb.storage.from(IMG_BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/' + (ext === 'jpg' ? 'jpeg' : ext)
    }).then(function (r) {
      if (r.error) throw r.error;
      return publicUrlFor(path);
    });
  };

  var fireInput = function (input) {
    if (!input) return;
    ['input', 'change'].forEach(function (t) {
      try { input.dispatchEvent(new Event(t, { bubbles: true })); } catch (e) { /* noop */ }
    });
  };

  /* ---------- picture framing ----------
     The framing tool stores a focal point as a #fp=x,y fragment on the
     image URL (x / y in percent). Renderers turn it into object-position
     or background-position so the crop matches what was framed here. */
  var FP_RE = /#fp=([\d.]+),([\d.]+)/;
  var clampPct = function (n) { return Math.min(100, Math.max(0, n)); };
  var imgFramePos = function (url) {
    var m = String(url || '').match(FP_RE);
    return m ? m[1] + '% ' + m[2] + '%' : '';
  };

  /* turn a URL text input into a picker that can also upload from disk,
     with a draggable focal-point control for how the picture is framed */
  var attachImageUpload = function (inputId, opts) {
    opts = opts || {};
    var input = el(inputId);
    if (!input) return;

    var holder = document.createElement('div');
    holder.className = 'img-upload';

    var preview = document.createElement('div');
    preview.className = 'img-upload-preview';

    var fileBtn = document.createElement('button');
    fileBtn.type = 'button';
    fileBtn.className = 'btn btn-small';
    fileBtn.innerHTML = '&#128451; Upload from computer';
    fileBtn.title = 'Upload an image to Supabase storage';

    var frameBtn = document.createElement('button');
    frameBtn.type = 'button';
    frameBtn.className = 'btn btn-small';
    frameBtn.innerHTML = '&#9986; Framing';
    frameBtn.title = 'Adjust what stays centred when the picture is cropped';

    var status = document.createElement('span');
    status.className = 'img-upload-status';

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;

    var framePanel = document.createElement('div');
    framePanel.className = 'img-frame-panel';
    framePanel.hidden = true;
    framePanel.innerHTML =
      '<div class="img-frame-hint">Drag on the picture to pick the focal point &mdash; what stays in view when it is cropped.</div>' +
      '<div class="img-frame-stage"><img alt="" draggable="false" /><span class="img-frame-dot"></span></div>' +
      '<div class="img-frame-actions">' +
        '<button type="button" class="btn btn-small img-frame-reset">Reset to centre</button>' +
        '<span class="img-frame-val"></span>' +
      '</div>';

    holder.appendChild(preview);
    holder.appendChild(fileBtn);
    holder.appendChild(frameBtn);
    holder.appendChild(fileInput);
    holder.appendChild(status);
    holder.appendChild(framePanel);

    /* put the widget right after the field, inside the same label */
    var parent = input.parentNode;
    parent.appendChild(holder);

    var stage = framePanel.querySelector('.img-frame-stage');
    var stageImg = stage.querySelector('img');
    var dot = framePanel.querySelector('.img-frame-dot');
    var valLabel = framePanel.querySelector('.img-frame-val');

    var frame = null;   /* {x, y} percentages, null = centred (default) */

    var syncFrameUi = function () {
      var f = frame || { x: 50, y: 50 };
      dot.style.left = f.x + '%';
      dot.style.top = f.y + '%';
      stageImg.style.objectPosition = f.x + '% ' + f.y + '%';
      valLabel.textContent = frame
        ? 'Focal point ' + Math.round(f.x) + '% \u00b7 ' + Math.round(f.y) + '%'
        : 'Centred (default)';
    };

    var readValue = function () {
      var m = (input.value || '').match(FP_RE);
      frame = m ? { x: clampPct(parseFloat(m[1])), y: clampPct(parseFloat(m[2])) } : null;
    };

    var writeValue = function () {
      var base = (input.value || '').replace(/#fp=[\d.,]+/, '').trim();
      input.value = base + (frame ? '#fp=' + frame.x + ',' + frame.y : '');
      fireInput(input);
    };

    var renderPreview = function () {
      var v = (input.value || '').trim();
      readValue();
      if (v) {
        var pos = imgFramePos(v);
        preview.innerHTML = '<img src="' + esc(v) + '" alt=""' + (pos ? ' style="object-position:' + pos + '"' : '') + ' />';
        preview.classList.add('has-img');
        stageImg.src = v;
        frameBtn.disabled = false;
      } else {
        preview.innerHTML = '';
        preview.classList.remove('has-img');
        stageImg.removeAttribute('src');
        frameBtn.disabled = true;
        framePanel.hidden = true;
      }
      syncFrameUi();
    };
    renderPreview();
    input.addEventListener('input', renderPreview);
    input.addEventListener('change', renderPreview);

    /* --- framing: drag on the stage to set the focal point --- */
    var setFromEvent = function (e) {
      var r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      frame = {
        x: Math.round(clampPct(((e.clientX - r.left) / r.width) * 100) * 10) / 10,
        y: Math.round(clampPct(((e.clientY - r.top) / r.height) * 100) * 10) / 10
      };
      syncFrameUi();
    };

    var dragging = false;
    stage.addEventListener('pointerdown', function (e) {
      if (!stageImg.src) return;
      dragging = true;
      try { stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      setFromEvent(e);
      e.preventDefault();
    });
    stage.addEventListener('pointermove', function (e) {
      if (dragging) setFromEvent(e);
    });
    var endDrag = function (e) {
      if (!dragging) return;
      dragging = false;
      try {
        if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
      } catch (err) { /* noop */ }
      writeValue();
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    frameBtn.addEventListener('click', function () {
      framePanel.hidden = !framePanel.hidden;
    });

    framePanel.querySelector('.img-frame-reset').addEventListener('click', function () {
      frame = null;
      syncFrameUi();
      writeValue();
    });

    fileBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      status.textContent = 'Uploading…';
      status.classList.remove('ok', 'err');
      uploadImage(file).then(function (url) {
        input.value = url;
        status.textContent = 'Uploaded ✓';
        status.classList.add('ok');
        renderPreview();
        fireInput(input);
        if (opts.onUpload) opts.onUpload(url);
      }).catch(function (err) {
        status.textContent = (err && err.message) ? err.message : 'Upload failed';
        status.classList.add('err');
      }).then(function () {
        fileInput.value = '';
      });
    });

    if (opts.after) opts.after(holder);
  };

  /* add an "Add image" button for markdown-style textareas (![caption](url)) */
  var attachMarkdownUpload = function (textareaId, opts) {
    opts = opts || {};
    var ta = el(textareaId);
    if (!ta) return;

    var holder = document.createElement('div');
    holder.className = 'img-upload';

    var fileBtn = document.createElement('button');
    fileBtn.type = 'button';
    fileBtn.className = 'btn btn-small';
    fileBtn.innerHTML = '&#128451; Upload image &amp; insert';
    fileBtn.title = 'Upload an image and insert it as a picture line';

    var status = document.createElement('span');
    status.className = 'img-upload-status';

    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.hidden = true;

    holder.appendChild(fileBtn);
    holder.appendChild(fileInput);
    holder.appendChild(status);

    var parent = ta.parentNode;
    parent.appendChild(holder);

    fileBtn.addEventListener('click', function () { fileInput.click(); });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      status.textContent = 'Uploading…';
      status.classList.remove('ok', 'err');
      uploadImage(file).then(function (url) {
        var cap = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
        var line = '![' + (cap || 'photo') + '](' + url + ')';
        var cur = ta.value;
        ta.value = (cur.length && cur.slice(-1) !== '\n' ? cur + '\n' : cur) + line + '\n';
        status.textContent = 'Inserted ✓';
        status.classList.add('ok');
        fireInput(ta);
        if (opts.onUpload) opts.onUpload(url);
      }).catch(function (err) {
        status.textContent = (err && err.message) ? err.message : 'Upload failed';
        status.classList.add('err');
      }).then(function () {
        fileInput.value = '';
      });
    });

    if (opts.after) opts.after(holder);
  };

  /* ---------- date helpers for projects ---------- */
  var MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH_NAMES_FULL = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];

  function parseDate(str) {
    if (!str) return null;
    var parts = String(str).split('-');
    if (parts.length !== 3) return null;
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }

  function formatDateShort(d) {
    if (!d) return '';
    return MONTH_NAMES_SHORT[d.getMonth()] + ' ' + d.getDate();
  }

  function formatDateFull(d) {
    if (!d) return '';
    return MONTH_NAMES_FULL[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  }

  function formatDateMonthYear(d) {
    if (!d) return '';
    return MONTH_NAMES_FULL[d.getMonth()] + ' ' + d.getFullYear();
  }

  function generateTimeframe(startDate, endDate) {
    var sd = parseDate(startDate);
    var ed = parseDate(endDate);
    if (!sd && !ed) return '';
    if (sd && !ed) return formatDateMonthYear(sd);
    if (!sd && ed) return formatDateMonthYear(ed);
    /* both dates present */
    if (sd.getTime() === ed.getTime()) return formatDateFull(sd);
    if (sd.getMonth() === ed.getMonth() && sd.getFullYear() === ed.getFullYear()) {
      return MONTH_NAMES_FULL[sd.getMonth()] + ' ' + sd.getDate() + ' – ' + ed.getDate() + ', ' + sd.getFullYear();
    }
    if (sd.getFullYear() === ed.getFullYear()) {
      return MONTH_NAMES_SHORT[sd.getMonth()] + ' – ' + MONTH_NAMES_SHORT[ed.getMonth()] + ' ' + sd.getFullYear();
    }
    return MONTH_NAMES_SHORT[sd.getMonth()] + ' ' + sd.getFullYear() + ' – ' + MONTH_NAMES_SHORT[ed.getMonth()] + ' ' + ed.getFullYear();
  }

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
    var sd = parseDate(val('f-start-date'));
    var ed = parseDate(val('f-end-date'));
    var dateDisplay = sd || ed ? (sd ? formatDateShort(sd) : '') + (sd && ed ? ' – ' : '') + (ed ? formatDateShort(ed) : '') : '';
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
            (dateDisplay ? '<span class="pill">&#128197; ' + esc(dateDisplay) + '</span>' : '') +
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

  /* ---------- highlights live preview (mirrors highlights.js rendering) ---------- */
  var hlCommitteeOf = function (slug) {
    return state.committees.find(function (c) { return c.slug === slug; }) || {};
  };
  var hlCatColor = function (h) {
    return HL_CAT_COLOR[h.category] || HL_CAT_COLOR.campus;
  };
  var hlCover = function (src, alt) {
    return src
      ? '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async" />'
      : '';
  };
  var hlBadge = function (h) {
    var label = h.tag || HL_CAT_LABEL[h.category] || 'Highlight';
    return '<span class="hl-pv-badge"><span class="hl-pv-dot"></span>' + esc(label) + '</span>';
  };

  function hlCard(h) {
    var blocks = splitBlocks(h.about);
    var img = blocks.images[0] || {};
    var com = hlCommitteeOf(h.committee);
    var comAccent = com.accent || com.color || '';
    var chips = '';
    if (h.committee && com.acronym) {
      chips = '<span class="hl-pv-com"><i style="background:' + esc(comAccent) + '"></i>' + esc(com.acronym) + '</span>';
    } else {
      chips = '<span class="hl-pv-com"><i style="background:' + esc(hlCatColor(h)) + '"></i>' + esc(HL_CAT_LABEL[h.category] || '') + '</span>';
    }
    var meta = [];
    if (h.date) meta.push('<span>' + esc(h.date) + '</span>');
    if (h.date && h.location) meta.push('<i class="hl-pv-sep"></i>');
    if (h.location) meta.push('<span>' + esc(h.location) + '</span>');

    return (
      '<article class="hl-pv-card" style="--hl-pv-cat:' + esc(hlCatColor(h)) + '">' +
        '<div class="hl-pv-media">' + hlCover(img.src, img.alt) + hlBadge(h) + '</div>' +
        '<div class="hl-pv-body">' +
          '<h4 class="hl-pv-title">' + (h.title ? esc(h.title) : '<em>Untitled moment</em>') + '</h4>' +
          '<div class="hl-pv-meta">' + meta.join('') + '</div>' +
          '<p class="hl-pv-summary">' + esc(h.summary) + '</p>' +
          '<div class="hl-pv-foot">' + chips +
            '<span class="hl-pv-open">Open story &#8594;</span>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function hlSpotlight(h) {
    var blocks = splitBlocks(h.about);
    var img = blocks.images[0] || {};
    var tag = h.tag || HL_CAT_LABEL[h.category] || 'Highlight';
    var meta = [];
    if (h.date) meta.push(esc(h.date));
    if (h.location) meta.push(esc(h.location));

    return (
      '<article class="hl-pv-spot" style="--hl-pv-cat:' + esc(hlCatColor(h)) + '">' +
        '<div class="hl-pv-spot-media">' + hlCover(img.src, img.alt) + '</div>' +
        '<div class="hl-pv-spot-body">' +
          '<span class="hl-pv-spot-tag"><i class="hl-pv-dot"></i>' + esc(tag) + '</span>' +
          '<h4 class="hl-pv-spot-title">' + (h.title ? esc(h.title) : '<em>Untitled moment</em>') + '</h4>' +
          (meta.length ? '<div class="hl-pv-spot-meta">' + meta.join('<i class="hl-pv-sep"></i>') + '</div>' : '') +
          '<p class="hl-pv-spot-summary">' + esc(h.summary) + '</p>' +
          '<span class="hl-pv-spot-more">Read the full story &#8594;</span>' +
        '</div>' +
      '</article>'
    );
  }

  function hlStory(h) {
    var blocks = splitBlocks(h.about);
    var hero = blocks.images[0] || {};
    var gallery = blocks.images.slice(1);
    var com = hlCommitteeOf(h.committee);
    var tag = h.tag || HL_CAT_LABEL[h.category] || 'Highlight';

    var pills = [];
    if (h.date) pills.push('<span class="hl-pv-pill">' + esc(h.date) + '</span>');
    if (h.location) pills.push('<span class="hl-pv-pill">' + esc(h.location) + '</span>');
    pills.push('<span class="hl-pv-pill"><i style="background:' + esc(hlCatColor(h)) + '"></i>' + esc(tag) + '</span>');
    if (com.acronym) {
      pills.push('<span class="hl-pv-pill"><i style="background:' + esc(com.accent || com.color || '') + '"></i>' + esc(com.acronym) + '</span>');
    }

    var galleryHtml = gallery.length
      ? '<div class="hl-pv-gallery">' + gallery.map(function (g) {
          return '<figure class="hl-pv-g-img">' +
            '<img src="' + esc(g.src) + '" alt="' + esc(g.alt) + '" loading="lazy" decoding="async" />' +
            (g.alt ? '<figcaption>' + esc(g.alt) + '</figcaption>' : '') +
          '</figure>';
        }).join('') + '</div>'
      : '';

    return (
      '<div class="hl-pv-story">' +
        '<div class="hl-pv-story-hero">' + hlCover(hero.src, hero.alt) + '</div>' +
        '<div class="hl-pv-story-body">' +
          '<h4 class="hl-pv-story-title">' + (h.title ? esc(h.title) : '<em>Untitled moment</em>') + '</h4>' +
          '<div class="hl-pv-story-meta">' + pills.join('') + '</div>' +
          '<div class="hl-pv-story-prose">' + blocks.paras + '</div>' +
          galleryHtml +
        '</div>' +
      '</div>'
    );
  }

  function renderHighlightPreview() {
    var pre = el('hl-preview');
    if (!pre) return;
    var h = {
      category: val('f-cat'),
      tag: val('f-tag').trim(),
      title: val('f-title').trim(),
      date: val('f-date').trim(),
      location: val('f-loc').trim(),
      committee: val('f-committee'),
      summary: val('f-summary').trim(),
      about: splitLines(val('f-about')),
      featured: el('f-feat') ? el('f-feat').checked : false
    };
    var featured = el('f-feat') ? el('f-feat').checked : false;
    pre.innerHTML =
      '<div class="hl-pv-block"><div class="hl-pv-heading">Grid card</div>' + hlCard(h) + '</div>' +
      (featured ? '<div class="hl-pv-block"><div class="hl-pv-heading">Spotlight (featured)</div>' + hlSpotlight(h) + '</div>' : '') +
      '<div class="hl-pv-block"><div class="hl-pv-heading">Story (modal)</div>' + hlStory(h) + '</div>';
  }

  /* ---------- executive board live preview (mirrors executive.js slideHtml) ---------- */
  var exInitials = function (name) {
    return String(name || '').split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase(); })
      .slice(0, 2).join('');
  };

  function execSlide(m, i) {
    var p = val('x-photo');
    var name = val('x-name');
    var role = val('x-role');
    var quote = val('x-quote');
    var pos = imgFramePos(p);
    var photo = p
      ? '<div class="ex-pv-photo"><img src="' + esc(p) + '" alt="Portrait of ' + esc(name) + '"' + (pos ? ' style="object-position:' + pos + '"' : '') + ' loading="lazy" decoding="async" /></div>'
      : '<div class="ex-pv-photo ex-pv-photo--avatar"><span class="ex-pv-avatar">' + esc(exInitials(name)) + '</span></div>';

    /* use the actual saved object's values so the table-side preview stays correct */
    if (!m) {
      m = { name: name, role: role, quote: quote, photo: p };
      i = 0;
    }

    return (
      '<div class="ex-pv-slide' + (i % 2 ? ' is-flip' : '') + '">' +
        '<div class="ex-pv-quote">' +
          '<span class="ex-pv-mark" aria-hidden="true">&ldquo;</span>' +
          '<blockquote class="ex-pv-text">' + (esc(quote || m.quote)) + '</blockquote>' +
          '<p class="ex-pv-attr">' + esc(role || m.role) + ' &middot; KMC &times; IFMSA</p>' +
        '</div>' +
        '<figure class="ex-pv-photo-block">' +
          photo +
          '<figcaption class="ex-pv-cap">' +
            '<span class="ex-pv-name">' + esc(name || m.name) + '</span>' +
            '<span class="ex-pv-role">' + esc(role || m.role) + '</span>' +
          '</figcaption>' +
        '</figure>' +
      '</div>'
    );
  }

  function renderExecPreview() {
    var pre = el('ex-preview');
    if (!pre) return;
    pre.innerHTML = execSlide(null, 0);
  }

  /* ---------- alumni live preview (mirrors alumni.js rendering) ---------- */
  var alInitials = function (name) {
    return String(name || '').split(/\s+/).filter(Boolean)
      .map(function (w) { return w.charAt(0).toUpperCase(); })
      .slice(0, 2).join('');
  };
  var alTrackKey = function (track) {
    return String(track || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  var alTrack = function (track) {
    return AL_TRACK_BY_KEY[alTrackKey(track)] || AL_TRACK_BY_KEY.clinical;
  };

  function alMedia(a, size) {
    var cls = size === 'feat' ? 'al-pv-avatar al-pv-avatar--feat' : 'al-pv-avatar';
    var pos = imgFramePos(a.photo);
    return a.photo
      ? '<img src="' + esc(a.photo) + '" alt="Portrait of ' + esc(a.name) + '"' + (pos ? ' style="object-position:' + pos + '"' : '') + ' loading="lazy" decoding="async" />'
      : '<div class="' + cls + '"><span>' + esc(alInitials(a.name)) + '</span></div>';
  }

  function alCard(a) {
    var t = alTrack(a.track);
    var hasStory = splitBlocks(a.story).paras.length > 0;
    return (
      '<article class="al-pv-card" style="--al-pv-accent:' + t.color + '">' +
        '<div class="al-pv-media">' + alMedia(a) +
          '<span class="al-pv-pill"><i></i>' + esc(t.label) + '</span>' +
        '</div>' +
        '<div class="al-pv-body">' +
          '<h4 class="al-pv-name">' + (a.name ? esc(a.name) : '<em>Untitled alumnus</em>') + '</h4>' +
          '<p class="al-pv-role">' + esc(a.role_now) + '</p>' +
          '<div class="al-pv-meta">' +
            (a.cohort ? '<span>' + esc(a.cohort) + '</span>' : '') +
            (a.cohort && a.location ? '<i></i>' : '') +
            (a.location ? '<span>' + esc(a.location) + '</span>' : '') +
          '</div>' +
          (a.quote ? '<p class="al-pv-quote">' + esc(a.quote) + '</p>' : '') +
          '<div class="al-pv-foot">' +
            (a.committees ? '<span class="al-pv-com">' + esc(a.committees) + '</span>' : '') +
            (hasStory ? '<span class="al-pv-open">Read story &#8594;</span>' : '') +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function alFeatured(a) {
    var t = alTrack(a.track);
    var hasStory = splitBlocks(a.story).paras.length > 0;
    return (
      '<article class="al-pv-feat" style="--al-pv-accent:' + t.color + '">' +
        '<div class="al-pv-feat-media">' + alMedia(a, 'feat') + '</div>' +
        '<div class="al-pv-feat-body">' +
          '<span class="al-pv-pill"><i></i>' + esc(t.label) + '</span>' +
          '<h4 class="al-pv-feat-name">' + (a.name ? esc(a.name) : '<em>Untitled alumnus</em>') + '</h4>' +
          '<p class="al-pv-feat-role">' + esc(a.role_now) + '</p>' +
          '<p class="al-pv-feat-quote">' + esc(a.quote) + '</p>' +
          (hasStory ? '<span class="al-pv-open">Read their story &#8594;</span>' : '') +
        '</div>' +
      '</article>'
    );
  }

  function alStory(a) {
    var blocks = splitBlocks(a.story);
    var t = alTrack(a.track);
    return (
      '<div class="al-pv-story">' +
        '<div class="al-pv-story-body">' +
          '<h4 class="al-pv-story-name">' + (a.name ? esc(a.name) : '<em>Untitled alumnus</em>') + '</h4>' +
          '<p class="al-pv-story-role">' + esc(a.role_now) + '</p>' +
          '<div class="al-pv-story-meta">' +
            '<span class="al-pv-pill"><i></i>' + esc(t.label) + '</span>' +
            (a.cohort ? '<span class="al-pv-pill">' + esc(a.cohort) + '</span>' : '') +
            (a.location ? '<span class="al-pv-pill">' + esc(a.location) + '</span>' : '') +
            (a.specialty ? '<span class="al-pv-pill">' + esc(a.specialty) + '</span>' : '') +
            (a.committees ? '<span class="al-pv-pill">' + esc(a.committees) + '</span>' : '') +
          '</div>' +
          '<div class="al-pv-prose">' + blocks.paras + '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderAlumniPreview() {
    var pre = el('al-preview');
    if (!pre) return;
    var a = {
      name: val('a-name').trim(),
      cohort: val('a-cohort').trim(),
      track: val('a-track'),
      role_now: val('a-role').trim(),
      location: val('a-loc').trim(),
      specialty: val('a-specialty').trim(),
      committees: val('a-committees').trim(),
      photo: val('a-photo').trim(),
      quote: val('a-quote').trim(),
      story: splitLines(val('a-story')),
      featured: el('a-featured') ? el('a-featured').checked : false
    };
    pre.innerHTML =
      '<div class="al-pv-block"><div class="al-pv-heading">Grid card</div>' + alCard(a) + '</div>' +
      (a.featured ? '<div class="al-pv-block"><div class="al-pv-heading">Featured (spotlight)</div>' + alFeatured(a) + '</div>' : '') +
      '<div class="al-pv-block"><div class="al-pv-heading">Story (modal)</div>' + alStory(a) + '</div>';
  }

  /* ============ awards live preview (mirrors awards.js rendering) ============ */
  var AW_MEDAL_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="6"></circle><path d="M15.5 13 17 22l-5-3-5 3 1.5-9"></path></svg>';
  var awMedalBadge = function (a, cls) {
    var m = String(a.medal || '').toLowerCase();
    if (!m || !AW_MEDAL_LABEL[m]) return '';
    return '<span class="' + cls + '">' + AW_MEDAL_ICON + AW_MEDAL_LABEL[m] + '</span>';
  };
  var awKicker = function (a) {
    var bits = [];
    if (a.year) bits.push('<span>' + esc(a.year) + '</span>');
    if (a.location) bits.push('<span>' + esc(a.location) + '</span>');
    return '<div class="aw-pv-kicker">' + bits.join('<i></i>') + '</div>';
  };
  var awCover = function (a, cls) {
    var blocks = splitBlocks(a.about);
    var img = blocks.images[0] || {};
    return img.src
      ? '<img src="' + esc(img.src) + '" alt="' + esc(a.title) + '" loading="lazy" decoding="async" />'
      : '<div class="' + cls + '"><span>' + esc(alInitials(a.awardee || a.title)) + '</span></div>';
  };

  function awFrameStyles(fs) {
    if (!fs) return '';
    var s = [];
    if (fs.aspect) s.push('aspect-ratio:' + fs.aspect);
    if (fs.radius === 'none') s.push('border-radius:0');
    else if (fs.radius === 'sm') s.push('border-radius:6px');
    else if (fs.radius === 'md') s.push('border-radius:12px');
    else if (fs.radius === 'lg') s.push('border-radius:20px');
    else if (fs.radius === 'xl') s.push('border-radius:28px');
    else if (fs.radius === 'full') s.push('border-radius:9999px');
    if (fs.border === 'none') s.push('border:0');
    else if (fs.border === 'thin') s.push('border:1px solid rgba(30,27,82,0.12)');
    else if (fs.border === 'thick') s.push('border:3px solid rgba(30,27,82,0.18)');
    if (fs.shadow === 'none') s.push('box-shadow:none');
    else if (fs.shadow === 'sm') s.push('box-shadow:0 4px 12px -4px rgba(30,27,82,0.12)');
    else if (fs.shadow === 'md') s.push('box-shadow:0 12px 28px -8px rgba(30,27,82,0.22)');
    else if (fs.shadow === 'lg') s.push('box-shadow:0 20px 44px -10px rgba(30,27,82,0.32)');
    return s.length ? ' style="' + esc(s.join(';')) + '"' : '';
  }

  function awGenericCard(a) {
    var c = awCatOf(a.category);
    return (
      '<article class="aw-pv-card" style="--aw-pv-cat:' + c.color + '">' +
        '<div class="aw-pv-media"' + awFrameStyles(a.frame_style) + '>' + awCover(a, 'aw-pv-avatar') + awMedalBadge(a, 'aw-pv-medal') + '</div>' +
        '<div class="aw-pv-body">' +
          awKicker(a) +
          '<h4 class="aw-pv-title">' + (a.title ? esc(a.title) : '<em>Untitled award</em>') + '</h4>' +
          (a.awardee ? '<p class="aw-pv-awardee">' + esc(a.awardee) + (a.role ? ' · ' + esc(a.role) : '') + '</p>' : '') +
          '<p class="aw-pv-summary">' + esc(a.summary) + '</p>' +
          '<div class="aw-pv-foot"><span class="aw-pv-source">' + esc(a.source || c.label) + '</span><span class="aw-pv-open">View recognition &#8594;</span></div>' +
        '</div>' +
      '</article>'
    );
  }

  function awPersonCard(a) {
    var c = awCatOf(a.category);
    return (
      '<article class="aw-pv-card" style="--aw-pv-cat:' + c.color + '">' +
        '<div class="aw-pv-media aw-pv-media--person"' + awFrameStyles(a.frame_style) + '>' + awCover(a, 'aw-pv-avatar') + awMedalBadge(a, 'aw-pv-medal') + '</div>' +
        '<div class="aw-pv-body">' +
          awKicker(a) +
          '<h4 class="aw-pv-title">' + (a.title ? esc(a.title) : '<em>Untitled award</em>') + '</h4>' +
          (a.awardee ? '<p class="aw-pv-awardee">' + esc(a.awardee) + '</p>' : '') +
          (a.role ? '<p class="aw-pv-role">' + esc(a.role) + '</p>' : '') +
          '<p class="aw-pv-summary">' + esc(a.summary) + '</p>' +
          '<div class="aw-pv-foot"><span class="aw-pv-source">' + esc(a.source || c.label) + '</span><span class="aw-pv-open">View recognition &#8594;</span></div>' +
        '</div>' +
      '</article>'
    );
  }

  function awPaper(a) {
    var c = awCatOf(a.category);
    var meta = [];
    if (a.source) meta.push('<span>' + esc(a.source) + '</span>');
    if (a.year) meta.push('<span>' + esc(a.year) + '</span>');
    var doi = a.link
      ? '<a class="aw-pv-doi" href="' + esc(a.link) + '" target="_blank" rel="noopener">' + esc(/^https?:\/\//i.test(a.link) ? 'Open link' : 'DOI ' + a.link) + '</a>'
      : '';
    return (
      '<article class="aw-pv-paper" style="--aw-pv-cat:' + c.color + '">' +
        '<div class="aw-pv-paper-main">' +
          '<div class="aw-pv-paper-meta">' + meta.join('<i></i>') + '</div>' +
          '<h4 class="aw-pv-title">' + (a.title ? esc(a.title) : '<em>Untitled paper</em>') + '</h4>' +
          (a.awardee ? '<p class="aw-pv-authors">' + esc(a.awardee) + '</p>' : '') +
          '<p class="aw-pv-summary">' + esc(a.summary) + '</p>' +
        '</div>' +
        doi +
      '</article>'
    );
  }

  function awPod(a) {
    var c = awCatOf(a.category);
    return (
      '<article class="aw-pv-pod" style="--aw-pv-cat:' + c.color + '">' +
        '<div class="aw-pv-pod-media"' + awFrameStyles(a.frame_style) + '>' + awCover(a, 'aw-pv-avatar') + awMedalBadge(a, 'aw-pv-medal') + '</div>' +
        '<div class="aw-pv-pod-body">' +
          '<span class="aw-pv-pill"><i></i>' + esc(c.label) + '</span>' +
          '<h4 class="aw-pv-pod-title">' + (a.title ? esc(a.title) : '<em>Untitled award</em>') + '</h4>' +
          (a.awardee ? '<p class="aw-pv-awardee">' + esc(a.awardee) + '</p>' : '') +
          (a.role ? '<p class="aw-pv-role">' + esc(a.role) + '</p>' : '') +
          '<p class="aw-pv-summary">' + esc(a.summary) + '</p>' +
          '<span class="aw-pv-open">Read the full story &#8594;</span>' +
        '</div>' +
      '</article>'
    );
  }

  function renderAwardsPreview() {
    var pre = el('aw-preview');
    if (!pre) return;
    var a = {
      category: val('w-cat'),
      title: val('w-title').trim(),
      awardee: val('w-awardee').trim(),
      role: val('w-role').trim(),
      year: val('w-year').trim(),
      location: val('w-loc').trim(),
      source: val('w-source').trim(),
      link: val('w-link').trim(),
      summary: val('w-summary').trim(),
      about: splitLines(val('w-about')),
      medal: val('w-medal'),
      featured: el('w-featured') ? el('w-featured').checked : false,
      frame_style: {
        aspect: val('w-frame-aspect'),
        radius: val('w-frame-radius'),
        border: val('w-frame-border'),
        shadow: val('w-frame-shadow')
      }
    };
    var card = a.category === 'research' ? awPaper(a) : (a.category === 'officer' ? awPersonCard(a) : awGenericCard(a));
    pre.innerHTML =
      '<div class="aw-pv-block"><div class="aw-pv-heading">' + (a.category === 'research' ? 'Publication entry' : 'Card') + '</div>' + card + '</div>' +
      (a.featured ? '<div class="aw-pv-block"><div class="aw-pv-heading">Hall of Fame (featured)</div>' + awPod(a) + '</div>' : '');
  }

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
        '<button data-tab="highlights">Highlights</button>' +
        '<button data-tab="executive">Executive Board</button>' +
        '<button data-tab="alumni">Alumni</button>' +
        '<button data-tab="awards">Awards</button>' +
        '<button data-tab="settings">Settings</button>' +
        '<button data-tab="cards">Feature Cards</button>' +
      '</nav>' +
      '<main id="tab-projects" class="tab-pane"></main>' +
      '<main id="tab-committees" class="tab-pane" hidden></main>' +
      '<main id="tab-highlights" class="tab-pane" hidden></main>' +
      '<main id="tab-executive" class="tab-pane" hidden></main>' +
      '<main id="tab-alumni" class="tab-pane" hidden></main>' +
      '<main id="tab-awards" class="tab-pane" hidden></main>' +
      '<main id="tab-settings" class="tab-pane" hidden></main>' +
      '<main id="tab-cards" class="tab-pane" hidden></main>' +
      '<div id="modal-root"></div>';

    el('logout-btn').addEventListener('click', logout);
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        state.tab = b.getAttribute('data-tab');
        document.querySelectorAll('#tabs button').forEach(function (x) {
          x.classList.toggle('active', x === b);
        });
        ['projects', 'committees', 'highlights', 'executive', 'alumni', 'awards', 'settings', 'cards'].forEach(function (t) {
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
      sb.from('site_settings').select('key, value'),
      sb.from('highlights').select('*').order('sort_order'),
      sb.from('exec_board').select('*').order('sort_order'),
      sb.from('alumni').select('*').order('sort_order'),
      sb.from('awards').select('*').order('sort_order')
    ]).then(function (rs) {
      if (rs[0].error) throw rs[0].error;
      if (rs[1].error) throw rs[1].error;
      if (rs[2].error) throw rs[2].error;
      state.committees = rs[0].data || [];
      state.projects = rs[1].data || [];
      state.settings = { site: {}, hero: {}, about: {}, join: {}, exec: {}, highlights: {}, alumni: {}, awards: {} };
      (rs[2].data || []).forEach(function (s) { state.settings[s.key] = s.value || {}; });
      state.highlights = rs[3].data || [];
      state.execBoard = rs[4].data || [];
      state.alumni = rs[5].data || [];
      state.awards = rs[6].data || [];
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
    else if (state.tab === 'highlights') renderHighlights();
    else if (state.tab === 'executive') renderExecutive();
    else if (state.tab === 'alumni') renderAlumni();
    else if (state.tab === 'awards') renderAwards();
    else if (state.tab === 'cards') renderCards();
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
      title: '', type: '', status: 'Planned', start_date: '', end_date: '', timeframe: '', theme: '',
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
            '<label class="full">Date range<div class="date-range">' +
              '<label style="margin:0">Start date<input type="date" id="f-start-date" value="' + esc(p.start_date || '') + '" /></label>' +
              '<span class="date-range-sep">to</span>' +
              '<label style="margin:0">End date<input type="date" id="f-end-date" value="' + esc(p.end_date || '') + '" /></label>' +
            '</div></label>' +
            '<label class="full">Timeframe (auto-generated)<input type="text" id="f-timeframe" value="' + esc(p.timeframe) + '" readonly style="opacity:0.7;cursor:not-allowed" /></label>' +
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

    ['f-title', 'f-committee', 'f-type', 'f-status', 'f-start-date', 'f-end-date', 'f-theme',
     'f-summary', 'f-about', 'f-goals'].forEach(function (id) {
      var input = el(id);
      if (!input) return;
      input.addEventListener('input', renderProjectPreview);
      input.addEventListener('change', renderProjectPreview);
    });

    var updateAutoTimeframe = function () {
      var sd = val('f-start-date');
      var ed = val('f-end-date');
      var tf = generateTimeframe(sd, ed);
      var tfInput = el('f-timeframe');
      if (tfInput) tfInput.value = tf;
      renderProjectPreview();
    };
    var startDate = el('f-start-date');
    var endDate = el('f-end-date');
    if (startDate) startDate.addEventListener('change', updateAutoTimeframe);
    if (endDate) endDate.addEventListener('change', updateAutoTimeframe);
    updateAutoTimeframe();

    attachMarkdownUpload('f-about');
    renderProjectPreview();

    el('m-save').addEventListener('click', function () {
      var startDate = val('f-start-date').trim() || null;
      var endDate = val('f-end-date').trim() || null;
      var row = {
        id: val('f-id').trim(),
        committee: val('f-committee'),
        title: val('f-title').trim(),
        type: val('f-type').trim() || null,
        status: val('f-status').trim() || null,
        start_date: startDate,
        end_date: endDate,
        timeframe: generateTimeframe(startDate, endDate) || null,
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
        '<thead><tr><th>Acronym</th><th>Name</th><th>Colour</th><th>Logo</th><th>Group Photo</th><th class="actions-cell">Actions</th></tr></thead>' +
        '<tbody>' + state.committees.map(function (c) {
          return '<tr>' +
            '<td><strong>' + esc(c.acronym) + '</strong></td>' +
            '<td>' + esc(c.name) + '</td>' +
            '<td><span class="color-chip" style="background:' + esc(c.color || '#fff') + '"></span>' + esc(c.color || '') + '</td>' +
            '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.logo || '') + '</td>' +
            '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.group_photo || '—') + '</td>' +
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
    c = c || { slug: '', acronym: '', name: '', color: '', accent: '', logo: '', group_photo: '', members: '', sort_order: state.committees.length };
    openModal(
      '<h2>' + (c.slug ? 'Edit committee' : 'New committee') + '</h2>' +
      '<div class="form-grid">' +
        '<label>Slug<input type="text" id="c-slug" value="' + esc(c.slug) + '" ' + (c.slug ? 'readonly' : 'required') + ' placeholder="e.g. scope" /></label>' +
        '<label>Sort order<input type="number" id="c-sort" value="' + (c.sort_order || 0) + '" /></label>' +
        '<label>Acronym<input type="text" id="c-acronym" value="' + esc(c.acronym) + '" required /></label>' +
        '<label>Name<input type="text" id="c-name" value="' + esc(c.name) + '" required /></label>' +
        '<label>Colour<input type="text" id="c-color" value="' + esc(c.color) + '" placeholder="#0180C8" /></label>' +
        '<label>Accent<input type="text" id="c-accent" value="' + esc(c.accent) + '" placeholder="#0180C8" /></label>' +
        '<label class="full">Logo — upload or paste a URL<input type="text" id="c-logo" value="' + esc(c.logo) + '" placeholder="Leave blank to hide the logo" /></label>' +
        '<label class="full">Group photo — upload or paste a URL<input type="text" id="c-group-photo" value="' + esc(c.group_photo || '') + '" placeholder="Photo of the committee members" /></label>' +
        '<label class="full">Members — one name per line (displayed under the group photo)<textarea id="c-members" placeholder="John Doe\nJane Smith\n...">' + esc(c.members || '') + '</textarea></label>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button class="btn" id="m-cancel">Cancel</button>' +
        '<button class="btn btn-primary" id="m-save">Save committee</button>' +
      '</div>'
    );

    attachImageUpload('c-logo');
    attachImageUpload('c-group-photo');

    el('m-save').addEventListener('click', function () {
      var row = {
        slug: val('c-slug').trim().toLowerCase(),
        acronym: val('c-acronym').trim(),
        name: val('c-name').trim(),
        color: val('c-color').trim() || null,
        accent: val('c-accent').trim() || null,
        logo: val('c-logo').trim() || null,
        group_photo: val('c-group-photo').trim() || null,
        members: val('c-members').trim() || null,
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

  /* ============ highlights (Highlights page) ============ */
  function renderHighlights() {
    var pane = el('tab-highlights');
    var comBySlug = {};
    state.committees.forEach(function (c) { comBySlug[c.slug] = c; });

    var rows = state.highlights.slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    pane.innerHTML =
      '<div class="toolbar">' +
        '<div></div>' +
        '<button class="btn btn-primary" id="hl-new">+ New highlight</button>' +
      '</div>' +
      '<div class="count">' + rows.length + ' highlight' + (rows.length === 1 ? '' : 's') + '</div>' +
      '<table class="table">' +
        '<thead><tr><th>Title</th><th>Category</th><th>Tag</th><th>Committee</th><th>Spotlight</th><th class="actions-cell">Actions</th></tr></thead>' +
        '<tbody>' + rows.map(function (h) {
          var com = comBySlug[h.committee] || {};
          return '<tr>' +
            '<td><strong>' + esc(h.title) + '</strong></td>' +
            '<td><span class="tag" style="color:' + esc(HL_CAT_COLOR[h.category] || '') + '">' + esc(HL_CAT_LABEL[h.category] || h.category || '') + '</span></td>' +
            '<td>' + esc(h.tag || '') + '</td>' +
            '<td>' + esc(com.acronym || '') + '</td>' +
            '<td>' + (h.featured ? '&#9733;' : '') + '</td>' +
            '<td class="actions-cell">' +
              '<button class="btn btn-small" data-edit="' + esc(h.id) + '">Edit</button> ' +
              '<button class="btn btn-small btn-danger" data-del="' + esc(h.id) + '">Delete</button>' +
            '</td></tr>';
        }).join('') +
        (rows.length ? '' : '<tr><td colspan="6" class="empty">No highlights yet.</td></tr>') +
        '</tbody>' +
      '</table>';

    el('hl-new').addEventListener('click', function () { highlightModal(null); });
    pane.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        highlightModal(state.highlights.find(function (h) { return h.id === b.getAttribute('data-edit'); }));
      });
    });
    pane.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { delHighlight(b.getAttribute('data-del')); });
    });
  }

  function highlightModal(h) {
    h = h || {
      id: '', category: 'campus', tag: '', title: '', date: '', location: '',
      committee: '', summary: '', about: [], featured: false, sort_order: state.highlights.length
    };

    openModal(
      '<h2>' + (h.id ? 'Edit highlight' : 'New highlight') + '</h2>' +
      '<div class="modal-body">' +
        '<div class="modal-form">' +
          '<div class="form-grid">' +
            '<label class="full">Title<input type="text" id="f-title" value="' + esc(h.title) + '" required /></label>' +
            '<label>Category<select id="f-cat">' + HL_CAT_OPTIONS(h.category) + '</select></label>' +
            '<label>Tag<input type="text" id="f-tag" value="' + esc(h.tag) + '" placeholder="e.g. Campus Campaign" /></label>' +
            '<label>Date<input type="text" id="f-date" value="' + esc(h.date) + '" placeholder="March 2026" /></label>' +
            '<label>Location<input type="text" id="f-loc" value="' + esc(h.location) + '" placeholder="Cape Town, South Africa" /></label>' +
            '<label>Committee<select id="f-committee"><option value="">— none —</option>' + committeeOptions(h.committee) + '</select></label>' +
            '<label>Sort order<input type="number" id="f-sort" value="' + (h.sort_order || 0) + '" /></label>' +
            '<label class="full check"><input type="checkbox" id="f-feat"' + (h.featured ? ' checked' : '') + ' /> Feature as the spotlight</label>' +
            '<label class="full">Summary<textarea id="f-summary">' + esc(h.summary) + '</textarea></label>' +
            '<label class="full">About — one paragraph per line; insert a picture on its own line as <code>![caption](image-url)</code><textarea id="f-about">' + esc((h.about || []).join('\n')) + '</textarea></label>' +
            '<label class="full">ID (leave blank to auto-generate)<input type="text" id="f-id" value="' + esc(h.id) + '" placeholder="e.g. hl-2026-summer-campaign" /></label>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button class="btn" id="m-cancel">Cancel</button>' +
            '<button class="btn btn-primary" id="m-save">Save highlight</button>' +
          '</div>' +
        '</div>' +
        '<div class="preview-pane">' +
          '<div class="preview-label">Live preview</div>' +
          '<div class="hl-preview" id="hl-preview"></div>' +
        '</div>' +
      '</div>',
      'modal--wide'
    );

    ['f-title', 'f-cat', 'f-tag', 'f-date', 'f-loc', 'f-committee',
     'f-summary', 'f-about', 'f-feat'].forEach(function (id) {
      var input = el(id);
      if (!input) return;
      input.addEventListener('input', renderHighlightPreview);
      input.addEventListener('change', renderHighlightPreview);
    });
    attachMarkdownUpload('f-about');
    renderHighlightPreview();

    el('m-save').addEventListener('click', function () {
      var row = {
        id: val('f-id').trim(),
        category: val('f-cat'),
        tag: val('f-tag').trim() || null,
        title: val('f-title').trim(),
        date: val('f-date').trim() || null,
        location: val('f-loc').trim() || null,
        committee: val('f-committee') || null,
        summary: val('f-summary').trim() || null,
        about: splitLines(val('f-about')),
        featured: !!el('f-feat').checked,
        sort_order: parseInt(val('f-sort'), 10) || 0
      };
      if (el('f-feat').checked) {
        // un-feature any other spotlight before saving this one
        var others = state.highlights.filter(function (x) { return x.featured && x.id !== row.id; });
        if (others.length) {
          var keys = others.map(function (x) { return x.id; });
          sb.from('highlights').update({ featured: false }).in('id', keys)
            .then(function () { doSaveHighlight(row); });
          return;
        }
      }
      doSaveHighlight(row);
    });
  }

  function doSaveHighlight(row) {
    if (!row.title || !row.id) {
      if (!row.title) { alert('Title is required.'); return; }
      row.id = slugify(row.title);
      if (!row.id) { alert('Give the highlight an ID.'); return; }
    }
    sb.from('highlights').upsert(row).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      closeModal();
      loadData().then(renderHighlights);
    });
  }

  function delHighlight(id) {
    if (!confirm('Delete this highlight?')) return;
    sb.from('highlights').delete().eq('id', id).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      loadData().then(renderHighlights);
    });
  }

  /* ============ executive board (Meet the Executive Board page) ============ */
  function renderExecutive() {
    var pane = el('tab-executive');

    var rows = state.execBoard.slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    pane.innerHTML =
      '<div class="toolbar">' +
        '<div></div>' +
        '<button class="btn btn-primary" id="ex-new">+ Add member</button>' +
      '</div>' +
      '<div class="count">' + rows.length + ' board member' + (rows.length === 1 ? '' : 's') + '</div>' +
      '<table class="table">' +
        '<thead><tr><th>Name</th><th>Role</th><th>Photo</th><th class="actions-cell">Actions</th></tr></thead>' +
        '<tbody>' + rows.map(function (m) {
          return '<tr>' +
            '<td><strong>' + esc(m.name) + '</strong></td>' +
            '<td>' + esc(m.role) + '</td>' +
            '<td style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(m.photo || '—') + '</td>' +
            '<td class="actions-cell">' +
              '<button class="btn btn-small" data-edit="' + esc(m.id) + '">Edit</button> ' +
              '<button class="btn btn-small btn-danger" data-del="' + esc(m.id) + '">Delete</button>' +
            '</td></tr>';
        }).join('') +
        (rows.length ? '' : '<tr><td colspan="4" class="empty">No board members yet.</td></tr>') +
        '</tbody>' +
      '</table>';

    el('ex-new').addEventListener('click', function () { execModal(null); });
    pane.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        execModal(state.execBoard.find(function (m) { return m.id === b.getAttribute('data-edit'); }));
      });
    });
    pane.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { delExec(b.getAttribute('data-del')); });
    });
  }

  function execModal(m) {
    m = m || { id: '', name: '', role: '', photo: '', quote: '', sort_order: state.execBoard.length };

    openModal(
      '<h2>' + (m.id ? 'Edit board member' : 'Add board member') + '</h2>' +
      '<div class="modal-body">' +
        '<div class="modal-form">' +
          '<div class="form-grid">' +
            '<label class="full">Name<input type="text" id="x-name" value="' + esc(m.name) + '" required /></label>' +
            '<label class="full">Role<input type="text" id="x-role" value="' + esc(m.role) + '" required placeholder="e.g. Local Officer — SCOPE" /></label>' +
            '<label class="full">Photo — upload or paste a URL<input type="text" id="x-photo" value="' + esc(m.photo) + '" placeholder="Leave blank to show initials" /></label>' +
            '<label class="full">Quote<textarea id="x-quote">' + esc(m.quote) + '</textarea></label>' +
            '<label>Sort order<input type="number" id="x-sort" value="' + (m.sort_order || 0) + '" /></label>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button class="btn" id="m-cancel">Cancel</button>' +
            '<button class="btn btn-primary" id="m-save">Save member</button>' +
          '</div>' +
        '</div>' +
        '<div class="preview-pane">' +
          '<div class="preview-label">Live preview</div>' +
          '<div class="ex-preview" id="ex-preview"></div>' +
        '</div>' +
      '</div>',
      'modal--wide'
    );

    ['x-name', 'x-role', 'x-photo', 'x-quote'].forEach(function (id) {
      var input = el(id);
      if (!input) return;
      input.addEventListener('input', renderExecPreview);
      input.addEventListener('change', renderExecPreview);
    });
    attachImageUpload('x-photo');
    renderExecPreview();

    el('m-save').addEventListener('click', function () {
      var row = {
        name: val('x-name').trim(),
        role: val('x-role').trim(),
        photo: val('x-photo').trim() || null,
        quote: val('x-quote').trim() || null,
        sort_order: parseInt(val('x-sort'), 10) || 0
      };
      if (!row.name || !row.role) { alert('Name and role are required.'); return; }
      if (m.id) row.id = m.id;
      sb.from('exec_board').upsert(row).then(function (r) {
        if (r.error) { alert(r.error.message); return; }
        closeModal();
        loadData().then(renderExecutive);
      });
    });
  }

  function delExec(id) {
    if (!confirm('Remove this board member?')) return;
    sb.from('exec_board').delete().eq('id', id).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      loadData().then(renderExecutive);
    });
  }

  /* ============ alumni (Where they are now page) ============ */
  function renderAlumni() {
    var pane = el('tab-alumni');

    var rows = state.alumni.slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    pane.innerHTML =
      '<div class="toolbar">' +
        '<div></div>' +
        '<button class="btn btn-primary" id="al-new">+ Add alumnus</button>' +
      '</div>' +
      '<div class="count">' + rows.length + ' alumn' + (rows.length === 1 ? 'us' : 'i') + '</div>' +
      '<table class="table">' +
        '<thead><tr><th>Name</th><th>Track</th><th>Role now</th><th>Location</th><th>Featured</th><th class="actions-cell">Actions</th></tr></thead>' +
        '<tbody>' + rows.map(function (a) {
          var t = alTrack(a.track);
          return '<tr>' +
            '<td><strong>' + esc(a.name) + '</strong></td>' +
            '<td><span class="tag" style="color:' + esc(t.color) + '">' + esc(t.label) + '</span></td>' +
            '<td>' + esc(a.role_now || '') + '</td>' +
            '<td>' + esc(a.location || '') + '</td>' +
            '<td>' + (a.featured ? '&#9733;' : '') + '</td>' +
            '<td class="actions-cell">' +
              '<button class="btn btn-small" data-edit="' + esc(a.id) + '">Edit</button> ' +
              '<button class="btn btn-small btn-danger" data-del="' + esc(a.id) + '">Delete</button>' +
            '</td></tr>';
        }).join('') +
        (rows.length ? '' : '<tr><td colspan="6" class="empty">No alumni yet.</td></tr>') +
        '</tbody>' +
      '</table>';

    el('al-new').addEventListener('click', function () { alumniModal(null); });
    pane.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        alumniModal(state.alumni.find(function (a) { return String(a.id) === b.getAttribute('data-edit'); }));
      });
    });
    pane.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { delAlumnus(b.getAttribute('data-del')); });
    });
  }

  function alumniModal(a) {
    a = a || {
      id: '', name: '', cohort: '', track: 'clinical', role_now: '', location: '',
      specialty: '', committees: '', photo: '', quote: '', story: [],
      links: {}, featured: false, sort_order: state.alumni.length
    };

    openModal(
      '<h2>' + (a.id ? 'Edit alumnus' : 'Add alumnus') + '</h2>' +
      '<div class="modal-body">' +
        '<div class="modal-form">' +
          '<div class="form-grid">' +
            '<label class="full">Name<input type="text" id="a-name" value="' + esc(a.name) + '" required placeholder="e.g. Dr. Sana Yousafzai" /></label>' +
            '<label>Cohort<input type="text" id="a-cohort" value="' + esc(a.cohort) + '" placeholder="Batch of 2018" /></label>' +
            '<label>Track<select id="a-track">' + AL_TRACK_OPTIONS(alTrackKey(a.track)) + '</select></label>' +
            '<label>Sort order<input type="number" id="a-sort" value="' + (a.sort_order || 0) + '" /></label>' +
            '<label class="full">Role now<input type="text" id="a-role" value="' + esc(a.role_now) + '" placeholder="e.g. Resident — Internal Medicine" /></label>' +
            '<label class="full">Location<input type="text" id="a-loc" value="' + esc(a.location) + '" placeholder="Peshawar, Pakistan" /></label>' +
            '<label class="full">Specialty<input type="text" id="a-specialty" value="' + esc(a.specialty) + '" placeholder="e.g. Cardiology" /></label>' +
            '<label class="full">Committees<input type="text" id="a-committees" value="' + esc(a.committees) + '" placeholder="SCOPE, SCORE" /></label>' +
            '<label class="full">Photo — upload or paste a URL<input type="text" id="a-photo" value="' + esc(a.photo) + '" placeholder="Leave blank to show initials" /></label>' +
            '<label class="full">Quote (card)<textarea id="a-quote">' + esc(a.quote) + '</textarea></label>' +
            '<label class="full">Story (optional) — one paragraph per line<textarea id="a-story">' + esc((a.story || []).join('\n')) + '</textarea></label>' +
            '<label>LinkedIn URL<input type="text" id="a-linkedin" value="' + esc((a.links && a.links.linkedin) || '') + '" /></label>' +
            '<label>Twitter URL<input type="text" id="a-twitter" value="' + esc((a.links && a.links.twitter) || '') + '" /></label>' +
            '<label class="full">Email<input type="text" id="a-email" value="' + esc((a.links && a.links.email) || '') + '" /></label>' +
            '<label class="full check"><input type="checkbox" id="a-featured"' + (a.featured ? ' checked' : '') + ' /> Feature in the spotlight</label>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button class="btn" id="m-cancel">Cancel</button>' +
            '<button class="btn btn-primary" id="m-save">Save alumnus</button>' +
          '</div>' +
        '</div>' +
        '<div class="preview-pane">' +
          '<div class="preview-label">Live preview</div>' +
          '<div class="al-preview" id="al-preview"></div>' +
        '</div>' +
      '</div>',
      'modal--wide'
    );

    ['a-name', 'a-cohort', 'a-track', 'a-role', 'a-loc', 'a-specialty', 'a-committees',
     'a-photo', 'a-quote', 'a-story', 'a-featured'].forEach(function (id) {
      var input = el(id);
      if (!input) return;
      input.addEventListener('input', renderAlumniPreview);
      input.addEventListener('change', renderAlumniPreview);
    });
    attachImageUpload('a-photo');
    renderAlumniPreview();

    el('m-save').addEventListener('click', function () {
      var row = {
        name: val('a-name').trim(),
        cohort: val('a-cohort').trim() || null,
        track: val('a-track'),
        role_now: val('a-role').trim() || null,
        location: val('a-loc').trim() || null,
        specialty: val('a-specialty').trim() || null,
        committees: val('a-committees').trim() || null,
        photo: val('a-photo').trim() || null,
        quote: val('a-quote').trim() || null,
        story: splitLines(val('a-story')),
        links: {
          linkedin: val('a-linkedin').trim() || null,
          twitter: val('a-twitter').trim() || null,
          email: val('a-email').trim() || null
        },
        featured: !!el('a-featured').checked,
        sort_order: parseInt(val('a-sort'), 10) || 0
      };
      if (!row.name) { alert('Name is required.'); return; }
      if (a.id) row.id = a.id;
      sb.from('alumni').upsert(row).then(function (r) {
        if (r.error) { alert(r.error.message); return; }
        closeModal();
        loadData().then(renderAlumni);
      });
    });
  }

  function delAlumnus(id) {
    if (!confirm('Remove this alumnus?')) return;
    sb.from('alumni').delete().eq('id', id).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      loadData().then(renderAlumni);
    });
  }

  /* ============ awards (Achievements & Awards page) ============ */
  function renderAwards() {
    var pane = el('tab-awards');

    var rows = state.awards.slice().sort(function (a, b) {
      return (a.sort_order || 0) - (b.sort_order || 0);
    });

    pane.innerHTML =
      '<div class="toolbar">' +
        '<div></div>' +
        '<button class="btn btn-primary" id="aw-new">+ New award</button>' +
      '</div>' +
      '<div class="count">' + rows.length + ' award' + (rows.length === 1 ? '' : 's') + '</div>' +
      '<table class="table">' +
        '<thead><tr><th>Title</th><th>Category</th><th>Awardee</th><th>Year</th><th>Featured</th><th class="actions-cell">Actions</th></tr></thead>' +
        '<tbody>' + rows.map(function (a) {
          var c = awCatOf(a.category);
          return '<tr>' +
            '<td><strong>' + esc(a.title) + '</strong></td>' +
            '<td><span class="tag" style="color:' + esc(c.color) + '">' + esc(c.label) + '</span></td>' +
            '<td>' + esc(a.awardee || '') + '</td>' +
            '<td>' + esc(a.year || '') + '</td>' +
            '<td>' + (a.featured ? '&#9733;' : '') + '</td>' +
            '<td class="actions-cell">' +
              '<button class="btn btn-small" data-edit="' + esc(a.id) + '">Edit</button> ' +
              '<button class="btn btn-small btn-danger" data-del="' + esc(a.id) + '">Delete</button>' +
            '</td></tr>';
        }).join('') +
        (rows.length ? '' : '<tr><td colspan="6" class="empty">No awards yet.</td></tr>') +
        '</tbody>' +
      '</table>';

    el('aw-new').addEventListener('click', function () { awardsModal(null); });
    pane.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        awardsModal(state.awards.find(function (a) { return a.id === b.getAttribute('data-edit'); }));
      });
    });
    pane.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () { delAward(b.getAttribute('data-del')); });
    });
  }

  function awardsModal(a) {
    var defaultFrame = { aspect: '', radius: '', border: '', shadow: '' };
    a = a || {
      id: '', category: 'project', title: '', awardee: '', role: '', year: '',
      location: '', source: '', link: '', summary: '', about: [],
      medal: '', featured: false, sort_order: state.awards.length,
      frame_style: null
    };
    var fs = a.frame_style || defaultFrame;

    openModal(
      '<h2>' + (a.id ? 'Edit award' : 'New award') + '</h2>' +
      '<div class="modal-body">' +
        '<div class="modal-form">' +
          '<div class="form-grid">' +
            '<label class="full">Title<input type="text" id="w-title" value="' + esc(a.title) + '" required placeholder="e.g. Officer of the Year" /></label>' +
            '<label>Category<select id="w-cat">' + AW_CAT_OPTIONS(a.category) + '</select></label>' +
            '<label>Medal<select id="w-medal">' + AW_MEDAL_OPTIONS(a.medal) + '</select></label>' +
            '<label>Year<input type="text" id="w-year" value="' + esc(a.year) + '" placeholder="2026" /></label>' +
            '<label>Sort order<input type="number" id="w-sort" value="' + (a.sort_order || 0) + '" /></label>' +
            '<label class="full">Awardee (person / project / authors)<input type="text" id="w-awardee" value="' + esc(a.awardee) + '" placeholder="e.g. Mahnoor Khan" /></label>' +
            '<label class="full">Role (subtitle)<input type="text" id="w-role" value="' + esc(a.role) + '" placeholder="e.g. Local Officer — SCOPH" /></label>' +
            '<label class="full">Location<input type="text" id="w-loc" value="' + esc(a.location) + '" placeholder="Cape Town, South Africa" /></label>' +
            '<label class="full">Source (journal / assembly / body)<input type="text" id="w-source" value="' + esc(a.source) + '" placeholder="e.g. Journal of the Pakistan Medical Association" /></label>' +
            '<label class="full">Link (DOI / URL)<input type="text" id="w-link" value="' + esc(a.link) + '" placeholder="https://doi.org/…" /></label>' +
            '<label class="full check"><input type="checkbox" id="w-featured"' + (a.featured ? ' checked' : '') + ' /> Feature in the Hall of Fame</label>' +
            '<label class="full">Summary<textarea id="w-summary">' + esc(a.summary) + '</textarea></label>' +
            '<label class="full">About — one paragraph per line; insert a picture on its own line as <code>![caption](image-url)</code><textarea id="w-about">' + esc((a.about || []).join('\n')) + '</textarea></label>' +
            '<label class="full">Image Framing<div class="frame-opts">' +
              '<div class="frame-opt"><span class="frame-opt-label">Aspect ratio</span><select id="w-frame-aspect">' +
                '<option value="">Default</option>' +
                '<option value="16/9"' + (fs.aspect === '16/9' ? ' selected' : '') + '>16:9</option>' +
                '<option value="4/3"' + (fs.aspect === '4/3' ? ' selected' : '') + '>4:3</option>' +
                '<option value="1/1"' + (fs.aspect === '1/1' ? ' selected' : '') + '>1:1 (square)</option>' +
                '<option value="3/2"' + (fs.aspect === '3/2' ? ' selected' : '') + '>3:2</option>' +
                '<option value="2/3"' + (fs.aspect === '2/3' ? ' selected' : '') + '>2:3 (portrait)</option>' +
              '</select></div>' +
              '<div class="frame-opt"><span class="frame-opt-label">Corners</span><select id="w-frame-radius">' +
                '<option value="">Default</option>' +
                '<option value="none"' + (fs.radius === 'none' ? ' selected' : '') + '>None (sharp)</option>' +
                '<option value="sm"' + (fs.radius === 'sm' ? ' selected' : '') + '>Small</option>' +
                '<option value="md"' + (fs.radius === 'md' ? ' selected' : '') + '>Medium</option>' +
                '<option value="lg"' + (fs.radius === 'lg' ? ' selected' : '') + '>Large</option>' +
                '<option value="xl"' + (fs.radius === 'xl' ? ' selected' : '') + '>Rounded</option>' +
                '<option value="full"' + (fs.radius === 'full' ? ' selected' : '') + '>Pill / circle</option>' +
              '</select></div>' +
              '<div class="frame-opt"><span class="frame-opt-label">Border</span><select id="w-frame-border">' +
                '<option value="">Default</option>' +
                '<option value="none"' + (fs.border === 'none' ? ' selected' : '') + '>None</option>' +
                '<option value="thin"' + (fs.border === 'thin' ? ' selected' : '') + '>Thin</option>' +
                '<option value="thick"' + (fs.border === 'thick' ? ' selected' : '') + '>Thick</option>' +
              '</select></div>' +
              '<div class="frame-opt"><span class="frame-opt-label">Shadow</span><select id="w-frame-shadow">' +
                '<option value="">Default</option>' +
                '<option value="none"' + (fs.shadow === 'none' ? ' selected' : '') + '>None</option>' +
                '<option value="sm"' + (fs.shadow === 'sm' ? ' selected' : '') + '>Subtle</option>' +
                '<option value="md"' + (fs.shadow === 'md' ? ' selected' : '') + '>Medium</option>' +
                '<option value="lg"' + (fs.shadow === 'lg' ? ' selected' : '') + '>Strong</option>' +
              '</select></div>' +
            '</div></label>' +
            '<label class="full">ID (leave blank to auto-generate)<input type="text" id="w-id" value="' + esc(a.id) + '" placeholder="e.g. aw-2026-officer-of-year" /></label>' +
          '</div>' +
          '<div class="form-actions">' +
            '<button class="btn" id="m-cancel">Cancel</button>' +
            '<button class="btn btn-primary" id="m-save">Save award</button>' +
          '</div>' +
        '</div>' +
        '<div class="preview-pane">' +
          '<div class="preview-label">Live preview</div>' +
          '<div class="aw-preview" id="aw-preview"></div>' +
        '</div>' +
      '</div>',
      'modal--wide'
    );

    ['w-title', 'w-cat', 'w-medal', 'w-year', 'w-awardee', 'w-role', 'w-loc',
     'w-source', 'w-link', 'w-summary', 'w-about', 'w-featured',
     'w-frame-aspect', 'w-frame-radius', 'w-frame-border', 'w-frame-shadow'].forEach(function (id) {
      var input = el(id);
      if (!input) return;
      input.addEventListener('input', renderAwardsPreview);
      input.addEventListener('change', renderAwardsPreview);
    });
    attachMarkdownUpload('w-about');
    renderAwardsPreview();

    el('m-save').addEventListener('click', function () {
      var frameStyle = {
        aspect: val('w-frame-aspect'),
        radius: val('w-frame-radius'),
        border: val('w-frame-border'),
        shadow: val('w-frame-shadow')
      };
      var hasFrame = frameStyle.aspect || frameStyle.radius || frameStyle.border || frameStyle.shadow;
      var row = {
        category: val('w-cat'),
        medal: val('w-medal') || null,
        title: val('w-title').trim(),
        awardee: val('w-awardee').trim() || null,
        role: val('w-role').trim() || null,
        year: val('w-year').trim() || null,
        location: val('w-loc').trim() || null,
        source: val('w-source').trim() || null,
        link: val('w-link').trim() || null,
        summary: val('w-summary').trim() || null,
        about: splitLines(val('w-about')),
        featured: !!el('w-featured').checked,
        sort_order: parseInt(val('w-sort'), 10) || 0,
        frame_style: hasFrame ? frameStyle : null
      };
      if (!row.title) { alert('Title is required.'); return; }
      if (!val('w-id').trim()) {
        row.id = slugify(row.title);
        if (!row.id) { alert('Give the award an ID.'); return; }
      } else {
        row.id = val('w-id').trim();
      }
      if (a.id) row.id = a.id;

      /* keep only one featured item on the podium if this one is featured */
      if (row.featured) {
        var others = state.awards.filter(function (x) { return x.featured && x.id !== row.id; });
        if (others.length) {
          var keys = others.map(function (x) { return x.id; });
          sb.from('awards').update({ featured: false }).in('id', keys)
            .then(function () { doSaveAward(row); });
          return;
        }
      }
      doSaveAward(row);
    });
  }

  function doSaveAward(row) {
    sb.from('awards').upsert(row).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      closeModal();
      loadData().then(renderAwards);
    });
  }

  function delAward(id) {
    if (!confirm('Delete this award?')) return;
    sb.from('awards').delete().eq('id', id).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      loadData().then(renderAwards);
    });
  }

  /* ============ settings ============ */
  function renderSettings() {
    var pane = el('tab-settings');
    var s = state.settings.site || {};
    var h = state.settings.hero || {};
    var p = state.settings.president || {};

    pane.innerHTML =
      '<div class="card settings-section"><h3>Site</h3>' +
        '<div class="form-grid">' +
          '<label>Year<input type="text" id="s-year" value="' + esc(s.year || '') + '" /></label>' +
          '<label class="full">Footer line 1<input type="text" id="s-foot1" value="' + esc(s.footer1 || '') + '" /></label>' +
          '<label class="full">Footer line 2<input type="text" id="s-foot2" value="' + esc(s.footer2 || '') + '" /></label>' +
        '</div></div>' +

      '<div class="card settings-section"><h3>Hero (homepage)</h3>' +
        '<div class="form-grid">' +
          '<label class="full">Hero image — upload or paste a URL (leave empty for default)<input type="text" id="h-img" value="' + esc(h.img || '') + '" placeholder="assets/ifmsa-pakistan-logo-light.png" /></label>' +
          '<label>Eyebrow pill<input type="text" id="h-pill" value="' + esc(h.eyebrowPill || '') + '" /></label>' +
          '<label>Eyebrow rest<input type="text" id="h-rest" value="' + esc(h.eyebrowRest || '') + '" /></label>' +
          '<label class="full">Title line 1 <span style="font-weight:normal;font-size:.8em;opacity:.6;">Use {red}word{/} or {#ff0000}word{/} to colour words</span><input type="text" id="h-t1" value="' + esc(h.title1 || '') + '" /></label>' +
          '<label class="full">Title line 2 <span style="font-weight:normal;font-size:.8em;opacity:.6;">Use {red}word{/} or {#ff0000}word{/} to colour words</span><input type="text" id="h-t2" value="' + esc(h.title2 || '') + '" /></label>' +
          '<label class="full">Sub text<textarea id="h-sub">' + esc(h.sub || '') + '</textarea></label>' +
          '<div class="full hero-preview" id="hero-preview" style="background:#1a1a2e;border-radius:12px;padding:2rem 1.5rem;text-align:center;margin-top:.5rem;">' +
            '<div style="font-family:var(--mono);font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.78);margin-bottom:.5rem;">' + esc((h.eyebrowPill || '') + (h.eyebrowRest ? ' · ' + h.eyebrowRest : '')) + '</div>' +
            '<div style="display:inline-block;position:relative;font-family:Montserrat,Arial Narrow,Arial,sans-serif;font-size:3.2rem;font-weight:800;letter-spacing:.04em;line-height:.92;color:#fff;text-shadow:0 8px 34px rgba(6,5,22,.55);">' +
              '<span style="position:absolute;inset:-.15em -.4em;border-radius:8px;background:rgba(13,17,23,.45);backdrop-filter:blur(8px) saturate(120%);z-index:-1;"></span>' +
              '<span>' + parseColorTags(h.title1 || 'IFMSA') + '</span> ' +
              '<span class="hero-title-accent">' + parseColorTags(h.title2 || 'KMC') + '</span>' +
            '</div>' +
            '<div style="font-family:Cormorant Garamond,Georgia,serif;font-style:italic;font-size:1.1rem;color:rgba(255,255,255,.92);margin-top:.5rem;">' + esc(h.sub || '') + '</div>' +
          '</div>' +
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
          '<label>Stat 4 number<input type="text" id="h-m4n" value="' + esc(h.estNum || '') + '" /></label>' +
          '<label>Stat 4 label<input type="text" id="h-m4l" value="' + esc(h.estLabel || '') + '" /></label>' +
        '</div></div>' +

      '<div class="card settings-section"><h3>President (homepage)</h3>' +
        '<div class="form-grid">' +
          '<label class="full">Portrait — upload or paste a URL (leave empty for the silhouette placeholder)<input type="text" id="p-img" value="' + esc(p.img || '') + '" placeholder="assets/president.jpg" /></label>' +
          '<label class="full">Label (above the quote)<input type="text" id="p-label" value="' + esc(p.label || '') + '" placeholder="A message from the President" /></label>' +
          '<label class="full">Message / quote<textarea id="p-quote">' + esc(p.quote || '') + '</textarea></label>' +
          '<label class="full">Name<input type="text" id="p-name" value="' + esc(p.name || '') + '" placeholder="President — IFMSA KMC Local Council" /></label>' +
          '<div class="form-actions"><button class="btn btn-primary" id="settings-save">Save settings</button></div>' +
        '</div></div>';

    attachImageUpload('h-img');
    attachImageUpload('p-img');
    el('settings-save').addEventListener('click', saveSettings);

    var previewIds = ['h-pill', 'h-rest', 'h-t1', 'h-t2', 'h-sub'];
    var updatePreview = function () {
      var pill = val('h-pill');
      var rest = val('h-rest');
      var t1 = val('h-t1') || 'IFMSA';
      var t2 = val('h-t2') || 'KMC';
      var sub = val('h-sub');
      var pv = el('hero-preview');
      if (!pv) return;
      pv.innerHTML =
        '<div style="font-family:var(--mono);font-size:.7rem;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,255,255,.78);margin-bottom:.5rem;">' +
          esc(pill) + (rest ? ' · ' + esc(rest) : '') +
        '</div>' +
        '<div style="display:inline-block;position:relative;font-family:Montserrat,Arial Narrow,Arial,sans-serif;font-size:3.2rem;font-weight:800;letter-spacing:.04em;line-height:.92;color:#fff;text-shadow:0 8px 34px rgba(6,5,22,.55);">' +
          '<span style="position:absolute;inset:-.15em -.4em;border-radius:8px;background:rgba(13,17,23,.45);backdrop-filter:blur(8px) saturate(120%);z-index:-1;"></span>' +
          '<span>' + parseColorTags(t1) + '</span> ' +
          '<span class="hero-title-accent">' + parseColorTags(t2) + '</span>' +
        '</div>' +
        '<div style="font-family:Cormorant Garamond,Georgia,serif;font-style:italic;font-size:1.1rem;color:rgba(255,255,255,.92);margin-top:.5rem;">' +
          esc(sub) +
        '</div>';
    };
    previewIds.forEach(function (id) {
      var node = el(id);
      if (node) node.addEventListener('input', updatePreview);
    });
  }

  /* ============ feature cards (About / Join / Exec / Highlights / Alumni / Awards) ============ */
  function cardFields(slug, titleId, bodyId, btnTextId, btnHrefId, img1Id, img2Id, extra, data) {
    return '<label class="full">Title<input type="text" id="' + titleId + '" value="' + esc(data.title || '') + '" /></label>' +
      '<label class="full">Body text<textarea id="' + bodyId + '">' + esc(data.body || '') + '</textarea></label>' +
      '<label>Button text<input type="text" id="' + btnTextId + '" value="' + esc(data.btnText || '') + '" /></label>' +
      '<label>Button href<input type="text" id="' + btnHrefId + '" value="' + esc(data.btnHref || '') + '" /></label>' +
      '<label class="full">Card image 1 — upload or paste a URL (leave empty for default)<input type="text" id="' + img1Id + '" value="' + esc(data.img1 || '') + '" /></label>' +
      '<label class="full">Card image 2 — upload or paste a URL<input type="text" id="' + img2Id + '" value="' + esc(data.img2 || '') + '" /></label>';
  }

  function renderCards() {
    var pane = el('tab-cards');
    var a = state.settings.about || {};
    var j = state.settings.join || {};
    var ex = state.settings.exec || {};
    var h = state.settings.highlights || {};
    var al = state.settings.alumni || {};
    var aw = state.settings.awards || {};

    pane.innerHTML =
      '<div class="card settings-section"><h3>About tab (homepage)</h3>' +
        '<div class="form-grid">' +
          '<label>Eyebrow<input type="text" id="a-eyebrow" value="' + esc(a.eyebrow || '') + '" /></label>' +
          cardFields('about', 'a-title', 'a-body', 'a-btn1t', 'a-btn1h', 'a-img1', 'a-img2', null, a) +
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
          '<label class="full">Card image 1 — upload or paste a URL (leave empty for default)<input type="text" id="j-img1" value="' + esc(j.img1 || '') + '" /></label>' +
          '<label class="full">Card image 2 — upload or paste a URL<input type="text" id="j-img2" value="' + esc(j.img2 || '') + '" /></label>' +
        '</div></div>' +

      '<div class="card settings-section"><h3>Meet the Executive Board tab (homepage)</h3>' +
        '<div class="form-grid">' +
          cardFields('exec', 'x-title', 'x-body', 'x-btn1t', 'x-btn1h', 'x-img1', 'x-img2', null, ex) +
        '</div></div>' +

      '<div class="card settings-section"><h3>Highlights tab (homepage)</h3>' +
        '<div class="form-grid">' +
          cardFields('highlights', 'hl-title', 'hl-body', 'hl-btn1t', 'hl-btn1h', 'hl-img1', 'hl-img2', null, h) +
        '</div></div>' +

      '<div class="card settings-section"><h3>Alumni tab (homepage)</h3>' +
        '<div class="form-grid">' +
          cardFields('alumni', 'al-title', 'al-body', 'al-btn1t', 'al-btn1h', 'al-img1', 'al-img2', null, al) +
        '</div></div>' +

      '<div class="card settings-section"><h3>Achievements &amp; Awards tab (homepage)</h3>' +
        '<div class="form-grid">' +
          cardFields('awards', 'aw-title', 'aw-body', 'aw-btn1t', 'aw-btn1h', 'aw-img1', 'aw-img2', null, aw) +
        '</div>' +
        '<div class="form-actions"><button class="btn btn-primary" id="cards-save">Save feature cards</button></div>' +
      '</div>';

    el('cards-save').addEventListener('click', saveCards);

    ['a-img1', 'a-img2', 'j-img1', 'j-img2', 'x-img1', 'x-img2',
     'hl-img1', 'hl-img2', 'al-img1', 'al-img2', 'aw-img1', 'aw-img2'].forEach(function (id) {
      attachImageUpload(id);
    });
  }

  function saveCards() {
    var rows = [
      {
        key: 'about',
        value: {
          eyebrow: val('a-eyebrow').trim(), title: val('a-title').trim(),
          body: val('a-body').trim(),
          btnText: val('a-btn1t').trim(), btnHref: val('a-btn1h').trim(),
          img1: val('a-img1').trim(), img2: val('a-img2').trim()
        }
      },
      {
        key: 'join',
        value: {
          eyebrow: val('j-eyebrow').trim(), title: val('j-title').trim(),
          sub: val('j-sub').trim(),
          btn1Text: val('j-btn1t').trim(), btn1Href: val('j-btn1h').trim(),
          btn2Text: val('j-btn2t').trim(), btn2Href: val('j-btn2h').trim(),
          img1: val('j-img1').trim(), img2: val('j-img2').trim()
        }
      },
      {
        key: 'exec',
        value: {
          title: val('x-title').trim(), body: val('x-body').trim(),
          btnText: val('x-btn1t').trim(), btnHref: val('x-btn1h').trim(),
          img1: val('x-img1').trim(), img2: val('x-img2').trim()
        }
      },
      {
        key: 'highlights',
        value: {
          title: val('hl-title').trim(), body: val('hl-body').trim(),
          btnText: val('hl-btn1t').trim(), btnHref: val('hl-btn1h').trim(),
          img1: val('hl-img1').trim(), img2: val('hl-img2').trim()
        }
      },
      {
        key: 'alumni',
        value: {
          title: val('al-title').trim(), body: val('al-body').trim(),
          btnText: val('al-btn1t').trim(), btnHref: val('al-btn1h').trim(),
          img1: val('al-img1').trim(), img2: val('al-img2').trim()
        }
      },
      {
        key: 'awards',
        value: {
          title: val('aw-title').trim(), body: val('aw-body').trim(),
          btnText: val('aw-btn1t').trim(), btnHref: val('aw-btn1h').trim(),
          img1: val('aw-img1').trim(), img2: val('aw-img2').trim()
        }
      }
    ];
    sb.from('site_settings').upsert(rows, { onConflict: 'key' }).then(function (r) {
      if (r.error) { alert(r.error.message); return; }
      alert('Feature cards saved.');
      loadData();
    });
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
          img: val('h-img').trim(),
          eyebrowPill: val('h-pill').trim(), eyebrowRest: val('h-rest').trim(),
          title1: val('h-t1').trim(),
          title2: val('h-t2').trim(),
          sub: val('h-sub').trim(),
          btn1Text: val('h-btn1t').trim(), btn1Href: val('h-btn1h').trim(),
          btn2Text: val('h-btn2t').trim(), btn2Href: val('h-btn2h').trim(),
          mini1Num: val('h-m1n').trim(), mini1Label: val('h-m1l').trim(),
          mini2Num: val('h-m2n').trim(), mini2Label: val('h-m2l').trim(),
          mini3Num: val('h-m3n').trim(), mini3Label: val('h-m3l').trim(),
          estNum: val('h-m4n').trim(), estLabel: val('h-m4l').trim()
        }
      },
      {
        key: 'president',
        value: {
          img: val('p-img').trim(),
          label: val('p-label').trim(),
          quote: val('p-quote').trim(),
          name: val('p-name').trim()
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
