import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="navbar">
      <Link to="/" className="brand">Marquee<span>.</span></Link>
      <nav>
        <Link to="/">Events</Link>
        {user && <Link to="/bookings">My Bookings</Link>}
        {user && (user.role === 'ORGANISER' || user.role === 'ADMIN') && <Link to="/organiser">Organiser</Link>}
        {user && user.role === 'ADMIN' && <Link to="/admin">Admin</Link>}
        {!user && <Link to="/login">Login</Link>}
        {!user && <Link to="/register">Register</Link>}
        {user && (
          <a href="#" onClick={(e) => { e.preventDefault(); logout(); navigate('/'); }}>
            Logout ({user.name})
          </a>
        )}
      </nav>
    </div>
  );
}
