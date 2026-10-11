import { Link, NavLink, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to={user ? homePathFor(user) : '/'} className="brand">
          <img src="/favicon.svg" alt="" width="28" height="28" />
          <span>Smart Campus</span>
        </Link>
        <nav className="nav-links">
          {user?.role === 'STUDENT' && (
            <>
              <NavLink to="/dashboard" end>My complaints</NavLink>
              <NavLink to="/complaints/new">New complaint</NavLink>
            </>
          )}
          {user?.role === 'ADMIN' && <NavLink to="/admin">Admin dashboard</NavLink>}
          {user ? (
            <>
              <span className="nav-user" title={user.email}>
                {user.name}
                <span className="role-tag">{user.role === 'ADMIN' ? 'Admin' : 'Student'}</span>
              </span>
              <button type="button" className="btn btn-outline btn-sm" onClick={handleLogout}>
                Log out
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Log in</NavLink>
              <Link to="/register" className="btn btn-primary btn-sm">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
