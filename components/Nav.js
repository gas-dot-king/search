"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import LottoDeadlineReminder from "./LottoDeadlineReminder";

function dDayText(cfg) {
  if (!cfg) return "";
  const now = new Date();
  const start = new Date(cfg.uploadStart);
  const end = new Date(cfg.uploadEnd);
  const days = (a, b) => Math.ceil((a - b) / 86400000);

  if (cfg.winningNumbers?.length === 4) return "🎉 추첨 완료!";
  if (cfg.winningNumbers?.length > 0) return "🎰 추첨 진행 중!";
  if (now < start) return `시작까지 D-${days(start, now)}`;
  if (now <= end) {
    const d = days(end, now);
    return d === 0 ? "오늘 마감!" : `마감까지 D-${d}`;
  }
  const drawDate = cfg.drawDate ? new Date(cfg.drawDate + "T00:00:00+09:00") : null;
  if (drawDate && now < new Date(drawDate.getTime() + 86400000)) {
    return `업로드 마감 · ${drawDate.getMonth() + 1}/${drawDate.getDate()} 추첨`;
  }
  return "이벤트 종료";
}

/** 공지 여러 개를 5초 간격 로테이션 + 수동 이동 버튼 */
function NoticeBar({ notices }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (notices.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % notices.length), 5000);
    return () => clearInterval(t);
  }, [notices.length, idx]); // idx 포함 → 수동 이동 후에도 5초 다시 대기

  if (notices.length === 0) return null;
  const cur = idx % notices.length;
  const move = (d) => setIdx((cur + d + notices.length) % notices.length);

  return (
    <div className="notice-bar">
      <span className="notice-text">📢 {notices[cur]}</span>
      {notices.length > 1 && (
        <span className="notice-ctrl">
          <button type="button" onClick={() => move(-1)} aria-label="이전 공지">‹</button>
          <em>{cur + 1}/{notices.length}</em>
          <button type="button" onClick={() => move(1)} aria-label="다음 공지">›</button>
        </span>
      )}
    </div>
  );
}

export default function Nav({ config }) {
  const pathname = usePathname();
  const [cfg, setCfg] = useState(config || null);

  useEffect(() => {
    if (!cfg) {
      fetch("/api/config").then((r) => r.json()).then(setCfg).catch(() => {});
    }
  }, [cfg]);

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
          <a key={href} href={href} className={pathname === href ? "active" : ""}>
            {label}
          </a>
        ))}
        <span className="dday">{dDayText(cfg)}</span>
      </nav>
      <NoticeBar notices={cfg?.notices || []} />
      <LottoDeadlineReminder />
    </>
  );
}
