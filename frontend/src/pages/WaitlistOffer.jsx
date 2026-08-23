import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function WaitlistOffer() {
  const { token } = useParams();
  const { token: authToken, user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getOffer(token).then(setData).catch((err) => setError(err.message));
  }, [token]);

  async function handleClaim() {
    if (!user) { navigate('/login'); return; }
    try {
      const booking = await api.claimOffer(token, authToken);
      alert(`Booked! Reference: ${booking.reference}`);
      navigate('/bookings');
    } catch (err) {
      setError(err.message);
    }
  }

  if (error) return <div className="app-shell"><p className="error-text">{error}</p></div>;
  if (!data) return <div className="app-shell"><p className="muted">Loading...</p></div>;

  return (
    <div className="app-shell" style={{ maxWidth: 480 }}>
      <div className="card stub">
        <h2>A seat opened up!</h2>
        <p>{data.event.title} — {data.seat.rowLabel}{data.seat.seatNumber} ({data.seat.category})</p>
        <p className="muted">Offer expires: {new Date(data.entry.offerExpiresAt).toLocaleString()}</p>
        <button className="btn primary" onClick={handleClaim}>Claim this seat</button>
      </div>
    </div>
  );
}
