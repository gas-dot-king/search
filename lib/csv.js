import { toKstInputValue } from "./period";

// 엑셀은 =, +, -, @ 로 시작하는 칸을 수식으로 해석한다. 닉네임은 회원이 직접 정하므로
// 선두에 작은따옴표를 붙여 항상 글자로 열리게 한다. (엑셀 화면에는 따옴표가 보이지 않는다)
function csvCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

// 엑셀은 BOM이 없는 CSV를 시스템 인코딩으로 열어 한글을 깨뜨린다.
const BOM = String.fromCharCode(0xfeff);

/** 2차원 배열을 엑셀이 그대로 여는 CSV 문자열로 바꾼다 */
export function toCsv(rows) {
  return BOM + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

const kst = (value) => (value ? toKstInputValue(value).replace("T", " ") : "");

/** CSV 문자열을 파일로 내려받는다. 엑셀이 바로 열도록 utf-8 BOM은 toCsv가 이미 붙여 뒀다. */
export function downloadCsv(csv, filename) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export const USER_CSV_HEADER = [
  "닉네임", "빙고 칸", "줄", "로또 응모", "마지막 인증(KST)",
  "4줄 순위", "4줄 달성(KST)", "확정", "가입일(KST)",
];

/**
 * 관리자 회원 목록 다운로드용 CSV.
 * 선물 명단을 따로 만들 수 있도록 4줄 순위와 확정 여부까지 함께 넣는다.
 * @param users 진행 현황
 * @param fourLine 4줄 선착순 [{ id, rank, achievedAt, confirmed }]
 */
export function usersToCsv(users, fourLine = []) {
  const rankOf = new Map((fourLine || []).map((item) => [item.id, item]));
  return toCsv([
    USER_CSV_HEADER,
    ...(users || []).map((user) => {
      const award = rankOf.get(user.id);
      return [
        user.nickname,
        user.filled,
        user.lines,
        user.lottoEntries,
        kst(user.lastUploadAt),
        award ? award.rank : "",
        award ? kst(award.achievedAt) : "",
        award ? (award.confirmed ? "확정" : "검토중") : "",
        kst(user.createdAt),
      ];
    }),
  ]);
}

export const FOUR_LINE_CSV_HEADER = ["순위", "닉네임", "달성 시각(KST)", "확정", "선물 대상"];

/** 선물 명단만 따로 — 4줄 달성자를 순위대로 */
export function fourLineToCsv(fourLine = [], prizeCount = 20) {
  return toCsv([
    FOUR_LINE_CSV_HEADER,
    ...(fourLine || []).map((item) => [
      item.rank,
      item.nickname,
      kst(item.achievedAt),
      item.confirmed ? "확정" : "검토중",
      item.rank <= prizeCount ? "O" : "",
    ]),
  ]);
}
