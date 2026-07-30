import { describe, expect, it } from "vitest";
import { USER_CSV_HEADER, toCsv, usersToCsv } from "../lib/csv";

const BOM = String.fromCharCode(0xfeff);
const lines = (csv) => csv.replace(BOM, "").split("\r\n");

describe("CSV 만들기", () => {
  it("엑셀이 한글을 읽도록 BOM으로 시작한다", () => {
    expect(toCsv([["닉네임"]]).startsWith(BOM)).toBe(true);
  });

  it("따옴표가 든 값도 한 칸으로 유지된다", () => {
    expect(lines(toCsv([['가"나', "다,라"]]))).toEqual(['"가""나","다,라"']);
  });

  it("=로 시작하는 닉네임은 수식이 아니라 글자로 저장한다", () => {
    expect(lines(toCsv([["=1+1", "-2", "@ysrc"]]))).toEqual(["\"'=1+1\",\"'-2\",\"'@ysrc\""]);
  });
});

describe("회원 목록 CSV", () => {
  const users = [
    { nickname: "달리는곰", filled: 16, lines: 4, lottoEntries: 3, createdAt: "2026-08-01T00:30:00Z" },
    { nickname: "코코", filled: 0, lines: 0, lottoEntries: 0, createdAt: "" },
  ];

  it("머리글 + 회원 수만큼 줄을 만든다", () => {
    const rows = lines(usersToCsv(users));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toBe(USER_CSV_HEADER.map((h) => `"${h}"`).join(","));
  });

  it("가입일은 한국 시간으로 적고, 없으면 빈 칸으로 둔다", () => {
    const rows = lines(usersToCsv(users));
    expect(rows[1]).toBe('"달리는곰","16","4","3","2026-08-01 09:30"');
    expect(rows[2]).toBe('"코코","0","0","0",""');
  });

  it("회원이 없으면 머리글만 남는다", () => {
    expect(lines(usersToCsv([]))).toHaveLength(1);
  });
});
