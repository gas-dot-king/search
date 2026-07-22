/** 자리별 일치 수 (digits, winning: "0524" 형태 4자리) */
export function matchCount(digits, winning) {
  let n = 0;
  for (let i = 0; i < 4; i++) if (digits[i] === winning[i]) n++;
  return n;
}

/**
 * 당첨자 명단: 1인 최고 일치 1장만 인정, 2개 이상 일치만 포함
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
    .filter((w) => w.matches >= 2)
    .sort((a, b) => b.matches - a.matches || a.nickname.localeCompare(b.nickname));
}
