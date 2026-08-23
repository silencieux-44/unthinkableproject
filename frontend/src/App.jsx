import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Events from './pages/Events';
import EventDetail from './pages/EventDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import BookingHistory from './pages/BookingHistory';
import OrganiserDashboard from './pages/OrganiserDashboard';
import AdminDashboard from './pages/AdminDashboard';
import WaitlistOffer from './pages/WaitlistOffer';
import { useAuth } from './context/AuthContext';

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-shell"><p className="muted">Loading...</p></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/waitlist-offer/:token" element={<WaitlistOffer />} />
        <Route path="/bookings" element={<Protected><BookingHistory /></Protected>} />
        <Route path="/organiser" element={<Protected roles={['ORGANISER', 'ADMIN']}><OrganiserDashboard /></Protected>} />
        <Route path="/admin" element={<Protected roles={['ADMIN']}><AdminDashboard /></Protected>} />
      </Routes>
    </>
  );
}
