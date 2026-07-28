"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { useApiData } from "@/lib/hooks";

function timeAgo(iso) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function activityText(activity) {
  if (activity.type === "bingo_line") {
    return activity.lines > 1
      ? `한 번에 ${activity.lines}줄 빙고를 달성했어요!`
      : "빙고 한 줄을 달성했어요!";
  }
  return activity.type === "bingo" ? "빙고 한 칸을 채웠어요!" : "러닝 로또에 응모했어요!";
}

function activityIcon(type) {
  if (type === "bingo_line") return "🎉";
  return type === "bingo" ? "🏃" : "🎟️";
}

export default function FeedPage() {
  const { data, error } = useApiData("/api/feed");

  if (!data) {
    return (
      <main className="wrap">
        <Nav />
        <p className="hint">{error || "불러오는 중..."}</p>
      </main>
    );
  }

  return (
    <main className="wrap">
      <Nav />
      <h2 className="section-title">📊 크루 현황</h2>

      <div className="card">
        <p className="card-title">진행률 랭킹</p>
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
            {data.rankings.map((rank, index) => (
              <tr key={rank.nickname}>
                <td>{index < 3 && rank.filled > 0 ? ["🥇", "🥈", "🥉"][index] : index + 1}</td>
                <td>{rank.nickname}</td>
                <td className="num">{rank.filled}/16</td>
                <td className="num"><b style={{ color: rank.lines ? "var(--accent)" : undefined }}>{rank.lines}</b></td>
                <td className="num">{rank.lottoEntries}장</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="hint" style={{ marginTop: 8 }}>사진은 본인과 운영진만 볼 수 있어요.</p>
      </div>

      <div className="card">
        <p className="card-title">최근 활동</p>
        {data.activity.length === 0 && <p className="hint">아직 활동이 없어요. 첫 인증의 주인공이 되어보세요!</p>}
        {data.activity.map((activity, index) => (
          <div className={`feed-item ${activity.type === "bingo_line" ? "feed-item-line" : ""}`} key={`${activity.type}-${activity.nickname}-${activity.at}-${index}`}>
            {activityIcon(activity.type)} <b>{activity.nickname}</b>님이 {activityText(activity)}
            <time>{timeAgo(activity.at)}</time>
          </div>
        ))}
      </div>

      <Footer />
    </main>
  );
}
