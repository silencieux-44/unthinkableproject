const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');

// Denormalises venue.seatLayout into one Seat row per seat for this event. Done once at
// event-creation time (not computed on the fly) so per-seat status/holds/bookings have
// somewhere to live and can be locked individually by seatHoldService.
function buildSeatRows(seatLayout) {
  const rows = [];
  const rowLabelForIndex = (i) => String.fromCharCode(65 + i); // 0 -> 'A', 1 -> 'B', ...

  for (let r = 0; r < seatLayout.rows; r++) {
    const rowLabel = rowLabelForIndex(r);
    const categoryForRow = seatLayout.categories.find((c) => c.rowLabels.includes(rowLabel));
    const category = categoryForRow ? categoryForRow.name : seatLayout.categories[0].name;
    for (let c = 1; c <= seatLayout.cols; c++) {
      rows.push({ rowLabel, seatNumber: c, category });
    }
  }
  return rows;
}

async function createEvent(req, res, next) {
  try {
    const { title, type, description, date, venueId, pricing } = req.body;
    if (!title || !type || !date || !venueId || !pricing) {
      throw new ApiError(400, 'title, type, date, venueId and pricing are required');
    }
    const venue = await prisma.venue.findUnique({ where: { id: venueId } });
    if (!venue) throw new ApiError(404, 'Venue not found');

    const event = await prisma.event.create({
      data: { title, type, description, date: new Date(date), venueId, organiserId: req.user.id, pricing },
    });

    const seatRows = buildSeatRows(venue.seatLayout).map((s) => ({ ...s, eventId: event.id }));
    await prisma.seat.createMany({ data: seatRows });

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

// Public browse + filter. Query params: type, from, to, search
async function listEvents(req, res, next) {
  try {
    const { type, from, to, search } = req.query;
    const where = {};
    if (type) where.type = type;
    if (from || to) where.date = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
    if (search) where.title = { contains: search, mode: 'insensitive' };

    const events = await prisma.event.findMany({
      where,
      include: { venue: true },
      orderBy: { date: 'asc' },
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
}

async function getEvent(req, res, next) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: { venue: true, seats: true },
    });
    if (!event) throw new ApiError(404, 'Event not found');
    res.json(event);
  } catch (err) {
    next(err);
  }
}

module.exports = { createEvent, listEvents, getEvent };
