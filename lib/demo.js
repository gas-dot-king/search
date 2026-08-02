import { DEFAULT_EVENT_GUIDE, parseEventGuide } from "./event";
import { parseNotices } from "./notices";
import { drawBoard, countLines, dailyLimitMessage, DAILY_CELL_LIMIT } from "./bingo";
import { bingoHallOfFame, fourLineAchievements, mergeFourLineAwards } from "./hall";
import {
  computeWinners,
  currentLottoRound,
  matchCount,
  parseLottoRounds,
  serializeLottoRounds,
  LOTTO_DRAW_DIGITS,
  LOTTO_ENTRY_LIMIT,
} from "./lotto";

// DEMO_MODE에서는 Supabase 대신 이 메모리 상태를 사용합니다.
// 서버를 재시작하면 초기화되므로 테스트 데이터가 실제 운영 데이터에 영향을 주지 않습니다.
export const isDemoMode = () => process.env.DEMO_MODE === "true";

const DEMO_ITEMS = [
  [1, "2km 이상 달리기"], [1, "3km 이상 달리기"], [1, "5km 이상 달리기"], [1, "10km 이상 달리기"],
  [1, "30분 이상 달리기"], [1, "30분 이상 걷기"], [1, "60분 이상 걷기"],
  [2, "새벽 러닝 인증하기 (오전 6시 이전)"], [2, "아침 러닝 인증하기 (오전 6시~9시)"],
  [2, "저녁 러닝 인증하기 (오후 6시~9시)"], [2, "주말에 한 번 달리기"], [2, "양산이 아닌 곳에서 러닝"],
  [2, "양산 랜드마크와 인증사진 남기기"], [2, "달리면서 발견한 예쁜 풍경 찍기"],
  [2, "러닝 중 만난 강아지·고양이 인증하기"],
  [3, "일정 또는 정기런 참석하기"], [3, "크루원 한 명 이상과 함께 인증사진 찍기"],
  [3, "크루원 러닝 인증글에 댓글 달기"], [3, "러닝 플레이리스트 한 곡 추천하기"],
  [3, "러닝화 사진 인증하기"], [3, "러닝 후 물 마시는 사진 인증하기"],
  [3, "러닝 후 먹은 음식 인증하기"], [3, "빨간색 물건과 인증사진 찍기"],
  [3, "Y·S·R·C 중 한 글자가 보이게 인증사진 찍기"],
].map(([category, content], index) => ({ id: index + 1, category, content }));

const DEMO_SETTINGS = {
  upload_start: "2026-08-01T06:00:00+09:00",
  upload_end: "2026-08-14T18:00:00+09:00",
  draw_date: "2026-08-15",
  winning_numbers: "",
  lotto_rounds: "[]",
  notice: JSON.stringify(["현재 데모 모드로 실행 중입니다. 입력한 데이터는 서버 재시작 시 초기화됩니다."]),
  event_guide: JSON.stringify(DEFAULT_EVENT_GUIDE),
};

function createState() {
  return {
    users: [], cells: [], lotto: [], guestbook: [], fourLineAwards: [],
    settings: { ...DEMO_SETTINGS }, redraw: new Set(),
  };
}

const state = globalThis.__runningCrewDemoState || createState();
// 개발 중 핫 리로드로 살아남은 예전 상태에는 새로 추가한 칸이 없다.
if (!state.guestbook) state.guestbook = [];
if (!state.fourLineAwards) state.fourLineAwards = [];
globalThis.__runningCrewDemoState = state;

const now = () => new Date().toISOString();
const id = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function photoUrl(label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="100%" height="100%" fill="#ffe4e6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="18" fill="#be123c">${label}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function demoSettings() {
  return { ...state.settings };
}

export function demoPublicConfig() {
  return {
    uploadStart: state.settings.upload_start,
    uploadEnd: state.settings.upload_end,
    drawDate: state.settings.draw_date,
    maxLottoEntries: LOTTO_ENTRY_LIMIT,
    winningNumbers: state.settings.winning_numbers,
    lottoRound: currentLottoRound(state.settings.lotto_rounds),
    pastLottoRounds: parseLottoRounds(state.settings.lotto_rounds),
    // 관리자가 형식이 어긋난 값을 저장해도 /api/config가 500으로 죽지 않게 안전 파서를 쓴다.
    notices: parseNotices(state.settings.notice),
    eventGuide: parseEventGuide(state.settings.event_guide),
  };
}

