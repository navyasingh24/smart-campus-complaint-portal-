import { CATEGORIES, STATUSES } from '../constants.js';

export default function Filters({ filters, onChange }) {
  const update = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  const hasFilters = filters.status || filters.category;

  return (
    <div className="filters">
      <label>
        Status
        <select value={filters.status} onChange={update('status')}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </label>
      <label>
        Category
        <select value={filters.category} onChange={update('category')}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>
      {hasFilters && (
        <button
          type="button"
          className="btn btn-link"
          onClick={() => onChange({ status: '', category: '' })}
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
