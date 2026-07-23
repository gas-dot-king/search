"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LottoDeadlineReminder from "./LottoDeadlineReminder";

function dDayText(config) {
  if (!config) return "";
  const now = new Date();
  const start = new Date(config.uploadStart);
  const end = new Date(config.uploadEnd);
  const daysUntil = (date) => Math.ceil((date - now) / 86400000);

  if (config.winningNumbers?.length === 4) return "🎉 추첨 완료!";
  if (config.winningNumbers?.length > 0) return "🎰 추첨 진행 중!";
  if (now < start) return `시작까지 D-${daysUntil(start)}`;
  if (now <= end) {
    const days = daysUntil(end);
    return days === 0 ? "오늘 마감!" : `마감까지 D-${days}`;
  }

  const drawDate = config.drawDate ? new Date(`${config.drawDate}T00:00:00+09:00`) : null;
  if (drawDate && now < new Date(drawDate.getTime() + 86400000)) {
    return `업로드 마감 · ${drawDate.getMonth() + 1}/${drawDate.getDate()} 추첨`;
  }
  return "이벤트 종료";
}

function NoticeBar({ notices }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (notices.length < 2) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % notices.length), 5000);
    return () => clearInterval(timer);
  }, [notices.length]);

  if (notices.length === 0) return null;
  const current = index % notices.length;
  const move = (direction) => setIndex((current + direction + notices.length) % notices.length);

  return (
    <div className="notice-bar">
      <span className="notice-text">📢 {notices[current]}</span>
      {notices.length > 1 && (
        <span className="notice-ctrl">
          <button type="button" onClick={() => move(-1)} aria-label="이전 공지">‹</button>
          <em>{current + 1}/{notices.length}</em>
          <button type="button" onClick={() => move(1)} aria-label="다음 공지">›</button>
        </span>
      )}
    </div>
  );
}

export default function Nav({ config }) {
  const pathname = usePathname();
  const [currentConfig, setCurrentConfig] = useState(config || null);

  useEffect(() => {
    if (currentConfig) return;
    let active = true;
    fetch("/api/config")
      .then((response) => response.json())
      .then((data) => active && setCurrentConfig(data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [currentConfig]);

  const links = [
    ["/board", "빙고판"],
    ["/lotto", "로또"],
    ["/feed", "현황"],
  ];

  return (
    <>
      <nav className="nav">
        <span className="brand">🏃 양산 슬로우러닝</span>
        {links.map(([href, label]) => (
          <Link key={href} href={href} className={pathname === href ? "active" : ""}>
            {label}
          </Link>
        ))}
        <span className="dday">{dDayText(currentConfig)}</span>
      </nav>
      <NoticeBar notices={currentConfig?.notices || []} />
      <LottoDeadlineReminder config={currentConfig} />
    </>
  );
}
