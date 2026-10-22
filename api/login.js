import { authConfigured, passwordMatches, issueSession, clearSession, isAdmin, clientIp } from "./_lib/auth.js";
import { bumpFailures, failures, storageReady } from "./_lib/store.js";
import { readJson, send } from "./_lib/http.js";

export default async function handler(req, res) {
  if (req.method === "GET") {
    return send(res, 200, { loggedIn: isAdmin(req), configured: authConfigured(), storage: storageReady() });
  }
  if (req.method === "DELETE") {
    clearSession(res);
    return send(res, 200, { loggedIn: false });
  }
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed" });

  if (!authConfigured()) return send(res, 503, { error: "Set ADMIN_PASSWORD in Vercel to enable the studio login." });
  const ip = clientIp(req);
  try {
    if ((await failures(ip)) >= 10) return send(res, 429, { error: "Too many attempts. Try again in 15 minutes." });
  } catch { /* storage hiccup: don't block login on it */ }

  const { password } = await readJson(req);
  if (!passwordMatches(password)) {
    try { await bumpFailures(ip); } catch {}
    await new Promise((r) => setTimeout(r, 400));
    return send(res, 401, { error: "Wrong password." });
  }
  issueSession(res);
  return send(res, 200, { loggedIn: true });
}
