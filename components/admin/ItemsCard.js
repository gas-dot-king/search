"use client";

import { useState } from "react";
import ItemsList from "@/components/ItemsList";

/** 전체 빙고 항목 카드 (관리자 참고용, 기본은 접힘) */
export default function ItemsCard({ items }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="card">
      <button
        type="button"
        className="admin-collapse-toggle"
        aria-expanded={open}
        aria-controls="admin-items-body"
        onClick={() => setOpen((prev) => !prev)}
      >
        <span style={{ fontWeight: 700 }}>전체 빙고 항목 ({(items || []).length}개)</span>
        <span className="admin-collapse-caret" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div id="admin-items-body">
          <p className="hint" style={{ margin: "10px 0" }}>
            회원마다 ① 4개 · ② 6개 · ③ 6개, 총 16개가 랜덤으로 뽑힙니다. (다시 뽑기는 1인 1회)
          </p>
          <ItemsList items={items} />
        </div>
      )}
    </div>
  );
}
