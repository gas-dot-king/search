"use client";

import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

const EVENT_RULES = [
  { sport: "러닝", min: "3km 이상", max: "8km" },
  { sport: "걷기", min: "40분 이상 ＋ 3km 이상", max: "60분" },
];

const GRADES = [
  { days: "28일", title: "🥇 완주의 신" },
  { days: "20일 이상", title: "🥈 꾸준함의 증명" },
  { days: "10일 이상", title: "🥉 시작한 사람" },
];

const TIEBREAKERS = [
  { rank: "1순위", rule: "실운동 달성 일수 — 패스권 사용일을 제외하고, 실제 인증한 날이 많은 순" },
  { rank: "2순위", rule: "정모/일정 참여 횟수 — 동일 시 참여 인증이 많은 순 (최대 4회까지만 반영)" },
  { rank: "3순위", rule: "러닝 인증 횟수 — 동일 시 러닝 인증이 많은 순" },
  { rank: "4순위", rule: "러닝 누적 거리(km) — 동일 시 누적 거리가 많은 순" },
  { rank: "5순위", rule: "모두 동일할 경우 사다리타기" },
];

const FOUL_CASES = [
  "러닝 평균 페이스 4:00/km 미만",
  "걷기 평균 속도 8km/h 초과",
  "GPS 경로 이상, 차량·자전거 이용 정황",
];

// 당근 모임 초대 링크. 링크가 바뀌면 아래 주소만 교체하면 됩니다.
const CARROT_CHALLENGE_URL = "https://daangn.com/kr/share/community/ref/invite-group/8AYyjpELhF";

