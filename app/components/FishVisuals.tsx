const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_FULL = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function SeasonalChart({ data, guideOnly = false }: { data: number[]; guideOnly?: boolean }) {
  if (!data || data.length !== 12) return null;
  const max = Math.max(...data, 0.01);
  const peak = max * 0.85;
  return (
    <div className="fish-viz">
      <h4>Seasonal activity</h4>
      <div className="season-bars" role="img" aria-label="Relative feeding activity by month">
        {data.map((value, index) => (
          <div className="season-bar" key={index} title={`${MONTH_FULL[index]}: ${Math.round(value * 100)}%`}>
            <div className="season-track">
              <i className={value >= peak ? "peak" : ""} style={{ height: `${Math.max(4, Math.round((value / max) * 100))}%` }} />
            </div>
            <span>{MONTHS[index]}</span>
          </div>
        ))}
      </div>
      <small>{guideOnly ? "Relative biological activity through the year; not used for bite scoring." : "Relative feeding activity through the year, from the researched seasonal profile."}</small>
    </div>
  );
}

const WB_ORDER: [string, string][] = [
  ["river", "River"],
  ["stream", "Stream"],
  ["reservoir", "Reservoir"],
  ["lake", "Lake"],
  ["pond", "Pond"],
  ["bay", "Bay"],
];

export function WaterTypeFit({ pref }: { pref: Record<string, number> }) {
  const entries = WB_ORDER.filter(([key]) => typeof pref[key] === "number");
  if (entries.length === 0) return null;
  return (
    <div className="fish-viz">
      <h4>Where it thrives</h4>
      <div className="waterfit-rows">
        {entries.map(([key, label]) => {
          const value = pref[key]; // -1..1
          const pct = Math.round(((value + 1) / 2) * 100);
          const cls = value >= 0.5 ? "good" : value >= 0 ? "ok" : "poor";
          return (
            <div className="waterfit-row" key={key}>
              <span className="waterfit-label">{label}</span>
              <div className="waterfit-track"><i className={`waterfit-${cls}`} style={{ width: `${Math.max(3, pct)}%` }} /></div>
            </div>
          );
        })}
      </div>
      <small>Habitat fit by water type (green = favored, faded = rarely present).</small>
    </div>
  );
}

export function TempGauge({ preferred, tolerance }: { preferred: [number | null, number | null]; tolerance: [number | null, number | null] }) {
  const [pmin, pmax] = preferred;
  const [tmin, tmax] = tolerance;
  if ([pmin, pmax, tmin, tmax].some((v) => v == null)) return null;
  const span = (tmax as number) - (tmin as number) || 1;
  const left = Math.max(0, (((pmin as number) - (tmin as number)) / span) * 100);
  const width = Math.min(100 - left, ((( pmax as number) - (pmin as number)) / span) * 100);
  return (
    <div className="fish-viz">
      <h4>Preferred water temperature</h4>
      <div className="temp-gauge">
        <div className="temp-track"><i style={{ left: `${left}%`, width: `${width}%` }} /></div>
        <div className="temp-labels">
          <span>{tmin}°F</span>
          <strong>{pmin}–{pmax}°F best</strong>
          <span>{tmax}°F</span>
        </div>
      </div>
      <small>Active-feeding band inside the broader tolerance range.</small>
    </div>
  );
}
