# Artiola — nail art studio website

Landing page (`index.html`) with a booking form, plus a private studio panel
(`/admin`) where Artiola sees and manages reservations.

## Studio panel

Open `/admin` on the live site (also linked as "Studio login" in the footer).

- **Bookings:** every request from the website form lands here as *pending*.
- **List and calendar:** filter by status or date, and search by name, phone or service.
- **Booking details:** click a booking to confirm it, set an exact time and price,
  add private notes, or call, WhatsApp or DM the client.
- **New booking:** add appointments that came in by Instagram DM or phone.
- **Export CSV:** download all bookings as a spreadsheet.

## One-time setup on Vercel

1. Import this repo in Vercel (Framework preset: **Other**, no build command).
2. **Storage → Add → Upstash Redis** (free tier), connect it to the project.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
3. **Settings → Environment Variables:**
   - `ADMIN_PASSWORD`: the password Artiola uses to log in (make it long).
   - `SESSION_SECRET` (optional): any long random string. Changing it logs everyone out.
4. Redeploy. Visit `/admin` and log in.

## Run locally

```bash
ADMIN_PASSWORD=choose-a-password npm run dev   # http://localhost:3000
```

Without Redis configured, local bookings are saved to `.data/bookings.json`.

## Photos

See `images/README.md`. The collection photos are AI-generated styled shots.
Replace them with real client sets when available.