export function demoItems() {
  return DEMO_ITEMS.map((item) => ({ ...item }));
}

export function demoGetUser(token) {
  return state.users.find((user) => user.token === token) || null;
}

export function demoAuth(nickname, pin) {
  let user = state.users.find((item) => item.nickname === nickname);
  let isNew = false;
  if (user) {
    if ((user.failed_pin_attempts || 0) >= 10 || user.pin_locked_at) {
      return { error: "PIN을 10회 잘못 입력해 잠겼습니다. 관리자에게 PIN 초기화를 문의해주세요.", status: 423 };
    }
    if (user.pin !== pin) {
      user.failed_pin_attempts = Math.min((user.failed_pin_attempts || 0) + 1, 10);
      if (user.failed_pin_attempts >= 10) user.pin_locked_at = now();
      return {
        error: user.failed_pin_attempts >= 10
          ? "PIN을 10회 잘못 입력해 잠겼습니다. 관리자에게 PIN 초기화를 문의해주세요."
          : "PIN이 맞지 않습니다.",
        status: user.failed_pin_attempts >= 10 ? 423 : 401,
      };
    }
    user.failed_pin_attempts = 0;
    user.pin_locked_at = null;
    user.token = id("demo-token");
  } else {
    isNew = true;
    user = {
      id: id("demo-user"), nickname, pin, token: id("demo-token"), created_at: now(),
      failed_pin_attempts: 0, pin_locked_at: null,
    };
    state.users.push(user);
  }
  return { user, isNew };
}

export function demoChangePin(userId, currentPin, newPin) {
  const user = state.users.find((item) => item.id === userId);
  if (!user || (user.failed_pin_attempts || 0) >= 10 || user.pin_locked_at) {
    return { error: "PIN을 10회 잘못 입력해 잠겼습니다. 관리자에게 PIN 초기화를 문의해주세요.", status: 423 };
  }
  if (user.pin !== currentPin) {
    user.failed_pin_attempts = Math.min((user.failed_pin_attempts || 0) + 1, 10);
    if (user.failed_pin_attempts >= 10) user.pin_locked_at = now();
    return { error: "현재 PIN이 맞지 않습니다.", status: 401 };
  }
  user.pin = newPin;
  user.token = id("demo-token");
  user.failed_pin_attempts = 0;
  user.pin_locked_at = null;
  return { token: user.token };
}

export function demoHasBoard(userId) {
  return state.cells.some((cell) => cell.user_id === userId);
}

function userCells(userId) {
  return state.cells.filter((cell) => cell.user_id === userId).sort((a, b) => a.position - b.position);
}

export function demoDraw(userId, redraw = false) {
  const existing = userCells(userId);
  if (existing.length && !redraw) return { error: "이미 빙고판이 확정되었습니다." };
  if (existing.length && redraw && state.redraw.has(userId)) return { error: "다시 뽑기 기회를 이미 사용했습니다." };
  if (existing.length && redraw && existing.some((cell) => cell.photo_path)) {
    return { error: "이미 인증을 시작해서 다시 뽑을 수 없습니다." };
  }
  if (existing.length && redraw) {
    state.cells = state.cells.filter((cell) => cell.user_id !== userId);
    state.redraw.add(userId);
  }
  const order = drawBoard(DEMO_ITEMS);
  state.cells.push(...order.map((itemId, position) => ({
    id: id("demo-cell"), user_id: userId, position, item_id: itemId, photo_path: null, uploaded_at: null, uploaded_date: null,
  })));
  return { board: demoBoard(userId) };
}

export function demoBoard(userId) {
  const cells = userCells(userId);
  const filled = cells.filter((cell) => cell.photo_path).map((cell) => cell.position);
  return {
    nickname: state.users.find((user) => user.id === userId)?.nickname || "데모 사용자",
    cells: cells.map((cell) => {
      const item = DEMO_ITEMS.find((entry) => entry.id === cell.item_id);
      return {
        position: cell.position, content: item?.content || "", category: item?.category || 0,
        hasPhoto: Boolean(cell.photo_path), photoUrl: cell.photo_path ? photoUrl("DEMO") : null,
      };
    }),
    filled: filled.length,
    lines: countLines(filled),
    photosLoaded: true,
  };
}

