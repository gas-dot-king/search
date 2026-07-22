"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, getToken, CATEGORY_RULE } from "@/lib/client";

export default function DrawPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    // 이미 뽑았으면 빙고판으로
    api("/api/me")
      .then((me) => {
        if (me.hasBoard) router.replace("/board");
      })
      .catch(() => router.replace("/"));
  }, [router]);

  async function draw() {
    setBusy(true);
    setError("");
    try {
      await api("/api/draw", { method: "POST" });
      router.replace("/board?fresh=1");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <main className="wrap">
      <div style={{ textAlign: "center", margin: "56px 0 24px" }}>
        <div style={{ fontSize: "3.4rem" }}>🎲</div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, margin: "10px 0" }}>내 빙고 뽑기</h1>
        <p className="hint">
          24가지 인증 항목 중 카테고리별 5~6개, 총 16개가
          <br />
          랜덤으로 뽑혀 나만의 4×4 빙고판이 완성돼요.
        </p>
      </div>

      <div className="card">
        <div className="rule-box">
          📋 <b>카테고리</b>
          <br />① 러닝 기록·운동 달성 &nbsp;② 시간·장소·러닝 탐험 &nbsp;③ 크루 소통·재미
          <br />
          <br />
          {CATEGORY_RULE}
        </div>
        <div className="warn-box">한 번 뽑으면 바꿀 수 없어요! 신중하게... 는 무슨, 다 운입니다 🍀</div>
        {error && <p className="error-msg">{error}</p>}
        <button className="btn primary" onClick={draw} disabled={busy} style={{ marginTop: 8 }}>
          {busy ? "뽑는 중..." : "빙고 뽑기 🎲"}
        </button>
      </div>
    </main>
  );
}
