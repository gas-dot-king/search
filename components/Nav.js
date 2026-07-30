"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LottoDeadlineReminder from "./LottoDeadlineReminder";
import HallOfFameLink from "./HallOfFameLink";
import SettingsLink from "./SettingsLink";
import SocialLink from "./SocialLink";
import { prefetchApiData } from "@/lib/hooks";

function dDayText(config, now = new Date()) {
  if (!config) return "";
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
    if (notices.length > 1) {
      setIndex(Math.floor(Math.random() * notices.length));
    } else {
      setIndex(0);
    }
    if (notices.length < 2) return;
    const timer = setInterval(() => setIndex((current) => (current + 1) % notices.length), 5000);
    return () => clearInterval(timer);
  }, [notices.length]);

  if (notices.length === 0) return null;
  const current = index % notices.length;

  return (
    <div className="notice-bar">
      {/* key를 바꿔 다시 마운트시키면 공지가 넘어갈 때마다 페이드 인이 다시 재생된다 */}
      <span className="notice-text" key={current}>📢 {notices[current]}</span>
      {notices.length > 1 && (
        <span className="notice-nav" role="group" aria-label="공지 넘기기">
          <button type="button" onClick={() => setIndex((current - 1 + notices.length) % notices.length)} aria-label="이전 공지">
            ‹
          </button>
          <span aria-live="polite">{current + 1}/{notices.length}</span>
          <button type="button" onClick={() => setIndex((current + 1) % notices.length)} aria-label="다음 공지">
            ›
          </button>
        </span>
      )}
    </div>
  );
}

export default function Nav({ config, configLoading = false }) {
  const pathname = usePathname();
  const [currentConfig, setCurrentConfig] = useState(config || null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (config) setCurrentConfig(config);
  }, [config]);

  useEffect(() => {
    if (currentConfig || configLoading) return;
    let active = true;
    fetch("/api/config")
      .then((response) => {
        if (!response.ok) throw new Error("설정을 불러오지 못했습니다.");
        return response.json();
      })
      .then((data) => active && setCurrentConfig(data))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [configLoading, currentConfig]);

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
        <div className="nav-brand-row">
          <Link href="/" className="brand" aria-label="YSRC SUMMER FEST 2026 온라인 위크 이벤트 홈">
            <img className="brand-logo" src="/YSRC_logo_black.png" alt="YSRC" width="592" height="174" />
            <span className="brand-copy">
              <strong>SUMMER FEST <em>2026</em> <span>온라인 위크 이벤트</span></strong>
              {currentConfig && <span className="nav-deadline">{dDayText(currentConfig, now)}</span>}
            </span>
          </Link>
        </div>
        <div className="nav-heading">
          <HallOfFameLink active={pathname === "/hall"} />
          <SocialLink
            href="https://daangn.com/kr/share/community/ref/invite-group/8AYyjpELhF"
            label="당근"
            type="carrot"
          />
          <SocialLink
            href="https://www.instagram.com/team_ysrc"
            label="인스타그램"
            type="instagram"
          />
          <SettingsLink active={pathname === "/settings"} />
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
