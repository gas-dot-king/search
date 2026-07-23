"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";

export default function LottoDeadlineReminder() {
  const [reminder, setReminder] = useState(null);

  useEffect(() => {
    api("/api/lotto?summary=1")
      .then((data) => {
        const remainingEntries = data.maxEntries - data.entryCount;
        const deadlineDiff = new Date(data.uploadEnd).getTime() - Date.now();
        const days = deadlineDiff < 0 ? null : Math.ceil(deadlineDiff / 86400000);

        if (!data.winningNumbers && remainingEntries > 0 && days != null && days <= 2) {
          setReminder({ remainingEntries, days });
        }
      })
      .catch(() => {});
  }, []);

  if (!reminder) return null;

  return (
    <div className="lotto-reminder" role="status">
      🎟️ 응모권 {reminder.remainingEntries}장이 남았어요! {reminder.days === 0 ? "오늘 마감" : `마감까지 D-${reminder.days}`}
    </div>
  );
}
