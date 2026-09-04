/* ============================================================
   IFMSA KMC — central data loader.
   Loads all data from Supabase. No hardcoded fallbacks.
   Also exposes applySiteSettings() to overwrite the hero / join
   / footer text on the static pages.
   ============================================================ */

(function () {
  'use strict';

  var memo = null;

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
      client.from('highlights').select('*').order('sort_order'),
      client.from('exec_board').select('*').order('sort_order'),
      client.from('committee_members').select('*').order('sort_order'),
      client.from('alumni').select('*').order('sort_order'),
      client.from('awards').select('*').order('sort_order')
    ]).then(function (results) {
      var committeesRes = results[0];
      var projectsRes = results[1];
      var settingsRes = results[2];
      var highlightsRes = results[3];
      var execRes = results[4];
      var committeeMembersRes = results[5];
      var alumniRes = results[6];
      var awardsRes = results[7];
      if (committeesRes.error) throw committeesRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (settingsRes.error) throw settingsRes.error;

      var highlights = (highlightsRes && highlightsRes.data) || [];
      if (highlightsRes && highlightsRes.error) highlights = [];

      var execBoard = (execRes && execRes.data) || [];
      if (execRes && execRes.error) execBoard = [];

      var committeeMembers = (committeeMembersRes && committeeMembersRes.data) || [];
      if (committeeMembersRes && committeeMembersRes.error) committeeMembers = [];

      var alumniList = (alumniRes && alumniRes.data) || [];
      if (alumniRes && alumniRes.error) alumniList = [];

      var awardsList = (awardsRes && awardsRes.data) || [];
      if (awardsRes && awardsRes.error) awardsList = [];

      var committees = {};
      (committeesRes.data || []).forEach(function (r) {
        committees[r.slug] = r;
      });

      var settings = {};
      (settingsRes.data || []).forEach(function (r) {
        settings[r.key] = r.value;
      });

      var site = settings.site || {};
      var hero = settings.hero || {};
      var about = settings.about || {};
      var exec = settings.exec || {};
      var highlightsSettings = settings.highlights || {};
      var alumniSettings = settings.alumni || {};
      var awardsSettings = settings.awards || {};
      var join = settings.join || {};
      var president = settings.president || {};
      var electives = settings.electives || {};
      var projecthope = settings.projecthope || {};
      var pubsd = settings.pubsd || {};

      return {
        year: site.year || '',
        committees: committees,
        projects: projectsRes.data || [],
        highlightsList: highlights,
        execBoard: execBoard,
        committeeMembers: committeeMembers,
        alumniList: alumniList,
        awardsList: awardsList,
        site: site,
        hero: hero,
        about: about,
        exec: exec,
        highlights: highlightsSettings,
        alumni: alumniSettings,
        awards: awardsSettings,
        join: join,
        president: president,
        electives: electives,
        projecthope: projecthope,
        pubsd: pubsd
      };
    });
  }

  window.loadSiteData = function () {
    if (memo) return Promise.resolve(memo);
    return fetchSupabase().then(function (d) {
      memo = d;
      return d;
    }).catch(function () {
      memo = {
        year: '',
        committees: {},
        projects: [],
        highlightsList: [],
        execBoard: [],
        committeeMembers: [],
        alumniList: [],
        awardsList: [],
        site: {},
        hero: {},
        about: {},
        exec: {},
        highlights: {},
        alumni: {},
        awards: {},
        join: {},
        president: {},
        electives: {},
        projecthope: {},
        pubsd: {}
      };
      return memo;
    });
  };

  /* focal point stored by the admin framing tool as #fp=x,y on the URL */
  var imgFramePos = function (url) {
    var m = String(url || '').match(/#fp=([\d.]+),([\d.]+)/);
    return m ? m[1] + '% ' + m[2] + '%' : '';
  };
  window.imgFramePos = imgFramePos;

  /* parse {color}word{/} and {#hex}word{/} inline colour tags */
  var parseColorTags = function (text) {
    return String(text || '')
      .replace(/\{(#?[a-zA-Z0-9(),. %]+)\}([\s\S]*?)\{\//g, function (_, colour, inner) {
        var c = colour.trim();
        if (!c) return inner;
        return '<span style="color:' + c.replace(/"/g, '') + ';">' + inner + '</span>';
      });
  };
  window.parseColorTags = parseColorTags;

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
        els[i].style.backgroundPosition = imgFramePos(url);
      }
    };

    if (siteData.hero) {
      var h = siteData.hero;
      setText('hero-eyebrow', (h.eyebrowPill || '') + (h.eyebrowRest ? ' · ' + h.eyebrowRest : ''));
      var ht = byId('hero-title');
      if (ht && h.title1 != null && h.title2 != null) {
        ht.innerHTML = '<span>' + parseColorTags(h.title1) + '</span> <span class="hero-title-accent">' + parseColorTags(h.title2) + '</span>';
      }
      setText('hero-sub', h.sub);
      setText('hero-btn1', h.btn1Text);
      setText('hero-btn2', h.btn2Text);
      var hb1 = byId('hero-btn1-link'); if (hb1 && h.btn1Href != null) hb1.setAttribute('href', h.btn1Href);
      var hb2 = byId('hero-btn2-link'); if (hb2 && h.btn2Href != null) hb2.setAttribute('href', h.btn2Href);
      var hbg = byId('hero-banner-media');
      if (hbg && h.img) {
        hbg.style.backgroundImage = 'url("' + String(h.img).replace(/"/g, '&quot;') + '")';
        hbg.style.backgroundPosition = imgFramePos(h.img);
      }
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
    applyCard('electives', 'electives-title', 'electives-body', 'electives-btn1', 'electives-btn1-link', 'bg-electives-1', 'bg-electives-2');
    applyCard('projecthope', 'projecthope-title', 'projecthope-body', 'projecthope-btn1', 'projecthope-btn1-link', 'bg-projecthope-1', 'bg-projecthope-2');
    applyCard('pubsd', 'pubsd-title', 'pubsd-body', 'pubsd-btn1', 'pubsd-btn1-link', 'bg-pubsd-1', 'bg-pubsd-2');

    if (siteData.site) {
      var s = siteData.site;
      setText('site-foot-1', s.footer1);
      setText('site-foot-2', s.footer2);
    }

    if (siteData.president) {
      var p = siteData.president;
      setText('pres-label', p.label);
      setText('pres-quote', p.quote);
      setText('pres-name', p.name);
      var ph = byId('pres-photo');
      if (ph) {
        if (p.img) {
          ph.classList.add('has-image');
          ph.style.backgroundImage = 'url("' + String(p.img).replace(/"/g, '&quot;') + '")';
          ph.style.backgroundSize = 'cover';
          ph.style.backgroundPosition = imgFramePos(p.img) || 'center';
          var sil = ph.querySelector('.pres-silhouette');
          var phl = ph.querySelector('.pres-placeholder');
          if (sil) sil.style.display = 'none';
          if (phl) phl.style.display = 'none';
        } else {
          ph.classList.remove('has-image');
          ph.style.backgroundImage = '';
          var sil2 = ph.querySelector('.pres-silhouette');
          var phl2 = ph.querySelector('.pres-placeholder');
          if (sil2) sil2.style.display = '';
          if (phl2) phl2.style.display = '';
        }
      }
    }
  };
})();
