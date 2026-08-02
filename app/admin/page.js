"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { adminApi, adminLogin, adminLogout, adminPost } from "@/lib/adminClient";
import { parseNotices } from "@/lib/notices";
import SettingsCard from "@/components/admin/SettingsCard";
import CollapsibleCard from "@/components/admin/CollapsibleCard";
import StatsCard from "@/components/admin/StatsCard";
import RecentUploadsCard from "@/components/admin/RecentUploadsCard";
import CleanupCard from "@/components/admin/CleanupCard";
import NoticesCard from "@/components/admin/NoticesCard";
import LottoCard from "@/components/admin/LottoCard";
import UserDetail from "@/components/admin/UserDetail";
import UsersCard from "@/components/admin/UsersCard";
import ItemsCard from "@/components/admin/ItemsCard";
import EventGuideCard from "@/components/admin/EventGuideCard";
import FourLineCard from "@/components/admin/FourLineCard";
import GuestbookCard from "@/components/admin/GuestbookCard";

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

  useEffect(() => {
    loadOverview().catch((err) => {
      if (err.status !== 401) setError(err.message);
    });
  }, [loadOverview]);

  async function login(e) {
    e.preventDefault();
    setError("");
    try {
      await adminLogin(pw);
      await loadOverview();
    } catch (err) {
      setError(err.status === 401 ? "비밀번호가 틀렸습니다." : err.message);
    }
  }

  async function logout() {
    try {
      await adminLogout();
    } finally {
      setAuthed(false);
      setOverview(null);
      setDetail(null);
      setPw("");
      setError("");
    }
  }

  // 관리자 화면을 벗어나 일반 회원 화면으로 돌아간다. 회원 토큰은 그대로라 홈이 알아서 빙고/뽑기로 보낸다.
  function leave() {
    void adminLogout();
    router.replace("/");
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
          <div className="admin-login-actions">
            <button className="btn primary">입장</button>
            <button type="button" className="btn ghost" onClick={leave}>
              나가기
            </button>
          </div>
          <p className="admin-session-note">
            🔒 세션은 <b>10분</b> 유지됩니다. 만료되면 다시 입장해주세요.
          </p>
        </form>
      </main>
    );
  }

  const noticeCount = parseNotices(overview?.settings?.notice || "").length;

  return (
    <main className="wrap admin-wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: 800 }}>🛠 관리자</h2>
        <button className="btn ghost sm" onClick={logout} disabled={busy}>
          로그아웃
        </button>
      </div>

      <StatsCard stats={overview.stats} onRefresh={loadOverview} />

      <CleanupCard cleanup={overview.cleanup} onChanged={loadOverview} />

      <RecentUploadsCard
        uploadStart={overview?.settings?.upload_start}
        onOpenUser={openUser}
        onChanged={loadOverview}
      />

      <SettingsCard settings={overview?.settings || {}} busy={busy} setBusy={setBusy} onChanged={loadOverview} />

      <CollapsibleCard
        title="📢 공지"
        hint="모든 페이지 상단에 뜨고 5초마다 자동 전환됩니다."
        badge={`${noticeCount}개`}
      >
        <NoticesCard
          raw={overview?.settings?.notice || ""}
          busy={busy}
          setBusy={setBusy}
          onChanged={loadOverview}
        />
      </CollapsibleCard>

      <CollapsibleCard title="🎰 로또" hint="응모 장수와 추첨 현황입니다.">
        <LottoCard settings={overview?.settings || {}} />
      </CollapsibleCard>

      <CollapsibleCard
        title="📍 오프라인 행사 안내"
        hint="행사 시간, 장소, 주차와 지도 정보를 수정할 수 있습니다."
      >
        <EventGuideCard
          raw={overview?.settings?.event_guide || ""}
          busy={busy}
          onSave={saveEventGuide}
        />
      </CollapsibleCard>

      <FourLineCard
        fourLine={overview.fourLine}
        busy={busy}
        onOpenUser={openUser}
        onChanged={loadOverview}
      />

      <CollapsibleCard title="👥 회원 목록" badge={`${overview.users.length}명`}>
        <UsersCard
          users={overview.users}
          fourLine={overview.fourLine}
          busy={busy}
          error={error}
          onOpenUser={openUser}
          onChanged={loadOverview}
        />
      </CollapsibleCard>

      <GuestbookCard />

      <ItemsCard items={overview.items} />

      {/* 목록을 그대로 둔 채 위에 띄워야 닫았을 때 스크롤 위치가 유지된다. */}
      {detail && (
        <UserDetail
          user={detail.user}
          data={detail.data}
          uploadStart={overview?.settings?.upload_start}
          onBack={() => setDetail(null)}
          onRefresh={() => openUser(detail.user)}
          onOverviewChanged={loadOverview}
          onBoardReset={async () => {
            setDetail(null);
            await loadOverview();
          }}
        />
      )}
    </main>
  );
}
