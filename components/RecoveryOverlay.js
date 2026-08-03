"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Modal from "./Modal";
import { fetchPublicConfig } from "@/lib/hooks";
import { recoveryState, RECOVERY_STATES } from "@/lib/recovery";

const SEEN_KEY = "ow_recovery_notice_seen_20260804";

export default function RecoveryOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const [event, setEvent] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPublicConfig()
      .then((config) => active && setEvent(config.recovery || null))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!event) return;
    const state = recoveryState(event, now);
    if (state !== RECOVERY_STATES.NOTICE && state !== RECOVERY_STATES.ACTIVE) return;
    try {
      if (localStorage.getItem(SEEN_KEY) !== "1") setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [event, now]);

  function close() {
    try { localStorage.setItem(SEEN_KEY, "1"); } catch {}
    setOpen(false);
  }

  if (!open || pathname?.startsWith("/admin")) return null;
  const active = recoveryState(event, now) === RECOVERY_STATES.ACTIVE;

  return (
    <Modal label="긴급 복구 안내" onClose={close} className="recovery-alert-modal">
      <div className="recovery-alert-light" aria-hidden="true">🚨</div>
      <p className="recovery-alert-kicker">SERVER STATUS: CRITICAL(?)</p>
      <h2>🔥 인증 서버가 불탔습니다!</h2>
      <div className="recovery-terminal" aria-label="가상 서버 진단 로그">
        <p><span>[CRITICAL]</span> 인증 처리량 999% 초과</p>
        <p><span>[CAUSE]</span> 회원들이 너무 열심히 함</p>
        <p><span>[DATA LOSS]</span> 0건 — 기록은 안전함</p>
        <p><span>[RECOVERY]</span> 소화기 들고 출동 중 🧯</p>
      </div>
      <p className="recovery-alert-copy">
        {active
          ? "지금부터 긴급 복구에 들어갑니다. 기존 빙고·로또 인증은 잠시 쉬고 복구 인증센터만 이용해주세요."
          : "오늘 자정부터 긴급 복구에 들어갑니다. 서버를 식히는 동안 하루만 숨을 고를게요."}
      </p>
      <p className="recovery-fake-note">※ 실제 장애가 아닌 컨셉 이벤트입니다. 데이터는 멀쩡합니다 😎</p>
      <div className="modal-actions">
        {active && (
          <button type="button" className="btn primary" onClick={() => { close(); router.push("/recovery"); }}>
            긴급 복구 인증센터
          </button>
        )}
        <button type="button" className="btn ghost" onClick={close}>{active ? "상황 확인 완료" : "알겠습니다"}</button>
      </div>
    </Modal>
  );
}
