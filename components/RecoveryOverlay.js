"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Modal from "./Modal";
import { fetchPublicConfig } from "@/lib/hooks";
import {
  recoveryHideKey,
  recoveryState,
  RECOVERY_PRIZE_NOTE,
  RECOVERY_HIDE_HOUR_MS,
  RECOVERY_STATES,
} from "@/lib/recovery";

export default function RecoveryOverlay() {
  const router = useRouter();
  const pathname = usePathname();
  const [event, setEvent] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  // 저장소가 막힌 브라우저(사파리 비공개 등)에서도 닫힘이 유지되도록 메모리에도 남긴다.
  const memoryHideRef = useRef({});

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

  // 복구가 시작된 뒤에는 팝업 대신 전체 화면 톤으로 서버 상태를 알린다.
  useEffect(() => {
    const state = event ? recoveryState(event, now) : "before_notice";
    document.documentElement.dataset.recoveryState = state;
    document.body.dataset.recoveryState = state;
    return () => {
      delete document.documentElement.dataset.recoveryState;
      delete document.body.dataset.recoveryState;
    };
  }, [event, now]);

  const hiddenUntil = useCallback((key) => {
    const memory = memoryHideRef.current[key] || 0;
    try {
      const stored = Number(localStorage.getItem(key));
      return Math.max(memory, Number.isFinite(stored) ? stored : 0);
    } catch {
      return memory;
    }
  }, []);

  // 1초마다 다시 확인하므로, 숨김이 풀리는 순간 알아서 다시 뜬다.
  useEffect(() => {
    if (!event) return;
    const state = recoveryState(event, now);
    // 오늘 공지 시간에만 팝업을 띄운다. 자정 이후에는 복구 화면으로 안내한다.
    if (state !== RECOVERY_STATES.NOTICE) {
      setOpen(false);
      return;
    }
    if (Date.now() < hiddenUntil(recoveryHideKey(event, state))) return;
    setOpen(true);
  }, [event, now, hiddenUntil]);

  const hideFor = useCallback((ms) => {
    const key = recoveryHideKey(event, recoveryState(event, new Date()));
    const until = Date.now() + ms;
    memoryHideRef.current[key] = until;
    try {
      localStorage.setItem(key, String(until));
    } catch {
      // 메모리 사본만으로도 이번 방문 동안은 다시 뜨지 않는다.
    }
    setOpen(false);
  }, [event]);

  const close = useCallback(() => hideFor(RECOVERY_HIDE_HOUR_MS), [hideFor]);

  if (!open || pathname?.startsWith("/admin")) return null;
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
      <p className="recovery-alert-copy">오늘 자정부터 긴급 복구에 들어갑니다. 서버를 식히는 동안 하루만 숨을 고를게요.</p>
      <p className="recovery-prize-note">{RECOVERY_PRIZE_NOTE}</p>
      <p className="recovery-fake-note">※ 실제 장애가 아닌 컨셉 이벤트입니다. 데이터는 멀쩡합니다 😎</p>
      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={close}>확인했습니다.</button>
      </div>
      <div className="modal-actions">
        <button type="button" className="btn ghost notice-dismiss-faq" onClick={() => { close(); router.push("/faq"); }}>
          자주 하는 질문
        </button>
      </div>
    </Modal>
  );
}
