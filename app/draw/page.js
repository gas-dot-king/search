"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken } from "@/lib/client";
import { prefetchApiData } from "@/lib/hooks";
import SettingsLink from "@/components/SettingsLink";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CATEGORIES = [
  { cat: 1, name: "① 러닝 기록·운동 달성", count: 4, cls: "g1" },
  { cat: 2, name: "② 시간·장소·러닝 탐험", count: 6, cls: "g2" },
  { cat: 3, name: "③ 크루 소통·재미 인증", count: 6, cls: "g3" },
];

export default function DrawPage() {
  const router = useRouter();
  const [phase, setPhase] = useState("intro"); // intro → rolling → result
  const [board, setBoard] = useState(null);
  const [redrawUsed, setRedrawUsed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    // 이미 확정된 빙고판이 있으면 빙고판으로
    api("/api/me")
      .then((me) => {
        if (me.hasBoard) router.replace("/board");
      })
      .catch(() => router.replace("/"));
  }, [router]);

  async function makeBoard(redraw = false) {
    setError("");
    setPhase("rolling");
    const t0 = Date.now();
    try {
      const { board: b } = await api("/api/draw", { method: "POST", body: JSON.stringify({ redraw }) });
      await sleep(Math.max(0, 1600 - (Date.now() - t0))); // 두구두구 최소 연출 시간
      // 실제로 다시 뽑기가 성공했을 때만 기회를 소진 처리한다.
      // (네트워크 오류 등으로 실패하면 버튼을 유지하고, 최종 판정은 서버가 한다.)
      if (redraw) setRedrawUsed(true);
      setBoard(b);
      setPhase("result");
      // 확정 후 이동할 빙고판 데이터를 미리 받아 둔다.
      prefetchApiData("/api/board", { force: true }).catch(() => {});
    } catch (err) {
      setError(err.message);
      setPhase(redraw ? "result" : "intro");
    }
  }

  function redraw() {
    if (
      !confirm(
        "정말 다시 뽑을까요?\n\n지금 빙고판으로는 다시 돌아올 수 없고,\n새로 나온 빙고판으로 바로 확정됩니다!"
      )
    )
      return;
    makeBoard(true);
  }

  /* ---------- 1단계: 설명 ---------- */
  if (phase === "intro")
    return (
      <main className="wrap">
        <div className="draw-topbar"><SettingsLink /></div>
        <div className="page-head">
          <div className="emoji">🎲</div>
          <h1 className="page-title">내 빙고 만들기</h1>
          <p className="hint">
            세 카테고리에서 각각 랜덤으로 뽑아
            <br />
            나만의 4×4 빙고판 16칸을 만들어요.
          </p>
        </div>

        <div className="card">
          {CATEGORIES.map((c) => (
            <div key={c.cat} className={`items-group ${c.cls}`} style={{ display: "flex", alignItems: "center" }}>
              <p className="g-title" style={{ margin: 0, flex: 1 }}>{c.name}</p>
              <b style={{ fontSize: "1.05rem" }}>{c.count}칸</b>
            </div>
          ))}
          <p style={{ textAlign: "center", fontWeight: 800, margin: "4px 0 10px" }}>
            = 총 16칸이 랜덤으로 완성! 🍀
          </p>
          <div className="warn-box">
            뽑은 빙고판이 마음에 안 들면 <b>딱 한 번</b> 다시 뽑을 수 있어요.
            <br />단, 다시 뽑으면 이전 판으로 돌아올 수 없고 새 판으로 바로 확정!
          </div>
          {error && <p className="error-msg">{error}</p>}
          <button className="btn primary xl" onClick={() => makeBoard(false)} style={{ marginTop: 8 }}>
            빙고 만들기! 🎲
          </button>
        </div>

      </main>
    );

  /* ---------- 2단계: 뽑는 중 애니메이션 ---------- */
  if (phase === "rolling")
    return (
      <main className="wrap">
        <div className="draw-topbar"><SettingsLink /></div>
        <div className="page-head">
          <div className="emoji">🥁</div>
          <h1 className="page-title">두구두구두구...</h1>
          <p className="hint">빙고판을 뽑고 있어요!</p>
        </div>
        <div className="bingo-grid">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="cell rolling" style={{ animationDelay: `${(i % 5) * 0.12}s` }}>
              <span style={{ fontSize: "1.6rem" }}>🎲</span>
            </div>
          ))}
        </div>
      </main>
    );

  /* ---------- 3단계: 결과 + 재도전/확정 ---------- */
  return (
    <main className="wrap">
      <div className="draw-topbar"><SettingsLink /></div>
      <div className="page-head" style={{ margin: "28px 0 14px" }}>
        <h1 className="page-title">🎉 빙고판 완성!</h1>
        <p className="hint">{redrawUsed ? "다시 뽑기까지 마친 최종 빙고판이에요." : "이 빙고판으로 시작할까요?"}</p>
      </div>

      {board && (
        <div className="bingo-grid" style={{ marginBottom: 14 }}>
          {board.cells.map((cell, i) => (
            <div
              key={cell.position}
              className={`cell cellcat${cell.category} reveal`}
              style={{ animationDelay: `${i * 0.06}s`, cursor: "default" }}
            >
              <span className={`catdot cat${cell.category}`} />
              <span className="txt">{cell.content}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="error-msg" style={{ marginBottom: 8 }}>{error}</p>}

      {redrawUsed ? (
        <div className="rule-box">✅ 다시 뽑기 기회를 사용했어요. 이 빙고판으로 확정되었습니다!</div>
      ) : (
        <div className="warn-box">
          마음에 안 드나요? <b>딱 한 번</b> 다시 뽑을 수 있어요.
          <br />다시 뽑으면 지금 판으로는 <b>못 돌아오고, 새 판으로 강제 확정</b>됩니다!
        </div>
      )}

      <div className="stack">
        <button className="btn primary xl" onClick={() => router.replace("/board")}>
          ✅ 이 빙고판으로 시작하기
        </button>
        {!redrawUsed && (
          <button className="btn ghost wide" onClick={redraw}>
            🔁 딱 한 번 더 뽑기 (되돌리기 불가)
          </button>
        )}
      </div>

    </main>
  );
}
