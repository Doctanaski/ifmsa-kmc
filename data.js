/* ============================================================
   IFMSA KMC — central data loader.
   Tries Supabase first; if it is not configured or the fetch
   fails, falls back to the bundled projects-data.js.
   Also exposes applySiteSettings() to overwrite the hero / join
   / footer text on the static pages.
   ============================================================ */

(function () {
  'use strict';

  var DEFAULTS = {
    site: {
      year: "2026",
      footer1: "IFMSA — Khyber Medical College, Peshawar",
      footer2: "Built by students, for the future of medicine."
    },
    hero: {
      eyebrowPill: "IFMSA Pakistan",
      eyebrowRest: "Local Council 2026",
      title1: "Medical students.",
      title2: "Moving medicine forward.",
      sub: "The Khyber Medical College local council of the International Federation of Medical Students' Associations — six standing committees, one council.",
      btn1Text: "Explore committees ↓",
      btn1Href: "#scope",
      btn2Text: "Join the council",
      btn2Href: "#join",
      mini1Num: "6", mini1Label: "Standing committees",
      mini2Num: "1.5M+", mini2Label: "Members Worldwide",
      mini3Num: "123", mini3Label: "Countries & territories",
      estNum: "Est. 1951", estLabel: "Shaping Global Health Leaders Since 1951"
    },
    about: {
      eyebrow: "Know more about us",
      title: "One student body, every medical student's opportunity.",
      body: "The Khyber Medical College Local Council is part of IFMSA-Pakistan, the sole national member organisation of the International Federation of Medical Students' Associations in Pakistan. Through six standing committees we act on medical education, professional and research exchanges, public health, human rights and peace, and sexual & reproductive health — right here in Peshawar.",
      btnText: "Join Us",
      btnHref: "#card-join",
      img1: "",
      img2: ""
    },
    exec: {
      title: "Meet the Executive Board",
      body: "The heartbeat of the local council — the President, Vice-Presidents and Local Officers who run IFMSA KMC day to day, from national delegation to on-campus coordination.",
      btnText: "Meet the Board",
      btnHref: "executive.html",
      img1: "",
      img2: ""
    },
    highlights: {
      title: "Highlights",
      body: "Standout moments, campaigns and wins from across the council — the sessions, exchanges and drives that make KMC members proud.",
      btnText: "See Highlights",
      btnHref: "highlights.html",
      img1: "",
      img2: ""
    },
    alumni: {
      title: "Alumni",
      body: "The KMC alumni network — doctors and leaders around the world who grew up in IFMSA here in Peshawar and still give back.",
      btnText: "Alumni Stories",
      btnHref: "about.html",
      img1: "",
      img2: ""
    },
    awards: {
      title: "Achievements & Awards",
      body: "The recognitions our members, projects and committees have earned — nationally and on the international IFMSA stage.",
      btnText: "Our Awards",
      btnHref: "about.html",
      img1: "",
      img2: ""
    },
    join: {
      eyebrow: "Ready when you are",
      title: "One scroll can change a student's path.",
      sub: "Membership is open to every KMC student. Come to an intro session, meet your Local Officer, and pick anywhere to start.",
      btn1Text: "About Us",
      btn1Href: "#card-about",
      btn2Text: "Contact the council",
      btn2Href: "mailto:president.kmclc.ifmsapakistan@gmail.com",
      img1: "",
      img2: ""
    }
  };

  var memo = null;

  function normalizeStatic() {
    var d = window.IFMSA_DATA || {};
    return {
      year: d.year || DEFAULTS.site.year,
      committees: d.committees || {},
      projects: d.projects || [],
      highlightsList: d.highlights || [],
      site: DEFAULTS.site,
      hero: DEFAULTS.hero,
      about: DEFAULTS.about,
      exec: DEFAULTS.exec,
      highlights: DEFAULTS.highlights,
      alumni: DEFAULTS.alumni,
      awards: DEFAULTS.awards,
      join: DEFAULTS.join
    };
  }

  function fetchSupabase() {
    var cfg = window.SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anonKey) {
      return Promise.reject(new Error('Supabase not configured'));
    }
    if (!window.supabase) {
      return Promise.reject(new Error('supabase-js not loaded'));
    }

    var client = window.supabase.createClient(cfg.url, cfg.anonKey);

    return Promise.all([
      client.from('committees').select('*').order('sort_order'),
      client.from('projects').select('*').order('sort_order'),
      client.from('site_settings').select('key, value'),
      client.from('highlights').select('*').order('sort_order')
    ]).then(function (results) {
      var committeesRes = results[0];
      var projectsRes = results[1];
      var settingsRes = results[2];
      var highlightsRes = results[3];

      if (committeesRes.error) throw committeesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (settingsRes.error) throw settingsRes.error;

      /* the highlights table is optional — a missing table simply falls
         back to the bundled list, never taking the whole site down */
      var highlights = (highlightsRes && highlightsRes.data) || [];
      if (highlightsRes && highlightsRes.error) highlights = [];

      var committees = {};
      (committeesRes.data || []).forEach(function (r) {
        committees[r.slug] = r;
      });

      var settings = {};
      (settingsRes.data || []).forEach(function (r) {
        settings[r.key] = r.value;
      });

      var site = merge(DEFAULTS.site, settings.site);
      var hero = merge(DEFAULTS.hero, settings.hero);
      var about = merge(DEFAULTS.about, settings.about);
      var exec = merge(DEFAULTS.exec, settings.exec);
      var highlights = merge(DEFAULTS.highlights, settings.highlights);
      var alumni = merge(DEFAULTS.alumni, settings.alumni);
      var awards = merge(DEFAULTS.awards, settings.awards);
      var join = merge(DEFAULTS.join, settings.join);

      return {
        year: site.year || DEFAULTS.site.year,
        committees: committees,
        projects: projectsRes.data || [],
        highlightsList: highlights,
        site: site,
        hero: hero,
        about: about,
        exec: exec,
        highlights: highlights,
        alumni: alumni,
        awards: awards,
        join: join
      };
    });
  }

  function merge(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    if (extra) Object.keys(extra).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  window.loadSiteData = function () {
    if (memo) return Promise.resolve(memo);
    return fetchSupabase().then(function (d) {
      memo = d;
      return d;
    }).catch(function () {
      memo = normalizeStatic();
      return memo;
    });
  };

  /* ---------- overwrite hero / join / footer text ---------- */
  window.applySiteSettings = function (siteData) {
    if (!siteData) return;
    var byId = function (id) { return document.getElementById(id); };
    var setText = function (id, text) {
      var el = byId(id);
      if (el && text != null) el.textContent = text;
    };
    var setCardBg = function (cls, url) {
      if (!url) return;
      var els = document.querySelectorAll('.' + cls);
      for (var i = 0; i < els.length; i++) {
        els[i].style.backgroundImage = 'url("' + String(url).replace(/"/g, '&quot;') + '")';
      }
    };

    if (siteData.hero) {
      var h = siteData.hero;
      setText('hero-eyebrow-pill', h.eyebrowPill);
      setText('hero-eyebrow-rest', h.eyebrowRest);
      var ht = byId('hero-title');
      if (ht && h.title1 != null && h.title2 != null) {
        ht.innerHTML = '<span>' + h.title1 + '</span><br /><span>' + h.title2 + '</span>';
      }
      setText('hero-sub', h.sub);
      setText('hero-btn1', h.btn1Text);
      setText('hero-btn2', h.btn2Text);
      var hb1 = byId('hero-btn1-link'); if (hb1 && h.btn1Href != null) hb1.setAttribute('href', h.btn1Href);
      var hb2 = byId('hero-btn2-link'); if (hb2 && h.btn2Href != null) hb2.setAttribute('href', h.btn2Href);
      var mini = byId('hero-mini');
      if (mini && h.mini1Num != null) {
        mini.innerHTML =
          '<li><span class="mini-num">' + h.mini1Num + '</span> ' + h.mini1Label + '</li>' +
          '<li><span class="mini-num">' + h.mini2Num + '</span> ' + h.mini2Label + '</li>' +
          '<li><span class="mini-num">' + h.mini3Num + '</span> ' + h.mini3Label + '</li>';
      }
      if (h.mini1Num != null) {
        setText('stat-committees-num', h.mini1Num);
        setText('stat-committees-label', h.mini1Label);
      }
      /* the members card now shows two fixed values (worldwide + LC), so it is
         intentionally left static and not overwritten from site settings */
      if (h.mini3Num != null) {
        setText('stat-nmo-num', h.mini3Num);
        setText('stat-nmo-label', h.mini3Label);
      }
      if (h.estNum != null) {
        setText('stat-est-num', h.estNum);
        setText('stat-est-label', h.estLabel);
      }
    }

    if (siteData.about) {
      var a = siteData.about;
      setText('know-eyebrow', a.eyebrow);
      setText('about-title', a.title);
      setText('about-body', a.body);
      setText('about-btn1', a.btnText);
      var ab = byId('about-btn1-link'); if (ab && a.btnHref != null) ab.setAttribute('href', a.btnHref);
      setCardBg('bg-about-1', a.img1);
      setCardBg('bg-about-2', a.img2);
    }

    if (siteData.join) {
      var j = siteData.join;
      setText('join-eyebrow', j.eyebrow);
      setText('join-title', j.title);
      setText('join-sub', j.sub);
      setText('join-btn1', j.btn1Text);
      setText('join-btn2', j.btn2Text);
      var jb1 = byId('join-btn1-link'); if (jb1 && j.btn1Href != null) jb1.setAttribute('href', j.btn1Href);
      var jb2 = byId('join-btn2-link'); if (jb2 && j.btn2Href != null) jb2.setAttribute('href', j.btn2Href);
      setCardBg('bg-join-1', j.img1);
      setCardBg('bg-join-2', j.img2);
    }

    /* generic feature-card (tab) block: title + body + one button + two bg images */
    var applyCard = function (slug, titleId, bodyId, btnId, btnLinkId, bg1, bg2) {
      var c = siteData[slug];
      if (!c) return;
      setText(titleId, c.title);
      setText(bodyId, c.body);
      setText(btnId, c.btnText);
      var link = byId(btnLinkId);
      if (link && c.btnHref != null) link.setAttribute('href', c.btnHref);
      setCardBg(bg1, c.img1);
      setCardBg(bg2, c.img2);
    };
    applyCard('exec', 'exec-title', 'exec-body', 'exec-btn1', 'exec-btn1-link', 'bg-exec-1', 'bg-exec-2');
    applyCard('highlights', 'highlights-title', 'highlights-body', 'highlights-btn1', 'highlights-btn1-link', 'bg-highlights-1', 'bg-highlights-2');
    applyCard('alumni', 'alumni-title', 'alumni-body', 'alumni-btn1', 'alumni-btn1-link', 'bg-alumni-1', 'bg-alumni-2');
    applyCard('awards', 'awards-title', 'awards-body', 'awards-btn1', 'awards-btn1-link', 'bg-awards-1', 'bg-awards-2');

    if (siteData.site) {
      var s = siteData.site;
      setText('site-foot-1', s.footer1);
      setText('site-foot-2', s.footer2);
    }
  };
})();
