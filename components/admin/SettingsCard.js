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

  // 버튼 누를 때마다 한 자리씩 뽑기
  async function drawNextDigit() {
    setBusy(true);
    try {
      await adminPost({ action: "draw_numbers" });
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
      <LottoDraw
        digits={settings.winning_numbers || ""}
        busy={busy}
        onDraw={drawNextDigit}
        onReset={() =>
          setSetting("winning_numbers", "", "추첨을 초기화할까요? 회원들에게 보이던 번호가 사라집니다.")
        }
      />
      <p className="hint" style={{ marginTop: 6 }}>
        업로드 기간: {settings.upload_start?.slice(0, 10)} ~ {settings.upload_end?.slice(0, 10)} · 추첨일{" "}
        {settings.draw_date}
      </p>
    </div>
  );
}

function LottoDraw({ digits, busy, onDraw, onReset }) {
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
      <div style={{ display: "flex", gap: 8 }}>
        {!complete && (
          <button className="btn primary" style={{ width: "auto" }} onClick={onDraw} disabled={busy}>
            🎰 {digits.length + 1}번째 자리 뽑기
          </button>
        )}
        {complete && (
          <span className="rule-box" style={{ margin: 0, flex: 1 }}>
            🎉 추첨 완료: <b>{digits[0]}.{digits.slice(1)}</b> km
          </span>
        )}
        {digits.length > 0 && (
          <button className="btn danger sm" onClick={onReset} disabled={busy}>초기화</button>
        )}
      </div>
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
