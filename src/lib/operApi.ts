// Client for the nbtc-oper HTTP wrapper (github.com/dearxcorex/oper_api,
// server/app.py): the live NBTC OPER portal, fmr.nbtc.go.th.
//
// Cloudflare challenges the portal from cloud IPs, so the wrapper runs on the
// Raspberry Pi at home, next to the Discord bot — OPER_API_URL is normally
// http://127.0.0.1:8787. Unset means the /ask OPER tools report "not set up".
// The wrapper is read-only and never returns coordinates.

/** The portal walks pages 1.5 s apart, so a year's inspections can take a while. */
const TIMEOUT_MS = 30_000;

export function operConfigured(): boolean {
  return Boolean(process.env.OPER_API_URL && process.env.OPER_API_TOKEN);
}

export async function operRequest(path: string, body: Record<string, unknown>): Promise<unknown> {
  const url = process.env.OPER_API_URL;
  const token = process.env.OPER_API_TOKEN;
  if (!url || !token) throw new Error('ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบ OPER');

  const res = await fetch(`${url.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok) {
    // The wrapper answers {error, detail}; FastAPI's own 401/422 answer {detail}.
    const kind = typeof data?.error === 'string' ? data.error : `http_${res.status}`;
    const detail = typeof data?.detail === 'string' ? data.detail : JSON.stringify(data?.detail ?? '');
    throw new Error(`OPER ${kind}: ${detail}`.trim());
  }
  return data;
}
