"use client";

import Nav from "@/components/Nav";
import { useApiData } from "@/lib/hooks";
import {
  BOARD_CELL_COUNT,
  CHALLENGE_AWARDS,
  FOUR_LINE_GOAL,
  FOUR_LINE_PRIZE_COUNT,
  SPONSORS,
} from "@/lib/hall";
import { formatKoreanClock, formatKoreanDateTime } from "@/lib/period";

const fmtKm = (digits) => `${digits.slice(0, 2)}.${digits.slice(2)}`;
const RANK_MEDALS = ["🥇", "🥈", "🥉"];

function SponsorsCard() {
  return (
    <section className="card hall-sponsors" aria-labelledby="hall-sponsors-title">
      <p id="hall-sponsors-title" className="card-title">🙏 후원해주신 분들</p>
      <ul className="hall-sponsor-list">
        {SPONSORS.map((nickname) => (
          <li className="hall-sponsor" key={nickname}>{nickname}</li>
        ))}
      </ul>
      <p className="hint hall-sponsor-thanks">
        여름 이벤트를 함께 만들어주신 {SPONSORS.length}분께 감사드려요!
      </p>
    </section>
  );
}

/** 4줄 달성자는 선물이 걸린 선착순 순위를 함께 보여준다 */
function FourLineBadge({ rank }) {
  if (!rank) return null;
  const winning = rank <= FOUR_LINE_PRIZE_COUNT;
  return (
    <span className={`hall-badge four-line ${winning ? "" : "waiting"}`}>
      🏆 {FOUR_LINE_GOAL}줄 {rank}번째
    </span>
  );
}

function FourLineRanking({ fourLine }) {
  return (
    <div className="hall-fourline">
      <div className="hall-fourline-heading">
        <p className="hall-subtitle">🏆 {FOUR_LINE_GOAL}줄 달성 선착순</p>
        <span className="hall-fourline-count">
          {fourLine.length}명 달성 · 선착순 {FOUR_LINE_PRIZE_COUNT}명 선물
        </span>
      </div>

      {fourLine.length === 0 ? (
        <p className="hint hall-empty">
          아직 {FOUR_LINE_GOAL}줄을 완성한 사람이 없어요. 첫 번째 주인공이 되어보세요!
        </p>
      ) : (
        <ol className="hall-fourline-list">
          {fourLine.map((achiever) => (
            <li
              className={`hall-fourline-item ${achiever.rank <= FOUR_LINE_PRIZE_COUNT ? "prize" : ""}`}
              key={`${achiever.rank}-${achiever.nickname}`}
            >
              <span className="hall-fourline-rank">{achiever.rank}</span>
              <strong className="hall-fourline-name">{achiever.nickname}</strong>
              <time className="hall-fourline-time">{formatKoreanDateTime(achiever.achievedAt)}</time>
            </li>
          ))}
        </ol>
      )}

      <p className="hint hall-fourline-note">
        달성 순서는 {FOUR_LINE_GOAL}번째 줄을 채운 인증 시각 기준이에요.
        선물은 운영진이 인증 사진을 확인한 뒤 최종 확정합니다.
      </p>
    </div>
  );
}

