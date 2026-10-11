import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../AuthContext.jsx';
import Alert from '../components/Alert.jsx';
import ComplaintCard from '../components/ComplaintCard.jsx';
import Filters from '../components/Filters.jsx';
import Spinner from '../components/Spinner.jsx';
import StatCards from '../components/StatCards.jsx';

export default function StudentDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [complaints, setComplaints] = useState([]);
  const [allComplaints, setAllComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(location.state?.success || '');

  // Clear the one-time success message from browser history.
  useEffect(() => {
    if (location.state?.success) navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const hasFilters = filters.status || filters.category;
    Promise.all([api.myComplaints(filters), hasFilters ? api.myComplaints() : null])
      .then(([filtered, all]) => {
        if (cancelled) return;
        setComplaints(filtered.complaints);
        setAllComplaints(all ? all.complaints : filtered.complaints);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const summary = useMemo(() => {
    const byStatus = { PENDING: 0, IN_PROGRESS: 0, RESOLVED: 0 };
    allComplaints.forEach((c) => {
      byStatus[c.status] += 1;
    });
    return { total: allComplaints.length, byStatus };
  }, [allComplaints]);

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>My complaints</h1>
          <p className="muted">Welcome back, {user.name}. Track the progress of your complaints here.</p>
        </div>
        <Link to="/complaints/new" className="btn btn-primary">+ New complaint</Link>
      </div>

      <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>
      <Alert onClose={() => setError('')}>{error}</Alert>

      <StatCards total={summary.total} byStatus={summary.byStatus} />
      <Filters filters={filters} onChange={setFilters} />

      {loading ? (
        <Spinner label="Loading your complaints…" />
      ) : complaints.length === 0 ? (
        <div className="card empty">
          {allComplaints.length === 0 ? (
            <>
              <p>You have not submitted any complaints yet.</p>
              <Link to="/complaints/new" className="btn btn-primary">Submit your first complaint</Link>
            </>
          ) : (
            <p>No complaints match these filters.</p>
          )}
        </div>
      ) : (
        <div className="complaint-list">
          {complaints.map((c) => (
            <ComplaintCard key={c.complaintId} complaint={c} />
          ))}
        </div>
      )}
    </div>
  );
}
