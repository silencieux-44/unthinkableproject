# Marquee — Ticket Booking System

A full-stack platform for booking movie/concert seats from a visual seat map, with TTL-based
seat holds, concurrency-safe booking, a waitlist with automatic seat reassignment, and
QR-coded email tickets.

**Stack:** Node.js/Express · PostgreSQL + Prisma · Socket.io (real-time seat map) · React (Vite)
· JWT auth · `qrcode` + `nodemailer`

---

## 1. Setup guide

### Prerequisites
- Node.js 18+
- A PostgreSQL database (local, or a free instance on Render/Railway/Neon/Supabase)

### Backend

```bash
cd backend
cp .env.example .env      # fill in DATABASE_URL at minimum — everything else has sane defaults
npm install
npx prisma migrate dev --name init   # creates tables
npm run seed                          # optional: demo venue/event + admin/organiser/customer logins
npm run dev                           # http://localhost:4000
```

Email defaults to `EMAIL_MODE=ethereal`, which auto-creates a throwaway inbox via
[Ethereal](https://ethereal.email/) on first send — no signup needed. Every send logs a
preview URL in the server console. For a real inbox, set `EMAIL_MODE=smtp` and fill in
`SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` (a Gmail App Password works fine on the free tier).

### Frontend

```bash
cd frontend
cp .env.example .env      # VITE_API_URL — defaults to http://localhost:4000
npm install
npm run dev                # http://localhost:5173
```

### Demo logins (after `npm run seed`)
| Role      | Email                          | Password    |
|-----------|---------------------------------|-------------|
| Admin     | admin@ticketbooking.dev        | password123 |
| Organiser | organiser@ticketbooking.dev    | password123 |
| Customer  | customer@ticketbooking.dev     | password123 |

---

## 2. Database schema

See `backend/prisma/schema.prisma` for the source of truth. Summary:

- **User** — `role` is one of `CUSTOMER` / `ORGANISER` / `ADMIN`.
- **Venue** — owns a `seatLayout` JSON blob (`{ rows, cols, categories: [{ name, rowLabels }] }`)
  describing the physical grid and which row letters belong to which category.
- **Event** — belongs to a `Venue` and an organiser `User`; carries per-category `pricing`
  (e.g. `{ "Premium": 500, "Standard": 250 }`).
- **Seat** — **one row per physical seat per event**, denormalised from the venue's
  `seatLayout` at event-creation time. This is deliberate: per-seat `status`
  (`AVAILABLE` / `HELD` / `BOOKED`), `heldBy`, and `heldUntil` all need somewhere to live and
  be locked individually — a shared layout template can't carry that state.
- **Booking** — one row per confirmed purchase; `reference` is the string encoded into the QR
  code. Related `Seat`s point back at it via `bookingId`.
- **WaitlistEntry** — one row per (event, category, customer); tracks `WAITING` → `OFFERED`
  (a seat has been reserved for this person) → `CONVERTED` / `EXPIRED`.

---

## 3. Seat hold & waitlist logic (see `SYSTEM_DESIGN.md` for the full write-up)

- **Hold TTL**: `POST /api/bookings/hold` sets `status=HELD`, `heldBy`, `heldUntil = now + SEAT_HOLD_TTL_SECONDS`.
  A cron job (`backend/src/jobs/sweeper.js`, interval `SWEEPER_INTERVAL_SECONDS`) finds and
  releases any hold whose `heldUntil` has passed, and broadcasts the change over Socket.io so
  every open seat map updates instantly.
- **Concurrency**: every seat mutation is a single conditional `UPDATE ... WHERE id = ? AND status = ?`
  (via Prisma's `updateMany`, wrapped in `$transaction` for multi-seat requests). Postgres's
  row-level write lock makes the "0 rows affected" result an atomic, race-free signal that
  someone else got there first — see `backend/src/services/seatHoldService.js` for the full
  reasoning.
- **Waitlist auto-assignment**: on cancellation (or an expired offer), the freed seat's
  category queue is checked; the longest-waiting `WAITING` entry is atomically claimed
  (same conditional-update pattern), the seat is held against that specific user with its own
  `offerExpiresAt`, and an email with a time-limited claim link goes out.
- **Time-limited offers**: the same sweeper expires `OFFERED` entries whose window has passed,
  releases the seat, and cascades to the next person in line — so a queue never stalls on an
  unresponsive customer.

---

## 4. API docs

Base URL: `/api`. Authenticated routes expect `Authorization: Bearer <token>`.

### Auth
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/auth/register` | — | `{ name, email, password, role? }` |
| POST | `/auth/login` | — | `{ email, password }` |
| GET | `/auth/me` | ✅ | — |

### Venues (admin creates layouts)
| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/venues` | — | — |
| GET | `/venues/:id` | — | — |
| POST | `/venues` | ADMIN | `{ name, address, seatLayout }` |

### Events
| Method | Path | Auth | Body / Query |
|---|---|---|---|
| GET | `/events` | — | `?type=&from=&to=&search=` |
| GET | `/events/:id` | — | — (includes `seats[]`) |
| POST | `/events` | ORGANISER/ADMIN | `{ title, type, description, date, venueId, pricing }` |

### Bookings
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/bookings/hold` | ✅ | `{ eventId, seatIds[] }` |
| POST | `/bookings/release` | ✅ | `{ eventId, seatIds[] }` (explicit checkout-abandon) |
| POST | `/bookings/confirm` | ✅ | `{ eventId, seatIds[] }` → creates booking, sends QR email |
| POST | `/bookings/:id/cancel` | ✅ | — → frees seats, triggers waitlist offer |
| GET | `/bookings/history` | ✅ | — |

### Waitlist
| Method | Path | Auth | Body |
|---|---|---|---|
| POST | `/waitlist/join` | ✅ | `{ eventId, category }` |
| GET | `/waitlist/offer/:token` | — | — (offer-claim landing page data) |
| POST | `/waitlist/offer/:token/claim` | ✅ | — → converts offer into a booking |

### Organiser
| Method | Path | Auth | — |
|---|---|---|---|
| GET | `/organiser/events` | ORGANISER/ADMIN | events owned by caller |
| GET | `/organiser/events/:eventId/summary` | ORGANISER/ADMIN | revenue + booking list |

### Real-time (Socket.io)
- Client emits `event:join` / `event:leave` with an `eventId` to subscribe to that show's room.
- Server emits `seat:status` (`{ seatId, status }`) and `seat:bulk-status` (array of the same)
  whenever a hold, booking, cancellation, or expiry changes a seat's state.

---

## 5. Deployment

- **Backend**: Render/Railway — set `DATABASE_URL`, `JWT_SECRET`, `CLIENT_ORIGIN` (your deployed
  frontend URL), `FRONTEND_URL`, and email vars; run `npx prisma migrate deploy` on release.
- **Frontend**: Vercel/Render static site — set `VITE_API_URL` to your deployed backend URL.
- **Database**: Render/Railway/Neon/Supabase all offer a free Postgres tier.
