"use client";

import Modal from "@/components/Modal";
import { adminPost } from "@/lib/adminClient";
import { photoReview } from "@/lib/photoReview";

const fmtKm = (d) => `${d.slice(0, 2)}.${d.slice(2)}`;

/** 인증 검토용 촬영 정보. EXIF가 없는 사진(스크린샷·메신저로 받은 사진)은 그 사실만 알린다. */
function PhotoMeta({ meta, uploadedAt, uploadStart }) {
  const review = photoReview(meta, uploadedAt, uploadStart);
  if (!review.hasMeta) {
    return <p className="photo-meta empty">촬영 정보 없음 (스크린샷이거나 지워진 사진)</p>;
  }

  return (
    <div className="photo-meta">
      {review.takenLabel && (
        <span>
          📷 {review.takenLabel}
          {review.utcOffset ? ` (${review.utcOffset})` : ""}
          {review.flag && <b className="photo-meta-warn"> · ⚠️ {review.flag}</b>}
          {/* 며칠 전 촬영은 위반이 아니라 참고 사항이라 경고색을 쓰지 않는다 */}
          {review.note && ` · ${review.note}`}
        </span>
      )}
      {review.hasGps && (
        <a
          href={`https://map.naver.com/p/search/${review.lat},${review.lng}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          📍 {review.lat.toFixed(5)}, {review.lng.toFixed(5)}
        </a>
      )}
      {review.device && <span>📱 {review.device}</span>}
    </div>
  );
}

/** 회원 한 명의 인증 현황. 목록의 스크롤 위치를 잃지 않도록 페이지 이동 대신 팝업으로 띄운다. */
export default function UserDetail({ user, data, uploadStart, onBack, onRefresh, onBoardReset }) {
  async function deletePhoto(kind, id) {
    if (!confirm("이 사진을 삭제할까요?")) return;
    try {
      await adminPost(
        kind === "cell" ? { action: "delete_cell_photo", cellId: id } : { action: "delete_lotto_entry", entryId: id }
      );
      await onRefresh();
    } catch (err) {
      alert(err.message);
    }
  }

  async function resetBoard() {
    if (
      !confirm(
        `정말 ${user.nickname} 님의 빙고판을 리셋할까요?\n뽑힌 16칸과 올린 사진이 전부 삭제되고, 다시 뽑기부터 시작합니다.`
      )
    )
      return;
    try {
      await adminPost({ action: "reset_board", userId: user.id });
      alert("빙고판이 리셋되었습니다.");
      await onBoardReset();
    } catch (err) {
      alert(err.message);
    }
  }

  async function resetPin() {
    if (!confirm(`${user.nickname}님의 PIN을 0000으로 초기화할까요?\n현재 로그인 세션은 즉시 해제됩니다.`)) return;
    try {
      await adminPost({ action: "reset_user_pin", userId: user.id });
      alert("PIN을 0000으로 초기화했습니다.");
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <Modal label={`${user.nickname} 님의 인증`} onClose={onBack} className="admin-detail-modal">
      <div className="admin-detail-head">
        <h3>{user.nickname} 님의 인증</h3>
        <button className="btn ghost sm" onClick={onBack} aria-label="닫기">✕</button>
      </div>
      <div className="admin-detail-toolbar">
        <button className="btn ghost sm" onClick={resetPin}>PIN 0000 초기화</button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 0 6px" }}>
        <p style={{ fontWeight: 700, flex: 1 }}>빙고판</p>
        {data.cells.length > 0 && (
          <button className="btn danger sm" onClick={resetBoard}>🔄 빙고판 리셋</button>
        )}
      </div>
      <div className="admin-grid bingo-grid">
        {data.cells.map((c) => (
          <div key={c.position} className={`cell ${c.photoUrl ? "done" : ""}`}>
            {c.photoUrl ? (
              <>
                {/* 그리드는 축소본, 원본은 눌렀을 때만 — 회원을 열 때마다 원본 16장을 받지 않도록. */}
                <a href={c.photoUrl} target="_blank" rel="noopener">
                  <img src={c.thumbUrl || c.photoUrl} alt={c.content} loading="lazy" decoding="async" />
                </a>
                <div className="overlay">{c.content}</div>
                <button
                  className="check"
                  style={{ border: "none", cursor: "pointer", background: "#b91c1c" }}
                  title="사진 삭제"
                  onClick={() => deletePhoto("cell", c.id)}
                >
                  ✕
                </button>
              </>
            ) : (
              <span className="txt">{c.content}</span>
            )}
          </div>
        ))}
      </div>

      <div className="photo-meta-list">
        {data.cells.filter((c) => c.photoUrl).map((c) => (
          <div key={`meta-${c.position}`} className="photo-meta-row">
            <strong>{c.content}</strong>
            <PhotoMeta meta={c.photoMeta} uploadedAt={c.uploadedAt} uploadStart={uploadStart} />
          </div>
        ))}
      </div>

      <p className="hint" style={{ margin: "6px 0 16px" }}>
        사진을 누르면 원본 크기로 열려요. ✕로 부적절한 사진 삭제.
        촬영 정보는 사진에 남아 있을 때만 보이고, 편집으로 바꿀 수 있어 참고용입니다.
      </p>

      <p style={{ fontWeight: 700, margin: "10px 0 6px" }}>로또 응모</p>
      <div className="admin-detail-lotto">
        {data.lotto.length === 0 && <p className="hint">응모 없음</p>}
        {data.lotto.map((e) => (
          <div className="entry-item" key={e.id}>
            {e.photoUrl && (
              <a href={e.photoUrl} target="_blank" rel="noopener">
                <img src={e.thumbUrl || e.photoUrl} alt="인증" loading="lazy" decoding="async" />
              </a>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{fmtKm(e.digits)} km</b>
              {/* 자기가 적어 넣은 기록이라 촬영 정보를 빙고와 같은 기준으로 함께 본다 */}
              <PhotoMeta meta={e.photoMeta} uploadedAt={e.createdAt} uploadStart={uploadStart} />
            </div>
            <button className="btn danger sm" onClick={() => deletePhoto("lotto", e.id)}>삭제</button>
          </div>
        ))}
      </div>

      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onBack}>목록으로</button>
      </div>
    </Modal>
  );
}
