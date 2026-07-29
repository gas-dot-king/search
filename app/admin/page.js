"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, adminPost, adminPw } from "@/lib/adminClient";
import SettingsCard from "@/components/admin/SettingsCard";
import UserDetail from "@/components/admin/UserDetail";
import ItemsCard from "@/components/admin/ItemsCard";
import EventGuideCard from "@/components/admin/EventGuideCard";

export default function AdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [overview, setOverview] = useState(null);
  const [detail, setDetail] = useState(null); // { user, data }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    const data = await adminApi("/api/admin?action=overview");
    setOverview(data);
    setAuthed(true);
  }, []);

  async function login(e) {
    e.preventDefault();
    adminPw.set(pw);
    setError("");
    try {
      await loadOverview();
    } catch (err) {
      adminPw.clear();
      setError(err.status === 401 ? "비밀번호가 틀렸습니다." : err.message);
    }
  }

  function logout() {
    adminPw.clear();
    setAuthed(false);
    setOverview(null);
    setDetail(null);
    setPw("");
    setError("");
  }

  // 관리자 화면을 벗어나 일반 회원 화면으로 돌아간다. 회원 토큰은 그대로라 홈이 알아서 빙고/뽑기로 보낸다.
  function leave() {
    adminPw.clear();
    router.replace("/");
  }

  async function deleteUser(user) {
    if (
      !confirm(
        `정말 ${user.nickname} 님 계정을 삭제할까요?\n빙고판·로또 응모·업로드한 사진이 모두 삭제되고 되돌릴 수 없습니다.`
      )
    )
      return;
    setBusy(true);
    try {
      await adminPost({ action: "delete_user", userId: user.id });
      await loadOverview();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const openUser = useCallback(async (user) => {
    setBusy(true);
    try {
      const data = await adminApi(`/api/admin?action=user&id=${user.id}`);
      setDetail({ user, data });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, []);

  async function saveEventGuide(value) {
    setBusy(true);
    setError("");
    try {
      await adminPost({ action: "set_setting", key: "event_guide", value });
      await loadOverview();
    } catch (err) {
      setError(err.message);
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!authed) {
    return (
      <main className="wrap">
        <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "24px 0 12px" }}>🔑 관리자</h2>
        <form className="card" onSubmit={login}>
          <label>관리자 비밀번호</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required />
          {error && <p className="error-msg">{error}</p>}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn primary">입장</button>
            <button type="button" className="btn ghost" onClick={leave}>
              나가기
            </button>
          </div>
        </form>
      </main>
    );
  }

  if (detail) {
    return (
      <UserDetail
        user={detail.user}
        data={detail.data}
        onBack={() => setDetail(null)}
        onRefresh={() => openUser(detail.user)}
        onBoardReset={async () => {
          setDetail(null);
          await loadOverview();
        }}
      />
    );
  }

  return (
    <main className="wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>🛠 관리자</h2>
        <button className="btn ghost sm" onClick={logout} disabled={busy}>
          로그아웃
        </button>
      </div>

      <SettingsCard settings={overview?.settings || {}} busy={busy} setBusy={setBusy} onChanged={loadOverview} />

      <EventGuideCard
        raw={overview?.settings?.event_guide || ""}
        busy={busy}
        onSave={saveEventGuide}
      />

      <div className="card">
        <p style={{ fontWeight: 700, marginBottom: 8 }}>회원 ({overview.users.length}명)</p>
        {error && <p className="error-msg">{error}</p>}
        <div className="table-scroll admin-table-scroll">
          <table>
            <thead>
              <tr>
                <th>닉네임</th>
                <th className="num">빙고</th>
                <th className="num">줄</th>
                <th className="num">로또</th>
                <th />
                <th />
              </tr>
            </thead>
            <tbody>
              {overview.users.map((u) => (
                <tr key={u.id}>
                  <td>{u.nickname}</td>
                  <td className="num">{u.filled}/16</td>
                  <td className="num">{u.lines}</td>
                  <td className="num">{u.lottoEntries}장</td>
                  <td className="num">
                    <button className="btn ghost sm" onClick={() => openUser(u)} disabled={busy}>보기</button>
                  </td>
                  <td className="num">
                    <button className="btn danger sm" onClick={() => deleteUser(u)} disabled={busy}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ItemsCard items={overview.items} />
    </main>
  );
}
