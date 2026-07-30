"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import { adminPost } from "@/lib/adminClient";

/** 회원 한 명의 관리 동작(닉네임 수정·PIN 초기화·삭제)을 모아둔 톱니바퀴 메뉴 */
export default function UserActionsModal({ user, onClose, onChanged }) {
  const [nickname, setNickname] = useState(user.nickname);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function rename(event) {
    event.preventDefault();
    const next = nickname.trim();
    setError("");
    setMessage("");
    if (next === user.nickname) {
      setError("현재 닉네임과 같아요.");
      return;
    }
    if (next.length < 1 || next.length > 12) {
      setError("닉네임은 1~12자로 입력해주세요.");
      return;
    }
    setWorking(true);
    try {
      await adminPost({ action: "rename_user", userId: user.id, nickname: next });
      await onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function resetPin() {
    if (!confirm(`${user.nickname} 님의 PIN을 0000으로 초기화할까요?\n현재 로그인 세션은 즉시 해제됩니다.`)) return;
    setError("");
    setMessage("");
    setWorking(true);
    try {
      await adminPost({ action: "reset_user_pin", userId: user.id });
      setMessage("PIN을 0000으로 초기화했어요. 본인에게 새 PIN 설정을 안내해주세요.");
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `정말 ${user.nickname} 님 계정을 삭제할까요?\n빙고판·로또 응모·업로드한 사진이 모두 삭제되고 되돌릴 수 없습니다.`
      )
    )
      return;
    setError("");
    setMessage("");
    setWorking(true);
    try {
      await adminPost({ action: "delete_user", userId: user.id });
      await onChanged();
      onClose();
    } catch (err) {
      setError(err.message);
      setWorking(false);
    }
  }

  return (
    <Modal label={`${user.nickname} 님 계정 관리`} onClose={onClose} closeDisabled={working}>
      <h3>⚙️ {user.nickname} 님 계정</h3>

      <form onSubmit={rename} className="admin-user-form">
        <label htmlFor="admin-nickname">닉네임 수정</label>
        <input
          id="admin-nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={12}
          required
        />
        <button className="btn primary sm" disabled={working}>
          닉네임 저장
        </button>
      </form>

      {error && <p className="error-msg" role="alert">{error}</p>}
      {message && <p className="success-msg" role="status">{message}</p>}

      <div className="admin-user-actions">
        <button type="button" className="btn ghost" onClick={resetPin} disabled={working}>
          🔑 비밀번호(PIN) 0000으로 초기화
        </button>
        <button type="button" className="btn danger" onClick={remove} disabled={working}>
          🗑 계정 삭제
        </button>
        <button type="button" className="btn ghost" onClick={onClose} disabled={working}>
          닫기
        </button>
      </div>
    </Modal>
  );
}
