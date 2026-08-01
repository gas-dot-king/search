"use client";

import { useEffect, useState } from "react";
import { normalizeEventGuide } from "@/lib/event";

export default function EventGuideCard({ raw, busy, onSave }) {
  const [guide, setGuide] = useState(() => normalizeEventGuide(raw));

  useEffect(() => {
    setGuide(normalizeEventGuide(raw));
  }, [raw]);

  function updateGuide(field, value) {
    setGuide((current) => ({ ...current, [field]: value }));
  }

  function handleSave() {
    onSave(JSON.stringify(normalizeEventGuide(guide)));
  }

  return (
    <div className="event-editor">

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

      <label htmlFor="event-map-url">네이버 지도 링크 (https://로 시작)</label>
      <input
        id="event-map-url"
        value={guide.mapUrl}
        onChange={(event) => updateGuide("mapUrl", event.target.value)}
        placeholder="https://naver.me/..."
        disabled={busy}
      />

      <label>행사장 좌표 (지도 표시용)</label>
      <p className="hint">
        네이버 지도 PC 화면에서 행사장을 클릭한 뒤 <b>이 위치의 주소</b>를 누르면 위도·경도가 표시됩니다.
        비워 두면 지도 링크만 표시합니다.
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

      <p className="event-editor-locked-note">
        행사 타임라인은 운영 중 임의 변경을 막기 위해 에이전트를 통해 관리합니다.
      </p>

      <div className="event-editor-save">
        <button type="button" className="btn primary" onClick={handleSave} disabled={busy}>
          행사 안내 저장
        </button>
      </div>
    </div>
  );
}
