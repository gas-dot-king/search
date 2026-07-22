"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { api, getToken } from "@/lib/client";

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  return `${Math.floor(hr / 24)}일 전`;
}

export default function FeedPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    api("/api/feed")
      .then(setData)
      .catch((err) => {
        if (err.status === 401) router.replace("/");
        else setError(err.message);
      });
  }, [router]);

  if (!data)
    return (
      <main className="wrap">
        <Nav />
        <p className="hint">{error || "불러오는 중..."}</p>
      </main>
    );

  return (
    <main className="wrap">
      <Nav />
      <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "8px 0" }}>📊 크루 현황</h2>

      <div className="card">
        <p style={{ fontWeight: 700, marginBottom: 8 }}>진행률 랭킹</p>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>닉네임</th>
              <th className="num">빙고 칸</th>
              <th className="num">줄</th>
              <th className="num">로또</th>
            </tr>
          </thead>
          <tbody>
            {data.rankings.map((r, i) => (
              <tr key={r.nickname}>
                <td>{i < 3 && r.filled > 0 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td>
                <td>{r.nickname}</td>
                <td className="num">{r.filled}/16</td>
                <td className="num"><b style={{ color: r.lines ? "var(--accent)" : undefined }}>{r.lines}</b></td>
                <td className="num">{r.lottoEntries}장</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>사진은 본인과 운영진만 볼 수 있어요.</p>
      </div>

      <div className="card">
        <p style={{ fontWeight: 700, marginBottom: 4 }}>최근 활동</p>
        {data.activity.length === 0 && <p className="hint">아직 활동이 없어요. 첫 인증의 주인공이 되어보세요!</p>}
        {data.activity.map((a, i) => (
          <div className="feed-item" key={i}>
            {a.type === "bingo" ? "🟩" : "🎰"} <b>{a.nickname}</b>님이{" "}
            {a.type === "bingo" ? "빙고 한 칸을 채웠어요!" : "로또에 응모했어요!"}
            <time>{timeAgo(a.at)}</time>
          </div>
        ))}
      </div>
    </main>
  );
}
