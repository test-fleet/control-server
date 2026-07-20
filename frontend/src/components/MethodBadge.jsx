// Categorical, not semantic — these colors just need to stay visually
// distinct from each other and from the app's status colors (success/
// warning/error), so they're pulled from the theme's own token set rather
// than one-off hex values that would ignore dark mode.
const METHOD_COLORS = {
  GET:    { bg: 'var(--lime-dim)',   color: 'var(--lime)' },
  POST:   { bg: 'var(--blue-dim)',   color: 'var(--blue)' },
  PUT:    { bg: 'var(--warning-bg)', color: 'var(--warning)' },
  PATCH:  { bg: 'var(--violet-dim)', color: 'var(--violet)' },
  DELETE: { bg: 'var(--error-bg)',   color: 'var(--error)' },
}

export default function MethodBadge({ method }) {
  const c = METHOD_COLORS[method] || { bg: 'var(--surface-hover)', color: 'var(--text-muted)' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 7px', borderRadius: 5,
      fontSize: 10, fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em',
      background: c.bg, color: c.color, flexShrink: 0,
    }}>
      {method}
    </span>
  )
}
