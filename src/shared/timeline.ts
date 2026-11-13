import type { GameDoc, TimelineEvent } from "./types";
// Detail is appended event-by-event instead of re-serializing the run each
// frame; the cap bounds long-run growth while totals keep accumulating.
export const TIMELINE_CAP = 4000;
export function pushTimeline(doc: GameDoc, event: TimelineEvent): void {
  if (doc.timeline.length >= TIMELINE_CAP) {
    doc.timelineTruncated = true;
    return;
  }
  doc.timeline.push(event);
}
export interface TimelineSummary {
  damage: number;
  taken: number;
  kills: number;
  collected: number;
}
export function summarizeTimeline(events: TimelineEvent[]): TimelineSummary {
  let damage = 0,
    taken = 0,
    kills = 0,
    collected = 0;
  for (const event of events) {
    if (event.kind === "hit") {
      damage += event.damage || 0;
      if (event.kill) kills++;
    } else if (event.kind === "taken") taken += event.damage || 0;
    else if (event.kind === "pickup") collected++;
  }
  return { damage, taken, kills, collected };
}
