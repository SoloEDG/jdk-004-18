import type { RunRecord } from "../../../shared/types";
const STORAGE_KEY = "neon-survivor.records.v1";
export type SaveStatus = "ok" | "truncated" | "failed";
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
function defaultStore(): KeyValueStore | null {
  return typeof window === "undefined" ? null : window.localStorage;
}
function isRecord(value: unknown): value is RunRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as RunRecord;
  return (
    typeof r.id === "string" &&
    ["duration", "wave", "level", "kills", "damage"].every(
      (k) =>
        typeof r[k as keyof RunRecord] === "number" &&
        Number.isFinite(r[k as keyof RunRecord]),
    ) &&
    Array.isArray(r.weapons) &&
    r.weapons.every((w) => typeof w === "string") &&
    typeof r.victory === "boolean"
  );
}
function sanitize(record: RunRecord): RunRecord {
  // Detail is optional: records written by older versions stay summary-only.
  if (record.timeline !== undefined && !Array.isArray(record.timeline)) {
    const { timeline, ...rest } = record;
    void timeline;
    return rest;
  }
  return record;
}
export function loadRecords(
  store: KeyValueStore | null = defaultStore(),
): RunRecord[] {
  try {
    if (!store) return [];
    const raw = JSON.parse(store.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(raw)
      ? raw.filter(isRecord).slice(0, 20).map(sanitize)
      : [];
  } catch {
    return [];
  }
}
// Quota fallback: drop per-event detail but keep every total intact.
export function stripDetails(records: RunRecord[]): RunRecord[] {
  return records.map((r) =>
    r.timeline ? { ...r, timeline: undefined, detailTruncated: true } : r,
  );
}
export function saveRecords(
  records: RunRecord[],
  store: KeyValueStore | null = defaultStore(),
): SaveStatus {
  if (!store) return "failed";
  const packed = records.slice(0, 20);
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(packed));
    return "ok";
  } catch {
    /* A full store retries with summaries only. */
  }
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(stripDetails(packed)));
    return "truncated";
  } catch {
    /* A full or disabled store cannot interrupt a run. */
    return "failed";
  }
}
