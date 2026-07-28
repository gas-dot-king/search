export const LOTTO_ENTRY_LIMIT = 2;
export const LOTTO_DRAW_DIGITS = 3;

/** 응모 거리 "05.24"에서 추첨 대상인 1의 자리·소수점 첫째·둘째 자리("524") */
export function entryDrawDigits(digits) {
  return String(digits || "").replace(/\D/g, "").slice(-LOTTO_DRAW_DIGITS);
}

/** 응모 거리와 추첨 번호의 세 자리를 위치별로 비교 */
export function matchCount(digits, winning) {
  const target = entryDrawDigits(digits);
  let n = 0;
  for (let i = 0; i < LOTTO_DRAW_DIGITS; i++) if (target[i] === winning[i]) n++;
  return n;
}

/**
 * 당첨자 명단: 1인 최고 일치 1장만 인정, 세 자리 모두 일치한 1등만 포함
 * @param {Array<{digits:string, users:{nickname:string}}>} entries
 */
export function computeWinners(entries, winning) {
  const best = new Map(); // nickname -> { digits, matches }
  for (const e of entries || []) {
    const nick = e.users?.nickname || "?";
    const m = matchCount(e.digits, winning);
    if (!best.has(nick) || m > best.get(nick).matches) best.set(nick, { digits: e.digits, matches: m });
  }
  return [...best.entries()]
    .map(([nickname, v]) => ({ nickname, ...v }))
    .filter((w) => w.matches === LOTTO_DRAW_DIGITS)
    .sort((a, b) => b.matches - a.matches || a.nickname.localeCompare(b.nickname));
}
