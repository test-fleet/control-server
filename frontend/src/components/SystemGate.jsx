import { useEffect, useState } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import StatusPulse from './StatusPulse'

const POLL_INTERVAL_MS = 5000

export default function SystemGate({ children }) {
  const [status, setStatus] = useState({ checked: false, ok: true, mongo: true, redis: true })

  useEffect(() => {
    let cancelled = false

    async function check() {
      try {
        const res = await fetch('/ready')
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        setStatus({ checked: true, ok: res.ok, mongo: !!data.mongo, redis: !!data.redis })
      } catch {
        if (cancelled) return
        setStatus({ checked: true, ok: false, mongo: false, redis: false })
      }
    }

    check()
    const timer = setInterval(check, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [])

  if (!status.checked) return <div className="loading-screen"><div className="spinner spinner--lg" /></div>
  if (status.ok) return children

  return <SystemUnavailable mongo={status.mongo} redis={status.redis} />
}

function SystemUnavailable({ mongo, redis }) {
  return (
    <div className="sysgate">
      <div className="sysgate-panel hud-corners">
        <div className="sysgate-icon"><AlertTriangle size={20} /></div>
        <h1 className="sysgate-title">Backend unavailable</h1>
        <p className="sysgate-subtitle">
          The control server can't reach one or more of its dependencies. This screen will
          clear automatically once connectivity is restored.
        </p>

        <div className="sysgate-checks">
          <SystemCheckRow label="MongoDB" ok={mongo} />
          <SystemCheckRow label="Redis" ok={redis} />
        </div>

        <div className="sysgate-retry">
          <RotateCw size={11} className="sysgate-retry-icon" />
          Retrying every {POLL_INTERVAL_MS / 1000}s
        </div>
      </div>
    </div>
  )
}

function SystemCheckRow({ label, ok }) {
  return (
    <div className="sysgate-check">
      {ok
        ? <StatusPulse color="var(--lime)" live size={7} />
        : <StatusPulse color="var(--error)" live={false} size={7} />}
      <span className="sysgate-check-label">{label}</span>
      <span className={`sysgate-check-status ${ok ? 'sysgate-check-status--ok' : 'sysgate-check-status--bad'}`}>
        {ok ? 'connected' : 'unreachable'}
      </span>
    </div>
  )
}
