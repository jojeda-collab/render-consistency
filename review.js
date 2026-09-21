/* Render Consistency - per-render review marks and notes.

   Notes are shared: they live in a Supabase table so every reviewer sees
   what everyone else has written, and so do you. The anon key in
   review-config.js is public by design and reaches only that one table.

   With no key configured the same UI falls back to this browser's own
   storage, so the page still works - it just is not shared. */
(function () {
  'use strict';

  var CFG = window.RC_REVIEW || {};
  var REMOTE = !!(CFG.url && CFG.anonKey);
  var ENDPOINT = REMOTE ? CFG.url.replace(/\/+$/, '') + '/rest/v1/review_notes' : '';

  var LOCAL_KEY = 'rc-review-v1';
  var NAME_KEY = 'rc-review-name';
  var SAVE_DELAY = 700;
  var POLL_MS = 45000;

  var store = loadLocal();      /* key -> { s, n, author, t } */
  var painters = {};            /* key -> repaint fn, so remote edits show up */
  var dirty = {};               /* keys waiting to go up */
  var saveTimer = null;
  var bar = null, countEl = null, statusEl = null;
  var reviewer = readName();

  /* ---------- local cache ---------- */

  function loadLocal() {
    try {
      var raw = window.localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};   /* private mode, or storage blocked */
    }
  }

  function saveLocal() {
    try {
      window.localStorage.setItem(LOCAL_KEY, JSON.stringify(store));
    } catch (e) { /* nothing to do; the page still works */ }
  }

  function readName() {
    try { return window.localStorage.getItem(NAME_KEY) || ''; }
    catch (e) { return ''; }
  }

  function writeName(v) {
    try { window.localStorage.setItem(NAME_KEY, v); } catch (e) {}
  }

  function entryFor(key) {
    if (!store[key]) store[key] = { s: '', n: '' };
    return store[key];
  }

  function isEmpty(it) {
    return !it || (!it.s && !String(it.n || '').trim());
  }

  /* ---------- supabase ---------- */

  function headers(extra) {
    var h = {
      'apikey': CFG.anonKey,
      'Authorization': 'Bearer ' + CFG.anonKey,
      'Content-Type': 'application/json'
    };
    for (var k in extra) {
      if (Object.prototype.hasOwnProperty.call(extra, k)) h[k] = extra[k];
    }
    return h;
  }

  /* Pull everyone's notes and fold them in. Anything still waiting to be
     saved from this browser wins, so a slow round trip cannot overwrite
     what the reviewer just typed. */
  function pull() {
    if (!REMOTE) return Promise.resolve();
    return fetch(ENDPOINT + '?select=key,state,note,author,updated_at', {
      headers: headers(),
      cache: 'no-store'
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (rows) {
      rows.forEach(function (row) {
        if (dirty[row.key]) return;
        store[row.key] = {
          s: row.state || '',
          n: row.note || '',
          author: row.author || '',
          t: row.updated_at
        };
      });
      saveLocal();
      repaintAll();
      refreshBar();
      setStatus('');
    }).catch(function (err) {
      setStatus('offline');
      if (window.console) console.warn('[review] load failed:', err.message);
    });
  }

  function push() {
    if (!REMOTE) { saveLocal(); return; }

    var keys = Object.keys(dirty);
    if (!keys.length) return;

    var rows = keys.map(function (k) {
      var it = store[k] || { s: '', n: '' };
      return {
        key: k,
        state: it.s || null,
        note: String(it.n || ''),
        author: reviewer || null
      };
    });

    setStatus('saving');
    fetch(ENDPOINT, {
      method: 'POST',
      headers: headers({ 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify(rows)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error(t || ('HTTP ' + r.status)); });
      keys.forEach(function (k) { delete dirty[k]; });
      setStatus('saved');
    }).catch(function (err) {
      setStatus('offline');
      if (window.console) console.warn('[review] save failed:', err.message);
    });
  }

  function queue(key) {
    dirty[key] = true;
    saveLocal();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(push, SAVE_DELAY);
  }

  /* ---------- per-render control ---------- */

  function control(key, label) {
    var wrap = el('div', 'review');
    wrap.setAttribute('data-key', key);

    var marks = el('div', 'review-marks');
    var good = markButton('Good', 'good');
    var edit = markButton('Needs edit', 'edit');
    marks.appendChild(good);
    marks.appendChild(edit);

    var note = document.createElement('textarea');
    note.className = 'review-note';
    note.rows = 1;
    note.placeholder = 'What works, or what should change?';
    note.setAttribute('aria-label', 'Notes for ' + label);

    var by = el('p', 'review-by');

    note.addEventListener('input', function () {
      var it = entryFor(key);
      it.n = note.value;
      it.author = reviewer;
      queue(key);
      grow();
      refreshBar();
    });

    /* Measure from zero, not from auto: as a flex item, height:auto makes
       the textarea report the flex line's height rather than its content,
       which inflates an empty box to hundreds of pixels. A textarea in a
       hidden project tab measures as nothing, so leave it until its tab
       is shown and refresh() runs. */
    function grow() {
      if (!note.offsetParent) return;
      note.style.height = '0px';
      var h = note.scrollHeight;
      note.style.height = (h > 0 ? h + 2 : 40) + 'px';
    }

    function markButton(text, value) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'mark mark-' + value;
      b.textContent = text;
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var it = entryFor(key);
        it.s = (it.s === value) ? '' : value;   /* click again to clear */
        it.author = reviewer;
        queue(key);
        paint();
        refreshBar();
      });
      return b;
    }

    /* Called on first build and again whenever remote data arrives, so a
       note someone else added shows up without a reload. Never clobbers
       the box the reviewer is typing in. */
    function paint() {
      var it = store[key] || { s: '', n: '' };
      good.setAttribute('aria-pressed', String(it.s === 'good'));
      edit.setAttribute('aria-pressed', String(it.s === 'edit'));
      wrap.className = 'review' + (it.s ? ' is-' + it.s : '');

      if (document.activeElement !== note && note.value !== (it.n || '')) {
        note.value = it.n || '';
      }
      var who = it.author && it.author !== reviewer ? it.author : '';
      by.textContent = who ? who : '';
      by.hidden = !who;
      grow();
    }

    wrap.appendChild(marks);
    wrap.appendChild(note);
    wrap.appendChild(by);

    painters[key] = paint;
    paint();
    setTimeout(grow, 0);
    return wrap;
  }

  function repaintAll() {
    for (var k in painters) {
      if (Object.prototype.hasOwnProperty.call(painters, k)) painters[k]();
    }
  }

  /* ---------- summary bar ---------- */

  function mountBar() {
    if (bar) return;

    bar = el('div', 'review-bar');
    bar.setAttribute('role', 'status');

    var who = el('label', 'review-who');
    who.textContent = 'You';
    var nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'review-name';
    nameInput.placeholder = 'your name';
    nameInput.value = reviewer;
    nameInput.setAttribute('aria-label', 'Your name, saved with your notes');
    nameInput.addEventListener('input', function () {
      reviewer = nameInput.value.trim();
      writeName(reviewer);
    });
    who.appendChild(nameInput);
    bar.appendChild(who);

    countEl = el('span', 'review-count');
    bar.appendChild(countEl);

    statusEl = el('span', 'review-status');
    bar.appendChild(statusEl);

    var actions = el('div', 'review-bar-actions');
    actions.appendChild(action('Copy notes', onCopy));
    actions.appendChild(action('Download', onDownload));
    bar.appendChild(actions);

    document.body.appendChild(bar);
    refreshBar();

    if (REMOTE) {
      pull();
      setInterval(pull, POLL_MS);
      window.addEventListener('focus', pull);
    } else {
      setStatus('local');
    }
  }

  function action(text, fn) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'review-action';
    b.textContent = text;
    b.addEventListener('click', fn);
    return b;
  }

  function setStatus(kind) {
    if (!statusEl) return;
    var text = kind === 'saving' ? 'Saving…'
             : kind === 'saved'  ? 'Saved'
             : kind === 'offline' ? 'Not saved — check connection'
             : kind === 'local'  ? 'This device only'
             : '';
    statusEl.textContent = text;
    statusEl.className = 'review-status' + (kind ? ' is-' + kind : '');
  }

  function tally() {
    var good = 0, edit = 0, noted = 0;
    for (var k in store) {
      if (!Object.prototype.hasOwnProperty.call(store, k)) continue;
      var it = store[k];
      if (it.s === 'good') good++;
      else if (it.s === 'edit') edit++;
      if (String(it.n || '').trim()) noted++;
    }
    return { good: good, edit: edit, noted: noted };
  }

  function refreshBar() {
    if (!bar) return;
    var t = tally();
    var bits = [];
    if (t.good) bits.push(t.good + ' good');
    if (t.edit) bits.push(t.edit + ' to edit');
    if (t.noted) bits.push(t.noted + (t.noted === 1 ? ' note' : ' notes'));
    countEl.textContent = bits.length ? bits.join(' · ') : 'No marks yet';
    bar.className = 'review-bar is-visible';
  }

  /* ---------- report ---------- */

  function report() {
    var projects = (window.RC && window.RC.projects) || [];
    var names = {}, order = {};
    projects.forEach(function (p, i) { names[p.id] = p.name; order[p.id] = i; });

    var groups = {};
    for (var k in store) {
      if (!Object.prototype.hasOwnProperty.call(store, k)) continue;
      var it = store[k];
      if (isEmpty(it)) continue;
      var cut = k.indexOf('/');
      var pid = k.slice(0, cut);
      (groups[pid] = groups[pid] || []).push({
        which: k.slice(cut + 1),
        s: it.s,
        note: String(it.n || '').trim(),
        author: it.author || ''
      });
    }

    var ids = Object.keys(groups).sort(function (a, b) {
      var oa = order[a] === undefined ? 999 : order[a];
      var ob = order[b] === undefined ? 999 : order[b];
      return oa - ob;
    });

    var lines = [];
    lines.push('Render Consistency — review notes');
    lines.push(new Date().toLocaleString());
    lines.push('');

    ids.forEach(function (pid) {
      lines.push((names[pid] || pid).toUpperCase());
      groups[pid].sort(function (a, b) { return a.which < b.which ? -1 : 1; });
      groups[pid].forEach(function (row) {
        var state = row.s === 'good' ? 'GOOD' : row.s === 'edit' ? 'NEEDS EDIT' : 'NOTE';
        lines.push('  ' + row.which + '  ' + state + (row.author ? '  (' + row.author + ')' : ''));
        if (row.note) {
          row.note.split(/\n+/).forEach(function (para) {
            wrapText(para, 68).forEach(function (l) { lines.push('      ' + l); });
          });
        }
      });
      lines.push('');
    });

    var t = tally();
    lines.push('—');
    lines.push(t.good + ' good, ' + t.edit + ' to edit, ' + t.noted + ' with notes');
    return lines.join('\n');
  }

  function wrapText(text, width) {
    var words = text.split(/\s+/), out = [], line = '';
    words.forEach(function (w) {
      if (!line.length) line = w;
      else if ((line + ' ' + w).length <= width) line += ' ' + w;
      else { out.push(line); line = w; }
    });
    if (line.length) out.push(line);
    return out.length ? out : [''];
  }

  /* ---------- actions ---------- */

  function onCopy(e) {
    var btn = e.currentTarget;
    copyText(report()).then(
      function () { flash(btn, 'Copied'); },
      function () { flash(btn, 'Press Ctrl+C'); }
    );
  }

  function onDownload() {
    var blob = new Blob([report()], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'render-consistency-review.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function flash(btn, msg) {
    var was = btn.textContent;
    btn.textContent = msg;
    btn.classList.add('is-done');
    clearTimeout(btn._t);
    btn._t = setTimeout(function () {
      btn.textContent = was;
      btn.classList.remove('is-done');
    }, 1600);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
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
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? resolve() : reject();
    });
  }

  /* ---------- helpers ---------- */

  function el(tag, cls) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    return n;
  }

  window.RCReview = {
    control: control,
    mountBar: mountBar,
    report: report,
    refresh: repaintAll   /* call after showing a hidden tab so notes size correctly */
  };
})();
