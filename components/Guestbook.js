"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { GUESTBOOK_MAX_LENGTH, normalizeGuestbookMessage } from "@/lib/guestbook";
import { formatKoreanDateTime } from "@/lib/period";

const isWritable = (text) =>
  normalizeGuestbookMessage(text).length > 0 && text.length <= GUESTBOOK_MAX_LENGTH;

/** 남은 글자 수를 알려주는 입력칸. 새 글과 수정이 같은 모양을 쓰도록 묶어 뒀다. */
function MessageField({ id, value, onChange, inputRef, placeholder }) {
  return (
    <>
      <textarea
        id={id}
        ref={inputRef}
        className="guestbook-textarea"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={GUESTBOOK_MAX_LENGTH}
        rows={4}
        placeholder={placeholder}
      />
      <span className={`guestbook-count ${GUESTBOOK_MAX_LENGTH - value.length <= 20 ? "low" : ""}`}>
        {value.length} / {GUESTBOOK_MAX_LENGTH}자
      </span>
    </>
  );
}

/**
 * 오프라인 행사 방명록.
 *
 * 행사 안내 페이지는 로그인 없이도 열리므로 목록은 누구나 읽고, 글쓰기만 로그인을 요구한다.
 * 여러 개 남길 수 있고, 자기 글은 목록에서 바로 고치거나 지운다.
 */
export default function Guestbook() {
  const [state, setState] = useState({ entries: [], signedIn: false, myCount: 0, maxPerUser: 0 });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [editError, setEditError] = useState("");
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

  // 수정 버튼을 누르면 입력칸으로 초점을 옮겨, 어디를 고쳐야 하는지 헷갈리지 않게 한다.
  useEffect(() => {
    if (editingId) editorRef.current?.focus();
  }, [editingId]);

  async function create(event) {
    event.preventDefault();
    if (!isWritable(draft) || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/guestbook", { method: "POST", body: JSON.stringify({ message: draft }) });
      setDraft("");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (!isWritable(editDraft) || busy) return;
    setBusy(true);
    setEditError("");
    try {
      await api("/api/guestbook", {
        method: "PATCH",
        body: JSON.stringify({ id: editingId, message: editDraft }),
      });
      setEditingId(null);
      setEditDraft("");
      await load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry) {
    if (busy) return;
    if (!confirm("이 방명록을 지울까요? 되돌릴 수 없어요.")) return;
    setBusy(true);
    setEditError("");
    try {
      await api("/api/guestbook", { method: "DELETE", body: JSON.stringify({ id: entry.id }) });
      if (editingId === entry.id) setEditingId(null);
      await load();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(entry) {
    setEditingId(entry.id);
    setEditDraft(entry.message);
    setEditError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft("");
    setEditError("");
  }

  const full = state.maxPerUser > 0 && state.myCount >= state.maxPerUser;

  return (
    <section className="guestbook" aria-labelledby="guestbook-title">
      <h2 id="guestbook-title" className="section-title">💌 방명록</h2>
      <p className="hint guestbook-lead">
        행사에 함께한 소감이나 크루원에게 남기고 싶은 인사를 적어주세요. 여러 개 남길 수 있고,
        내가 쓴 글은 언제든 고치거나 지울 수 있어요.
      </p>

      {!state.signedIn && !loading && (
        <p className="guestbook-signin">
          방명록은 <Link href="/">입장</Link> 후에 남길 수 있어요. 읽는 건 누구나 가능합니다.
        </p>
      )}

      {state.signedIn && !full && (
        <form className="card guestbook-form" onSubmit={create}>
          <label htmlFor="guestbook-message">방명록 남기기</label>
          <MessageField
            id="guestbook-message"
            value={draft}
            onChange={setDraft}
            placeholder="예) 오늘 같이 뛴 분들 덕분에 즐거웠어요!"
          />
          <div className="guestbook-form-foot">
            {state.myCount > 0 && (
              <span className="hint">
                내가 쓴 글 {state.myCount} / {state.maxPerUser}개
              </span>
            )}
            <button className="btn primary sm" disabled={!isWritable(draft) || busy}>
              {busy ? "저장 중..." : "남기기"}
            </button>
          </div>
          {error && <p className="error-msg" role="alert">{error}</p>}
        </form>
      )}

      {state.signedIn && full && (
        <p className="guestbook-signin">
          방명록을 {state.maxPerUser}개까지 남기셨어요. 더 쓰려면 이전 글을 수정하거나 지워주세요.
        </p>
      )}

      {loading && <p className="hint">방명록을 불러오는 중...</p>}
      {loadError && <p className="hint guestbook-error">{loadError}</p>}

      {!loading && !loadError && state.entries.length === 0 && (
        <p className="hint guestbook-empty">아직 남겨진 글이 없어요. 첫 번째 인사를 남겨보세요!</p>
      )}

      {state.entries.length > 0 && (
        <ul className="guestbook-list">
          {state.entries.map((entry) => (
            <li key={entry.id} className={`card guestbook-item ${entry.mine ? "mine" : ""}`}>
              <div className="guestbook-item-head">
                <strong>{entry.nickname}</strong>
                {entry.mine && <span className="guestbook-badge">내 글</span>}
                <time dateTime={entry.createdAt}>
                  {formatKoreanDateTime(entry.createdAt)}
                  {entry.updatedAt !== entry.createdAt && " (수정됨)"}
                </time>
              </div>

              {editingId === entry.id ? (
                <form className="guestbook-edit" onSubmit={saveEdit}>
                  <MessageField
                    id={`guestbook-edit-${entry.id}`}
                    value={editDraft}
                    onChange={setEditDraft}
                    inputRef={editorRef}
                  />
                  <div className="guestbook-item-actions">
                    <button type="button" className="btn ghost sm" onClick={cancelEdit} disabled={busy}>
                      취소
                    </button>
                    <button className="btn primary sm" disabled={!isWritable(editDraft) || busy}>
                      {busy ? "저장 중..." : "수정 완료"}
                    </button>
                  </div>
                  {editError && <p className="error-msg" role="alert">{editError}</p>}
                </form>
              ) : (
                <>
                  <p className="guestbook-message">{entry.message}</p>
                  {entry.mine && (
                    <div className="guestbook-item-actions">
                      <button type="button" className="btn ghost sm" onClick={() => startEdit(entry)} disabled={busy}>
                        수정
                      </button>
                      <button type="button" className="btn danger sm" onClick={() => remove(entry)} disabled={busy}>
                        삭제
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!editingId && editError && <p className="error-msg" role="alert">{editError}</p>}
    </section>
  );
}
