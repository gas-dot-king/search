"use client";

import { useState } from "react";
import { adminPost } from "@/lib/adminClient";
import { formatKoreanDateTime } from "@/lib/period";

/**
 * 지우다 만 사진 파일 현황.
 *
 * 사진 삭제는 DB와 Storage 두 곳에서 일어나는데 한 트랜잭션으로 묶을 수 없어,
 * Storage 쪽이 실패하면 큐에 남겨 두고 다음 관리자 동작 때 다시 시도한다.
 * 그 큐가 계속 쌓이면 비공개 버킷에 주인 없는 사진이 남아 있다는 뜻이라 보이게 해 둔다.
 * 평소에는 0건이라 카드 자체가 나타나지 않는다.
 */
export default function CleanupCard({ cleanup, onChanged }) {
  const [busy, setBusy] = useState(false);
  if (!cleanup?.pending) return null;

  async function retry() {
    setBusy(true);
    try {
      const result = await adminPost({ action: "retry_cleanup" });
      alert(result.cleanup?.pending ? `아직 ${result.cleanup.pending}건이 남았습니다.` : "모두 정리했습니다.");
      await onChanged();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card cleanup-card">
      <p className="card-title">🧹 정리 못한 사진 {cleanup.pending}건</p>
      <p className="hint">
        지워진 인증의 사진 파일이 저장소에 남아 있습니다. 다른 관리자 작업을 할 때 자동으로 다시 시도하지만,
        계속 남아 있으면 아래 버튼으로 밀어 보세요.
        {cleanup.stuck > 0 && (
          <b className="cleanup-stuck"> 3번 이상 실패한 파일이 {cleanup.stuck}건 있습니다.</b>
        )}
      </p>
      {cleanup.oldest && (
        <p className="hint">가장 오래된 건: {formatKoreanDateTime(cleanup.oldest)}</p>
      )}

      {cleanup.samples?.length > 0 && (
        <ul className="cleanup-list">
          {cleanup.samples.map((sample) => (
            <li key={sample.path}>
              <code>{sample.path}</code>
              <span>
                {sample.attempts}회 실패
                {sample.lastError && ` · ${sample.lastError}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <button className="btn ghost wide" onClick={retry} disabled={busy}>
        {busy ? "정리하는 중..." : "🧹 지금 다시 정리"}
      </button>
    </section>
  );
}
