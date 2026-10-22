// Password login for the studio panel.
// Set ADMIN_PASSWORD (and optionally SESSION_SECRET) in Vercel → Settings →
// Environment Variables. Sessions are signed, HttpOnly cookies valid 7 days.
import crypto from "node:crypto";

const COOKIE = "artiola_session";
const MAX_AGE = 60 * 60 * 24 * 7;
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";

const sign = (payload) => crypto.createHmac("sha256", secret()).update(payload).digest("base64url");

export const authConfigured = () => Boolean(process.env.ADMIN_PASSWORD);

export function passwordMatches(input) {
  const a = crypto.createHash("sha256").update(String(input || "")).digest();
  const b = crypto.createHash("sha256").update(process.env.ADMIN_PASSWORD || "").digest();
  return authConfigured() && crypto.timingSafeEqual(a, b);
}

function cookieAttrs(maxAge) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function issueSession(res) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  const payload = `admin.${exp}`;
  res.setHeader("Set-Cookie", `${COOKIE}=${payload}.${sign(payload)}; ${cookieAttrs(MAX_AGE)}`);
}

export function clearSession(res) {
  res.setHeader("Set-Cookie", `${COOKIE}=; ${cookieAttrs(0)}`);
}

export function isAdmin(req) {
  if (!authConfigured()) return false;
  const raw = (req.headers.cookie || "").split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!raw) return false;
  const [role, exp, sig] = raw.slice(COOKIE.length + 1).split(".");
  if (role !== "admin" || !exp || !sig) return false;
  const expected = sign(`${role}.${exp}`);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  return Number(exp) > Date.now() / 1000;
}

export const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
