"use client";

import { useState } from "react";
import UserActionsModal from "@/components/admin/UserActionsModal";
import UserStatsModal from "@/components/admin/UserStatsModal";
import { usersToCsv } from "@/lib/csv";

/** 회원 목록: 닉네임 + 현황·보기·톱니바퀴 메뉴 (빙고/줄/로또 숫자는 현황 팝업으로) */
export default function UsersCard({ users, busy, error, onOpenUser, onChanged }) {
  const [menuUser, setMenuUser] = useState(null);
  const [statsUser, setStatsUser] = useState(null);

  function downloadExcel() {
    const blob = new Blob([usersToCsv(users)], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `ysrc-회원목록-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="card">
      <div className="admin-users-head">
        <p style={{ fontWeight: 700 }}>회원 ({users.length}명)</p>
        <button type="button" className="btn ghost sm" onClick={downloadExcel} disabled={!users.length}>
          ⬇ 엑셀 다운로드
        </button>
      </div>
      {error && <p className="error-msg">{error}</p>}
      <div className="table-scroll admin-table-scroll">
        <table className="admin-users-table">
          <thead>
            <tr>
              <th>닉네임</th>
              <th className="num" colSpan={3}>관리</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td className="admin-user-name">{user.nickname}</td>
                <td className="num">
                  <button
                    className="btn ghost sm"
                    onClick={() => setStatsUser(user)}
                    disabled={busy}
                    aria-label={`${user.nickname} 님 빙고·줄·로또 현황`}
                    title="빙고 · 줄 · 로또 응모 현황"
                  >
                    현황
                  </button>
                </td>
                <td className="num">
                  <button className="btn ghost sm" onClick={() => onOpenUser(user)} disabled={busy}>
                    보기
                  </button>
                </td>
                <td className="num">
                  <button
                    className="btn ghost sm admin-gear"
                    onClick={() => setMenuUser(user)}
                    disabled={busy}
                    aria-label={`${user.nickname} 님 계정 관리`}
                    title="닉네임 수정 · PIN 초기화 · 삭제"
                  >
                    ⚙️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {statsUser && <UserStatsModal user={statsUser} onClose={() => setStatsUser(null)} />}

      {menuUser && (
        <UserActionsModal
          user={menuUser}
          onClose={() => setMenuUser(null)}
          onChanged={onChanged}
        />
      )}
    </div>
  );
}
