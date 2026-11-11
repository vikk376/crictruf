/* Settings, rules editor, DIC zone editor, admin */
(function () {
  'use strict';
  const A = window.A, CE = A.CE, esc = A.esc, ui = A.ui;
  const getPath = p => { const s = p.split('.'); let o = { ui: A.ui, db: A.db, draft: A.ui.draft }[s[0]]; for (let i = 1; i < s.length; i++) o = o && o[s[i]]; return o; };

  /* ---------- rules form (used by settings + new match wizard) ---------- */
  A.rulesForm = function (path, R) {
    const num = (k, l) => '<div><label>' + l + '</label><input type="number" min="0" data-n data-b="' + path + '.' + k + '" value="' + R[k] + '"></div>';
    const sw = (k, l, sub) => '<div class="sw"><span>' + l + (sub ? '<div class="mut">' + sub + '</div>' : '') + '</span><input type="checkbox" data-b="' + path + '.' + k + '"' + (R[k] ? ' checked' : '') + '></div>';
    let h = '<div class="card"><h3 style="margin-top:0">Overs &amp; extras</h3><div class="grid2">' + num('ballsPerOver', 'Balls per over') + num('maxOversPerBowler', 'Max overs / bowler (0 = no limit)') + num('wideRuns', 'Wide penalty runs') + num('noBallRuns', 'No-ball penalty runs') + '</div>' +
      sw('wideReball', 'Wide is re-bowled', 'Off = a wide counts as a ball') + sw('noBallReball', 'No-ball is re-bowled') + sw('freeHit', 'Free hit after no-ball', 'Only run out allowed on a free hit') + sw('overEndSwap', 'Change strike at end of over') + sw('lastManBatting', 'Last-man batting', 'Innings continues until every batter is out') + '</div>';
    h += '<div class="card"><h3 style="margin-top:0">Dismissals allowed</h3>' + CE.DISMISSALS.map(d => '<div class="sw"><span>' + esc(d.label) + '</span><input type="checkbox" data-b="' + path + '.dismissals.' + d.k + '"' + (R.dismissals[d.k] !== false ? ' checked' : '') + '></div>').join('') + '</div>';
    h += '<div class="card"><h3 style="margin-top:0">Super over</h3>' + sw('superOver', 'Super over on a tie') + '<div class="grid2">' + num('superOverOvers', 'Super over overs') + num('superOverWickets', 'Wickets') + '</div></div>';
    h += '<div class="card"><h3 style="margin-top:0">DIC scoring</h3>' + sw('autoCommitZone', 'Auto-score on zone tap', 'Off = tap a zone, check it, then Confirm') + '</div>';
    h += '<div class="card"><h3 style="margin-top:0">Local rule shots</h3><div class="mut">Quick buttons on the scoring screen for roof, side-wall, net-touch and similar local rules.</div>' +
      (R.special || []).map((s, i) => '<div class="card" style="margin:8px 0"><input data-b="' + path + '.special.' + i + '.name" value="' + esc(s.name) + '" placeholder="Rule name"><div class="grid3"><div><label>Runs</label><input type="number" min="0" max="8" data-n data-b="' + path + '.special.' + i + '.runs" value="' + s.runs + '"></div><div><label>Strike</label><select data-b="' + path + '.special.' + i + '.rotate"><option value="keep"' + (s.rotate === 'keep' ? ' selected' : '') + '>Same</option><option value="change"' + (s.rotate === 'change' ? ' selected' : '') + '>Change</option></select></div><div><label>Out?</label><input type="checkbox" data-b="' + path + '.special.' + i + '.out"' + (s.out ? ' checked' : '') + '></div></div><button class="btn sm danger" data-a="delSpecial" data-p="' + path + '" data-i="' + i + '">Remove</button></div>').join('') +
      '<button class="btn sm" data-a="addSpecial" data-p="' + path + '">+ Add local rule</button></div>';
    h += '<div class="card"><label>Rule notes (boundary, roof, side wall, net touch…)</label><textarea rows="3" data-b="' + path + '.notes" placeholder="Anything the scorers should remember">' + esc(R.notes || '') + '</textarea></div>';
    return h;
  };
  A.actions.addSpecial = el => { const R = getPath(el.dataset.p); (R.special = R.special || []).push({ id: CE.uid(), name: 'New rule', runs: 1, rotate: 'keep', out: false }); if (/^db/.test(el.dataset.p)) A.save(); A.render(); };
  A.actions.delSpecial = el => { const R = getPath(el.dataset.p); R.special.splice(+el.dataset.i, 1); if (/^db/.test(el.dataset.p)) A.save(); A.render(); };

  A.views.rules = function () {
    const ro = !A.canConfig();
    return A.page('Default rules', (ro ? '<div class="card">Only an Admin can change rules.</div>' : '<p class="mut">These are the defaults for every new match. Each match stores its own copy, so changing them never affects past matches.</p>') + '<fieldset ' + (ro ? 'disabled' : '') + ' style="border:0;padding:0;margin:0">' + A.rulesForm('db.rules', A.db.rules) + '</fieldset>' +
      (ro ? '' : '<button class="btn ghost" data-a="resetRules">Reset rules to defaults</button>'), null, { keepScroll: true });
  };
  A.actions.resetRules = () => { A.db.rules = CE.clone(CE.DEFAULT_RULES); A.save(); A.render(); };

  /* ---------- DIC editor ---------- */
  function curDic() { return A.db.dics.find(d => d.id === ui.dicId) || A.db.dics[0]; }
  A.views.dic = function () {
    const d = curDic(), di = A.db.dics.indexOf(d), ro = !A.canConfig();
    const grp = ui.zsel ? zgrp(d) : [], z = grp[0] || null;
    const zname = ui.zsel === 'z1' ? 'Zone 1 (near ring)' : 'Zone 2 (grey area)';
    let h = '<p class="mut">Only <b>Zone 1</b> (the near ring around the pitch) and <b>Zone 2</b> (the grey area beside it) are DIC zones: you choose their runs and whether the strike changes. Everything else stays fixed: Middle 2, Outer 3 (strike changes), Boundary 4, over the net 6. Make one preset per turf or tournament.</p>' +
      '<label>Preset</label><select data-b="ui.dicId" data-r>' + A.db.dics.map(x => '<option value="' + x.id + '"' + (x.id === d.id ? ' selected' : '') + '>' + esc(x.name + (x.turf ? ' · ' + x.turf : '')) + '</option>').join('') + '</select>' +
      '<div class="grid2"><div><label>Preset name</label><input data-b="db.dics.' + di + '.name" value="' + esc(d.name) + '"' + (ro ? ' disabled' : '') + '></div><div><label>Turf / ground</label><input data-b="db.dics.' + di + '.turf" value="' + esc(d.turf || '') + '" placeholder="Turf name"' + (ro ? ' disabled' : '') + '></div></div>' +
      '<div class="card">' + '<div class="row sp"><span class="mut">Tap Zone 1 or Zone 2 to edit</span><button class="chip on" style="margin:0;flex:none" data-a="names">' + (ui.names ? 'Show runs' : 'Show shot names') + '</button></div>' + A.groundSVG(d.zones, { cfg: true, sel: ui.zsel, act: 'dzone', names: ui.names }) + '</div>';
    if (z) {
      h += '<div class="zinfo" style="position:static"><div class="z">' + zname + '</div>' +
        '<div class="sw" style="border:0"><span>Zone switched on</span><input type="checkbox" ' + (z.off ? '' : 'checked') + ' onchange="A.actions.dzoff(this.checked)"' + (ro ? ' disabled' : '') + '></div>' +
        '<div class="row"><button data-a="dzrun" data-d="-1"' + (ro ? ' disabled' : '') + '>−</button><div class="c b" style="font-size:24px">' + z.runs + ' run' + (z.runs === 1 ? '' : 's') + '</div><button data-a="dzrun" data-d="1"' + (ro ? ' disabled' : '') + '>+</button></div>' +
        '<div class="row" style="margin-top:8px"><button data-a="dzrot" data-v="keep" style="' + (z.rotate === 'keep' ? 'background:#000;color:var(--y)' : '') + '"' + (ro ? ' disabled' : '') + '>Same striker</button><button data-a="dzrot" data-v="change" style="' + (z.rotate === 'change' ? 'background:#000;color:var(--y)' : '') + '"' + (ro ? ' disabled' : '') + '>Change strike ↻</button></div></div>';
    }
    h += '<div class="card"><h3 style="margin-top:0">Shot names</h3><div class="mut">Left to right around the ground (right-hand batter). Shown with "Show shot names".</div><div class="grid2">' + CE.SHOTS.map((n, k) => '<div><label>' + (k + 1) + '</label><input value="' + esc((d.zones.find(x => x.ring === 1 && x.sec === k) || {}).label || n) + '" onchange="A.actions.shotName(' + k + ',this.value)"' + (ro ? ' disabled' : '') + '></div>').join('') + '</div></div>';
    if (!ro) h += '<div class="grid2" style="margin-top:10px"><button class="btn sm" data-a="dicNew">+ New preset</button><button class="btn sm ghost" data-a="dicDup">Duplicate</button><button class="btn sm ghost" data-a="dicReset">Reset zones</button><button class="btn sm danger" data-a="dicDel"' + (A.db.dics.length < 2 ? ' disabled' : '') + '>Delete</button></div>';
    return A.page('DIC zones', h, null, { keepScroll: true });
  };
  const zgrp = d => ui.zsel === 'z1' ? d.zones.filter(z => z.ring === 0 && z.id !== 'z2') : d.zones.filter(z => z.id === ui.zsel);
  A.actions.dzone = el => {
    const d = curDic(), z = d.zones.find(x => x.id === el.dataset.z); if (!z) return;
    if (z.id === 'z2') ui.zsel = 'z2'; else if (z.ring === 0) ui.zsel = 'z1';
    else { ui.zsel = null; A.toast('Fixed zone: ' + z.runs + ' run' + (z.runs === 1 ? '' : 's') + '. Only Zone 1 and Zone 2 can be changed'); }
    A.render();
  };
  A.actions.dzrun = el => { if (!A.canConfig()) return; zgrp(curDic()).forEach(z => z.runs = Math.max(0, Math.min(8, z.runs + (+el.dataset.d)))); A.save(); A.render(); };
  A.actions.dzrot = el => { if (!A.canConfig()) return; zgrp(curDic()).forEach(z => z.rotate = el.dataset.v); A.save(); A.render(); };
  A.actions.shotName = (k, v) => { if (!A.canConfig()) return; v = (v || '').trim(); if (!v) return A.render(); curDic().zones.filter(z => z.ring < 5 && z.sec === k).forEach(z => z.label = v); A.save(); A.toast('Saved'); A.render(); };
  A.actions.dzoff = on => { if (!A.canConfig()) return; zgrp(curDic()).forEach(z => z.off = !on); A.save(); A.render(); };
  A.actions.dicNew = () => { const d = CE.defaultDic('New turf'); A.db.dics.push(d); ui.dicId = d.id; ui.zsel = null; A.save(); A.render(); };
  A.actions.dicDup = () => { const d = CE.clone(curDic()); d.id = CE.uid(); d.name += ' copy'; A.db.dics.push(d); ui.dicId = d.id; A.save(); A.render(); };
  A.actions.dicReset = () => { if (!confirm('Reset this preset (Zone 1, Zone 2 and shot names) to the defaults?')) return; curDic().zones = CE.buildDefaultZones(); A.save(); A.render(); };
  A.actions.dicDel = () => { if (!confirm('Delete this preset? Past matches keep their own copy.')) return; A.db.dics = A.db.dics.filter(x => x.id !== curDic().id); ui.dicId = A.db.dics[0].id; ui.zsel = null; A.save(); A.render(); };

  /* ---------- settings / more ---------- */
  A.views.settings = function () {
    const u = A.db.user || {};
    const row = (a, v, t, s) => '<button class="card" style="width:100%;text-align:left" data-a="go" data-v="' + v + '"><b>' + t + '</b><div class="mut">' + s + '</div></button>';
    let h = '<div class="card row sp"><div><b>' + esc(u.name || '') + '</b><div class="mut">Role: ' + esc(u.role || '') + '</div></div><button class="btn sm ghost" data-a="logout" style="flex:none">Switch</button></div>' +
      '<div class="card"><div class="sw"><span><b>Dark mode</b></span><button class="chip on" style="margin:0" data-a="theme">' + (A.db.theme === 'dark' ? 'On: tap for light' : 'Off: tap for dark') + '</button></div>' +
      '<div class="sw"><span><b>4 / 6 celebration sound</b><div class="mut">The animated background always plays</div></span><input type="checkbox" data-b="db.sound"' + (A.db.sound ? ' checked' : '') + '></div></div>';
    h += row('go', 'dic', '◎ DIC zone presets', 'Runs and strike rotation per zone, per turf') + row('go', 'rules', '⚙ Default match rules', 'Wides, no-balls, free hit, local rule shots…') + row('go', 'tournaments', '🏆 Tournaments', 'Fixtures, points table, NRR, leaderboards') + row('go', 'admin', '🛡 Admin, backup & sync', 'Backup data, restore, offline sync') + row('go', 'about', 'ⓘ About', 'Version and how DIC scoring works');
    return A.page('More', h, 'more', { noBack: true });
  };
  A.actions.logout = () => { A.db.user = null; A.save(); ui.stack = []; ui.view = 'login'; A.render(); };

  A.views.about = function () {
    return A.page('About', '<div class="card"><b>CricTruf 1.0</b><p>CricTruf is built for tennis-ball, turf, box and gully cricket. Every delivery is saved on your phone the moment you score it, so it works with no internet.</p><h3>How DIC scoring works</h3><p>Open the <b>DIC Ground</b> tab while scoring and tap where the ball went. Zone 1 (back wall) and Zone 2 (behind square) give the runs you chose at the start of the match, by default 1 run with the same striker until the over completes. The front field is split into shot sectors (cover, cut, straight drive and so on) and only there can a 4 or a 6 be scored. The zone\'s runs and strike rule are applied. Confirm, or override the runs / strike for that one ball. The tapped zone is saved with the delivery and shown in Analytics.</p><h3>Undo &amp; correction</h3><p>Undo removes the last delivery. Correct lets you fix any of the last 12 balls. Every undo and correction is kept in the match audit history.</p></div>', null);
  };

  /* ---------- admin ---------- */
  A.views.admin = function () {
    const ro = !A.canConfig();
    const pend = A.db.matches.filter(m => (m.updated || m.created) > (A.db.lastSync || 0)).length;
    let h = '<div class="card"><h3 style="margin-top:0">Role on this device</h3><div>' + ['admin', 'scorer', 'viewer'].map(r => '<button class="chip ' + (A.db.user.role === r ? 'on' : '') + '" data-a="role" data-v="' + r + '">' + r + '</button>').join('') + '</div><div class="mut">Admin: rules, DIC, tournaments. Scorer: scoring. Viewer: read only.</div></div>';
    h += '<div class="card"><h3 style="margin-top:0">Offline sync</h3><div class="mut">All deliveries are stored on this device. ' + pend + ' match(es) changed since the last sync' + (A.db.lastSync ? ' (' + new Date(A.db.lastSync).toLocaleString() + ')' : '') + '. Each delivery has a unique id so a server can ignore duplicates.</div>' +
      '<label>Server URL (optional)</label><input data-b="db.serverUrl" value="' + esc(A.db.serverUrl || '') + '" placeholder="https://your-server.example.com"><button class="btn" data-a="syncNow">Sync now</button><div class="mut" style="margin-top:6px">No server is included in this build: leave blank to use on-device storage and the backup below.</div></div>';
    h += '<div class="card"><h3 style="margin-top:0">Backup &amp; restore</h3><button class="btn" data-a="backup">Copy / share full backup</button><label style="display:block;margin-top:10px">Paste a backup to restore</label><textarea rows="3" data-b="ui.restore" placeholder="Paste backup JSON here"></textarea><button class="btn ghost" data-a="restore"' + (ro ? ' disabled' : '') + '>Restore</button></div>';
    h += '<div class="card"><h3 style="margin-top:0">Audit history</h3>' + (function () { const a = []; A.db.matches.forEach(m => (m.audit || []).forEach(x => a.push({ m: m.name, x }))); a.sort((p, q) => q.x.ts - p.x.ts); return a.length ? a.slice(0, 15).map(r => '<div class="row sp"><span>' + esc(r.m) + ' · <b>' + r.x.action + '</b></span><span class="mut">' + new Date(r.x.ts).toLocaleTimeString() + '</span></div>').join('') : '<span class="mut">No undo/correction yet</span>'; })() + '</div>';
    if (!ro) h += '<button class="btn danger" data-a="wipe">Erase all data on this device</button>';
    return A.page('Admin', h, null, { keepScroll: true });
  };
  A.actions.role = el => { A.db.user.role = el.dataset.v; A.save(); A.render(); };
  A.actions.backup = () => A.copy(JSON.stringify(A.db));
  A.actions.restore = () => {
    try { const d = JSON.parse(ui.restore); if (!d.v || !d.matches) throw 0; if (!confirm('Replace all data on this device with this backup?')) return; d.user = A.db.user; A.db = d; A.save(); A.toast('Restored'); ui.restore = ''; A.render(); } catch (e) { A.toast('Not a valid backup'); }
  };
  A.actions.wipe = () => { if (!confirm('Erase everything on this device? This cannot be undone.')) return; localStorage.removeItem(A.KEY); location.reload(); };
  A.actions.syncNow = async () => {
    const url = (A.db.serverUrl || '').replace(/\/$/, ''); if (!url) return A.toast('Offline mode: no server set');
    if (!navigator.onLine) return A.toast('No internet connection');
    try {
      const r = await fetch(url + '/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: A.db.user, matches: A.db.matches.filter(m => (m.updated || m.created) > (A.db.lastSync || 0)) }) });
      if (!r.ok) throw new Error(r.status); A.db.lastSync = Date.now(); A.save(); A.toast('Synced'); A.render();
    } catch (e) { A.toast('Sync failed: saved on device'); }
  };
  window.addEventListener('online', () => { if (A.db.serverUrl) A.actions.syncNow(); });
})();
