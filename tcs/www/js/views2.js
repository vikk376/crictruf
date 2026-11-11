/* Scorecard, summary, live board, analytics, stats, history, tournaments */
(function () {
  'use strict';
  const A = window.A, CE = A.CE, esc = A.esc, ui = A.ui;
  const pn = (m, id) => CE.playerName(m, id);
  const kpi = (v, l) => '<div class="kpi"><b>' + v + '</b><span>' + l + '</span></div>';
  const mOf = () => A.matchById(ui.params.id) || A.getMatch();

  A.copy = function (text) {
    if (navigator.share) { navigator.share({ text }).catch(() => { }); return; }
    try { navigator.clipboard.writeText(text).then(() => A.toast('Copied')); } catch (e) {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); A.toast('Copied'); } catch (x) { } t.remove();
    }
  };

  /* ---------- scorecard ---------- */
  A.views.scorecard = function () {
    const m = mOf(); if (!m) return A.page('Scorecard', '<div class="empty">No match</div>');
    if (!m.innings.length) return A.page('Scorecard', '<div class="empty">Scoring has not started</div>');
    const i = Math.min(ui.sc != null ? ui.sc : m.innings.length - 1, m.innings.length - 1), inn = m.innings[i], st = CE.replay(m, inn), R = CE.rulesOf(m);
    let h = '<div class="seg">' + m.innings.map((x, k) => '<button class="' + (k === i ? 'on' : '') + '" data-a="scTab" data-v="' + k + '">' + esc(m.teams[x.batting].name) + (x.type === 'super' ? ' SO' : '') + '</button>').join('') + '</div>';
    h += '<div class="card k"><div class="row sp"><b>' + esc(m.teams[inn.batting].name) + '</b><span style="font-size:26px;font-weight:900">' + st.runs + '/' + st.wkts + ' <small>(' + st.oversText + ')</small></span></div><div class="mut">RR ' + A.fmt2(st.crr) + (inn.target ? ' · Target ' + inn.target : '') + '</div></div>';
    h += '<div class="card"><h3 style="margin-top:0">Batting</h3><table><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>' +
      st.order.map(id => { const b = st.batters[id]; return '<tr><td><b>' + esc(pn(m, id)) + '</b><div class="mut">' + esc(CE.dismissalText(m, st, b)) + '</div></td><td><b>' + b.runs + '</b></td><td>' + b.balls + '</td><td>' + b.fours + '</td><td>' + b.sixes + '</td><td>' + (b.balls ? A.fmt1(b.runs / b.balls * 100) : '-') + '</td></tr>'; }).join('') + '</table>' +
      '<div class="mut" style="margin-top:6px">Yet to bat: ' + (st.availBatters.map(id => esc(pn(m, id))).join(', ') || '-') + '</div>' +
      '<div class="row sp" style="margin-top:8px"><span>Extras</span><b>' + st.extrasTotal + ' <span class="mut">(wd ' + st.extras.wd + ', nb ' + st.extras.nb + ', b ' + st.extras.b + ', lb ' + st.extras.lb + ')</span></b></div></div>';
    h += '<div class="card"><h3 style="margin-top:0">Bowling</h3><table><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Eco</th></tr>' +
      st.bowlerOrder.map(id => { const b = st.bowlers[id]; return '<tr><td><b>' + esc(pn(m, id)) + '</b></td><td>' + CE.oversStr(b.balls, R.ballsPerOver) + '</td><td>' + b.maidens + '</td><td>' + b.runs + '</td><td><b>' + b.wkts + '</b></td><td>' + (b.balls ? A.fmt2(b.runs / (b.balls / R.ballsPerOver)) : '-') + '</td></tr>'; }).join('') + '</table></div>';
    h += '<div class="card"><h3 style="margin-top:0">Fall of wickets</h3>' + (st.fow.length ? st.fow.map(f => '<div class="row sp"><span>' + f.n + '-' + f.runs + ' <b>' + esc(pn(m, f.batter)) + '</b></span><span class="mut">' + f.over + ' ov · p\'ship ' + f.partnership + '</span></div>').join('') : '<span class="mut">No wickets</span>') +
      '<div class="row sp" style="margin-top:6px"><span>Current partnership</span><b>' + st.part.runs + ' (' + st.part.balls + ')</b></div></div>';
    h += '<h3>Ball by ball</h3><div class="card">' + (function () { const g = {}; st.timeline.forEach(t => (g[t.over] = g[t.over] || []).push(t)); return Object.keys(g).map(o => '<div class="row" style="align-items:flex-start"><b style="flex:none;width:38px">' + (+o + 1) + '</b><div class="balls" style="margin:0">' + g[o].map(A.ballChip).join('') + '</div></div>').join('') || '<span class="mut">-</span>'; })() + '</div>';
    return A.page('Scorecard', h, null, { keepScroll: true });
  };
  A.actions.scTab = el => { ui.sc = +el.dataset.v; A.render(); };

  /* ---------- summary ---------- */
  function summaryText(m) {
    const ev = CE.evaluate(m);
    return m.name + ' (' + m.date + ')\n' + m.innings.map(inn => { const s = CE.replay(m, inn); return m.teams[inn.batting].name + ': ' + s.runs + '/' + s.wkts + ' (' + s.oversText + ')'; }).join('\n') + '\n' + (ev.text || 'In progress') + '\nScored with CricTruf';
  }
  A.views.summary = function () {
    const m = mOf(); if (!m) return A.page('Summary', '<div class="empty">No match</div>');
    const ev = CE.evaluate(m);
    let bestBat = null, bestBowl = null;
    m.innings.forEach(inn => { const s = CE.replay(m, inn); s.order.forEach(id => { const b = s.batters[id]; if (!bestBat || b.runs > bestBat.runs) bestBat = { id, runs: b.runs, balls: b.balls }; }); s.bowlerOrder.forEach(id => { const b = s.bowlers[id]; if (!bestBowl || b.wkts > bestBowl.wkts || (b.wkts === bestBowl.wkts && b.runs < bestBowl.runs)) bestBowl = { id, wkts: b.wkts, runs: b.runs }; }); });
    let h = '<div class="hero c"><div class="tag k">' + (m.status === 'completed' ? 'Result' : 'In progress') + '</div><h2 style="margin:8px 0">' + esc(ev.text || 'Match in progress') + '</h2><div>' + esc(m.venue || '') + (m.turf ? ' · ' + esc(m.turf) : '') + ' · ' + esc(m.date) + '</div></div>' + A.scoreLines(m);
    if (bestBat) h += '<div class="grid2"><div class="kpi"><b>' + bestBat.runs + '(' + bestBat.balls + ')</b><span>Top scorer: ' + esc(pn(m, bestBat.id)) + '</span></div><div class="kpi"><b>' + bestBowl.wkts + '/' + bestBowl.runs + '</b><span>Best bowler: ' + esc(pn(m, bestBowl.id)) + '</span></div></div>';
    h += '<div class="grid2" style="margin-top:12px"><button class="btn" data-a="open" data-v="scorecard" data-id="' + m.id + '">Scorecard</button><button class="btn k" data-a="open" data-v="analytics" data-id="' + m.id + '">Analytics</button></div><div style="height:8px"></div>' +
      '<button class="btn ghost" data-a="share" data-id="' + m.id + '">Share result</button>';
    if (m.status !== 'completed') h += '<div style="height:8px"></div><button class="btn" data-a="openMatch2" data-id="' + m.id + '">Resume scoring</button>';
    else if (A.canScore()) h += '<div style="height:8px"></div><button class="btn ghost" data-a="undoLast" data-id="' + m.id + '">Undo last ball (reopen)</button>';
    return A.page('Match summary', h, null);
  };
  A.actions.share = el => A.copy(summaryText(A.matchById(el.dataset.id)));
  A.actions.openMatch2 = el => { A.db.activeMatch = el.dataset.id; A.save(); A.go('live', {}); };
  A.actions.undoLast = el => {
    const m = A.matchById(el.dataset.id), inn = m.innings[m.innings.length - 1]; if (!inn) return;
    CE.undo(m, inn); m.status = 'live'; A.db.activeMatch = m.id; A.save(); A.go('live', {}, true);
  };

  /* ---------- live board ---------- */
  A.views.board = function () {
    const m = mOf(); if (!m) return { html: '<div class="boardwrap"><button data-a="back">‹ Back</button><p>No match</p></div>' };
    const ev = CE.evaluate(m);
    const idx = ev.current >= 0 ? ev.current : m.innings.length - 1, inn = m.innings[idx];
    if (!inn) return { html: '<div class="boardwrap"><button data-a="back">‹ Back</button><div class="sc">Match not started</div></div>' };
    const st = CE.replay(m, inn), bpo = st.bpo, bt = m.teams[inn.batting], bw = m.teams[inn.bowling];
    const cur = Math.floor(st.legal / bpo);
    const lastOver = st.timeline.filter(t => t.over === (st.legal % bpo === 0 ? cur - 1 : cur - 1));
    const b1 = st.batters[st.striker], b2 = st.batters[st.nonStriker], bo = st.bowlers[st.bowler] || st.bowlers[st.lastBowler];
    const row = (b, id, s) => '<div class="row sp"><span>' + (s ? '▶ ' : '') + esc(id != null ? pn(m, id) : '-') + '</span><b style="color:var(--y)">' + (b ? b.runs + ' (' + b.balls + ')' : '') + '</b></div>';
    const status = ev.text || (st.target ? esc(bt.name) + ' need ' + st.runsNeeded + ' from ' + st.ballsLeft + ' balls' : esc(bt.name) + ' batting');
    return {
      html: '<div class="boardwrap"><div class="row sp" style="margin-bottom:10px"><button data-a="back" style="background:transparent;color:#fff;border-color:#fff">‹</button><span class="tag">' + (m.status === 'completed' ? 'FINAL' : 'LIVE') + '</span><button data-a="theme" style="background:transparent;color:#fff;border-color:#fff">☾</button></div>' +
        '<div class="teams"><div class="c">' + A.teamLogo(bt, 'av') + '<div class="b">' + esc(bt.name) + '</div></div><div class="mut b">VS</div><div class="c">' + A.teamLogo(bw, 'av') + '<div class="b">' + esc(bw.name) + '</div></div></div>' +
        '<div class="sc">' + st.runs + '/' + st.wkts + '</div><div class="c" style="font-size:20px">Overs ' + st.oversText + ' / ' + inn.overs + (st.freeHit ? ' <span class="fh">FREE HIT</span>' : '') + '</div>' +
        '<div class="grid2" style="margin:14px 0"><div class="kpi" style="background:#111;color:#fff"><b style="color:var(--y)">' + A.fmt2(st.crr) + '</b><span>Run rate</span></div><div class="kpi" style="background:#111;color:#fff"><b style="color:var(--y)">' + (st.target ? (st.rrr == null ? '-' : A.fmt2(st.rrr)) : st.part.runs) + '</b><span>' + (st.target ? 'Required RR' : 'Partnership') + '</span></div></div>' +
        (st.target ? '<div class="c" style="margin-bottom:8px">Target <b style="color:var(--y)">' + st.target + '</b></div>' : '') +
        '<div class="card k">' + row(b1, st.striker, true) + row(b2, st.nonStriker, false) + '<hr style="border-color:#333"><div class="row sp"><span>⚾ ' + esc(bo ? pn(m, bo.id) : '-') + '</span><b>' + (bo ? CE.oversStr(bo.balls, bpo) + '-' + bo.maidens + '-' + bo.runs + '-' + bo.wkts : '') + '</b></div></div>' +
        '<div class="mut">Last 6 balls</div><div class="balls">' + st.timeline.slice(-6).map(A.ballChip).join('') + '</div>' +
        (lastOver.length ? '<div class="mut">Last over: ' + lastOver.reduce((a, b) => a + b.runs, 0) + ' runs</div>' : '') +
        '<div class="hero c" style="margin-top:12px"><b>' + esc(status) + '</b></div><div class="c mut" style="margin-top:8px">P\'ship ' + st.part.runs + ' (' + st.part.balls + ') · Extras ' + st.extrasTotal + '</div></div>'
    };
  };

  /* ---------- analytics ---------- */
  function heatFrom(zonesAgg, key) {
    const mx = Math.max(1, ...Object.values(zonesAgg).map(z => z[key])); const heat = {}, txt = {};
    Object.values(zonesAgg).forEach(z => { heat[z.id] = z[key] / mx; txt[z.id] = z[key]; }); return { heat, txt };
  }
  A.views.analytics = function () {
    const m = mOf(); if (!m) return A.page('Analytics', '<div class="empty">No match</div>');
    const a = CE.analytics(m), R = CE.rulesOf(m);
    if (!a.balls) return A.page('Analytics', '<div class="empty">No deliveries yet</div>');
    const { heat, txt } = heatFrom(a.zones, 'runs');
    const zl = Object.values(a.zones).sort((x, y) => y.count - x.count), sh = Object.values(a.shots).sort((x, y) => y.count - x.count);
    let h = '<div class="grid3">' + kpi(a.runs, 'Total runs') + kpi(A.fmt1(a.dotPct) + '%', 'Dot balls') + kpi(A.fmt1(a.boundPct) + '%', 'Boundaries') + '</div>';
    h += '<h2>Zone-wise runs</h2><div class="card">' + (zl.length ? A.groundSVG(m.dic.zones, { heat, heatText: txt, act: 'noop' }) + '<div class="mut c">Deeper yellow/orange = more runs from that zone</div>' : '<div class="empty">No DIC zone shots recorded yet</div>') + '</div>';
    if (zl.length) {
      h += '<div class="card"><h3 style="margin-top:0">Most targeted shots / zones</h3><table><tr><th>Shot / zone</th><th>Balls</th><th>Runs</th></tr>' + sh.slice(0, 11).map(z => '<tr><td>' + esc(z.label) + '</td><td>' + z.count + '</td><td><b>' + z.runs + '</b></td></tr>').join('') + '</table></div>';
      const tot = a.byRing.reduce((s, r) => s + r.runs, 0) || 1;
      h += '<div class="card"><h3 style="margin-top:0">Runs by area</h3>' + a.byRing.map((r, i) => !r.balls ? '' : '<div class="row sp" style="margin:4px 0"><span style="flex:none;width:110px;font-size:12px">' + CE.RINGS[i] + '</span><div style="flex:1"><div class="bar" style="width:' + Math.max(2, r.runs / tot * 100) + '%"></div></div><b style="flex:none;width:40px;text-align:right">' + r.runs + '</b></div>').join('') + '</div>';
    }
    a.overs.forEach(o => {
      const mx = Math.max(1, ...o.overs);
      h += '<div class="card"><h3 style="margin-top:0">' + esc(o.team) + ': over by over</h3><div class="bars">' + o.overs.map((r, i) => '<div><span>' + r + '</span><div class="col ' + (o.wkts[i] ? 'wk' : '') + '" style="height:' + (r / mx * 90) + '%"></div><span class="mut">' + (i + 1) + '</span></div>').join('') + '</div><div class="mut">Red bars = over with a wicket</div></div>';
    });
    // player performance
    h += '<div class="card"><h3 style="margin-top:0">Batting performance</h3><table><tr><th>Batter</th><th>R</th><th>B</th><th>SR</th><th>4s/6s</th></tr>';
    m.innings.forEach(inn => { const s = CE.replay(m, inn); s.order.forEach(id => { const b = s.batters[id]; h += '<tr><td>' + esc(pn(m, id)) + '</td><td><b>' + b.runs + '</b></td><td>' + b.balls + '</td><td>' + (b.balls ? A.fmt1(b.runs / b.balls * 100) : '-') + '</td><td>' + b.fours + '/' + b.sixes + '</td></tr>'; }); });
    h += '</table></div><div class="card"><h3 style="margin-top:0">Bowling performance</h3><table><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Eco</th></tr>';
    m.innings.forEach(inn => { const s = CE.replay(m, inn); s.bowlerOrder.forEach(id => { const b = s.bowlers[id]; h += '<tr><td>' + esc(pn(m, id)) + '</td><td>' + CE.oversStr(b.balls, R.ballsPerOver) + '</td><td>' + b.runs + '</td><td><b>' + b.wkts + '</b></td><td>' + (b.balls ? A.fmt2(b.runs / (b.balls / R.ballsPerOver)) : '-') + '</td></tr>'; }); });
    h += '</table></div>';
    // partnerships + winning analysis
    const parts = []; m.innings.forEach((inn, k) => { const s = CE.replay(m, inn); s.fow.forEach(f => parts.push({ t: m.teams[inn.batting].name, runs: f.partnership, n: f.n })); parts.push({ t: m.teams[inn.batting].name, runs: s.part.runs, n: 'unbroken' }); });
    parts.sort((x, y) => y.runs - x.runs);
    let bestOver = null; a.overs.forEach(o => o.overs.forEach((r, i) => { if (!bestOver || r > bestOver.r) bestOver = { r, i, t: o.team }; }));
    h += '<div class="card"><h3 style="margin-top:0">Partnerships &amp; match analysis</h3>' + parts.slice(0, 4).map(p => '<div class="row sp"><span>' + esc(p.t) + ' · wkt ' + p.n + '</span><b>' + p.runs + '</b></div>').join('') +
      (bestOver ? '<p>Most productive over: <b>' + esc(bestOver.t) + ' over ' + (bestOver.i + 1) + ' (' + bestOver.r + ' runs)</b>.</p>' : '') + '</div>';
    return A.page('Analytics', h, null);
  };
  A.actions.noop = () => { };

  /* ---------- stats (global) ---------- */
  A.views.stats = function () {
    const S = Object.values(CE.playerStats(A.db.matches));
    const top = (arr, f, fmt) => arr.length ? '<table>' + arr.slice(0, 5).map((p, i) => '<tr><td>' + (i + 1) + '. <b>' + esc(A.nameOf(p.id)) + '</b></td><td><b>' + fmt(p) + '</b></td></tr>').join('') + '</table>' : '<span class="mut">No data</span>';
    let h = '<div class="grid3">' + kpi(A.db.matches.length, 'Matches') + kpi(A.db.matches.filter(m => m.status === 'completed').length, 'Completed') + kpi(S.length, 'Players') + '</div>';
    h += '<div class="card"><h3 style="margin-top:0">Top run scorers</h3>' + top(S.filter(p => p.runs).sort((a, b) => b.runs - a.runs), 0, p => p.runs + ' runs') + '</div>';
    h += '<div class="card"><h3 style="margin-top:0">Top wicket takers</h3>' + top(S.filter(p => p.wkts).sort((a, b) => b.wkts - a.wkts), 0, p => p.wkts + ' wkts') + '</div>';
    h += '<div class="card"><h3 style="margin-top:0">Best strike rate (10+ balls)</h3>' + top(S.filter(p => p.balls >= 10).sort((a, b) => b.sr - a.sr), 0, p => A.fmt1(p.sr)) + '</div>';
    h += '<div class="card"><h3 style="margin-top:0">Best economy (2+ overs)</h3>' + top(S.filter(p => p.bowled >= 12).sort((a, b) => a.econ - b.econ), 0, p => A.fmt2(p.econ)) + '</div>';
    const agg = {}; A.db.matches.forEach(m => { const a = CE.analytics(m); Object.values(a.zones).forEach(z => { const g = agg[z.id] || (agg[z.id] = { id: z.id, runs: 0, count: 0 }); g.runs += z.runs; g.count += z.count; }); });
    if (Object.keys(agg).length) { const { heat, txt } = heatFrom(agg, 'runs'); h += '<div class="card"><h3 style="margin-top:0">All-matches zone heatmap</h3>' + A.groundSVG(A.db.dics[0].zones, { heat, heatText: txt, act: 'noop' }) + '</div>'; }
    return A.page('Stats & analytics', h, 'stats', { noBack: true });
  };

  /* ---------- history ---------- */
  A.views.history = function () {
    const q = (ui.q || '').toLowerCase();
    const list = A.db.matches.filter(m => !q || (m.name + m.teams[0].name + m.teams[1].name + m.venue).toLowerCase().includes(q));
    let h = '<input data-b="ui.q" data-r placeholder="Search matches" value="' + esc(ui.q || '') + '">' + (list.length ? list.map(A.matchItem).join('') : '<div class="empty">No matches</div>');
    return A.page('Match history', h, 'history', { noBack: true, keepScroll: true });
  };

  /* ---------- tournaments ---------- */
  const tm = (t, id) => (A.db.teams.find(x => x.id === id) || { name: '?' }).name;
  function pointsTable(t) {
    const rows = {}; t.teamIds.forEach(id => rows[id] = { id, p: 0, w: 0, l: 0, t: 0, pts: 0, rf: 0, bf: 0, ra: 0, ba: 0 });
    t.fixtures.filter(f => f.round === 'League' && f.matchId).forEach(f => {
      const m = A.matchById(f.matchId); if (!m || m.status !== 'completed') return;
      const ev = CE.evaluate(m); const A_ = rows[m.teams[0].id], B_ = rows[m.teams[1].id]; if (!A_ || !B_) return;
      A_.p++; B_.p++;
      if (ev.winner == null) { A_.t++; B_.t++; A_.pts++; B_.pts++; } else { const w = rows[m.teams[ev.winner].id], l = rows[m.teams[1 - ev.winner].id]; w.w++; w.pts += 2; l.l++; }
      m.innings.filter(i => i.type === 'normal').forEach(inn => {
        const s = CE.replay(m, inn), bat = rows[m.teams[inn.batting].id], bow = rows[m.teams[inn.bowling].id], balls = s.endReason === 'All out' ? inn.overs * s.bpo : s.legal;
        bat.rf += s.runs; bat.bf += balls; bow.ra += s.runs; bow.ba += balls;
      });
    });
    return Object.values(rows).map(r => { r.nrr = (r.bf ? r.rf / (r.bf / 6) : 0) - (r.ba ? r.ra / (r.ba / 6) : 0); return r; }).sort((a, b) => b.pts - a.pts || b.nrr - a.nrr);
  }
  const fxWinner = (f) => { if (f.bye) return f.a; const m = f.matchId && A.matchById(f.matchId); if (!m || m.status !== 'completed') return null; const ev = CE.evaluate(m); return ev.winner == null ? null : m.teams[ev.winner].id; };

  A.views.tournaments = function () {
    let h = (A.canConfig() ? '<button class="btn" data-a="newTour">+ New tournament</button><div style="height:10px"></div>' : '') +
      (A.db.tournaments.length ? A.db.tournaments.map(t => '<div class="card" data-a="openTour" data-id="' + t.id + '"><div class="row sp"><b>' + esc(t.name) + '</b><span class="tag">' + (t.format === 'league' ? 'League' : 'Knockout') + '</span></div><div class="mut">' + t.teamIds.length + ' teams · ' + t.overs + ' overs' + (t.champion ? ' · 🏆 ' + esc(tm(t, t.champion)) : '') + '</div></div>').join('') : '<div class="empty">No tournaments yet</div>');
    return A.page('Tournaments', h, null);
  };
  A.actions.newTour = () => { ui.tf = { name: '', format: 'league', teams: [], overs: 8, dicId: A.db.dics[0].id, rounds: 1 }; A.go('tourNew'); };
  A.actions.openTour = el => A.go('tournament', { id: el.dataset.id });
  A.views.tourNew = function () {
    const f = ui.tf || A.actions.newTour();
    let h = '<label>Tournament name</label><input data-b="ui.tf.name" value="' + esc(f.name) + '" placeholder="e.g. Weekend Turf Cup">' +
      '<label>Format</label><div><button class="chip ' + (f.format === 'league' ? 'on' : '') + '" data-a="tf" data-f="format" data-v="league">League + semis + final</button><button class="chip ' + (f.format === 'knockout' ? 'on' : '') + '" data-a="tf" data-f="format" data-v="knockout">Knockout</button></div>' +
      '<div class="grid2"><div><label>Overs</label><input type="number" data-n data-b="ui.tf.overs" value="' + f.overs + '"></div><div><label>League rounds</label><select data-b="ui.tf.rounds" data-n><option value="1"' + (f.rounds == 1 ? ' selected' : '') + '>Single</option><option value="2"' + (f.rounds == 2 ? ' selected' : '') + '>Double</option></select></div></div>' +
      '<label>Tournament DIC &amp; local rules</label><select data-b="ui.tf.dicId">' + A.db.dics.map(d => '<option value="' + d.id + '"' + (d.id === f.dicId ? ' selected' : '') + '>' + esc(d.name) + '</option>').join('') + '</select>' +
      '<label>Teams (' + f.teams.length + ')</label><div>' + (A.db.teams.map(t => '<button class="chip ' + (f.teams.includes(t.id) ? 'on' : '') + '" data-a="tfTeam" data-id="' + t.id + '">' + esc(t.name) + '</button>').join('') || '<span class="mut">Create teams first</span>') + '</div>' +
      '<button class="btn" data-a="tfCreate">Create &amp; generate fixtures</button>';
    return A.page('New tournament', h, null, { keepScroll: true });
  };
  A.actions.tf = el => { ui.tf[el.dataset.f] = el.dataset.v; A.render(); };
  A.actions.tfTeam = el => { const a = ui.tf.teams, i = a.indexOf(el.dataset.id); if (i >= 0) a.splice(i, 1); else a.push(el.dataset.id); A.render(); };
  A.actions.tfCreate = () => {
    const f = ui.tf; if (!f.name.trim()) return A.toast('Name the tournament'); if (f.teams.length < 2) return A.toast('Pick at least 2 teams');
    const t = { id: CE.uid(), name: f.name.trim(), format: f.format, teamIds: f.teams.slice(), overs: f.overs, dicId: f.dicId, fixtures: [], created: Date.now() };
    if (f.format === 'league') { for (let r = 0; r < f.rounds; r++) for (let i = 0; i < f.teams.length; i++) for (let j = i + 1; j < f.teams.length; j++) t.fixtures.push({ id: CE.uid(), a: r % 2 ? f.teams[j] : f.teams[i], b: r % 2 ? f.teams[i] : f.teams[j], round: 'League' }); }
    else genKnock(t, f.teams.slice().sort(() => Math.random() - .5), 'Round 1');
    A.db.tournaments.push(t); A.save(); ui.tf = null; ui.stack.pop(); A.go('tournament', { id: t.id }, true);
  };
  function genKnock(t, ids, label) {
    for (let i = 0; i < ids.length; i += 2) t.fixtures.push(ids[i + 1] ? { id: CE.uid(), a: ids[i], b: ids[i + 1], round: label } : { id: CE.uid(), a: ids[i], b: null, round: label, bye: true });
  }
  A.views.tournament = function () {
    const t = A.db.tournaments.find(t => t.id === ui.params.id); if (!t) return A.page('Tournament', '<div class="empty">Not found</div>');
    let h = '';
    if (t.champion) h += '<div class="hero c"><div class="tag k">Champions</div><h2 style="margin:6px 0">🏆 ' + esc(tm(t, t.champion)) + '</h2></div>';
    const rounds = []; t.fixtures.forEach(f => { if (!rounds.includes(f.round)) rounds.push(f.round); });
    rounds.forEach(r => {
      h += '<h2>' + esc(r) + '</h2>' + t.fixtures.filter(f => f.round === r).map(f => {
        const m = f.matchId && A.matchById(f.matchId), w = fxWinner(f);
        return '<div class="card"><div class="row sp"><b>' + esc(tm(t, f.a)) + ' vs ' + (f.b ? esc(tm(t, f.b)) : 'BYE') + '</b>' + (m ? '<span class="tag ' + (m.status === 'completed' ? 'k' : '') + '">' + (m.status === 'completed' ? 'Done' : 'Live') + '</span>' : '') + '</div>' +
          (m && m.status === 'completed' ? '<div class="mut">' + esc(CE.evaluate(m).text) + '</div>' : '') +
          (f.bye ? '<div class="mut">Advances automatically</div>' : m ? '<button class="btn sm" data-a="openMatch" data-id="' + m.id + '">' + (m.status === 'completed' ? 'View' : 'Resume') + '</button>' : (A.canScore() ? '<button class="btn sm" data-a="startFixture" data-t="' + t.id + '" data-f="' + f.id + '">Start match</button>' : '')) + '</div>';
      }).join('');
    });
    if (t.format === 'league') {
      const pt = pointsTable(t);
      h += '<h2>Points table</h2><div class="card"><table><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>T</th><th>Pts</th><th>NRR</th></tr>' + pt.map(r => '<tr><td><b>' + esc(tm(t, r.id)) + '</b></td><td>' + r.p + '</td><td>' + r.w + '</td><td>' + r.l + '</td><td>' + r.t + '</td><td><b>' + r.pts + '</b></td><td>' + (r.nrr >= 0 ? '+' : '') + A.fmt2(r.nrr) + '</td></tr>').join('') + '</table><div class="mut">Win 2 · Tie 1 · NRR on normal innings only</div></div>';
    }
    const ms = A.db.matches.filter(m => m.tournamentId === t.id), S = Object.values(CE.playerStats(ms));
    if (S.length) {
      const bat = S.slice().sort((a, b) => b.runs - a.runs)[0], bowl = S.slice().sort((a, b) => b.wkts - a.wkts || a.econ - b.econ)[0], pot = S.slice().sort((a, b) => (b.runs + 20 * b.wkts + 5 * b.sixes) - (a.runs + 20 * a.wkts + 5 * a.sixes))[0];
      h += '<h2>Leaderboard</h2><div class="grid2">' + kpi(esc(A.nameOf(bat.id)) + '<br>' + bat.runs, 'Top batsman') + kpi(esc(A.nameOf(bowl.id)) + '<br>' + bowl.wkts, 'Top bowler') + '</div><div class="card c" style="margin-top:8px"><span class="tag k">Player of the tournament</span><h3 style="margin:6px 0">' + esc(A.nameOf(pot.id)) + '</h3><div class="mut">Points: runs + 20 × wickets + 5 × sixes</div></div>';
    }
    const nx = nextStage(t); if (nx && A.canConfig()) h += '<button class="btn" data-a="genNext" data-id="' + t.id + '">' + esc(nx) + '</button>';
    return A.page(t.name, h, null);
  };
  function nextStage(t) {
    if (t.champion) return null;
    const last = t.fixtures[t.fixtures.length - 1]; if (!last) return null;
    const cur = t.fixtures.filter(f => f.round === last.round); if (!cur.every(f => fxWinner(f))) return null;
    if (t.format === 'league') { if (last.round === 'League') return t.teamIds.length >= 4 ? 'Create semi-finals' : 'Create final'; if (last.round === 'Semi-final') return 'Create final'; return 'Declare champion'; }
    return cur.length === 1 && last.round !== 'Round 0' ? 'Declare champion' : 'Create next round';
  }
  A.actions.genNext = el => {
    const t = A.db.tournaments.find(t => t.id === el.dataset.id), last = t.fixtures[t.fixtures.length - 1], cur = t.fixtures.filter(f => f.round === last.round);
    const w = cur.map(fxWinner);
    if (t.format === 'league') {
      if (last.round === 'League') { const pt = pointsTable(t).map(r => r.id); if (pt.length >= 4) { t.fixtures.push({ id: CE.uid(), a: pt[0], b: pt[3], round: 'Semi-final' }, { id: CE.uid(), a: pt[1], b: pt[2], round: 'Semi-final' }); } else t.fixtures.push({ id: CE.uid(), a: pt[0], b: pt[1], round: 'Final' }); }
      else if (last.round === 'Semi-final') t.fixtures.push({ id: CE.uid(), a: w[0], b: w[1], round: 'Final' });
      else t.champion = w[0];
    } else {
      if (cur.length === 1) t.champion = w[0]; else { const n = t.fixtures.filter(f => /^Round/.test(f.round)).map(f => f.round).filter((x, i, a) => a.indexOf(x) === i).length + 1; genKnock(t, w, w.length === 2 ? 'Final' : w.length === 4 ? 'Semi-final' : 'Round ' + n); }
    }
    A.save(); A.render();
  };
  A.actions.startFixture = el => {
    const t = A.db.tournaments.find(t => t.id === el.dataset.t), f = t.fixtures.find(f => f.id === el.dataset.f);
    if (!A.db.teams.find(x => x.id === f.a) || !A.db.teams.find(x => x.id === f.b)) return A.toast('A team was deleted');
    ui.draft = { step: 3, name: t.name + ': ' + tm(t, f.a) + ' vs ' + tm(t, f.b) + ' (' + f.round + ')', date: A.today(), venue: '', turf: '', overs: t.overs, ppt: Math.max(2, Math.min(8, A.db.teams.find(x => x.id === f.a).players.length, A.db.teams.find(x => x.id === f.b).players.length)), a: f.a, b: f.b, dicId: t.dicId, rules: CE.clone(A.db.rules), tournamentId: t.id, fixtureId: f.id, xi: {}, sub: {}, cap: {}, wk: {}, toss: {}, back: { z1: { on: true, runs: 1, change: false }, z2: { on: true, runs: 1, change: false } } };
    A.go('newmatch');
  };
})();
