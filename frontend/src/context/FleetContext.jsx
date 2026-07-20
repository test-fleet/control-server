import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { api } from '../api/client'
import { useAuth } from './AuthContext'
import { useAutoRefresh } from '../hooks/useAutoRefresh'

// Single shared poll of /dashboard/summary — both the AppShell's fleet-status
// strip and the Dashboard page read from here instead of each fetching it
// separately.
const FleetContext = createContext(null)

export function FleetProvider({ children }) {
  const { heartbeatInterval } = useAuth()
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback((showSpinner) => {
    if (showSpinner) setLoading(true)
    api.get('/dashboard/summary')
      .then(data => setSummary(data))
      .catch(() => {})
      .finally(() => { if (showSpinner) setLoading(false) })
  }, [])

  useEffect(() => { refresh(true) }, [refresh])
  useAutoRefresh(() => refresh(false), heartbeatInterval)

  return (
    <FleetContext.Provider value={{ summary, loading, refresh: () => refresh(false) }}>
      {children}
    </FleetContext.Provider>
  )
}

export function useFleet() {
  const ctx = useContext(FleetContext)
  if (!ctx) throw new Error('useFleet must be used within FleetProvider')
  return ctx
}
