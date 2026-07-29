"use client";

import { FOUR_LINE_GOAL, FOUR_LINE_PRIZE_COUNT } from "@/lib/hall";
import { formatKoreanDateTime } from "@/lib/period";

/**
 * 선물이 걸린 4줄 선착순 명단.
 * 순서는 자동으로 세우고, 사진이 규칙에 맞는지는 운영진이 "보기"로 하나씩 확인한다.
 */
export default function FourLineCard({ fourLine, busy, onOpenUser }) {
  const ranking = fourLine || [];
  const prizeCount = Math.min(ranking.length, FOUR_LINE_PRIZE_COUNT);

  return (
    <section className="card">
      <p className="card-title">🏆 {FOUR_LINE_GOAL}줄 달성 선착순 ({ranking.length}명)</p>
      <p className="hint">
        {FOUR_LINE_GOAL}번째 줄을 채운 인증 시각 순서입니다. 위에서부터 {FOUR_LINE_PRIZE_COUNT}명이 선물 대상이니,
        <b> 보기</b>로 인증 사진이 항목에 맞는지 확인하세요. 사진을 지우면 순위는 다음 집계에서 다시 계산됩니다.
      </p>

      {ranking.length === 0 ? (
        <p className="hint fourline-empty">아직 {FOUR_LINE_GOAL}줄을 완성한 회원이 없습니다.</p>
      ) : (
        <>
          <p className="hint">
            선물 대상 {prizeCount}명
            {ranking.length > FOUR_LINE_PRIZE_COUNT && ` · 대기 ${ranking.length - FOUR_LINE_PRIZE_COUNT}명`}
          </p>
          <div className="table-scroll">
            <table className="fourline-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>닉네임</th>
                  <th>달성 시각</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {ranking.map((achiever) => (
                  <tr
                    key={achiever.id || `${achiever.rank}-${achiever.nickname}`}
                    className={achiever.rank <= FOUR_LINE_PRIZE_COUNT ? "fourline-prize" : ""}
                  >
                    <td>
                      <b>{achiever.rank}</b>
                      {achiever.rank > FOUR_LINE_PRIZE_COUNT && <span className="fourline-waiting">대기</span>}
                    </td>
                    <td>{achiever.nickname}</td>
                    <td className="fourline-time">{formatKoreanDateTime(achiever.achievedAt)}</td>
                    <td className="num">
                      <button
                        className="btn ghost sm"
                        onClick={() => onOpenUser({ id: achiever.id, nickname: achiever.nickname })}
                        disabled={busy || !achiever.id}
                      >
                        보기
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
