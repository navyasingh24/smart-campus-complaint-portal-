import { statusLabel } from '../constants.js';

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{statusLabel(status)}</span>;
}
