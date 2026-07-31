"use client";

import Modal from "@/components/Modal";
import { adminPost } from "@/lib/adminClient";

const fmtKm = (d) => `${d.slice(0, 2)}.${d.slice(2)}`;

/** 회원 한 명의 인증 현황. 목록의 스크롤 위치를 잃지 않도록 페이지 이동 대신 팝업으로 띄운다. */
export default function UserDetail({ user, data, onBack, onRefresh, onBoardReset }) {
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
                <a href={c.photoUrl} target="_blank" rel="noopener">
                  <img src={c.photoUrl} alt={c.content} loading="lazy" decoding="async" />
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
      <p className="hint" style={{ margin: "6px 0 16px" }}>
        사진을 누르면 원본 크기로 열려요. ✕로 부적절한 사진 삭제.
      </p>

      <p style={{ fontWeight: 700, margin: "10px 0 6px" }}>로또 응모</p>
      <div className="admin-detail-lotto">
        {data.lotto.length === 0 && <p className="hint">응모 없음</p>}
        {data.lotto.map((e) => (
          <div className="entry-item" key={e.id}>
            {e.photoUrl && (
              <a href={e.photoUrl} target="_blank" rel="noopener">
                <img src={e.photoUrl} alt="인증" loading="lazy" decoding="async" />
              </a>
            )}
            <b style={{ flex: 1 }}>{fmtKm(e.digits)} km</b>
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
