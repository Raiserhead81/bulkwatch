// Session cookie signing/verification via HMAC-SHA256
// Works in both Node.js and Edge Runtime (Web Crypto API)
import { createHmac } from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET || "";
if (!SECRET) throw new Error("NEXTAUTH_SECRET or SESSION_SECRET environment variable is required");

export interface SessionData {
  id: number;
  username: string;
  company: string;
  role: string;
}

function hmacSign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("hex");
}

/**
 * Sign session data: returns "base64(json).hmac_signature"
 */
export function signSession(data: SessionData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64");
  const sig = hmacSign(payload);
  return payload + "." + sig;
}

/**
 * Verify and parse a signed session cookie.
 * Returns null if signature is invalid or data is malformed.
 */
export function verifySession(cookie: string): SessionData | null {
  const dotIdx = cookie.lastIndexOf(".");
  if (dotIdx < 1) return null;

  const payload = cookie.substring(0, dotIdx);
  const sig = cookie.substring(dotIdx + 1);

  const expected = hmacSign(payload);

  // Timing-safe comparison
  if (sig.length !== expected.length) return null;
  let mismatch = 0;
  for (let i = 0; i < sig.length; i++) {
    mismatch |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (mismatch !== 0) return null;

  try {
    const json = Buffer.from(payload, "base64").toString("utf8");
    const data = JSON.parse(json);
    if (data && typeof data.username === "string") return data as SessionData;
  } catch {}
  return null;
}
