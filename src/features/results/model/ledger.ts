import type { GameDoc, FrameEvents, RunRecord } from "../../../shared/types";
import { pushTimeline } from "../../../shared/timeline";
export function applyEvents(doc: GameDoc, events: FrameEvents): void {
  doc.stats.kills += events.kills.length;
  doc.stats.damage += events.damage;
  doc.stats.taken += events.taken;
  doc.stats.shots += events.shots;
  doc.stats.collected += events.collected;
  for (const weapon of ["pulse", "orbit", "nova"] as const)
    doc.stats.byWeapon[weapon] += events.weaponDamage?.[weapon] || 0;
  // Totals and detail are booked from the same event stream, so the panel
  // numbers always equal the aggregation of the traceable records.
  for (const event of events.timeline) pushTimeline(doc, event);
}
export function makeRecord(doc: GameDoc): RunRecord {
  return {
    id: `${doc.initialSeed}-${Date.now().toString(36)}`,
    duration: doc.time,
    wave: doc.wave,
    level: doc.level,
    kills: doc.stats.kills,
    damage: Math.round(doc.stats.damage),
    weapons: doc.weapons.map((w) => `${w.id}:${w.level}`),
    victory: doc.victory,
    taken: Math.round(doc.stats.taken),
    collected: doc.stats.collected,
    timeline: doc.timeline.length ? doc.timeline : undefined,
    detailTruncated: doc.timelineTruncated || undefined,
  };
}
