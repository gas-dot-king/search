"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ItemsList from "@/components/ItemsList";
import { api, PRIVACY_WARNING, CATEGORY_RULE } from "@/lib/client";
import { useApiData, usePhoto, useUploadPeriod } from "@/lib/hooks";
import { getNearCompleteLines, LINES } from "@/lib/bingo";
import { downloadBoardImage } from "@/lib/boardImage";
import { todayGreetingMessage } from "@/lib/greeting";

/** 카테고리별 인증 사진 예시 안내 */
const PHOTO_EXAMPLES = {
  1: "예시: 러닝 앱 기록 화면 캡처(거리·시간이 보이게), 만보기·건강 앱 걸음 수 캡처 등",
  2: "예시: 시간이 보이는 러닝 앱 기록 캡처, 그 장소·풍경·랜드마크에서 찍은 사진 등",
  3: "예시: 함께 찍은 인증샷, 단톡방 댓글·플레이리스트 화면 캡처, 러닝화·물·음식 사진 등",
};

export default function BoardPage() {
  const router = useRouter();
  const { data: board, error: loadError, reload } = useApiData("/api/board");
  const period = useUploadPeriod();
  const photo = usePhoto();
  const [selected, setSelected] = useState(null); // 선택된 칸
  const [showItems, setShowItems] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [allItems, setAllItems] = useState(null);
  const [celebrate, setCelebrate] = useState(0);
  const [shareBusy, setShareBusy] = useState(false);
  const prevLines = useRef(null);
  const fileRef = useRef(null);

  // 빙고판이 아직 없으면 뽑기로
  useEffect(() => {
    if (board && board.cells.length === 0) router.replace("/draw");
  }, [board, router]);

  // 업로드/삭제 후 재로딩되면 열려 있는 칸에도 최신 사진을 반영한다.
  useEffect(() => {
    if (!selected || !board) return;
    const refreshed = board.cells.find((cell) => cell.position === selected.position);
    if (refreshed && refreshed !== selected) setSelected(refreshed);
  }, [board, selected]);

  // 줄 수가 늘어나면 축하 연출 (아래 효과가 이전 값 갱신)
  const lines = board?.lines;
  useEffect(() => {
    if (lines == null) return;
    if (prevLines.current != null && lines > prevLines.current) {
      setCelebrate(lines);
      const t = setTimeout(() => setCelebrate(0), 3500);
      return () => clearTimeout(t);
    }
  }, [lines]);
  useEffect(() => {
    if (lines != null) prevLines.current = lines;
  }, [lines]);

  function openCell(cell) {
    setSelected(cell);
    photo.clear();
  }

  function closeModal() {
    setSelected(null);
    photo.clear();
  }

  async function openItems() {
    setShowItems(true);
    if (!allItems) {
      try {
        const d = await api("/api/items");
        setAllItems(d.items);
      } catch {
        /* 목록 로드 실패 시 모달에 안내 표시 */
      }
    }
  }

  async function upload() {
    if (!photo.file || !selected) return;
    if (!period.loading && !period.open) return photo.setError(period.notice);
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
    if (!period.loading && !period.open) return photo.setError(period.notice);
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

  async function saveBoardImage() {
    if (!board) return;
    setShareBusy(true);
    try {
      await downloadBoardImage(board);
    } catch (err) {
      alert(err.message);
    } finally {
      setShareBusy(false);
    }
  }

  if (!board)
    return (
      <main className="wrap">
        <Nav />
        <p className="hint">{loadError || "불러오는 중..."}</p>
      </main>
    );

  // 기간 밖에는 빙고판·인증 사진을 보기만 하고 업로드·삭제는 막는다.
  const locked = !period.loading && !period.open;

  // 완성된 줄에 속한 칸들 (금색 하이라이트)
  const filledSet = new Set(board.cells.filter((c) => c.hasPhoto).map((c) => c.position));
  const lineCells = new Set(LINES.filter((l) => l.every((p) => filledSet.has(p))).flat());
  const nearCompleteLines = getNearCompleteLines(filledSet);

  return (
    <main className="wrap">
      <Nav />

      <p className="board-greeting">
        반가워요, {board.nickname}님! <span className="hint">{todayGreetingMessage()}</span>
      </p>

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

      {nearCompleteLines.length > 0 && (
        <div className="bingo-nudge" role="status">
          🎯 한 칸만 더 채우면 {nearCompleteLines.length}줄 빙고!
        </div>
      )}

      {locked && (
        <div className="period-lock" role="status">
          🔒 {period.notice}
        </div>
      )}

      <div className="bingo-grid">
        {board.cells.map((cell) => (
          <div
            key={cell.position}
            className={`cell cellcat${cell.category} ${cell.hasPhoto ? "done" : ""} ${lineCells.has(cell.position) ? "line-done" : ""}`}
            onClick={() => openCell(cell)}
          >
            {cell.photoUrl ? (
              <>
                <img src={cell.photoUrl} alt={cell.content} loading="lazy" decoding="async" />
                <span className="check">✓</span>
                <div className="overlay">{cell.content}</div>
              </>
            ) : cell.hasPhoto ? (
              <>
                <span className="cell-photo-pending" aria-label="인증 사진 불러오는 중" />
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

      <div className="stack" style={{ margin: "12px 0" }}>
        <button className="btn ghost wide" onClick={saveBoardImage} disabled={shareBusy}>
          {shareBusy ? "이미지 만드는 중..." : "내 빙고판 이미지 저장"}
        </button>
        <button className="btn primary xl" onClick={() => setShowExamples(true)}>
          📖 인증 예시 보기
        </button>
        <button className="btn ghost wide" onClick={openItems}>
          📋 빙고 항목 전체 보기
        </button>
      </div>

      <div className="rule-box">{CATEGORY_RULE}</div>

      <Footer />

      {/* 인증 예시 모달 */}
      {showExamples && (
        <div className="modal-bg" onClick={() => setShowExamples(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>📖 인증 예시</h3>
            <p className="hint" style={{ margin: "4px 0 8px" }}>
              하루 러닝(운동) 한 번으로는 <b>각 카테고리에서 1칸씩만</b> 채울 수 있어요.
            </p>

            <div className="diagram">
              <span className="d-top">🏃 하루 러닝 1번</span>
              <div className="d-arrow">↓</div>
              <div className="d-row">
                <div className="d-box b1">① 기록 달성<small>1칸만</small></div>
                <div className="d-box b2">② 시간·장소<small>1칸만</small></div>
                <div className="d-box b3">③ 소통·재미<small>1칸만</small></div>
              </div>
              <div className="d-note">= 하루 최대 3칸까지 OK!</div>
            </div>

            <div className="case">
              <span className="case-no">사례 1)</span> 6.2km를 42분 동안 달렸어요.
              <br />→ ①에서 2km·3km·5km·30분 달리기 <b>모두 해당하지만, 딱 1칸만</b> 선택!
              (보통 가장 높은 "5km 이상 달리기" 추천)
            </div>
            <div className="case">
              <span className="case-no">사례 2)</span> 토요일 저녁 7시에 부산에서 달렸어요.
              <br />→ ②에서 주말 러닝·저녁 러닝·양산이 아닌 곳 <b>모두 해당하지만, 딱 1칸만</b> 선택!
            </div>
            <div className="case">
              <span className="case-no">사례 3)</span> 일요일 아침 7시에 5km를 달리고, 크루원과 사진도 찍었어요.
              <br />→ ① "5km 이상 달리기" + ② "아침 러닝" + ③ "크루원과 인증사진" ={" "}
              <b>같은 날이어도 카테고리가 다르면 각각 인정, 하루 3칸 완성!</b>
              <br />다른 날 또 달리면 새 칸을 또 채울 수 있어요 🏃
            </div>

            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowExamples(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 전체 항목 모달 */}
      {showItems && (
        <div className="modal-bg" onClick={() => setShowItems(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>📋 빙고 항목 전체 보기 (24개)</h3>
            <p className="hint" style={{ margin: "4px 0 10px" }}>
              이 중에서 ① 4개 · ② 6개 · ③ 6개, 총 16개가 내 빙고판에 랜덤으로 뽑혔어요.
            </p>
            {allItems ? <ItemsList items={allItems} /> : <p className="hint">불러오는 중...</p>}
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setShowItems(false)}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 업로드 모달 */}
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
            {locked ? (
              <div className="period-lock" role="status">
                🔒 {period.notice}
              </div>
            ) : (
              <>
                <div className="rule-box" style={{ marginBottom: 6 }}>
                  📷 본인이 직접 올리는 인증이에요. <b>항목 내용이 잘 나타나는 사진이면 충분합니다!</b>
                  <br />
                  {PHOTO_EXAMPLES[selected.category]}
                </div>
                <div className="warn-box">{PRIVACY_WARNING}</div>
              </>
            )}

            {photo.preview ? (
              <img className="preview" src={photo.preview} alt="미리보기" />
            ) : selected.photoUrl ? (
              <img className="preview" src={selected.photoUrl} alt="인증 사진" />
            ) : null}

            <input ref={fileRef} type="file" accept="image/*" onChange={photo.pick} style={{ display: "none" }} />

            {photo.error && <p className="error-msg">{photo.error}</p>}

            {!locked && (
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
            )}
            <div className="modal-actions">
              {!locked && selected.photoUrl && !photo.file && (
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

      {/* 빙고 완성 축하 */}
      {celebrate > 0 && (
        <div className="celebrate-overlay" onClick={() => setCelebrate(0)}>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="confetti"
              style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 9) * 0.22}s` }}
            >
              {["🎉", "🎊", "✨", "🏃"][i % 4]}
            </span>
          ))}
          <div className="celebrate-box">
            <div className="celebrate-emoji">🎉</div>
            <div className="celebrate-text">{celebrate}줄 빙고 달성!</div>
            <p className="hint" style={{ marginTop: 6 }}>대단해요! 계속 달려봐요 🏃</p>
          </div>
        </div>
      )}
    </main>
  );
}
