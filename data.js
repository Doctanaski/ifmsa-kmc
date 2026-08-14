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
      eyebrowRest: "Local Chapter 2026",
      title1: "Medical students.",
      title2: "Moving medicine forward.",
      sub: "The Khyber Medical College local chapter of the International Federation of Medical Students' Associations — six standing committees, one chapter.",
      btn1Text: "Explore committees ↓",
      btn1Href: "#scope",
      btn2Text: "Join the chapter",
      btn2Href: "#join",
      mini1Num: "6", mini1Label: "Standing committees",
      mini2Num: "1.5M+", mini2Label: "Med students worldwide",
      mini3Num: "123", mini3Label: "Countries & territories"
    },
    about: {
      eyebrow: "Know more about us",
      title: "One student body, every medical student's opportunity.",
      body: "The Khyber Medical College Local Chapter is part of IFMSA-Pakistan, the sole national member organisation of the International Federation of Medical Students' Associations in Pakistan. Through six standing committees we act on medical education, professional and research exchanges, public health, human rights and peace, and sexual & reproductive health — right here in Peshawar."
    },
    join: {
      eyebrow: "Ready when you are",
      title: "One scroll can change a student's path.",
      sub: "Membership is open to every KMC student. Come to an intro session, meet your Local Committee Officers, and pick anywhere to start.",
      btn1Text: "Visit IFMSA",
      btn1Href: "https://ifmsa.org",
      btn2Text: "Contact the local chapter",
      btn2Href: "mailto:ifmsa@kmc.edu.pk"
    }
  };

  var memo = null;

  function normalizeStatic() {
    var d = window.IFMSA_DATA || {};
    return {
      year: d.year || DEFAULTS.site.year,
      committees: d.committees || {},
      projects: d.projects || [],
      site: DEFAULTS.site,
      hero: DEFAULTS.hero,
      about: DEFAULTS.about,
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
      client.from('site_settings').select('key, value')
    ]).then(function (results) {
      var committeesRes = results[0];
      var projectsRes = results[1];
      var settingsRes = results[2];

      if (committeesRes.error) throw committeesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (settingsRes.error) throw settingsRes.error;

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
      var join = merge(DEFAULTS.join, settings.join);

      return {
        year: site.year || DEFAULTS.site.year,
        committees: committees,
        projects: projectsRes.data || [],
        site: site,
        hero: hero,
        about: about,
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
    }

    if (siteData.about) {
      var a = siteData.about;
      setText('know-eyebrow', a.eyebrow);
      setText('about-title', a.title);
      setText('about-body', a.body);
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
    }

    if (siteData.site) {
      var s = siteData.site;
      setText('site-foot-1', s.footer1);
      setText('site-foot-2', s.footer2);
    }
  };
})();
