// Booking storage.
// Production: Upstash Redis over its REST API (add the Upstash Redis
// integration in Vercel; it sets KV_REST_API_URL / KV_REST_API_TOKEN or
// UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).
// Local development: a JSON file, used only when no Redis is configured
// and we are not running on Vercel.
import { promises as fs } from "node:fs";
import path from "node:path";

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = "artiola:bookings";
const LOCAL_FILE = process.env.LOCAL_DB_FILE || path.join(process.cwd(), ".data", "bookings.json");

export const storageReady = () => Boolean(REDIS_URL && REDIS_TOKEN) || !process.env.VERCEL;

async function redis(...command) {
  const r = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || data.error) throw new Error(data.error || `Redis error ${r.status}`);
  return data.result;
}

async function readLocal() {
  try { return JSON.parse(await fs.readFile(LOCAL_FILE, "utf8")); } catch { return {}; }
}
async function writeLocal(all) {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(all, null, 2));
}

const useRedis = () => Boolean(REDIS_URL && REDIS_TOKEN);

export async function listBookings() {
  if (useRedis()) {
    const flat = (await redis("HGETALL", KEY)) || [];
    const out = [];
    for (let i = 0; i < flat.length; i += 2) {
      try { out.push(JSON.parse(flat[i + 1])); } catch { /* skip corrupt row */ }
    }
    return out;
  }
  return Object.values(await readLocal());
}

export async function getBooking(id) {
  if (useRedis()) {
    const raw = await redis("HGET", KEY, id);
    return raw ? JSON.parse(raw) : null;
  }
  return (await readLocal())[id] || null;
}

export async function saveBooking(b) {
  if (useRedis()) { await redis("HSET", KEY, b.id, JSON.stringify(b)); return b; }
  const all = await readLocal(); all[b.id] = b; await writeLocal(all); return b;
}

export async function deleteBooking(id) {
  if (useRedis()) return (await redis("HDEL", KEY, id)) > 0;
  const all = await readLocal(); const had = id in all; delete all[id]; await writeLocal(all); return had;
}

// Counts failed logins per IP for 15 minutes (Redis only; no-op locally).
export async function bumpFailures(ip) {
  if (!useRedis()) return 0;
  const k = `artiola:loginfail:${ip}`;
  const n = await redis("INCR", k);
  if (n === 1) await redis("EXPIRE", k, 900);
  return n;
}
export async function failures(ip) {
  if (!useRedis()) return 0;
  return Number(await redis("GET", `artiola:loginfail:${ip}`)) || 0;
}
