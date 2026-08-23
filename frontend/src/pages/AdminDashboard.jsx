import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

// Admin builds a venue's seat layout as a simple rows x cols grid, then assigns which row
// letters belong to which category. Kept intentionally simple (2 categories) for this scope;
// the underlying seatLayout JSON supports any number of categories.
export default function AdminDashboard() {
  const { token } = useAuth();
  const [venues, setVenues] = useState([]);
  const [form, setForm] = useState({ name: '', address: '', rows: 6, cols: 10, premiumRows: 'A,B', standardRows: 'C,D,E,F' });
  const [error, setError] = useState('');

  async function load() {
    setVenues(await api.listVenues(token));
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    try {
      const seatLayout = {
        rows: Number(form.rows),
        cols: Number(form.cols),
        categories: [
          { name: 'Premium', rowLabels: form.premiumRows.split(',').map((s) => s.trim().toUpperCase()) },
          { name: 'Standard', rowLabels: form.standardRows.split(',').map((s) => s.trim().toUpperCase()) },
        ],
      };
      await api.createVenue({ name: form.name, address: form.address, seatLayout }, token);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app-shell">
      <h1>Admin dashboard</h1>
      <div className="card">
        <h3>Create venue</h3>
        <form onSubmit={handleCreate}>
          <label>Name</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <label>Address</label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
          <label>Rows</label>
          <input type="number" value={form.rows} onChange={(e) => setForm({ ...form, rows: e.target.value })} required />
          <label>Seats per row</label>
          <input type="number" value={form.cols} onChange={(e) => setForm({ ...form, cols: e.target.value })} required />
          <label>Premium row letters (comma-separated)</label>
          <input value={form.premiumRows} onChange={(e) => setForm({ ...form, premiumRows: e.target.value })} />
          <label>Standard row letters (comma-separated)</label>
          <input value={form.standardRows} onChange={(e) => setForm({ ...form, standardRows: e.target.value })} />
          {error && <p className="error-text">{error}</p>}
          <button className="btn primary" type="submit">Create venue</button>
        </form>
      </div>
      <div className="card">
        <h3>Venues</h3>
        {venues.map((v) => <p key={v.id}>{v.name} — {v.address} ({v.seatLayout.rows}x{v.seatLayout.cols})</p>)}
      </div>
    </div>
  );
}
