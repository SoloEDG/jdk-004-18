import { useState } from "react";
import type { RunRecord } from "../../../shared/types";
import { formatTime } from "../../../shared/math";
import { TimelinePanel } from "./TimelinePanel";
export function HistoryPanel({
  records,
  close,
}: {
  records: RunRecord[];
  close: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overlay">
      <div className="history-dialog">
        <button className="close" onClick={close}>
          关闭 ✕
        </button>
        <div className="eyebrow">FLIGHT RECORDER</div>
        <h2>行动档案</h2>
        {!records.length ? (
          <p>尚无行动记录，完成一局后自动保存在此浏览器。</p>
        ) : (
          records.map((r) => (
            <div key={r.id}>
              <div
                className={`history-row ${r.timeline?.length ? "clickable" : ""}`}
                onClick={
                  r.timeline?.length
                    ? () => setOpen(open === r.id ? null : r.id)
                    : undefined
                }
              >
                <span>{r.victory ? "撤离成功" : "信号中断"}</span>
                <span>{formatTime(r.duration)}</span>
                <span>波次 {r.wave}</span>
                <span>{r.kills} 击杀</span>
                <span className="history-detail-toggle">
                  {r.timeline?.length
                    ? open === r.id
                      ? "收起 ▲"
                      : "明细 ▼"
                    : "仅汇总可用"}
                </span>
              </div>
              {r.detailTruncated && (
                <em className="truncated-badge">明细已截断 · 总数完整</em>
              )}
              {open === r.id && r.timeline?.length ? (
                <div className="history-detail">
                  <TimelinePanel
                    events={r.timeline}
                    truncated={r.detailTruncated}
                  />
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
