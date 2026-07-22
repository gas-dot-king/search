"use client";

const CATEGORY_NAMES = {
  1: "① 러닝 기록·운동 달성",
  2: "② 시간·장소·러닝 탐험",
  3: "③ 크루 소통·재미 인증",
};

/** 전체 빙고 항목을 카테고리별로 보여주는 카드 (관리자 참고용) */
export default function ItemsCard({ items }) {
  const byCat = { 1: [], 2: [], 3: [] };
  for (const it of items || []) byCat[it.category]?.push(it);

  return (
    <div className="card">
      <p style={{ fontWeight: 700, marginBottom: 4 }}>전체 빙고 항목 ({(items || []).length}개)</p>
      <p className="hint" style={{ marginBottom: 10 }}>
        회원마다 카테고리별 5~6개, 총 16개가 랜덤으로 뽑힙니다.
      </p>
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
    </div>
  );
}
