"use client";

export const CATEGORY_NAMES = {
  1: "① 러닝 기록·운동 달성",
  2: "② 시간·장소·러닝 탐험",
  3: "③ 크루 소통·재미 인증",
};

/** 전체 빙고 항목을 카테고리별로 나열 (회원/관리자 공용) */
export default function ItemsList({ items }) {
  const byCat = { 1: [], 2: [], 3: [] };
  for (const it of items || []) byCat[it.category]?.push(it);

  return (
    <>
      {[1, 2, 3].map((cat) => (
        <div key={cat} style={{ marginBottom: 12 }}>
          <p style={{ fontWeight: 700, fontSize: "0.85rem", margin: "8px 0 4px" }}>
            <i
              className={`cat${cat}`}
              style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", marginRight: 6 }}
            />
            {CATEGORY_NAMES[cat]} ({byCat[cat].length}개)
          </p>
          <ul style={{ listStyle: "none", fontSize: "0.85rem", color: "var(--muted)" }}>
            {byCat[cat].map((it) => (
              <li key={it.id} style={{ padding: "3px 0 3px 14px", borderBottom: "1px dashed var(--line)" }}>
                {it.content}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
