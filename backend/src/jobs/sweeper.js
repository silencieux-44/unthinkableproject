const cron = require('node-cron');
const { releaseExpiredHolds } = require('../services/seatHoldService');
const { sweepExpiredOffers, offerSeatToNextInLine } = require('../services/waitlistService');
const { sweeperIntervalSeconds } = require('../config/env');

// Background sweeper: the single source of truth for "time has passed" side-effects.
// 1. Releases seat holds whose TTL expired (abandoned checkouts) — then checks each one's
//    category for a waiting queue, since an abandoned hold is functionally a freed seat.
// 2. Expires waitlist offers whose claim window ran out, cascading to the next person.
// Runs on a fixed interval rather than per-seat setTimeouts so it survives server restarts
// and scales to any number of concurrent holds without spawning timers.
function startSweeper(io) {
  const cronExpr = `*/${sweeperIntervalSeconds} * * * * *`; // every N seconds

  cron.schedule(cronExpr, async () => {
    try {
      const releasedHolds = await releaseExpiredHolds();
      for (const seat of releasedHolds) {
        io.to(`event:${seat.eventId}`).emit('seat:status', { seatId: seat.id, status: 'AVAILABLE' });
      }

      const expiredOffers = await sweepExpiredOffers();
      for (const entry of expiredOffers) {
        io.to(`event:${entry.eventId}`).emit('seat:status', { seatId: entry.offeredSeatId, status: 'AVAILABLE' });
      }
    } catch (err) {
      console.error('[sweeper] error during sweep:', err);
    }
  });

  console.log(`[sweeper] scheduled every ${sweeperIntervalSeconds}s`);
}

module.exports = { startSweeper };
