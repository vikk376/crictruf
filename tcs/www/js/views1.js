/* Login, home, new-match wizard, teams, players */
(function () {
  'use strict';
  const A = window.A, CE = A.CE, esc = A.esc, ui = A.ui, db = () => A.db;
  const COLORS = ['#FFD400', '#ffffff', '#111111', '#FF8A00', '#d62828', '#1a8f3c', '#1565c0', '#8e24aa'];

  A.actions.open = el => {
    const id = el.dataset.id, v = el.dataset.v;
    if (id) A.db.activeMatch = id;
    A.save(); A.go(v, { id });
  };
  A.actions.openMatch = el => {
    const m = A.matchById(el.dataset.id); A.db.activeMatch = m.id; A.save();
    A.go(m.status === 'completed' ? 'summary' : 'live', { id: m.id });
  };

  /* ---------- login ---------- */
  A.views.login = function () {
    if (A.db.user) { ui.view = 'home'; return A.views.home(); }
    return { html: '<div class="login"><div class="logo" style="width:64px;height:64px"></div><h1>Cric<br>Truf</h1><p style="color:#fff">Tennis-ball &amp; turf cricket scoring with DIC zone scoring. Works offline.</p>' +
      '<label>Your name</label><input id="lg_name" placeholder="e.g. Rahul" autocomplete="off">' +
      '<label>Role</label><select id="lg_role"><option value="admin">Admin / Organizer (full control)</option><option value="scorer">Scorer</option><option value="viewer">Viewer (read only)</option></select>' +
      '<button class="btn" data-a="login">Enter</button><p style="color:#bbb;font-size:12px;margin-top:14px">Accounts are stored on this device (offline-first). Role limits what this device can do.</p></div>' };
  };
  A.actions.login = () => {
    const name = document.getElementById('lg_name').value.trim() || 'Scorer';
    A.db.user = { name, role: document.getElementById('lg_role').value }; A.save(); ui.view = 'home'; A.render();
  };

  /* ---------- home ---------- */
  A.views.home = function () {
    const d = A.db, act = A.getMatch(), live = act && act.status !== 'completed' ? act : null;
    let h = '<div class="hero"><div class="tag k">Hi ' + esc(d.user ? d.user.name : '') + '</div><h2 style="margin:6px 0 10px;font-size:24px">Ready to score?</h2>' + (A.canScore() ? '<button class="btn k" data-a="newMatch">+ New match</button>' : '<div>Viewer mode</div>') + '</div>';
    if (live) {
      const ev = CE.evaluate(live), inn = ev.current >= 0 ? live.innings[ev.current] : null, st = inn ? CE.replay(live, inn) : null;
      h += '<div class="card k"><div class="row sp"><span class="tag">LIVE</span><span>' + esc(live.name) + '</span></div><div style="font-size:30px;font-weight:900;margin:6px 0">' + (st ? esc(live.teams[inn.batting].name) + ' ' + st.runs + '/' + st.wkts + ' <small>(' + st.oversText + ')</small>' : 'Between innings') + '</div><button class="btn" data-a="openMatch" data-id="' + live.id + '">Resume scoring</button></div>';
    }
    h += '<div class="grid2"><button class="card c" data-a="go" data-v="teams"><b>☻ Teams &amp; players</b></button><button class="card c" data-a="go" data-v="tournaments"><b>🏆 Tournaments</b></button><button class="card c" data-a="go" data-v="dic"><b>◎ DIC zones</b></button><button class="card c" data-a="go" data-v="stats"><b>▥ Analytics</b></button></div>';
    if (!d.teams.length) h += '<div class="card"><b>First time?</b><p class="mut">Add two sample teams to try the app in seconds, or create your own in Teams.</p><button class="btn sm" data-a="demo">Add demo teams</button></div>';
    const recent = d.matches.slice(0, 4);
    h += '<h2>Recent matches</h2>' + (recent.length ? recent.map(matchItem).join('') : '<div class="empty">No matches yet</div>');
    return A.page('CricTruf', h, 'home', { noBack: true });
  };
  A.actions.go = el => A.go(el.dataset.v, {});
  function matchItem(m) {
    const ev = CE.evaluate(m);
    return '<div class="card" data-a="openMatch" data-id="' + m.id + '"><div class="row sp"><b>' + esc(m.name) + '</b><span class="tag ' + (m.status === 'completed' ? 'k' : '') + '">' + (m.status === 'completed' ? 'Done' : m.status === 'toss' ? 'Setup' : 'Live') + '</span></div>' +
      '<div class="mut">' + esc(m.teams[0].name) + ' vs ' + esc(m.teams[1].name) + ' · ' + esc(m.date) + (m.venue ? ' · ' + esc(m.venue) : '') + '</div>' +
      (ev.text ? '<div class="b" style="margin-top:4px">' + esc(ev.text) + '</div>' : '') + '</div>';
  }
  A.matchItem = matchItem;

  A.actions.demo = () => {
    const mk = (name, color, names) => ({ id: CE.uid(), name, color, players: names.map((n, i) => ({ id: CE.uid(), name: n, role: i === 0 ? 'Wicketkeeper' : i < 4 ? 'Batsman' : i < 6 ? 'All-rounder' : 'Bowler', bat: 'Right', bowl: i > 3 ? 'Right-arm medium' : 'None' })) });
    A.db.teams.push(mk('Thunder XI', '#FFD400', ['Aarav', 'Rohan', 'Kabir', 'Vihaan', 'Arjun', 'Dev', 'Ishaan', 'Rudra', 'Yash']));
    A.db.teams.push(mk('Turf Kings', '#ffffff', ['Sameer', 'Farhan', 'Imran', 'Zaid', 'Nadeem', 'Ayaan', 'Rehan', 'Sufiyan', 'Tariq']));
    A.save(); A.toast('Demo teams added'); A.render();
  };

  /* ---------- match wizard ---------- */
  A.actions.newMatch = () => {
    ui.draft = { step: 1, name: '', date: A.today(), venue: '', turf: '', overs: 10, ppt: 8, a: '', b: '', dicId: A.db.dics[0].id, rules: CE.clone(A.db.rules), tournamentId: null, fixtureId: null, xi: {}, sub: {}, cap: {}, wk: {}, toss: {}, back: { z1: { on: true, runs: 1, change: false }, z2: { on: true, runs: 1, change: false } } };
    A.go('newmatch');
  };
  const stepBar = n => '<div class="stepper">' + [1, 2, 3, 4, 5].map(i => '<i class="' + (i <= n ? 'on' : '') + '"></i>').join('') + '</div>';
  const TITLES = ['', 'Match details', 'Select teams', 'Playing XI', 'Match rules', 'Toss'];

  A.views.newmatch = function () {
    const d = ui.draft; if (!d) { A.actions.newMatch(); return A.views.newmatch(); }
    let h = stepBar(d.step) + '<h2 style="margin-top:0">' + d.step + '. ' + TITLES[d.step] + '</h2>';
    if (d.step === 1) {
      h += '<label>Match name</label><input data-b="draft.name" value="' + esc(d.name) + '" placeholder="e.g. Sunday Final">' +
        '<div class="grid2"><div><label>Date</label><input type="date" data-b="draft.date" value="' + esc(d.date) + '"></div><div><label>Players / team</label><input type="number" min="2" max="15" data-n data-b="draft.ppt" value="' + d.ppt + '"></div></div>' +
        '<label>Venue</label><input data-b="draft.venue" value="' + esc(d.venue) + '" placeholder="City / area">' +
        '<label>Turf / ground name</label><input data-b="draft.turf" value="' + esc(d.turf) + '" list="turfs" placeholder="e.g. Green Box Turf"><datalist id="turfs">' + A.db.dics.filter(x => x.turf).map(x => '<option value="' + esc(x.turf) + '">').join('') + '</datalist>' +
        '<label>Overs</label><div>' + [5, 6, 8, 10, 12, 15, 20].map(o => '<button class="chip ' + (d.overs === o ? 'on' : '') + '" data-a="overs" data-v="' + o + '">' + o + '</button>').join('') + '</div>' +
        '<label>Custom overs</label><input type="number" min="1" max="50" data-n data-b="draft.overs" value="' + d.overs + '">' +
        '<label>DIC zone configuration</label><select data-b="draft.dicId">' + A.db.dics.map(x => '<option value="' + x.id + '"' + (x.id === d.dicId ? ' selected' : '') + '>' + esc(x.name + (x.turf ? ' · ' + x.turf : '')) + '</option>').join('') + '</select>' +
        '<div class="card"><h3 style="margin-top:0">Zone 1 and Zone 2 (DIC)</h3><div class="mut">Zone 1 = the near ring around the pitch. Zone 2 = the grey area beside the pitch. Decide how they score in this match. With "same striker" the strike stays put until the over completes. The rest of the ground scores as normal (2, 3, 4, 6).</div>' +
        ['z1', 'z2'].map((k, i) => { const b = (d.back || (d.back = { z1: { on: true, runs: 1, change: false }, z2: { on: true, runs: 1, change: false } }))[k]; return '<div class="sw"><span><b>Zone ' + (i + 1) + '</b></span><input type="checkbox" data-b="draft.back.' + k + '.on"' + (b.on ? ' checked' : '') + '></div>' + (b.on ? '<div class="grid2"><div><label>Runs</label><input type="number" min="0" max="6" data-n data-b="draft.back.' + k + '.runs" value="' + b.runs + '"></div><div class="sw" style="border:0"><span>Change strike</span><input type="checkbox" data-b="draft.back.' + k + '.change"' + (b.change ? ' checked' : '') + '></div></div>' : '<div class="mut">Switched off: taps on this zone are ignored</div>'); }).join('') + '</div>' +
        (d.tournamentId ? '<div class="tag k">Tournament match</div>' : '');
    } else if (d.step === 2) {
      const T = A.db.teams;
      if (T.length < 2) h += '<div class="card"><p>You need at least two teams.</p><button class="btn sm" data-a="demo">Add demo teams</button> <button class="btn sm ghost" data-a="go" data-v="teams">Create teams</button></div>';
      const sel = (k, other) => '<select data-b="draft.' + k + '" data-r><option value="">Select…</option>' + T.map(t => '<option value="' + t.id + '"' + (t.id === d[k] ? ' selected' : '') + (t.id === d[other] ? ' disabled' : '') + '>' + esc(t.name) + '</option>').join('') + '</select>';
      h += '<label>Team A</label>' + sel('a', 'b') + '<label>Team B</label>' + sel('b', 'a');
    } else if (d.step === 3) {
      [d.a, d.b].forEach(tid => {
        const t = A.db.teams.find(t => t.id === tid); if (!t) return;
        if (!d.xi[tid]) { d.xi[tid] = t.players.slice(0, d.ppt).map(p => p.id); d.sub[tid] = []; d.cap[tid] = d.xi[tid][0] || ''; d.wk[tid] = (t.players.find(p => p.role === 'Wicketkeeper' && d.xi[tid].includes(p.id)) || {}).id || ''; }
        h += '<div class="card"><div class="row sp"><b>' + esc(t.name) + '</b><span class="tag ' + (d.xi[tid].length === d.ppt ? 'k' : 'red') + '">' + d.xi[tid].length + '/' + d.ppt + ' XI</span></div><div class="list">' +
          t.players.map(p => '<div class="item"><div class="grow"><b>' + esc(p.name) + '</b> <span class="mut">' + esc(p.role || '') + '</span></div>' +
            '<button class="chip ' + (d.xi[tid].includes(p.id) ? 'on' : '') + '" style="margin:0" data-a="xi" data-t="' + tid + '" data-p="' + p.id + '">XI</button>' +
            '<button class="chip ' + (d.sub[tid].includes(p.id) ? 'on' : '') + '" style="margin:0" data-a="subst" data-t="' + tid + '" data-p="' + p.id + '">Sub</button></div>').join('') + '</div>' +
          '<div class="row"><div><label>Captain</label><select data-b="draft.cap.' + tid + '">' + d.xi[tid].map(id => '<option value="' + id + '"' + (d.cap[tid] === id ? ' selected' : '') + '>' + esc(A.nameOf(id)) + '</option>').join('') + '</select></div>' +
          '<div><label>Wicketkeeper</label><select data-b="draft.wk.' + tid + '"><option value="">-</option>' + d.xi[tid].map(id => '<option value="' + id + '"' + (d.wk[tid] === id ? ' selected' : '') + '>' + esc(A.nameOf(id)) + '</option>').join('') + '</select></div></div>' +
          '<div class="row"><input id="qp_' + tid + '" placeholder="Quick add player"><button class="btn sm" style="flex:none" data-a="quickAdd" data-t="' + tid + '">Add</button></div></div>';
      });
    } else if (d.step === 4) {
      h += '<p class="mut">Local rules for this match (defaults come from Settings → Rules). Adjust anything for today\'s turf.</p>' + A.rulesForm('draft.rules', d.rules, true);
    } else if (d.step === 5) {
      const ta = A.db.teams.find(t => t.id === d.a), tb = A.db.teams.find(t => t.id === d.b), tt = d.toss;
      h += '<label>Team calling</label><div><button class="chip ' + (tt.caller === 0 ? 'on' : '') + '" data-a="toss" data-f="caller" data-v="0">' + esc(ta.name) + '</button><button class="chip ' + (tt.caller === 1 ? 'on' : '') + '" data-a="toss" data-f="caller" data-v="1">' + esc(tb.name) + '</button></div>' +
        '<label>Call</label><div><button class="chip ' + (tt.call === 'H' ? 'on' : '') + '" data-a="toss" data-f="call" data-v="H">Heads</button><button class="chip ' + (tt.call === 'T' ? 'on' : '') + '" data-a="toss" data-f="call" data-v="T">Tails</button></div>' +
        '<div class="coin ' + (tt.flipping ? 'flip' : '') + '">' + (tt.result || '?') + '</div><button class="btn k" data-a="flip"' + (tt.caller == null || !tt.call ? ' disabled' : '') + '>Flip coin</button>';
      if (tt.winner != null) {
        const w = [ta, tb][tt.winner];
        h += '<div class="hero c" style="margin-top:12px"><b>' + esc(w.name) + ' won the toss</b></div><label>Elected to</label><div><button class="chip ' + (tt.choice === 'bat' ? 'on' : '') + '" data-a="toss" data-f="choice" data-v="bat">Bat</button><button class="chip ' + (tt.choice === 'bowl' ? 'on' : '') + '" data-a="toss" data-f="choice" data-v="bowl">Bowl</button></div>';
      }
      h += '<div class="mut" style="margin:8px 0">Toss decided by hand? <button class="chip" data-a="tossManual" data-v="0">' + esc(ta.name) + ' won</button><button class="chip" data-a="tossManual" data-v="1">' + esc(tb.name) + ' won</button></div>';
    }
    h += '<div class="row" style="margin-top:14px">' + (d.step > 1 ? '<button class="btn ghost" data-a="wizPrev">Back</button>' : '') + (d.step < 5 ? '<button class="btn" data-a="wizNext">Next</button>' : '<button class="btn" data-a="startMatch"' + (d.toss.winner == null || !d.toss.choice ? ' disabled' : '') + '>Start match</button>') + '</div>';
    return A.page('New match', h, null, { keepScroll: true });
  };
  A.actions.overs = el => { ui.draft.overs = +el.dataset.v; A.render(); };
  A.actions.wizPrev = () => { ui.draft.step--; A.render(); window.scrollTo(0, 0); };
  A.actions.wizNext = () => {
    const d = ui.draft;
    if (d.step === 1) { if (!d.name.trim()) d.name = 'Match ' + (A.db.matches.length + 1); if (d.overs < 1) return A.toast('Set overs'); if (d.ppt < 2) return A.toast('At least 2 players'); }
    if (d.step === 2 && (!d.a || !d.b || d.a === d.b)) return A.toast('Pick two different teams');
    if (d.step === 3) { for (const t of [d.a, d.b]) if (d.xi[t].length < 2) return A.toast('Each team needs at least 2 players in the XI'); }
    d.step++; A.render(); window.scrollTo(0, 0);
  };
  A.actions.xi = el => {
    const d = ui.draft, t = el.dataset.t, p = el.dataset.p, xi = d.xi[t];
    const i = xi.indexOf(p); if (i >= 0) xi.splice(i, 1); else { if (xi.length >= d.ppt) return A.toast('XI is full (' + d.ppt + ')'); xi.push(p); d.sub[t] = d.sub[t].filter(x => x !== p); }
    if (!xi.includes(d.cap[t])) d.cap[t] = xi[0] || ''; if (!xi.includes(d.wk[t])) d.wk[t] = '';
    A.render();
  };
  A.actions.subst = el => {
    const d = ui.draft, t = el.dataset.t, p = el.dataset.p, s = d.sub[t], i = s.indexOf(p);
    if (i >= 0) s.splice(i, 1); else { s.push(p); d.xi[t] = d.xi[t].filter(x => x !== p); if (!d.xi[t].includes(d.cap[t])) d.cap[t] = d.xi[t][0] || ''; }
    A.render();
  };
  A.actions.quickAdd = el => {
    const t = A.db.teams.find(t => t.id === el.dataset.t), inp = document.getElementById('qp_' + t.id), n = inp.value.trim(); if (!n) return;
    const p = { id: CE.uid(), name: n, role: 'All-rounder', bat: 'Right', bowl: 'Right-arm medium' }; t.players.push(p);
    const d = ui.draft; if (d.xi[t.id].length < d.ppt) d.xi[t.id].push(p.id); A.save(); A.render();
  };
  A.actions.toss = el => { const f = el.dataset.f, v = el.dataset.v; ui.draft.toss[f] = f === 'caller' ? +v : v; A.render(); };
  A.actions.flip = () => {
    const t = ui.draft.toss; t.flipping = true; t.result = Math.random() < .5 ? 'H' : 'T';
    t.winner = t.call === t.result ? t.caller : 1 - t.caller; t.choice = null; A.render();
    setTimeout(() => { t.flipping = false; A.render(); }, 1000);
  };
  A.actions.tossManual = el => { const t = ui.draft.toss; t.winner = +el.dataset.v; t.result = '✓'; t.choice = null; A.render(); };
  A.actions.startMatch = () => {
    const d = ui.draft, dic = A.db.dics.find(x => x.id === d.dicId) || A.db.dics[0];
    const mk = tid => { const t = A.db.teams.find(t => t.id === tid); return { id: t.id, name: t.name, color: t.color, players: t.players.map(p => ({ id: p.id, name: p.name })), xi: d.xi[tid].slice(), subs: d.sub[tid].slice(), captain: d.cap[tid], wk: d.wk[tid] }; };
    const m = CE.createMatch({ name: d.name, date: d.date, venue: d.venue, turf: d.turf || dic.turf, overs: d.overs, teams: [mk(d.a), mk(d.b)], dic, rules: d.rules, tournamentId: d.tournamentId, fixtureId: d.fixtureId });
    ['z1', 'z2'].forEach(k => { const b = d.back && d.back[k]; if (!b) return; m.dic.zones.filter(x => k === 'z1' ? (x.ring === 0 && x.id !== 'z2') : x.id === 'z2').forEach(z => { z.off = !b.on; z.runs = b.runs; z.rotate = b.change ? 'change' : 'keep'; }); });
    m.toss = { winner: d.toss.winner, call: d.toss.call, result: d.toss.result, choice: d.toss.choice, caller: d.toss.caller };
    m.battingFirst = d.toss.choice === 'bat' ? d.toss.winner : 1 - d.toss.winner; m.status = 'live';
    CE.newInnings(m, m.battingFirst); // first innings starts straight after the toss
    A.db.matches.unshift(m); A.db.activeMatch = m.id;
    if (d.tournamentId) { const t = A.db.tournaments.find(t => t.id === d.tournamentId); const f = t && t.fixtures.find(f => f.id === d.fixtureId); if (f) f.matchId = m.id; }
    ui.draft = null; A.save(); ui.stack = []; A.go('live', { id: m.id }, true);
  };

  /* ---------- teams ---------- */
  A.views.teams = function () {
    let h = '<div class="card"><label>New team</label><input data-b="ui.nt" value="' + esc(ui.nt || '') + '" placeholder="Team name"><div>' + COLORS.map(c => '<button class="chip ' + (ui.ntc === c ? 'on' : '') + '" style="background:' + c + ';min-width:38px;height:30px" data-a="teamColor" data-v="' + c + '"></button>').join('') + '</div><button class="btn" data-a="addTeam">Add team</button></div>';
    h += A.db.teams.length ? A.db.teams.map(t => '<div class="card" data-a="openTeam" data-id="' + t.id + '"><div class="row"><span class="av" style="flex:none;background:' + esc(t.color) + '">' + esc(A.initials(t.name)) + '</span><div><b>' + esc(t.name) + '</b><div class="mut">' + t.players.length + ' players</div></div></div></div>').join('') : '<div class="empty">No teams yet<br><br><button class="btn sm" data-a="demo">Add demo teams</button></div>';
    return A.page('Teams', h, 'teams', { noBack: true, keepScroll: true });
  };
  A.actions.teamColor = el => { ui.ntc = el.dataset.v; A.render(); };
  A.actions.addTeam = () => {
    const n = (ui.nt || '').trim(); if (!n) return A.toast('Enter a team name');
    A.db.teams.push({ id: CE.uid(), name: n, color: ui.ntc || '#FFD400', players: [] }); ui.nt = ''; A.save(); A.render();
  };
  A.actions.openTeam = el => A.go('team', { id: el.dataset.id });
  A.views.team = function () {
    const t = A.db.teams.find(t => t.id === ui.params.id); if (!t) return A.page('Team', '<div class="empty">Not found</div>');
    const np = ui.np || (ui.np = { name: '', role: 'Batsman', bat: 'Right', bowl: 'None', photo: '' });
    const sel = (k, opts) => '<select data-b="ui.np.' + k + '">' + opts.map(o => '<option' + (np[k] === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>';
    let h = '<div class="card row"><span class="av" style="flex:none;background:' + esc(t.color) + '">' + esc(A.initials(t.name)) + '</span><div><label>Team name</label><input data-b="db.teams.' + A.db.teams.indexOf(t) + '.name" value="' + esc(t.name) + '"></div></div>' +
      '<div>' + COLORS.map(c => '<button class="chip ' + (t.color === c ? 'on' : '') + '" style="background:' + c + ';min-width:38px;height:30px" data-a="tColor" data-id="' + t.id + '" data-v="' + c + '"></button>').join('') + '</div>' +
      '<h2>Players (' + t.players.length + ')</h2><div class="card list">' + (t.players.map(p => '<div class="item" data-a="openPlayer" data-t="' + t.id + '" data-p="' + p.id + '"><span class="avatar">' + (p.photo ? '<img src="' + p.photo + '">' : esc(A.initials(p.name))) + '</span><div class="grow"><b>' + esc(p.name) + '</b><div class="mut">' + esc(p.role || '') + ' · ' + esc(p.bat || '') + '-hand bat · ' + esc(p.bowl || '') + '</div></div></div>').join('') || '<div class="empty">No players yet</div>') + '</div>' +
      '<div class="card"><b>Add player</b><label>Name</label><input data-b="ui.np.name" value="' + esc(np.name) + '"><div class="grid3"><div><label>Role</label>' + sel('role', ['Batsman', 'Bowler', 'All-rounder', 'Wicketkeeper']) + '</div><div><label>Batting</label>' + sel('bat', ['Right', 'Left']) + '</div><div><label>Bowling</label>' + sel('bowl', ['None', 'Right-arm fast', 'Right-arm medium', 'Right-arm spin', 'Left-arm fast', 'Left-arm medium', 'Left-arm spin']) + '</div></div>' +
      '<label>Photo (optional)</label><input type="file" accept="image/*" data-photo="np">' + (np.photo ? '<span class="avatar"><img src="' + np.photo + '"></span>' : '') + '<button class="btn" data-a="addPlayer" data-id="' + t.id + '">Add player</button></div>' +
      '<button class="btn danger" data-a="delTeam" data-id="' + t.id + '">Delete team</button>';
    return A.page(t.name, h, null, { keepScroll: true });
  };
  A.actions.tColor = el => { A.db.teams.find(t => t.id === el.dataset.id).color = el.dataset.v; A.save(); A.render(); };
  A.actions.addPlayer = el => {
    const t = A.db.teams.find(t => t.id === el.dataset.id), np = ui.np; if (!np.name.trim()) return A.toast('Enter player name');
    t.players.push({ id: CE.uid(), name: np.name.trim(), role: np.role, bat: np.bat, bowl: np.bowl, photo: np.photo }); ui.np = null; A.save(); A.render();
  };
  A.actions.delTeam = el => { if (!confirm('Delete this team? Past matches keep their own copy.')) return; A.db.teams = A.db.teams.filter(t => t.id !== el.dataset.id); A.save(); A.back(); };
  A.actions.openPlayer = el => A.go('player', { t: el.dataset.t, p: el.dataset.p });
  document.addEventListener('change', e => {
    const el = e.target; if (!el.matches || !el.matches('[data-photo]')) return;
    const f = el.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 120; const x = c.getContext('2d'), s = Math.min(img.width, img.height);
        x.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 120, 120);
        const url = c.toDataURL('image/jpeg', .7);
        if (el.dataset.photo === 'np') ui.np.photo = url; else { const t = A.db.teams.find(t => t.id === ui.params.t), p = t.players.find(p => p.id === ui.params.p); p.photo = url; A.save(); }
        A.render();
      };
      img.src = r.result;
    };
    r.readAsDataURL(f);
  });
  A.views.player = function () {
    const t = A.db.teams.find(t => t.id === ui.params.t), p = t && t.players.find(p => p.id === ui.params.p);
    if (!p) return A.page('Player', '<div class="empty">Not found</div>');
    const S = CE.playerStats(A.db.matches)[p.id] || { matches: 0, inns: 0, runs: 0, balls: 0, fours: 0, sixes: 0, hs: 0, wkts: 0, avg: 0, sr: 0, econ: 0, bowled: 0, conceded: 0 };
    const idx = A.db.teams.indexOf(t), pi = t.players.indexOf(p);
    const k = (v, l) => '<div class="kpi"><b>' + v + '</b><span>' + l + '</span></div>';
    const h = '<div class="hero c"><span class="avatar" style="width:84px;height:84px;margin:0 auto 8px;font-size:28px">' + (p.photo ? '<img src="' + p.photo + '">' : esc(A.initials(p.name))) + '</span><h2 style="margin:0">' + esc(p.name) + '</h2><div>' + esc(t.name) + ' · ' + esc(p.role || '') + '</div><div>' + esc(p.bat || '') + '-hand bat · ' + esc(p.bowl || '') + '</div></div>' +
      '<div class="grid3">' + k(S.matches, 'Matches') + k(S.runs, 'Runs') + k(S.wkts, 'Wickets') + k(A.fmt1(S.avg), 'Bat avg') + k(A.fmt1(S.sr), 'Strike rate') + k(S.hs, 'High score') + k(S.fours + '/' + S.sixes, '4s / 6s') + k(S.bowled ? A.fmt2(S.econ) : '-', 'Economy') + k(S.conceded, 'Runs given') + '</div>' +
      '<div class="card" style="margin-top:12px"><label>Name</label><input data-b="db.teams.' + idx + '.players.' + pi + '.name" value="' + esc(p.name) + '"><label>Change photo</label><input type="file" accept="image/*" data-photo="p"></div>' +
      '<button class="btn danger" data-a="delPlayer">Remove player</button>';
    return A.page(p.name, h, null, { keepScroll: true });
  };
  A.actions.delPlayer = () => { const t = A.db.teams.find(t => t.id === ui.params.t); t.players = t.players.filter(p => p.id !== ui.params.p); A.save(); A.back(); };
})();
