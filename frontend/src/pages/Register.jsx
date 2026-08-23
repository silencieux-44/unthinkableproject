import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CUSTOMER' });
  const [error, setError] = useState('');
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token, user } = await api.register(form);
      loginWithToken(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app-shell" style={{ maxWidth: 420 }}>
      <h2>Create an account</h2>
      <form onSubmit={handleSubmit} className="card">
        <label>Name</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        <label>Email</label>
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} type="email" required />
        <label>Password</label>
        <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" required />
        <label>Account type</label>
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="CUSTOMER">Customer</option>
          <option value="ORGANISER">Organiser</option>
        </select>
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary" type="submit">Register</button>
      </form>
      <p className="muted">Already have an account? <Link to="/login">Log in</Link></p>
    </div>
  );
}
