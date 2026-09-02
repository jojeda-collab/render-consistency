/* Render Consistency - videos page */
(function () {
  'use strict';

  var root = document.getElementById('video-list');
  if (!root || !window.RC) return;

  var vids = RC.videos || [];

  vids.forEach(function (v, i) {
    root.appendChild(buildItem(v, i === 0));
  });

  var total = document.getElementById('total-count');
  if (total) {
    total.textContent = vids.length + (vids.length === 1 ? ' loop' : ' loops');
  }

  function buildItem(v, isFirst) {
    var item = el('section', 'video-item');
    item.id = 'video-' + v.id;

    var head = el('div', 'video-item-head');
    var h2 = el('h2', 'video-item-title');
    h2.appendChild(document.createTextNode(v.label));
    var proj = el('span', 'video-project');
    proj.textContent = projectName(v.project);
    h2.appendChild(proj);
    head.appendChild(h2);

    var dl = document.createElement('a');
    dl.className = 'shot-dl';
    dl.href = v.file;
    dl.setAttribute('download', '');
    dl.textContent = 'Download';
    head.appendChild(dl);
    item.appendChild(head);

    var frame = el('div', 'video-frame');
    frame.style.aspectRatio = v.w + ' / ' + v.h;

    var video = document.createElement('video');
    video.src = v.file;
    video.loop = true;
    video.muted = true;
    video.controls = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('muted', '');
    /* only the first one autoplays; the rest wait to be asked */
    if (isFirst) {
      video.autoplay = true;
      video.preload = 'metadata';
    } else {
      video.preload = 'none';
    }
    frame.appendChild(video);
    item.appendChild(frame);

    var note = el('p', 'video-note');
    note.textContent = v.seconds + 's loop · ' + v.w + '×' + v.h + ' · MP4';
    item.appendChild(note);

    return item;
  }

  function projectName(id) {
    for (var i = 0; i < RC.projects.length; i++) {
      if (RC.projects[i].id === id) return RC.projects[i].name;
    }
    return id;
  }

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }
})();
