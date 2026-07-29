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

function DrawSlot({ label, slot, digit, state, onDraw }) {
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
  const [digits, setDigits] = useState("");
  const [round, setRound] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await adminApi("/api/admin?action=overview");
    setDigits(data.settings?.winning_numbers || "");
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
      setDigits(next);
      return next.length > slot ? Number(next[slot]) : null;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!confirm("추첨을 처음부터 다시 할까요? 회원들에게 보이던 번호가 사라집니다.")) return;
    setError("");
    setBusy(true);
    try {
      await adminPost({ action: "set_setting", key: "winning_numbers", value: "" });
      setDigits("");
      setRound((current) => current + 1); // 릴을 물음표 상태로 되돌린다
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

  const complete = digits.length === LOTTO_DRAW_DIGITS;

  return (
    <main className="wrap draw-stage">
      <div className="draw-stage-top">
        <Link className="btn ghost sm" href="/admin">← 관리자</Link>
        {digits.length > 0 && (
          <button type="button" className="btn danger sm" onClick={reset} disabled={busy}>
            다시 추첨
          </button>
        )}
      </div>

      <header className="draw-stage-head">
        <p className="draw-stage-kicker">YSRC SUMMER FEST 2026</p>
        <h1 className="draw-stage-title">🎰 달리기 로또 추첨</h1>
        <p className="hint">
          왼쪽부터 한 자리씩 뽑아요. 뽑은 숫자는 저장되어 회원 화면에도 바로 공개됩니다.
        </p>
      </header>

      {error && <p className="error-msg draw-stage-error">{error}</p>}

      <div className="draw-slots">
        {SLOT_LABELS.map((label, slot) => (
          <DrawSlot
            key={`${round}-${slot}`}
            slot={slot}
            label={label}
            digit={slot < digits.length ? Number(digits[slot]) : null}
            state={slot < digits.length ? "done" : slot === digits.length ? "next" : "waiting"}
            onDraw={() => drawDigit(slot)}
          />
        ))}
      </div>

      <section className={`draw-result ${complete ? "complete" : ""}`} aria-live="polite">
        {complete ? (
          <>
            <p>당첨 기록</p>
            <strong>{digits[0]}.{digits.slice(1)} km</strong>
            <span className="hint">세 자리가 모두 같은 응모가 1등이에요.</span>
          </>
        ) : (
          <p className="hint">
            {digits.length === 0
              ? "아직 뽑은 숫자가 없어요."
              : `${digits.length}자리 공개 · ${LOTTO_DRAW_DIGITS - digits.length}자리 남음`}
          </p>
        )}
      </section>
    </main>
  );
}
