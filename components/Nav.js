"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LottoDeadlineReminder from "./LottoDeadlineReminder";
import { prefetchApiData } from "@/lib/hooks";

function dDayText(config) {
  if (!config) return "";
  const now = new Date();
  const start = new Date(config.uploadStart);
  const end = new Date(config.uploadEnd);
  const daysUntil = (date) => Math.ceil((date - now) / 86400000);

  if (config.winningNumbers?.length === 3) return "🎉 추첨 완료!";
  if (config.winningNumbers?.length > 0) return "🎰 추첨 진행 중!";
  if (now < start) return `시작까지 ${daysUntil(start)}일`;
  if (now <= end) {
    // 남은 시간이 하루 미만이면 "오늘 마감" (ceil을 쓰면 마지막 날에도 1일로 보인다)
    const days = Math.floor((end - now) / 86400000);
    return days === 0 ? "오늘 마감" : `마감까지 ${days}일`;
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
    if (config) setCurrentConfig(config);
  }, [config]);

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
    ["/board", "빙고"],
    ["/lotto", "로또"],
    ["/challenge", "챌린지"],
    ["/event", "오프라인 행사"],
  ];

  const prefetchMenu = (href) => {
    const apiPath = href === "/board" ? "/api/board" : href === "/lotto" ? "/api/lotto" : null;
    if (apiPath) prefetchApiData(apiPath).catch(() => {});
  };

  return (
    <>
      <nav className="nav">
        <div className="nav-heading">
          <Link href="/" className="brand" aria-label="YSRC SUMMER FEST 2026 온라인 위크 이벤트 홈">
            <img className="brand-logo" src="/YSRC_logo_black.png" alt="" width="592" height="174" />
            <span className="brand-copy">
              <strong>SUMMER FEST <em>2026</em></strong>
              <span className="brand-sub">온라인 위크 이벤트</span>
              {currentConfig && <span className="nav-deadline">{dDayText(currentConfig)}</span>}
            </span>
          </Link>
        </div>
        <NoticeBar notices={currentConfig?.notices || []} />
        <div className="nav-links">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={pathname === href ? "active" : ""}
              onMouseEnter={() => prefetchMenu(href)}
              onFocus={() => prefetchMenu(href)}
              onTouchStart={() => prefetchMenu(href)}
            >
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <LottoDeadlineReminder config={currentConfig} />
    </>
  );
}
