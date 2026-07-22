"use client";

import { useState } from "react";
import { adminPost } from "@/lib/adminClient";
import { parseNotices, MAX_NOTICES } from "@/lib/notices";

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

      <label>공지 (모든 페이지 상단, 5초마다 자동 전환, 최대 {MAX_NOTICES}개)</label>
      <NoticesEditor
        raw={settings.notice || ""}
        onSave={(list) => setSetting("notice", JSON.stringify(list))}
        busy={busy}
      />

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
