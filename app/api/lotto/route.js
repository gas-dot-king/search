import { sb, uploadPhoto, removePhoto, signedUrls } from "@/lib/db";
import { getUser, json, err } from "@/lib/auth";
import { getSettings, inUploadPeriod } from "@/lib/settings";

const MAX_BYTES = 5 * 1024 * 1024;

function matchCount(digits, winning) {
  let n = 0;
  for (let i = 0; i < 4; i++) if (digits[i] === winning[i]) n++;
  return n;
}

/** 내 응모 목록 + (추첨 후) 전체 결과 */
export async function GET(req) {
  const user = await getUser(req);
  if (!user) return err("로그인이 필요합니다.", 401);

  const settings = await getSettings();
  const winning = settings.winning_numbers || "";

  const { data: mine } = await sb()
    .from("lotto_entries")
    .select("id, digits, photo_path, created_at")
    .eq("user_id", user.id)
    .order("created_at");

  const urlMap = await signedUrls((mine || []).map((e) => e.photo_path));
  const myEntries = (mine || []).map((e) => ({
    id: e.id,
    digits: e.digits,
    photoUrl: urlMap[e.photo_path] || null,
    matches: winning ? matchCount(e.digits, winning) : null,
  }));

  // 추첨 완료 시: 전체 당첨자 명단 (2개 이상 일치, 1인 최고 1장)
  let winners = null;
  if (winning) {
    const { data: all } = await sb()
      .from("lotto_entries")
      .select("digits, users ( nickname )");
    const best = new Map(); // nickname -> { digits, matches }
    for (const e of all || []) {
      const nick = e.users?.nickname || "?";
      const m = matchCount(e.digits, winning);
      if (!best.has(nick) || m > best.get(nick).matches) best.set(nick, { digits: e.digits, matches: m });
    }
    winners = [...best.entries()]
      .map(([nickname, v]) => ({ nickname, ...v }))
      .filter((w) => w.matches >= 2)
      .sort((a, b) => b.matches - a.matches || a.nickname.localeCompare(b.nickname));
  }

  return json({
    entries: myEntries,
    maxEntries: Number(settings.max_lotto_entries || 1),
    winningNumbers: winning,
    winners,
  });
}

/** 로또 응모: digits("0524") + 사진 */
export async function POST(req) {
  const user = await getUser(req);
  if (!user) return err("로그인이 필요합니다.", 401);

  const settings = await getSettings();
  if (!inUploadPeriod(settings)) return err("지금은 응모 기간이 아닙니다.");
  if (settings.winning_numbers) return err("이미 추첨이 완료되었습니다.");

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const digits = String(form?.get("digits") || "");
  if (!/^\d{4}$/.test(digits)) return err("기록은 숫자 4자리(xx.xx)로 입력해주세요.");
  if (!file || typeof file.arrayBuffer !== "function") return err("인증 사진이 없습니다.");
  if (file.size > MAX_BYTES) return err("사진이 너무 큽니다. (5MB 이하)");

  const { count } = await sb()
    .from("lotto_entries")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const max = Number(settings.max_lotto_entries || 1);
  if ((count || 0) >= max) return err(`응모는 최대 ${max}장까지 가능합니다.`);

  const path = `lotto/${user.id}/${Date.now()}.jpg`;
  await uploadPhoto(path, Buffer.from(await file.arrayBuffer()));

  const { error } = await sb()
    .from("lotto_entries")
    .insert({ user_id: user.id, digits, photo_path: path });
  if (error) {
    await removePhoto(path);
    return err("응모 실패: " + error.message, 500);
  }
  return json({ ok: true });
}

/** 내 응모 취소 (기간 내, 추첨 전) */
export async function DELETE(req) {
  const user = await getUser(req);
  if (!user) return err("로그인이 필요합니다.", 401);

  const settings = await getSettings();
  if (!inUploadPeriod(settings)) return err("지금은 응모 기간이 아닙니다.");
  if (settings.winning_numbers) return err("이미 추첨이 완료되었습니다.");

  const { id } = await req.json().catch(() => ({}));
  const { data: entry } = await sb()
    .from("lotto_entries")
    .select("id, photo_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!entry) return err("응모를 찾을 수 없습니다.", 404);

  await sb().from("lotto_entries").delete().eq("id", entry.id);
  await removePhoto(entry.photo_path);
  return json({ ok: true });
}
