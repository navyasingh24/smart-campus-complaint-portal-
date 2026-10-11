import { Fragment, useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { CATEGORIES, STATUSES, categoryLabel, formatDate } from '../constants.js';
import Alert from '../components/Alert.jsx';
import BarChart from '../components/BarChart.jsx';
import Filters from '../components/Filters.jsx';
import Spinner from '../components/Spinner.jsx';
import StatCards from '../components/StatCards.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

function StatusEditor({ complaint, onSaved }) {
  const [status, setStatus] = useState(complaint.status);
  const [note, setNote] = useState(complaint.adminNote || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const unchanged = status === complaint.status && note === (complaint.adminNote || '');

  async function save() {
    setSaving(true);
    setError('');
    try {
      const data = await api.updateStatus(complaint.complaintId, status, note);
      onSaved(data.complaint);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="status-editor">
      <label>
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
      <label className="grow">
        Note to student <span className="optional">(optional)</span>
        <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="button" className="btn btn-primary" disabled={saving || unchanged} onClick={save}>
        {saving ? 'Saving…' : 'Update status'}
      </button>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

export default function AdminDashboard() {
  const [filters, setFilters] = useState({ status: '', category: '' });
  const [complaints, setComplaints] = useState([]);
  const [stats, setStats] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadStats = useCallback(() => {
    api
      .stats()
      .then((data) => setStats(data.stats))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(loadStats, [loadStats]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .allComplaints(filters)
      .then((data) => !cancelled && setComplaints(data.complaints))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function handleSaved(updated) {
    setComplaints((list) =>
      list
        .map((c) => (c.complaintId === updated.complaintId ? updated : c))
        .filter((c) => !filters.status || c.status === filters.status),
    );
    setSuccess(`"${updated.title}" is now ${updated.status.replace('_', ' ').toLowerCase()}.`);
    setExpanded(null);
    loadStats();
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <h1>Admin dashboard</h1>
          <p className="muted">Review, prioritise and resolve campus complaints.</p>
        </div>
      </div>

      <Alert type="success" onClose={() => setSuccess('')}>{success}</Alert>
      <Alert onClose={() => setError('')}>{error}</Alert>

      {stats ? (
        <>
          <StatCards total={stats.total} byStatus={stats.byStatus} />
          <div className="chart-grid">
            <BarChart
              title="Complaints by status"
              data={STATUSES.map((s) => ({
                label: s.label,
                value: stats.byStatus[s.value],
                tone: s.value.toLowerCase(),
              }))}
            />
            <BarChart
              title="Complaints by category"
              data={CATEGORIES.map((c) => ({ label: c.label, value: stats.byCategory[c.value] }))}
            />
          </div>
        </>
      ) : (
        !error && <Spinner label="Loading statistics…" />
      )}

      <section className="card table-card">
        <div className="table-head">
          <h2>All complaints</h2>
          <Filters filters={filters} onChange={setFilters} />
        </div>
        {loading ? (
          <Spinner label="Loading complaints…" />
        ) : complaints.length === 0 ? (
          <p className="empty">No complaints match these filters.</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Complaint</th>
                  <th>Category</th>
                  <th>Student</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {complaints.map((c) => (
                  <Fragment key={c.complaintId}>
                    <tr>
                      <td data-label="Complaint">
                        <div>
                          <strong>{c.title}</strong>
                          {c.location && <div className="muted small">{c.location}</div>}
                        </div>
                      </td>
                      <td data-label="Category">{categoryLabel(c.category)}</td>
                      <td data-label="Student">
                        <div>
                          {c.studentName}
                          <div className="muted small">{c.studentEmail}</div>
                        </div>
                      </td>
                      <td data-label="Submitted">{formatDate(c.createdAt)}</td>
                      <td data-label="Status"><StatusBadge status={c.status} /></td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          aria-expanded={expanded === c.complaintId}
                          onClick={() => setExpanded(expanded === c.complaintId ? null : c.complaintId)}
                        >
                          {expanded === c.complaintId ? 'Close' : 'Manage'}
                        </button>
                      </td>
                    </tr>
                    {expanded === c.complaintId && (
                      <tr className="detail-row">
                        <td colSpan={6}>
                          <p className="complaint-desc">{c.description}</p>
                          <p className="muted small">
                            Complaint ID {c.complaintId} · Last updated {formatDate(c.updatedAt)}
                          </p>
                          <StatusEditor complaint={c} onSaved={handleSaved} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
