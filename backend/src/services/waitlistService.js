const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');
const { generateOfferToken } = require('../utils/tokens');
const { sendWaitlistOffer } = require('../utils/email');
const { waitlistOfferTtlSeconds, frontendUrl } = require('../config/env');

async function joinWaitlist(eventId, category, userId) {
  const existing = await prisma.waitlistEntry.findFirst({
    where: { eventId, category, userId, status: { in: ['WAITING', 'OFFERED'] } },
  });
  if (existing) throw new ApiError(409, 'You are already on the waitlist for this category');

  return prisma.waitlistEntry.create({ data: { eventId, category, userId, status: 'WAITING' } });
}

/**
 * Waitlist auto-assignment + time-limited offer flow
 * ----------------------------------------------------
 * Called right after a seat in `category` becomes free for `eventId` (either from a
 * cancellation or an expired offer being skipped). Atomically claims the single
 * longest-waiting WAITING entry for that (event, category) — the `updateMany` WHERE clause
 * (id + status: 'WAITING') is the same conditional-update trick as seatHoldService, so if the
 * sweeper and a cancellation ever raced on the same entry, only one would succeed. Holds the
 * freed seat against that user (reusing the normal seat-hold TTL machinery isn't quite right
 * here since the offer window is longer/separate, so the seat is held directly with its own
 * offer expiry) and emails a time-limited claim link.
 */
async function offerSeatToNextInLine(eventId, category, seatId) {
  const nextEntry = await prisma.waitlistEntry.findFirst({
    where: { eventId, category, status: 'WAITING' },
    orderBy: { joinedAt: 'asc' },
  });
  if (!nextEntry) return null; // nobody waiting — seat just stays AVAILABLE

  const offerToken = generateOfferToken();
  const offerExpiresAt = new Date(Date.now() + waitlistOfferTtlSeconds * 1000);

  const claimed = await prisma.waitlistEntry.updateMany({
    where: { id: nextEntry.id, status: 'WAITING' },
    data: { status: 'OFFERED', offeredSeatId: seatId, offerToken, offerExpiresAt },
  });
  if (claimed.count === 0) return null; // lost a race to another sweeper tick — bail cleanly

  // Hold the seat against this specific offer so it can't be grabbed by a browsing customer
  // while the waitlisted user decides. heldBy = the offered user; heldUntil = offer expiry.
  await prisma.seat.updateMany({
    where: { id: seatId, status: 'AVAILABLE' },
    data: { status: 'HELD', heldBy: nextEntry.userId, heldUntil: offerExpiresAt },
  });

  const [user, event] = await Promise.all([
    prisma.user.findUnique({ where: { id: nextEntry.userId } }),
    prisma.event.findUnique({ where: { id: eventId } }),
  ]);

  const offerUrl = `${frontendUrl}/waitlist-offer/${offerToken}`;
  const minutesRemaining = Math.round(waitlistOfferTtlSeconds / 60);
  await sendWaitlistOffer({ to: user.email, name: user.name, event, category, offerUrl, minutesRemaining });

  return nextEntry;
}

// Called by the sweeper for every OFFERED entry whose offerExpiresAt has passed: marks it
// EXPIRED, releases the seat it was holding, then cascades to the next person in line.
async function expireOffer(entry) {
  const expired = await prisma.waitlistEntry.updateMany({
    where: { id: entry.id, status: 'OFFERED' },
    data: { status: 'EXPIRED' },
  });
  if (expired.count === 0) return; // already handled (user completed booking just in time)

  await prisma.seat.updateMany({
    where: { id: entry.offeredSeatId, heldBy: entry.userId, status: 'HELD' },
    data: { status: 'AVAILABLE', heldBy: null, heldUntil: null },
  });

  await offerSeatToNextInLine(entry.eventId, entry.category, entry.offeredSeatId);
}

async function sweepExpiredOffers() {
  const expired = await prisma.waitlistEntry.findMany({
    where: { status: 'OFFERED', offerExpiresAt: { lt: new Date() } },
  });
  for (const entry of expired) {
    await expireOffer(entry); // eslint-disable-line no-await-in-loop -- sequential to keep queue order fair
  }
  return expired;
}

// Customer clicks the emailed link -> this converts the OFFERED entry + held seat into a
// real booking. Delegates the actual booking creation to bookingService to reuse QR/email logic.
async function findOfferByToken(offerToken) {
  const entry = await prisma.waitlistEntry.findFirst({ where: { offerToken, status: 'OFFERED' } });
  if (!entry) throw new ApiError(404, 'This offer link is invalid or has already been used');
  if (entry.offerExpiresAt < new Date()) throw new ApiError(410, 'This offer has expired');
  return entry;
}

async function markOfferConverted(entryId) {
  return prisma.waitlistEntry.update({ where: { id: entryId }, data: { status: 'CONVERTED' } });
}

module.exports = {
  joinWaitlist,
  offerSeatToNextInLine,
  expireOffer,
  sweepExpiredOffers,
  findOfferByToken,
  markOfferConverted,
};
