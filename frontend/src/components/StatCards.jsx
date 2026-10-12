import { IconCheck, IconClock, IconLayers, IconProgress } from './Icons.jsx';

export default function StatCards({ total, byStatus }) {
  const cards = [
    { label: 'Total', value: total, tone: 'total', icon: IconLayers },
    { label: 'Pending', value: byStatus.PENDING, tone: 'pending', icon: IconClock },
    { label: 'In Progress', value: byStatus.IN_PROGRESS, tone: 'in_progress', icon: IconProgress },
    { label: 'Resolved', value: byStatus.RESOLVED, tone: 'resolved', icon: IconCheck },
  ];
  return (
    <div className="stat-grid">
      {cards.map((card) => (
        <div key={card.label} className={`stat-card stat-${card.tone}`}>
          <span className="stat-top">
            <span className="stat-label">{card.label}</span>
            <span className="stat-icon"><card.icon size={18} /></span>
          </span>
          <span className="stat-value">{card.value ?? 0}</span>
        </div>
      ))}
    </div>
  );
}