export default function ChallengePage() {
  return (
    <main className="wrap">
      <Nav />

      <header className="event-hero">
        <p className="event-kicker">챌린지</p>
        <h1 className="event-title">🏃 양슬 28일 챌린지</h1>
        <p className="event-date">2026. 8. 10.(월) ~ 9. 6.(일) · 4주</p>
      </header>

      {/* 당근 챌린지 기능 사용 안내 — 가장 중요한 준비물이라 별도 블록으로 강조 */}
      <section className="challenge-carrot" aria-labelledby="carrot-title">
        <p className="challenge-carrot-badge">꼭 확인하세요</p>
        <h2 id="carrot-title" className="challenge-carrot-title">
          인증은 <span>당근 챌린지 기능</span>으로만 진행됩니다
        </h2>
        <ul className="challenge-carrot-list">
          <li>매일의 운동 인증 사진은 <b>당근 챌린지 캘린더</b>에 업로드해주세요.</li>
          <li>달성 일수와 등수는 <b>모두 캘린더 기록을 기준으로</b> 집계됩니다.</li>
          <li>패스권도 캘린더에 글을 올려야 사용 처리되니, 시작 전에 꼭 가입해주세요.</li>
        </ul>
        <a
          className="btn challenge-carrot-button"
          href={CARROT_CHALLENGE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          당근 앱에서 보기
          <span aria-hidden="true">→</span>
        </a>
      </section>

      <section className="challenge-section" aria-labelledby="rules-title">
        <h2 id="rules-title" className="section-title">1. 기본 규칙</h2>
        <div className="card">
          <p className="card-title">인증: 1일 1회 (단일 운동 기록 1개 제출)</p>
          <table>
            <thead>
              <tr>
                <th>종목</th>
                <th>최소</th>
                <th>최대 인정</th>
              </tr>
            </thead>
            <tbody>
              {EVENT_RULES.map((rule) => (
                <tr key={rule.sport}>
                  <td><b>{rule.sport}</b></td>
                  <td>{rule.min}</td>
                  <td>{rule.max}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="challenge-note">
            ※ 최대 기준 초과 기록은 각각 8km / 60분으로 산정됩니다. 건강과 부상 방지를 위한 조치입니다.
          </p>
          <p className="challenge-note">
            ※ 러닝 다음 날 걷기 인증도 동일하게 1일로 인정됩니다. 회복일로 적극 활용하세요.
          </p>
          <div className="rule-box" style={{ marginBottom: 0 }}>
            📷 <b>인증 방법</b> — 당근 챌린지 캘린더에 인증 사진을 업로드해주세요. 달성 여부는 캘린더 기준으로
            집계됩니다.
          </div>
        </div>
      </section>

      <section className="challenge-section" aria-labelledby="pass-title">
        <h2 id="pass-title" className="section-title">2. 패스권</h2>
        <div className="card">
          <ul className="challenge-list">
            <li>1인당 패스권 <b>1장</b> 지급</li>
            <li>사유 불문(부상·경조사·출장·컨디션 등) 사용 가능</li>
            <li>사용 방법: 당일 캘린더에 <b>사진 없이 글만</b> 올리면 패스권 사용으로 처리됩니다</li>
            <li>사후 소급 사용 불가</li>
          </ul>
        </div>
      </section>

      <section className="challenge-section" aria-labelledby="grade-title">
        <h2 id="grade-title" className="section-title">3. 완주 등급 및 칭호</h2>
        <div className="card">
          <p className="hint" style={{ marginBottom: 10 }}>
            챌린지 종료 후 완주자 명단에 닉네임과 칭호가 함께 등재됩니다.
          </p>
          <table>
            <thead>
              <tr>
                <th>달성 일수</th>
                <th>칭호</th>
              </tr>
            </thead>
            <tbody>
              {GRADES.map((grade) => (
                <tr key={grade.days}>
                  <td>{grade.days}</td>
                  <td><b>{grade.title}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="challenge-note">※ 칭호 판정에는 패스권 사용일이 포함됩니다.</p>
          <p className="challenge-note">
            ※ 완주 등급은 순위 경쟁과 별개입니다. 며칠 빠져도 끝까지 함께 가주세요.
          </p>
        </div>
      </section>

      <section className="challenge-section" aria-labelledby="prize-title">
        <h2 id="prize-title" className="section-title">4. 시상</h2>
        <div className="card">
          <ul className="challenge-list">
            <li>최종 순위 <b>1~3위</b>에게 상품이 수여됩니다.</li>
            <li>4위 이하는 완주 등급·칭호로 명단에 등재됩니다.</li>
          </ul>
        </div>
      </section>

      <section className="challenge-section" aria-labelledby="tiebreak-title">
        <h2 id="tiebreak-title" className="section-title">5. 순위 결정 우선순위</h2>
        <div className="card">
          <p className="hint" style={{ marginBottom: 10 }}>
            시상 순위는 패스권을 제외한 <b>&lsquo;실운동 일수&rsquo;</b> 기준으로 산정됩니다.
          </p>
          <table>
            <thead>
              <tr>
                <th>순위</th>
                <th>기준</th>
              </tr>
            </thead>
            <tbody>
              {TIEBREAKERS.map((item) => (
                <tr key={item.rank}>
                  <td><b>{item.rank}</b></td>
                  <td>{item.rule}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="challenge-note">※ 칭호는 패스권을 포함해 인정되지만, 시상 순위는 실운동만 반영됩니다.</p>
          <p className="challenge-note">※ 2순위는 근무 형태·거주지에 따른 격차를 고려해 상한을 두었습니다.</p>
          <p className="challenge-note">※ 개인 개설 일정은 본인 포함 3인 이상 참여한 경우에만 인정됩니다.</p>
        </div>
      </section>

      <section className="challenge-section" aria-labelledby="detail-title">
        <h2 id="detail-title" className="section-title">6. 세부 인증 및 주의사항</h2>

        <div className="card">
          <p className="card-title">단일 기록 제출</p>
          <p className="challenge-body">
            한 번의 측정(Single Workout) 기록만 인정합니다.
            <br />
            예: 아침 걷기 20분 + 저녁 걷기 20분 합산 불가
          </p>
        </div>

        <div className="card">
          <p className="card-title">트레드밀 인증</p>
          <p className="challenge-body">
            계기판 화면 또는 측정 앱 스크린샷으로 인증 가능하며, 로드 러닝과 동일하게 인정됩니다. 폭염기 안전을
            위해 실내 운동을 권장합니다.
          </p>
        </div>

        <div className="card">
          <p className="card-title">부정 인증 처리</p>
          <p className="challenge-body">
            아래 해당 시 운영진이 소명을 요청하며, 미소명 시 무효 처리됩니다.
          </p>
          <ul className="challenge-list">
            {FOUL_CASES.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </section>

      <Footer />
    </main>
  );
}
