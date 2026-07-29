"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { api, getToken, TOKEN_KEY } from "@/lib/client";
import { KAKAO_CONTACT_URL } from "@/lib/contact";

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
  const [loading, setLoading] = useState(true);
  const [dark, setDark] = useState(false);
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
        setLoading(false);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  useEffect(() => () => clearTimeout(redirectTimer.current), []);

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
      </section>

      <section className="card settings-card" aria-labelledby="pin-title">
        <h2 id="pin-title" className="card-title">PIN 변경</h2>
        <p className="hint">본인 확인을 위해 현재 PIN을 먼저 입력해주세요.</p>
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
