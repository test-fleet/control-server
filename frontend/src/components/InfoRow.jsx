export function InfoField({ label, children }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}:</span>
      <span style={{ color: 'var(--text-dim)' }}>{children}</span>
    </span>
  )
}

export function InfoDivider() {
  return <span style={{ color: 'var(--border)' }}>│</span>
}
