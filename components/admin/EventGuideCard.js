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

  return (
    <section className="card event-editor">
      <p className="card-title">행사 안내 편집</p>
      <p className="hint">행사 시간, 장소, 타임라인과 세부 레크리에이션을 수정할 수 있습니다.</p>

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
        <button
          type="button"
          className="btn primary"
          onClick={() => onSave(JSON.stringify(normalizeEventGuide(guide)))}
          disabled={busy}
        >
          행사 안내 저장
        </button>
      </div>
    </section>
  );
}
