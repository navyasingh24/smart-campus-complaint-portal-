export default function StatCards({ total, byStatus }) {
  const cards = [
    { label: 'Total', value: total, tone: 'total' },
    { label: 'Pending', value: byStatus.PENDING, tone: 'pending' },
    { label: 'In Progress', value: byStatus.IN_PROGRESS, tone: 'in_progress' },
    { label: 'Resolved', value: byStatus.RESOLVED, tone: 'resolved' },
  ];
  return (
    <div className="stat-grid">
      {cards.map((card) => (
        <div key={card.label} className={`stat-card stat-${card.tone}`}>
          <span className="stat-label">{card.label}</span>
          <span className="stat-value">{card.value ?? 0}</span>
        </div>
      ))}
    </div>
  );
}
