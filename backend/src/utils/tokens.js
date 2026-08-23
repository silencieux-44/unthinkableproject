const crypto = require('crypto');

// Generates an opaque, unguessable token used for time-limited waitlist offer links.
// Deliberately not a JWT: it's a single-use, DB-checked capability token, not a claims token.
function generateOfferToken() {
  return crypto.randomBytes(24).toString('hex');
}

// Human-readable + collision-resistant booking reference, also encoded into the QR code.
function generateBookingReference() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `TBS-${stamp}-${rand}`;
}

module.exports = { generateOfferToken, generateBookingReference };
