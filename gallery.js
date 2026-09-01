/* Render Consistency - per-model gallery page.
   The page names its model with <body data-model="gemini"> and this fills in
   the heading, the grid and the download link. */
(function () {
  'use strict';

  var RC = window.RC;
  if (!RC) return;

  var variant = document.body.getAttribute('data-model');
  var label = RC.labels[variant];
  var root = document.getElementById('gallery');
  if (!variant || !label || !root) return;

  var count = 0;
  var shown = 0;

  RC.projects.forEach(function (p) {
    var names = RC.examplesWith(p, variant);
    if (!names.length) return;
    shown++;

    var section = el('section', 'gallery-project');
    section.id = 'g-' + p.id;

    var h2 = el('h2', 'gallery-project-title');
    h2.textContent = p.name;
    var n = el('span', 'gallery-count');
    n.textContent = names.length + (names.length === 1 ? ' image' : ' images');
    h2.appendChild(n);
    section.appendChild(h2);

    var grid = el('div', 'gallery-grid');

    names.forEach(function (name) {
      var src = RC.src(p.id, name, variant);
      var file = p.id + '-' + name + '-' + variant + '.jpg';

      var fig = el('figure', 'shot');

      var a = document.createElement('a');
      a.href = src;
      a.target = '_blank';
      a.rel = 'noopener';
      a.className = 'shot-link';
      a.setAttribute('aria-label', p.name + ' ' + name + ' - open full size');

      var img = new Image();
      img.src = src;
      img.alt = p.name + ' ' + name + ' - ' + label + ' output';
      img.loading = count < 2 ? 'eager' : 'lazy';
      img.decoding = 'async';
      a.appendChild(img);
      fig.appendChild(a);

      var cap = el('figcaption', 'shot-cap');
      var num = el('span', 'shot-num');
      num.textContent = name;
      cap.appendChild(num);

      var dl = document.createElement('a');
      dl.className = 'shot-dl';
      dl.href = src;
      dl.download = file;
      dl.textContent = 'Download';
      cap.appendChild(dl);

      fig.appendChild(cap);
      grid.appendChild(fig);
      count++;
    });

    section.appendChild(grid);
    root.appendChild(section);
  });

  /* Count only the projects that actually have this output, not every project. */
  var total = document.getElementById('total-count');
  if (total) {
    total.textContent = count + ' images across ' + shown +
      (shown === 1 ? ' project' : ' projects');
  }

  /* Label the zip button from the manifest that built it, so the file count
     and size cannot drift out of date when images are added or replaced.
     Fetch fails on file://, which just leaves the plain "ZIP" label. */
  var zipMeta = document.getElementById('zip-meta');
  if (zipMeta && window.fetch) {
    fetch('downloads/manifest.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) {
        var d = m && m[variant];
        if (!d) return;
        zipMeta.textContent = 'ZIP · ' + d.files + ' files · ' + mb(d.bytes);
      })
      .catch(function () { /* leave the fallback label */ });
  }

  function mb(bytes) {
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
})();
