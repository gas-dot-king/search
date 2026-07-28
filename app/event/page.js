"use client";

import { useEffect, useState } from "react";
import Nav from "@/components/Nav";
import { normalizeEventGuide } from "@/lib/event";

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

  return (
    <main className="wrap">
      <Nav config={config} />

      <header className="event-hero">
        <p className="event-kicker">행사 안내</p>
        <h1 className="event-title">양산 슬로우러닝 온라인 위크</h1>
        <p className="event-date">{formatEventDate(guide.date)}</p>
      </header>

      <section className="card event-summary" aria-label="행사 기본 정보">
        <div className="event-summary-item">
          <span>시간</span>
          <strong>{guide.hours}</strong>
        </div>
        <div className="event-summary-item">
          <span>장소</span>
          <strong>{guide.venue}</strong>
        </div>
      </section>

      {(guide.parkingInfo || guide.mapUrl) && (
        <section className="card event-directions" aria-label="오시는 길">
          <h2 className="section-title">오시는 길</h2>
          {guide.parkingInfo && <p className="event-parking">🚗 {guide.parkingInfo}</p>}
          {guide.mapUrl && (
            <a className="btn ghost sm" href={guide.mapUrl} target="_blank" rel="noopener noreferrer">
              네이버 지도에서 보기
            </a>
          )}
        </section>
      )}

      <section className="event-schedule" aria-labelledby="event-timeline-title">
        <h2 id="event-timeline-title" className="section-title">행사 타임라인</h2>
        <ol className="event-timeline">
          {guide.timeline.map((item) => (
            <li className="event-timeline-item" key={item.id}>
              <p className="event-timeline-time">{item.time}</p>
              <div className="event-timeline-content">
                <h3>{item.title}</h3>
                {item.activities.length > 0 && (
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
      </section>
    </main>
  );
}
