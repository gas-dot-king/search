"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchPublicConfig } from "@/lib/hooks";
import { isRecoveryGatedPath, recoveryIsActive } from "@/lib/recovery";

/**
 * 긴급 복구가 진행 중인 동안 회원이 어디를 눌러도 복구 인증센터로 보낸다.
 *
 * 전에는 배너를 눌러야만 갈 수 있어서, 빙고·로또를 눌러 들어온 회원이
 * "왜 안 되지" 하다가 그냥 나갔다. 인증이 잠긴 화면을 보여줄 이유가 없다.
 */
export default function RecoveryGate() {
  const router = useRouter();
  const pathname = usePathname();
  const [event, setEvent] = useState(null);

  useEffect(() => {
    let active = true;
    fetchPublicConfig()
      .then((config) => active && setEvent(config.recovery || null))
      .catch(() => {});
    return () => { active = false; };
  }, [pathname]);

  useEffect(() => {
    if (!event || !isRecoveryGatedPath(pathname)) return;
    // 복구가 끝나는 순간 원래 화면으로 돌아갈 수 있어야 하므로 주기적으로 다시 본다.
    const check = () => {
      if (recoveryIsActive(event)) router.replace("/recovery");
    };
    check();
    const timer = setInterval(check, 1000);
    return () => clearInterval(timer);
  }, [event, pathname, router]);

  return null;
}
