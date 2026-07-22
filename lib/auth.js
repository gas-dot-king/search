import crypto from "node:crypto";
import { sb } from "./db";

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
  const { data } = await sb().from("users").select("*").eq("token", token).single();
  return data || null;
}

export function isAdmin(req) {
  const pw = process.env.ADMIN_PASSWORD;
  return Boolean(pw) && req.headers.get("x-admin-password") === pw;
}

export function json(data, status = 200) {
  return Response.json(data, { status });
}

export const err = (message, status = 400) => json({ error: message }, status);
