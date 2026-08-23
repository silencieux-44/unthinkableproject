import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function OrganiserDashboard() {
  const { token } = useAuth();
  const [events, setEvents] = useState([]);
  const [venues, setVenues] = useState([]);
  const [summary, setSummary] = useState(null);
  const [form, setForm] = useState({ title: '', type: 'MOVIE', description: '', date: '', venueId: '', premiumPrice: '', standardPrice: '' });
  const [error, setError] = useState('');

  async function load() {
    setEvents(await api.myEvents(token));
    setVenues(await api.listVenues(token));
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      await api.createEvent({
        title: form.title,
        type: form.type,
        description: form.description,
        date: form.date,
        venueId: form.venueId,
        pricing: { Premium: Number(form.premiumPrice) || 0, Standard: Number(form.standardPrice) || 0 },
      }, token);
      setForm({ title: '', type: 'MOVIE', description: '', date: '', venueId: '', premiumPrice: '', standardPrice: '' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function viewSummary(eventId) {
    setSummary(await api.eventSummary(eventId, token));
  }

  return (
    <div className="app-shell">
      <h1>Organiser dashboard</h1>

      <div className="card">
        <h3>Create event</h3>
        <form onSubmit={handleCreate}>
          <label>Title</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <label>Type</label>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="MOVIE">Movie</option>
            <option value="CONCERT">Concert</option>
          </select>
          <label>Description</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label>Date & time</label>
          <input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
          <label>Venue</label>
          <select value={form.venueId} onChange={(e) => setForm({ ...form, venueId: e.target.value })} required>
            <option value="">Select a venue</option>
            {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
          <label>Premium price (₹)</label>
          <input type="number" value={form.premiumPrice} onChange={(e) => setForm({ ...form, premiumPrice: e.target.value })} required />
          <label>Standard price (₹)</label>
          <input type="number" value={form.standardPrice} onChange={(e) => setForm({ ...form, standardPrice: e.target.value })} required />
          {error && <p className="error-text">{error}</p>}
          <button className="btn primary" type="submit">Create event</button>
        </form>
      </div>

      <div className="card">
        <h3>My events</h3>
        {events.map((ev) => (
          <p key={ev.id}>
            {ev.title} — {ev.venue.name} — <a href="#" onClick={(e) => { e.preventDefault(); viewSummary(ev.id); }}>View summary</a>
          </p>
        ))}
      </div>

      {summary && (
        <div className="card">
          <h3>{summary.event.title} — summary</h3>
          <p>Revenue: ₹{summary.revenue} — Seats sold: {summary.seatsSold} — Bookings: {summary.totalBookings}</p>
          <table className="table">
            <thead><tr><th>Reference</th><th>Customer</th><th>Seats</th><th>Amount</th></tr></thead>
            <tbody>
              {summary.bookings.map((b) => (
                <tr key={b.id}><td>{b.reference}</td><td>{b.customer}</td><td>{b.seats.join(', ')}</td><td>₹{b.amount}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
