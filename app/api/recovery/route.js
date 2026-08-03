import crypto from "node:crypto";
import { sb, schedulePhotoCleanup, signedUrl, uploadPhoto } from "@/lib/db";
import {
  ApiError,
  readJson,
  readPhoto,
  requireUserInRecoveryPeriod,
  route,
  requireUser,
  requireDbSuccess,
} from "@/lib/api";
import { demoRecovery, demoRecoveryAdd, isDemoMode } from "@/lib/demo";
import { getSettings } from "@/lib/settings";
import {
  normalizeRecoveryEvent,
  recoveryState,
  recoveryTicketDigit,
  recoveryTicketLabel,
  RECOVERY_STATES,
} from "@/lib/recovery";
import { takeRateLimit } from "@/lib/rateLimit";

function entryView(row, photoUrl = null) {
  return {
    ticketNo: row.ticket_no,
    ticket: recoveryTicketLabel(row.ticket_no),
    digit: recoveryTicketDigit(row.ticket_no),
    note: row.note || "",
    createdAt: row.created_at,
    photoUrl,
    mine: true,
  };
}

function resultFor(entry, event, count, winners = []) {
  const winningDigit = event.winningDigit === "" ? null : Number(event.winningDigit);
  return {
    event,
    state: recoveryState(event),
    entry,
    count,
    winningDigit,
    winners,
    isWinner: Boolean(entry && winningDigit !== null && entry.digit === winningDigit),
  };
}

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const settings = await getSettings();
  const event = normalizeRecoveryEvent(settings.recovery_event);

  if (isDemoMode()) return demoRecovery(user.id);

  const [{ data: row, error: rowError }, { count, error: countError }] = await Promise.all([
    sb().from("recovery_entries")
      .select("ticket_no, note, photo_path, created_at")
      .eq("event_key", event.key)
      .eq("user_id", user.id)
      .maybeSingle(),
    sb().from("recovery_entries")
      .select("ticket_no", { count: "exact", head: true })
      .eq("event_key", event.key),
  ]);
  requireDbSuccess(rowError || countError, "복구 인증 현황을 불러오지 못했습니다");

  const photoUrl = row?.photo_path ? await signedUrl(row.photo_path) : null;
  const entry = row ? entryView(row, photoUrl) : null;
  const winningDigit = event.winningDigit === "" ? null : Number(event.winningDigit);
  let winners = [];
  if (winningDigit !== null) {
    const { data, error } = await sb()
      .from("recovery_entries")
      .select("ticket_no, users ( nickname )")
      .eq("event_key", event.key);
    requireDbSuccess(error, "복구 당첨자 명단을 불러오지 못했습니다");
    winners = (data || [])
      .filter((item) => recoveryTicketDigit(item.ticket_no) === winningDigit)
      .map((item) => ({ nickname: item.users?.nickname || "?", ticket: recoveryTicketLabel(item.ticket_no) }));
  }
  return resultFor(entry, event, count || 0, winners);
});

export const POST = route(async (req) => {
  const { user, event } = await requireUserInRecoveryPeriod(req);
  const allowed = await takeRateLimit(req, "recovery-upload", user.id, { limit: 5, windowSeconds: 10 * 60 });
  if (!allowed) throw new ApiError("복구 인증 요청이 너무 잦아요. 잠시 후 다시 시도해주세요.", 429);

  const form = await req.formData().catch(() => null);
  const note = String(form?.get("note") || "").trim().slice(0, 120);
  if (isDemoMode()) {
    if (!form?.get("file")) throw new ApiError("복구 인증 사진을 선택해주세요.");
    const result = demoRecoveryAdd(user.id, note);
    if (result.error) throw new ApiError(result.error, result.status);
    return { ...result, event };
  }

  const { data: existing, error: existingError } = await sb()
    .from("recovery_entries")
    .select("ticket_no")
    .eq("event_key", event.key)
    .eq("user_id", user.id)
    .maybeSingle();
  requireDbSuccess(existingError, "복구 인증 중복 여부를 확인하지 못했습니다");
  if (existing) throw new ApiError("이미 긴급 복구 인증을 제출했어요.", 409);

  const buffer = await readPhoto(form);
  const path = `recovery/${event.key}/${user.id}/${crypto.randomUUID()}.jpg`;
  await uploadPhoto(path, buffer);

  const { data: row, error } = await sb()
    .from("recovery_entries")
    .insert({ event_key: event.key, user_id: user.id, photo_path: path, note })
    .select("ticket_no, note, photo_path, created_at")
    .single();
  if (error) {
    await schedulePhotoCleanup([path]);
    if (error.code === "23505") throw new ApiError("이미 긴급 복구 인증을 제출했어요.", 409);
    throw new ApiError("복구 인증을 저장하지 못했습니다.", 500);
  }

  return { ok: true, event, entry: entryView(row, await signedUrl(path)) };
});

