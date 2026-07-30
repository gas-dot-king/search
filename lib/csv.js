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

export const USER_CSV_HEADER = ["닉네임", "빙고 칸", "줄", "로또 응모", "가입일(KST)"];

/** 관리자 회원 목록 다운로드용 CSV */
export function usersToCsv(users) {
  return toCsv([
    USER_CSV_HEADER,
    ...(users || []).map((user) => [
      user.nickname,
      user.filled,
      user.lines,
      user.lottoEntries,
      user.createdAt ? toKstInputValue(user.createdAt).replace("T", " ") : "",
    ]),
  ]);
}
