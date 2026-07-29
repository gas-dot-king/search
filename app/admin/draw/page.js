"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { adminApi, adminPost, adminPw } from "@/lib/adminClient";
import { LOTTO_DRAW_DIGITS } from "@/lib/lotto";

const SLOT_LABELS = ["1의 자리", "소수점 첫째 자리", "소수점 둘째 자리"];

// 릴은 0~9를 여러 바퀴 늘어놓고, 마지막 바퀴의 해당 숫자에서 멈춘다.
const REEL_CYCLES = 6;
const REEL_LENGTH = (REEL_CYCLES + 1) * 10;
const REEL = Array.from({ length: REEL_LENGTH }, (_, index) => index % 10);
const restIndex = (digit) => REEL_CYCLES * 10 + digit;
const SPIN_MS = 2600;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// 시작 위치를 화면에 한 번 그린 뒤에 애니메이션을 걸어야 릴이 튀지 않는다.
// 다른 탭에 가 있으면 rAF가 멈추므로, 버튼이 "뽑는 중"에서 굳지 않도록 시간 제한을 둔다.
const nextFrame = () =>
  Promise.race([
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    wait(200),
  ]);
const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function DrawSlot({ label, slot, digit, state, onDraw, onSettled }) {
  const [index, setIndex] = useState(() => (digit === null ? null : restIndex(digit)));
  const [duration, setDuration] = useState(0);
  const [rolling, setRolling] = useState(false);

  async function spin() {
    setRolling(true);
    try {
      const drawn = await onDraw();
      if (drawn === null) return;

      // 릴을 맨 위로 되돌린 뒤(애니메이션 없이) 결과 위치까지 한 번에 감속하며 굴린다.
      setDuration(0);
      setIndex(0);
      await nextFrame();

      const ms = prefersReducedMotion() ? 0 : SPIN_MS;
      setDuration(ms);
      setIndex(restIndex(drawn));
      if (ms) await wait(ms);
      // 릴이 멈춘 뒤에 1등 여부를 공개해야 김이 새지 않는다.
      onSettled();
    } finally {
      setRolling(false);
    }
  }

  const busy = rolling || state === "waiting";

  return (
    <article className={`draw-slot ${state} ${rolling ? "rolling" : ""}`}>
      <p className="draw-slot-label">{label}</p>

      <div className="draw-slot-window" aria-live="polite" aria-label={`${label} 추첨 결과`}>
        {index === null ? (
          <span className="draw-slot-placeholder">?</span>
        ) : (
          <div
            className="draw-reel"
            style={{
              transform: `translateY(calc(-100% * ${index} / ${REEL_LENGTH}))`,
              transitionDuration: `${duration}ms`,
            }}
          >
            {REEL.map((value, reelIndex) => (
              <span key={reelIndex} aria-hidden={reelIndex !== index}>{value}</span>
            ))}
          </div>
        )}
      </div>

      {state === "done" && !rolling ? (
        <p className="draw-slot-status">확정</p>
      ) : (
        <button
          type="button"
          className="btn primary draw-slot-button"
          onClick={spin}
          disabled={busy || state !== "next"}
        >
          {rolling ? "뽑는 중..." : state === "next" ? `${slot + 1}번째 뽑기` : "대기"}
        </button>
      )}
    </article>
  );
}

