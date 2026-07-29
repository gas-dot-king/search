"use client";

import { useRef, useState } from "react";
import Nav from "@/components/Nav";
import Modal from "@/components/Modal";
import { api, PRIVACY_WARNING } from "@/lib/client";
import { useApiData, usePhoto, useUploadPeriod } from "@/lib/hooks";
import { formatKoreanDateTime } from "@/lib/period";

const fmtKm = (digits) => `${digits.slice(0, 2)}.${digits.slice(2)}`;

function LottoEntrySlot({ slotNumber, entry, locked, onSubmitted }) {
  const photo = usePhoto();
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef(null);
  const digitRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  function setDigit(index, value) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    if (digit && index < 3) digitRefs[index + 1].current?.focus();
  }

  async function submit() {
    const code = digits.join("");
    if (code.length !== 4) return photo.setError("거리 4자리를 모두 입력해주세요.");
    if (!photo.file) return photo.setError("인증 사진을 선택해주세요.");

    setSubmitting(true);
    photo.setError("");
    const controller = new AbortController();
    const uploadTimeout = setTimeout(() => controller.abort(), 60_000);
    try {
      const form = new FormData();
      form.append("slot", String(slotNumber));
      form.append("digits", code);
      form.append("file", photo.file, "lotto.jpg");
      const result = await api("/api/lotto", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      onSubmitted(result.entry);
    } catch (error) {
      photo.setError(
        error.name === "AbortError"
          ? "업로드 시간이 너무 오래 걸렸어요. 네트워크를 확인하고 다시 시도해주세요."
          : error.message
      );
    } finally {
      clearTimeout(uploadTimeout);
      setSubmitting(false);
    }
  }

  if (entry) {
    return (
      <article className="lotto-entry-ticket complete">
        <div className="lotto-ticket-heading">
          <strong>응모권 {slotNumber}</strong>
          <span>✓ 응모 완료!</span>
        </div>
        <p><b>{fmtKm(entry.digits)}km</b> 기록으로 응모했어요.</p>
      </article>
    );
  }

  // 기간 밖에는 응모 폼 대신 잠긴 응모권만 보여준다 (내역·추첨 결과는 계속 볼 수 있다).
  // 자세한 사유는 바로 위 안내 배너에 한 번만 적는다.
  if (locked) {
    return (
      <article className="lotto-entry-ticket locked">
        <div className="lotto-ticket-heading">
          <strong>응모권 {slotNumber}</strong>
          <span>🔒 응모 불가</span>
        </div>
        <p>지금은 응모 기간이 아니에요.</p>
      </article>
    );
  }

  return (
    <article className="lotto-entry-ticket">
      <div className="lotto-ticket-heading">
        <strong>응모권 {slotNumber}</strong>
        <span>응모 가능</span>
      </div>
      <p className="hint">러닝 앱 거리 4자리를 입력해주세요. 예: 5.24km → 05.24</p>

      <div className="digit-row compact">
        {[0, 1, 2, 3].map((index) => (
          <span key={index} className="digit-field">
            {index === 2 && <span className="digit-dot">.</span>}
            <input
              ref={digitRefs[index]}
              className="digit-input"
              value={digits[index]}
              onChange={(event) => setDigit(index, event.target.value)}
              inputMode="numeric"
              maxLength={1}
              aria-label={`응모권 ${slotNumber} 거리 ${index + 1}번째 숫자`}
            />
          </span>
        ))}
        <span className="digit-km">km</span>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={photo.pick} hidden />
      {photo.busy && <p className="photo-processing" role="status">사진을 처리하는 중이에요...</p>}
      {photo.preview && <img className="lotto-slot-preview" src={photo.preview} alt="선택한 인증 사진" />}
      {photo.error && <p className="error-msg">{photo.error}</p>}

      <div className="lotto-ticket-actions">
        <button
          type="button"
          className="btn ghost"
          onClick={() => fileRef.current?.click()}
          disabled={photo.busy || submitting}
        >
          {photo.busy ? "사진 처리 중..." : photo.file ? "사진 변경" : "인증 사진 선택"}
        </button>
        <button
          type="button"
          className="btn primary"
          onClick={submit}
          disabled={photo.busy || submitting || !photo.file}
        >
          {submitting ? "응모 중..." : `응모권 ${slotNumber} 등록`}
        </button>
      </div>
    </article>
  );
}

