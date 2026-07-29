import crypto from "node:crypto";
import { promisify } from "node:util";
import { sb } from "./db";
import { demoGetUser, isDemoMode } from "./demo";

const scrypt = promisify(crypto.scrypt);

// scrypt는 의도적으로 느린 해시라 동기 버전은 요청 처리 전체를 멈춘다. 비동기로 실행한다.
export async function hashPin(pin) {
  const salt = crypto.randomBytes(8).toString("hex");
  const hash = (await scrypt(pin, salt, 32)).toString("hex");
  return `${salt}:${hash}`;
}

export async function verifyPin(pin, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = await scrypt(pin, salt, 32);
  const expected = Buffer.from(hash, "hex");
  // timingSafeEqual은 길이가 다르면 예외를 던지므로 손상된 해시는 불일치로 처리한다.
  if (candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

export function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function sessionExpiresAt() {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
}

/** Authorization: Bearer <token> 으로 유저 조회 */
export async function getUser(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (isDemoMode()) return demoGetUser(token);
  const { data, error } = await sb()
    .from("users")
    .select("id, nickname, token_expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (error) throw new Error(`세션을 확인하지 못했습니다: ${error.message}`);
  if (!data || new Date(data.token_expires_at).getTime() <= Date.now()) return null;
  return { id: data.id, nickname: data.nickname };
}

export function isAdmin(req) {
  if (isDemoMode()) return req.headers.get("x-admin-password") === "demo";
  const pw = process.env.ADMIN_PASSWORD;
  return Boolean(pw) && req.headers.get("x-admin-password") === pw;
}
