"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi } from "@/lib/adminClient";
import { formatKoreanDateTime } from "@/lib/period";

/**
 * 방명록 관리 (기본은 접힘).
 * 행사 페이지는 로그인 없이도 열리는 공개 화면이라, 부적절한 글을 운영진이 지울 수 있어야 한다.
 * 목록은 공개 API를 그대로 쓰고, 삭제만 관리자 비밀번호를 실어 보낸다.
 */
export default function GuestbookCard() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await adminApi("/api/guestbook");
      setEntries(data.entries);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (open && entries === null) load();
  }, [open, entries, load]);

  async function remove(entry) {
    if (!confirm(`${entry.nickname} 님의 방명록을 삭제할까요?\n되돌릴 수 없습니다.`)) return;
    setBusy(true);
    setError("");
    try {
      await adminApi("/api/guestbook", { method: "DELETE", body: JSON.stringify({ id: entry.id }) });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <button
        type="button"
        className="admin-collapse-toggle"
        aria-expanded={open}
        aria-controls="admin-guestbook-body"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span style={{ fontWeight: 700 }}>
          💌 방명록{entries ? ` (${entries.length}개)` : ""}
        </span>
        <span className="admin-collapse-caret" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div id="admin-guestbook-body">
          <p className="hint" style={{ margin: "10px 0" }}>
            행사 안내 페이지에 공개되는 글입니다. 부적절한 내용만 골라서 지워주세요.
          </p>
          {error && <p className="error-msg">{error}</p>}
          {entries === null && !error && <p className="hint">불러오는 중...</p>}
          {entries?.length === 0 && <p className="hint">아직 남겨진 글이 없습니다.</p>}
          {entries?.length > 0 && (
            <ul className="admin-guestbook-list">
              {entries.map((entry) => (
                <li key={entry.id}>
                  <div className="admin-guestbook-head">
                    <strong>{entry.nickname}</strong>
                    <time dateTime={entry.createdAt}>{formatKoreanDateTime(entry.createdAt)}</time>
                    <button
                      type="button"
                      className="btn danger sm"
                      onClick={() => remove(entry)}
                      disabled={busy}
                    >
                      삭제
                    </button>
                  </div>
                  <p className="guestbook-message">{entry.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
