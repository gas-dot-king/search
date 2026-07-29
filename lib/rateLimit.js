import crypto from "node:crypto";
import { sb } from "./db";
import { isDemoMode } from "./demo";

const demoBuckets = new Map();

function clientAddress(req) {
  return (req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown")
    .split(",")[0]
    .trim();
}

function bucket(scope, value) {
  return crypto.createHash("sha256").update(`${scope}:${value}`).digest("hex");
}

/** A persistent, cross-instance rate limit. It deliberately fails closed. */
export async function takeRateLimit(req, scope, value, { limit, windowSeconds }) {
  const key = bucket(scope, `${clientAddress(req)}:${value}`);
  if (isDemoMode()) {
    const current = demoBuckets.get(key);
    const now = Date.now();
    const next = !current || current.startedAt + windowSeconds * 1000 <= now
      ? { startedAt: now, attempts: 1 }
      : { ...current, attempts: current.attempts + 1 };
    demoBuckets.set(key, next);
    return next.attempts <= limit;
  }

  const { data, error } = await sb().rpc("take_auth_rate_limit", {
    p_bucket: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new Error(`요청 제한을 확인하지 못했습니다: ${error.message}`);
  return Boolean(data);
}