export default function LottoPage() {
  const { data, error: loadError, reload, setData } = useApiData("/api/lotto");
  const period = useUploadPeriod();
  const [viewPhoto, setViewPhoto] = useState(null);
  const [historyError, setHistoryError] = useState("");
  const [photoBusyId, setPhotoBusyId] = useState("");

  function addEntry(entry) {
    setData((current) => current
      ? { ...current, entries: [...current.entries, entry].sort((a, b) => a.slot - b.slot) }
      : current
    );
    reload();
  }

  async function cancel(id) {
    if (!confirm("이 응모를 취소할까요? 사진도 삭제됩니다.")) return;
    setHistoryError("");
    try {
      await api("/api/lotto", { method: "DELETE", body: JSON.stringify({ id }) });
      await reload();
    } catch (error) {
      setHistoryError(error.message);
    }
  }

  async function openPhoto(entry) {
    setHistoryError("");
    if (entry.photoUrl) {
      setViewPhoto(entry);
      return;
    }

    setPhotoBusyId(entry.id);
    try {
      const latest = await reload();
      const refreshed = latest?.entries?.find((item) => item.id === entry.id);
      if (refreshed?.photoUrl) setViewPhoto(refreshed);
      else setHistoryError("인증 사진을 불러오지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setPhotoBusyId("");
    }
  }

  if (!data) {
    return (
      <main className="wrap">
        <Nav config={period.config} configLoading={period.loading} />
        <p className="hint">{loadError || "불러오는 중..."}</p>
      </main>
    );
  }

  const winning = data.winningNumbers || "";
  const drawn = winning.length === 3;
  // 기간 밖에는 응모·취소를 막는다.
  const locked = !period.loading && !period.open;

  return (
    <main className="wrap">
      <Nav config={period.config} configLoading={period.loading} />
      <h1 className="section-title lotto-page-title">🎰 달리기 로또</h1>

      <section className="card lotto-guide" aria-labelledby="lotto-guide-title">
        <div className="lotto-guide-heading">
          <h2 id="lotto-guide-title">응모 방법</h2>
          <span>1인 최대 2장</span>
        </div>
        <p className="lotto-period">
          {formatKoreanDateTime(data.uploadStart)}부터 {formatKoreanDateTime(data.uploadEnd)}까지
        </p>
        <p>
          러닝 앱의 거리와 인증 사진으로 응모해요. 거리의 <b>1의 자리·소수점 첫째 자리·둘째 자리</b>,
          총 세 자리를 무작위 추첨 번호와 비교합니다.
        </p>
        <div className="lotto-example" aria-label="로또 응모 예시">
          <span>예시</span>
          <strong>05.24km</strong>
          <i>→</i>
          <b>5</b><b>2</b><b>4</b>
        </div>
        <p className="lotto-prize">
          {data.drawDate || "행사일"} 오프라인 행사에서 추첨하며, 세 자리 모두 일치한 1등에게
          <b> 5만원 상당의 선물</b>을 드려요. 1등이 없으면 나올 때까지 다시 추첨합니다.
        </p>
      </section>

      <section className="card lotto-history compact" aria-labelledby="lotto-history-title">
        <div className="lotto-history-heading">
          <p id="lotto-history-title" className="card-title">내 응모 내역</p>
          <strong>{data.entries.length}/{data.maxEntries}장</strong>
        </div>
        {data.entries.length === 0 ? (
          <p className="hint">아직 응모한 기록이 없어요.</p>
        ) : (
          <div className="lotto-history-list">
            {data.entries.map((entry) => (
              <div className="lotto-history-row" key={entry.id}>
                <span>응모권 {entry.slot}</span>
                <strong>{fmtKm(entry.digits)}km</strong>
                <button
                  type="button"
                  className="btn ghost sm"
                  onClick={() => openPhoto(entry)}
                  disabled={photoBusyId === entry.id}
                >
                  {photoBusyId === entry.id ? "불러오는 중..." : "인증사진 보기"}
                </button>
                {!drawn && !locked && (
                  <button type="button" className="btn danger sm" onClick={() => cancel(entry.id)}>
                    취소
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {historyError && <p className="error-msg">{historyError}</p>}
      </section>

      {winning.length > 0 && (
        <section className="card lotto-draw-result">
          <p className="card-title">{drawn ? "당첨 번호" : "추첨 진행 중... 🥁"}</p>
          <div className="winning-digits">
            {[0, 1, 2].map((index) => (
              <div className="winning-digit-group" key={index}>
                <span className={`winning-digit ${index < winning.length ? "" : "pending"}`}>
                  {index < winning.length ? winning[index] : "?"}
                </span>
                <small>{["1의 자리", "소수점 첫째", "소수점 둘째"][index]}</small>
              </div>
            ))}
          </div>
          <p className="hint">
            {drawn ? `${winning[0]}.${winning.slice(1)}에 해당하는 세 자리를 비교해요.` : "다음 추첨 숫자를 기다려주세요."}
          </p>
        </section>
      )}

      <section className="lotto-entry-section" aria-labelledby="lotto-entry-title">
        <h2 id="lotto-entry-title" className="section-title">응모하기</h2>
        {locked ? (
          <div className="period-lock" role="status">🔒 {period.notice}</div>
        ) : (
          <div className="warn-box lotto-privacy">{PRIVACY_WARNING}</div>
        )}
        <div className="lotto-entry-tickets">
          {Array.from({ length: data.maxEntries }, (_, index) => (
            <LottoEntrySlot
              key={`entry-slot-${index}`}
              slotNumber={index + 1}
              entry={data.entries.find((item) => item.slot === index + 1) || null}
              locked={locked}
              onSubmitted={addEntry}
            />
          ))}
        </div>
      </section>

      {drawn && data.winners && (
        <section className="card">
          <p className="card-title">🏆 1등 당첨자</p>
          {data.winners.length === 0 && <p className="hint">아직 1등이 없어 다시 추첨할 예정이에요.</p>}
          <table>
            <tbody>
              {data.winners.map((winner) => (
                <tr key={winner.nickname}>
                  <td>{winner.nickname}</td>
                  <td>{fmtKm(winner.digits)}km</td>
                  <td className="num"><b style={{ color: "var(--accent)" }}>세 자리 일치</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {viewPhoto && (
        <Modal label="응모 인증사진" onClose={() => setViewPhoto(null)}>
          <div className="lotto-photo-modal">
            <h3>응모 인증사진</h3>
            <p className="hint">{fmtKm(viewPhoto.digits)}km 응모 기록</p>
            <img className="preview" src={viewPhoto.photoUrl} alt={`${fmtKm(viewPhoto.digits)}km 인증사진`} />
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setViewPhoto(null)}>닫기</button>
            </div>
          </div>
        </Modal>
      )}
    </main>
  );
}
