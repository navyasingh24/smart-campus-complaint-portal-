import { Link, Navigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../AuthContext.jsx';
import { CATEGORIES } from '../constants.js';
import { IconSend, IconShield, IconTrack } from '../components/Icons.jsx';

const features = [
  {
    icon: IconSend,
    title: 'Report in a minute',
    text: 'Describe the problem, pick a category such as Wi-Fi, hostel or electricity, and add a location.',
  },
  {
    icon: IconTrack,
    title: 'Track every complaint',
    text: 'See whether your complaint is Pending, In Progress or Resolved, with dates for each update.',
  },
  {
    icon: IconShield,
    title: 'Faster resolution',
    text: 'Administrators see all complaints in one dashboard, filter them and update their status.',
  },
];

const steps = ['Create a student account', 'Submit your complaint', 'Follow its status until resolved'];

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to={homePathFor(user)} replace />;

  return (
    <div className="container">
      <section className="hero">
        <span className="eyebrow">Smart Campus · Complaint Portal</span>
        <h1>
          Campus problems, <span className="gradient-text">reported and resolved.</span>
        </h1>
        <p>
          The Smart Campus Complaint Portal lets students report issues around campus and lets
          administrators manage them from a single dashboard — no more lost emails or paper forms.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-primary">Get started</Link>
          <Link to="/login" className="btn btn-outline">Log in</Link>
        </div>
        <ul className="chip-row" aria-label="Complaint categories">
          {CATEGORIES.map((c) => (
            <li key={c.value} className="chip">{c.label}</li>
          ))}
        </ul>
      </section>

      <section className="feature-grid">
        {features.map((f) => (
          <div key={f.title} className="card feature">
            <span className="feature-icon"><f.icon size={22} /></span>
            <h3>{f.title}</h3>
            <p>{f.text}</p>
          </div>
        ))}
      </section>

      <section className="card how">
        <h2>How it works</h2>
        <ol className="steps">
          {steps.map((s, i) => (
            <li key={s}>
              <span className="step-num">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
