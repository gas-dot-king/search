"use client";

import Modal from "@/components/Modal";

/** 회원 한 명의 빙고·줄·로또 현황. 좁은 화면에서 표가 옆으로 밀리지 않도록 팝업으로 뺐다. */
export default function UserStatsModal({ user, onClose }) {
  return (
    <Modal label={`${user.nickname} 님 현황`} onClose={onClose}>
      <h3>📊 {user.nickname} 님 현황</h3>

      <dl className="admin-stats">
        <div>
          <dt>빙고</dt>
          <dd>{user.filled}/16칸</dd>
        </div>
        <div>
          <dt>줄</dt>
          <dd>{user.lines}줄</dd>
        </div>
        <div>
          <dt>로또 응모</dt>
          <dd>{user.lottoEntries}장</dd>
        </div>
      </dl>

      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          닫기
        </button>
      </div>
    </Modal>
  );
}
