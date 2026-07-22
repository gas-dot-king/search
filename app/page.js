"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, TOKEN_KEY } from "@/lib/client";

export default function EntryPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [nickname, setNickname] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 같은 기기 재방문 → 자동 입장
  useEffect(() => {
    if (!getToken()) {
      setChecking(false);
      return;
    }
    api("/api/me")
      .then((me) => router.replace(me.hasBoard ? "/board" : "/draw"))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setChecking(false);
      });
  }, [router]);

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
      router.replace(res.hasBoard ? "/board" : "/draw");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (checking) return <main className="wrap"><p className="hint">확인 중...</p></main>;

  return (
    <main className="wrap">
      <div style={{ textAlign: "center", margin: "48px 0 24px" }}>
        <div style={{ fontSize: "3rem" }}>🏃‍♀️🏃‍♂️</div>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 800 }}>러닝크루 온라인 위크</h1>
        <p className="hint" style={{ marginTop: 6 }}>
          8/1 ~ 8/13 · 빙고 인증 + 달리기 로또 🎰
        </p>
      </div>

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
