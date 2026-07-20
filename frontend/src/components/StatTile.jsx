import Sparkline from './Sparkline'

// KPI tile used across Dashboard/System. `trend` (optional array of numbers)
// renders a small sparkline instead of an icon when present.
export default function StatTile({ icon: Icon, variant = 'primary', value, label, trend, trendColor }) {
  return (
    <div className="stat-tile hud-corners">
      <div className="stat-tile-top">
        {Icon && (
          <div className={`stat-tile-icon stat-tile-icon--${variant}`}>
            <Icon size={14} />
          </div>
        )}
        {trend && (
          <div className="stat-tile-trend">
            <Sparkline data={trend} color={trendColor || 'var(--blue)'} height={24} />
          </div>
        )}
      </div>
      <div>
        <div className="stat-tile-value">{value}</div>
        <div className="stat-tile-label">{label}</div>
      </div>
    </div>
  )
}
