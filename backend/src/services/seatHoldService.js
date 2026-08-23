const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');
const { seatHoldTtlSeconds } = require('../config/env');

/**
 * Concurrency model
 * ------------------
 * Every seat mutation goes through a conditional UPDATE of the form:
 *
 *   UPDATE "Seat" SET status = X, ... WHERE id = $1 AND status = $2
 *
 * Postgres takes a row-level write lock for the duration of an UPDATE. If two requests
 * race to hold/book the same seat, the second UPDATE blocks until the first commits, then
 * re-evaluates its WHERE clause against the now-changed row and matches zero rows. Prisma's
 * `updateMany` returns `{ count }`, so "0 rows affected" is our atomic, race-free signal that
 * someone else got there first — no explicit locking or Redis needed. Multi-seat holds wrap
 * all per-seat updates in a single `$transaction` so a booking either reserves every requested
 * seat or none of them (all-or-nothing), and a failure midway rolls the whole thing back.
 */

async function holdSeats(eventId, seatIds, userId) {
  const heldUntil = new Date(Date.now() + seatHoldTtlSeconds * 1000);

  return prisma.$transaction(async (tx) => {
    for (const seatId of seatIds) {
      const result = await tx.seat.updateMany({
        where: { id: seatId, eventId, status: 'AVAILABLE' },
        data: { status: 'HELD', heldBy: userId, heldUntil, version: { increment: 1 } },
      });
      if (result.count === 0) {
        // Someone else holds/booked it first (or it doesn't belong to this event) — abort
        // the whole transaction so previously-held seats in this same request are released.
        throw new ApiError(409, `Seat ${seatId} is no longer available`);
      }
    }
    return tx.seat.findMany({ where: { id: { in: seatIds } } });
  });
}

// Releases seats back to AVAILABLE. Used for explicit checkout-abandon and by the TTL sweeper.
// Only releases seats actually owned by userId when userId is passed, so a stray call can't
// steal someone else's active hold.
async function releaseSeats(seatIds, userId = null) {
  const where = userId ? { id: { in: seatIds }, heldBy: userId, status: 'HELD' } : { id: { in: seatIds }, status: 'HELD' };
  return prisma.seat.updateMany({
    where,
    data: { status: 'AVAILABLE', heldBy: null, heldUntil: null },
  });
}

// Converts a user's currently-held seats into BOOKED + attaches the booking, atomically.
// Verifies each seat is still HELD by this exact user before flipping it — guards against
// the hold having expired (and been swept) between checkout submission and this call.
async function confirmSeats(seatIds, userId, bookingId) {
  return prisma.$transaction(async (tx) => {
    for (const seatId of seatIds) {
      const result = await tx.seat.updateMany({
        where: { id: seatId, heldBy: userId, status: 'HELD' },
        data: { status: 'BOOKED', bookingId, heldBy: null, heldUntil: null, version: { increment: 1 } },
      });
      if (result.count === 0) {
        throw new ApiError(409, `Your hold on seat ${seatId} has expired — please reselect your seats`);
      }
    }
    return tx.seat.findMany({ where: { id: { in: seatIds } } });
  });
}

// Frees seats from a cancelled booking back to AVAILABLE (waitlist assignment happens
// separately in waitlistService, triggered right after this).
async function freeBookedSeats(seatIds) {
  return prisma.seat.updateMany({
    where: { id: { in: seatIds }, status: 'BOOKED' },
    data: { status: 'AVAILABLE', bookingId: null },
  });
}

// Called by the background sweeper: finds every hold whose TTL has passed and releases it.
async function releaseExpiredHolds() {
  const expired = await prisma.seat.findMany({
    where: { status: 'HELD', heldUntil: { lt: new Date() } },
    select: { id: true, eventId: true },
  });
  if (expired.length === 0) return [];

  await prisma.seat.updateMany({
    where: { id: { in: expired.map((s) => s.id) }, status: 'HELD', heldUntil: { lt: new Date() } },
    data: { status: 'AVAILABLE', heldBy: null, heldUntil: null },
  });
  return expired;
}

module.exports = { holdSeats, releaseSeats, confirmSeats, freeBookedSeats, releaseExpiredHolds };
