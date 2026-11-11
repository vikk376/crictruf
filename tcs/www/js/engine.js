/* CricTruf: pure scoring engine (no DOM). State is derived by replaying
   the ball-by-ball event log, so undo/correction/strike-rotation are always consistent. */
(function (g) {
  'use strict';
  const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

  const RINGS = ['Zone 1 (near)', 'Middle', 'Outer', 'Boundary (4)', 'Over the net (6)', 'Back wall', 'Zone 2'];
  // Front-field shot sectors, left to right across the ground (off side on the left for a right-hand batter)
  const SHOTS = ['Reverse sweep', 'Late cut', 'Cut', 'Cover', 'Mid off', 'Straight drive', 'Straight lofted', 'Mid on', 'Flick', 'Sweep', 'Paddle sweep'];
  const SECTORS = SHOTS.length;

  const DISMISSALS = [
    { k: 'bowled', label: 'Bowled', bowler: true },
    { k: 'caught', label: 'Caught (direct)', bowler: true },
    { k: 'oneTipOneHand', label: 'One-tip-one-hand', bowler: true },
    { k: 'lbw', label: 'LBW', bowler: true },
    { k: 'stumped', label: 'Stumped', bowler: true },
    { k: 'hitWicket', label: 'Hit wicket', bowler: true },
    { k: 'runOut', label: 'Run out', bowler: false },
  ];

  const DEFAULT_RULES = {
    ballsPerOver: 6,
    wideRuns: 1, noBallRuns: 1,
    wideReball: true, noBallReball: true,
    freeHit: true,
    overEndSwap: true,
    lastManBatting: false,
    maxOversPerBowler: 0,
    superOver: true, superOverWickets: 2, superOverOvers: 1,
    autoCommitZone: false,
    dismissals: { bowled: true, caught: true, oneTipOneHand: true, lbw: false, stumped: true, hitWicket: true, runOut: true },
    special: [
      { id: 'sw', name: 'Side wall', runs: 2, rotate: 'keep', out: false },
      { id: 'nt', name: 'Net touch', runs: 1, rotate: 'change', out: false },
      { id: 'rf', name: 'Roof / out of ground', runs: 6, rotate: 'keep', out: false },
    ],
    notes: '',
  };

  // Zone 1 = the near ring around the pitch (all 11 shot sectors), Zone 2 = the grey wedges beside the pitch.
  // Only these two are DIC zones: default 1 run and the same striker (strike changes only when the over completes).
  // The rest of the ground is fixed: middle 2, outer 3 (strike changes), boundary 4, over the net 6.
  // 4 and 6 exist only in the front-field shot sectors.
  function buildDefaultZones() {
    const z = [{ id: 'z2', ring: 6, sec: 0, label: 'Zone 2', runs: 1, rotate: 'keep', off: false }];
    const cfg = [[1, 'keep'], [2, 'keep'], [3, 'change'], [4, 'keep'], [6, 'keep']];
    for (let r = 0; r < 5; r++) for (let s = 0; s < SECTORS; s++)
      z.push({ id: 'f' + r + 's' + s, ring: r, sec: s, label: SHOTS[s], runs: cfg[r][0], rotate: cfg[r][1], off: false });
    return z;
  }
  // Old presets (back-wall Zone 1 strip) are rebuilt in the new layout, keeping shot names and Zone 2 settings.
  function upgradeZones(d) {
    if (!d || !d.zones || !d.zones.some(z => z.id === 'z1')) return d;
    const nz = buildDefaultZones(), z2 = d.zones.find(z => z.id === 'z2');
    nz.forEach(z => { if (z.id === 'z2' && z2) { z.runs = z2.runs; z.rotate = z2.rotate; z.off = !!z2.off; } else if (z.ring < 5) { const o = d.zones.find(x => x.ring < 5 && x.sec === z.sec); if (o) z.label = o.label; } });
    d.zones = nz; return d;
  }
  function defaultDic(name) { return { id: uid(), name: name || 'Default Turf', turf: '', zones: buildDefaultZones() }; }
  const clone = o => JSON.parse(JSON.stringify(o));
  const rulesOf = m => Object.assign({}, DEFAULT_RULES, m && m.rules);

  function oversStr(legal, bpo) { bpo = bpo || 6; return Math.floor(legal / bpo) + '.' + (legal % bpo); }

  /* ---------- Match / innings creation ---------- */
  function createMatch(cfg) {
    return {
      id: uid(), name: cfg.name || 'Match', date: cfg.date, venue: cfg.venue || '', turf: cfg.turf || '',
      overs: +cfg.overs || 10, teams: cfg.teams, toss: null, battingFirst: null,
      rules: clone(Object.assign({}, DEFAULT_RULES, cfg.rules || {})),
      dic: clone(cfg.dic || defaultDic()), innings: [], audit: [], created: Date.now(),
      tournamentId: cfg.tournamentId || null, fixtureId: cfg.fixtureId || null, status: 'toss',
    };
  }
  function newInnings(match, batIdx, opts) {
    opts = opts || {};
    const R = rulesOf(match);
    const bat = match.teams[batIdx], n = bat.xi.length;
    const sup = opts.type === 'super';
    const prev = opts.chaseOf != null ? replay(match, match.innings[opts.chaseOf]) : null;
    const inn = {
      id: uid(), batting: batIdx, bowling: 1 - batIdx, type: sup ? 'super' : 'normal',
      overs: sup ? R.superOverOvers : match.overs,
      maxWkts: sup ? Math.min(R.superOverWickets, R.lastManBatting ? n : n - 1) : (R.lastManBatting ? n : Math.max(1, n - 1)),
      squad: bat.xi.slice(), target: prev ? prev.runs + 1 : null, events: [],
    };
    match.innings.push(inn);
    return inn;
  }

  /* ---------- Replay ---------- */
  function ballLabel(e) {
    let s = '';
    if (e.extra === 'wd') s = 'Wd' + (e.runs ? '+' + e.runs : '');
    else if (e.extra === 'nb') s = 'Nb' + (e.runs ? '+' + e.runs : '');
    else if (e.extra === 'b') s = e.runs + 'B';
    else if (e.extra === 'lb') s = e.runs + 'LB';
    else s = e.runs === 0 ? '•' : String(e.runs);
    if (e.wicket) s = (e.extra || e.runs ? s + ' ' : '') + 'W';
    return s;
  }

  function replay(match, inn) {
    const R = rulesOf(match), bpo = R.ballsPerOver;
    const st = {
      runs: 0, wkts: 0, legal: 0, extras: { wd: 0, nb: 0, b: 0, lb: 0 },
      striker: null, nonStriker: null, bowler: null, lastBowler: null,
      batters: {}, order: [], bowlers: {}, bowlerOrder: [], fow: [], part: { runs: 0, balls: 0 },
      overs: [], timeline: [], freeHit: false, ended: false, endReason: '', opened: false,
      target: inn.target || null, bpo, inn,
    };
    const touch = id => {
      if (id == null) return;
      if (!st.batters[id]) { st.batters[id] = { id, runs: 0, balls: 0, fours: 0, sixes: 0, dots: 0, out: false, how: '', retired: false }; st.order.push(id); }
    };
    const bw = id => {
      if (!st.bowlers[id]) { st.bowlers[id] = { id, balls: 0, runs: 0, wkts: 0, maidens: 0, wd: 0, nb: 0, dots: 0, curBalls: 0, curRuns: 0 }; st.bowlerOrder.push(id); }
      return st.bowlers[id];
    };
    const avail = () => inn.squad.filter(id => !st.batters[id]).length;
    const swap = () => { if ((st.striker != null && st.nonStriker != null) || avail() > 0) { const t = st.striker; st.striker = st.nonStriker; st.nonStriker = t; } };
    const overRec = i => { while (st.overs.length <= i) st.overs.push({ runs: 0, wkts: 0, balls: 0 }); return st.overs[i]; };

    for (const e of inn.events) {
      if (st.ended) break;
      if (e.t === 'open') { st.striker = e.striker; st.nonStriker = e.nonStriker; touch(e.striker); touch(e.nonStriker); st.opened = true; }
      else if (e.t === 'bowler') { st.bowler = e.id; bw(e.id); }
      else if (e.t === 'batter') { touch(e.id); if (st.striker == null) st.striker = e.id; else if (st.nonStriker == null) st.nonStriker = e.id; }
      else if (e.t === 'retire') {
        const ob = st.batters[e.out]; if (ob) { ob.retired = true; ob.how = 'retired'; }
        if (st.striker === e.out) st.striker = e.in != null ? e.in : null; else if (st.nonStriker === e.out) st.nonStriker = e.in != null ? e.in : null;
        touch(e.in);
      }
      else if (e.t === 'end') { st.ended = true; st.endReason = 'Innings closed'; }
      else if (e.t === 'ball') {
        const x = e.extra || null, r = e.runs || 0, pen = e.pen || 0, total = pen + r;
        const legal = !!e.legal, bat = (x === null || x === 'nb') ? r : 0;
        const ovIdx = Math.floor(st.legal / bpo);
        const b = st.batters[st.striker], bwl = bw(st.bowler);
        st.runs += total;
        if (x === 'wd') st.extras.wd += total; else if (x === 'nb') st.extras.nb += pen; else if (x === 'b') st.extras.b += r; else if (x === 'lb') st.extras.lb += r;
        if (b) {
          if (x !== 'wd') b.balls++;
          b.runs += bat; if (bat === 4) b.fours++; if (bat === 6) b.sixes++;
          if (x === null && r === 0) b.dots++;
        }
        const conceded = (x === 'b' || x === 'lb') ? 0 : total;
        bwl.runs += conceded; bwl.curRuns += conceded;
        if (x === 'wd') bwl.wd += total; if (x === 'nb') bwl.nb += pen;
        if (x === null && r === 0) bwl.dots++;
        if (legal) { bwl.balls++; bwl.curBalls++; st.legal++; st.part.balls++; }
        st.part.runs += total;
        const ov = overRec(ovIdx); ov.runs += total; if (legal) ov.balls++;
        // free hit
        if (x === 'nb' && R.freeHit) st.freeHit = true; else if (legal) st.freeHit = false;
        if (e.rotate) swap();
        if (e.wicket) {
          const w = e.wicket, ob = st.batters[w.out];
          st.wkts++; ov.wkts++;
          if (ob) { ob.out = true; ob.how = w.kind; ob.bowler = w.bowlerCredit ? st.bowler : null; ob.fielder = w.fielder || ''; }
          if (st.striker === w.out) st.striker = null; else if (st.nonStriker === w.out) st.nonStriker = null;
          if (w.bowlerCredit) bwl.wkts++;
          st.fow.push({ n: st.wkts, runs: st.runs, over: oversStr(st.legal, bpo), batter: w.out, partnership: st.part.runs });
          st.part = { runs: 0, balls: 0 };
        }
        st.timeline.push({ over: ovIdx, label: ballLabel(e), runs: total, legal, wicket: !!e.wicket, four: bat === 4, six: bat === 6, id: e.id, zone: e.zoneLabel || '' });
        // end of over
        if (legal && st.legal % bpo === 0) {
          if (bwl.curRuns === 0) bwl.maidens++;
          bwl.curBalls = 0; bwl.curRuns = 0;
          st.lastBowler = st.bowler; st.bowler = null;
          if (R.overEndSwap) swap();
        }
        // innings end checks
        if (st.wkts >= inn.maxWkts) { st.ended = true; st.endReason = 'All out'; }
        else if (st.legal >= inn.overs * bpo) { st.ended = true; st.endReason = 'Overs complete'; }
        else if (inn.target && st.runs >= inn.target) { st.ended = true; st.endReason = 'Target reached'; }
      }
    }
    st.availBatters = inn.squad.filter(id => !st.batters[id]);
    st.needOpeners = !st.opened && !st.ended;
    st.needBatter = st.opened && !st.ended && (st.striker == null || st.nonStriker == null) && st.availBatters.length > 0;
    st.needBowler = st.opened && !st.ended && !st.needBatter && st.bowler == null;
    st.oversText = oversStr(st.legal, bpo);
    st.ballsLeft = Math.max(0, inn.overs * bpo - st.legal);
    st.crr = st.legal ? st.runs / (st.legal / bpo) : 0;
    st.runsNeeded = inn.target ? Math.max(0, inn.target - st.runs) : null;
    st.rrr = inn.target && st.ballsLeft ? (st.runsNeeded / st.ballsLeft) * bpo : null;
    st.extrasTotal = st.extras.wd + st.extras.nb + st.extras.b + st.extras.lb;
    return st;
  }

  function bowlerAllowed(match, st, id) {
    const R = rulesOf(match);
    if (id === st.lastBowler) return false;
    const b = st.bowlers[id];
    if (R.maxOversPerBowler && b && b.balls >= R.maxOversPerBowler * R.ballsPerOver) return false;
    return true;
  }

  /* ---------- Scoring actions ---------- */
  function buildBall(match, o) {
    // o: {runs, extra, rotate, zone, special, wicket, manual}
    const R = rulesOf(match);
    const x = o.extra || null;
    const pen = x === 'wd' ? R.wideRuns : x === 'nb' ? R.noBallRuns : 0;
    const legal = x === 'wd' ? !R.wideReball : x === 'nb' ? !R.noBallReball : true;
    let rotate = o.rotate;
    if (rotate == null) rotate = (o.runs || 0) % 2 === 1;
    return {
      t: 'ball', id: uid(), ts: Date.now(), runs: o.runs || 0, extra: x, pen, legal, rotate: !!rotate,
      zone: o.zone || null, zoneLabel: o.zoneLabel || '', special: o.special || null, manual: !!o.manual,
      wicket: o.wicket || null,
    };
  }
  function addBall(match, inn, o) { const e = buildBall(match, o); inn.events.push(e); return e; }

  function undo(match, inn) {
    let i = -1;
    for (let k = inn.events.length - 1; k >= 0; k--) if (inn.events[k].t === 'ball') { i = k; break; }
    let removed = null;
    if (i >= 0) { removed = inn.events[i]; inn.events.length = i; }
    else if (inn.events.length && inn.events[inn.events.length - 1].t !== 'open') removed = inn.events.pop();
    if (removed) match.audit.push({ ts: Date.now(), action: 'undo', innings: match.innings.indexOf(inn), event: removed });
    return removed;
  }
  function correctBall(match, inn, ballId, patch) {
    const e = inn.events.find(x => x.id === ballId);
    if (!e) return false;
    const before = clone(e);
    if (before.wicket && patch.wicket === null) { // wicket removed: drop the replacement-batter event that followed it
      const i = inn.events.indexOf(e); while (inn.events[i + 1] && inn.events[i + 1].t === 'batter') inn.events.splice(i + 1, 1);
    }
    Object.assign(e, patch);
    const R = rulesOf(match);
    e.pen = e.extra === 'wd' ? R.wideRuns : e.extra === 'nb' ? R.noBallRuns : 0;
    e.legal = e.extra === 'wd' ? !R.wideReball : e.extra === 'nb' ? !R.noBallReball : true;
    e.manual = true;
    match.audit.push({ ts: Date.now(), action: 'correct', innings: match.innings.indexOf(inn), before, after: clone(e) });
    return true;
  }

  /* ---------- Match evaluation ---------- */
  function evaluate(match) {
    const R = rulesOf(match);
    const out = { status: 'toss', current: -1, next: null, winner: null, text: '', tied: false, pair: 0 };
    if (match.battingFirst == null) return out;
    out.status = 'live';
    let first = match.battingFirst;
    for (let p = 0; ; p++) {
      const i = 2 * p, j = i + 1;
      out.pair = p;
      if (!match.innings[i]) { out.next = p === 0 ? 'startInnings' : 'superOver'; out.nextBat = first; out.current = -1; return out; }
      const a = replay(match, match.innings[i]);
      if (!a.ended) { out.current = i; return out; }
      if (!match.innings[j]) { out.next = 'startSecond'; out.nextBat = 1 - first; out.current = -1; out.pairFirst = i; return out; }
      const b = replay(match, match.innings[j]);
      if (!b.ended) { out.current = j; return out; }
      if (b.runs > a.runs) {
        const left = match.innings[j].maxWkts - b.wkts, bl = b.ballsLeft;
        out.winner = match.innings[j].batting;
        out.text = match.teams[out.winner].name + ' won by ' + left + ' wicket' + (left === 1 ? '' : 's') + (match.innings[j].type === 'super' ? '' : ' (' + bl + ' ball' + (bl === 1 ? '' : 's') + ' left)');
      } else if (a.runs > b.runs) {
        out.winner = match.innings[i].batting;
        const d = a.runs - b.runs;
        out.text = match.teams[out.winner].name + ' won by ' + d + ' run' + (d === 1 ? '' : 's');
      } else {
        if (R.superOver && p < 5) {
          first = match.innings[j].batting; // team that batted second bats first in the super over
          out.tied = true; out.current = -1;
          if (!match.innings[2 * p + 2]) { out.next = 'superOver'; out.nextBat = first; return out; }
          continue;
        }
        out.text = 'Match tied'; out.tied = true;
      }
      out.status = 'completed'; out.current = j; return out;
    }
  }

  /* ---------- Aggregates ---------- */
  function playerName(match, id) {
    for (const t of match.teams) { const p = t.players.find(p => p.id === id); if (p) return p.name; }
    return '?';
  }
  function dismissalText(match, st, b) {
    if (b.retired) return 'retired';
    if (!b.out) return st.striker === b.id || st.nonStriker === b.id ? 'not out' : (st.ended ? 'did not bat/not out' : 'yet to bat');
    const bn = b.bowler ? playerName(match, b.bowler) : '';
    const f = b.fielder ? ' (' + b.fielder + ')' : '';
    switch (b.how) {
      case 'bowled': return 'b ' + bn;
      case 'caught': return 'c' + f + ' b ' + bn;
      case 'oneTipOneHand': return 'c (OTOH)' + f + ' b ' + bn;
      case 'lbw': return 'lbw b ' + bn;
      case 'stumped': return 'st' + f + ' b ' + bn;
      case 'hitWicket': return 'hit wkt b ' + bn;
      case 'runOut': return 'run out' + f;
      default: return b.how;
    }
  }

  function analytics(match) {
    const zones = {}, shots = {}, byRing = RINGS.map(() => ({ balls: 0, runs: 0 }));
    let balls = 0, dots = 0, bounds = 0, runs = 0, legalBalls = 0;
    const zmap = {}; (match.dic.zones || []).forEach(z => zmap[z.id] = z);
    const overs = [];
    match.innings.forEach((inn, idx) => {
      const st = replay(match, inn);
      overs.push({ team: match.teams[inn.batting].name, overs: st.overs.map(o => o.runs), wkts: st.overs.map(o => o.wkts) });
      inn.events.forEach(e => {
        if (e.t !== 'ball') return;
        balls++; if (e.legal) legalBalls++;
        const bat = (!e.extra || e.extra === 'nb') ? e.runs : 0;
        if (!e.extra && e.runs === 0) dots++;
        if (bat === 4 || bat === 6) bounds++;
        runs += e.pen + e.runs;
        if (e.zone) {
          const z = zones[e.zone] || (zones[e.zone] = { id: e.zone, label: e.zoneLabel, count: 0, runs: 0 });
          z.count++; z.runs += e.runs;
          const zz = zmap[e.zone]; if (zz) { byRing[zz.ring].balls++; byRing[zz.ring].runs += e.runs; }
          const sh = shots[e.zoneLabel] || (shots[e.zoneLabel] = { label: e.zoneLabel, count: 0, runs: 0 }); sh.count++; sh.runs += e.runs;
        }
      });
    });
    return { zones, shots, byRing, balls, dots, bounds, runs, dotPct: balls ? dots / balls * 100 : 0, boundPct: balls ? bounds / balls * 100 : 0, overs };
  }

  function playerStats(matches) {
    const S = {};
    const P = id => S[id] || (S[id] = { id, matches: 0, inns: 0, notOuts: 0, runs: 0, balls: 0, fours: 0, sixes: 0, hs: 0, wkts: 0, conceded: 0, bowled: 0, maidens: 0, _m: new Set() });
    matches.forEach(m => m.innings.forEach(inn => {
      const st = replay(m, inn);
      st.order.forEach(id => { const b = st.batters[id], p = P(id); p._m.add(m.id); p.inns++; if (!b.out) p.notOuts++; p.runs += b.runs; p.balls += b.balls; p.fours += b.fours; p.sixes += b.sixes; p.hs = Math.max(p.hs, b.runs); });
      st.bowlerOrder.forEach(id => { const b = st.bowlers[id], p = P(id); p._m.add(m.id); p.wkts += b.wkts; p.conceded += b.runs; p.bowled += b.balls; p.maidens += b.maidens; });
    }));
    Object.values(S).forEach(p => {
      p.matches = p._m.size; delete p._m;
      const outs = p.inns - p.notOuts;
      p.avg = outs > 0 ? p.runs / outs : p.runs; p.sr = p.balls ? p.runs / p.balls * 100 : 0;
      p.econ = p.bowled ? p.conceded / (p.bowled / 6) : 0;
    });
    return S;
  }

  g.CE = { uid, clone, RINGS, SHOTS, SECTORS, DISMISSALS, DEFAULT_RULES, rulesOf, buildDefaultZones, upgradeZones, defaultDic, createMatch, newInnings, replay, buildBall, addBall, undo, correctBall, evaluate, bowlerAllowed, playerName, dismissalText, analytics, playerStats, oversStr, ballLabel };
  if (typeof module !== 'undefined') module.exports = g.CE;
})(typeof window !== 'undefined' ? window : globalThis);
