import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../api/client'

export default function AuthCallback() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (!token) {
      if (window.opener) window.close()
      else navigate('/login', { replace: true })
      return
    }

    // If opened as a popup, send token to parent and close
    if (window.opener) {
      window.opener.postMessage({ type: 'oauth-callback', token }, window.location.origin)
      window.close()
      return
    }

    // Fallback: handle in-tab callback (e.g. popup was blocked)
    localStorage.setItem('token', token)

    api.get('/auth/me')
      .then(user => {
        login(token, user)
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        localStorage.removeItem('token')
        navigate('/login', { replace: true })
      })
  }, [login, navigate])

  return (
    <div className="loading-screen">
      <div className="spinner spinner--lg" />
    </div>
  )
}
