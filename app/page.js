"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearToken, getToken, takeSessionLost, TOKEN_KEY } from "@/lib/client";
import { prefetchApiData } from "@/lib/hooks";

function deadlineText(uploadEnd) {
  if (!uploadEnd) return "마감일을 확인하고 있어요";
  const diff = new Date(uploadEnd) - new Date();
  if (diff < 0) return "온라인 위크가 마감되었어요";
  const days = Math.floor(diff / 86400000);
  return days === 0 ? "오늘 마감입니다" : `마감까지 ${days}일`;
}

export default function EntryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uploadEnd, setUploadEnd] = useState("");
  const [sessionLost, setSessionLost] = useState(false);
  const [unreachable, setUnreachable] = useState(false);
  const [retry, setRetry] = useState(0);

  // 다른 화면에서 401로 밀려났다면 그 사실을 넘겨받아 이유를 알려준다.
  useEffect(() => {
    if (takeSessionLost()) setSessionLost(true);
  }, []);

  // 같은 기기 재방문 → 자동 입장
  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    setUnreachable(false);
    api("/api/me")
      .then((me) => {
        if (cancelled) return;
        // 이동할 페이지의 데이터를 미리 받아 두면 도착 즉시 화면이 뜬다.
        if (me.hasBoard) prefetchApiData("/api/board").catch(() => {});
        router.replace(me.hasBoard ? "/board" : "/draw");
      })
      .catch((err) => {
        if (cancelled) return;
        // 서버가 토큰을 거부한 401일 때만 지운다. 통신이 잠깐 끊긴 것만으로
        // 토큰을 버리면 지하철에서 앱을 여는 것만으로 로그아웃된다.
        if (err?.status === 401) {
          clearToken();
          setSessionLost(true);
        } else {
          setUnreachable(true);
        }
        setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [router, retry]);

  useEffect(() => {
    fetch("/api/config")
      .then((response) => response.ok && response.json())
      .then((config) => config?.uploadEnd && setUploadEnd(config.uploadEnd))
      .catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api("/api/auth", {
        method: "POST",
        body: JSON.stringify({ nickname, pin }),
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      if (res.hasBoard) prefetchApiData("/api/board").catch(() => {});
      router.replace(res.hasBoard ? "/board" : "/draw");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (checking) return <main className="wrap"><p className="hint">확인 중...</p></main>;

  return (
    <main className="wrap">
      <div className="landing-head">
        <img className="landing-logo" src="/YSRC_logo_black.png" alt="YSRC" width="592" height="174" />
        <h1 className="landing-title">SUMMER FEST <span>2026</span></h1>
        <p className="landing-subtitle">온라인 위크 이벤트</p>
        <p className="landing-countdown">{deadlineText(uploadEnd)}</p>
        <p className="hint">빙고 인증과 달리기 로또를 함께 즐겨요.</p>
      </div>

      {sessionLost && (
        <p className="session-lost-notice" role="status">
          🔓 다른 기기에서 로그인해 이 기기는 로그아웃되었어요.
          <small>한 계정은 기기 한 곳에서만 로그인할 수 있어요. 다시 입장해주세요.</small>
        </p>
      )}

      {unreachable && (
        <div className="entry-retry-notice" role="status">
          <p>
            📡 연결이 불안정해 자동 입장에 실패했어요.
            <small>로그인은 그대로 남아 있어요. 신호가 잡히면 다시 시도해주세요.</small>
          </p>
          <button type="button" className="btn ghost sm" onClick={() => setRetry((n) => n + 1)}>
            다시 시도
          </button>
        </div>
      )}

      <form className="card" onSubmit={submit}>
        <label htmlFor="nickname">닉네임</label>
        <input
          id="nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="단톡방에서 쓰는 닉네임"
          maxLength={12}
          required
        />
        <label htmlFor="pin">비밀번호 (숫자 4자리)</label>
        <input
          id="pin"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="0000"
          inputMode="numeric"
          pattern="\d{4}"
          type="password"
          required
        />
        <p className="hint" style={{ marginTop: 8 }}>
          처음이면 이 닉네임과 비밀번호로 바로 가입돼요. 다음부터는 같은 기기에서 자동 입장!
        </p>
        {error && <p className="error-msg">{error}</p>}
        <div style={{ marginTop: 16 }}>
          <button className="btn primary" disabled={busy || pin.length !== 4}>
            {busy ? "입장 중..." : "입장하기"}
          </button>
        </div>
      </form>
    </main>
  );
}
