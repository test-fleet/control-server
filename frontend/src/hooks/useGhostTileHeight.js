import { useEffect, useRef, useState } from 'react'

// Measures the first real (non-ghost) .fleet-card inside the returned container
// ref and keeps `height` in sync via ResizeObserver, so a leading "add" ghost
// tile can match the actual list item height even as content varies (wrapped
// text, optional description lines, list changes, window resize).
export function useGhostTileHeight(deps = []) {
  const containerRef = useRef(null)
  const [height, setHeight] = useState(null)

  useEffect(() => {
    const container = containerRef.current
    const item = container?.querySelector('.fleet-card:not(.fleet-card--ghost)')
    if (!item) {
      setHeight(null)
      return
    }

    const observer = new ResizeObserver(([entry]) => setHeight(entry.target.getBoundingClientRect().height))
    observer.observe(item)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return [containerRef, height]
}
