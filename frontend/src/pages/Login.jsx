import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      const { token, user } = await api.login({ email, password });
      loginWithToken(token, user);
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="app-shell" style={{ maxWidth: 420 }}>
      <h2>Welcome back</h2>
      <form onSubmit={handleSubmit} className="card">
        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        <label>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
        {error && <p className="error-text">{error}</p>}
        <button className="btn primary" type="submit">Log in</button>
      </form>
      <p className="muted">No account? <Link to="/register">Register here</Link></p>
      <p className="muted" style={{ fontSize: '0.8rem' }}>
        Demo logins (after seeding): customer@ticketbooking.dev / organiser@ticketbooking.dev / admin@ticketbooking.dev — password123
      </p>
    </div>
  );
}
