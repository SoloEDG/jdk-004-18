import { test } from "node:test";
import assert from "node:assert/strict";
import { createRun } from "../src/shared/createRun";
import { simulate } from "../src/app/simulate";
import { stepCombat } from "../src/features/combat";
import { stepProgression, chooseUpgrade } from "../src/features/progression";
import { stepResults } from "../src/features/results";
import { loadRecords, saveRecords } from "../src/features/results/lib/storage";
import { summarizeTimeline, TIMELINE_CAP } from "../src/shared/timeline";
import type { FrameEvents, RunRecord } from "../src/shared/types";
const input = { x: 0, y: 0, aim: { x: 700, y: 325 }, firing: false };
const events = (): FrameEvents => ({
  kills: [],
  damage: 0,
  taken: 0,
  shots: 0,
  collected: 0,
  timeline: [],
});
const enemy = (id: number, hp = 10, x = 600) => ({
  id,
  kind: "chaser" as const,
  x,
  y: 325,
  hp,
  maxHp: hp,
  radius: 12,
  cooldown: 0,
});
const bullet = (id: number, damage: number, pierce: number) => ({
  id,
  x: 600,
  y: 325,
  vx: 0,
  vy: 0,
  radius: 5,
  damage,
  life: 1,
  owner: "player" as const,
  weapon: "pulse" as const,
  pierce,
  hit: [],
});
test("piercing hits book each target once and duplicate detection adds nothing", () => {
  const d = createRun();
  d.enemies = [enemy(1, 30, 590), enemy(2, 30, 610)];
  d.bullets = [bullet(9, 20, 3)];
  const first = stepCombat(d, input, 0);
  const hits = first.timeline.filter((e) => e.kind === "hit");
  assert.equal(hits.length, 2);
  assert.deepEqual(
    hits.map((e) => e.target).sort(),
    [1, 2],
  );
  assert.ok(hits.every((e) => e.damage === 20));
  const second = stepCombat(d, input, 0);
  assert.equal(second.timeline.filter((e) => e.kind === "hit").length, 0);
});
test("overkill books only the health actually removed", () => {
  const d = createRun();
  d.enemies = [enemy(1, 10)];
  d.bullets = [bullet(9, 50, 0)];
  const e = stepCombat(d, input, 0);
  const hit = e.timeline.find((t) => t.kind === "hit");
  assert.equal(hit?.damage, 10);
  assert.equal(hit?.kill, true);
});
test("invincibility suppresses repeated taken events", () => {
  const d = createRun();
  d.enemies = [enemy(1, 10, 500)];
  const first = stepCombat(d, input, 0);
  assert.equal(first.timeline.filter((e) => e.kind === "taken").length, 1);
  const second = stepCombat(d, input, 0);
  assert.equal(second.timeline.filter((e) => e.kind === "taken").length, 0);
});
test("combat events flow through drops and upgrades into the ledger", () => {
  const d = createRun();
  d.phase = "playing";
  d.drops = [{ id: 4, x: 500, y: 325, kind: "xp", value: 100, life: 30 }];
  const frame = events();
  stepProgression(d, frame, 0);
  assert.ok(frame.timeline.some((e) => e.kind === "pickup" && e.drop === "xp"));
  stepResults(d, frame);
  assert.ok(d.timeline.some((e) => e.kind === "pickup"));
  assert.equal(d.phase, "upgrade");
  chooseUpgrade(d, d.choices[0]);
  const upgrade = d.timeline.find((e) => e.kind === "upgrade");
  assert.ok(upgrade);
  assert.equal(typeof upgrade.wave, "number");
});
test("panel totals equal the aggregation of the filtered timeline", () => {
  const d = createRun();
  d.phase = "playing";
  for (let i = 0; i < 60 * 30 && d.phase !== "ended"; i++) {
    simulate(d, input, 1 / 60);
    if (d.phase === "upgrade") chooseUpgrade(d, d.choices[0]);
  }
  assert.ok(d.timeline.length > 0);
  assert.equal(d.timelineTruncated, false);
  const totals = summarizeTimeline(d.timeline);
  assert.ok(Math.abs(totals.damage - d.stats.damage) < 1e-6);
  assert.ok(Math.abs(totals.taken - d.stats.taken) < 1e-6);
  assert.equal(totals.kills, d.stats.kills);
  assert.equal(totals.collected, d.stats.collected);
  for (const weapon of ["pulse", "orbit", "nova"] as const) {
    const byWeapon = d.timeline
      .filter((e) => e.kind === "hit" && e.weapon === weapon)
      .reduce((sum, e) => sum + (e.damage || 0), 0);
    assert.ok(Math.abs(byWeapon - d.stats.byWeapon[weapon]) < 1e-6);
  }
  d.player.hp = 0;
  stepResults(d, events());
  const record = d.records[0];
  const booked = summarizeTimeline(record.timeline || []);
  assert.equal(record.kills, booked.kills);
  assert.equal(record.damage, Math.round(booked.damage));
  assert.equal(record.taken, Math.round(booked.taken));
  assert.equal(record.collected, booked.collected);
});
test("detail cap truncates the timeline while totals keep accumulating", () => {
  const d = createRun();
  d.phase = "playing";
  const frame = events();
  for (let i = 0; i < TIMELINE_CAP + 50; i++)
    frame.timeline.push({
      t: 0,
      wave: 1,
      kind: "hit",
      weapon: "pulse",
      target: i,
      damage: 1,
    });
  frame.damage = frame.timeline.length;
  stepResults(d, frame);
  assert.equal(d.timeline.length, TIMELINE_CAP);
  assert.equal(d.timelineTruncated, true);
  assert.equal(d.stats.damage, TIMELINE_CAP + 50);
});
const recordWithDetail = (): RunRecord => ({
  id: "run-a",
  duration: 12,
  wave: 2,
  level: 3,
  kills: 4,
  damage: 55,
  weapons: ["pulse:1"],
  victory: false,
  taken: 9,
  collected: 7,
  timeline: [{ t: 1, wave: 1, kind: "hit", weapon: "pulse", damage: 55 }],
});
test("a full store truncates detail but preserves complete totals", () => {
  let calls = 0,
    stored = "";
  const store = {
    getItem: () => null,
    setItem: (_key: string, value: string) => {
      calls++;
      if (calls === 1) throw new Error("quota exceeded");
      stored = value;
    },
  };
  const status = saveRecords([recordWithDetail()], store);
  assert.equal(status, "truncated");
  const saved = JSON.parse(stored)[0];
  assert.equal(saved.timeline, undefined);
  assert.equal(saved.detailTruncated, true);
  assert.equal(saved.damage, 55);
  assert.equal(saved.kills, 4);
});
test("a healthy store keeps full detail and a dead store reports failure", () => {
  let stored = "";
  const ok = saveRecords([recordWithDetail()], {
    getItem: () => null,
    setItem: (_key: string, value: string) => {
      stored = value;
    },
  });
  assert.equal(ok, "ok");
  assert.equal(JSON.parse(stored)[0].timeline.length, 1);
  const dead = saveRecords([recordWithDetail()], {
    getItem: () => null,
    setItem: () => {
      throw new Error("disabled");
    },
  });
  assert.equal(dead, "failed");
});
test("legacy records without detail still load as summary-only", () => {
  const legacy = {
    id: "old-run",
    duration: 30,
    wave: 3,
    level: 2,
    kills: 8,
    damage: 120,
    weapons: ["pulse:2"],
    victory: true,
  };
  let value = JSON.stringify([legacy, { ...legacy, id: "broken", timeline: 7 }]);
  const loaded = loadRecords({
    getItem: () => value,
    setItem: (_key: string, v: string) => {
      value = v;
    },
  });
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].timeline, undefined);
  assert.equal(loaded[1].timeline, undefined);
});
