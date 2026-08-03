import { describe, expect, it } from "vitest";
import { isIdentityTicketError, isRecoveryTicketCollision } from "../lib/recovery";

// 이벤트 당일, 마이그레이션 하나가 안 돌아가 전원이 접수에 실패했다.
// ticket_no가 identity인 스키마를 알아보고 물러설 수 있어야 한다.
describe("접수번호 컬럼이 identity인 스키마 판별", () => {
  it("Postgres 오류 코드 428C9를 알아본다", () => {
    expect(isIdentityTicketError({ code: "428C9" })).toBe(true);
  });

  it("코드가 없어도 메시지로 알아본다", () => {
    expect(isIdentityTicketError({
      message: 'cannot insert a non-DEFAULT value into column "ticket_no"',
    })).toBe(true);
    expect(isIdentityTicketError({
      message: 'column "ticket_no" is a GENERATED ALWAYS identity column',
    })).toBe(true);
  });

  it("다른 오류를 identity 문제로 착각하지 않는다", () => {
    expect(isIdentityTicketError({ code: "23505", message: "duplicate key" })).toBe(false);
    expect(isIdentityTicketError({ code: "42P01", message: "relation does not exist" })).toBe(false);
    expect(isIdentityTicketError(null)).toBe(false);
    expect(isIdentityTicketError(undefined)).toBe(false);
    expect(isIdentityTicketError({})).toBe(false);
  });

  it("접수번호 충돌과는 별개로 본다", () => {
    const collision = { code: "23505", message: 'duplicate key value violates unique constraint "recovery_entries_pkey"' };
    expect(isRecoveryTicketCollision(collision)).toBe(true);
    expect(isIdentityTicketError(collision)).toBe(false);
  });
});
