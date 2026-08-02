import { describe, expect, it } from "vitest";
import {
  photoReview,
  matchesReviewFilter,
  takenBeforeEvent,
  REVIEW_FILTERS,
} from "../lib/photoReview";

// 업로드는 한국 시간 8/3 14:00
const UPLOADED = "2026-08-03T05:00:00Z";
const EVENT_START = "2026-08-01T06:00:00+09:00";

describe("인증 사진 검토 정보", () => {
  it("촬영 정보가 없으면 없다고만 알린다", () => {
    const review = photoReview(null, UPLOADED);
    expect(review.hasMeta).toBe(false);
    expect(review.takenLabel).toBeNull();
    expect(review.flag).toBeNull();
  });

  it("빈 객체도 촬영 정보 없음으로 본다", () => {
    expect(photoReview({}, UPLOADED).hasMeta).toBe(false);
  });

  it("촬영 시각을 월-일 시:분으로 짧게 보여준다", () => {
    const review = photoReview({ takenAt: "2026-08-03T13:42:07" }, UPLOADED);
    expect(review.takenLabel).toBe("08-03 13:42");
  });

  it("같은 날 찍어 올리면 경고하지 않는다", () => {
    // 한국 시간 8/3 13:42 촬영 → 8/3 14:00 업로드
    expect(photoReview({ takenAt: "2026-08-03T13:42:07" }, UPLOADED).flag).toBeNull();
  });

  // 며칠 전에 찍은 사진을 올리는 건 규칙 위반이 아니다(같은 날 올리라는 규칙이 없다).
  // 참고(note)로만 적고, 경고(flag)로 올리지 않는다.
  it("며칠 전 사진은 참고로만 적는다", () => {
    const review = photoReview({ takenAt: "2026-08-02T13:00:00" }, UPLOADED, EVENT_START);
    expect(review.gapDays).toBe(1);
    expect(review.note).toBe("1일 전 촬영");
    expect(review.flag).toBeNull();
  });

  // 기기 시간대를 무시하고 한국 시간으로 읽으면 해외에서 찍은 사진이
  // 실제보다 이르거나 늦은 것으로 보여 엉뚱한 경고가 뜬다.
  it("기기가 남긴 시간대를 반영해 시차를 계산한다", () => {
    const utc = { takenAt: "2026-08-03T04:30:00", utcOffset: "+00:00" }; // 한국 시간 13:30
    expect(photoReview(utc, UPLOADED).flag).toBeNull();
    expect(photoReview(utc, UPLOADED).gapDays).toBe(0);
  });

  it("시간대가 없으면 한국에서 찍은 것으로 본다", () => {
    expect(photoReview({ takenAt: "2026-08-03T13:30:00" }, UPLOADED).gapDays).toBe(0);
  });

  it("촬영 시각이 업로드보다 미래면 기기 시계를 의심하게 알린다", () => {
    const review = photoReview({ takenAt: "2026-08-05T10:00:00" }, UPLOADED);
    expect(review.flag).toBe("촬영 시각이 업로드보다 미래");
  });

  it("좌표가 둘 다 있어야 위치로 인정한다", () => {
    expect(photoReview({ lat: 35.33, lng: 129.02 }, UPLOADED).hasGps).toBe(true);
    expect(photoReview({ lat: 35.33 }, UPLOADED).hasGps).toBe(false);
  });

  it("기기 제조사와 모델을 한 줄로 합친다", () => {
    expect(photoReview({ make: "Apple", model: "iPhone 15 Pro" }, UPLOADED).device).toBe("Apple iPhone 15 Pro");
    expect(photoReview({ model: "Galaxy S24" }, UPLOADED).device).toBe("Galaxy S24");
  });

  it("업로드 시각이 없으면 시차를 계산하지 않는다", () => {
    const review = photoReview({ takenAt: "2026-08-03T13:00:00" }, null);
    expect(review.gapDays).toBeNull();
    expect(review.flag).toBeNull();
  });
});

