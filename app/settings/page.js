"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { INSTALL_PROMPT_EVENT } from "@/components/InstallPrompt";
import Modal from "@/components/Modal";
import { api, getToken, TOKEN_KEY } from "@/lib/client";
import { KAKAO_CONTACT_URL } from "@/lib/contact";
import { hideNoticeForDay } from "@/lib/notice";

const THEME_KEY = "ow_theme";
const digitsOnly = (value) => value.replace(/\D/g, "").slice(0, 4);
const syncThemeColor = (isDark) => {
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", isDark ? "#0f172a" : "#e11d48");
};

export default function SettingsPage() {
  const router = useRouter();
  const redirectTimer = useRef(null);
  const [nickname, setNickname] = useState("");
  const [joinedAt, setJoinedAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [installMessage, setInstallMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [showPinModal, setShowPinModal] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [newPinConfirm, setNewPinConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const isDark = document.documentElement.dataset.theme === "dark";
    setDark(isDark);
    syncThemeColor(isDark);
    if (!getToken()) {
      router.replace("/");
      return;
    }
    api("/api/me")
      .then((me) => {
        setNickname(me.nickname);
        setJoinedAt(me.createdAt || "");
        setLoading(false);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

  useEffect(() => {
    const syncInstallState = () => {
      setInstallReady(Boolean(window.__ysrcInstallPrompt));
      setInstalled(
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean(window.navigator.standalone)
      );
    };
    syncInstallState();
    window.addEventListener(INSTALL_PROMPT_EVENT, syncInstallState);
    return () => window.removeEventListener(INSTALL_PROMPT_EVENT, syncInstallState);
  }, []);

  function changeTheme(nextDark) {
    const theme = nextDark ? "dark" : "light";
    setDark(nextDark);
    document.documentElement.dataset.theme = theme;
    syncThemeColor(nextDark);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // 저장 공간이 막힌 브라우저에서도 현재 화면에는 테마를 적용합니다.
    }
  }

  function closeNoticeForDay() {
    hideNoticeForDay();
    setNoticeMessage("공지사항을 하루 동안 닫았어요.");
  }

  async function addToHomeScreen() {
    setInstallMessage("");
    if (installed) {
      setInstallMessage("이미 홈 화면에서 실행 중이에요.");
      return;
    }

    const prompt = window.__ysrcInstallPrompt;
    if (prompt) {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      window.__ysrcInstallPrompt = null;
      setInstallReady(false);
      setInstallMessage(
        choice.outcome === "accepted"
          ? "홈 화면 추가를 진행했어요."
          : "홈 화면 추가를 취소했어요."
      );
      return;
    }

    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    setInstallMessage(
      ios
        ? "Safari 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택해주세요."
        : "브라우저 메뉴에서 ‘홈 화면에 추가’ 또는 ‘앱 설치’를 선택해주세요."
    );
  }

  async function changePin(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPin !== newPinConfirm) {
      setError("새 PIN 확인이 일치하지 않습니다.");
      return;
    }

    setBusy(true);
    try {
      const result = await api("/api/account/pin", {
        method: "PATCH",
        body: JSON.stringify({ currentPin, newPin, newPinConfirm }),
      });
      setCurrentPin("");
      setNewPin("");
      setNewPinConfirm("");
      try {
        localStorage.setItem(TOKEN_KEY, result.token);
      } catch {
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch {
          // 저장소가 완전히 차단된 경우에도 아래 안내 후 로그인 화면으로 이동합니다.
        }
        setSuccess("PIN은 변경되었지만 자동 로그인을 저장하지 못했어요. 새 PIN으로 다시 로그인해주세요.");
        redirectTimer.current = setTimeout(() => router.replace("/"), 1800);
        return;
      }
      setSuccess("PIN이 변경되었습니다. 다음 로그인부터 새 PIN을 사용해주세요.");
    } catch (requestError) {
      setError(
        requestError.status
          ? requestError.message
          : "서버 응답을 확인하지 못했어요. PIN이 변경됐을 수도 있으니 다시 로그인할 때 새 PIN을 먼저 사용해주세요."
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    if (!confirm("이 기기에서 로그아웃할까요?")) return;
    setBusy(true);
    try {
      await api("/api/account/session", { method: "DELETE" });
    } catch {
      // 서버 연결이 끊겨도 이 기기에 남은 토큰은 반드시 제거한다.
    } finally {
      try {
        localStorage.removeItem(TOKEN_KEY);
      } catch {
        // 저장소가 차단된 환경에서는 로그인 화면으로 이동해 보호 페이지 접근을 막는다.
      }
      setBusy(false);
      router.replace("/");
    }
  }

  return (
    <main className="wrap">
      <Nav />

      <header className="settings-heading">
        <p className="settings-kicker">MY SETTINGS</p>
        <h1 className="section-title">⚙️ 설정</h1>
        <p className="hint">
          {loading ? "계정을 확인하고 있어요..." : `${nickname}님의 기기와 계정 설정입니다.`}
        </p>
      </header>

      <section className="card settings-card" aria-labelledby="theme-title">
        <button
          type="button"
          className="theme-toggle-row"
          role="switch"
          aria-checked={dark}
          onClick={() => changeTheme(!dark)}
        >
          <span>
            <strong id="theme-title">다크모드</strong>
            <small>{dark ? "어두운 화면을 사용하고 있어요." : "밝은 화면을 사용하고 있어요."}</small>
          </span>
          <span className={`theme-switch ${dark ? "on" : ""}`} aria-hidden="true">
            <span />
          </span>
        </button>
        <div className="home-install-row">
          <span>
            <strong id="install-title">홈 화면에 추가하기</strong>
            <small>
              {installReady ? "지금 바로 홈 화면에 추가할 수 있어요." : "앱처럼 빠르게 접속할 수 있어요."}
            </small>
          </span>
          <button
            type="button"
            className="home-install-button"
            onClick={addToHomeScreen}
            aria-label="홈 화면에 추가하기"
            disabled={installed}
          >
            {installed ? "✓" : "+"}
          </button>
        </div>
        {installMessage && <p className="home-install-message" role="status">{installMessage}</p>}
        <div className="settings-notice-row">
          <span>
            <strong>공지사항 하루 동안 닫기</strong>
            <small>24시간 동안 공지사항을 표시하지 않아요.</small>
          </span>
          <button type="button" className="settings-notice-button" onClick={closeNoticeForDay}>
            닫기
          </button>
        </div>
        {noticeMessage && <p className="home-install-message" role="status">{noticeMessage}</p>}
      </section>

      <section className="card settings-card" aria-labelledby="pin-title">
        <h2 id="pin-title" className="card-title">PIN 변경</h2>
        <p className="hint">본인 확인을 위해 현재 PIN을 먼저 입력해주세요. PIN을 10회 틀리면 관리자 초기화가 필요해요.</p>
        <button type="button" className="btn ghost settings-pin-toggle" onClick={() => setShowPinModal(true)} disabled={busy}>
          PIN 변경하기
        </button>
        {showPinModal && (
          <Modal label="PIN 변경" onClose={() => setShowPinModal(false)}>
            <h3>PIN 변경</h3>
            <p className="hint">현재 PIN과 새 PIN을 입력해주세요.</p>
            <form onSubmit={changePin}>
          <label htmlFor="current-pin">현재 PIN</label>
          <input
            id="current-pin"
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            pattern="\d{4}"
            maxLength={4}
            value={currentPin}
            onChange={(event) => setCurrentPin(digitsOnly(event.target.value))}
            placeholder="숫자 4자리"
            required
          />

          <label htmlFor="new-pin">새 PIN</label>
          <input
            id="new-pin"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{4}"
            maxLength={4}
            value={newPin}
            onChange={(event) => setNewPin(digitsOnly(event.target.value))}
            placeholder="숫자 4자리"
            required
          />

          <label htmlFor="new-pin-confirm">새 PIN 확인</label>
          <input
            id="new-pin-confirm"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="\d{4}"
            maxLength={4}
            value={newPinConfirm}
            onChange={(event) => setNewPinConfirm(digitsOnly(event.target.value))}
            placeholder="한 번 더 입력"
            required
          />

          {error && <p className="error-msg" role="alert">{error}</p>}
          {success && <p className="success-msg" role="status">{success}</p>}

          <button
            className="btn primary settings-save"
            disabled={
              loading ||
              busy ||
              currentPin.length !== 4 ||
              newPin.length !== 4 ||
              newPinConfirm.length !== 4
            }
          >
            {busy ? "변경 중..." : "PIN 변경하기"}
          </button>
            </form>
          </Modal>
        )}
      </section>

      <section className="card settings-card" aria-labelledby="session-title">
        <h2 id="session-title" className="card-title">로그인 기기</h2>
        <p className="hint">공용 기기에서는 사용 후 로그아웃해주세요.</p>
        <p className="settings-meta">가입일 <b>{joinedAt ? new Date(joinedAt).toLocaleString("ko-KR") : "확인 중"}</b></p>
        <div className="settings-session-action">
          <button type="button" className="btn ghost settings-save" onClick={signOut} disabled={busy}>
            로그아웃
          </button>
        </div>
      </section>

      <section className="card settings-card contact-card" aria-labelledby="help-title">
        <span className="contact-card-icon" aria-hidden="true">💬</span>
        <h2 id="help-title" className="card-title">문의하기</h2>
        <p className="hint">궁금한 점이나 이용 중 불편한 점을 알려주세요.</p>
        <a
          className="btn primary settings-contact-button"
          href={KAKAO_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          카카오톡 오픈채팅 연결
        </a>
        <p className="contact-card-note">전화 문의는 페이지 맨 아래의 ‘문의하기’에서 선택할 수 있어요.</p>
      </section>
    </main>
  );
}
