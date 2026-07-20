// Small live indicator dot. `color` is any CSS color (usually a var(--x) token).
// `live` controls whether it animates an expanding ring (use for things that
// are actively polling/healthy — not for offline/disabled states).
export default function StatusPulse({ color = 'var(--lime)', live = true, size = 8 }) {
  return (
    <span
      className={`status-pulse${live ? '' : ' status-pulse--static'}`}
      style={{ color, width: size, height: size }}
    />
  )
}