// 이벤트 기간 밖에 찍은 사진만이 확실한 위반이다. 이 판정으로 업로드까지 막으므로,
// 잘못 막으면 정상 회원이 인증을 못 한다 — 경계를 촘촘히 확인한다.
describe("이벤트 시작 전 촬영 판정", () => {
  it("시작 전에 찍었으면 막는다", () => {
    expect(takenBeforeEvent({ takenAt: "2026-07-31T20:00:00" }, EVENT_START)).toBe(true);
  });

  it("시작 시각 이후면 통과시킨다", () => {
    expect(takenBeforeEvent({ takenAt: "2026-08-01T06:00:01" }, EVENT_START)).toBe(false);
    expect(takenBeforeEvent({ takenAt: "2026-08-05T09:00:00" }, EVENT_START)).toBe(false);
  });

  it("시작 시각 정각은 통과시킨다", () => {
    expect(takenBeforeEvent({ takenAt: "2026-08-01T06:00:00" }, EVENT_START)).toBe(false);
  });

  it("시작 1분 전은 막는다", () => {
    expect(takenBeforeEvent({ takenAt: "2026-08-01T05:59:00" }, EVENT_START)).toBe(true);
  });

  // 러닝 앱 화면 캡처에는 EXIF가 없다. 이걸 막으면 기록 달성 칸을 아무도 못 채운다.
  it("촬영 정보가 없으면 막지 않는다", () => {
    expect(takenBeforeEvent(null, EVENT_START)).toBe(false);
    expect(takenBeforeEvent({}, EVENT_START)).toBe(false);
    expect(takenBeforeEvent({ make: "Apple" }, EVENT_START)).toBe(false);
  });

  it("설정을 못 읽었으면 막지 않는다", () => {
    expect(takenBeforeEvent({ takenAt: "2026-07-01T09:00:00" }, null)).toBe(false);
    expect(takenBeforeEvent({ takenAt: "2026-07-01T09:00:00" }, "언제부터더라")).toBe(false);
  });

  // 해외에서 찍은 사진을 한국 시간으로 잘못 읽으면 멀쩡한 인증이 막힐 수 있다.
  it("기기 시간대를 반영해 판단한다", () => {
    // 런던 8/1 00:30 = 한국 8/1 09:30 → 시작(8/1 06:00) 이후라 통과
    expect(takenBeforeEvent({ takenAt: "2026-08-01T00:30:00", utcOffset: "+00:00" }, EVENT_START))
      .toBe(false);
    // 같은 벽시계 시각이라도 한국 기준이면 8/1 00:30이라 시작 전
    expect(takenBeforeEvent({ takenAt: "2026-08-01T00:30:00", utcOffset: "+09:00" }, EVENT_START))
      .toBe(true);
  });

  it("photoReview가 경고로 올린다", () => {
    const review = photoReview({ takenAt: "2026-07-20T09:00:00" }, UPLOADED, EVENT_START);
    expect(review.beforeEvent).toBe(true);
    expect(review.flag).toBe("이벤트 시작 전 촬영");
    expect(review.note).toBeNull(); // 경고가 있으면 참고는 따로 안 적는다
  });

  it("시작 시각을 안 주면 판단하지 않는다", () => {
    expect(photoReview({ takenAt: "2026-07-20T09:00:00" }, UPLOADED).beforeEvent).toBe(false);
  });
});

describe("검토 큐 필터", () => {
  const normal = { photoMeta: { takenAt: "2026-08-03T13:42:00" }, uploadedAt: UPLOADED };
  const beforeEvent = { photoMeta: { takenAt: "2026-07-20T13:00:00" }, uploadedAt: UPLOADED };
  const olderButValid = { photoMeta: { takenAt: "2026-08-01T13:00:00" }, uploadedAt: UPLOADED };
  const bare = { photoMeta: null, uploadedAt: UPLOADED };

  it("전체는 모두 통과시킨다", () => {
    for (const upload of [normal, beforeEvent, olderButValid, bare]) {
      expect(matchesReviewFilter(upload, REVIEW_FILTERS.ALL, EVENT_START)).toBe(true);
    }
  });

  it("기간 전 촬영만 남긴다", () => {
    expect(matchesReviewFilter(beforeEvent, REVIEW_FILTERS.FLAGGED, EVENT_START)).toBe(true);
    expect(matchesReviewFilter(normal, REVIEW_FILTERS.FLAGGED, EVENT_START)).toBe(false);
    expect(matchesReviewFilter(bare, REVIEW_FILTERS.FLAGGED, EVENT_START)).toBe(false);
  });

  it("기간 안에서 며칠 전에 찍은 사진은 거르지 않는다", () => {
    expect(matchesReviewFilter(olderButValid, REVIEW_FILTERS.FLAGGED, EVENT_START)).toBe(false);
  });

  it("촬영정보 없음은 EXIF가 없는 사진만 남긴다", () => {
    expect(matchesReviewFilter(bare, REVIEW_FILTERS.NO_META, EVENT_START)).toBe(true);
    expect(matchesReviewFilter(normal, REVIEW_FILTERS.NO_META, EVENT_START)).toBe(false);
  });
});