export default function AdminDrawPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [state, setState] = useState(null); // { digits, round, pastRounds, complete, winners, entryCount }
  const [revealed, setRevealed] = useState(false);
  const [reelKey, setReelKey] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await adminApi("/api/admin?action=lotto_round");
    setState(data);
    // 새로고침으로 들어왔다면 이미 끝난 차수라 바로 결과를 보여준다.
    setRevealed(data.complete);
    setAuthed(true);
  }, []);

  useEffect(() => {
    // 관리자 비밀번호는 메모리에만 있어서, 새로고침·직접 접속이면 여기서 다시 받는다.
    if (!adminPw.get()) {
      setLoading(false);
      return;
    }
    load()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [load]);

  async function login(event) {
    event.preventDefault();
    adminPw.set(pw);
    setError("");
    try {
      await load();
    } catch (err) {
      adminPw.clear();
      setError(err.status === 401 ? "비밀번호가 틀렸습니다." : err.message);
    }
  }

  /** 서버가 뽑은 숫자를 돌려준다. 실패하면 null — 릴은 그대로 둔다. */
  async function drawDigit(slot) {
    setError("");
    setBusy(true);
    try {
      const result = await adminPost({ action: "draw_numbers" });
      const next = String(result.digits || "");
      // 마지막 자리면 1등 여부까지 담겨 오지만, 공개는 릴이 멈춘 뒤에 한다.
      setState((current) => ({ ...current, ...result, digits: next }));
      return next.length > slot ? Number(next[slot]) : null;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  /** 1등이 없을 때 다음 차수 시작 — 지난 번호는 기록으로 남는다 */
  async function nextRound() {
    setError("");
    setBusy(true);
    try {
      const result = await adminPost({ action: "next_lotto_round" });
      setState((current) => ({ ...current, ...result }));
      setRevealed(false);
      setReelKey((current) => current + 1); // 릴을 물음표 상태로 되돌린다
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function resetDraw() {
    if (!confirm("1차부터 전부 다시 할까요? 지난 차수 기록과 회원들에게 보이던 번호가 모두 사라집니다.")) return;
    setError("");
    setBusy(true);
    try {
      const result = await adminPost({ action: "reset_draw" });
      setState((current) => ({ ...current, ...result }));
      setRevealed(false);
      setReelKey((current) => current + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="wrap">
        <p className="hint" style={{ marginTop: 24 }}>불러오는 중...</p>
      </main>
    );
  }

  if (!authed) {
    return (
      <main className="wrap">
        <h1 className="section-title" style={{ marginTop: 24 }}>🎰 무작위 번호 추첨</h1>
        <form className="card" onSubmit={login}>
          <label htmlFor="draw-admin-pw">관리자 비밀번호</label>
          <input
            id="draw-admin-pw"
            type="password"
            value={pw}
            onChange={(event) => setPw(event.target.value)}
            required
          />
          {error && <p className="error-msg">{error}</p>}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn primary">입장</button>
            <Link className="btn ghost" href="/admin">관리자로</Link>
          </div>
        </form>
      </main>
    );
  }

  const digits = state?.digits || "";
  const pastRounds = state?.pastRounds || [];
  const round = state?.round || 1;
  const complete = digits.length === LOTTO_DRAW_DIGITS;
  const winners = state?.winners || [];
  // 릴이 멈춘 뒤에야 1등 여부를 공개한다.
  const showResult = complete && revealed;

  return (
    <main className="wrap draw-stage">
      <div className="draw-stage-top">
        <Link className="btn ghost sm" href="/admin">← 관리자</Link>
        {(digits.length > 0 || pastRounds.length > 0) && (
          <button type="button" className="btn danger sm" onClick={resetDraw} disabled={busy}>
            처음부터 다시
          </button>
        )}
      </div>

      <header className="draw-stage-head">
        <p className="draw-stage-kicker">YSRC SUMMER FEST 2026</p>
        <h1 className="draw-stage-title">🎰 달리기 로또 {round}차 추첨</h1>
        <p className="hint">
          왼쪽부터 한 자리씩 뽑아요. 뽑은 숫자는 저장되어 회원 화면에도 바로 공개됩니다.
          {state?.entryCount === 0 && " (아직 응모가 없어 1등도 나올 수 없어요)"}
        </p>
      </header>

      {pastRounds.length > 0 && (
        <ul className="draw-past" aria-label="지난 차수 결과">
          {pastRounds.map((numbers, index) => (
            <li key={`${index}-${numbers}`}>
              <b>{index + 1}차</b> {numbers[0]}.{numbers.slice(1)} · 1등 없음
            </li>
          ))}
        </ul>
      )}

      {error && <p className="error-msg draw-stage-error">{error}</p>}

      <div className="draw-slots">
        {SLOT_LABELS.map((label, slot) => (
          <DrawSlot
            key={`${reelKey}-${slot}`}
            slot={slot}
            label={label}
            digit={slot < digits.length ? Number(digits[slot]) : null}
            state={slot < digits.length ? "done" : slot === digits.length ? "next" : "waiting"}
            onDraw={() => drawDigit(slot)}
            onSettled={() => setRevealed(true)}
          />
        ))}
      </div>

      <section className={`draw-result ${showResult ? "complete" : ""}`} aria-live="polite">
        {!complete && (
          <p className="hint">
            {digits.length === 0
              ? `${round}차 추첨을 시작해주세요.`
              : `${digits.length}자리 공개 · ${LOTTO_DRAW_DIGITS - digits.length}자리 남음`}
          </p>
        )}

        {complete && !revealed && <p className="hint">릴이 멈추면 결과가 나와요...</p>}

        {showResult && (
          <>
            <p>{round}차 당첨 기록</p>
            <strong>{digits[0]}.{digits.slice(1)} km</strong>

            {winners.length > 0 ? (
              <div className="draw-winners">
                <p className="draw-winners-title">🎉 1등 {winners.length}명</p>
                <ul>
                  {winners.map((winner) => (
                    <li key={winner.nickname}>
                      <b>{winner.nickname}</b>
                      <span>{winner.digits.slice(0, 2)}.{winner.digits.slice(2)}km</span>
                    </li>
                  ))}
                </ul>
                <p className="hint">추첨이 끝났어요. 회원 화면에도 이 번호로 결과가 나갑니다.</p>
              </div>
            ) : (
              <div className="draw-no-winner">
                <p className="draw-no-winner-title">1등이 없어요</p>
                <p className="hint">
                  응모 {state?.entryCount || 0}장 중 세 자리를 모두 맞춘 사람이 없습니다.
                  다음 차수로 넘어가면 이 번호는 기록으로 남고 처음부터 다시 뽑아요.
                </p>
                <button type="button" className="btn primary" onClick={nextRound} disabled={busy}>
                  {round + 1}차 추첨 시작하기
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
