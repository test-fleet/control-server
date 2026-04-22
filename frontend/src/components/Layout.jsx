import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Server, Clapperboard, Users, LogOut, Zap, Activity, PlayCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export function UserAvatar({ user, size = 30 }) {
  const style = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    background: 'var(--surface-raised)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size * 0.4,
    fontWeight: 600,
    color: '#fff',
    overflow: 'hidden',
  }

  if (user?.avatar) {
    return (
      <div style={style}>
        <img
          src={user.avatar}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          referrerPolicy="no-referrer"
        />
      </div>
    )
  }

  const initials = (user?.userName || user?.email || '?')
    .split(/[\s@.]+/)
    .map(p => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return <div style={style}>{initials}</div>
}

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <NavLink to="/dashboard" className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Zap size={13} color="#000" />
          </div>
          <span className="sidebar-logo-name">TestFleet</span>
        </NavLink>

        <nav className="sidebar-nav">
          <div className="sidebar-section-label">Platform</div>

          <NavLink
            to="/dashboard"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <LayoutDashboard size={16} />
            Dashboard
          </NavLink>

          <NavLink
            to="/runners"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Server size={16} />
            Runners
          </NavLink>

          <NavLink
            to="/scenes"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Clapperboard size={16} />
            Scenes
          </NavLink>

          <NavLink
            to="/runs"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <PlayCircle size={16} />
            Runs
          </NavLink>

          <div className="divider" style={{ margin: '8px 0' }} />
          <div className="sidebar-section-label">System</div>
          <NavLink
            to="/system"
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
          >
            <Activity size={16} />
            Metrics
          </NavLink>

          {user?.role === 'admin' && (
            <>
              <div className="divider" style={{ margin: '8px 0' }} />
              <div className="sidebar-section-label">Admin</div>
              <NavLink
                to="/users"
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <Users size={16} />
                Users
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <UserAvatar user={user} size={30} />
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {user?.userName || user?.email?.split('@')[0] || 'User'}
              </div>
              <div className="sidebar-user-role">{user?.role}</div>
            </div>
            <button
              className="sidebar-logout"
              onClick={handleLogout}
              title="Sign out"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
