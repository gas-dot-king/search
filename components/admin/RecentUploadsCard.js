"use client";

import { useCallback, useEffect, useState } from "react";
import { adminApi, adminPost } from "@/lib/adminClient";
import { formatKoreanDateTime } from "@/lib/period";
import { photoReview, matchesReviewFilter, REVIEW_FILTERS } from "@/lib/photoReview";

const CATEGORY_LABEL = { 1: "① 기록", 2: "② 탐험", 3: "③ 소통" };

const FILTERS = [
  { key: REVIEW_FILTERS.ALL, label: "전체" },
  { key: REVIEW_FILTERS.FLAGGED, label: "기간 전 촬영" },
  { key: REVIEW_FILTERS.NO_META, label: "촬영정보 없음" },
];

/** 사진 한 장의 검토 줄 — 썸네일로 훑고, 눌러야 원본을 연다. */
function UploadRow({ upload, uploadStart, onOpenUser, onDelete, busy }) {
  const review = photoReview(upload.photoMeta, upload.uploadedAt, uploadStart);

  return (
    <li className="review-row">
      <a
        className="review-thumb"
        href={upload.photoUrl || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${upload.nickname} 님의 ${upload.content} 인증 사진 원본 보기`}
      >
        {upload.thumbUrl ? (
          <img src={upload.thumbUrl} alt={upload.content} loading="lazy" decoding="async" />
        ) : (
          <span className="review-thumb-empty" aria-hidden="true" />
        )}
      </a>

      <div className="review-body">
        <p className="review-line">
          {/* onOpenUser는 회원 id를 받는다. upload.id는 칸 id라 그대로 넘기면 안 된다. */}
          <button
            type="button"
            className="review-nickname"
            onClick={() => onOpenUser({ id: upload.userId, nickname: upload.nickname })}
            disabled={busy}
          >
            {upload.nickname}
          </button>
          <span className={`review-cat cat${upload.category}`}>{CATEGORY_LABEL[upload.category] || ""}</span>
        </p>
        <p className="review-content">{upload.content}</p>
        <p className="review-meta">
          <span>{formatKoreanDateTime(upload.uploadedAt)} 올림</span>
          {review.takenLabel && <span>· 📷 {review.takenLabel}</span>}
          {/* 며칠 전에 찍은 사진을 올리는 건 위반이 아니라서, 경고가 아니라 참고로만 적는다 */}
          {review.note && <span className="review-dim">· {review.note}</span>}
          {!review.hasMeta && <span className="review-dim">· 촬영정보 없음</span>}
          {review.hasGps && (
            <a
              href={`https://map.naver.com/p/search/${review.lat},${review.lng}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              · 📍 위치
            </a>
          )}
        </p>
        {review.flag && <p className="review-flag">⚠️ {review.flag}</p>}
      </div>

      <button
        type="button"
        className="btn danger sm review-delete"
        onClick={() => onDelete(upload)}
        disabled={busy}
        title="이 인증 사진 삭제"
      >
        ✕
      </button>
    </li>
  );
}

/**
 * 전 회원의 인증 사진을 올라온 순서대로 훑는 검토 큐.
 * 회원 목록을 한 명씩 열어보는 방식은 회원이 늘수록 검토가 불가능해지므로,
 * "새로 올라온 것부터" 보는 창구를 따로 둔다.
 */
export default function RecentUploadsCard({ uploadStart, onOpenUser }) {
  const [uploads, setUploads] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [filter, setFilter] = useState(REVIEW_FILTERS.ALL);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async ({ append = false, before = null } = {}) => {
    setBusy(true);
    setError("");
    try {
      const query = before ? `&before=${encodeURIComponent(before)}` : "";
      const data = await adminApi(`/api/admin?action=recent${query}`);
      setUploads((current) => (append && current ? [...current, ...data.uploads] : data.uploads));
      setCursor(data.nextCursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function deletePhoto(upload) {
    if (!confirm(`${upload.nickname} 님의 "${upload.content}" 인증 사진을 삭제할까요?`)) return;
    setBusy(true);
    try {
      await adminPost({ action: "delete_cell_photo", cellId: upload.id });
      // 목록에서만 지워, 관리자가 보던 위치를 잃지 않게 한다.
      setUploads((current) => (current || []).filter((item) => item.id !== upload.id));
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const visible = (uploads || []).filter((upload) => matchesReviewFilter(upload, filter, uploadStart));

  return (
    <section className="card">
      <div className="admin-overview-head">
        <p className="card-title">📸 최근 인증 검토</p>
        <button className="btn ghost sm" onClick={() => load()} disabled={busy}>
          {busy ? "불러오는 중..." : "↻ 새로고침"}
        </button>
      </div>
      <p className="hint">
        전 회원의 인증 사진을 올라온 순서대로 봅니다. 사진을 누르면 원본이 열리고, ✕로 규칙에 맞지 않는 사진을 지웁니다.
        닉네임을 누르면 그 회원의 빙고판 전체를 봅니다.
      </p>

      <div className="review-filters">
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`review-filter${filter === item.key ? " on" : ""}`}
            onClick={() => setFilter(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p className="error-msg">{error}</p>}

      {uploads === null ? (
        <p className="hint">불러오는 중...</p>
      ) : visible.length === 0 ? (
        <p className="hint">
          {uploads.length === 0 ? "아직 올라온 인증 사진이 없습니다." : "이 조건에 맞는 사진이 없습니다."}
        </p>
      ) : (
        <ul className="review-list">
          {visible.map((upload) => (
            <UploadRow
              key={upload.id}
              upload={upload}
              uploadStart={uploadStart}
              busy={busy}
              onOpenUser={onOpenUser}
              onDelete={deletePhoto}
            />
          ))}
        </ul>
      )}

      {cursor && (
        <button
          className="btn ghost wide"
          onClick={() => load({ append: true, before: cursor })}
          disabled={busy}
        >
          {busy ? "불러오는 중..." : "더 보기"}
        </button>
      )}
    </section>
  );
}
