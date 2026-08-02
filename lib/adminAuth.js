import crypto from "node:crypto";
import { isDemoMode } from "./demo";

export const ADMIN_SESSION_COOKIE = "ysrc_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 10 * 60;

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || "ysrc-admin-session-secret";
}

export function adminPassword() {
  return isDemoMode() ? "demo" : process.env.ADMIN_PASSWORD || "";
}

export function verifyAdminPassword(password) {
  const expected = adminPassword();
  const actualBytes = Buffer.from(String(password || ""));
  const expectedBytes = Buffer.from(expected);
  if (!expected || actualBytes.length !== expectedBytes.length) return false;
  return crypto.timingSafeEqual(actualBytes, expectedBytes);
}

function signature(expiresAt) {
  return crypto.createHmac("sha256", sessionSecret()).update(String(expiresAt)).digest("base64url");
}

export function createAdminSession() {
  const expiresAt = Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS;
  return `${expiresAt}.${signature(expiresAt)}`;
}

function readCookie(req) {
  const cookieHeader = req.headers.get("cookie") || "";
  for (const part of cookieHeader.split(";")) {
    const [name, ...value] = part.trim().split("=");
    if (name === ADMIN_SESSION_COOKIE) return value.join("=");
  }
  return "";
}

export function isValidAdminSession(req) {
  const token = readCookie(req);
  const [expiresAt, actualSignature] = token.split(".");
  if (!expiresAt || !actualSignature || !/^\d+$/.test(expiresAt)) return false;
  if (Number(expiresAt) <= Math.floor(Date.now() / 1000)) return false;

  const expectedSignature = signature(expiresAt);
  if (actualSignature.length !== expectedSignature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actualSignature), Buffer.from(expectedSignature));
}

function cookieAttributes(maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function adminSessionCookie() {
  return `${ADMIN_SESSION_COOKIE}=${createAdminSession()}; ${cookieAttributes(ADMIN_SESSION_TTL_SECONDS)}`;
}

export function clearAdminSessionCookie() {
  return `${ADMIN_SESSION_COOKIE}=; ${cookieAttributes(0)}`;
}
