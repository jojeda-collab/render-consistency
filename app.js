/* Render Consistency - project tabs and before/after wipe sliders */
(function () {
  'use strict';

  var RC = window.RC;
  if (!RC) return;

  var PROJECTS = RC.projects;
  var LABELS = RC.labels;

  function outputsFor(p, name) {
    return RC.outputsFor(p, name);
  }

  var START_PERCENT = 50;
  var KEY_STEP = 2;

  var tabsRoot = document.getElementById('project-tabs');
  var panelsRoot = document.getElementById('projects');
  if (!tabsRoot || !panelsRoot) return;

  var tabs = [];
  var panels = [];

  var initial = projectIndexFromHash();

  /* A browser holding a cached index.html pairs it with the data.js that
     page asked for, which can predate a newly added project. The deep link
     then names a project this copy has never heard of, and we would quietly
     fall back to the first one - looking like the project was never added.
     Reload once from a URL the cache has not seen, which fetches current
     markup and data. The r= guard stops this repeating on a real typo. */
  (function () {
    var wanted = (location.hash || '').replace(/^#/, '');
    if (!wanted || /[?&]r=/.test(location.search)) return;
    var known = false;
    for (var i = 0; i < PROJECTS.length; i++) {
      if (PROJECTS[i].id === wanted) { known = true; break; }
    }
    if (known) return;
    location.replace(location.pathname + '?r=' + (+new Date()) + location.hash);
  })();

  PROJECTS.forEach(function (p, i) {
    var isActive = i === initial;

    var tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'tab';
    tab.textContent = p.name;
    tab.id = 'tab-' + p.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'panel-' + p.id);
    tab.setAttribute('aria-selected', String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
    tab.addEventListener('click', function () { select(i, false); });
    tab.addEventListener('keydown', onTabKey);
    tabsRoot.appendChild(tab);
    tabs.push(tab);

    var panel = buildProject(p, isActive);
    panelsRoot.appendChild(panel);
    panels.push(panel);
  });

  tabsRoot.setAttribute('role', 'tablist');

  /* On narrow screens the tab strip scrolls sideways instead of wrapping, so
     the chosen project has to be brought into view. Setting scrollLeft beats
     scrollIntoView here: it only touches the strip, never the page, and it is
     not affected by the strip's width still settling. */
  function revealTab(i) {
    var nav = tabsRoot, t = tabs[i];
    if (!nav || !t || nav.scrollWidth <= nav.clientWidth) return;
    /* measured from rects rather than offsetLeft, which is relative to the
       nearest positioned ancestor and so would not be the strip */
    var navRect = nav.getBoundingClientRect();
    var tabRect = t.getBoundingClientRect();
    var delta = (tabRect.left - navRect.left) - (nav.clientWidth - tabRect.width) / 2;
    nav.scrollLeft = Math.max(0, nav.scrollLeft + delta);
  }

  /* select() covers every later change; the first paint is built above, so a
     deep link needs one nudge here, after layout has settled. */
  if (initial > 0) {
    var revealInitial = function () { revealTab(initial); };
    /* twice on purpose: the first frame is usually enough, but the strip has
       sometimes not settled its scroll width by then, and load always has */
    if (window.requestAnimationFrame) {
      requestAnimationFrame(revealInitial);
    } else {
      revealInitial();
    }
    window.addEventListener('load', revealInitial);
  }

  function projectIndexFromHash() {
    var h = (location.hash || '').replace(/^#/, '');
    for (var i = 0; i < PROJECTS.length; i++) {
      if (PROJECTS[i].id === h) return i;
    }
    return 0;
  }

  function select(i, focusTab) {
    PROJECTS.forEach(function (p, j) {
      var on = j === i;
      tabs[j].setAttribute('aria-selected', String(on));
      tabs[j].tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focusTab) tabs[i].focus();
    revealTab(i);
    try {
      history.replaceState(null, '', '#' + PROJECTS[i].id);
    } catch (err) { /* file:// and the like */ }
  }

  function onTabKey(e) {
    var i = tabs.indexOf(e.currentTarget);
    var next = null;
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next === null) return;
    select(next, true);
    e.preventDefault();
  }

  window.addEventListener('hashchange', function () {
    select(projectIndexFromHash(), false);
  });

  /* ---------- build ---------- */

  function buildProject(p, isActive) {
    var panel = el('div', 'project');
    panel.id = 'panel-' + p.id;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', 'tab-' + p.id);
    panel.hidden = !isActive;

    for (var n = 1; n <= p.count; n++) {
      /* only the very first example of the visible project loads eagerly */
      panel.appendChild(buildExample(p, n, isActive && n === 1));
    }

    var vids = RC.videosFor(p.id);
    for (var v = 0; v < vids.length; v++) {
      panel.appendChild(buildVideo(vids[v]));
    }
    return panel;
  }

  /* A looping motion study. Muted autoplay is what makes a loop read as a loop,
     but controls stay on: anything moving for more than a few seconds needs a
     way to stop it. preload is metadata only so a 4K file on a hidden tab does
     not pull megabytes nobody asked for. */
  function buildVideo(v) {
    var section = el('section', 'example video-example');

    var head = el('div', 'example-head');
    var h2 = el('h2', 'example-title');
    h2.textContent = 'Motion';
    head.appendChild(h2);
    var meta = el('span', 'single-output');
    meta.textContent = v.label + ' · ' + v.seconds + 's · ' + v.w + '×' + v.h;
    head.appendChild(meta);
    section.appendChild(head);

    var frame = el('div', 'video-frame');
    frame.style.aspectRatio = v.w + ' / ' + v.h;

    var video = document.createElement('video');
    video.src = v.file;
    video.loop = true;
    video.muted = true;
    video.autoplay = true;
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    video.preload = 'metadata';
    frame.appendChild(video);

    section.appendChild(frame);
    return section;
  }

  function buildExample(p, n, eager) {
    var name = pad(n);
    var base = 'images/' + p.id + '/' + name;
    var lazy = eager ? 'eager' : 'lazy';

    var section = el('section', 'example');
    section.id = 'ex-' + p.id + '-' + name;

    var head = el('div', 'example-head');

    var h2 = el('h2', 'example-title');
    h2.textContent = name;
    head.appendChild(h2);

    var wipe = el('div', 'wipe');
    var outputs = outputsFor(p, name);

    /* AI outputs (right side), stacked underneath; one visible at a time */
    var outs = {};
    outputs.forEach(function (key) {
      var img = new Image();
      img.className = 'out out-' + key;
      img.src = base + '--' + key + '.jpg';
      img.alt = p.name + ' ' + name + ' - ' + LABELS[key] + ' output';
      img.loading = lazy;
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('load', function () { seedAspect(wipe, img, false); });
      outs[key] = img;
      wipe.appendChild(img);
    });
    outs[outputs[0]].classList.add('is-active');

    /* Original render (left side), clipped to the handle */
    var orig = new Image();
    orig.className = 'orig';
    orig.src = base + '--original.jpg';
    orig.alt = p.name + ' ' + name + ' - original 3D rendering';
    orig.loading = lazy;
    orig.decoding = 'async';
    orig.draggable = false;
    orig.addEventListener('load', function () { seedAspect(wipe, orig, true); });
    wipe.appendChild(orig);

    var tagLeft = el('span', 'tag tag-left');
    tagLeft.textContent = 'Render';
    var tagRight = el('span', 'tag tag-right');
    tagRight.textContent = LABELS[outputs[0]];
    wipe.appendChild(tagLeft);
    wipe.appendChild(tagRight);

    /* Handle */
    var handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'handle';
    handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-label', p.name + ' ' + name + ' - wipe between render and AI output');
    handle.setAttribute('aria-valuemin', '0');
    handle.setAttribute('aria-valuemax', '100');
    var arrows = el('span', 'arrows');
    arrows.textContent = '◀▶';
    handle.appendChild(arrows);
    wipe.appendChild(handle);

    /* Output toggle, only when there is more than one output to choose from */
    if (outputs.length > 1) {
      var toggle = el('div', 'toggle');
      toggle.setAttribute('role', 'group');
      toggle.setAttribute('aria-label', p.name + ' ' + name + ' - choose AI output');

      var buttons = {};
      outputs.forEach(function (key, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = LABELS[key];
        b.setAttribute('aria-pressed', String(i === 0));
        b.addEventListener('click', function () {
          outputs.forEach(function (k) {
            var on = k === key;
            outs[k].classList.toggle('is-active', on);
            buttons[k].setAttribute('aria-pressed', String(on));
            if (on) tagRight.textContent = LABELS[k];
          });
        });
        buttons[key] = b;
        toggle.appendChild(b);
      });
      head.appendChild(toggle);
    } else {
      var only = el('span', 'single-output');
      only.textContent = LABELS[outputs[0]];
      head.appendChild(only);
    }

    section.appendChild(head);
    section.appendChild(wipe);

    wireWipe(wipe, orig, handle);
    return section;
  }

  /* ---------- wipe behaviour ---------- */

  function wireWipe(wipe, orig, handle) {
    var pct = START_PERCENT;

    function paint() {
      orig.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      handle.style.left = pct + '%';
      handle.setAttribute('aria-valuenow', String(Math.round(pct)));
      handle.setAttribute('aria-valuetext', Math.round(pct) + '% render');
    }

    function setPct(next) {
      pct = Math.max(0, Math.min(100, next));
      paint();
    }

    function pctFromEvent(e) {
      var r = wipe.getBoundingClientRect();
      if (!r.width) return pct;
      return ((e.clientX - r.left) / r.width) * 100;
    }

    var dragging = false;

    wipe.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      wipe.setPointerCapture(e.pointerId);
      setPct(pctFromEvent(e));
      e.preventDefault();
    });

    wipe.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      setPct(pctFromEvent(e));
      e.preventDefault();
    });

    function stop(e) {
      if (!dragging) return;
      dragging = false;
      if (wipe.hasPointerCapture && wipe.hasPointerCapture(e.pointerId)) {
        wipe.releasePointerCapture(e.pointerId);
      }
    }

    wipe.addEventListener('pointerup', stop);
    wipe.addEventListener('pointercancel', stop);

    handle.addEventListener('keydown', function (e) {
      var next = null;
      if (e.key === 'ArrowLeft') next = pct - KEY_STEP;
      else if (e.key === 'ArrowRight') next = pct + KEY_STEP;
      else if (e.key === 'Home') next = 0;
      else if (e.key === 'End') next = 100;
      if (next === null) return;
      setPct(next);
      e.preventDefault();
    });

    /* the drag gesture ends on the handle; do not let it act as a button */
    handle.addEventListener('click', function (e) { e.preventDefault(); });

    paint();
  }

  /* ---------- sizing ---------- */

  /* Size the container from the original render natural dimensions.
     An AI output may seed it first (same aspect ratio) so the box is
     right from the moment anything in the pair has loaded. */
  function seedAspect(wipe, img, isOriginal) {
    if (!img.naturalWidth || !img.naturalHeight) return;
    if (isOriginal || wipe.dataset.aspectFrom !== 'original') {
      wipe.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
      wipe.dataset.aspectFrom = isOriginal ? 'original' : 'output';
    }
    /* the box may have just changed; re-check every image against it */
    fitToBox(wipe);
  }

  /* An AI output is usually the same shape as its render, and fills the box.
     Occasionally one comes back reframed - a landscape render returned as a
     portrait - and filling the box would crop most of it away silently. Those
     are letterboxed instead, so the whole frame stays visible and the reframing
     is legible rather than hidden. */
  var FIT_TOLERANCE = 1.02;

  function fitToBox(wipe) {
    var box = ratioOf(wipe.style.aspectRatio);
    if (!box) return;
    var imgs = wipe.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (!im.naturalWidth || !im.naturalHeight) continue;
      var r = im.naturalWidth / im.naturalHeight;
      var off = Math.max(r / box, box / r);
      im.classList.toggle('is-letterboxed', off > FIT_TOLERANCE);
    }
  }

  function ratioOf(str) {
    var m = /^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/.exec(str || '');
    if (!m) return 0;
    var h = parseFloat(m[2]);
    return h ? parseFloat(m[1]) / h : 0;
  }

  /* ---------- prompt copy ---------- */

  var copyBtn = document.getElementById('copy-prompt');
  var promptText = document.getElementById('prompt-text');

  if (copyBtn && promptText) {
    copyBtn.addEventListener('click', function () {
      var text = Array.prototype.map
        .call(promptText.querySelectorAll('p'), function (p) {
          return p.textContent.trim();
        })
        .join('\n\n');

      copy(text).then(function () {
        flash('Copied');
      }, function () {
        flash('Press Ctrl+C');
      });
    });
  }

  function flash(msg) {
    copyBtn.textContent = msg;
    copyBtn.classList.add('is-done');
    clearTimeout(copyBtn._t);
    copyBtn._t = setTimeout(function () {
      copyBtn.textContent = 'Copy prompt';
      copyBtn.classList.remove('is-done');
    }, 1800);
  }

  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) {
      /* writeText can reject when the document is not focused; fall back */
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      if (ok) { resolve(); } else { reject(new Error('copy failed')); }
    });
  }

  /* ---------- helpers ---------- */

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }
})();
