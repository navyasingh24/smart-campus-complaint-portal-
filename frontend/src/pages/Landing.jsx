import { Link, Navigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../AuthContext.jsx';

const features = [
  {
    title: 'Report in a minute',
    text: 'Describe the problem, pick a category such as Wi-Fi, hostel or electricity, and add a location.',
  },
  {
    title: 'Track every complaint',
    text: 'See whether your complaint is Pending, In Progress or Resolved, with dates for each update.',
  },
  {
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
        <h1>Campus problems, reported and resolved.</h1>
        <p>
          The Smart Campus Complaint Portal lets students report issues around campus and lets
          administrators manage them from a single dashboard — no more lost emails or paper forms.
        </p>
        <div className="hero-actions">
          <Link to="/register" className="btn btn-primary">Get started</Link>
          <Link to="/login" className="btn btn-outline">Log in</Link>
        </div>
      </section>

      <section className="feature-grid">
        {features.map((f) => (
          <div key={f.title} className="card feature">
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
