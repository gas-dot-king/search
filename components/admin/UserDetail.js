"use client";

import { adminPost } from "@/lib/adminClient";

const fmtKm = (d) => `${d.slice(0, 2)}.${d.slice(2)}`;

export default function UserDetail({ user, data, onBack, onRefresh }) {
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

  return (
    <main className="wrap">
      <button className="btn ghost sm" onClick={onBack}>← 목록으로</button>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "12px 0" }}>{user.nickname} 님의 인증</h2>

      <p style={{ fontWeight: 700, margin: "10px 0 6px" }}>빙고판</p>
      <div className="admin-grid bingo-grid">
        {data.cells.map((c) => (
          <div key={c.position} className={`cell ${c.photoUrl ? "done" : ""}`}>
            {c.photoUrl ? (
              <>
                <a href={c.photoUrl} target="_blank" rel="noopener">
                  <img src={c.photoUrl} alt={c.content} />
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
      <div className="card">
        {data.lotto.length === 0 && <p className="hint">응모 없음</p>}
        {data.lotto.map((e) => (
          <div className="entry-item" key={e.id}>
            {e.photoUrl && (
              <a href={e.photoUrl} target="_blank" rel="noopener">
                <img src={e.photoUrl} alt="인증" />
              </a>
            )}
            <b style={{ flex: 1 }}>{fmtKm(e.digits)} km</b>
            <button className="btn danger sm" onClick={() => deletePhoto("lotto", e.id)}>삭제</button>
          </div>
        ))}
      </div>
    </main>
  );
}
