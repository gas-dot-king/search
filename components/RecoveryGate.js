"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchPublicConfig } from "@/lib/hooks";
import { isRecoveryGatedPath, msUntilRecoveryChange, recoveryIsActive } from "@/lib/recovery";

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
    if (recoveryIsActive(event)) {
      router.replace("/recovery");
      return;
    }
    // 매초 확인할 이유가 없다. 복구가 시작되는 시각에 딱 한 번만 깨어난다.
    // (그 전에 화면을 옮기면 이 효과가 정리되고 새 경로에서 다시 잡힌다)
    const wait = msUntilRecoveryChange(event);
    if (wait === null) return;
    const timer = setTimeout(() => {
      if (recoveryIsActive(event)) router.replace("/recovery");
    }, wait + 250);
    return () => clearTimeout(timer);
  }, [event, pathname, router]);

  return null;
}
