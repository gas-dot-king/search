import crypto from "node:crypto";
import { sb } from "./db";
import { demoGetUser, isDemoMode } from "./demo";

const USER_CACHE_TTL_MS = 30 * 1000;
const MAX_USER_CACHE_ENTRIES = 500;
const userCache = new Map();

function cachedUser(token) {
  const entry = userCache.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    userCache.delete(token);
    return null;
  }
  userCache.delete(token);
  userCache.set(token, entry);
  return entry.user;
}

function cacheUser(token, user) {
  userCache.set(token, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
  while (userCache.size > MAX_USER_CACHE_ENTRIES) userCache.delete(userCache.keys().next().value);
}

export function hashPin(pin) {
  const salt = crypto.randomBytes(8).toString("hex");
  const hash = crypto.scryptSync(pin, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(pin, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

export function newToken() {
  return crypto.randomBytes(24).toString("hex");
}

/** Authorization: Bearer <token> 으로 유저 조회 */
export async function getUser(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (isDemoMode()) return demoGetUser(token);
  const cached = cachedUser(token);
  if (cached) return cached;
  const { data } = await sb().from("users").select("id, nickname").eq("token", token).single();
  if (data) cacheUser(token, data);
  return data || null;
}

export function isAdmin(req) {
  if (isDemoMode()) return req.headers.get("x-admin-password") === "demo";
  const pw = process.env.ADMIN_PASSWORD;
  return Boolean(pw) && req.headers.get("x-admin-password") === pw;
}
