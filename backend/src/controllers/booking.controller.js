const { holdSeats, releaseSeats } = require('../services/seatHoldService');
const { createBooking, cancelBooking, getBookingHistory } = require('../services/bookingService');
const { seatHoldTtlSeconds } = require('../config/env');

async function hold(req, res, next) {
  try {
    const { eventId, seatIds } = req.body;
    const seats = await holdSeats(eventId, seatIds, req.user.id);
    req.app.get('io').to(`event:${eventId}`).emit('seat:bulk-status', seats.map((s) => ({ seatId: s.id, status: 'HELD' })));
    res.json({ seats, ttlSeconds: seatHoldTtlSeconds, heldUntil: seats[0]?.heldUntil });
  } catch (err) {
    next(err);
  }
}

// Called when a customer explicitly abandons checkout (e.g. navigates away, clicks cancel).
// The TTL sweeper is the safety net for silent abandonment; this is the fast path.
async function release(req, res, next) {
  try {
    const { eventId, seatIds } = req.body;
    await releaseSeats(seatIds, req.user.id);
    req.app.get('io').to(`event:${eventId}`).emit('seat:bulk-status', seatIds.map((id) => ({ seatId: id, status: 'AVAILABLE' })));
    res.json({ released: seatIds });
  } catch (err) {
    next(err);
  }
}

async function confirm(req, res, next) {
  try {
    const { eventId, seatIds } = req.body;
    const booking = await createBooking({ userId: req.user.id, eventId, seatIds });
    req.app.get('io').to(`event:${eventId}`).emit('seat:bulk-status', seatIds.map((id) => ({ seatId: id, status: 'BOOKED' })));
    res.status(201).json(booking);
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const booking = await cancelBooking(req.params.id, req.user.id);
    req.app.get('io').to(`event:${booking.eventId}`).emit('seat:bulk-status', booking.seats?.map((s) => ({ seatId: s.id, status: 'AVAILABLE' })) || []);
    res.json(booking);
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const bookings = await getBookingHistory(req.user.id);
    res.json(bookings);
  } catch (err) {
    next(err);
  }
}

module.exports = { hold, release, confirm, cancel, history };
