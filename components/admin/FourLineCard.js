"use client";

import { useState } from "react";
import { adminPost } from "@/lib/adminClient";
import { downloadCsv, fourLineToCsv } from "@/lib/csv";
import { FOUR_LINE_GOAL, FOUR_LINE_PRIZE_COUNT } from "@/lib/hall";
import { formatKoreanDateTime } from "@/lib/period";

/**
 * 선물이 걸린 4줄 선착순 명단.
 *
 * 순서는 자동으로 세우지만, 사진이 규칙에 맞는지는 운영진이 "보기"로 확인한다.
 * 확인이 끝난 사람은 "확정"해 둔다 — 확정하면 그 시점의 달성 시각으로 순위가 고정돼,
 * 나중에 그 회원이 사진을 교체해도 선물 명단이 뒤집히지 않는다.
 */
export default function FourLineCard({ fourLine, busy, onOpenUser, onChanged }) {
  const [working, setWorking] = useState("");
  const ranking = fourLine || [];
  const prizeCount = Math.min(ranking.length, FOUR_LINE_PRIZE_COUNT);
  const confirmedCount = ranking.filter((item) => item.confirmed).length;

  async function toggleConfirm(achiever) {
    const undo = achiever.confirmed;
    if (undo && !confirm(`${achiever.nickname} 님의 확정을 취소할까요?\n순위가 다시 사진 기준으로 계산됩니다.`)) {
      return;
    }
    setWorking(achiever.id);
    try {
      await adminPost({
        action: undo ? "unconfirm_four_line" : "confirm_four_line",
        userId: achiever.id,
      });
      await onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setWorking("");
    }
  }

  return (
    <section className="card">
      <p className="card-title">🏆 {FOUR_LINE_GOAL}줄 달성 선착순 ({ranking.length}명)</p>
      <p className="hint">
        {FOUR_LINE_GOAL}번째 줄을 채운 인증 시각 순서입니다. 위에서부터 {FOUR_LINE_PRIZE_COUNT}명이 선물 대상이니,
        <b> 보기</b>로 인증 사진을 확인한 뒤 <b>확정</b>을 누르세요.
        확정하면 달성 시각이 고정돼, 그 뒤에 사진을 바꿔도 순위가 밀리지 않습니다.
      </p>

      {ranking.length === 0 ? (
        <p className="hint fourline-empty">아직 {FOUR_LINE_GOAL}줄을 완성한 회원이 없습니다.</p>
      ) : (
        <>
          <div className="admin-users-head">
            <p className="hint">
              선물 대상 {prizeCount}명 · 확정 {confirmedCount}명
              {ranking.length > FOUR_LINE_PRIZE_COUNT && ` · 대기 ${ranking.length - FOUR_LINE_PRIZE_COUNT}명`}
            </p>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() =>
                downloadCsv(
                  fourLineToCsv(ranking, FOUR_LINE_PRIZE_COUNT),
                  `ysrc-선물명단-${new Date().toISOString().slice(0, 10)}.csv`
                )
              }
            >
              ⬇ 명단 내려받기
            </button>
          </div>
          <div className="table-scroll">
            <table className="fourline-table">
              <thead>
                <tr>
                  <th>순위</th>
                  <th>닉네임</th>
                  <th>달성 시각</th>
                  <th />
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
                    <td>
                      {achiever.nickname}
                      {achiever.confirmed && <span className="fourline-confirmed">확정</span>}
                    </td>
                    <td className="fourline-time">
                      {formatKoreanDateTime(achiever.achievedAt)}
                      {/* 확정 뒤에 사진이 바뀌었으면 무엇이 달라졌는지 짚어 준다 */}
                      {achiever.confirmed && !achiever.stillQualifies && (
                        <b className="fourline-drift">⚠️ 지금은 {FOUR_LINE_GOAL}줄이 아님</b>
                      )}
                      {achiever.confirmed && achiever.stillQualifies
                        && achiever.liveAchievedAt !== achiever.achievedAt && (
                        <b className="fourline-drift">
                          ⚠️ 사진 변경됨 (현재 {formatKoreanDateTime(achiever.liveAchievedAt)})
                        </b>
                      )}
                    </td>
                    <td className="num">
                      <button
                        className="btn ghost sm"
                        onClick={() => onOpenUser({ id: achiever.id, nickname: achiever.nickname })}
                        disabled={busy || !achiever.id}
                      >
                        보기
                      </button>
                    </td>
                    <td className="num">
                      <button
                        className={`btn sm ${achiever.confirmed ? "ghost" : "primary"}`}
                        onClick={() => toggleConfirm(achiever)}
                        disabled={busy || !achiever.id || working === achiever.id}
                      >
                        {working === achiever.id ? "..." : achiever.confirmed ? "확정 취소" : "확정"}
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
