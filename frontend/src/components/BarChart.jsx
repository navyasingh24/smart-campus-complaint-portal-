// A simple horizontal bar chart built with plain HTML and CSS. It avoids a
// charting library because the dashboard only needs basic comparisons.
export default function BarChart({ title, data }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <section className="card chart">
      <h3>{title}</h3>
      <ul className="bar-list">
        {data.map((d) => (
          <li key={d.label} className="bar-row">
            <span className="bar-label">{d.label}</span>
            <span className="bar-track" aria-hidden="true">
              <span
                className={`bar-fill ${d.tone ? `bar-${d.tone}` : ''}`}
                style={{ width: `${(d.value / max) * 100}%` }}
              />
            </span>
            <span className="bar-value">{d.value}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
