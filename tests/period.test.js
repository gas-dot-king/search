import { describe, expect, it } from "vitest";
import {
  UPLOAD_PERIOD,
  formatKoreanDateTime,
  fromKstInputValue,
  inUploadPeriod,
  periodSettingsFromConfig,
  toKstInputValue,
  uploadPeriodNotice,
  uploadPeriodState,
} from "../lib/period";

// 실제 운영 값: 2026-08-01 06:00 ~ 2026-08-14 18:00 (KST)
const SETTINGS = {
  upload_start: "2026-08-01T06:00:00+09:00",
  upload_end: "2026-08-14T18:00:00+09:00",
};

const at = (iso) => new Date(iso);

describe("업로드·응모 기간 판정", () => {
  it("시작 전에는 before — 업로드 불가", () => {
    expect(uploadPeriodState(SETTINGS, at("2026-07-28T12:00:00+09:00"))).toBe(UPLOAD_PERIOD.BEFORE);
    expect(inUploadPeriod(SETTINGS, at("2026-07-28T12:00:00+09:00"))).toBe(false);
  });

  it("시작 1초 전은 막고, 8월 1일 오전 6시 정각부터 연다", () => {
    expect(uploadPeriodState(SETTINGS, at("2026-08-01T05:59:59+09:00"))).toBe(UPLOAD_PERIOD.BEFORE);
    expect(uploadPeriodState(SETTINGS, at("2026-08-01T06:00:00+09:00"))).toBe(UPLOAD_PERIOD.OPEN);
  });

  it("기간 중에는 open", () => {
    expect(inUploadPeriod(SETTINGS, at("2026-08-07T23:30:00+09:00"))).toBe(true);
  });

  it("8월 14일 오후 6시 정각까지 열고, 그 뒤로는 closed", () => {
    expect(uploadPeriodState(SETTINGS, at("2026-08-14T18:00:00+09:00"))).toBe(UPLOAD_PERIOD.OPEN);
    expect(uploadPeriodState(SETTINGS, at("2026-08-14T18:00:01+09:00"))).toBe(UPLOAD_PERIOD.CLOSED);
    expect(inUploadPeriod(SETTINGS, at("2026-08-15T09:00:00+09:00"))).toBe(false);
  });

  it("설정이 비었거나 형식이 어긋나면 열지 않는다", () => {
    expect(uploadPeriodState({}, at("2026-08-07T12:00:00+09:00"))).toBe(UPLOAD_PERIOD.CLOSED);
    expect(uploadPeriodState(undefined, at("2026-08-07T12:00:00+09:00"))).toBe(UPLOAD_PERIOD.CLOSED);
    expect(
      uploadPeriodState({ upload_start: "언제부터", upload_end: "언제까지" }, at("2026-08-07T12:00:00+09:00"))
    ).toBe(UPLOAD_PERIOD.CLOSED);
  });
});

describe("기간 안내 문구", () => {
  it("기간 중에는 안내가 없다", () => {
    expect(uploadPeriodNotice(SETTINGS, at("2026-08-07T12:00:00+09:00"))).toBe("");
  });

  it("시작 전에는 여는 시각을 알려준다", () => {
    const notice = uploadPeriodNotice(SETTINGS, at("2026-07-28T12:00:00+09:00"));
    expect(notice).toContain("8월 1일 오전 6시");
    expect(notice).toContain("보기만");
  });

  it("마감 후에는 닫힌 시각을 알려준다", () => {
    const notice = uploadPeriodNotice(SETTINGS, at("2026-08-20T12:00:00+09:00"));
    expect(notice).toContain("8월 14일 오후 6시");
  });

  it("설정이 망가져도 문구는 만들어진다", () => {
    expect(uploadPeriodNotice({}, at("2026-08-07T12:00:00+09:00"))).not.toBe("");
  });
});

describe("한국 시간 표기", () => {
  it("정각은 분을 생략한다", () => {
    expect(formatKoreanDateTime("2026-08-01T06:00:00+09:00")).toBe("8월 1일 오전 6시");
    expect(formatKoreanDateTime("2026-08-14T18:00:00+09:00")).toBe("8월 14일 오후 6시");
  });

  it("분이 있으면 함께 적는다", () => {
    expect(formatKoreanDateTime("2026-08-14T18:30:00+09:00")).toBe("8월 14일 오후 6시 30분");
  });

  it("UTC로 저장돼도 한국 시간으로 바꿔 보여준다", () => {
    expect(formatKoreanDateTime("2026-07-31T21:00:00Z")).toBe("8월 1일 오전 6시");
  });

  it("빈 값·잘못된 값은 빈 문자열", () => {
    expect(formatKoreanDateTime("")).toBe("");
    expect(formatKoreanDateTime("내일")).toBe("");
  });
});

describe("공개 설정 변환", () => {
  it("/api/config 응답을 그대로 판정에 쓸 수 있다", () => {
    const config = { uploadStart: SETTINGS.upload_start, uploadEnd: SETTINGS.upload_end };
    expect(uploadPeriodState(periodSettingsFromConfig(config), at("2026-08-07T12:00:00+09:00"))).toBe(
      UPLOAD_PERIOD.OPEN
    );
    expect(periodSettingsFromConfig(null)).toEqual({ upload_start: undefined, upload_end: undefined });
  });
});

describe("관리자 기간 입력값 변환", () => {
  it("저장된 ISO 시각을 한국 시간 벽시계로 보여준다", () => {
    expect(toKstInputValue(SETTINGS.upload_start)).toBe("2026-08-01T06:00");
    expect(toKstInputValue(SETTINGS.upload_end)).toBe("2026-08-14T18:00");
  });

  it("UTC로 저장돼 있어도 한국 시간으로 환산해 보여준다", () => {
    expect(toKstInputValue("2026-07-31T21:00:00Z")).toBe("2026-08-01T06:00");
  });

  it("형식이 깨진 값은 빈 칸으로 둬서 관리자가 알아채게 한다", () => {
    expect(toKstInputValue("어제")).toBe("");
    expect(toKstInputValue("")).toBe("");
  });

  it("입력값에 +09:00을 붙여 저장한다 — 없으면 서버가 UTC로 9시간 어긋나게 읽는다", () => {
    expect(fromKstInputValue("2026-08-01T06:00")).toBe("2026-08-01T06:00:00+09:00");
  });

  it("형식이 어긋난 입력은 저장값을 만들지 않는다", () => {
    expect(fromKstInputValue("2026-08-01")).toBe("");
    expect(fromKstInputValue("아무거나")).toBe("");
    expect(fromKstInputValue(null)).toBe("");
  });

  it("보여주기 → 저장 왕복에도 시각이 그대로다", () => {
    expect(fromKstInputValue(toKstInputValue(SETTINGS.upload_start))).toBe(SETTINGS.upload_start);
  });

  it("왕복한 값이 기간 판정에서도 같게 동작한다", () => {
    const roundTripped = {
      upload_start: fromKstInputValue(toKstInputValue(SETTINGS.upload_start)),
      upload_end: fromKstInputValue(toKstInputValue(SETTINGS.upload_end)),
    };
    expect(uploadPeriodState(roundTripped, at("2026-08-07T12:00:00+09:00"))).toBe(UPLOAD_PERIOD.OPEN);
    expect(uploadPeriodState(roundTripped, at("2026-07-31T12:00:00+09:00"))).toBe(UPLOAD_PERIOD.BEFORE);
    expect(uploadPeriodState(roundTripped, at("2026-08-20T12:00:00+09:00"))).toBe(UPLOAD_PERIOD.CLOSED);
  });
});
