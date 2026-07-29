"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "pwa-install-dismissed-until";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [dontShowWeek, setDontShowWeek] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const dismissedUntil = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedUntil > Date.now()) return;

    navigator.serviceWorker?.register("/sw.js").catch(() => {});
    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    const timer = window.setTimeout(() => {
      setShowIosGuide(isIos());
      setShow(true);
    }, 450);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  function close() {
    if (dontShowWeek) localStorage.setItem(DISMISS_KEY, String(Date.now() + WEEK_MS));
    setShow(false);
  }

  async function install() {
    if (!deferredPrompt) {
      close();
      return;
    }
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    close();
  }

  if (!show) return null;

  return (
    <div className="install-modal-bg" role="presentation">
      <section className="install-modal" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <div className="install-app-icon" aria-hidden="true">🏃</div>
        <h2 id="install-title">홈 화면에 추가할까요?</h2>
        <p>핸드폰 홈 화면에 저장하면 다음에 더 간편하게 접속할 수 있어요.</p>
        {showIosGuide && <small className="install-ios-guide">Safari의 공유 버튼에서 ‘홈 화면에 추가’를 선택해주세요.</small>}
        <div className="install-actions">
          <button type="button" className="btn primary" onClick={install}>예</button>
          <button type="button" className="btn ghost" onClick={close}>아니오</button>
        </div>
        <label className="install-week-check">
          <input type="checkbox" checked={dontShowWeek} onChange={(event) => setDontShowWeek(event.target.checked)} />
          일주일간 보지 않기
        </label>
      </section>
    </div>
  );
}
