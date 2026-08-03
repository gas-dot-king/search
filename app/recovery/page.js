"use client";

import { useEffect, useRef, useState } from "react";
import Nav from "@/components/Nav";
import PhotoRejectedModal from "@/components/PhotoRejectedModal";
import { api, PRIVACY_WARNING } from "@/lib/client";
import { fetchPublicConfig, useApiData, usePhoto } from "@/lib/hooks";
import { normalizeRecoveryEvent, recoveryState, RECOVERY_STATES } from "@/lib/recovery";

function pad(value) { return String(value).padStart(2, "0"); }

function Countdown({ event, state }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const target = state === RECOVERY_STATES.NOTICE ? new Date(event.startAt) : new Date(event.endAt);
  const remaining = Math.max(0, target.getTime() - now.getTime());
  const totalSeconds = Math.floor(remaining / 1000);
  return <strong className="recovery-countdown">{pad(Math.floor(totalSeconds / 3600))}:{pad(Math.floor((totalSeconds % 3600) / 60))}:{pad(totalSeconds % 60)}</strong>;
}

export default function RecoveryPage() {
  const { data, error, reload } = useApiData("/api/recovery");
  const [config, setConfig] = useState(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => {
    fetchPublicConfig({ fresh: true }).then(setConfig).catch(() => {});
  }, []);

  // 아직 아무것도 못 받았을 때도 시각 필드가 비지 않도록 보정해서 쓴다.
  const event = normalizeRecoveryEvent(data?.event || config?.recovery);
  const state = recoveryState(event);
  const photo = usePhoto({ uploadStart: event?.startAt || null });

  async function submit() {
    if (!photo.file) return setSubmitError("오늘의 운동 인증 사진을 선택해주세요.");
    setSubmitting(true);
    setSubmitError("");
    try {
      const form = new FormData();
      form.append("file", photo.file, "recovery.jpg");
      if (note.trim()) form.append("note", note.trim());
      await api("/api/recovery", { method: "POST", body: form });
      photo.clear();
      setNote("");
      await reload();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!data && error) {
    return <main className="wrap"><Nav config={config} /><p className="error-msg">{error}</p></main>;
  }
  if (!data || !event) {
    return <main className="wrap"><Nav config={config} /><p className="hint">복구센터를 준비하는 중...</p></main>;
  }

  const active = state === RECOVERY_STATES.ACTIVE;
  const ended = state === RECOVERY_STATES.ENDED;

  return (
    <main className="wrap recovery-page">
      <Nav config={config} />
      <section className="recovery-hero">
        <div className="recovery-hero-light" aria-hidden="true">🚨</div>
        <p className="recovery-kicker">YSRC EMERGENCY OPERATIONS CENTER</p>
        <h1>🔥 긴급 복구 인증센터</h1>
        <p>여러분의 열정으로 서버가 과열되었습니다. 기존 기록은 안전하니 안심하세요.</p>
        <div className="recovery-console">
          <span>SERVER TEMP</span><b>TOO HOT</b>
          <span>DATA STATUS</span><b className="safe">SAFE</b>
          <span>RECOVERY PACKETS</span><b>{data.count}건</b>
        </div>
      </section>

      {state === RECOVERY_STATES.NOTICE && (
        <section className="card recovery-state-card">
          <p className="recovery-state-icon">⏳</p>
          <h2>오늘 자정부터 복구를 시작합니다</h2>
          <p>복구가 시작되면 하루 동안 운동 인증을 한 번 제출할 수 있어요.</p>
          <Countdown event={event} state={state} />
        </section>
      )}

      {active && !data.entry && (
        <section className="card recovery-submit-card">
          <div className="recovery-warning-strip">⚠️ 긴급 복구 서버 임시 접속 허용</div>
          <h2>오늘의 운동 기록을 남겨주세요</h2>
          <p className="hint">러닝·걷기·헬스·스트레칭 모두 가능해요. 본 이벤트 진행도에는 반영되지 않습니다.</p>
          <input ref={fileRef} type="file" accept="image/*" onChange={photo.pick} hidden />
          {photo.preview && <img className="recovery-preview" src={photo.preview} alt="복구 인증 미리보기" />}
          {photo.busy && <p className="photo-processing" role="status">복구 패킷을 압축하는 중...</p>}
          {photo.error && <p className="error-msg">{photo.error}</p>}
          {submitError && <p className="error-msg">{submitError}</p>}
          <div className="warn-box">{PRIVACY_WARNING}</div>
          <label htmlFor="recovery-note">복구 로그 메모 (선택)</label>
          <input id="recovery-note" value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder="예: 서버를 식히기 위해 5km 달림" />
          <div className="recovery-submit-actions">
            <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()} disabled={photo.busy || submitting}>
              {photo.file ? "사진 변경" : "운동 인증 사진 선택"}
            </button>
            <button type="button" className="btn primary" onClick={submit} disabled={!photo.file || photo.busy || submitting}>
              {submitting ? "복구 패킷 전송 중..." : "긴급 인증 제출"}
            </button>
          </div>
          <PhotoRejectedModal rejected={photo.rejected} onClose={photo.dismissRejected} />
        </section>
      )}

      {data.entry && (
        <section className="card recovery-ticket-card">
          <p className="recovery-ticket-kicker">RECOVERY PACKET ACCEPTED</p>
          <h2>복구 패킷 접수 완료!</h2>
          <p>서버가 간신히 한 장을 받아냈습니다. 접수번호 끝자리가 오늘의 행운 번호예요.</p>
          <div className="recovery-ticket">
            <span>{data.entry.ticket}</span>
            <b>{data.entry.digit}</b>
          </div>
          <p className="hint">현재 복구 패킷 {data.count}건 접수 · 숫자 추첨 후 결과 공개</p>
          {data.isWinner && <p className="recovery-winner">🎉 서버 복구 공로상 당첨!</p>}
        </section>
      )}

      {ended && !data.winningDigit && (
        <section className="card recovery-state-card">
          <p className="recovery-state-icon">✅</p>
          <h2>서버 복구 완료</h2>
          <p>기존 빙고·로또 인증이 다시 열렸습니다. 복구 공로 숫자는 관리자 추첨을 기다리는 중이에요.</p>
        </section>
      )}

      {data.winningDigit !== null && data.winningDigit !== undefined && (
        <section className="card recovery-result-card">
          <p className="recovery-ticket-kicker">RECOVERY DRAW COMPLETE</p>
          <h2>복구 공로 숫자는</h2>
          <strong className="recovery-winning-digit">{data.winningDigit}</strong>
          <p>끝자리가 <b>{data.winningDigit}</b>인 복구 패킷이 당첨되었습니다.</p>
          {data.winners?.length > 0 && <p className="hint">당첨자 {data.winners.length}명 · {data.event.prizeText}</p>}
        </section>
      )}

      <p className="recovery-fake-note page-note">※ 실제 장애가 아닌 컨셉 이벤트입니다. 서버는 멀쩡하고, 여러분의 열정만 과열되었습니다.</p>
    </main>
  );
}
