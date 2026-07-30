import { maskedClientIp } from "@/lib/ip";

export async function GET(request) {
  return Response.json({ ip: maskedClientIp(request) });
}
