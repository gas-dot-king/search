import { DEFAULT_EVENT_GUIDE, parseEventGuide } from "./event";
import { parseNotices } from "./notices";
import { drawBoard, countLines } from "./bingo";
import { computeWinners, matchCount, LOTTO_DRAW_DIGITS, LOTTO_ENTRY_LIMIT } from "./lotto";

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
  max_lotto_entries: String(LOTTO_ENTRY_LIMIT),
  winning_numbers: "",
  notice: JSON.stringify(["현재 데모 모드로 실행 중입니다. 입력한 데이터는 서버 재시작 시 초기화됩니다."]),
  event_guide: JSON.stringify(DEFAULT_EVENT_GUIDE),
};

function createState() {
  return { users: [], cells: [], lotto: [], settings: { ...DEMO_SETTINGS }, redraw: new Set() };
}

const state = globalThis.__runningCrewDemoState || createState();
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
    if (user.pin !== pin) return { error: "비밀번호가 틀렸습니다.", status: 401 };
  } else {
    isNew = true;
    user = { id: id("demo-user"), nickname, pin, token: id("demo-token"), created_at: now() };
    state.users.push(user);
  }
  return { user, isNew };
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
    id: id("demo-cell"), user_id: userId, position, item_id: itemId, photo_path: null, uploaded_at: null,
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

export function demoUpload(userId, position) {
  const cell = userCells(userId).find((entry) => entry.position === position);
  if (!cell) return { error: "빙고판이 없습니다. 먼저 빙고를 뽑아주세요." };
  cell.photo_path = `demo-bingo-${userId}-${position}`;
  cell.uploaded_at = now();
  return { ok: true };
}

export function demoRemoveUpload(userId, position) {
  const cell = userCells(userId).find((entry) => entry.position === position);
  if (!cell?.photo_path) return { error: "삭제할 사진이 없습니다." };
  cell.photo_path = null;
  cell.uploaded_at = null;
  return { ok: true };
}

function lottoEntryView(entry) {
  const winning = state.settings.winning_numbers;
  const complete = winning.length === LOTTO_DRAW_DIGITS;
  return {
    id: entry.id, slot: entry.slot, digits: entry.digits, hasPhoto: true,
    photoUrl: photoUrl("LOTTO"), createdAt: entry.created_at,
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
    entries: mine.map(lottoEntryView), maxEntries: LOTTO_ENTRY_LIMIT, uploadEnd: state.settings.upload_end,
    winningNumbers: winning, winners: complete ? computeWinners(all, winning) : null, photosLoaded: true,
  };
}

export function demoLottoSummary(userId) {
  return {
    entryCount: state.lotto.filter((entry) => entry.user_id === userId).length,
    maxEntries: LOTTO_ENTRY_LIMIT, uploadEnd: state.settings.upload_end, winningNumbers: state.settings.winning_numbers,
  };
}

export function demoLottoAdd(userId, digits, slot) {
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
    const filled = cells.filter((cell) => cell.photo_path).map((cell) => cell.position);
    return {
      id: user.id, nickname: user.nickname, createdAt: user.created_at, filled: filled.length,
      lines: countLines(filled), lottoEntries: state.lotto.filter((entry) => entry.user_id === user.id).length,
    };
  });
  const nickOf = new Map(state.users.map((user) => [user.id, user.nickname]));
  const activity = [
    ...state.cells.filter((cell) => cell.uploaded_at).map((cell) => ({ nickname: nickOf.get(cell.user_id), type: "bingo", at: cell.uploaded_at })),
    ...state.lotto.map((entry) => ({ nickname: nickOf.get(entry.user_id), type: "lotto", at: entry.created_at })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 30);
  return { progress: users, users: state.users.map(({ id, nickname, created_at }) => ({ id, nickname, created_at })), cells: state.cells, lotto: state.lotto, activity };
}

export function demoSetSetting(key, value) {
  state.settings[key] = String(value ?? "");
  return { ok: true };
}

export function demoDrawNumbers() {
  const current = state.settings.winning_numbers;
  if (current.length >= LOTTO_DRAW_DIGITS) return { error: "이미 3자리 모두 추첨되었습니다." };
  const digits = current + Math.floor(Math.random() * 10);
  state.settings.winning_numbers = digits;
  return { ok: true, digits };
}

export function demoAdminUser(userId) {
  return { cells: demoBoard(userId).cells, lotto: state.lotto.filter((entry) => entry.user_id === userId).map(lottoEntryView) };
}

export function demoDeleteUser(userId) {
  state.users = state.users.filter((user) => user.id !== userId);
  state.cells = state.cells.filter((cell) => cell.user_id !== userId);
  state.lotto = state.lotto.filter((entry) => entry.user_id !== userId);
  return { ok: true };
}

export function demoResetBoard(userId) {
  state.cells = state.cells.filter((cell) => cell.user_id !== userId);
  state.redraw.delete(userId);
  return { ok: true };
}

export function demoDeleteCellPhoto(cellId) {
  const cell = state.cells.find((entry) => entry.id === cellId);
  if (!cell?.photo_path) return { error: "사진이 없습니다." };
  cell.photo_path = null;
  cell.uploaded_at = null;
  return { ok: true };
}

export function demoDeleteLottoEntry(entryId) {
  const exists = state.lotto.some((entry) => entry.id === entryId);
  if (!exists) return { error: "응모를 찾을 수 없습니다.", status: 404 };
  state.lotto = state.lotto.filter((entry) => entry.id !== entryId);
  return { ok: true };
}
