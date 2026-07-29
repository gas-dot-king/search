export const LOTTO_ENTRY_LIMIT = 2;
export const LOTTO_DRAW_DIGITS = 3;

// 1등이 나올 때까지 다시 뽑으므로 차수가 쌓인다. 화면이 감당할 만큼만 남긴다.
export const MAX_LOTTO_ROUNDS = 20;

/** 1등이 없어 넘어간 지난 차수의 당첨 번호 목록 */
export function parseLottoRounds(raw) {
  const list = Array.isArray(raw) ? raw : safeParseArray(raw);
  return list
    .map((value) => String(value ?? "").trim())
    .filter((value) => new RegExp(`^\\d{${LOTTO_DRAW_DIGITS}}$`).test(value))
    .slice(0, MAX_LOTTO_ROUNDS);
}

function safeParseArray(raw) {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeLottoRounds(rounds) {
  return JSON.stringify(parseLottoRounds(rounds));
}

/** 지금 진행 중인 차수 (1등이 나오면 그 차수에서 끝난다) */
export function currentLottoRound(pastRounds) {
  return parseLottoRounds(pastRounds).length + 1;
}

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
