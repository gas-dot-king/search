"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import { normalizeEventGuide } from "@/lib/event";

const FREERUN_ITEM = {
  id: "freerun",
  time: "05:00",
  title: "8.15 러닝 (프리런)",
};

function formatEventDate(value) {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";

  const [, year, month, day] = match;
  const weekday = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"][
    new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()
  ];
  return `${Number(year)}년 ${Number(month)}월 ${Number(day)}일 ${weekday}`;
}

export default function EventPage() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/config?fresh=1", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error("행사 안내를 불러오지 못했습니다.");
        return response.json();
      })
      .then((data) => active && setConfig(data))
      .catch((err) => active && setError(err.message));

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <main className="wrap">
        <Nav config={config} />
        <p className="hint event-load-error">{error}</p>
      </main>
    );
  }

  if (!config) {
    return (
      <main className="wrap">
        <Nav config={config} />
        <p className="hint">행사 안내를 불러오는 중...</p>
      </main>
    );
  }

  const guide = normalizeEventGuide(config.eventGuide);
  const workshopTimeline = [
    FREERUN_ITEM,
    ...guide.timeline.filter((item) => item.id !== "freerun"),
  ];

  return (
    <main className="wrap">
      <Nav config={config} />

      <header className="event-hero">
        <p className="event-kicker">오프라인 행사</p>
        <h1 className="event-title">양산 슬로우러닝 여름 워크샵</h1>
        <p className="event-date">{formatEventDate(guide.date)}</p>
      </header>

      <section className="card event-info-card" aria-label="행사 기본 정보와 오시는 길">
        <div className="event-summary-item">
          <span>시간</span>
          <strong>{guide.hours}</strong>
        </div>
        <div className="event-summary-item">
          <span>장소</span>
          <strong>{guide.venue}</strong>
        </div>
        {(guide.parkingInfo || guide.mapUrl) && (
          <div className="event-summary-item event-summary-directions">
            <span>오시는 길</span>
            {guide.parkingInfo && <strong>{guide.parkingInfo}</strong>}
            {guide.mapUrl && (
              <a className="btn ghost sm" href={guide.mapUrl} target="_blank" rel="noopener noreferrer">
                🗺️ 네이버 지도에서 보기
              </a>
            )}
            <div id="naver-map" className="event-map-placeholder" aria-label="네이버 지도 표시 영역">
              <span aria-hidden="true">🗺️</span>
              <strong>네이버 지도</strong>
              <small>지도 API 연결 예정</small>
            </div>
          </div>
        )}
      </section>

      {workshopTimeline.length > 0 && <section className="event-schedule" aria-labelledby="event-timeline-title">
        <h2 id="event-timeline-title" className="section-title">행사 타임라인</h2>
        <ol className="event-timeline">
          {workshopTimeline.map((item) => (
            <li className={`event-timeline-item ${item.id === "freerun" ? "freerun-timeline-item" : ""}`} key={item.id}>
              <p className="event-timeline-time">{item.time}</p>
              <div className="event-timeline-content">
                {item.id === "freerun" ? (
                  <>
                    <div className="freerun-timeline-heading">
                      <div>
                        <span>자율 참석</span>
                        <h3>{item.title}</h3>
                      </div>
                      <b>8.15km</b>
                    </div>
                    <p className="freerun-timeline-intro">
                      원하는 만큼 함께 달려요. 8.15km를 꼭 전부 채우지 않아도 됩니다.
                    </p>
                    <dl className="freerun-timeline-details">
                      <div><dt>일시</dt><dd>2026년 8월 15일 오전 5시 ~ 6시</dd></div>
                      <div><dt>장소</dt><dd>남양산역 2번 출구 옆, 물금 IC 측 100m 지점 운동기구가 있는 정자</dd></div>
                      <div><dt>내용</dt><dd>8.15km 인증 도전 · 자신이 뛸 수 있는 만큼 참여 가능</dd></div>
                      <div><dt>비고</dt><dd>러닝 이후 아침 식사(자유 참석) 및 정비 진행</dd></div>
                    </dl>
                  </>
                ) : (
                  <h3>{item.title}</h3>
                )}
                {item.id !== "freerun" && item.activities.length > 0 && (
                  <ul className="event-activities" aria-label={`${item.title} 세부 활동`}>
                    {item.activities.map((activity, activityIndex) => (
                      <li key={`${item.id}-activity-${activityIndex}`}>{activity}</li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>}

      <Footer />
    </main>
  );
}
