"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export default function LottoDeadlineReminder({ config }) {
  const [reminder, setReminder] = useState(null);

  useEffect(() => {
    if (!config?.uploadEnd || config.winningNumbers) {
      setReminder(null);
      return;
    }

    const deadlineDiff = new Date(config.uploadEnd).getTime() - Date.now();
    const days = deadlineDiff < 0 ? null : Math.ceil(deadlineDiff / 86400000);
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
  }, [config?.uploadEnd, config?.winningNumbers]);

  if (!reminder) return null;

  return (
    <div className="lotto-reminder" role="status">
      🎟️ 응모권 {reminder.remainingEntries}장이 남았어요! {reminder.days === 0 ? "오늘 마감" : `마감까지 D-${reminder.days}`}
    </div>
  );
}