function BingoCard({ bingo }) {
  const { achievers, participants, completed } = bingo;
  const updatedAt = formatKoreanClock(bingo.updatedAt);

  return (
    <section className="card" aria-labelledby="hall-bingo-title">
      <div className="hall-bingo-heading">
        <p id="hall-bingo-title" className="card-title">🎯 빙고 달성 현황</p>
        {updatedAt && <span className="hall-updated">{updatedAt} 기준</span>}
      </div>
      <p className="hint">
        인증 참여 {participants}명 · 줄 완성 {achievers.length}명 · 빙고판 완성 {completed}명
      </p>

      <FourLineRanking fourLine={bingo.fourLine || []} />

      <p className="hall-subtitle">전체 순위</p>
      {achievers.length === 0 ? (
        <p className="hint hall-empty">아직 빙고 한 줄을 완성한 사람이 없어요. 첫 주인공이 되어보세요!</p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>닉네임</th>
                <th className="num">줄</th>
                <th className="num">빙고 칸</th>
              </tr>
            </thead>
            <tbody>
              {achievers.map((user, index) => (
                <tr key={user.nickname}>
                  <td>{RANK_MEDALS[index] || index + 1}</td>
                  <td>
                    {user.nickname}
                    <FourLineBadge rank={user.fourLineRank} />
                    {user.complete && <span className="hall-badge">판 완성</span>}
                  </td>
                  <td className="num"><b style={{ color: "var(--accent)" }}>{user.lines}</b></td>
                  <td className="num">{user.filled}/{BOARD_CELL_COUNT}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="hint" style={{ marginTop: 8 }}>
        순위는 한 시간에 한 번 집계돼요. 방금 올린 인증은 빙고 화면에서 바로 확인할 수 있어요.
      </p>
    </section>
  );
}

function LottoCard({ lotto }) {
  const winning = lotto.winningNumbers || "";
  const drawn = winning.length === 3;

  return (
    <section className="card" aria-labelledby="hall-lotto-title">
      <p id="hall-lotto-title" className="card-title">🎰 달리기 로또 당첨 번호</p>

      {winning.length === 0 ? (
        <p className="hint">
          {lotto.drawDate ? `${lotto.drawDate} 오프라인 행사에서 추첨해요.` : "추첨이 시작되면 번호가 공개돼요."}
        </p>
      ) : (
        <>
          <div className="winning-digits">
            {[0, 1, 2].map((index) => (
              <div className="winning-digit-group" key={index}>
                <span className={`winning-digit ${index < winning.length ? "" : "pending"}`}>
                  {index < winning.length ? winning[index] : "?"}
                </span>
                <small>{["1의 자리", "소수점 첫째", "소수점 둘째"][index]}</small>
              </div>
            ))}
          </div>
          <p className="hint">
            {drawn ? `당첨 기록은 ${winning[0]}.${winning.slice(1)}km 세 자리예요.` : "추첨 진행 중이에요. 다음 숫자를 기다려주세요!"}
          </p>
        </>
      )}

      {drawn && lotto.winners && (
        <div className="hall-lotto-winners">
          <p className="hall-subtitle">🏆 1등 당첨자</p>
          {lotto.winners.length === 0 ? (
            <p className="hint">아직 1등이 없어 다시 추첨할 예정이에요.</p>
          ) : (
            <ul className="hall-award-list">
              {lotto.winners.map((winner) => (
                <li className="hall-award" key={winner.nickname}>
                  <span className="hall-award-title">1등</span>
                  <strong className="hall-award-winner">{winner.nickname}</strong>
                  <span className="hall-award-note">{fmtKm(winner.digits)}km · 세 자리 일치</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ChallengeAwardsCard() {
  return (
    <section className="card" aria-labelledby="hall-challenge-title">
      <p id="hall-challenge-title" className="card-title">🏅 챌린지 수상자</p>
      {CHALLENGE_AWARDS.length === 0 ? (
        <p className="hint">28일 챌린지 시상 결과가 정리되면 여기에 올라와요.</p>
      ) : (
        <ul className="hall-award-list">
          {CHALLENGE_AWARDS.map((award) => (
            <li className="hall-award" key={`${award.title}-${award.nickname}`}>
              <span className="hall-award-title">{award.title}</span>
              <strong className="hall-award-winner">{award.nickname}</strong>
              {award.note && <span className="hall-award-note">{award.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function HallPage() {
  const { data, error } = useApiData("/api/hall");

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

      <header className="page-head hall-head">
        <p className="emoji" aria-hidden="true">🏆</p>
        <h1 className="page-title">명예의 전당</h1>
        <p className="hint">이번 여름 이벤트를 빛낸 기록을 모았어요.</p>
      </header>

      <SponsorsCard />
      <BingoCard bingo={data.bingo} />
      <LottoCard lotto={data.lotto} />
      <ChallengeAwardsCard />
    </main>
  );
}
