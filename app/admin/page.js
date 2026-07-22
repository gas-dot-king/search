"use client";

import { useCallback, useEffect, useState } from "react";

const PW_KEY = "ow_admin_pw";

async function adminApi(path, opts = {}) {
  const pw = sessionStorage.getItem(PW_KEY) || "";
  const res = await fetch(path, {
    ...opts,
    headers: {
      "x-admin-password": pw,
      ...(opts.body ? { "Content-Type": "application/json" } : {}),
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.error || "요청 실패");
    e.status = res.status;
    throw e;
  }
  return data;
}

export default function AdminPage() {
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
    if (sessionStorage.getItem(PW_KEY)) {
      loadOverview().catch(() => sessionStorage.removeItem(PW_KEY));
    }
  }, [loadOverview]);

  async function login(e) {
    e.preventDefault();
    sessionStorage.setItem(PW_KEY, pw);
    setError("");
    try {
      await loadOverview();
    } catch (err) {
      sessionStorage.removeItem(PW_KEY);
      setError(err.status === 401 ? "비밀번호가 틀렸습니다." : err.message);
    }
  }

  async function openUser(user) {
    setBusy(true);
    try {
      const data = await adminApi(`/api/admin?action=user&id=${user.id}`);
      setDetail({ user, data });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setSetting(key, value, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return;
    setBusy(true);
    try {
      await adminApi("/api/admin", {
        method: "POST",
        body: JSON.stringify({ action: "set_setting", key, value }),
      });
      await loadOverview();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function drawNumbers() {
    if (!confirm("당첨 번호를 추첨할까요? 추첨 후에는 응모가 잠깁니다.")) return;
    setBusy(true);
    try {
      const res = await adminApi("/api/admin", {
        method: "POST",
        body: JSON.stringify({ action: "draw_numbers" }),
      });
      alert(`당첨 번호: ${res.digits.slice(0, 2)}.${res.digits.slice(2)}`);
      await loadOverview();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deletePhoto(kind, id) {
    if (!confirm("이 사진을 삭제할까요?")) return;
    try {
      await adminApi("/api/admin", {
        method: "POST",
        body: JSON.stringify(
          kind === "cell" ? { action: "delete_cell_photo", cellId: id } : { action: "delete_lotto_entry", entryId: id }
        ),
      });
      if (detail) await openUser(detail.user);
    } catch (err) {
      alert(err.message);
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
          <div style={{ marginTop: 14 }}>
            <button className="btn primary">입장</button>
          </div>
        </form>
      </main>
    );
  }

  const s = overview?.settings || {};

  // 회원 상세 보기
  if (detail) {
    const fmt = (d) => `${d.slice(0, 2)}.${d.slice(2)}`;
    return (
      <main className="wrap">
        <button className="btn ghost sm" onClick={() => setDetail(null)}>← 목록으로</button>
        <h2 style={{ fontSize: "1.15rem", fontWeight: 800, margin: "12px 0" }}>
          {detail.user.nickname} 님의 인증
        </h2>

        <p style={{ fontWeight: 700, margin: "10px 0 6px" }}>빙고판</p>
        <div className="admin-grid bingo-grid">
          {detail.data.cells.map((c) => (
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
        <p className="hint" style={{ margin: "6px 0 16px" }}>사진을 누르면 원본 크기로 열려요. ✕로 부적절한 사진 삭제.</p>

        <p style={{ fontWeight: 700, margin: "10px 0 6px" }}>로또 응모</p>
        <div className="card">
          {detail.data.lotto.length === 0 && <p className="hint">응모 없음</p>}
          {detail.data.lotto.map((e) => (
            <div className="entry-item" key={e.id}>
              {e.photoUrl && (
                <a href={e.photoUrl} target="_blank" rel="noopener">
                  <img src={e.photoUrl} alt="인증" />
                </a>
              )}
              <b style={{ flex: 1 }}>{fmt(e.digits)} km</b>
              <button className="btn danger sm" onClick={() => deletePhoto("lotto", e.id)}>삭제</button>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="wrap">
      <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "16px 0" }}>🛠 관리자</h2>

      {/* 설정 */}
      <div className="card">
        <p style={{ fontWeight: 700, marginBottom: 8 }}>이벤트 설정</p>

        <label>공지 (모든 페이지 상단 노출)</label>
        <NoticeEditor value={s.notice || ""} onSave={(v) => setSetting("notice", v)} busy={busy} />

        <label>로또 최대 응모 장수</label>
        <select
          value={s.max_lotto_entries || "2"}
          onChange={(e) => setSetting("max_lotto_entries", e.target.value)}
          disabled={busy}
        >
          {[1, 2, 3].map((n) => <option key={n} value={n}>{n}장</option>)}
        </select>

        <label>로또 추첨</label>
        {s.winning_numbers ? (
          <div className="rule-box">
            🎉 당첨 번호: <b>{s.winning_numbers.slice(0, 2)}.{s.winning_numbers.slice(2)}</b>
            <button
              className="btn danger sm"
              style={{ marginLeft: 10 }}
              onClick={() => setSetting("winning_numbers", "", "추첨 결과를 초기화할까요? 회원들에게 보이던 결과가 사라집니다.")}
            >
              초기화
            </button>
          </div>
        ) : (
          <button className="btn primary" onClick={drawNumbers} disabled={busy}>
            🎰 당첨 번호 추첨하기
          </button>
        )}
        <p className="hint" style={{ marginTop: 6 }}>
          업로드 기간: {s.upload_start?.slice(0, 10)} ~ {s.upload_end?.slice(0, 10)} · 추첨일 {s.draw_date}
        </p>
      </div>

      {/* 회원 목록 */}
      <div className="card">
        <p style={{ fontWeight: 700, marginBottom: 8 }}>회원 ({overview.users.length}명)</p>
        <table>
          <thead>
            <tr>
              <th>닉네임</th>
              <th className="num">빙고</th>
              <th className="num">줄</th>
              <th className="num">로또</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function NoticeEditor({ value, onSave, busy }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="예: 추첨은 8/15 저녁 8시!" />
      <button className="btn ghost" onClick={() => onSave(text)} disabled={busy}>저장</button>
    </div>
  );
}
