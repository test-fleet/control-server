import { useEffect, useRef } from 'react'

/**
 * Calls `callback` on a repeating interval. Uses a ref so the latest version
 * of the callback is always called without resetting the interval.
 */
export function useAutoRefresh(callback, intervalMs) {
  const cb = useRef(callback)
  cb.current = callback

  useEffect(() => {
    if (!intervalMs) return
    const id = setInterval(() => cb.current(), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
}
