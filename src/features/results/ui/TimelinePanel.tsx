import { useMemo, useState } from "react";
import type { TimelineEvent } from "../../../shared/types";
import { summarizeTimeline } from "../../../shared/timeline";
import { formatTime } from "../../../shared/math";
import { TOTAL_WAVES } from "../../waves/model/catalog";
import { UPGRADE_CATALOG } from "../../progression/model/catalog";
const KIND_LABEL: Record<string, string> = {
  hit: "命中",
  taken: "承伤",
  pickup: "拾取",
  upgrade: "升级",
};
const WEAPON_LABEL: Record<string, string> = {
  pulse: "脉冲",
  orbit: "轨道刃",
  nova: "新星",
  enemy: "敌方",
};
const DROP_LABEL: Record<string, string> = {
  xp: "能量",
  heal: "修复",
  magnet: "磁铁",
};
function describe(event: TimelineEvent): string {
  if (event.kind === "hit")
    return `${WEAPON_LABEL[event.weapon || ""] || event.weapon} 命中 #${event.target} · ${Math.round(event.damage || 0)} 伤害${event.kill ? " · 击杀" : ""}`;
  if (event.kind === "taken")
    return `${event.source === "contact" ? "接触" : "弹丸"}承伤 · ${Math.round(event.damage || 0)}`;
  if (event.kind === "pickup")
    return `拾取${DROP_LABEL[event.drop || ""] || event.drop} +${event.value}`;
  const name =
    UPGRADE_CATALOG.find((u) => u.id === event.upgrade)?.name || event.upgrade;
  return `选择升级 · ${name}${event.level ? ` Lv.${event.level}` : ""}`;
}
export function TimelinePanel({
  events,
  truncated,
}: {
  events: TimelineEvent[];
  truncated?: boolean;
}) {
  const [wave, setWave] = useState("all");
  const [weapon, setWeapon] = useState("all");
  const [kind, setKind] = useState("all");
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (wave === "all" || e.wave === Number(wave)) &&
          (kind === "all" || e.kind === kind) &&
          (weapon === "all" || e.weapon === weapon),
      ),
    [events, wave, weapon, kind],
  );
  // Panel totals are aggregated from the filtered records themselves.
  const totals = useMemo(() => summarizeTimeline(filtered), [filtered]);
  const visible = filtered.slice(-120);
  return (
    <div className="timeline-panel">
      <div className="timeline-head">
        <span>战斗时间线</span>
        {truncated && (
          <em className="truncated-badge">明细已截断 · 总数完整</em>
        )}
      </div>
      <div className="timeline-filters">
        <select value={wave} onChange={(e) => setWave(e.target.value)}>
          <option value="all">全部波次</option>
          {Array.from({ length: TOTAL_WAVES }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              第 {i + 1} 波
            </option>
          ))}
        </select>
        <select value={weapon} onChange={(e) => setWeapon(e.target.value)}>
          <option value="all">全部武器</option>
          <option value="pulse">脉冲</option>
          <option value="orbit">轨道刃</option>
          <option value="nova">新星</option>
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">全部事件</option>
          {Object.entries(KIND_LABEL).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="timeline-totals">
        <div>
          <strong>{Math.round(totals.damage).toLocaleString()}</strong>
          <small>造成伤害</small>
        </div>
        <div>
          <strong>{Math.round(totals.taken).toLocaleString()}</strong>
          <small>承受伤害</small>
        </div>
        <div>
          <strong>{totals.kills}</strong>
          <small>击杀</small>
        </div>
        <div>
          <strong>{totals.collected}</strong>
          <small>拾取</small>
        </div>
      </div>
      {visible.length ? (
        <div className="timeline-list">
          {visible
            .slice()
            .reverse()
            .map((event, i) => (
              <div className="timeline-row" key={filtered.length - i}>
                <span className="mono">
                  {formatTime(event.t)} · 波次 {event.wave || 1}
                </span>
                <span>{describe(event)}</span>
              </div>
            ))}
        </div>
      ) : (
        <p className="timeline-empty">当前筛选条件下暂无记录。</p>
      )}
    </div>
  );
}
