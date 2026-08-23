import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Events() {
  const [events, setEvents] = useState([]);
  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (search) params.set('search', search);
    const query = params.toString() ? `?${params}` : '';
    const data = await api.listEvents(query);
    setEvents(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="app-shell">
      <h1>What's on</h1>
      <div className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <label>Search</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()} placeholder="Search events..." />
        </div>
        <div style={{ width: 160 }}>
          <label>Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            <option value="MOVIE">Movie</option>
            <option value="CONCERT">Concert</option>
          </select>
        </div>
        <button className="btn" onClick={load} style={{ marginBottom: 12 }}>Filter</button>
      </div>

      {loading ? <p className="muted">Loading...</p> : (
        <div className="event-grid">
          {events.map((ev) => (
            <Link to={`/events/${ev.id}`} key={ev.id} className="card event-card">
              <span className="badge">{ev.type}</span>
              <h3>{ev.title}</h3>
              <p className="muted">{ev.venue.name}</p>
              <p className="muted">{new Date(ev.date).toLocaleString()}</p>
            </Link>
          ))}
          {events.length === 0 && <p className="muted">No events match your filters.</p>}
        </div>
      )}
    </div>
  );
}
