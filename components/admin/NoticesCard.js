"use client";

import { useState } from "react";
import { adminPost } from "@/lib/adminClient";
import { parseNotices, MAX_NOTICES } from "@/lib/notices";

/** 공지 편집. 모든 페이지 상단에 뜨고 5초마다 자동 전환된다. */
export default function NoticesCard({ raw, busy, setBusy, onChanged }) {
  async function save(list) {
    setBusy(true);
    try {
      await adminPost({ action: "set_setting", key: "notice", value: JSON.stringify(list) });
      await onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return <NoticesEditor raw={raw} onSave={save} busy={busy} />;
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
      <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "stretch" }}>
        <input
          style={{ flex: 1, minWidth: 0 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          placeholder="예: 추첨은 8/15 저녁 8시!"
        />
        <button
          className="btn ghost"
          style={{ flex: "none", width: "auto", whiteSpace: "nowrap" }}
          onClick={add}
          disabled={busy || notices.length >= MAX_NOTICES}
        >
          추가
        </button>
      </div>
    </div>
  );
}
