"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function dDayText(cfg) {
  if (!cfg) return "";
  const now = new Date();
  const start = new Date(cfg.uploadStart);
  const end = new Date(cfg.uploadEnd);
  const days = (a, b) => Math.ceil((a - b) / 86400000);

  if (cfg.winningNumbers) return "🎉 추첨 완료!";
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
      {cfg?.notice && <div className="notice-bar">📢 {cfg.notice}</div>}
    </>
  );
}
