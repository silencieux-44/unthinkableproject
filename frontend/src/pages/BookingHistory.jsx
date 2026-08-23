import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function BookingHistory() {
  const { token } = useAuth();
  const [bookings, setBookings] = useState([]);

  async function load() {
    setBookings(await api.bookingHistory(token));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCancel(id) {
    if (!confirm('Cancel this booking? The seat(s) will be released to the waitlist.')) return;
    await api.cancelBooking(id, token);
    load();
  }

  return (
    <div className="app-shell">
      <h1>My bookings</h1>
      {bookings.map((b) => (
        <div className="card stub" key={b.id}>
          <h3>{b.event.title}</h3>
          <p className="muted">{b.event.venue.name} — {new Date(b.event.date).toLocaleString()}</p>
          <p>Reference: <strong>{b.reference}</strong> — Status: {b.status}</p>
          <p>Seats: {b.seats.map((s) => `${s.rowLabel}${s.seatNumber}`).join(', ') || '—'}</p>
          <p>Total: ₹{b.totalAmount}</p>
          {b.status === 'CONFIRMED' && <button className="btn danger" onClick={() => handleCancel(b.id)}>Cancel booking</button>}
        </div>
      ))}
      {bookings.length === 0 && <p className="muted">No bookings yet.</p>}
    </div>
  );
}
