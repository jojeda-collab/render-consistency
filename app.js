/* Render Consistency - before/after wipe sliders */
(function () {
  'use strict';

  /* Examples are numbered only; the slug just locates the files. */
  var EXAMPLES = [
    { n: 1, slug: '01-street-arches' },
    { n: 2, slug: '02-street-spiral-stair' },
    { n: 3, slug: '03-roof-walkway' },
    { n: 4, slug: '04-courtyard' }
  ];

  var OUTPUTS = [
    { key: 'gemini',  label: 'Gemini' },
    { key: 'chatgpt', label: 'ChatGPT' }
  ];

  var START_PERCENT = 50;
  var KEY_STEP = 2;

  var root = document.getElementById('examples');
  if (!root) return;

  EXAMPLES.forEach(function (ex, i) {
    root.appendChild(buildExample(ex, i === 0));
  });

  /* ---------- build ---------- */

  function buildExample(ex, isFirst) {
    var lazy = isFirst ? 'eager' : 'lazy';
    var name = pad(ex.n);

    var section = el('section', 'example');
    section.id = 'ex-' + name;

    var head = el('div', 'example-head');

    var h2 = el('h2', 'example-title');
    h2.textContent = name;
    head.appendChild(h2);

    var wipe = el('div', 'wipe');

    /* AI outputs (right side), stacked underneath; one visible at a time */
    var outs = {};
    OUTPUTS.forEach(function (o) {
      var img = new Image();
      img.className = 'out out-' + o.key;
      img.src = 'images/' + ex.slug + '--' + o.key + '.jpg';
      img.alt = 'Example ' + name + ' - ' + o.label + ' output';
      img.loading = lazy;
      img.decoding = 'async';
      img.draggable = false;
      img.addEventListener('load', function () { seedAspect(wipe, img, false); });
      outs[o.key] = img;
      wipe.appendChild(img);
    });
    outs.gemini.classList.add('is-active');

    /* Original render (left side), clipped to the handle */
    var orig = new Image();
    orig.className = 'orig';
    orig.src = 'images/' + ex.slug + '--original.jpg';
    orig.alt = 'Example ' + name + ' - original 3D rendering';
    orig.loading = lazy;
    orig.decoding = 'async';
    orig.draggable = false;
    orig.addEventListener('load', function () { seedAspect(wipe, orig, true); });
    wipe.appendChild(orig);

    var tagLeft = el('span', 'tag tag-left');
    tagLeft.textContent = 'Render';
    var tagRight = el('span', 'tag tag-right');
    tagRight.textContent = 'Gemini';
    wipe.appendChild(tagLeft);
    wipe.appendChild(tagRight);

    /* Handle */
    var handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'handle';
    handle.setAttribute('role', 'slider');
    handle.setAttribute('aria-label', 'Example ' + name + ' - wipe between render and AI output');
    handle.setAttribute('aria-valuemin', '0');
    handle.setAttribute('aria-valuemax', '100');
    var arrows = el('span', 'arrows');
    arrows.textContent = '◀▶';
    handle.appendChild(arrows);
    wipe.appendChild(handle);

    /* Toggle */
    var toggle = el('div', 'toggle');
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', 'Example ' + name + ' - choose AI output');

    var buttons = {};
    OUTPUTS.forEach(function (o) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = o.label;
      b.setAttribute('aria-pressed', String(o.key === 'gemini'));
      b.addEventListener('click', function () { select(o.key); });
      buttons[o.key] = b;
      toggle.appendChild(b);
    });
    head.appendChild(toggle);

    function select(key) {
      OUTPUTS.forEach(function (o) {
        var on = o.key === key;
        outs[o.key].classList.toggle('is-active', on);
        buttons[o.key].setAttribute('aria-pressed', String(on));
        if (on) tagRight.textContent = o.label;
      });
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