export function demoUpload(userId, position, photoMeta = null) {
  const cell = userCells(userId).find((entry) => entry.position === position);
  if (!cell) return { error: "빙고판이 없습니다. 먼저 빙고를 뽑아주세요." };
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  const isNewToday = !cell.photo_path || cell.uploaded_date !== today;
  if (isNewToday) {
    const submittedToday = userCells(userId).filter((entry) =>
      entry.id !== cell.id && entry.photo_path && entry.uploaded_date === today
    );
    const item = DEMO_ITEMS.find((entry) => entry.id === cell.item_id);
    const todayList = submittedToday.map((entry) => {
      const itemEntry = DEMO_ITEMS.find((i) => i.id === entry.item_id);
      return { content: itemEntry?.content || "", category: itemEntry?.category || 0 };
    });
    const sameCategory = todayList.some((entry) => entry.category === item?.category);
    if (sameCategory) return { error: dailyLimitMessage(todayList, item?.category || 0) };
    if (submittedToday.length >= DAILY_CELL_LIMIT) return { error: dailyLimitMessage(todayList, 0) };
  }
  cell.photo_path = `demo-bingo-${userId}-${position}`;
  cell.uploaded_at = now();
  cell.uploaded_date = today;
  cell.photo_meta = photoMeta;
  // 운영과 같은 모양으로 돌려줘야 화면이 빙고판 전체를 다시 부르지 않는 경로를 탄다.
  return { ok: true, photoUrl: photoUrl("인증"), thumbUrl: photoUrl("인증") };
}

export function demoRemoveUpload(userId, position) {
  const cell = userCells(userId).find((entry) => entry.position === position);
  if (!cell?.photo_path) return { error: "삭제할 사진이 없습니다." };
  cell.photo_path = null;
  cell.uploaded_at = null;
  cell.uploaded_date = null;
  cell.photo_meta = null;
  return { ok: true };
}

function lottoEntryView(entry) {
  const winning = state.settings.winning_numbers;
  const complete = winning.length === LOTTO_DRAW_DIGITS;
  return {
    id: entry.id, slot: entry.slot, digits: entry.digits, hasPhoto: true,
    photoUrl: photoUrl("LOTTO"), thumbUrl: photoUrl("LOTTO"), createdAt: entry.created_at,
    photoMeta: entry.photo_meta || null,
    matches: complete ? matchCount(entry.digits, winning) : null,
  };
}

export function demoLotto(userId) {
  const mine = state.lotto
    .filter((entry) => entry.user_id === userId)
    .sort((a, b) => a.slot - b.slot || a.created_at.localeCompare(b.created_at));
  const winning = state.settings.winning_numbers;
  const complete = winning.length === LOTTO_DRAW_DIGITS;
  const all = state.lotto.map((entry) => ({ digits: entry.digits, users: { nickname: state.users.find((user) => user.id === entry.user_id)?.nickname } }));
  return {
    entries: mine.map(lottoEntryView), maxEntries: LOTTO_ENTRY_LIMIT, uploadStart: state.settings.upload_start, uploadEnd: state.settings.upload_end, drawDate: state.settings.draw_date,
    winningNumbers: winning,
    lottoRound: currentLottoRound(state.settings.lotto_rounds),
    pastLottoRounds: parseLottoRounds(state.settings.lotto_rounds),
    winners: complete ? computeWinners(all, winning) : null, photosLoaded: true,
  };
}

export function demoLottoSummary(userId) {
  return {
    entryCount: state.lotto.filter((entry) => entry.user_id === userId).length,
    maxEntries: LOTTO_ENTRY_LIMIT, uploadStart: state.settings.upload_start, uploadEnd: state.settings.upload_end, drawDate: state.settings.draw_date, winningNumbers: state.settings.winning_numbers,
  };
}

export function demoLottoAdd(userId, digits, slot, photoMeta = null) {
  const count = state.lotto.filter((entry) => entry.user_id === userId).length;
  if (count >= LOTTO_ENTRY_LIMIT) return { error: `응모는 최대 ${LOTTO_ENTRY_LIMIT}장까지 가능합니다.` };
  if (state.lotto.some((entry) => entry.user_id === userId && entry.slot === slot)) {
    return { error: `응모권 ${slot}은 이미 사용했습니다.` };
  }
  const entry = {
    id: id("demo-lotto"),
    user_id: userId,
    slot,
    digits,
    photo_path: `demo-lotto-${userId}-${slot}`,
    photo_meta: photoMeta,
    created_at: now(),
  };
  state.lotto.push(entry);
  return { ok: true, entry: lottoEntryView(entry) };
}

