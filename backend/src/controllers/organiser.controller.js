const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// Booking summary + revenue for a single event, scoped to the organiser who owns it.
async function eventSummary(req, res, next) {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
    if (!event) throw new ApiError(404, 'Event not found');
    if (event.organiserId !== req.user.id) throw new ApiError(403, 'You do not own this event');

    const bookings = await prisma.booking.findMany({
      where: { eventId: event.id, status: 'CONFIRMED' },
      include: { seats: true, user: true },
    });

    const seatCounts = await prisma.seat.groupBy({ by: ['status'], where: { eventId: event.id }, _count: true });
    const revenue = bookings.reduce((sum, b) => sum + b.totalAmount, 0);
    const seatsSold = bookings.reduce((sum, b) => sum + b.seats.length, 0);

    res.json({
      event,
      revenue,
      seatsSold,
      totalBookings: bookings.length,
      seatStatusBreakdown: seatCounts.reduce((acc, s) => ({ ...acc, [s.status]: s._count }), {}),
      bookings: bookings.map((b) => ({
        id: b.id,
        reference: b.reference,
        customer: b.user.name,
        seats: b.seats.map((s) => `${s.rowLabel}${s.seatNumber}`),
        amount: b.totalAmount,
        createdAt: b.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// All events belonging to the logged-in organiser, for their dashboard listing.
async function myEvents(req, res, next) {
  try {
    const events = await prisma.event.findMany({ where: { organiserId: req.user.id }, include: { venue: true } });
    res.json(events);
  } catch (err) {
    next(err);
  }
}

module.exports = { eventSummary, myEvents };
