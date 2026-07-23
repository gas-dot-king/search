"use client";

import ItemsList from "@/components/ItemsList";

/** 전체 빙고 항목 카드 (관리자 참고용) */
export default function ItemsCard({ items }) {
  return (
    <div className="card">
      <p style={{ fontWeight: 700, marginBottom: 4 }}>전체 빙고 항목 ({(items || []).length}개)</p>
      <p className="hint" style={{ marginBottom: 10 }}>
        회원마다 ① 4개 · ② 6개 · ③ 6개, 총 16개가 랜덤으로 뽑힙니다. (다시 뽑기는 1인 1회)
      </p>
      <ItemsList items={items} />
    </div>
  );
}
