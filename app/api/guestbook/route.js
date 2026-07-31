import { sb } from "@/lib/db";
import { getUser, isAdmin } from "@/lib/auth";
import { route, requireUser, readJson, ApiError, requireDbSuccess } from "@/lib/api";
import { takeRateLimit } from "@/lib/rateLimit";
import {
  GUESTBOOK_LIMIT,
  GUESTBOOK_MAX_PER_USER,
  guestbookCountError,
  readGuestbookMessage,
  sortGuestbookEntries,
} from "@/lib/guestbook";
import {
  demoGuestbook,
  demoGuestbookAdd,
  demoGuestbookCount,
  demoGuestbookEdit,
  demoGuestbookRemove,
  isDemoMode,
} from "@/lib/demo";

/** 짧은 시간에 반복 저장하는 것을 막는다. 총량은 GUESTBOOK_MAX_PER_USER가 따로 잡는다. */
async function limitWrites(req, userId) {
  const allowed = await takeRateLimit(req, "guestbook", userId, { limit: 20, windowSeconds: 10 * 60 });
  if (!allowed) throw new ApiError("방명록 저장이 너무 잦아요. 잠시 뒤 다시 시도해주세요.", 429);
}

/** 저장 직전에 내가 이미 쓴 개수를 세어 상한을 넘지 않게 한다. */
async function assertUnderLimit(userId) {
  if (isDemoMode()) {
    const full = guestbookCountError(demoGuestbookCount(userId));
    if (full) throw new ApiError(full, 409);
    return;
  }
  const { count, error } = await sb()
    .from("guestbook_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  requireDbSuccess(error, "방명록 개수를 확인하지 못했습니다");
  const full = guestbookCountError(count || 0);
  if (full) throw new ApiError(full, 409);
}

function entryView(row, viewerId) {
  const ownerId = row.user_id ?? row.userId ?? null;
  return {
    id: row.id,
    nickname: row.users?.nickname || row.nickname || "탈퇴한 회원",
    message: row.message,
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt,
    mine: Boolean(viewerId) && ownerId === viewerId,
  };
}

/**
 * 방명록 목록. 행사 안내 페이지가 로그인 없이 열리므로 읽기도 공개다.
 * 토큰이 있으면 각 글에 내 것인지 표시해 화면이 바로 수정 버튼을 띄운다.
 */
export const GET = route(async (req) => {
  // 비로그인 방문자도 목록은 봐야 하므로 requireUser 대신 조용히 조회한다.
  const user = await getUser(req);
  const viewerId = user?.id || null;

  const entries = isDemoMode()
    ? sortGuestbookEntries(demoGuestbook().map((entry) => entryView(entry, viewerId))).slice(0, GUESTBOOK_LIMIT)
    : await (async () => {
        const { data, error } = await sb()
          .from("guestbook_entries")
          .select("id, user_id, message, created_at, updated_at, users ( nickname )")
          .order("created_at", { ascending: false })
          .limit(GUESTBOOK_LIMIT);
        requireDbSuccess(error, "방명록을 불러오지 못했습니다");
        return (data || []).map((row) => entryView(row, viewerId));
      })();

  return {
    entries,
    signedIn: Boolean(user),
    myCount: entries.filter((entry) => entry.mine).length,
    maxPerUser: GUESTBOOK_MAX_PER_USER,
  };
});

/** 방명록 등록 */
export const POST = route(async (req) => {
  const user = await requireUser(req);
  await limitWrites(req, user.id);

  const { message, error: invalid } = readGuestbookMessage((await readJson(req)).message);
  if (invalid) throw new ApiError(invalid);
  await assertUnderLimit(user.id);

  if (isDemoMode()) {
    const result = demoGuestbookAdd(user.id, message);
    if (result.error) throw new ApiError(result.error, result.status);
    return { ok: true, entry: entryView(result.entry, user.id) };
  }

  const { data, error } = await sb()
    .from("guestbook_entries")
    .insert({ user_id: user.id, message })
    .select("id, user_id, message, created_at, updated_at, users ( nickname )")
    .single();
  requireDbSuccess(error, "방명록을 저장하지 못했습니다");
  return { ok: true, entry: entryView(data, user.id) };
});

/** 내 방명록 수정 */
export const PATCH = route(async (req) => {
  const user = await requireUser(req);
  await limitWrites(req, user.id);

  const body = await readJson(req);
  const id = String(body.id || "");
  const { message, error: invalid } = readGuestbookMessage(body.message);
  if (invalid) throw new ApiError(invalid);

  if (isDemoMode()) {
    const result = demoGuestbookEdit(user.id, id, message);
    if (result.error) throw new ApiError(result.error, result.status);
    return { ok: true, entry: entryView(result.entry, user.id) };
  }

  // user_id 조건을 쿼리에 함께 걸어, 남의 글 id를 보내도 아무것도 고쳐지지 않게 한다.
  const { data, error } = await sb()
    .from("guestbook_entries")
    .update({ message, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, user_id, message, created_at, updated_at, users ( nickname )")
    .maybeSingle();
  requireDbSuccess(error, "방명록을 수정하지 못했습니다");
  if (!data) throw new ApiError("내가 쓴 방명록만 수정할 수 있어요.", 403);
  return { ok: true, entry: entryView(data, user.id) };
});

/** 방명록 삭제. 본인 글이거나, 관리자 비밀번호가 함께 오면 신고 대응으로 지운다. */
export const DELETE = route(async (req) => {
  const admin = isAdmin(req);
  const user = admin ? null : await requireUser(req);
  if (user) await limitWrites(req, user.id);

  const id = String((await readJson(req)).id || "");

  if (isDemoMode()) {
    const result = demoGuestbookRemove(id, { userId: user?.id || null });
    if (result.error) throw new ApiError(result.error, result.status);
    return result;
  }

  let query = sb().from("guestbook_entries").delete().eq("id", id);
  if (user) query = query.eq("user_id", user.id);
  const { data, error } = await query.select("id").maybeSingle();
  requireDbSuccess(error, "방명록을 삭제하지 못했습니다");
  if (!data) {
    throw admin
      ? new ApiError("방명록을 찾을 수 없습니다.", 404)
      : new ApiError("내가 쓴 방명록만 삭제할 수 있어요.", 403);
  }
  return { ok: true };
});
