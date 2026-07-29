"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adminPost } from "@/lib/adminClient";
import { parseNotices, MAX_NOTICES } from "@/lib/notices";
import { currentLottoRound, parseLottoRounds } from "@/lib/lotto";
import { formatKoreanDateTime, fromKstInputValue, toKstInputValue } from "@/lib/period";

export default function SettingsCard({ settings, busy, setBusy, onChanged }) {
  async function setSetting(key, value, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await adminPost({ action: "set_setting", key, value });
      await onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setUploadPeriod(start, end) {
    if (!start || !end) return alert("시작과 마감 시각을 모두 입력해주세요.");
    if (new Date(start) >= new Date(end)) return alert("마감 시각은 시작 시각보다 뒤여야 합니다.");
    if (!confirm(`업로드 기간을 ${formatKoreanDateTime(start)} ~ ${formatKoreanDateTime(end)}로 함께 저장할까요?`)) return;
    setBusy(true);
    try {
      await adminPost({ action: "set_upload_period", start, end });
      await onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <p style={{ fontWeight: 700, marginBottom: 8 }}>이벤트 설정</p>

      <label>공지 (모든 페이지 상단, 5초마다 자동 전환, 최대 {MAX_NOTICES}개)</label>
      <NoticesEditor
        raw={settings.notice || ""}
        onSave={(list) => setSetting("notice", JSON.stringify(list))}
        busy={busy}
      />

      <label>로또 최대 응모 장수</label>
      <div className="rule-box" style={{ marginTop: 0 }}>
        🎟️ 1인당 <b>2장</b>으로 고정되어 있습니다.
      </div>

      <label>로또 추첨 (1의 자리·소수점 첫째·둘째, 총 3자리)</label>
      {/* 뽑기·차수 진행은 모두 추첨 화면에서 한다. 여기서는 현재 상태만 보여준다. */}
      <LottoStatus digits={settings.winning_numbers || ""} rounds={settings.lotto_rounds || ""} />
      <Link className="btn primary draw-stage-link" href="/admin/draw">
        🎰 무작위 번호 추첨 (큰 화면)
      </Link>

      <PeriodEditor settings={settings} busy={busy} onSavePeriod={setUploadPeriod} onSaveSetting={setSetting} />
    </div>
  );
}

/**
 * 업로드·응모 기간 편집.
 * 이 값이 깨지면 전 회원 업로드가 막히는데 지금껏 고칠 화면이 없어 DB를 직접 만져야 했다.
 * 입력·표시는 한국 시간 기준이고, 저장할 때 +09:00을 붙여 서버가 UTC로 오해하지 않게 한다.
 */
function PeriodEditor({ settings, busy, onSavePeriod, onSaveSetting }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [drawDate, setDrawDate] = useState("");

  useEffect(() => {
    setStart(toKstInputValue(settings.upload_start));
    setEnd(toKstInputValue(settings.upload_end));
    setDrawDate(settings.draw_date || "");
  }, [settings.upload_start, settings.upload_end, settings.draw_date]);

  const invalidRange = start && end && start >= end;

  function savePeriod() {
    const startValue = fromKstInputValue(start);
    const endValue = fromKstInputValue(end);
    if (!startValue || !endValue) return alert("시작과 마감 시각을 모두 입력해주세요.");
    onSavePeriod(startValue, endValue);
  }

  return (
    <>
      <label>업로드·응모 기간 (한국 시간)</label>
      <p className="hint">이 기간 밖에서는 인증 사진 업로드와 로또 응모가 막힙니다.</p>

      <div className="period-editor-row">
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          aria-label="업로드 시작 시각"
          disabled={busy}
        />
      </div>

      <div className="period-editor-row">
        <input
          type="datetime-local"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          aria-label="업로드 마감 시각"
          disabled={busy}
        />
      </div>

      {invalidRange && <p className="error-msg">마감이 시작보다 빠릅니다. 이대로 저장하면 업로드가 계속 막힙니다.</p>}
      <button
        type="button"
        className="btn ghost sm"
        onClick={savePeriod}
        disabled={busy || !start || !end || invalidRange}
      >
        기간 함께 저장
      </button>

      <label htmlFor="draw-date">추첨일</label>
      <div className="period-editor-row">
        <input
          id="draw-date"
          type="date"
          value={drawDate}
          onChange={(e) => setDrawDate(e.target.value)}
          disabled={busy}
        />
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => onSaveSetting("draw_date", drawDate, `추첨일을 ${drawDate}로 바꿀까요?`)}
          disabled={busy || !drawDate}
        >
          추첨일 저장
        </button>
      </div>

      <p className="hint">
        현재 설정: {formatKoreanDateTime(settings.upload_start) || "형식 오류"} ~{" "}
        {formatKoreanDateTime(settings.upload_end) || "형식 오류"} · 추첨일 {settings.draw_date || "미설정"}
      </p>
    </>
  );
}

/** 현재 추첨 상태만 보여 준다 — 실제 뽑기는 /admin/draw에서 한다 */
function LottoStatus({ digits, rounds }) {
  const pastRounds = parseLottoRounds(rounds);
  const round = currentLottoRound(rounds);
  const complete = digits.length === 3;

  return (
    <div>
      <div className="winning-digits" style={{ justifyContent: "flex-start", margin: "8px 0" }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className={`winning-digit ${i < digits.length ? "" : "pending"}`}>
            {i < digits.length ? digits[i] : "?"}
          </span>
        ))}
      </div>
      <p className="hint">
        {complete
          ? `${round}차 추첨 번호 ${digits[0]}.${digits.slice(1)}km`
          : `${round}차 추첨 진행 중 · ${3 - digits.length}자리 남음`}
        {pastRounds.length > 0 && ` · 1등 없이 넘어간 차수 ${pastRounds.length}회`}
      </p>
    </div>
  );
}

function NoticesEditor({ raw, onSave, busy }) {
  const notices = parseNotices(raw);
  const [text, setText] = useState("");

  function add() {
    const t = text.trim();
    if (!t) return;
    if (notices.length >= MAX_NOTICES) return alert(`공지는 최대 ${MAX_NOTICES}개까지 가능합니다.`);
    onSave([...notices, t]);
    setText("");
  }

  return (
    <div>
      {notices.map((n, i) => (
        <div
          key={i}
          style={{
            display: "flex", alignItems: "center", gap: 8, padding: "6px 0",
            borderBottom: "1px dashed var(--line)", fontSize: "0.85rem",
          }}
        >
          <span style={{ flex: 1 }}>📢 {n}</span>
          <button
            className="btn danger sm"
            disabled={busy}
            onClick={() => confirm("이 공지를 삭제할까요?") && onSave(notices.filter((_, j) => j !== i))}
          >
            삭제
          </button>
        </div>
      ))}
      {notices.length === 0 && <p className="hint" style={{ padding: "4px 0" }}>등록된 공지가 없습니다.</p>}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="예: 추첨은 8/15 저녁 8시!"
        />
        <button className="btn ghost" onClick={add} disabled={busy || notices.length >= MAX_NOTICES}>
          추가
        </button>
      </div>
    </div>
  );
}
