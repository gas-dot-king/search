"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { GUESTBOOK_MAX_LENGTH, normalizeGuestbookMessage } from "@/lib/guestbook";
import { formatKoreanDateTime } from "@/lib/period";

/**
 * 오프라인 행사 방명록.
 *
 * 행사 안내 페이지는 로그인 없이도 열리므로 목록은 누구나 읽고, 글쓰기만 로그인을 요구한다.
 * 한 사람이 글 하나를 쓰고 고치는 형태라 "등록 폼"과 "내 글"이 동시에 뜨지 않는다.
 */
export default function Guestbook() {
  const [state, setState] = useState({ entries: [], mine: null, signedIn: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const editorRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await api("/api/guestbook");
      setState(data);
      setLoadError("");
    } catch (err) {
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 수정 버튼을 누르면 입력칸으로 바로 초점을 옮겨, 어디를 고쳐야 하는지 헷갈리지 않게 한다.
  useEffect(() => {
    if (editing) editorRef.current?.focus();
  }, [editing]);

  const remaining = GUESTBOOK_MAX_LENGTH - draft.length;
  const canSave = normalizeGuestbookMessage(draft).length > 0 && draft.length <= GUESTBOOK_MAX_LENGTH;

  async function save(event) {
    event.preventDefault();
    if (!canSave || busy) return;
    setBusy(true);
    setError("");
    try {
      const mine = state.mine;
      await api("/api/guestbook", {
        method: mine ? "PATCH" : "POST",
        body: JSON.stringify(mine ? { id: mine.id, message: draft } : { message: draft }),
      });
      setDraft("");
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!state.mine || busy) return;
    if (!confirm("방명록을 지울까요? 되돌릴 수 없어요.")) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/guestbook", { method: "DELETE", body: JSON.stringify({ id: state.mine.id }) });
      setDraft("");
      setEditing(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit() {
    setDraft(state.mine?.message || "");
    setEditing(true);
    setError("");
  }

  function cancelEdit() {
    setDraft("");
    setEditing(false);
    setError("");
  }

  const writing = state.signedIn && (editing || !state.mine);

  return (
    <section className="guestbook" aria-labelledby="guestbook-title">
      <h2 id="guestbook-title" className="section-title">💌 방명록</h2>
      <p className="hint guestbook-lead">
        행사에 함께한 소감이나 크루원에게 남기고 싶은 인사를 적어주세요. 한 사람당 한 개씩 쓰고,
        언제든 고치거나 지울 수 있어요.
      </p>

      {!state.signedIn && !loading && (
        <p className="guestbook-signin">
          방명록은 <Link href="/">입장</Link> 후에 남길 수 있어요. 읽는 건 누구나 가능합니다.
        </p>
      )}

      {writing && (
        <form className="card guestbook-form" onSubmit={save}>
          <label htmlFor="guestbook-message">{state.mine ? "방명록 수정" : "방명록 남기기"}</label>
          <textarea
            id="guestbook-message"
            ref={editorRef}
            className="guestbook-textarea"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={GUESTBOOK_MAX_LENGTH}
            rows={4}
            placeholder="예) 오늘 같이 뛴 분들 덕분에 즐거웠어요!"
          />
          <div className="guestbook-form-foot">
            <span className={`guestbook-count ${remaining <= 20 ? "low" : ""}`}>
              {draft.length} / {GUESTBOOK_MAX_LENGTH}자
            </span>
            <div className="guestbook-form-actions">
              {editing && (
                <button type="button" className="btn ghost sm" onClick={cancelEdit} disabled={busy}>
                  취소
                </button>
              )}
              <button className="btn primary sm" disabled={!canSave || busy}>
                {busy ? "저장 중..." : state.mine ? "수정 완료" : "남기기"}
              </button>
            </div>
          </div>
          {error && <p className="error-msg" role="alert">{error}</p>}
        </form>
      )}

      {!writing && error && <p className="error-msg" role="alert">{error}</p>}

      {loading && <p className="hint">방명록을 불러오는 중...</p>}
      {loadError && <p className="hint guestbook-error">{loadError}</p>}

      {!loading && !loadError && state.entries.length === 0 && (
        <p className="hint guestbook-empty">아직 남겨진 글이 없어요. 첫 번째 인사를 남겨보세요!</p>
      )}

      {state.entries.length > 0 && (
        <ul className="guestbook-list">
          {state.entries.map((entry) => {
            const isMine = state.mine?.id === entry.id;
            return (
              <li key={entry.id} className={`card guestbook-item ${isMine ? "mine" : ""}`}>
                <div className="guestbook-item-head">
                  <strong>{entry.nickname}</strong>
                  {isMine && <span className="guestbook-badge">내 글</span>}
                  <time dateTime={entry.createdAt}>
                    {formatKoreanDateTime(entry.createdAt)}
                    {entry.updatedAt !== entry.createdAt && " (수정됨)"}
                  </time>
                </div>
                <p className="guestbook-message">{entry.message}</p>
                {isMine && !editing && (
                  <div className="guestbook-item-actions">
                    <button type="button" className="btn ghost sm" onClick={startEdit} disabled={busy}>
                      수정
                    </button>
                    <button type="button" className="btn danger sm" onClick={remove} disabled={busy}>
                      삭제
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
