"use client";

import { useEffect } from "react";

export const INSTALL_PROMPT_EVENT = "ysrc-install-prompt-ready";

export default function InstallPrompt() {
  useEffect(() => {
    navigator.serviceWorker?.register("/sw.js").catch(() => {});

    const onBeforeInstall = (event) => {
      event.preventDefault();
      window.__ysrcInstallPrompt = event;
      window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    };
    const onInstalled = () => {
      window.__ysrcInstallPrompt = null;
      window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  return null;
}
