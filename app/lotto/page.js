"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "@/components/Nav";
import { api, getToken, resizeImage, PRIVACY_WARNING } from "@/lib/client";

export default function LottoPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const digitRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  const load = useCallback(async () => {
    try {
      setData(await api("/api/lotto"));
    } catch (err) {
      if (err.status === 401) router.replace("/");
      else setError(err.message);
    }
  }, [router]);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/");
      return;
    }
    load();
  }, [load, router]);

  function setDigit(i, v) {
    const d = v.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 3) digitRefs[i + 1].current?.focus();
  }

  async function onPick(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true);
    setError("");
    try {
      const blob = await resizeImage(f);
      setFile(blob);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(blob));
    } catch {
      setError("사진을 처리하지 못했어요.");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  async function submit() {
    const code = digits.join("");
    if (code.length !== 4) return setError("기록 4자리를 모두 입력해주세요.");
    if (!file) return setError("인증 사진을 선택해주세요.");
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("digits", code);
      form.append("file", file, "lotto.jpg");
      await api("/api/lotto", { method: "POST", body: form });
      setDigits(["", "", "", ""]);
      setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id) {
    if (!confirm("이 응모를 취소할까요? 사진도 삭제됩니다.")) return;
    try {
      await api("/api/lotto", { method: "DELETE", body: JSON.stringify({ id }) });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data)
    return (
      <main className="wrap">
        <Nav />
        <p className="hint">{error || "불러오는 중..."}</p>
      </main>
    );

  const drawn = Boolean(data.winningNumbers);
  const canApply = !drawn && data.entries.length < data.maxEntries;

  const fmt = (d) => `${d.slice(0, 2)}.${d.slice(2)}`;

  return (
    <main className="wrap">
      <Nav />
      <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "8px 0" }}>🎰 달리기 로또</h2>

      {/* 추첨 결과 */}
      {drawn && (
        <div className="card" style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>당첨 번호</p>
          <div className="winning-digits">
            {data.winningNumbers.split("").map((d, i) => (
              <span key={i} className="winning-digit">{d}</span>
            ))}
          </div>
          <p className="hint">기록 {fmt(data.winningNumbers)} km 와 자리별로 비교해요</p>
        </div>
      )}

      {/* 내 응모 */}
      <div className="card">
        <p style={{ fontWeight: 700 }}>
          내 응모 ({data.entries.length}/{data.maxEntries})
        </p>
        {data.entries.length === 0 && <p className="hint" style={{ marginTop: 6 }}>아직 응모한 기록이 없어요.</p>}
        {data.entries.map((e) => (
          <div className="entry-item" key={e.id}>
            {e.photoUrl && <img src={e.photoUrl} alt="인증" />}
            <div style={{ flex: 1 }}>
              <div className="entry-digits">
                {e.digits.split("").map((d, i) => (
                  <span key={i} className={drawn ? (data.winningNumbers[i] === d ? "hit" : "miss") : ""}>
                    {d}
                    {i === 1 ? "." : ""}
                  </span>
                ))}
                <span style={{ fontSize: "0.8rem", color: "var(--muted)", fontWeight: 400 }}>km</span>
              </div>
              {drawn && <span className="hint">{e.matches}개 일치</span>}
            </div>
            {!drawn && (
              <button className="btn danger sm" onClick={() => cancel(e.id)}>취소</button>
            )}
          </div>
        ))}
      </div>

      {/* 응모 폼 */}
      {canApply && (
        <div className="card">
          <p style={{ fontWeight: 700 }}>응모하기</p>
          <p className="hint" style={{ margin: "6px 0" }}>
            러닝 앱 기록의 거리를 그대로 입력하세요. 10km 미만이면 앞에 0을 붙여요. (5.24km → 05.24)
          </p>
          <div className="digit-row">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {i === 2 && <span className="digit-dot">.</span>}
                <input
                  ref={digitRefs[i]}
                  className="digit-input"
                  value={digits[i]}
                  onChange={(e) => setDigit(i, e.target.value)}
                  inputMode="numeric"
                  maxLength={2}
                />
              </span>
            ))}
          </div>
          <div className="warn-box">{PRIVACY_WARNING}</div>
          <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} />
          {preview && <img className="preview" src={preview} alt="미리보기" style={{ width: "100%", borderRadius: 10 }} />}
          {error && <p className="error-msg">{error}</p>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={busy}>
              {file ? "사진 다시 선택" : "인증 사진 선택"}
            </button>
            <button className="btn primary" onClick={submit} disabled={busy || !file}>
              {busy ? "응모 중..." : "응모하기"}
            </button>
          </div>
        </div>
      )}

      {!drawn && !canApply && data.entries.length >= data.maxEntries && (
        <p className="hint" style={{ textAlign: "center" }}>
          응모를 모두 사용했어요. 추첨일을 기다려주세요! 🍀
        </p>
      )}

      {/* 당첨자 명단 */}
      {drawn && data.winners && (
        <div className="card">
          <p style={{ fontWeight: 700, marginBottom: 8 }}>🏆 당첨자</p>
          {data.winners.length === 0 && <p className="hint">2개 이상 일치한 사람이 없어요 😢</p>}
          <table>
            <tbody>
              {data.winners.map((w) => (
                <tr key={w.nickname}>
                  <td>{w.nickname}</td>
                  <td>{fmt(w.digits)} km</td>
                  <td className="num">
                    <b style={{ color: "var(--accent)" }}>{w.matches}개 일치</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
