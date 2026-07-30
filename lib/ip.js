/** Return the first client address supplied by the reverse proxy. */
export function clientIp(request) {
  const forwarded = request?.headers?.get("x-forwarded-for") || "";
  const real = request?.headers?.get("x-real-ip") || "";
  return String(forwarded || real).split(",")[0].trim();
}

/** Keep the privacy-preserving display format while using the real address. */
export function maskedIp(value) {
  const ip = String(value || "").trim();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) return `${ip.split(".").slice(0, 3).join(".")}.~`;
  if (ip.includes(":")) {
    const groups = ip.split(":").filter(Boolean);
    return groups.length ? `${groups.slice(0, 4).join(":")}:~` : "확인 불가";
  }
  return "확인 불가";
}

export function maskedClientIp(request) {
  return maskedIp(clientIp(request));
}
