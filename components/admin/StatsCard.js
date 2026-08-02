"use client";

import { useState } from "react";
import { formatKoreanClock } from "@/lib/period";

/** 큰 숫자 하나 + 설명. 훑어보기 좋게 격자로 깐다. */
function Stat({ label, value, unit, sub, tone }) {
  return (
    <div className={`admin-overview-stat${tone ? ` tone-${tone}` : ""}`}>
      <b>
        {value}
        {unit && <span className="admin-overview-unit">{unit}</span>}
      </b>
      <span className="admin-overview-label">{label}</span>
      {sub && <span className="admin-overview-sub">{sub}</span>}
    </div>
  );
}

/** 최근 7일 업로드 추이. 라이브러리 없이 막대 높이만 비율로 준다. */
function DailyChart({ daily }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  return (
    <div className="admin-daily">
      {daily.map((day) => (
        <div key={day.day} className={`admin-daily-col${day.isToday ? " today" : ""}`}>
          <span className="admin-daily-count">{day.count}</span>
          <span className="admin-daily-bar" style={{ height: `${Math.round((day.count / max) * 100)}%` }} />
          <span className="admin-daily-label">{day.label}</span>
        </div>
      ))}
    </div>
  );
}

const CATEGORY_LABEL = { 1: "①", 2: "②", 3: "③" };

/**
 * 항목별 인증률. "그 항목이 뽑힌 판" 대비 "실제 인증된 수"라
 * 판에 자주 안 뽑힌 항목도 공정하게 비교된다.
 * 잘 되는 항목보다 안 되는 항목이 운영에 쓸모 있어 아래쪽을 함께 보여준다.
 */
function ItemRates({ perItem }) {
  const [open, setOpen] = useState(false);
  if (!perItem?.length) return null;

  const ranked = perItem.filter((item) => item.boards > 0);
  if (!ranked.length) return null;
  const shown = open ? ranked : [...ranked.slice(0, 3), ...ranked.slice(-3)];

  return (
    <>
      <p className="admin-overview-subtitle">
        항목별 인증률 {open ? "(전체)" : "(잘 되는 3개 · 막힌 3개)"}
      </p>
      <ul className="admin-item-rates">
        {shown.map((item) => (
          <li key={item.id}>
            <span className="admin-item-name">
              <b>{CATEGORY_LABEL[item.category] || ""}</b> {item.content}
            </span>
            <span className="admin-item-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(100, item.rate)}%` }} />
            </span>
            <span className="admin-item-value">
              {item.rate}%
              <small>
                {item.certified}/{item.boards}
              </small>
            </span>
          </li>
        ))}
      </ul>
      <button className="btn ghost sm" onClick={() => setOpen((current) => !current)}>
        {open ? "접기" : `전체 ${ranked.length}개 보기`}
      </button>
    </>
  );
}

/** 이벤트 중간 점검용 전체 현황 */
export default function StatsCard({ stats, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  if (!stats) return null;

  const participation = stats.members
    ? Math.round((stats.started / stats.members) * 100)
    : 0;

  async function refresh() {
    setRefreshing(true);
    try {
      await onRefresh();
    } catch (error) {
      alert(error.message);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="card admin-overview">
      <div className="admin-overview-head">
        <p className="card-title">📊 전체 현황</p>
        <span className="hint">{formatKoreanClock(stats.updatedAt)} 기준</span>
      </div>
      {onRefresh && (
        <button className="btn ghost sm admin-overview-refresh" onClick={refresh} disabled={refreshing}>
          {refreshing ? "불러오는 중..." : "↻ 새로고침"}
        </button>
      )}

      <div className="admin-overview-grid">
        <Stat label="가입 회원" value={stats.members} unit="명" />
        <Stat
          label="인증 시작"
          value={stats.started}
          unit="명"
          sub={`참여율 ${participation}%`}
          tone="accent"
        />
        <Stat label="아직 0장" value={stats.idle} unit="명" tone={stats.idle > 0 ? "warn" : null} />
        <Stat label="인증 사진" value={stats.photos} unit="장" sub={`오늘 ${stats.photosToday}장`} tone="accent" />
        <Stat label="1인 평균" value={stats.avgFilled} unit="칸" sub={`판 채움 ${stats.fillRate}%`} />
        <Stat label="빙고 줄 합계" value={stats.totalLines} unit="줄" sub={`1줄 이상 ${stats.withLine}명`} />
        <Stat label="4줄 달성" value={stats.fourLine} unit="명" tone="accent" />
        <Stat label="16칸 완성" value={stats.completed} unit="명" />
        <Stat
          label="로또 응모"
          value={stats.lottoEntries}
          unit="장"
          sub={`${stats.lottoMembers}명 · 오늘 ${stats.lottoToday}장`}
        />
        <Stat label="응모권 2장 소진" value={stats.lottoFull} unit="명" />
      </div>

      <p className="admin-overview-subtitle">최근 7일 인증 사진</p>
      <DailyChart daily={stats.daily} />

      <ItemRates perItem={stats.perItem} />
    </section>
  );
}
