import { sb, signedUrls, thumbPathFor } from "./db";
import { requireDbSuccess } from "./api";
import {
  computeWinners,
  currentLottoRound,
  parseLottoRounds,
  LOTTO_DRAW_DIGITS,
} from "./lotto";

/** 현재 차수의 추첨 상태 — 3자리가 다 나왔으면 1등까지 계산해서 돌려준다. */
export async function lottoRoundState(settings) {
  const digits = settings.winning_numbers || "";
  const pastRounds = parseLottoRounds(settings.lotto_rounds);
  const complete = digits.length === LOTTO_DRAW_DIGITS;

  const { data: entries, error } = await sb()
    .from("lotto_entries")
    .select("digits, users ( nickname )")
    .not("slot", "is", null);
  requireDbSuccess(error, "응모 내역을 불러오지 못했습니다");

  return {
    digits,
    round: currentLottoRound(pastRounds),
    pastRounds,
    complete,
    entryCount: (entries || []).length,
    winners: complete ? computeWinners(entries, digits) : null,
  };
}

/** 사진 목록의 썸네일·원본 주소를 함께 만들어 경로로 찾아 쓰는 함수를 돌려준다. */
export async function photoUrlLookup(paths) {
  const valid = [...new Set((paths || []).filter(Boolean))];
  const [thumbMap, fullMap] = await Promise.all([
    signedUrls(valid.map(thumbPathFor), { retryMissing: false }),
    signedUrls(valid),
  ]);
  return (path) => {
    if (!path) return { photoUrl: null, thumbUrl: null };
    const photoUrl = fullMap[path] || null;
    return { photoUrl, thumbUrl: thumbMap[thumbPathFor(path)] || photoUrl };
  };
}

/** 회원의 로또 응모. 구버전 DB에서도 사진 메타데이터 없이 회원 상세를 연다. */
export async function lottoEntriesFor(userId) {
  const query = (columns) =>
    sb()
      .from("lotto_entries")
      .select(columns)
      .eq("user_id", userId)
      .not("slot", "is", null)
      .order("created_at");

  const withMeta = await query("id, digits, photo_path, created_at, photo_meta");
  if (!withMeta.error) return withMeta;
  console.error("[admin] lotto photo_meta not read", withMeta.error);
  return query("id, digits, photo_path, created_at");
}
