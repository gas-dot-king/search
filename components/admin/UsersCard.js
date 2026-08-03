"use client";

import { useMemo, useState } from "react";
import UserActionsModal from "@/components/admin/UserActionsModal";
import { downloadCsv, usersToCsv } from "@/lib/csv";

const SORTS = [
  { key: "recent", label: "최근 인증순" },
  { key: "progress", label: "진행 많은순" },
  { key: "idle", label: "미참여 먼저" },
  { key: "nickname", label: "가나다순" },
];

/** 마지막 인증이 언제였는지 짧게 — 목록에서 훑기 좋게 상대 시간으로. */
function sinceLabel(value) {
  if (!value) return "인증 없음";
  const ms = Date.now() - Date.parse(value);
  if (Number.isNaN(ms)) return "";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "방금";
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

function sortUsers(users, sort) {
  const rows = [...users];
  const byNickname = (a, b) => a.nickname.localeCompare(b.nickname);
  if (sort === "nickname") return rows.sort(byNickname);
  if (sort === "progress") return rows.sort((a, b) => b.filled - a.filled || b.lines - a.lines || byNickname(a, b));
  // 인증이 없는 사람을 먼저 보여, 독려가 필요한 회원을 찾는 데 쓴다.
  if (sort === "idle") return rows.sort((a, b) => a.filled - b.filled || byNickname(a, b));
  // 최근 인증순: 한 번도 안 올린 사람은 맨 뒤로.
  return rows.sort((a, b) => {
    if (!a.lastUploadAt && !b.lastUploadAt) return byNickname(a, b);
    if (!a.lastUploadAt) return 1;
    if (!b.lastUploadAt) return -1;
    return b.lastUploadAt.localeCompare(a.lastUploadAt);
  });
}

/** 회원 목록: 검색·정렬 + 한 줄에 진행 요약까지 (예전엔 현황을 팝업으로만 볼 수 있었다) */
export default function UsersCard({ users, fourLine, busy, error, onOpenUser, onChanged }) {
  const [menuUser, setMenuUser] = useState(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = keyword
      ? users.filter((user) => user.nickname.toLowerCase().includes(keyword))
      : users;
    return sortUsers(filtered, sort);
  }, [users, query, sort]);

  function downloadExcel() {
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(usersToCsv(users, fourLine), `ysrc-회원목록-${today}.csv`);
  }

  return (
    <>
      <div className="admin-users-head">
        <button type="button" className="btn ghost sm" onClick={downloadExcel} disabled={!users.length}>
          ⬇ 엑셀 다운로드
        </button>
      </div>

      <input
        type="search"
        className="admin-user-search"
        placeholder="닉네임 검색"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="닉네임으로 회원 검색"
      />
      <div className="review-filters">
        {SORTS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`review-filter${sort === item.key ? " on" : ""}`}
            onClick={() => setSort(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && <p className="error-msg">{error}</p>}

      {visible.length === 0 ? (
        <p className="hint">{users.length === 0 ? "아직 가입한 회원이 없습니다." : "검색 결과가 없습니다."}</p>
      ) : (
        <ul className="admin-user-list">
          {visible.map((user, index) => (
            <li key={user.id} className="admin-user-row">
              <span className="admin-user-number" aria-label={`${index + 1}번`}>{index + 1}</span>
              <div className="admin-user-info">
                <p className="admin-user-name">{user.nickname}</p>
                <p className="admin-user-summary">
                  <span className={user.filled === 0 ? "review-dim" : ""}>{user.filled}/16칸</span>
                  <span>· {user.lines}줄</span>
                  <span>· 응모 {user.lottoEntries}</span>
                  <span>· {sinceLabel(user.lastUploadAt)}</span>
                </p>
              </div>
              <button className="btn ghost sm" onClick={() => onOpenUser(user)} disabled={busy}>
                보기
              </button>
              <button
                className="btn ghost sm admin-gear"
                onClick={() => setMenuUser(user)}
                disabled={busy}
                aria-label={`${user.nickname} 님 계정 관리`}
                title="닉네임 수정 · PIN 초기화 · 삭제"
              >
                ⚙️
              </button>
            </li>
          ))}
        </ul>
      )}

      {menuUser && (
        <UserActionsModal
          user={menuUser}
          onClose={() => setMenuUser(null)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}
