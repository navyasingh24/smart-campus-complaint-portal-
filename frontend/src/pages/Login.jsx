import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../AuthContext.jsx';
import Alert from '../components/Alert.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePathFor(user)} replace />;

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedIn = await login(form.email, form.password);
      const wanted = location.state?.from;
      const allowed = loggedIn.role === 'ADMIN' ? wanted === '/admin' : wanted && wanted !== '/admin';
      navigate(allowed ? wanted : homePathFor(loggedIn), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container narrow">
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <h1>Log in</h1>
        <p className="muted">Students and administrators log in here.</p>
        <Alert onClose={() => setError('')}>{error}</Alert>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
        <p className="muted center">
          New student? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </div>
  );
}
