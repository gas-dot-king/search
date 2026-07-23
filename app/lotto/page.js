"use client";

import { useRef, useState } from "react";
import Nav from "@/components/Nav";
import { api, PRIVACY_WARNING } from "@/lib/client";
import { useApiData, usePhoto } from "@/lib/hooks";

const fmtKm = (d) => `${d.slice(0, 2)}.${d.slice(2)}`;

export default function LottoPage() {
  const { data, error: loadError, reload } = useApiData("/api/lotto");
  const photo = usePhoto();
  const [digits, setDigits] = useState(["", "", "", ""]);
  const fileRef = useRef(null);
  const digitRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  function setDigit(i, v) {
    const d = v.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = d;
      return next;
    });
    if (d && i < 3) digitRefs[i + 1].current?.focus();
  }

  async function submit() {
    const code = digits.join("");
    if (code.length !== 4) return photo.setError("기록 4자리를 모두 입력해주세요.");
    if (!photo.file) return photo.setError("인증 사진을 선택해주세요.");
    photo.setBusy(true);
    photo.setError("");
    try {
      const form = new FormData();
      form.append("digits", code);
      form.append("file", photo.file, "lotto.jpg");
      await api("/api/lotto", { method: "POST", body: form });
      setDigits(["", "", "", ""]);
      photo.clear();
      await reload();
    } catch (err) {
      photo.setError(err.message);
    } finally {
      photo.setBusy(false);
    }
  }

  async function cancel(id) {
    if (!confirm("이 응모를 취소할까요? 사진도 삭제됩니다.")) return;
    try {
      await api("/api/lotto", { method: "DELETE", body: JSON.stringify({ id }) });
      await reload();
    } catch (err) {
      photo.setError(err.message);
    }
  }

  if (!data)
    return (
      <main className="wrap">
        <Nav />
        <p className="hint">{loadError || "불러오는 중..."}</p>
      </main>
    );

  const winning = data.winningNumbers || ""; // 0~4자리 (진행 중 부분 공개)
  const drawn = winning.length === 4;
  const drawing = winning.length > 0 && !drawn;
  const canApply = data.entries.length < data.maxEntries;

  return (
    <main className="wrap">
      <Nav />
      <h2 className="section-title">🎰 달리기 로또</h2>

      {/* 추첨 결과 / 진행 상황 */}
      {winning.length > 0 && (
        <div className="card" style={{ textAlign: "center" }}>
          <p className="card-title">{drawn ? "당첨 번호" : "추첨 진행 중... 🥁"}</p>
          <div className="winning-digits">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`winning-digit ${i < winning.length ? "" : "pending"}`}>
                {i < winning.length ? winning[i] : "?"}
              </span>
            ))}
          </div>
          <p className="hint">
            {drawn
              ? `기록 ${fmtKm(winning)} km 와 자리별로 비교해요`
              : `${winning.length}번째 자리까지 공개! 다음 자리를 기다려주세요`}
          </p>
        </div>
      )}

      {/* 내 응모 */}
      <div className="card">
        <p className="card-title">
          내 응모 ({data.entries.length}/{data.maxEntries})
        </p>
        {data.entries.length === 0 && (
          <p className="hint" style={{ marginTop: 6 }}>아직 응모한 기록이 없어요.</p>
        )}
        {data.entries.map((e) => (
          <div className="entry-item" key={e.id}>
            {e.photoUrl && <img src={e.photoUrl} alt="인증" />}
            <div style={{ flex: 1 }}>
              <div className="entry-digits">
                {e.digits.split("").map((d, i) => (
                  <span key={i} className={i < winning.length ? (winning[i] === d ? "hit" : "miss") : ""}>
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
          <p className="card-title">응모하기</p>
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
          <input ref={fileRef} type="file" accept="image/*" onChange={photo.pick} style={{ display: "none" }} />
          {photo.preview && <img className="preview" src={photo.preview} alt="미리보기" />}
          {photo.error && <p className="error-msg">{photo.error}</p>}
          <div className="modal-actions">
            <button className="btn ghost" onClick={() => fileRef.current?.click()} disabled={photo.busy}>
              {photo.file ? "사진 다시 선택" : "인증 사진 선택"}
            </button>
            <button className="btn primary" onClick={submit} disabled={photo.busy || !photo.file}>
              {photo.busy ? "응모 중..." : "응모하기"}
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
          <p className="card-title">🏆 당첨자</p>
          {data.winners.length === 0 && <p className="hint">2개 이상 일치한 사람이 없어요 😢</p>}
          <table>
            <tbody>
              {data.winners.map((w) => (
                <tr key={w.nickname}>
                  <td>{w.nickname}</td>
                  <td>{fmtKm(w.digits)} km</td>
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
