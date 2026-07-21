// Single source of truth for run/scene status -> color. Previously duplicated
// (with subtly inconsistent defaults) across RunDetailPanel, Dashboard,
// Scenes, SceneRuns, and SceneDetailLayout.
export function statusColor(status) {
  switch (status) {
    case 'passed': return 'var(--success)'
    case 'pending': return 'var(--blue)'
    case 'error': return 'var(--peach)'
    case 'incomplete': return 'var(--warning)'
    case 'failed': return 'var(--error)'
    default: return 'var(--text-muted)'
  }
}
