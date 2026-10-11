import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { CATEGORIES } from '../constants.js';
import Alert from '../components/Alert.jsx';

function validate({ title, description, category, location }) {
  const errors = {};
  if (title.trim().length < 5 || title.trim().length > 120) {
    errors.title = 'Title must be between 5 and 120 characters';
  }
  if (description.trim().length < 10 || description.trim().length > 2000) {
    errors.description = 'Description must be between 10 and 2000 characters';
  }
  if (!category) errors.category = 'Please choose a category';
  if (location.trim().length > 120) errors.location = 'Location must be at most 120 characters';
  return errors;
}

export default function NewComplaint() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', description: '', category: '', location: '' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      await api.createComplaint(form);
      navigate('/dashboard', { state: { success: 'Your complaint was submitted successfully.' } });
    } catch (err) {
      setError(err.message);
      if (err.details) setFieldErrors(err.details);
      setSubmitting(false);
    }
  }

  return (
    <div className="container narrow-wide">
      <form className="card form" onSubmit={handleSubmit} noValidate>
        <h1>Submit a complaint</h1>
        <p className="muted">Give enough detail for the maintenance team to find and fix the problem.</p>
        <Alert onClose={() => setError('')}>{error}</Alert>

        <label>
          Title
          <input value={form.title} onChange={set('title')} maxLength={120} placeholder="e.g. Wi-Fi not working in Lab 3" />
          {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
        </label>

        <label>
          Category
          <select value={form.category} onChange={set('category')}>
            <option value="">Select a category</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
        </label>

        <label>
          Location <span className="optional">(optional)</span>
          <input value={form.location} onChange={set('location')} maxLength={120} placeholder="e.g. Block B, Room 204" />
          {fieldErrors.location && <span className="field-error">{fieldErrors.location}</span>}
        </label>

        <label>
          Description
          <textarea
            rows={6}
            value={form.description}
            onChange={set('description')}
            maxLength={2000}
            placeholder="What is the problem, since when, and how does it affect you?"
          />
          <span className="char-count">{form.description.length}/2000</span>
          {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
        </label>

        <div className="form-actions">
          <Link to="/dashboard" className="btn btn-outline">Cancel</Link>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit complaint'}
          </button>
        </div>
      </form>
    </div>
  );
}
