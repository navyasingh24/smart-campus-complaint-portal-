import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../AuthContext.jsx';
import Alert from '../components/Alert.jsx';

function validate({ name, email, password, confirm }) {
  const errors = {};
  if (name.trim().length < 2) errors.name = 'Please enter your full name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email address';
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'At least 8 characters, including a letter and a number';
  }
  if (confirm !== password) errors.confirm = 'Passwords do not match';
  return errors;
}

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePathFor(user)} replace />;

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await register(form.name, form.email, form.password);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
      if (err.details) setFieldErrors(err.details);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container narrow">
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <h1>Create a student account</h1>
        <Alert onClose={() => setError('')}>{error}</Alert>
        <label>
          Full name
          <input autoComplete="name" value={form.name} onChange={set('name')} />
          {fieldErrors.name && <span className="field-error">{fieldErrors.name}</span>}
        </label>
        <label>
          College email
          <input type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
        </label>
        <label>
          Password
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
          {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
        </label>
        <label>
          Confirm password
          <input
            type="password"
            autoComplete="new-password"
            value={form.confirm}
            onChange={set('confirm')}
          />
          {fieldErrors.confirm && <span className="field-error">{fieldErrors.confirm}</span>}
        </label>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Register'}
        </button>
        <p className="muted center">
          Already registered? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}
