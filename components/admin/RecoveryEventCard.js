"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminPost } from "@/lib/adminClient";
import { recoveryState, RECOVERY_STATES } from "@/lib/recovery";

function formatTime(value) {
  if (!value) return "미설정";
  return new Date(value).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}

export default function RecoveryEventCard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setData(await adminApi("/api/admin?action=recovery"));
  }, []);

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [load]);

  async function draw() {
    if (!confirm("복구 공로 숫자를 추첨할까요? 추첨 후에는 다시 바꿀 수 없습니다.")) return;
    setBusy(true);
    setError("");
    try {
      await adminPost({ action: "draw_recovery_digit" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="hint">복구 이벤트 현황을 불러오는 중...</p>;
  const state = data.state || recoveryState(data.event);
  const canDraw = state === RECOVERY_STATES.ENDED && data.event.winningDigit === "" && data.entries.length > 0;
  const winners = data.event.winningDigit === ""
    ? []
    : data.entries.filter((entry) => entry.digit === Number(data.event.winningDigit));

  return (
    <section className="card admin-recovery-card">
      <div className="admin-recovery-heading">
        <div>
          <p className="card-title">🚨 긴급 복구 이벤트</p>
          <p className="hint">공지 {formatTime(data.event.noticeAt)} · 복구 {formatTime(data.event.startAt)} ~ {formatTime(data.event.endAt)}</p>
        </div>
        <span className={`admin-recovery-state ${state}`}>{state === RECOVERY_STATES.ACTIVE ? "진행 중" : state === RECOVERY_STATES.ENDED ? "복구 완료" : "대기"}</span>
      </div>
      <div className="admin-recovery-stats">
        <b>{data.entries.length}<small>접수</small></b>
        <b>{data.event.winningDigit === "" ? "?" : data.event.winningDigit}<small>당첨 숫자</small></b>
        <b>{winners.length}<small>당첨자</small></b>
      </div>
      {error && <p className="error-msg">{error}</p>}
      {canDraw && <button type="button" className="btn primary" onClick={draw} disabled={busy}>{busy ? "추첨 중..." : "🎰 복구 공로 숫자 추첨"}</button>}
      {state === RECOVERY_STATES.ACTIVE && <p className="hint">복구가 끝난 뒤 접수 목록을 확인하고 숫자를 추첨할 수 있습니다.</p>}
      {state === RECOVERY_STATES.ENDED && data.event.winningDigit === "" && !data.entries.length && <p className="hint">접수자가 없어 추첨할 수 없습니다.</p>}
      {winners.length > 0 && <ul className="admin-recovery-winners">{winners.map((winner) => <li key={winner.ticket}><b>{winner.nickname}</b><span>{winner.ticket}</span></li>)}</ul>}
    </section>
  );
}