export function demoLottoRemove(userId, entryId) {
  const exists = state.lotto.some((entry) => entry.id === entryId && entry.user_id === userId);
  if (!exists) return { error: "응모를 찾을 수 없습니다.", status: 404 };
  state.lotto = state.lotto.filter((entry) => entry.id !== entryId);
  return { ok: true };
}

export function demoProgress() {
  const users = state.users.map((user) => {
    const cells = userCells(user.id);
    const done = cells.filter((cell) => cell.photo_path);
    const filled = done.map((cell) => cell.position);
    const uploadTimes = done.map((cell) => cell.uploaded_at).filter(Boolean).sort();
    return {
      id: user.id, nickname: user.nickname, createdAt: user.created_at, filled: filled.length,
      lines: countLines(filled), lottoEntries: state.lotto.filter((entry) => entry.user_id === user.id).length,
      lastUploadAt: uploadTimes[uploadTimes.length - 1] || null,
    };
  });
  const nickOf = new Map(state.users.map((user) => [user.id, user.nickname]));
  const activity = [
    ...state.cells.filter((cell) => cell.uploaded_at).map((cell) => ({ nickname: nickOf.get(cell.user_id), type: "bingo", at: cell.uploaded_at })),
    ...state.lotto.map((entry) => ({ nickname: nickOf.get(entry.user_id), type: "lotto", at: entry.created_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);
  return { progress: users, users: state.users.map(({ id, nickname, created_at }) => ({ id, nickname, created_at })), cells: state.cells, lotto: state.lotto, activity };
}

export function demoHall() {
  const { progress, users, cells } = demoProgress();
  const nicknameOf = new Map(users.map((user) => [user.id, user.nickname]));
  const fourLine = mergeFourLineAwards(fourLineAchievements(cells), state.fourLineAwards);
  const winningNumbers = state.settings.winning_numbers;
  const all = state.lotto.map((entry) => ({
    digits: entry.digits,
    users: { nickname: state.users.find((user) => user.id === entry.user_id)?.nickname },
  }));
  return {
    lotto: {
      winningNumbers,
      drawDate: state.settings.draw_date,
      round: currentLottoRound(state.settings.lotto_rounds),
      pastRounds: parseLottoRounds(state.settings.lotto_rounds),
      winners: winningNumbers.length === LOTTO_DRAW_DIGITS ? computeWinners(all, winningNumbers) : null,
    },
    // 데모에는 보호할 DB가 없고 입력한 데이터가 바로 보여야 하므로 시간당 집계를 걸지 않는다.
    bingo: {
      ...bingoHallOfFame(progress, fourLine),
      fourLine: fourLine.map(({ rank, userId, achievedAt }) => ({
        rank,
        nickname: nicknameOf.get(userId) || "?",
        achievedAt,
      })),
      updatedAt: new Date().toISOString(),
    },
  };
}

/** 관리자 검수용 4줄 선착순 (확정 명단 반영, 회원 id 포함) */
export function demoFourLineRanking() {
  const { users, cells } = demoProgress();
  const userOf = new Map(users.map((user) => [user.id, user]));
  return mergeFourLineAwards(fourLineAchievements(cells), state.fourLineAwards).map((row) => ({
    ...row,
    id: row.userId,
    nickname: userOf.get(row.userId)?.nickname || "?",
  }));
}

export function demoConfirmFourLine(userId) {
  const { cells } = demoProgress();
  const achievement = fourLineAchievements(cells).find((item) => item.userId === userId);
  if (!achievement) return { error: "아직 4줄을 완성하지 않은 회원입니다.", status: 400 };
  state.fourLineAwards = [
    ...state.fourLineAwards.filter((award) => award.userId !== userId),
    { userId, achievedAt: achievement.achievedAt, confirmedAt: now() },
  ];
  return { ok: true, achievedAt: achievement.achievedAt };
}

export function demoUnconfirmFourLine(userId) {
  state.fourLineAwards = state.fourLineAwards.filter((award) => award.userId !== userId);
  return { ok: true };
}

export function demoSetSetting(key, value) {
  state.settings[key] = String(value ?? "");
  return { ok: true };
}

/** 현재 차수 상태 (3자리가 다 나왔으면 1등까지 계산) */
export function demoLottoRound() {
  const digits = state.settings.winning_numbers;
  const pastRounds = parseLottoRounds(state.settings.lotto_rounds);
  const complete = digits.length === LOTTO_DRAW_DIGITS;
  const all = state.lotto.map((entry) => ({
    digits: entry.digits,
    users: { nickname: state.users.find((user) => user.id === entry.user_id)?.nickname },
  }));
  return {
    digits,
    round: currentLottoRound(pastRounds),
    pastRounds,
    complete,
    entryCount: state.lotto.length,
    winners: complete ? computeWinners(all, digits) : null,
  };
}

export function demoDrawNumbers() {
  const current = state.settings.winning_numbers;
  if (current.length >= LOTTO_DRAW_DIGITS) return { error: "이미 3자리 모두 추첨되었습니다." };
  const digits = current + Math.floor(Math.random() * 10);
  state.settings.winning_numbers = digits;
  if (digits.length !== LOTTO_DRAW_DIGITS) return { ok: true, digits, complete: false };
  return { ok: true, ...demoLottoRound() };
}

export function demoNextLottoRound() {
  const state1 = demoLottoRound();
  if (!state1.complete) return { error: "3자리를 모두 뽑은 뒤에 다음 차수로 넘어갈 수 있습니다." };
  if (state1.winners.length > 0) return { error: "1등이 나온 차수입니다. 다음 차수로 넘어갈 수 없어요." };

  const pastRounds = [...state1.pastRounds, state1.digits];
  state.settings.lotto_rounds = serializeLottoRounds(pastRounds);
  state.settings.winning_numbers = "";
  return { ok: true, digits: "", round: currentLottoRound(pastRounds), pastRounds, complete: false, winners: null };
}

export function demoResetDraw() {
  state.settings.lotto_rounds = "[]";
  state.settings.winning_numbers = "";
  return { ok: true, digits: "", round: 1, pastRounds: [], complete: false, winners: null };
}

/** 최근 인증 검토 큐 (운영과 같은 모양: 최신순 + 커서 페이지) */
export function demoRecentUploads(before, pageSize) {
  const nickOf = new Map(state.users.map((user) => [user.id, user.nickname]));
  const rows = state.cells
    .filter((cell) => cell.photo_path && cell.uploaded_at)
    .filter((cell) => !before || cell.uploaded_at < before)
    .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));

  const page = rows.slice(0, pageSize);
  return {
    uploads: page.map((cell) => {
      const item = DEMO_ITEMS.find((entry) => entry.id === cell.item_id);
      return {
        id: cell.id,
        userId: cell.user_id,
        nickname: nickOf.get(cell.user_id) || "?",
        position: cell.position,
        content: item?.content || "",
        category: item?.category || 0,
        uploadedAt: cell.uploaded_at,
        photoMeta: cell.photo_meta || null,
        photoUrl: photoUrl("인증"),
        thumbUrl: photoUrl("인증"),
      };
    }),
    nextCursor: rows.length > pageSize ? page[page.length - 1].uploaded_at : null,
  };
}

/** 관리자 회원 상세 — 검토에 필요한 칸 id·촬영 정보까지 운영과 같은 모양으로 준다 */
export function demoAdminUser(userId) {
  return {
    cells: userCells(userId).map((cell) => {
      const item = DEMO_ITEMS.find((entry) => entry.id === cell.item_id);
      return {
        id: cell.id,
        position: cell.position,
        content: item?.content || "",
        category: item?.category || 0,
        uploadedAt: cell.uploaded_at,
        photoMeta: cell.photo_meta || null,
        photoUrl: cell.photo_path ? photoUrl("DEMO") : null,
        thumbUrl: cell.photo_path ? photoUrl("DEMO") : null,
      };
    }),
    lotto: state.lotto.filter((entry) => entry.user_id === userId).map(lottoEntryView),
  };
}

export function demoDeleteUser(userId) {
  state.users = state.users.filter((user) => user.id !== userId);
  state.cells = state.cells.filter((cell) => cell.user_id !== userId);
  state.lotto = state.lotto.filter((entry) => entry.user_id !== userId);
  // 실제 스키마의 on delete cascade와 같은 결과를 만든다.
  state.guestbook = state.guestbook.filter((entry) => entry.user_id !== userId);
  state.fourLineAwards = state.fourLineAwards.filter((award) => award.userId !== userId);
  return { ok: true };
}

export function demoResetBoard(userId) {
  state.cells = state.cells.filter((cell) => cell.user_id !== userId);
  state.redraw.delete(userId);
  return { ok: true };
}

/** 운영진이 회원 칸에 사진을 직접 넣는다 (하루 제한 없음) */
export function demoAdminPutCellPhoto(userId, position) {
  const cell = userCells(userId).find((entry) => entry.position === position);
  if (!cell) return { error: "이 회원에게는 아직 빙고판이 없습니다.", status: 404 };
  const replaced = Boolean(cell.photo_path);
  cell.photo_path = `demo-bingo-${userId}-${position}`;
  cell.uploaded_at = now();
  cell.uploaded_date = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
  return { ok: true, photoUrl: photoUrl("운영진 등록"), replaced };
}

export function demoDeleteCellPhoto(cellId) {
  const cell = state.cells.find((entry) => entry.id === cellId);
  if (!cell?.photo_path) return { error: "사진이 없습니다." };
  cell.photo_path = null;
  cell.uploaded_at = null;
  cell.uploaded_date = null;
  cell.photo_meta = null;
  return { ok: true };
}

export function demoResetUserPin(userId) {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) return { error: "회원을 찾을 수 없습니다.", status: 404 };
  user.pin = "0000";
  user.token = id("demo-token");
  user.failed_pin_attempts = 0;
  user.pin_locked_at = null;
  return { ok: true };
}

