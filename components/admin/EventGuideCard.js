"use client";

import { useEffect, useState } from "react";
import {
  MAX_EVENT_ACTIVITIES,
  MAX_EVENT_TIMELINE_ITEMS,
  normalizeEventGuide,
} from "@/lib/event";

function makeTimelineItem() {
  return {
    id: `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: "",
    title: "새 일정",
    activities: [],
  };
}

export default function EventGuideCard({ raw, busy, onSave }) {
  const [guide, setGuide] = useState(() => normalizeEventGuide(raw));

  useEffect(() => {
    setGuide(normalizeEventGuide(raw));
  }, [raw]);

  function updateGuide(field, value) {
    setGuide((current) => ({ ...current, [field]: value }));
  }

  function updateTimeline(index, field, value) {
    setGuide((current) => ({
      ...current,
      timeline: current.timeline.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      ),
    }));
  }

  function removeTimeline(index) {
    setGuide((current) => ({
      ...current,
      timeline: current.timeline.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function addActivity(index) {
    setGuide((current) => ({
      ...current,
      timeline: current.timeline.map((item, itemIndex) =>
        itemIndex === index ? { ...item, activities: [...item.activities, ""] } : item
      ),
    }));
  }

  function updateActivity(timelineIndex, activityIndex, value) {
    setGuide((current) => ({
      ...current,
      timeline: current.timeline.map((item, itemIndex) => {
        if (itemIndex !== timelineIndex) return item;
        return {
          ...item,
          activities: item.activities.map((activity, index) => (index === activityIndex ? value : activity)),
        };
      }),
    }));
  }

  function removeActivity(timelineIndex, activityIndex) {
    setGuide((current) => ({
      ...current,
      timeline: current.timeline.map((item, itemIndex) =>
        itemIndex === timelineIndex
          ? { ...item, activities: item.activities.filter((_, index) => index !== activityIndex) }
          : item
      ),
    }));
  }

  function handleSave() {
    const normalized = normalizeEventGuide(guide);
    const droppedCount = guide.timeline.filter(
      (item) => !item.time.trim() && !item.title.trim() && item.activities.every((a) => !a.trim())
    ).length;
    if (
      droppedCount > 0 &&
      !confirm(`시간과 이름이 모두 비어 있는 일정 ${droppedCount}개는 저장 시 삭제됩니다. 계속할까요?`)
    ) {
      return;
    }
    onSave(JSON.stringify(normalized));
  }

  return (
    <section className="card event-editor">
      <p className="card-title">오프라인 행사 편집</p>
      <p className="hint">워크샵 시간, 장소, 오시는 길과 세부 일정을 수정할 수 있습니다.</p>

      <label htmlFor="event-hours">행사 시간</label>
      <input
        id="event-hours"
        value={guide.hours}
        onChange={(event) => updateGuide("hours", event.target.value)}
        disabled={busy}
      />

      <label htmlFor="event-venue">장소</label>
      <input
        id="event-venue"
        value={guide.venue}
        onChange={(event) => updateGuide("venue", event.target.value)}
        disabled={busy}
      />

      <label htmlFor="event-parking">주차 안내</label>
      <input
        id="event-parking"
        value={guide.parkingInfo}
        onChange={(event) => updateGuide("parkingInfo", event.target.value)}
        disabled={busy}
      />

      <label htmlFor="event-map-url">오시는 길 지도 링크 (https://로 시작)</label>
      <input
        id="event-map-url"
        value={guide.mapUrl}
        onChange={(event) => updateGuide("mapUrl", event.target.value)}
        placeholder="https://naver.me/..."
        disabled={busy}
      />

      <label>행사장 좌표 (지도 표시용)</label>
      <p className="hint">
        네이버 지도 PC 화면에서 행사장을 우클릭 → <b>이 위치의 정보</b>를 누르면 위도·경도가 나옵니다.
        비워 두면 지도 대신 링크만 표시돼요.
      </p>
      <div className="event-editor-coords">
        <input
          value={guide.lat ?? ""}
          onChange={(event) => updateGuide("lat", event.target.value)}
          inputMode="decimal"
          aria-label="행사장 위도"
          placeholder="위도 (예: 35.3350)"
          disabled={busy}
        />
        <input
          value={guide.lng ?? ""}
          onChange={(event) => updateGuide("lng", event.target.value)}
          inputMode="decimal"
          aria-label="행사장 경도"
          placeholder="경도 (예: 129.0356)"
          disabled={busy}
        />
      </div>

      <div className="event-editor-heading">
        <label>타임라인</label>
        <button
          type="button"
          className="btn ghost sm"
          onClick={() => setGuide((current) => ({ ...current, timeline: [...current.timeline, makeTimelineItem()] }))}
          disabled={busy || guide.timeline.length >= MAX_EVENT_TIMELINE_ITEMS}
        >
          일정 추가
        </button>
      </div>

      <div className="event-editor-timeline">
        {guide.timeline.map((item, timelineIndex) => (
          <div className="event-editor-row" key={item.id}>
            <div className="event-editor-fields">
              <input
                value={item.time}
                onChange={(event) => updateTimeline(timelineIndex, "time", event.target.value)}
                aria-label={`${timelineIndex + 1}번째 일정 시간`}
                placeholder="예: 09:00 ~ 13:00"
                disabled={busy}
              />
              <input
                value={item.title}
                onChange={(event) => updateTimeline(timelineIndex, "title", event.target.value)}
                aria-label={`${timelineIndex + 1}번째 일정 이름`}
                placeholder="일정 이름"
                disabled={busy}
              />
            </div>

            <div className="event-editor-activities">
              <p className="hint">세부 활동 / 레크리에이션</p>
              {item.activities.map((activity, activityIndex) => (
                <div className="event-editor-activity" key={`${item.id}-${activityIndex}`}>
                  <input
                    value={activity}
                    onChange={(event) => updateActivity(timelineIndex, activityIndex, event.target.value)}
                    aria-label={`${item.title || "일정"} 세부 활동 ${activityIndex + 1}`}
                    placeholder="예: 팀 대항 게임"
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="btn danger sm"
                    onClick={() => removeActivity(timelineIndex, activityIndex)}
                    disabled={busy}
                  >
                    삭제
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => addActivity(timelineIndex)}
                disabled={busy || item.activities.length >= MAX_EVENT_ACTIVITIES}
              >
                세부 활동 추가
              </button>
            </div>

            <button
              type="button"
              className="btn danger sm"
              onClick={() => removeTimeline(timelineIndex)}
              disabled={busy || guide.timeline.length === 1}
            >
              일정 삭제
            </button>
          </div>
        ))}
      </div>

      <div className="event-editor-save">
        <button type="button" className="btn primary" onClick={handleSave} disabled={busy}>
          행사 안내 저장
        </button>
      </div>
    </section>
  );
}
