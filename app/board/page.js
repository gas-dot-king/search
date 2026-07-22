"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import { api, PRIVACY_WARNING, CATEGORY_RULE } from "@/lib/client";
import { useApiData, usePhoto } from "@/lib/hooks";

function BoardInner() {
  const router = useRouter();
  const fresh = useSearchParams().get("fresh") === "1";
  const { data: board, error: loadError, reload } = useApiData("/api/board");
  const photo = usePhoto();
  const [selected, setSelected] = useState(null); // 선택된 칸
  const fileRef = useRef(null);

  // 빙고판이 아직 없으면 뽑기로
  useEffect(() => {
    if (board && board.cells.length === 0) router.replace("/draw");
  }, [board, router]);

  function openCell(cell) {
    setSelected(cell);
    photo.clear();
  }

  function closeModal() {
    setSelected(null);
    photo.clear();
  }

  async function upload() {
    if (!photo.file || !selected) return;
    photo.setBusy(true);
    photo.setError("");
    try {
      const form = new FormData();
      form.append("position", String(selected.position));
      form.append("file", photo.file, "photo.jpg");
      await api("/api/upload", { method: "POST", body: form });
      closeModal();
      await reload();
    } catch (err) {
      photo.setError(err.message);
    } finally {
      photo.setBusy(false);
    }
  }

  async function removePhoto() {
    if (!selected) return;
    if (!confirm("이 칸의 사진을 삭제할까요?")) return;
    photo.setBusy(true);
    try {
      await api("/api/upload", {
        method: "DELETE",
        body: JSON.stringify({ position: selected.position }),
      });
      closeModal();
      await reload();
    } catch (err) {
      photo.setError(err.message);
    } finally {
      photo.setBusy(false);
    }
  }

  if (!board)
    return (
      <main className="wrap">
        <Nav />
        <p className="hint">{loadError || "불러오는 중..."}</p>
      </main>
    );

  return (
    <main className="wrap">
      <Nav />

      <div className="stats">
        <div className="stat">
          <b>
            {board.filled}
            <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>/16</span>
          </b>
          <span>채운 칸</span>
        </div>
        <div className="stat">
          <b>{board.lines}</b>
          <span>빙고 줄</span>
        </div>
      </div>

      {board.lines > 0 && <div className="notice-bar">🎉 현재 {board.lines}줄 빙고! 계속 달려봐요!</div>}

      <div className="bingo-grid">
        {board.cells.map((cell, i) => (
          <div
            key={cell.position}
            className={`cell ${cell.photoUrl ? "done" : ""} ${fresh ? "reveal" : ""}`}
            style={fresh ? { animationDelay: `${i * 0.05}s` } : undefined}
            onClick={() => openCell(cell)}
          >
            {cell.photoUrl ? (
              <>
                <img src={cell.photoUrl} alt={cell.content} />
                <span className="check">✓</span>
                <div className="overlay">{cell.content}</div>
              </>
            ) : (
              <>
                <span className={`catdot cat${cell.category}`} />
                <span className="txt">{cell.content}</span>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="legend">
        <span><i className="cat1" />기록 달성</span>
        <span><i className="cat2" />시간·장소 탐험</span>
        <span><i className="cat3" />크루 소통·재미</span>
      </div>

      <div className="rule-box">{CATEGORY_RULE}</div>

      {selected && (
        <div className="modal-bg" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>
              <span
                className={`catdot cat${selected.category}`}
                style={{ position: "static", display: "inline-block", marginRight: 6 }}
              />
              {selected.content}
            </h3>
            <div className="warn-box">{PRIVACY_WARNING}</div>

            {photo.preview ? (
              <img className="preview" src={photo.preview} alt="미리보기" />
            ) : selected.photoUrl ? (
              <img className="preview" src={selected.photoUrl} alt="인증 사진" />
            ) : null}

            <input ref={fileRef} type="file" accept="image/*" onChange={photo.pick} style={{ display: "none" }} />

            {photo.error && <p className="error-msg">{photo.error}</p>}

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={photo.busy}>
                {selected.photoUrl || photo.preview ? "사진 다시 선택" : "사진 선택"}
              </button>
              {photo.file && (
                <button className="btn primary" onClick={upload} disabled={photo.busy}>
                  {photo.busy ? "올리는 중..." : "인증 완료!"}
                </button>
              )}
            </div>
            <div className="modal-actions">
              {selected.photoUrl && !photo.file && (
                <button className="btn danger" onClick={removePhoto} disabled={photo.busy}>
                  사진 삭제
                </button>
              )}
              <button className="btn ghost" onClick={closeModal} disabled={photo.busy}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function BoardPage() {
  return (
    <Suspense>
      <BoardInner />
    </Suspense>
  );
}
