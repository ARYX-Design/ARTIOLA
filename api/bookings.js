import crypto from "node:crypto";
import { isAdmin } from "./_lib/auth.js";
import { listBookings, getBooking, saveBooking, deleteBooking, storageReady } from "./_lib/store.js";
import { readJson, send, clean, cleanText } from "./_lib/http.js";

export const STATUSES = ["pending", "confirmed", "done", "cancelled", "no-show"];
const TIMES = ["Morning", "Afternoon", "Evening"];
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const isClock = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

export default async function handler(req, res) {
  if (!storageReady()) return send(res, 503, { error: "Bookings storage is not set up yet." });
  const admin = isAdmin(req);

  try {
    // Public: a client sends a booking request from the landing page.
    // Admin: the studio adds a booking by hand (e.g. from an Instagram DM).
    if (req.method === "POST") {
      const b = await readJson(req);
      if (clean(b.website, 100)) return send(res, 200, { ok: true }); // honeypot: bots fill hidden field
      const booking = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        name: clean(b.name, 80),
        phone: clean(b.phone, 40),
        instagram: clean(b.instagram, 60).replace(/^@/, ""),
        service: clean(b.service, 60),
        design: clean(b.design, 160),
        date: isDate(b.date) ? b.date : "",
        time: TIMES.includes(b.time) ? b.time : "",
        clock: isClock(b.clock) ? b.clock : "",
        notes: cleanText(b.notes, 1000),
        status: admin && STATUSES.includes(b.status) ? b.status : "pending",
        price: admin ? clean(b.price, 20) : "",
        studioNotes: admin ? cleanText(b.studioNotes, 1000) : "",
        source: admin ? clean(b.source || "studio", 20) : "website",
      };
      if (!booking.name || !booking.service) return send(res, 400, { error: "Name and service are required." });
      if (!admin && !booking.phone && !booking.instagram) return send(res, 400, { error: "Add a phone number or Instagram so we can confirm." });
      await saveBooking(booking);
      return send(res, 201, admin ? { booking } : { ok: true, id: booking.id });
    }

    if (!admin) return send(res, 401, { error: "Please log in." });

    if (req.method === "GET") {
      const all = await listBookings();
      all.sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || (a.clock || "").localeCompare(b.clock || "") || b.createdAt.localeCompare(a.createdAt));
      return send(res, 200, { bookings: all, statuses: STATUSES });
    }

    if (req.method === "PATCH") {
      const b = await readJson(req);
      const current = await getBooking(clean(b.id, 60));
      if (!current) return send(res, 404, { error: "Booking not found." });
      const next = { ...current, updatedAt: new Date().toISOString() };
      if ("status" in b && STATUSES.includes(b.status)) next.status = b.status;
      if ("date" in b) next.date = isDate(b.date) ? b.date : "";
      if ("time" in b) next.time = TIMES.includes(b.time) ? b.time : "";
      if ("clock" in b) next.clock = isClock(b.clock) ? b.clock : "";
      for (const [k, max] of [["name", 80], ["phone", 40], ["service", 60], ["design", 160], ["price", 20]]) if (k in b) next[k] = clean(b[k], max);
      if ("instagram" in b) next.instagram = clean(b.instagram, 60).replace(/^@/, "");
      if ("notes" in b) next.notes = cleanText(b.notes, 1000);
      if ("studioNotes" in b) next.studioNotes = cleanText(b.studioNotes, 1000);
      await saveBooking(next);
      return send(res, 200, { booking: next });
    }

    if (req.method === "DELETE") {
      const id = clean(new URL(req.url, "http://x").searchParams.get("id"), 60);
      return (await deleteBooking(id)) ? send(res, 200, { ok: true }) : send(res, 404, { error: "Booking not found." });
    }

    return send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    console.error(err);
    return send(res, 500, { error: "Something went wrong. Please try again." });
  }
}
