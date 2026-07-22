"use client";

import { useEffect, useState } from "react";
import { adminPost } from "@/lib/adminClient";

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

  async function drawNumbers() {
    if (!confirm("당첨 번호를 추첨할까요? 추첨 후에는 응모가 잠깁니다.")) return;
    setBusy(true);
    try {
      const res = await adminPost({ action: "draw_numbers" });
      alert(`당첨 번호: ${res.digits.slice(0, 2)}.${res.digits.slice(2)}`);
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

      <label>공지 (모든 페이지 상단 노출)</label>
      <NoticeEditor value={settings.notice || ""} onSave={(v) => setSetting("notice", v)} busy={busy} />

      <label>로또 최대 응모 장수</label>
      <select
        value={settings.max_lotto_entries || "2"}
        onChange={(e) => setSetting("max_lotto_entries", e.target.value)}
        disabled={busy}
      >
        {[1, 2, 3].map((n) => (
          <option key={n} value={n}>{n}장</option>
        ))}
      </select>

      <label>로또 추첨</label>
      {settings.winning_numbers ? (
        <div className="rule-box">
          🎉 당첨 번호:{" "}
          <b>
            {settings.winning_numbers.slice(0, 2)}.{settings.winning_numbers.slice(2)}
          </b>
          <button
            className="btn danger sm"
            style={{ marginLeft: 10 }}
            onClick={() =>
              setSetting("winning_numbers", "", "추첨 결과를 초기화할까요? 회원들에게 보이던 결과가 사라집니다.")
            }
          >
            초기화
          </button>
        </div>
      ) : (
        <button className="btn primary" onClick={drawNumbers} disabled={busy}>
          🎰 당첨 번호 추첨하기
        </button>
      )}
      <p className="hint" style={{ marginTop: 6 }}>
        업로드 기간: {settings.upload_start?.slice(0, 10)} ~ {settings.upload_end?.slice(0, 10)} · 추첨일{" "}
        {settings.draw_date}
      </p>
    </div>
  );
}

function NoticeEditor({ value, onSave, busy }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 추첨은 8/15 저녁 8시!" />
      <button className="btn ghost" onClick={() => onSave(text)} disabled={busy}>
        저장
      </button>
    </div>
  );
}
