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

/** Authorization: Bearer <token> 으로 유저 조회 */
export async function getUser(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (isDemoMode()) return demoGetUser(token);
  const { data } = await sb().from("users").select("id, nickname").eq("token", token).single();
  return data || null;
}

export function isAdmin(req) {
  if (isDemoMode()) return req.headers.get("x-admin-password") === "demo";
  const pw = process.env.ADMIN_PASSWORD;
  return Boolean(pw) && req.headers.get("x-admin-password") === pw;
}
