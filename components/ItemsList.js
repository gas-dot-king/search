"use client";

export const CATEGORY_NAMES = {
  1: "① 러닝 기록·운동 달성",
  2: "② 시간·장소·러닝 탐험",
  3: "③ 크루 소통·재미 인증",
};

/** 전체 빙고 항목을 카테고리별 색 구분 그룹으로 나열 (회원/관리자 공용) */
export default function ItemsList({ items }) {
  const byCat = { 1: [], 2: [], 3: [] };
  for (const it of items || []) byCat[it.category]?.push(it);

  return (
    <>
      {[1, 2, 3].map((cat) => (
        <div key={cat} className={`items-group g${cat}`}>
          <p className="g-title">
            {CATEGORY_NAMES[cat]} ({byCat[cat].length}개)
          </p>
          <ul>
            {byCat[cat].map((it) => (
              <li key={it.id}>{it.content}</li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}
