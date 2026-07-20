import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, ShieldCheck } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'
import StatusPulse from '../components/StatusPulse'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const popupRef = useRef(null)

  useEffect(() => {
    if (user) navigate('/dashboard', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    function handleMessage(event) {
      if (event.origin !== window.location.origin) return
      if (event.data?.type !== 'oauth-callback') return

      const { token } = event.data
      if (!token) return

      localStorage.setItem('token', token)
      api.get('/auth/me')
        .then(userData => {
          login(token, userData)
          navigate('/dashboard', { replace: true })
        })
        .catch(() => localStorage.removeItem('token'))
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [login, navigate])

  function handleLogin() {
    const width = 500
    const height = 600
    const left = window.screenX + (window.outerWidth - width) / 2
    const top = window.screenY + (window.outerHeight - height) / 2
    const popup = window.open(
      '/api/v1/auth/oauth',
      'oauth-popup',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    )
    popupRef.current = popup
  }

  return (
    <div className="login-page">
      <div className="login-card hud-corners">
        <div className="login-eyebrow">Control Plane // Authentication</div>

        <div className="login-logo">
          <div className="login-logo-icon">
            <img src="/api/v1/branding/image" alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/favicon.svg' }} />
          </div>
          <span className="monospace" style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>TestFleet</span>
        </div>

        <h1 className="login-title" style={{ marginBottom: 2 }}>
          Welcome back
        </h1>
        <p className="login-subtitle">
          Sign in to manage your test infrastructure, runners, and automation scenes.
        </p>

        <button className="btn btn--primary login-btn" onClick={handleLogin}>
          <ShieldCheck size={16} />
          Continue with SSO
          <ArrowRight size={16} style={{ marginLeft: 'auto' }} />
        </button>

        <p className="login-note">
          Access is invite-only. Contact your administrator if you don't have an account.
        </p>

        <div className="login-status">
          <StatusPulse color="var(--lime)" size={6} />
          <span>All systems operational</span>
        </div>
      </div>
    </div>
  )
}
