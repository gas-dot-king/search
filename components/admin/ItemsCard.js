"use client";

import ItemsList from "@/components/ItemsList";

/** 전체 빙고 항목 카드 (관리자 참고용) */
export default function ItemsCard({ items }) {
  return (
    <div className="card">
      <p style={{ fontWeight: 700, marginBottom: 4 }}>전체 빙고 항목 ({(items || []).length}개)</p>
      <p className="hint" style={{ marginBottom: 10 }}>
        회원마다 카테고리별 5~6개, 총 16개가 랜덤으로 뽑힙니다.
      </p>
      <ItemsList items={items} />
    </div>
  );
}
