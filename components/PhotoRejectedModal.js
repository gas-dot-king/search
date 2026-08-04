"use client";

import Modal from "@/components/Modal";
import { formatKoreanDateTime } from "@/lib/period";

/**
 * 규칙상 인증이 될 수 없는 사진을 되돌려보낼 때 띄우는 안내.
 *
 * 그냥 "안 됩니다"로 끝내면 회원은 뭘 고쳐야 할지 모른다.
 * 언제 찍힌 사진인지와 어떤 사진이면 되는지를 같이 알려 준다.
 */
export default function PhotoRejectedModal({ rejected, onClose }) {
  if (!rejected) return null;

  const beforeToday = rejected.reason === "before_today";

  return (
    <Modal label={beforeToday ? "오늘 찍은 사진이 아니에요" : "이벤트 기간 전에 찍은 사진"} onClose={onClose}>
      <h3>{beforeToday ? "📅 오늘 찍은 사진이 아니에요" : "📅 이벤트 시작 전에 찍은 사진이에요"}</h3>
      <p className="rejected-lead">
        이 사진은 <b>{rejected.takenLabel || (beforeToday ? "오늘 이전" : "이벤트 시작 전")}</b>에 촬영된 것으로 기록돼 있어요.
      </p>
      <div className="warn-box">
        {beforeToday ? (
          <>
            빙고 인증은 <b>오늘 찍은 사진</b>만 인정돼요.
            어제 달린 기록은 어제 올려야 하고, 오늘 활동한 사진으로 새로 올려주세요.
          </>
        ) : (
          <>
            인증은 <b>{formatKoreanDateTime(rejected.uploadStart)}</b>부터 찍은 사진만 인정돼요.
            이벤트 기간에 새로 찍은 사진으로 올려주세요.
          </>
        )}
      </div>
      <p className="hint">
        사진을 편집하거나 메신저로 받으면 촬영 시각이 사라져 이 확인을 못 하기도 해요.
        {beforeToday ? " 오늘 찍었는데 막혔다면" : " 기간에 맞게 찍었는데 막혔다면"} 운영진에게 알려주세요.
      </p>
      <div className="modal-actions">
        <button type="button" className="btn primary" onClick={onClose}>
          다시 고르기
        </button>
      </div>
    </Modal>
  );
}
