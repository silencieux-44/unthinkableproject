const nodemailer = require('nodemailer');
const { emailMode, smtp, emailFrom } = require('../config/env');

let transporterPromise = null;

// Lazily builds a transporter. In EMAIL_MODE=ethereal (default, no real credentials needed)
// this creates a throwaway inbox via Ethereal so the full email flow is testable locally/CI
// without any signup. Swap EMAIL_MODE=smtp + fill SMTP_* env vars for a real provider
// (Gmail App Password, SendGrid, Mailgun free tier — all drop-in compatible).
function getTransporter() {
  if (transporterPromise) return transporterPromise;

  if (emailMode === 'smtp') {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.port === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      })
    );
  } else {
    transporterPromise = nodemailer.createTestAccount().then((testAccount) =>
      nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: testAccount.user, pass: testAccount.pass },
      })
    );
  }
  return transporterPromise;
}

async function sendMail({ to, subject, html, attachments }) {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({ from: emailFrom, to, subject, html, attachments });

  if (emailMode !== 'smtp') {
    // eslint-disable-next-line no-console
    console.log(`[email:ethereal] Preview URL for "${subject}" -> ${nodemailer.getTestMessageUrl(info)}`);
  }
  return info;
}

async function sendBookingConfirmation({ to, name, booking, qrBuffer }) {
  const seatList = booking.seats.map((s) => `${s.rowLabel}${s.seatNumber} (${s.category})`).join(', ');
  await sendMail({
    to,
    subject: `Your ticket is confirmed — ${booking.reference}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2>You're in, ${name}! 🎟️</h2>
        <p>Booking reference: <strong>${booking.reference}</strong></p>
        <p>Seats: ${seatList}</p>
        <p>Total paid: ₹${booking.totalAmount}</p>
        <p>Show this QR code at entry:</p>
        <img src="cid:qr-code" alt="QR ticket" style="width:220px;height:220px;" />
      </div>
    `,
    attachments: [{ filename: 'ticket-qr.png', content: qrBuffer, cid: 'qr-code' }],
  });
}

async function sendWaitlistOffer({ to, name, event, category, offerUrl, minutesRemaining }) {
  await sendMail({
    to,
    subject: `A seat opened up — ${event.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px;">
        <h2>Hey ${name}, a ${category} seat is available!</h2>
        <p>Someone cancelled their booking for <strong>${event.title}</strong> and you're next on the waitlist.</p>
        <p>Claim it within <strong>${minutesRemaining} minutes</strong> or it goes to the next person in line:</p>
        <p><a href="${offerUrl}" style="background:#c9a227;color:#111;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold;">Complete my booking</a></p>
      </div>
    `,
  });
}

module.exports = { sendMail, sendBookingConfirmation, sendWaitlistOffer };
