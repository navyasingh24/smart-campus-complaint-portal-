import { Navigate, useLocation } from 'react-router-dom';
import { homePathFor, useAuth } from '../AuthContext.jsx';
import Spinner from './Spinner.jsx';

// Hides pages from users who are not logged in or have the wrong role.
// This is only for a good user experience: the real protection is on the
// server, which checks the session and role on every API request.
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking your session…" />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homePathFor(user)} replace />;
  return children;
}
