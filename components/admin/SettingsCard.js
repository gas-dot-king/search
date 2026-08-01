"use client";

import { useEffect, useState } from "react";
import { adminPost } from "@/lib/adminClient";
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

  return <PeriodEditor settings={settings} busy={busy} onSavePeriod={setUploadPeriod} onSaveSetting={setSetting} />;
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