export function demoRenameUser(userId, nickname) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return { error: "사용자를 찾을 수 없습니다.", status: 404 };
  if (state.users.some((item) => item.id !== userId && item.nickname === nickname)) {
    return { error: "이미 사용 중인 닉네임입니다.", status: 409 };
  }
  user.nickname = nickname;
  return { ok: true, nickname };
}

function guestbookView(entry) {
  const user = state.users.find((item) => item.id === entry.user_id);
  return {
    id: entry.id,
    userId: entry.user_id,
    nickname: user?.nickname || "탈퇴한 회원",
    message: entry.message,
    createdAt: entry.created_at,
    updatedAt: entry.updated_at,
  };
}

export function demoGuestbook() {
  return state.guestbook.map(guestbookView);
}

export function demoGuestbookCount(userId) {
  return state.guestbook.filter((item) => item.user_id === userId).length;
}

export function demoGuestbookAdd(userId, message) {
  const entry = { id: id("demo-guestbook"), user_id: userId, message, created_at: now(), updated_at: now() };
  state.guestbook.push(entry);
  return { ok: true, entry: guestbookView(entry) };
}

export function demoGuestbookEdit(userId, entryId, message) {
  const entry = state.guestbook.find((item) => item.id === entryId);
  if (!entry) return { error: "방명록을 찾을 수 없습니다.", status: 404 };
  if (entry.user_id !== userId) return { error: "내가 쓴 방명록만 수정할 수 있어요.", status: 403 };
  entry.message = message;
  entry.updated_at = now();
  return { ok: true, entry: guestbookView(entry) };
}

export function demoGuestbookRemove(entryId, { userId = null } = {}) {
  const entry = state.guestbook.find((item) => item.id === entryId);
  if (!entry) return { error: "방명록을 찾을 수 없습니다.", status: 404 };
  // userId가 없으면 관리자 삭제라 주인 확인을 건너뛴다.
  if (userId && entry.user_id !== userId) {
    return { error: "내가 쓴 방명록만 삭제할 수 있어요.", status: 403 };
  }
  state.guestbook = state.guestbook.filter((item) => item.id !== entryId);
  return { ok: true };
}

export function demoDeleteLottoEntry(entryId) {
  const exists = state.lotto.some((entry) => entry.id === entryId);
  if (!exists) return { error: "응모를 찾을 수 없습니다.", status: 404 };
  state.lotto = state.lotto.filter((entry) => entry.id !== entryId);
  return { ok: true };
}
