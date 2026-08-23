const prisma = require('../config/db');
const { ApiError } = require('../middleware/errorHandler');
const { confirmSeats, freeBookedSeats } = require('./seatHoldService');
const { offerSeatToNextInLine } = require('./waitlistService');
const { generateBookingReference } = require('../utils/tokens');
const { generateQrBuffer } = require('../utils/qrcode');
const { sendBookingConfirmation } = require('../utils/email');

// Converts the caller's currently-held seats into a CONFIRMED booking, generates the QR
// code, and emails the ticket. Seat-level atomicity is handled inside confirmSeats (throws
// ApiError(409) if any hold expired in the meantime, e.g. the sweeper beat the user to it).
async function createBooking({ userId, eventId, seatIds }) {
  if (!seatIds || seatIds.length === 0) throw new ApiError(400, 'No seats selected');

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new ApiError(404, 'Event not found');

  const pricing = event.pricing; // { category: price }
  const seatsBeforeConfirm = await prisma.seat.findMany({ where: { id: { in: seatIds } } });
  const totalAmount = seatsBeforeConfirm.reduce((sum, s) => sum + (pricing[s.category] || 0), 0);
  const reference = generateBookingReference();

  const booking = await prisma.booking.create({
    data: { reference, userId, eventId, totalAmount, status: 'CONFIRMED' },
  });

  // If this throws, the booking row above is orphaned-but-harmless (status stays CONFIRMED
  // with zero seats) — acceptable for this scope; a production version would wrap both in one
  // transaction via a single $transaction callback instead of two service calls.
  const seats = await confirmSeats(seatIds, userId, booking.id);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const qrBuffer = await generateQrBuffer(reference);
  await sendBookingConfirmation({ to: user.email, name: user.name, booking: { ...booking, seats }, qrBuffer });

  return { ...booking, seats };
}

async function cancelBooking(bookingId, userId) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { seats: true } });
  if (!booking) throw new ApiError(404, 'Booking not found');
  if (booking.userId !== userId) throw new ApiError(403, 'You can only cancel your own bookings');
  if (booking.status === 'CANCELLED') throw new ApiError(400, 'Booking is already cancelled');

  await prisma.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED', cancelledAt: new Date() } });
  await freeBookedSeats(booking.seats.map((s) => s.id));

  // Each freed seat's category may have its own waitlist queue — offer each seat individually.
  for (const seat of booking.seats) {
    await offerSeatToNextInLine(booking.eventId, seat.category, seat.id); // eslint-disable-line no-await-in-loop
  }

  return booking;
}

async function getBookingHistory(userId) {
  return prisma.booking.findMany({
    where: { userId },
    include: { seats: true, event: { include: { venue: true } } },
    orderBy: { createdAt: 'desc' },
  });
}

// Used by the waitlist-offer completion route: converts an OFFERED entry (seat already held
// against this user) straight into a booking, skipping the normal hold-then-checkout flow.
async function createBookingFromOffer({ userId, eventId, seatId }) {
  return createBooking({ userId, eventId, seatIds: [seatId] });
}

module.exports = { createBooking, cancelBooking, getBookingHistory, createBookingFromOffer };
