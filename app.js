/* Render Consistency - project tabs and before/after wipe sliders */
(function () {
  'use strict';

  /* Examples are numbered only. `outputs` lists the AI outputs that exist
     for a project; a project with one output gets no toggle. `ext` overrides
     the default jpg extension for an output that was supplied as png. */
  var PROJECTS = [
    { id: 'the-prospect', name: 'The Prospect', count: 4, outputs: ['gemini', 'chatgpt'] },
    { id: '29',           name: '29',           count: 3, outputs: ['gemini', 'chatgpt'],
      ext: { chatgpt: 'png' } }
  ];

  function extFor(p, key) {
    return (p.ext && p.ext[key]) || 'jpg';
  }

  var LABELS = { gemini: 'Gemini', chatgpt: 'ChatGPT' };

  var START_PERCENT = 50;
  var KEY_STEP = 2;

  var tabsRoot = document.getElementById('project-tabs');
  var panelsRoot = document.getElementById('projects');
  if (!tabsRoot || !panelsRoot) return;

  var tabs = [];
  var panels = [];

  var initial = projectIndexFromHash();

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
    return panel;
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

    /* AI outputs (right side), stacked underneath; one visible at a time */
    var outs = {};
    p.outputs.forEach(function (key) {
      var img = new Image();
      img.className = 'out out-' + key;
      img.src = base + '--' + key + '.' + extFor(p, key);
      img.alt = p.name + ' ' + name + ' - ' + LABELS[key] + ' output';
      img.loading = lazy;
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('load', function () { seedAspect(wipe, img, false); });
      outs[key] = img;
      wipe.appendChild(img);
    });
    outs[p.outputs[0]].classList.add('is-active');

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
    tagRight.textContent = LABELS[p.outputs[0]];
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
    if (p.outputs.length > 1) {
      var toggle = el('div', 'toggle');
      toggle.setAttribute('role', 'group');
      toggle.setAttribute('aria-label', p.name + ' ' + name + ' - choose AI output');

      var buttons = {};
      p.outputs.forEach(function (key, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = LABELS[key];
        b.setAttribute('aria-pressed', String(i === 0));
        b.addEventListener('click', function () {
          p.outputs.forEach(function (k) {
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
      only.textContent = LABELS[p.outputs[0]];
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
    if (!isOriginal && wipe.dataset.aspectFrom === 'original') return;
    wipe.style.aspectRatio = img.naturalWidth + ' / ' + img.naturalHeight;
    wipe.dataset.aspectFrom = isOriginal ? 'original' : 'output';
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
