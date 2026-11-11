/* Live scoring screen, DIC ground tap scoring, wicket / correction flows */
(function () {
  'use strict';
  const A = window.A, CE = A.CE, esc = A.esc, ui = A.ui;

  A.ctx = function () {
    const m = A.getMatch(); if (!m) return null;
    const ev = CE.evaluate(m);
    const inn = ev.current >= 0 ? m.innings[ev.current] : null;
    return { m, ev, inn, st: inn ? CE.replay(m, inn) : null };
  };
  const pname = (m, id) => id == null ? '-' : CE.playerName(m, id);
  const teamLogo = (t, cls) => '<span class="av ' + (cls || '') + '" style="background:' + esc(t.color || '#FFD400') + '">' + esc(A.initials(t.name)) + '</span>';
  A.teamLogo = teamLogo;

  function ballChip(b) {
    const c = b.wicket ? 'w' : b.six ? 's' : b.four ? 'f' : /^(Wd|Nb)/.test(b.label) ? 'x' : '';
    return '<span class="ball ' + c + '">' + esc(b.label) + '</span>';
  }
  A.ballChip = ballChip;

  A.views.live = function () {
    const c = A.ctx();
    if (!c) return A.page('Live scoring', '<div class="empty">No active match.<br><br><button class="btn" data-a="newMatch">Create a match</button></div>', 'home');
    const { m, ev, inn, st } = c, R = CE.rulesOf(m), bpo = R.ballsPerOver;

    if (ev.status === 'completed') {
      m.status = 'completed';
      return A.page(m.name, '<div class="hero c"><div class="tag k">Match complete</div><h2>' + esc(ev.text) + '</h2></div>' + scoreLines(m) +
        '<button class="btn" data-a="open" data-v="summary" data-id="' + m.id + '">Match summary</button><div style="height:8px"></div>' +
        '<button class="btn k" data-a="open" data-v="scorecard" data-id="' + m.id + '">Full scorecard</button>', 'home');
    }
    if (!inn) {
      const first = m.innings.length ? m.innings[m.innings.length - 1] : null;
      let body = '';
      if (m.innings.length) body += scoreLines(m);
      const label = ev.next === 'startSecond' ? 'Start 2nd innings' : ev.next === 'superOver' ? 'Start SUPER OVER' : 'Start 1st innings';
      if (ev.next === 'startSecond') { const f = CE.replay(m, m.innings[ev.pairFirst]); body += '<div class="hero c"><div class="tag k">Innings break</div><h2>' + esc(m.teams[ev.nextBat].name) + ' need ' + (f.runs + 1) + ' to win</h2><div>from ' + (m.innings[ev.pairFirst].overs) + ' overs</div></div>'; }
      else if (ev.next === 'superOver') body += '<div class="hero c"><div class="tag k">Scores level</div><h2>Super over!</h2><div>' + esc(m.teams[ev.nextBat].name) + ' bat first</div></div>';
      else body += '<div class="hero c"><h2>' + esc(m.teams[ev.nextBat].name) + ' to bat</h2></div>';
      body += '<button class="btn" data-a="startNext">' + label + '</button>' + (m.innings.length && A.canScore() ? '<div style="height:8px"></div><button class="btn ghost" data-a="undoPrev">Undo last ball</button>' : '');
      return A.page(m.name, body, 'home');
    }

    // forced prompts
    if (!ui.modal) {
      if (st.needOpeners) ui.modal = { type: 'openers' };
      else if (st.needBatter) ui.modal = { type: 'batter' };
      else if (st.needBowler) ui.modal = { type: 'bowler' };
    }
    const batT = m.teams[inn.batting], bowlT = m.teams[inn.bowling];
    const tl = st.timeline, curIdx = Math.floor(st.legal / bpo);
    let overBalls = tl.filter(t => t.over === curIdx), overLbl = 'This over';
    if (!overBalls.length && curIdx > 0) { overBalls = tl.filter(t => t.over === curIdx - 1); overLbl = 'Last over'; }
    const sBat = st.batters[st.striker], nBat = st.batters[st.nonStriker], bw = st.bowlers[st.bowler] || st.bowlers[st.lastBowler];
    const batLine = (b, id, star) => b || id != null ? '<div class="row sp"><span class="b">' + esc(pname(m, id)) + (star ? ' <span class="tag">*</span>' : '') + '</span><span><b>' + (b ? b.runs : 0) + '</b> (' + (b ? b.balls : 0) + ') <span class="mut">4s ' + (b ? b.fours : 0) + ' 6s ' + (b ? b.sixes : 0) + '</span></span></div>' : '<div class="row sp mut"><span>-</span></div>';
    const tgt = st.target ? '<div class="sub">Target <b>' + st.target + '</b> · need <b>' + st.runsNeeded + '</b> from <b>' + st.ballsLeft + '</b> balls · RRR <b>' + (st.rrr == null ? '-' : A.fmt2(st.rrr)) + '</b></div>' : '';
    let h = '<div class="score-head"><div class="row sp"><span class="tm">' + esc(batT.name) + (inn.type === 'super' ? ' · SUPER OVER' : '') + '</span>' + (st.freeHit ? '<span class="fh">FREE HIT</span>' : '') + '</div>' +
      '<div class="big">' + st.runs + '/' + st.wkts + ' <small>(' + st.oversText + '/' + inn.overs + ')</small></div>' +
      '<div class="sub">CRR <b>' + A.fmt2(st.crr) + '</b> · Extras <b>' + st.extrasTotal + '</b> · P\'ship <b>' + st.part.runs + '</b> (' + st.part.balls + ')</div>' + tgt + '</div>';
    h += '<div class="card">' + batLine(sBat, st.striker, true) + batLine(nBat, st.nonStriker, false) +
      '<hr style="border:0;border-top:1px solid var(--soft)"><div class="row sp"><span class="b">' + esc(bw ? pname(m, bw.id) : '-') + ' <span class="mut">(' + esc(bowlT.name) + ')</span></span><span>' + (bw ? CE.oversStr(bw.balls, bpo) + '-' + bw.maidens + '-' + bw.runs + '-' + bw.wkts : '') + '</span></div></div>';
    h += '<div class="mut b">' + overLbl + '</div><div class="balls">' + (overBalls.map(ballChip).join('') || '<span class="mut">No balls yet</span>') + '</div>';

    const dis = !A.canScore() ? ' disabled' : '';
    h += '<div class="seg"><button class="' + (A.db.mode === 'buttons' ? 'on' : '') + '" data-a="mode" data-v="buttons">Buttons</button><button class="' + (A.db.mode === 'dic' ? 'on' : '') + '" data-a="mode" data-v="dic">DIC Ground</button></div>';
    h += '<div class="mods">' + [['wd', 'Wide'], ['nb', 'No-ball'], ['b', 'Bye'], ['lb', 'Leg-bye']].map(x => '<button class="chip ' + (ui.mod === x[0] ? 'on' : '') + '" data-a="mod" data-v="' + x[0] + '"' + dis + '>' + x[1] + '</button>').join('') + '</div>';
    if (ui.mod) h += '<div class="mut c" style="margin:4px 0">' + ({ wd: 'Wide', nb: 'No-ball', b: 'Bye', lb: 'Leg-bye' })[ui.mod] + ' selected: pick the runs ' + (ui.mod === 'wd' ? '(0 = just the penalty)' : ui.mod === 'nb' ? '(runs off the bat)' : '') + '</div>';

    if (A.db.mode === 'dic') {
      h += '<div class="row sp" style="margin-bottom:4px"><span class="mut">Batter at top · bowler end at bottom</span><button class="chip on" style="margin:0;flex:none" data-a="names">' + (ui.names ? 'Show runs' : 'Show shot names') + '</button></div>' + A.groundSVG(m.dic.zones, { sel: ui.zoneSel, names: ui.names });
      if (ui.zoneSel) {
        const z = m.dic.zones.find(z => z.id === ui.zoneSel), o = ui.zoneOv;
        h += '<div class="zinfo"><div class="row sp"><div class="z">' + esc(z.label) + (z.ring < 5 ? ' <small>(' + CE.RINGS[z.ring].split(' (')[0] + ')</small>' : '') + ' · ' + o.runs + ' run' + (o.runs === 1 ? '' : 's') + '</div><div>' + (o.rotate ? 'Strike changes ↻' : 'Same striker') + (o.runs !== z.runs || o.rotate !== (z.rotate === 'change') ? ' <span class="tag k">override</span>' : '') + '</div></div>' +
          '<div class="row" style="margin-top:6px"><button data-a="zrun" data-d="-1">−1</button><button data-a="zrun" data-d="1">+1</button><button data-a="zrot">' + (o.rotate ? 'Strike ↻' : 'Strike =') + '</button></div>' +
          '<button class="btn k" style="margin-top:6px;padding:11px" data-a="zconfirm"' + dis + '>Confirm ' + o.runs + (o.rotate ? ' · change strike' : '') + '</button></div>';
      } else h += '<div class="mut c">Tap where the ball went. Zone 1 = near ring, Zone 2 = grey area</div>';
      h += '<div class="pad" style="grid-template-columns:1fr"><button class="pbtn dot" data-a="run" data-v="0"' + dis + '>• Dot ball</button></div>';
    } else {
      h += '<div class="pad">' + [0, 1, 2, 3, 4, 6].map(r => '<button class="pbtn r' + r + (r === 0 ? ' dot' : '') + '" data-a="run" data-v="' + r + '"' + dis + '>' + r + '</button>').join('') + '</div>';
    }
    h += '<div class="act"><button class="wk" data-a="wicket"' + dis + '>Wicket</button><button data-a="undo"' + dis + '>Undo</button><button data-a="correct"' + dis + '>Correct</button></div>';
    if (R.special && R.special.length) h += '<div class="mut b">Local rule shots</div><div>' + R.special.map((s, i) => '<button class="chip" data-a="special" data-i="' + i + '"' + dis + '>' + esc(s.name) + ': ' + (s.out ? 'OUT' : s.runs + (s.rotate === 'change' ? '↻' : '')) + '</button>').join('') + '</div>';
    h += '<div class="grid2" style="margin-top:8px"><button data-a="menu">⋯ More</button><button data-a="open" data-v="board" data-id="' + m.id + '">Live board</button></div>';
    if (st.ended) h += '<div class="hero c" style="margin-top:12px"><b>' + esc(st.endReason) + '</b></div><button class="btn" data-a="startNext">Continue</button>';
    return A.page(m.name, h, null, { keepScroll: true, right: '<button data-a="open" data-v="scorecard" data-id="' + m.id + '">Card</button>' });
  };

  function scoreLines(m) {
    return '<div class="card">' + m.innings.map(inn => { const s = CE.replay(m, inn); return '<div class="row sp"><b>' + esc(m.teams[inn.batting].name) + (inn.type === 'super' ? ' (SO)' : '') + '</b><span><b>' + s.runs + '/' + s.wkts + '</b> (' + s.oversText + ')</span></div>'; }).join('') + '</div>';
  }
  A.scoreLines = scoreLines;

  /* ---------- scoring ---------- */
  function commitScore(o) {
    const c = A.ctx(); if (!c || !c.inn) return;
    if (!A.canScore()) return A.toast('View-only role');
    const { m, inn, st } = c;
    if (st.ended || st.needOpeners || st.needBatter || st.needBowler) return;
    if (o.extra === undefined) o.extra = ui.mod;
    const e = CE.addBall(m, inn, o);
    ui.mod = null; ui.zoneSel = null; ui.zoneOv = null;
    const ev = CE.evaluate(m);
    m.status = ev.status === 'completed' ? 'completed' : 'live'; m.updated = Date.now();
    A.save();
    const bat = (!e.extra || e.extra === 'nb') ? e.runs : 0;
    A.render();
    if (bat === 4 || bat === 6) A.celebrate(bat);
    else if (e.wicket) A.toast('WICKET!');
  }
  A.actions.names = () => { ui.names = !ui.names; A.render(); };
  A.actions.mode = el => { A.db.mode = el.dataset.v; ui.zoneSel = null; A.save(); A.render(); };
  A.actions.mod = el => { ui.mod = ui.mod === el.dataset.v ? null : el.dataset.v; A.render(); };
  A.actions.run = el => commitScore({ runs: +el.dataset.v });
  A.actions.zone = el => {
    const c = A.ctx(); if (!c) return;
    const z = c.m.dic.zones.find(z => z.id === el.dataset.z);
    if (z.off) return A.toast(z.label + ' is switched off for this match');
    ui.zoneSel = z.id; ui.zoneOv = { runs: z.runs, rotate: z.rotate === 'change' };
    if (CE.rulesOf(c.m).autoCommitZone) return A.actions.zconfirm();
    A.render();
  };
  A.actions.zrun = el => { ui.zoneOv.runs = Math.max(0, Math.min(6, ui.zoneOv.runs + (+el.dataset.d))); A.render(); };
  A.actions.zrot = () => { ui.zoneOv.rotate = !ui.zoneOv.rotate; A.render(); };
  A.actions.zconfirm = () => {
    const c = A.ctx(); if (!c || !ui.zoneSel) return;
    const z = c.m.dic.zones.find(z => z.id === ui.zoneSel), o = ui.zoneOv;
    commitScore({ runs: o.runs, rotate: o.rotate, zone: z.id, zoneLabel: z.label, manual: o.runs !== z.runs || o.rotate !== (z.rotate === 'change') });
  };
  A.actions.special = el => {
    const c = A.ctx(); const s = CE.rulesOf(c.m).special[+el.dataset.i];
    if (s.out) {
      if (c.st.freeHit) return A.toast('Free hit: only run out');
      return commitScore({ runs: 0, special: s.name, wicket: { kind: s.name, out: c.st.striker, bowlerCredit: false } });
    }
    commitScore({ runs: s.runs, rotate: s.rotate === 'change', special: s.name });
  };
  A.actions.undo = () => {
    const c = A.ctx(); if (!c || !c.inn) return;
    if (!A.canScore()) return A.toast('View-only role');
    let r = CE.undo(c.m, c.inn);
    if (!r || !c.inn.events.some(e => e.t === 'ball')) {
      const idx = c.m.innings.indexOf(c.inn);
      if (!r && idx > 0 && !c.inn.events.some(e => e.t === 'ball')) { // empty new innings: go back to the previous one
        c.m.innings.splice(idx, 1); r = CE.undo(c.m, c.m.innings[idx - 1]);
      }
    }
    if (!r) { A.toast('Nothing to undo'); return; }
    c.m.status = 'live'; A.save(); A.toast('Last ball undone'); A.render();
  };
  A.actions.startNext = () => {
    const c = A.ctx(); if (!c) return;
    if (c.inn) { c.inn.events.push({ t: 'end' }); }
    const m = c.m, ev = CE.evaluate(m);
    if (ev.status === 'completed') { A.save(); return A.render(); }
    let o = {};
    if (ev.next === 'startSecond') o = { chaseOf: ev.pairFirst, type: m.innings[ev.pairFirst].type };
    else if (ev.next === 'superOver') o = { type: 'super' };
    else if (!ev.next) { A.save(); return A.render(); }
    CE.newInnings(m, ev.nextBat, o); A.save(); A.render();
  };
  A.actions.undoPrev = () => {
    const m = A.getMatch(); const inn = m && m.innings[m.innings.length - 1]; if (!inn) return;
    if (CE.undo(m, inn)) { m.status = 'live'; A.save(); A.toast('Last ball undone'); A.render(); }
  };
  A.actions.leaveLive = () => { ui.modal = null; ui.view = 'home'; ui.stack = []; A.render(); };

  /* ---------- modals ---------- */
  const forced = (title, body) => '<div class="modal"><div class="sheet"><h2>' + esc(title) + '</h2>' + body + '<button class="btn ghost" data-a="leaveLive" style="margin-top:10px">Leave scoring (saved)</button></div></div>';

  A.modals.openers = function () {
    const { m, inn } = A.ctx();
    const bat = m.teams[inn.batting], bowl = m.teams[inn.bowling];
    const opt = (t, ids, sel) => ids.map((id, i) => '<option value="' + id + '"' + (i === sel ? ' selected' : '') + '>' + esc(pname(m, id)) + '</option>').join('');
    return forced('Opening pair & first bowler',
      '<label>Striker (' + esc(bat.name) + ')</label><select id="op_s">' + opt(bat, inn.squad, 0) + '</select>' +
      '<label>Non-striker</label><select id="op_n">' + opt(bat, inn.squad, 1) + '</select>' +
      '<label>Opening bowler (' + esc(bowl.name) + ')</label><select id="op_b">' + opt(bowl, bowl.xi, 0) + '</select>' +
      '<button class="btn" data-a="openersOk">Start scoring</button>');
  };
  A.actions.openersOk = () => {
    const c = A.ctx(); const s = document.getElementById('op_s').value, n = document.getElementById('op_n').value, b = document.getElementById('op_b').value;
    if (s === n) return A.toast('Pick two different batters');
    c.inn.events.push({ t: 'open', striker: s, nonStriker: n }, { t: 'bowler', id: b });
    ui.modal = null; A.save(); A.render();
  };
  A.modals.batter = function () {
    const { m, inn, st } = A.ctx();
    return forced('New batter', st.availBatters.map(id => '<button class="btn ghost" style="margin-bottom:8px" data-a="pickBatter" data-id="' + id + '">' + esc(pname(m, id)) + '</button>').join(''));
  };
  A.actions.pickBatter = el => { const c = A.ctx(); c.inn.events.push({ t: 'batter', id: el.dataset.id }); ui.modal = null; A.save(); A.render(); };
  A.modals.bowler = function () {
    const { m, inn, st } = A.ctx(), bowl = m.teams[inn.bowling], R = CE.rulesOf(m);
    return forced('Select bowler for next over', bowl.xi.map(id => {
      const ok = CE.bowlerAllowed(m, st, id), b = st.bowlers[id];
      return '<button class="btn ghost" style="margin-bottom:8px;text-align:left"' + (ok ? '' : ' disabled') + ' data-a="pickBowler" data-id="' + id + '">' + esc(pname(m, id)) + ' <span class="mut">' + (b ? CE.oversStr(b.balls, R.ballsPerOver) + ' ov · ' + b.runs + 'r · ' + b.wkts + 'w' : 'new') + (id === st.lastBowler ? ' · bowled last over' : !ok ? ' · quota done' : '') + '</span></button>';
    }).join(''));
  };
  A.actions.pickBowler = el => { const c = A.ctx(); c.inn.events.push({ t: 'bowler', id: el.dataset.id }); ui.modal = null; A.save(); A.render(); };

  A.actions.wicket = () => {
    const c = A.ctx(); const R = CE.rulesOf(c.m);
    const kinds = CE.DISMISSALS.filter(d => R.dismissals[d.k] !== false && (!c.st.freeHit || d.k === 'runOut'));
    ui.modal = { type: 'wicket', kind: kinds[0] ? kinds[0].k : 'runOut', out: 's', runs: 0, fielder: '' };
    A.render();
  };
  A.modals.wicket = function (mo) {
    const { m, st } = A.ctx(), R = CE.rulesOf(m);
    const kinds = CE.DISMISSALS.filter(d => R.dismissals[d.k] !== false && (!st.freeHit || d.k === 'runOut'));
    let h = st.freeHit ? '<div class="fh" style="display:inline-block;margin-bottom:8px">FREE HIT: only run out</div>' : '';
    h += '<label>How out</label><div>' + kinds.map(k => '<button class="chip ' + (mo.kind === k.k ? 'on' : '') + '" data-a="wk" data-f="kind" data-v="' + k.k + '">' + esc(k.label) + '</button>').join('') + '</div>';
    if (mo.kind === 'runOut') {
      h += '<label>Who is out</label><div><button class="chip ' + (mo.out === 's' ? 'on' : '') + '" data-a="wk" data-f="out" data-v="s">' + esc(pname(m, st.striker)) + ' (striker)</button>' +
        (st.nonStriker != null ? '<button class="chip ' + (mo.out === 'n' ? 'on' : '') + '" data-a="wk" data-f="out" data-v="n">' + esc(pname(m, st.nonStriker)) + '</button>' : '') + '</div>';
      h += '<label>Runs completed on this ball</label><div>' + [0, 1, 2, 3].map(r => '<button class="chip ' + (mo.runs === r ? 'on' : '') + '" data-a="wk" data-f="runs" data-v="' + r + '">' + r + '</button>').join('') + '</div>';
    }
    h += '<label>Fielder (optional)</label><input data-b="ui.modal.fielder" value="' + esc(mo.fielder) + '" placeholder="Name">';
    if (ui.mod) h += '<div class="mut">Applied with: ' + ({ wd: 'Wide', nb: 'No-ball', b: 'Bye', lb: 'Leg-bye' })[ui.mod] + '</div>';
    return A.sheet('Wicket', h + '<button class="btn danger" data-a="wkOk">Confirm wicket</button>');
  };
  A.actions.wk = el => { const f = el.dataset.f; ui.modal[f] = f === 'runs' ? +el.dataset.v : el.dataset.v; A.render(); };
  A.actions.wkOk = () => {
    const c = A.ctx(), mo = ui.modal, d = CE.DISMISSALS.find(d => d.k === mo.kind);
    const out = mo.kind === 'runOut' && mo.out === 'n' ? c.st.nonStriker : c.st.striker;
    const runs = mo.kind === 'runOut' ? mo.runs : 0;
    ui.modal = null;
    commitScore({ runs, wicket: { kind: mo.kind, out, bowlerCredit: !!d.bowler, fielder: mo.fielder } });
  };

  A.actions.menu = () => { ui.modal = { type: 'menu' }; A.render(); };
  A.modals.menu = function () {
    const c = A.ctx(), R = CE.rulesOf(c.m);
    return A.sheet('Match options',
      '<div class="grid2"><button class="btn ghost" data-a="retireOpen">Retire batter</button><button class="btn ghost" data-a="endInn">End innings</button>' +
      '<button class="btn ghost" data-a="open" data-v="scorecard" data-id="' + c.m.id + '">Scorecard</button><button class="btn ghost" data-a="open" data-v="analytics" data-id="' + c.m.id + '">Analytics</button>' +
      '<button class="btn ghost" data-a="rulesInfo">Match rules</button><button class="btn ghost" data-a="leaveLive">Leave</button></div>');
  };
  A.actions.rulesInfo = () => {
    const c = A.ctx(), R = CE.rulesOf(c.m);
    const rows = [['Balls per over', R.ballsPerOver], ['Wide', R.wideRuns + ' run' + (R.wideReball ? ' + re-bowl' : ' (counts as ball)')], ['No-ball', R.noBallRuns + ' run' + (R.noBallReball ? ' + re-bowl' : '') + (R.freeHit ? ' + free hit' : '')], ['Last man batting', R.lastManBatting ? 'Yes' : 'No'], ['Max overs / bowler', R.maxOversPerBowler || 'No limit'], ['Super over', R.superOver ? 'Yes' : 'No'], ['Dismissals', CE.DISMISSALS.filter(d => R.dismissals[d.k] !== false).map(d => d.label).join(', ')], ['DIC preset', c.m.dic.name + (c.m.turf ? ' (' + c.m.turf + ')' : '')]];
    ui.modal = { type: 'info', title: 'Match rules', html: '<table>' + rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td class="r">' + esc(r[1]) + '</td></tr>').join('') + '</table>' + (R.notes ? '<p>' + esc(R.notes) + '</p>' : '') };
    A.render();
  };
  A.modals.info = mo => A.sheet(mo.title, mo.html);
  A.actions.endInn = () => { const c = A.ctx(); if (!c.inn) return; c.inn.events.push({ t: 'end' }); ui.modal = null; A.save(); A.render(); };

  A.actions.retireOpen = () => { ui.modal = { type: 'retire', who: 's' }; A.render(); };
  A.modals.retire = function (mo) {
    const { m, st } = A.ctx();
    return A.sheet('Retire batter',
      '<label>Who retires</label><div><button class="chip ' + (mo.who === 's' ? 'on' : '') + '" data-a="rt" data-f="who" data-v="s">' + esc(pname(m, st.striker)) + '</button>' +
      (st.nonStriker != null ? '<button class="chip ' + (mo.who === 'n' ? 'on' : '') + '" data-a="rt" data-f="who" data-v="n">' + esc(pname(m, st.nonStriker)) + '</button>' : '') + '</div>' +
      '<label>Replacement</label><select data-b="ui.modal.rep"><option value="">None</option>' + st.availBatters.map(id => '<option value="' + id + '">' + esc(pname(m, id)) + '</option>').join('') + '</select>' +
      '<button class="btn" data-a="rtOk">Confirm</button>');
  };
  A.actions.rt = el => { ui.modal[el.dataset.f] = el.dataset.v; A.render(); };
  A.actions.rtOk = () => {
    const c = A.ctx(), mo = ui.modal; const out = mo.who === 'n' ? c.st.nonStriker : c.st.striker;
    c.inn.events.push({ t: 'retire', out, in: mo.rep || null }); ui.modal = null; A.save(); A.render();
  };

  /* manual correction */
  A.actions.correct = () => { ui.modal = { type: 'correct', id: null }; A.render(); };
  A.modals.correct = function (mo) {
    const { m, inn, st } = A.ctx();
    const last = st.timeline.slice(-12);
    let h = '<div class="mut">Pick a delivery to correct (all changes are logged in the audit history).</div><div class="balls">' +
      last.map(b => '<button class="ball ' + (mo.id === b.id ? 'f' : '') + '" data-a="corPick" data-id="' + b.id + '">' + esc(b.label) + '</button>').join('') + '</div>';
    if (mo.id) {
      h += '<label>Runs (' + (mo.extra === 'wd' ? 'extra runs' : mo.extra === 'b' || mo.extra === 'lb' ? 'byes' : 'off the bat') + ')</label><div>' + [0, 1, 2, 3, 4, 5, 6].map(r => '<button class="chip ' + (mo.runs === r ? 'on' : '') + '" data-a="cor" data-f="runs" data-v="' + r + '">' + r + '</button>').join('') + '</div>' +
        '<label>Type</label><div>' + [['', 'Normal'], ['wd', 'Wide'], ['nb', 'No-ball'], ['b', 'Bye'], ['lb', 'Leg-bye']].map(x => '<button class="chip ' + ((mo.extra || '') === x[0] ? 'on' : '') + '" data-a="cor" data-f="extra" data-v="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>' +
        '<label>Strike after ball</label><div><button class="chip ' + (!mo.rotate ? 'on' : '') + '" data-a="cor" data-f="rotate" data-v="0">Same striker</button><button class="chip ' + (mo.rotate ? 'on' : '') + '" data-a="cor" data-f="rotate" data-v="1">Change strike</button></div>' +
        (mo.hasW ? '<label>Wicket on this ball</label><div><button class="chip ' + (mo.keepW ? 'on' : '') + '" data-a="cor" data-f="keepW" data-v="1">Keep wicket</button><button class="chip ' + (!mo.keepW ? 'on' : '') + '" data-a="cor" data-f="keepW" data-v="0">Remove wicket</button></div>' : '') +
        '<button class="btn" data-a="corOk">Save correction</button>';
    }
    return A.sheet('Manual correction', h);
  };
  A.actions.corPick = el => {
    const c = A.ctx(); const e = c.inn.events.find(x => x.id === el.dataset.id);
    ui.modal = { type: 'correct', id: e.id, runs: e.runs, extra: e.extra, rotate: e.rotate, hasW: !!e.wicket, keepW: !!e.wicket }; A.render();
  };
  A.actions.cor = el => { const f = el.dataset.f, v = el.dataset.v; ui.modal[f] = f === 'runs' ? +v : f === 'extra' ? (v || null) : f === 'rotate' || f === 'keepW' ? v === '1' : v; A.render(); };
  A.actions.corOk = () => {
    const c = A.ctx(), mo = ui.modal;
    const patch = { runs: mo.runs, extra: mo.extra || null, rotate: mo.rotate };
    if (mo.hasW && !mo.keepW) patch.wicket = null;
    const before = JSON.stringify(c.inn.events);
    CE.correctBall(c.m, c.inn, mo.id, patch);
    const st = CE.replay(c.m, c.inn);
    ui.modal = null; A.save(); A.render(); A.toast('Correction saved');
  };
})();
