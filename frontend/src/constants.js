// Must match backend/src/constants.js.
export const CATEGORIES = [
  { value: 'WIFI', label: 'Wi-Fi' },
  { value: 'CLASSROOM', label: 'Classroom' },
  { value: 'HOSTEL', label: 'Hostel' },
  { value: 'ELECTRICITY', label: 'Electricity' },
  { value: 'SANITATION', label: 'Sanitation' },
  { value: 'OTHER', label: 'Other' },
];

export const STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
];

export const categoryLabel = (value) => CATEGORIES.find((c) => c.value === value)?.label ?? value;
export const statusLabel = (value) => STATUSES.find((s) => s.value === value)?.label ?? value;

export function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
