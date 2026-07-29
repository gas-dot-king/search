"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export default function LottoDeadlineReminder({ config }) {
  const [reminder, setReminder] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!config?.uploadEnd || config.winningNumbers) {
      setReminder(null);
      return;
    }

    const deadlineDiff = new Date(config.uploadEnd).getTime() - now;
    // 하루 미만 남으면 0(오늘 마감)으로 표시되도록 floor 사용
    const days = deadlineDiff < 0 ? null : Math.floor(deadlineDiff / 86400000);
    if (days == null || days > 2) {
      setReminder(null);
      return;
    }

    let cancelled = false;
    api("/api/lotto?summary=1")
      .then((data) => {
        const remainingEntries = data.maxEntries - data.entryCount;

        if (!cancelled && !data.winningNumbers && remainingEntries > 0) {
          setReminder({ remainingEntries, days });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [config?.uploadEnd, config?.winningNumbers, now]);

  if (!reminder) return null;

  return (
    <div className="lotto-reminder" role="status">
      🎟️ 응모권 {reminder.remainingEntries}장이 남았어요! {reminder.days === 0 ? "오늘 마감" : `마감까지 D-${reminder.days}`}
    </div>
  );
}
