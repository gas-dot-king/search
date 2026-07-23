"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "pwa-install-dismissed";

function isIos() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches || localStorage.getItem(DISMISS_KEY)) return;
    navigator.serviceWorker?.register("/sw.js").catch(() => {});

    const onBeforeInstall = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    setShowIosGuide(isIos());
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDeferredPrompt(null);
    setShowIosGuide(false);
  }

  async function install() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    dismiss();
  }

  if (!deferredPrompt && !showIosGuide) return null;

  return (
    <div className="install-prompt" role="dialog" aria-label="홈 화면에 추가">
      <span>🏃 매일 쉽게 참여하려면 홈 화면에 추가하세요.</span>
      {deferredPrompt ? (
        <button type="button" onClick={install}>추가하기</button>
      ) : (
        <span className="install-guide">Safari 공유 버튼 → 홈 화면에 추가</span>
      )}
      <button type="button" className="install-dismiss" onClick={dismiss} aria-label="안내 닫기">×</button>
    </div>
  );
}
