const assert = require('assert');
const CE = require('../www/js/engine.js');

function mk(overs = 2, n = 4, rules = {}) {
  const team = (name, p) => ({ id: name, name, players: Array.from({ length: n }, (_, i) => ({ id: p + i, name: p + i })), xi: Array.from({ length: n }, (_, i) => p + i), subs: [] });
  const m = CE.createMatch({ name: 't', date: '2026-01-01', overs, teams: [team('A', 'a'), team('B', 'b')], rules });
  m.battingFirst = 0;
  return m;
}
function start(m, batIdx = 0, opts) {
  const inn = CE.newInnings(m, batIdx, opts);
  inn.events.push({ t: 'open', striker: m.teams[batIdx].xi[0], nonStriker: m.teams[batIdx].xi[1] });
  inn.events.push({ t: 'bowler', id: m.teams[1 - batIdx].xi[0] });
  return inn;
}
const zone = (m, id) => m.dic.zones.find(z => z.id === id);
const hitZone = (m, inn, id) => { const z = zone(m, id); CE.addBall(m, inn, { runs: z.runs, rotate: z.rotate === 'change', zone: z.id, zoneLabel: z.label }); };

// 1. Zone 1 (near ring) -> 1 run, same striker (until over completes). Outer ring -> 3 runs, strike changes.
{
  const m = mk(); const inn = start(m);
  hitZone(m, inn, 'f0s4');
  let s = CE.replay(m, inn);
  assert.equal(s.runs, 1); assert.equal(s.striker, 'a0'); assert.equal(s.batters.a0.runs, 1);
  hitZone(m, inn, 'f2s3'); // cover, outer ring
  s = CE.replay(m, inn);
  assert.equal(s.runs, 4); assert.equal(s.striker, 'a1'); assert.equal(s.nonStriker, 'a0'); assert.equal(s.batters.a0.runs, 4);
  assert.equal(inn.events[inn.events.length - 1].zone, 'f2s3'); // zone recorded in ball history
}
// 2. Manual DIC override changes the rule without altering the stored config
{
  const m = mk(); const inn = start(m);
  CE.addBall(m, inn, { runs: 2, rotate: false, zone: 'z2', zoneLabel: 'Zone 2', manual: true });
  const s = CE.replay(m, inn);
  assert.equal(s.runs, 2); assert.equal(s.striker, 'a0'); assert.equal(zone(m, 'z2').runs, 1);
}
// 3. Over end swaps strike; bowler must change; maiden counted
{
  const m = mk(); const inn = start(m);
  for (let i = 0; i < 6; i++) CE.addBall(m, inn, { runs: 0 });
  const s = CE.replay(m, inn);
  assert.equal(s.striker, 'a1'); assert.equal(s.legal, 6); assert.equal(s.bowlers.b0.maidens, 1);
  assert.equal(s.needBowler, true); assert.equal(CE.bowlerAllowed(m, s, 'b0'), false); assert.equal(CE.bowlerAllowed(m, s, 'b1'), true);
}
// 4. Wide + no-ball: not legal, runs added, free hit set, odd run on nb rotates
{
  const m = mk(); const inn = start(m);
  CE.addBall(m, inn, { runs: 0, extra: 'wd' });
  let s = CE.replay(m, inn);
  assert.equal(s.runs, 1); assert.equal(s.legal, 0); assert.equal(s.extras.wd, 1); assert.equal(s.batters.a0.balls, 0);
  CE.addBall(m, inn, { runs: 1, extra: 'nb' });
  s = CE.replay(m, inn);
  assert.equal(s.runs, 3); assert.equal(s.legal, 0); assert.equal(s.freeHit, true); assert.equal(s.striker, 'a1'); assert.equal(s.batters.a0.runs, 1); assert.equal(s.batters.a0.balls, 1);
  CE.addBall(m, inn, { runs: 0 });
  s = CE.replay(m, inn);
  assert.equal(s.freeHit, false); assert.equal(s.bowlers.b0.runs, 3);
}
// 5. Byes don't go to bowler or batter
{
  const m = mk(); const inn = start(m);
  CE.addBall(m, inn, { runs: 2, extra: 'b' }); CE.addBall(m, inn, { runs: 1, extra: 'lb' });
  const s = CE.replay(m, inn);
  assert.equal(s.runs, 3); assert.equal(s.batters.a0.runs, 0); assert.equal(s.bowlers.b0.runs, 0); assert.equal(s.extras.b, 2); assert.equal(s.extras.lb, 1); assert.equal(s.legal, 2);
}
// 6. Wicket, new batter fills the slot, FOW, partnership reset; undo restores everything
{
  const m = mk(); const inn = start(m);
  CE.addBall(m, inn, { runs: 4 });
  CE.addBall(m, inn, { runs: 0, wicket: { kind: 'bowled', out: 'a0', bowlerCredit: true } });
  let s = CE.replay(m, inn);
  assert.equal(s.wkts, 1); assert.equal(s.needBatter, true); assert.equal(s.fow[0].runs, 4); assert.equal(s.bowlers.b0.wkts, 1);
  inn.events.push({ t: 'batter', id: 'a2' });
  s = CE.replay(m, inn);
  assert.equal(s.striker, 'a2'); assert.equal(s.nonStriker, 'a1'); assert.equal(s.needBatter, false); assert.equal(s.part.runs, 0);
  CE.undo(m, inn); // removes batter event + wicket ball together
  s = CE.replay(m, inn);
  assert.equal(s.wkts, 0); assert.equal(s.striker, 'a0'); assert.equal(s.runs, 4); assert.equal(m.audit.length, 1);
}
// 7. Wicket on last ball of over: new batter goes to the non-striker end, other batter faces next over
{
  const m = mk(2, 5); const inn = start(m);
  for (let i = 0; i < 5; i++) CE.addBall(m, inn, { runs: 0 });
  CE.addBall(m, inn, { runs: 0, wicket: { kind: 'bowled', out: 'a0', bowlerCredit: true } });
  inn.events.push({ t: 'batter', id: 'a2' });
  const s = CE.replay(m, inn);
  assert.equal(s.striker, 'a1'); assert.equal(s.nonStriker, 'a2');
}
// 8. Run out of non-striker after 1 run
{
  const m = mk(); const inn = start(m);
  CE.addBall(m, inn, { runs: 1, rotate: true, wicket: { kind: 'runOut', out: 'a1', bowlerCredit: false } });
  const s = CE.replay(m, inn);
  // batters crossed (1 run), a1 run out at the striker's end: vacant striker slot, a0 stays at the other end
  assert.equal(s.striker, null); assert.equal(s.nonStriker, 'a0'); assert.equal(s.bowlers.b0.wkts, 0); assert.ok(s.batters.a1.out); assert.equal(s.needBatter, true);
}
// 9. Chase: target, required rate, win by wickets / runs, all out, tie -> super over
{
  const m = mk(1, 3);
  let i1 = start(m);
  for (let i = 0; i < 6; i++) CE.addBall(m, i1, { runs: 1 });
  let ev = CE.evaluate(m); assert.equal(ev.next, 'startSecond');
  let i2 = CE.newInnings(m, 1, { chaseOf: 0 }); assert.equal(i2.target, 7);
  i2.events.push({ t: 'open', striker: 'b0', nonStriker: 'b1' }, { t: 'bowler', id: 'a0' });
  CE.addBall(m, i2, { runs: 4 });
  let s = CE.replay(m, i2); assert.equal(s.runsNeeded, 3); assert.ok(Math.abs(s.rrr - 3 / 5 * 6) < 1e-9);
  CE.addBall(m, i2, { runs: 3 });
  ev = CE.evaluate(m); assert.equal(ev.status, 'completed'); assert.ok(/B won by 2 wickets \(4 balls left\)/.test(ev.text), ev.text);
}
{
  const m = mk(1, 3);
  const i1 = start(m); for (let i = 0; i < 6; i++) CE.addBall(m, i1, { runs: 1 });
  const i2 = CE.newInnings(m, 1, { chaseOf: 0 }); i2.events.push({ t: 'open', striker: 'b0', nonStriker: 'b1' }, { t: 'bowler', id: 'a0' });
  for (let i = 0; i < 6; i++) CE.addBall(m, i2, { runs: i < 5 ? 1 : 0 });
  let ev = CE.evaluate(m); assert.equal(ev.status, 'completed'); assert.ok(/A won by 1 run/.test(ev.text), ev.text);
}
{
  // tie scenario: A scores 5 in 1 over, B scores 5
  const m = mk(1, 3);
  const i1 = start(m); for (let i = 0; i < 6; i++) CE.addBall(m, i1, { runs: i < 5 ? 1 : 0 });
  const i2 = CE.newInnings(m, 1, { chaseOf: 0 }); i2.events.push({ t: 'open', striker: 'b0', nonStriker: 'b1' }, { t: 'bowler', id: 'a0' });
  for (let i = 0; i < 6; i++) CE.addBall(m, i2, { runs: i < 5 ? 1 : 0 });
  let ev = CE.evaluate(m); assert.equal(ev.next, 'superOver'); assert.equal(ev.nextBat, 1);
  const s1 = CE.newInnings(m, 1, { type: 'super' }); assert.equal(s1.overs, 1); assert.equal(s1.maxWkts, 2);
  s1.events.push({ t: 'open', striker: 'b0', nonStriker: 'b1' }, { t: 'bowler', id: 'a0' });
  CE.addBall(m, s1, { runs: 6 });
  ev = CE.evaluate(m); assert.equal(ev.current, 2);
}
// 10. Innings ends all out, last man batting rule
{
  const m = mk(5, 3); const inn = start(m);
  CE.addBall(m, inn, { runs: 0, wicket: { kind: 'bowled', out: 'a0', bowlerCredit: true } });
  inn.events.push({ t: 'batter', id: 'a2' });
  CE.addBall(m, inn, { runs: 0, wicket: { kind: 'bowled', out: 'a1', bowlerCredit: true } });
  let s = CE.replay(m, inn); assert.equal(s.ended, true); assert.equal(s.endReason, 'All out');
  const m2 = mk(5, 3, { lastManBatting: true }); const i2 = start(m2);
  CE.addBall(m2, i2, { runs: 0, wicket: { kind: 'bowled', out: 'a0', bowlerCredit: true } });
  i2.events.push({ t: 'batter', id: 'a2' });
  CE.addBall(m2, i2, { runs: 0, wicket: { kind: 'bowled', out: 'a1', bowlerCredit: true } });
  s = CE.replay(m2, i2); assert.equal(s.ended, false); assert.equal(s.needBatter, false); assert.equal(s.striker, 'a2');
  CE.addBall(m2, i2, { runs: 1 }); s = CE.replay(m2, i2); assert.equal(s.striker, 'a2'); // lone batter keeps strike
  CE.addBall(m2, i2, { runs: 0, wicket: { kind: 'bowled', out: 'a2', bowlerCredit: true } });
  s = CE.replay(m2, i2); assert.equal(s.ended, true);
}
// 0. Zone layout: Zone 1 = near ring, Zone 2 = wedges (1 run, same striker); 4 and 6 only in front sectors
{
  const z = CE.buildDefaultZones();
  assert.equal(z.length, 1 + 5 * CE.SHOTS.length);
  assert.ok(!z.some(x => x.id === 'z1'));
  z.filter(x => x.runs >= 4).forEach(x => assert.ok(x.id[0] === 'f' && x.ring >= 3));
  z.filter(x => x.ring === 0).forEach(x => { assert.equal(x.runs, 1); assert.equal(x.rotate, 'keep'); });
  const z2 = z.find(x => x.id === 'z2'); assert.equal(z2.runs, 1); assert.equal(z2.rotate, 'keep');
  z.filter(x => x.ring === 1).forEach(x => { assert.equal(x.runs, 2); assert.equal(x.rotate, 'keep'); });
  z.filter(x => x.ring === 2).forEach(x => { assert.equal(x.runs, 3); assert.equal(x.rotate, 'change'); });
  ['Cover', 'Cut', 'Mid on', 'Mid off', 'Straight drive', 'Straight lofted', 'Late cut', 'Flick', 'Sweep', 'Reverse sweep', 'Paddle sweep'].forEach(n => assert.ok(CE.SHOTS.includes(n), n));
  // old presets with the back-wall Zone 1 strip are upgraded and keep names and Zone 2 setup
  const old = { zones: [{ id: 'z1', ring: 5, sec: 0, label: 'Zone 1', runs: 1, rotate: 'keep' }, { id: 'z2', ring: 6, sec: 0, label: 'Zone 2', runs: 2, rotate: 'change', off: false }, { id: 'f1s3', ring: 1, sec: 3, label: 'Drive', runs: 2, rotate: 'keep' }] };
  CE.upgradeZones(old); assert.ok(!old.zones.some(x => x.id === 'z1')); assert.equal(old.zones.find(x => x.id === 'z2').runs, 2); assert.equal(old.zones.find(x => x.id === 'f1s3').label, 'Drive'); assert.equal(old.zones.length, z.length);
}
// 11. Manual correction + analytics
{
  const m = mk(); const inn = start(m);
  hitZone(m, inn, 'f3s3'); hitZone(m, inn, 'f0s4'); hitZone(m, inn, 'f0s4'); CE.addBall(m, inn, { runs: 0 });
  const id = inn.events.filter(e => e.t === 'ball')[1].id;
  CE.correctBall(m, inn, id, { runs: 2, rotate: false });
  const s = CE.replay(m, inn); assert.equal(s.runs, 4 + 2 + 1 + 0);
  const a = CE.analytics(m);
  assert.equal(a.zones.f0s4.count, 2); assert.equal(a.shots['Cover'].runs, 4); assert.equal(a.zones.f3s3.runs, 4); assert.equal(a.bounds, 1); assert.equal(a.dots, 1); assert.equal(a.byRing[3].runs, 4);
  const ps = CE.playerStats([m]); assert.equal(ps.a0.runs + ps.a1.runs, 7);
}
console.log('All engine tests passed');
