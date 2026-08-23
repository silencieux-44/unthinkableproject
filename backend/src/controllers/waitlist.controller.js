const { joinWaitlist, findOfferByToken, markOfferConverted } = require('../services/waitlistService');
const { createBookingFromOffer } = require('../services/bookingService');
const prisma = require('../config/db');

async function join(req, res, next) {
  try {
    const { eventId, category } = req.body;
    const entry = await joinWaitlist(eventId, category, req.user.id);
    res.status(201).json(entry);
  } catch (err) {
    next(err);
  }
}

// Public: lets the offer-claim page show event/seat details before the user confirms.
async function getOffer(req, res, next) {
  try {
    const entry = await findOfferByToken(req.params.token);
    const [event, seat] = await Promise.all([
      prisma.event.findUnique({ where: { id: entry.eventId }, include: { venue: true } }),
      prisma.seat.findUnique({ where: { id: entry.offeredSeatId } }),
    ]);
    res.json({ entry, event, seat });
  } catch (err) {
    next(err);
  }
}

async function claimOffer(req, res, next) {
  try {
    const entry = await findOfferByToken(req.params.token);
    if (entry.userId !== req.user.id) {
      return res.status(403).json({ error: 'This offer belongs to a different account' });
    }
    const booking = await createBookingFromOffer({ userId: req.user.id, eventId: entry.eventId, seatId: entry.offeredSeatId });
    await markOfferConverted(entry.id);
    req.app.get('io').to(`event:${entry.eventId}`).emit('seat:status', { seatId: entry.offeredSeatId, status: 'BOOKED' });
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

module.exports = { join, getOffer, claimOffer };
