import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, API_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import SeatMap from '../components/SeatMap';
import Timer from '../components/Timer';

export default function EventDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [seats, setSeats] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [heldUntil, setHeldUntil] = useState(null);
  const [error, setError] = useState('');
  const [booking, setBooking] = useState(null);

  useEffect(() => {
    api.getEvent(id).then((ev) => { setEvent(ev); setSeats(ev.seats); });

    const socket = io(API_URL);
    socket.emit('event:join', id);
    socket.on('seat:status', ({ seatId, status }) => {
      setSeats((prev) => prev.map((s) => (s.id === seatId ? { ...s, status } : s)));
    });
    socket.on('seat:bulk-status', (updates) => {
      setSeats((prev) => prev.map((s) => {
        const match = updates.find((u) => u.seatId === s.id);
        return match ? { ...s, status: match.status } : s;
      }));
    });
    return () => { socket.emit('event:leave', id); socket.disconnect(); };
  }, [id]);

  const categoryAvailability = useMemo(() => {
    const byCategory = {};
    for (const s of seats) {
      byCategory[s.category] ||= { total: 0, available: 0 };
      byCategory[s.category].total += 1;
      if (s.status === 'AVAILABLE') byCategory[s.category].available += 1;
    }
    return byCategory;
  }, [seats]);

  function toggleSeat(seat) {
    if (!user) { navigate('/login'); return; }
    if (seat.status !== 'AVAILABLE' && !selected.has(seat.id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(seat.id) ? next.delete(seat.id) : next.add(seat.id);
      return next;
    });
  }

  async function handleHold() {
    setError('');
    try {
      const { seats: held, heldUntil: expiry } = await api.holdSeats({ eventId: id, seatIds: [...selected] }, token);
      setSeats((prev) => prev.map((s) => held.find((h) => h.id === s.id) ? { ...s, status: 'HELD' } : s));
      setHeldUntil(expiry);
    } catch (err) {
      setError(err.message);
      // Refresh seat state since our selection may now be stale
      api.getEvent(id).then((ev) => setSeats(ev.seats));
    }
  }

  async function handleConfirm() {
    setError('');
    try {
      const result = await api.confirmBooking({ eventId: id, seatIds: [...selected] }, token);
      setBooking(result);
      setSelected(new Set());
      setHeldUntil(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleExpire() {
    setHeldUntil(null);
    await api.getEvent(id).then((ev) => setSeats(ev.seats));
    setSelected(new Set());
    setError('Your seat hold expired — please reselect.');
  }

  async function handleAbandon() {
    await api.releaseSeats({ eventId: id, seatIds: [...selected] }, token);
    setHeldUntil(null);
    setSelected(new Set());
  }

  async function handleJoinWaitlist(category) {
    try {
      await api.joinWaitlist({ eventId: id, category }, token);
      alert(`You're on the waitlist for ${category}. We'll email you if a seat opens up.`);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!event) return <div className="app-shell"><p className="muted">Loading...</p></div>;

  if (booking) {
    return (
      <div className="app-shell" style={{ maxWidth: 480 }}>
        <div className="card stub">
          <h2>You're booked! 🎟️</h2>
          <p>Reference: <strong>{booking.reference}</strong></p>
          <p className="muted">A confirmation email with your QR ticket is on its way.</p>
          <button className="btn primary" onClick={() => navigate('/bookings')}>View my bookings</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <h1>{event.title}</h1>
      <p className="muted">{event.venue.name} — {new Date(event.date).toLocaleString()}</p>
      <p>{event.description}</p>

      <div className="card">
        <h3>Pricing & availability</h3>
        {Object.entries(event.pricing).map(([category, price]) => {
          const avail = categoryAvailability[category] || { total: 0, available: 0 };
          return (
            <p key={category}>
              {category}: ₹{price} — {avail.available}/{avail.total} available
              {avail.available === 0 && (
                <button className="btn" style={{ marginLeft: 12 }} onClick={() => handleJoinWaitlist(category)}>Join waitlist</button>
              )}
            </p>
          );
        })}
      </div>

      {heldUntil && <Timer expiresAt={heldUntil} onExpire={handleExpire} />}
      {error && <p className="error-text">{error}</p>}

      <SeatMap seats={seats} selected={selected} onToggle={toggleSeat} />

      <div className="card" style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        {!heldUntil ? (
          <button className="btn primary" disabled={selected.size === 0} onClick={handleHold}>
            Hold {selected.size} seat{selected.size !== 1 ? 's' : ''}
          </button>
        ) : (
          <>
            <button className="btn primary" onClick={handleConfirm}>Confirm & pay</button>
            <button className="btn danger" onClick={handleAbandon}>Release seats</button>
          </>
        )}
      </div>
    </div>
  );
}
