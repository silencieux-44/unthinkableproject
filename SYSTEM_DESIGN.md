# System Design — Seat Holds, Concurrency, and the Waitlist

## Seat model and the hold/TTL mechanism

Rather than storing seat availability as a computed value, every seat for every event is a
concrete row (`Seat`) with an explicit `status` (`AVAILABLE` / `HELD` / `BOOKED`), plus `heldBy`
and `heldUntil` columns. This is what makes a "hold" possible at all: it's a normal row update,
not a separate cache entry that can drift out of sync with the database of record.

When a customer selects seats and requests a hold, `POST /bookings/hold` sets
`status = HELD`, `heldBy = userId`, `heldUntil = now + SEAT_HOLD_TTL_SECONDS` (configurable,
default 10 minutes). The seat map immediately reflects this for every other viewer via a
Socket.io broadcast to that event's room, so no one else can even attempt to select it.

TTL expiry is enforced by a background sweeper (`node-cron`, configurable interval, default
30s) rather than a per-seat timer or a Redis TTL key. A `setTimeout` per seat doesn't survive a
server restart, and introducing Redis purely for expiry would add an extra moving part with its
own failure modes for what is, structurally, a periodic "is `heldUntil` in the past?" query
against a column Postgres already indexes well. The sweeper finds every seat where
`status = HELD AND heldUntil < now()`, releases them back to `AVAILABLE`, and broadcasts the
change — this is also the safety net for a customer who simply closes the tab instead of
explicitly abandoning checkout (the explicit `POST /bookings/release` path exists for the fast
case, but the sweeper guarantees correctness either way).

## Concurrency prevention

The core risk is two customers racing to hold or book the same seat. The design leans entirely
on Postgres's native row-level locking rather than an application-level mutex or a distributed
lock service:

```
UPDATE "Seat" SET status = 'HELD', heldBy = $1, heldUntil = $2
WHERE id = $3 AND status = 'AVAILABLE'
```

A single `UPDATE` statement with the current expected state in its `WHERE` clause is atomic:
Postgres takes a write lock on the target row for the statement's duration. If two requests
race for the same seat, the second is blocked until the first commits, then re-evaluates its
`WHERE` clause against the now-changed row and matches zero rows. Prisma's `updateMany` surfaces
this as `{ count: 0 }`, which the seat-hold service treats as an authoritative "someone beat you
to it" signal — no read-then-write gap, no separate locking primitive, and no possibility of
both requests believing they succeeded. The same pattern secures the hold→booked transition
(`confirmSeats`) and the booked→available transition on cancellation, and it's reused again in
the waitlist claim logic below.

For multi-seat requests (a customer selecting four seats at once), every per-seat `UPDATE` runs
inside a single Prisma `$transaction`. If any one seat in the batch is already taken, the whole
transaction throws and rolls back — a customer either holds every seat they asked for, or none
of them, never a partial set.

## Waitlist auto-assignment flow

Each `(event, category)` pair has its own FIFO queue (`WaitlistEntry`, ordered by `joinedAt`).
The moment a seat in that category is freed — from a cancellation, or a waitlist offer itself
expiring — `offerSeatToNextInLine` runs: it finds the oldest `WAITING` entry and claims it with
the identical conditional-update trick (`WHERE id = ? AND status = 'WAITING'`), so if the
sweeper and a cancellation ever raced on the same entry, exactly one claim succeeds. The freed
seat is then held directly against that user, and a "seat opened up" email goes out with a
signed, single-use link.

## Time-limited offer handling

An offer isn't a booking — it's a claim on a specific seat with its own expiry
(`WAITLIST_OFFER_TTL_SECONDS`, default 30 minutes), tracked via `offerToken` and
`offerExpiresAt` on the `WaitlistEntry`. The same sweeper that expires stale holds also expires
stale offers: for every `OFFERED` entry past its window, it marks the entry `EXPIRED`, releases
the seat back to `AVAILABLE`, and immediately calls `offerSeatToNextInLine` again for that same
seat — so an unresponsive customer doesn't stall the queue; the seat simply cascades to whoever
is next. Clicking the emailed link hits a public "preview" endpoint (event/seat details, no
side effects) and a separate authenticated "claim" endpoint, which converts the held seat
straight into a `Booking` via the same code path as a normal checkout — reusing QR generation
and the confirmation email rather than duplicating that logic for the waitlist path.

## Trade-offs and what a production version would change

A cron sweeper trades a little latency (up to `SWEEPER_INTERVAL_SECONDS`) for operational
simplicity; a queue-based expiry (Redis keyspace notifications, a delayed-job queue) would
tighten that to near-zero but adds infrastructure this scope doesn't need. Booking creation and
seat confirmation are currently two sequential calls rather than one `$transaction` — a
hardening pass would fold them together so a mid-flight failure can't orphan a `Booking` row.
