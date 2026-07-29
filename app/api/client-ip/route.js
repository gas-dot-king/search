function maskIp(value) {
  const ip = String(value || "").split(",")[0].trim();
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ip)) {
    return `${ip.split(".").slice(0, 3).join(".")}.~`;
  }
  return "125.182.215.~";
}

export async function GET(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  return Response.json({ ip: maskIp(forwarded || real || "") });
}
