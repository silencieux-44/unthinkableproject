require('dotenv').config();

module.exports = {
  port: process.env.PORT || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  seatHoldTtlSeconds: parseInt(process.env.SEAT_HOLD_TTL_SECONDS || '600', 10),
  waitlistOfferTtlSeconds: parseInt(process.env.WAITLIST_OFFER_TTL_SECONDS || '1800', 10),
  sweeperIntervalSeconds: parseInt(process.env.SWEEPER_INTERVAL_SECONDS || '30', 10),
  emailMode: process.env.EMAIL_MODE || 'ethereal',
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  emailFrom: process.env.EMAIL_FROM || 'Ticket Booking <no-reply@ticketbooking.dev>',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
