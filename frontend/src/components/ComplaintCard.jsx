import { categoryLabel, formatDate } from '../constants.js';
import StatusBadge from './StatusBadge.jsx';

export default function ComplaintCard({ complaint }) {
  return (
    <article className="card complaint-card">
      <div className="complaint-head">
        <h3>{complaint.title}</h3>
        <StatusBadge status={complaint.status} />
      </div>
      <p className="complaint-desc">{complaint.description}</p>
      <dl className="meta">
        <div>
          <dt>Category</dt>
          <dd>{categoryLabel(complaint.category)}</dd>
        </div>
        {complaint.location && (
          <div>
            <dt>Location</dt>
            <dd>{complaint.location}</dd>
          </div>
        )}
        <div>
          <dt>Submitted</dt>
          <dd>{formatDate(complaint.createdAt)}</dd>
        </div>
        <div>
          <dt>Last updated</dt>
          <dd>{formatDate(complaint.updatedAt)}</dd>
        </div>
      </dl>
      {complaint.adminNote && (
        <p className="admin-note">
          <strong>Note from administrator:</strong> {complaint.adminNote}
        </p>
      )}
    </article>
  );
}
