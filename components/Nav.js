"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LottoDeadlineReminder from "./LottoDeadlineReminder";
import HallOfFameLink from "./HallOfFameLink";
import SettingsLink from "./SettingsLink";
import SocialLink from "./SocialLink";
import Modal from "./Modal";
import { fetchPublicConfig, prefetchApiData } from "@/lib/hooks";
import { recoveryNotice, recoveryState, RECOVERY_STATES } from "@/lib/recovery";
import {
  NOTICE_HIDDEN_UNTIL_KEY,
  NOTICE_VISIBILITY_EVENT,
  NOTICE_ONE_DAY_MS,
} from "@/lib/notice";

function dDayText(config, now = new Date()) {
  if (!config) return "";
  const recovery = recoveryState(config.recovery, now);
  if (recovery === RECOVERY_STATES.ACTIVE) return "🔥 복구 중";
  if (recovery === RECOVERY_STATES.NOTICE) return "⚠️ 자정 복구";
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
  const [dismissed, setDismissed] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    try {
      const hiddenUntil = Number(localStorage.getItem(NOTICE_HIDDEN_UNTIL_KEY) || 0);
      if (hiddenUntil > Date.now()) {
        setDismissed(true);
      } else {
        localStorage.removeItem(NOTICE_HIDDEN_UNTIL_KEY);
      }
    } catch {
      // 저장소가 막힌 환경에서는 현재 페이지에서만 닫기 기능을 사용한다.
    }
  }, []);

  useEffect(() => {
    function syncDismissed() {
      try {
        setDismissed(Number(localStorage.getItem(NOTICE_HIDDEN_UNTIL_KEY) || 0) > Date.now());
      } catch {
        setDismissed(true);
      }
    }
    window.addEventListener(NOTICE_VISIBILITY_EVENT, syncDismissed);
    return () => window.removeEventListener(NOTICE_VISIBILITY_EVENT, syncDismissed);
  }, []);

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

  if (notices.length === 0 || dismissed) return null;
  const current = index % notices.length;

  function dismissNotice() {
    setConfirmOpen(false);
    setDismissed(true);
  }

  function dismissForDay() {
    try {
      localStorage.setItem(NOTICE_HIDDEN_UNTIL_KEY, String(Date.now() + NOTICE_ONE_DAY_MS));
    } catch {
      // 저장소가 막혀도 현재 화면에서는 공지를 닫는다.
    }
    dismissNotice();
  }

  return (
    <>
      <div
        className="notice-bar top-notice-bar"
        role="button"
        tabIndex={0}
        aria-label="공지 닫기 메뉴 열기"
        onClick={() => setConfirmOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setConfirmOpen(true);
          }
        }}
      >
        {/* key를 바꿔 다시 마운트시키면 공지가 넘어갈 때마다 페이드 인이 다시 재생된다 */}
        <span className="notice-text" key={current}>📢 {notices[current]}</span>
        {notices.length > 1 && (
          <span className="notice-nav" role="group" aria-label="공지 넘기기">
            <span className="notice-dots" aria-label={`${current + 1}번째 공지`}>
              {notices.map((_, dotIndex) => (
                <span key={dotIndex} className={dotIndex === current ? "active" : ""} />
              ))}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setIndex((current + 1) % notices.length);
              }}
              aria-label="다음 공지"
            >
              &gt;
            </button>
          </span>
        )}
      </div>
      {confirmOpen && (
        <Modal label="공지 닫기" onClose={() => setConfirmOpen(false)}>
          <h3>공지를 닫으시겠습니까?</h3>
          <p className="hint notice-dismiss-hint">하루 동안 닫으면 24시간 동안 모든 페이지에서 공지가 보이지 않아요.</p>
          <div className="notice-dismiss-actions">
            <button type="button" className="btn primary" onClick={dismissNotice}>예</button>
            <button type="button" className="btn ghost" onClick={() => setConfirmOpen(false)}>아니오</button>
            <button type="button" className="btn ghost notice-dismiss-day" onClick={dismissForDay}>하루 동안 닫기</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function RecoveryStatusBar({ event }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const state = recoveryState(event, now);
  if (state !== RECOVERY_STATES.NOTICE && state !== RECOVERY_STATES.ACTIVE) return null;

  const target = state === RECOVERY_STATES.NOTICE ? new Date(event.startAt) : new Date(event.endAt);
  const remaining = Math.max(0, target.getTime() - now.getTime());
  const hours = String(Math.floor(remaining / 3600000)).padStart(2, "0");
  const minutes = String(Math.floor((remaining % 3600000) / 60000)).padStart(2, "0");
  const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(2, "0");

  return (
    <Link href={state === RECOVERY_STATES.ACTIVE ? "/recovery" : "/recovery"} className={`recovery-status-bar ${state}`}>
      <span className="recovery-status-siren" aria-hidden="true">🚨</span>
      <span className="recovery-status-copy">
        <strong>{state === RECOVERY_STATES.NOTICE ? "오늘 자정 긴급 복구 예정" : "인증 서버 긴급 복구 중"}</strong>
        <small>{recoveryNotice(event, state)}</small>
      </span>
      <b className="recovery-status-countdown" aria-label="복구 상태까지 남은 시간">{hours}:{minutes}:{seconds}</b>
    </Link>
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
    fetchPublicConfig()
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
        <div className="nav-heading">
          <Link href="/" className="brand brand-logo-link" aria-label="YSRC 홈">
            <img className="brand-logo" src="/YSRC_logo_black.png" alt="YSRC" width="592" height="174" />
          </Link>
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
        <div className="nav-title-row">
          <Link href="/" className="nav-event-title" aria-label="양산 슬로우러닝 썸머 페스티벌 2026 홈">
            <strong>양산 슬로우러닝 썸머 페스티벌 2026</strong>
            <span>YANGSAN SLOWRUNNING SUMMER FEST 2026</span>
          </Link>
          {currentConfig && <span className="nav-deadline">{dDayText(currentConfig, now)}</span>}
        </div>
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
      <div className="top-notice-slot">
        <NoticeBar notices={currentConfig?.notices || []} />
        <RecoveryStatusBar event={currentConfig?.recovery} />
      </div>
      <LottoDeadlineReminder config={currentConfig} />
    </>
  );
}
