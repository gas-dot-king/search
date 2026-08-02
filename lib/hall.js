// 명예의 전당 데이터.
// 후원자·수상자 명단은 이벤트가 끝나면 더 바뀌지 않으므로 관리자 설정 대신 여기에 적어 둔다.
// 명단을 고칠 일이 생기면 이 파일만 수정하면 된다.

import { countLines } from "./bingo";

export const BOARD_CELL_COUNT = 16;

/** 4줄을 채우면 선물 대상. 인증 확인을 거쳐 선착순 20명에게 준다. */
export const FOUR_LINE_GOAL = 4;
export const FOUR_LINE_PRIZE_COUNT = 20;

/** 여름 이벤트를 후원해주신 크루원 닉네임 (등재 순서 그대로 노출) */
export const SPONSORS = [
  "슈라라", "진담", "진로", "꼬부기", "GD", "엠제이", "진소", "데이비드",
  "푸린", "김부장", "방구왕", "지친영혼", "석이", "달려", "해전", "하미",
  "반짝이", "꾸리", "겨울이", "일상", "마카", "하늘이", "SOON", "먹깨비",
  "백미", "우독술", "화이팅", "딸기아빠", "은하수", "에몽스", "땅콩버터", "몽",
  "그루터기", "헌터", "목화솜", "달리자고", "알짜", "여름눈꽃", "클로이", "김과장",
  "러닝초보", "나애리", "아주작은기적밍기적", "당근꽃", "데이지", "부씨맨", "연보라", "또또",
  "하비똥", "장안사람", "뚜루", "곰인형", "유나", "하루", "쏘쏘", "하프",
  "트럭아재", "블루", "필립", "응디", "콘이", "쑤운", "늘봄", "러닝뉴비",
];

/**
 * 28일 챌린지 수상자.
 * { title: "상 이름", nickname: "수상자", note: "비고(선택)" } 형태로 채운다.
 */
export const CHALLENGE_AWARDS = [];

/**
 * 사람마다 4줄을 완성한 순간(그 줄을 채운 마지막 인증 시각)을 찾아 선착순으로 세운다.
 * 선물이 걸린 순서라 같은 시각이면 user_id로 순서를 고정해, 다시 계산해도 순위가 흔들리지 않게 한다.
 * @param {Array<{user_id:string, position:number, uploaded_at:string}>} cells 인증 사진이 있는 칸만
 * @returns {Array<{userId:string, achievedAt:string, rank:number}>}
 */
export function fourLineAchievements(cells, goal = FOUR_LINE_GOAL) {
  const cellsByUser = new Map();
  for (const cell of cells || []) {
    if (!cell?.uploaded_at) continue;
    if (!cellsByUser.has(cell.user_id)) cellsByUser.set(cell.user_id, []);
    cellsByUser.get(cell.user_id).push(cell);
  }

  const achievements = [];
  for (const [userId, userCells] of cellsByUser) {
    // 인증한 순서대로 한 칸씩 되짚어, 목표 줄 수를 처음 넘긴 칸의 시각을 달성 시각으로 본다.
    userCells.sort((a, b) => Date.parse(a.uploaded_at) - Date.parse(b.uploaded_at) || a.position - b.position);
    const filled = [];
    for (const cell of userCells) {
      filled.push(cell.position);
      if (countLines(filled) >= goal) {
        achievements.push({ userId, achievedAt: cell.uploaded_at });
        break;
      }
    }
  }

  return achievements
    .sort(
      (a, b) =>
        Date.parse(a.achievedAt) - Date.parse(b.achievedAt) ||
        String(a.userId).localeCompare(String(b.userId))
    )
    .map((achievement, index) => ({ ...achievement, rank: index + 1 }));
}

/**
 * 확정된 명단과 지금 계산한 명단을 합쳐 최종 순위를 만든다.
 *
 * 확정된 사람은 확정 당시의 달성 시각으로 고정되고, 그 뒤에 사진을 바꿔도 순위가 안 밀린다.
 * 아직 확정되지 않은 사람은 지금 계산한 시각 그대로 뒤에 붙는다.
 * 순위는 두 무리를 합쳐 달성 시각 순으로 다시 매기므로, 확정하는 순서와 무관하다.
 *
 * @param {Array<{userId:string, achievedAt:string}>} live 지금 계산한 4줄 달성자
 * @param {Array<{userId:string, achievedAt:string, confirmedAt:string}>} awards 확정된 기록
 */
export function mergeFourLineAwards(live, awards = []) {
  const liveBy = new Map((live || []).map((item) => [item.userId, item]));
  const confirmedIds = new Set((awards || []).map((award) => award.userId));

  const rows = [
    ...(awards || []).map((award) => ({
      userId: award.userId,
      achievedAt: award.achievedAt,
      confirmedAt: award.confirmedAt,
      confirmed: true,
      // 확정 뒤에 사진이 바뀌어 달성 시각이 달라졌으면 운영진이 알아야 한다.
      liveAchievedAt: liveBy.get(award.userId)?.achievedAt || null,
      stillQualifies: liveBy.has(award.userId),
    })),
    ...(live || [])
      .filter((item) => !confirmedIds.has(item.userId))
      .map((item) => ({
        userId: item.userId,
        achievedAt: item.achievedAt,
        confirmedAt: null,
        confirmed: false,
        liveAchievedAt: item.achievedAt,
        stillQualifies: true,
      })),
  ];

  return rows
    .sort(
      (a, b) =>
        Date.parse(a.achievedAt) - Date.parse(b.achievedAt) ||
        String(a.userId).localeCompare(String(b.userId))
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

/**
 * 빙고 명예의 전당: 한 줄이라도 완성한 사람만 줄 수 → 칸 수 → 닉네임 순으로 세운다.
 * @param {Array<{id?:string, nickname:string, filled:number, lines:number}>} progress
 * @param {Array<{userId:string, rank:number}>} fourLine 4줄 선착순 (순위 배지용)
 */
export function bingoHallOfFame(progress, fourLine = []) {
  const users = progress || [];
  const rankOf = new Map((fourLine || []).map((item) => [item.userId, item.rank]));
  const achievers = users
    .filter((user) => user.lines > 0)
    .map((user) => ({
      nickname: user.nickname,
      lines: user.lines,
      filled: user.filled,
      complete: user.filled >= BOARD_CELL_COUNT,
      fourLineRank: rankOf.get(user.id) ?? null,
    }))
    .sort((a, b) => b.lines - a.lines || b.filled - a.filled || a.nickname.localeCompare(b.nickname));

  return {
    achievers,
    // 한 칸이라도 인증한 사람 = 실제로 빙고에 참여한 사람
    participants: users.filter((user) => user.filled > 0).length,
    completed: achievers.filter((user) => user.complete).length,
    fourLineCount: achievers.filter((user) => user.lines >= FOUR_LINE_GOAL).length,
  };
}
