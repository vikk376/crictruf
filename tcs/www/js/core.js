/* Core: storage, router, helpers, DIC ground renderer, celebrations */
(function () {
  'use strict';
  const CE = window.CE;
  const KEY = 'crictruf_db_v1';
  const A = window.A = { views: {}, actions: {}, CE, KEY };

  const defaultDB = () => ({
    v: 1, user: null, theme: 'light', sound: true, mode: 'buttons',
    teams: [], dics: [CE.defaultDic('Default Turf')], rules: CE.clone(CE.DEFAULT_RULES),
    matches: [], tournaments: [], activeMatch: null, serverUrl: '', lastSync: 0,
  });
  let db = null;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
  if (!db || !db.v) db = defaultDB();
  db.rules = Object.assign(CE.clone(CE.DEFAULT_RULES), db.rules || {});
  db.rules.dismissals = Object.assign({}, CE.DEFAULT_RULES.dismissals, db.rules.dismissals);
  if (!db.dics || !db.dics.length) db.dics = [CE.defaultDic('Default Turf')];
  db.dics.forEach(CE.upgradeZones);
  (db.matches || []).forEach(m => m && m.dic && CE.upgradeZones(m.dic));
  A.db = db;
  A.ui = { view: 'login', params: {}, stack: [], modal: null, mod: null, zoneSel: null, zoneOv: null, draft: null, tab: 0 };
  const ui = A.ui;

  A.save = function () { try { localStorage.setItem(KEY, JSON.stringify(A.db)); } catch (e) { A.toast('Storage full: export a backup'); } };
  A.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const esc = A.esc;
  A.fmt1 = n => (Math.round(n * 10) / 10).toFixed(1);
  A.fmt2 = n => (Math.round(n * 100) / 100).toFixed(2);
  A.today = () => new Date().toISOString().slice(0, 10);
  A.getMatch = () => A.db.matches.find(m => m.id === A.db.activeMatch) || null;
  A.matchById = id => A.db.matches.find(m => m.id === id);
  A.canScore = () => !A.db.user || A.db.user.role !== 'viewer';
  A.canConfig = () => !A.db.user || A.db.user.role === 'admin';
  A.initials = n => (n || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
  A.nameOf = id => {
    for (const t of A.db.teams) { const p = t.players.find(p => p.id === id); if (p) return p.name; }
    for (const m of A.db.matches) for (const t of m.teams) { const p = t.players.find(p => p.id === id); if (p) return p.name; }
    return '?';
  };

  /* ---------- toast ---------- */
  A.toast = function (msg) {
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  };

  /* ---------- router ---------- */
  A.go = function (view, params, replace) {
    if (!replace) { ui.stack.push({ view: ui.view, params: ui.params }); try { history.pushState({}, ''); } catch (e) { } }
    ui.view = view; ui.params = params || {}; ui.modal = null; ui.zoneSel = null; ui.mod = null;
    A.render(); window.scrollTo(0, 0);
  };
  A.back = function () {
    const p = ui.stack.pop();
    if (p) { ui.view = p.view; ui.params = p.params; } else ui.view = 'home';
    ui.modal = null; ui.zoneSel = null; A.render();
  };
  window.addEventListener('popstate', () => { if (ui.stack.length) A.back(); });

  /* ---------- render ---------- */
  A.render = function () {
    document.documentElement.dataset.theme = A.db.theme;
    const v = A.views[ui.view] || A.views.home;
    const out = v();
    const root = document.getElementById('app');
    const scroll = window.scrollY;
    root.innerHTML = out.html + (ui.modal ? A.modalHTML() : '');
    if (out.keepScroll) window.scrollTo(0, scroll);
  };

  A.header = function (title, opts) {
    opts = opts || {};
    return '<header class="top">' + (opts.noBack ? '<span class="logo"></span>' : '<button data-a="back" aria-label="Back">‹</button>') +
      '<h1>' + esc(title) + '</h1>' + (opts.right || '') +
      '<button data-a="theme" aria-label="Theme">' + (A.db.theme === 'dark' ? '☀' : '☾') + '</button></header>';
  };
  A.navbar = function (on) {
    const items = [['home', '⌂', 'Home'], ['history', '▤', 'Matches'], ['teams', '☻', 'Teams'], ['stats', '▥', 'Stats'], ['more', '☰', 'More']];
    return '<nav class="nav">' + items.map(i => '<button class="' + (on === i[0] ? 'on' : '') + '" data-a="nav" data-v="' + i[0] + '"><i>' + i[1] + '</i>' + i[2] + '</button>').join('') + '</nav>';
  };
  A.page = (title, body, nav, opts) => ({ html: A.header(title, opts) + '<div class="page">' + body + '</div>' + (nav ? A.navbar(nav) : ''), keepScroll: opts && opts.keepScroll });

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const fn = A.actions[el.dataset.a];
    if (fn) { fn(el, e); }
  });
  function setPath(path, val) {
    const parts = path.split('.'); const roots = { ui: A.ui, db: A.db, draft: A.ui.draft };
    let o = roots[parts[0]]; if (!o) return;
    for (let i = 1; i < parts.length - 1; i++) { if (o[parts[i]] == null) o[parts[i]] = {}; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = val;
    return parts[0];
  }
  function onBind(e) {
    const el = e.target.closest('[data-b]'); if (!el) return;
    if (e.type === 'input' && (el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'radio' || el.type === 'file')) return;
    let val = el.type === 'checkbox' ? el.checked : el.value;
    if (el.dataset.n != null) val = Number(val) || 0;
    const root = setPath(el.dataset.b, val);
    if (root === 'db') A.save();
    if (el.dataset.r != null && e.type === 'change') A.render();
  }
  document.addEventListener('input', onBind); document.addEventListener('change', onBind);

  /* ---------- DIC ground renderer ---------- */
  function heatColor(v) {
    if (!v) return '#ffffff';
    if (v < 0.5) { const t = v / 0.5; return 'rgb(255,' + Math.round(255 - 43 * t) + ',' + Math.round(255 - 255 * t) + ')'; }
    const t = (v - 0.5) / 0.5; return 'rgb(255,' + Math.round(212 - 90 * t) + ',0)';
  }
  /* Box-cricket ground (batter at the top), drawn like the reference picture.
     Zone 2 = the grey wedges beside the pitch. Front field = 11 shot sectors in 5 rings:
     Zone 1 (near, around the pitch), Middle (2), Outer (3), Boundary (4) and the band over the net (6).
     Only Zone 1 and Zone 2 are DIC zones, the other rings are fixed. */
  const GW = 757, GH = 892, MX = p => [GW - p[0], p[1]], C0 = [378.5, 125];
  const IN_L = [[336, 36], [337, 86], [339, 106], [343, 124], [350, 132], [365, 132]];
  const OUT_L = [[72, 182], [72, 355], [72, 528], [72, 700], [118, 832], [292, 832]];
  const RAY_IN = IN_L.concat(IN_L.slice().reverse().map(MX)), RAY_OUT = OUT_L.concat(OUT_L.slice().reverse().map(MX));
  const half = pts => pts.concat(pts.slice().reverse().map(MX));
  const SHELLS = [
    null,
    half([[255, 0], [255, 290], [275, 340]]),
    half([[175, 0], [175, 470], [205, 555]]),
    half([[120, 0], [120, 598], [160, 703]]),
    [[72, 0], [72, 832], [685, 832], [685, 0]]
  ];
  function segHit(a, b, c, d) {
    const r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den, u = ((c[0] - a[0]) * r[1] - (c[1] - a[1]) * r[0]) / den, e = 1e-6;
    return t >= -e && t <= 1 + e && u >= -e && u <= 1 + e ? { u, pt: [a[0] + r[0] * t, a[1] + r[1] * t] } : null;
  }
  const pos = (poly, i, pt) => { /* position of a point on a polyline (segment index + fraction) */
    let best = null;
    for (let k = 0; k < poly.length - 1; k++) {
      const a = poly[k], b = poly[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
      const u = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L)), q = [a[0] + dx * u, a[1] + dy * u], dd = Math.hypot(q[0] - pt[0], q[1] - pt[1]);
      if (!best || dd < best.d) best = { d: dd, p: k + u };
    }
    return best.p;
  };
  const at = (poly, p) => { const k = Math.min(poly.length - 2, Math.floor(p + 1e-9)), u = p - k; return [poly[k][0] + (poly[k + 1][0] - poly[k][0]) * u, poly[k][1] + (poly[k + 1][1] - poly[k][1]) * u]; };
  /* hits[r][k] = position of ray k on shell r (shell 0 = the inner points) */
  const HIT = [];
  const INNER = RAY_IN.slice();
  HIT[0] = RAY_IN.map((_, k) => k);
  for (let r = 1; r <= 4; r++) HIT[r] = RAY_IN.map((a, k) => {
    const sh = SHELLS[r]; let found = null;
    for (let j = 0; j < sh.length - 1 && !found; j++) found = segHit(a, RAY_OUT[k], sh[j], sh[j + 1]);
    return found ? pos(sh, 0, found.pt) : pos(sh, 0, RAY_OUT[k]);
  });
  const subPath = (r, k) => { /* points of shell r between ray k and ray k+1 */
    if (r === 0) return [INNER[k], INNER[k + 1]];
    const sh = SHELLS[r], a = HIT[r][k], b = HIT[r][k + 1], out = [at(sh, a)];
    for (let i = Math.floor(a + 1e-9) + 1; i < b - 1e-9; i++) out.push(sh[i]);
    out.push(at(sh, b)); return out;
  };
  const toBand = p => [p[0] <= 72.5 ? 0 : p[0] >= 684.5 ? GW : p[0], p[1] >= 831.5 ? GH : p[1]];
  const CELL = {}; /* 'r,k' -> {pts, lab, area} */
  function area(p) { let s = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
  function centroid(p) { const A2 = area(p); let x = 0, y = 0; for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length], f = a[0] * b[1] - b[0] * a[1]; x += (a[0] + b[0]) * f; y += (a[1] + b[1]) * f; } return [x / (6 * A2), y / (6 * A2)]; }
  for (let k = 0; k < 11; k++) for (let r = 0; r < 5; r++) {
    let pts, lab;
    if (r < 4) { pts = subPath(r, k).concat(subPath(r + 1, k).slice().reverse()); lab = centroid(pts); }
    else {
      const inner = subPath(4, k), outer = inner.map(toBand); pts = inner.concat(outer.slice().reverse());
      let bi = 0, bl = -1; for (let i = 0; i < inner.length - 1; i++) { const l = Math.hypot(inner[i + 1][0] - inner[i][0], inner[i + 1][1] - inner[i][1]); if (l > bl) { bl = l; bi = i; } }
      const m1 = [(inner[bi][0] + inner[bi + 1][0]) / 2, (inner[bi][1] + inner[bi + 1][1]) / 2], m2 = toBand(m1); lab = [(m1[0] + m2[0]) / 2, (m1[1] + m2[1]) / 2];
    }
    CELL[r + ',' + k] = { pts, lab, area: Math.abs(area(pts)) };
  }
  const RAYDIR = RAY_IN.map((a, k) => { const b = RAY_OUT[k], d = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / d, (b[1] - a[1]) / d]; });
  const W2L = [[72, 0], [336, 0], [336, 36], [72, 182]], W2R = W2L.map(MX);
  const fmt = pts => pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  A.groundSVG = function (zones, o) {
    o = o || {};
    const labelOf = (z, small) => {
      if (o.heat) return o.heatText && o.heatText[z.id] != null ? String(o.heatText[z.id]) : '';
      if (z.off) return 'off';
      if (small) return String(z.runs);
      return z.runs + (z.rotate === 'change' ? '↻' : '');
    };
    const isSel = z => o.sel === z.id || (o.sel === 'z1' && z.ring === 0 && z.id !== 'z2');
    const polyFor = (z, pts, cls) => {
      const selc = isSel(z) ? (o.heat ? ' selk' : ' sel') : '';
      const fill = o.heat ? ' style="fill:' + (o.heat[z.id] != null ? heatColor(o.heat[z.id]) : '#fff') + '"' : '';
      return '<polygon class="zn ' + cls + selc + (z.off ? ' off' : '') + '" points="' + fmt(pts) + '"' + fill + ' data-a="' + (o.act || 'zone') + '" data-z="' + z.id + '"/>';
    };
    const text = (z, p, cls, small) => '<text class="zt ' + cls + '" data-t="' + z.id + '" x="' + p[0].toFixed(1) + '" y="' + p[1].toFixed(1) + '"' + (o.heat ? ' style="fill:#000"' : '') + '>' + esc(labelOf(z, small)) + '</text>';
    let s = '<svg class="ground' + (o.heat ? ' heat' : '') + '" viewBox="0 0 ' + GW + ' ' + (GH + 26) + '" role="img" aria-label="Box cricket ground zones">', txt = '', names = '';
    zones.forEach(z => {
      if (z.id === 'z2') {
        s += polyFor(z, W2L, 'zb2') + polyFor(z, W2R, 'zb2');
        [[196, 40, 68], [GW - 196, 40, 68]].forEach(q => { txt += text(z, [q[0], q[1]], 'zb'); txt += '<text class="zn-name" x="' + q[0] + '" y="' + q[2] + '">' + (o.heat ? '' : 'ZONE 2') + '</text>'; });
      } else if (z.ring >= 0 && z.ring <= 4 && z.sec < 11) {
        const c = CELL[z.ring + ',' + z.sec]; if (!c) return;
        s += polyFor(z, c.pts, 'r' + z.ring);
        if (o.heat || o.cfg || c.area > 2200) txt += text(z, c.lab, 'r' + z.ring, !o.heat && c.area < 4200);
        if (o.names && z.ring === 1) {
          const d1 = RAYDIR[z.sec], d2 = RAYDIR[z.sec + 1]; let ang = Math.atan2(d1[1] + d2[1], d1[0] + d2[0]) * 180 / Math.PI; if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
          names += '<text class="nm" transform="translate(' + c.lab[0].toFixed(1) + ' ' + c.lab[1].toFixed(1) + ') rotate(' + ang.toFixed(1) + ')">' + esc(z.label) + '</text>';
        }
      }
    });
    s += txt.replace(/<text class="zt r[012]"[^>]*>[^<]*<\/text>/g, m => o.names ? '' : m) + names;
    if (!o.heat) s += '<text class="zn-name" x="' + GW / 2 + '" y="300">ZONE 1</text>';
    s += '<polyline class="box" points="72,182 72,832 685,832 685,182"/>';
    s += '<rect class="pitch" x="358" y="2" width="41" height="130" rx="14"/><line class="stump" x1="363" x2="394" y1="16" y2="16"/><line class="stump" x1="363" x2="394" y1="118" y2="118"/>';
    s += '<text class="lbl" x="' + GW / 2 + '" y="912">▼ bowler end</text></svg>';
    return s;
  };

  /* ---------- 4 / 6 celebration ---------- */
  A.celebrate = function (n) {
    const el = document.createElement('div'); el.className = 'cele c' + n;
    let h = '';
    if (n === 4) h += '<div class="ring"></div><div class="ring"></div><div class="ring"></div>';
    const cols = n === 6 ? ['#FFD400', '#fff', '#FFE45C'] : ['#000', '#fff'];
    const pieces = n === 6 ? 46 : 22;
    for (let i = 0; i < pieces; i++) h += '<i class="cf" style="left:' + Math.random() * 100 + '%;background:' + cols[i % cols.length] + ';animation-delay:' + (Math.random() * .6).toFixed(2) + 's;animation-duration:' + (1.2 + Math.random()).toFixed(2) + 's"></i>';
    h += '<div class="txt">' + (n === 6 ? 'SIX!' : 'FOUR!') + '</div>';
    el.innerHTML = h; document.body.appendChild(el);
    setTimeout(() => el.remove(), 1950);
    if (A.db.sound) A.cheer(n === 6);
    try { navigator.vibrate && navigator.vibrate(n === 6 ? [60, 40, 120] : 70); } catch (e) { }
  };
  A.cheer = function (six) {
    try {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
      const ctx = A._ac || (A._ac = new C()); if (ctx.state === 'suspended') ctx.resume();
      const dur = six ? 1.3 : 0.8, len = Math.floor(ctx.sampleRate * dur), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 1.5);
      const src = ctx.createBufferSource(); src.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = .7;
      const g = ctx.createGain(); g.gain.value = six ? .35 : .25;
      src.connect(f); f.connect(g); g.connect(ctx.destination); src.start();
      const o = ctx.createOscillator(); const og = ctx.createGain(); o.type = 'square';
      o.frequency.setValueAtTime(six ? 440 : 523, ctx.currentTime); o.frequency.linearRampToValueAtTime(six ? 880 : 784, ctx.currentTime + .25);
      og.gain.setValueAtTime(.08, ctx.currentTime); og.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .4);
      o.connect(og); og.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + .45);
    } catch (e) { }
  };

  /* ---------- modal wrapper ---------- */
  A.sheet = (title, body) => '<div class="modal"><div class="sheet"><button class="close" data-a="closeModal">✕</button><h2>' + esc(title) + '</h2>' + body + '</div></div>';
  A.actions.closeModal = () => { ui.modal = null; A.render(); };
  A.actions.back = () => { if (ui.stack.length) { try { history.back(); } catch (e) { A.back(); } } else A.back(); };
  A.actions.theme = () => { A.db.theme = A.db.theme === 'dark' ? 'light' : 'dark'; A.save(); A.render(); };
  A.actions.nav = el => { ui.stack = []; ui.view = el.dataset.v === 'more' ? 'settings' : el.dataset.v; ui.params = {}; ui.modal = null; A.render(); window.scrollTo(0, 0); };
  A.modalHTML = function () { const f = A.modals[ui.modal.type]; return f ? f(ui.modal) : ''; };
  A.modals = {};

  window.addEventListener('storage', e => { if (e.key === KEY) { try { A.db = JSON.parse(e.newValue); db = A.db; if (ui.view === 'board') A.render(); } catch (x) { } } });
})();
