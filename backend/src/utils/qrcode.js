const QRCode = require('qrcode');

// Returns a PNG data URL encoding the booking reference. Embedded directly in the
// confirmation email as an inline (cid) attachment — see utils/email.js.
async function generateQrDataUrl(bookingReference) {
  return QRCode.toDataURL(bookingReference, { errorCorrectionLevel: 'M', margin: 2, width: 300 });
}

async function generateQrBuffer(bookingReference) {
  return QRCode.toBuffer(bookingReference, { errorCorrectionLevel: 'M', margin: 2, width: 300 });
}

module.exports = { generateQrDataUrl, generateQrBuffer };
