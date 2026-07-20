import { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Server, Clapperboard, Users, LogOut, Activity, PlayCircle,
  Sun, Moon, Image, Search, ChevronsLeft, ChevronsRight, AlertTriangle, WifiOff,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { FleetProvider, useFleet } from '../context/FleetContext'
import CommandPalette from './CommandPalette'

export function UserAvatar({ user, size = 30 }) {
  const style = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: 'var(--surface-raised)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.4, fontWeight: 600, color: '#fff', overflow: 'hidden',
  }
  if (user?.avatar) {
    return (
      <div style={style}>
        <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} referrerPolicy="no-referrer" />
      </div>
    )
  }
  const initials = (user?.userName || user?.email || '?').split(/[\s@.]+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()
  return <div style={style}>{initials}</div>
}

const SECTION_LABELS = [
  { prefix: '/dashboard', label: 'Dashboard' },
  { prefix: '/scenes', label: 'Scenes' },
  { prefix: '/runs', label: 'Runs' },
  { prefix: '/runners', label: 'Runners' },
  { prefix: '/settings/organization', label: 'Organization' },
  { prefix: '/settings/users', label: 'Users' },
  { prefix: '/settings/system', label: 'System' },
]

function Breadcrumb() {
  const { pathname } = useLocation()
  const section = SECTION_LABELS.find(s => pathname.startsWith(s.prefix))
  return (
    <div className="topbar-breadcrumb">
      <span>TestFleet</span>
      {section && <><span>/</span><b>{section.label}</b></>}
    </div>
  )
}

function FleetStrip() {
  const { summary } = useFleet()
  if (!summary) return null
  const { runners, scenes } = summary

  return (
    <div className="fleet-strip">
      <span className={`fleet-pill${runners.offline > 0 ? ' fleet-pill--error' : ' fleet-pill--ok'}`} title="Runners currently offline/unresponsive">
        {runners.offline > 0 ? <WifiOff size={11} /> : <Activity size={11} />}
        {runners.active}/{runners.total} runners
      </span>
      {scenes.failing > 0 && (
        <span className="fleet-pill fleet-pill--error" title="Scenes whose last run failed or errored">
          <AlertTriangle size={11} />{scenes.failing} failing
        </span>
      )}
      {runners.flagged > 0 && (
        <span className="fleet-pill fleet-pill--alert" title="Runners sharing API credentials">
          <AlertTriangle size={11} />{runners.flagged} shared creds
        </span>
      )}
    </div>
  )
}

function ShellInner() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { theme, toggle } = useTheme()
  const [expanded, setExpanded] = useState(() => localStorage.getItem('testfleet-rail') !== 'collapsed')
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem('testfleet-rail', expanded ? 'expanded' : 'collapsed')
  }, [expanded])

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <aside className={`rail${expanded ? ' expanded' : ''}`}>
        <NavLink to="/dashboard" className="rail-logo">
          <div className="rail-logo-icon"><img src="/api/v1/branding/image" alt="" onError={e => { e.currentTarget.onerror = null; e.currentTarget.src = '/favicon.svg' }} /></div>
          <span className="rail-logo-name">TestFleet</span>
        </NavLink>

        <nav className="rail-nav">
          <RailLink to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <RailLink to="/runners" icon={Server} label="Runners" />
          <RailLink to="/scenes" icon={Clapperboard} label="Scenes" />
          <RailLink to="/runs" icon={PlayCircle} label="Runs" />

          <div className="divider" style={{ margin: '8px 0' }} />
          <div className="rail-section-label">Settings</div>

          {user?.role === 'admin' && <RailLink to="/settings/organization" icon={Image} label="Organization" />}
          {user?.role === 'admin' && <RailLink to="/settings/users" icon={Users} label="Users" />}
          <RailLink to="/settings/system" icon={Activity} label="System" />
        </nav>

        <button className="rail-toggle" onClick={() => setExpanded(e => !e)} title={expanded ? 'Collapse' : 'Expand'}>
          {expanded ? <ChevronsLeft size={14} /> : <ChevronsRight size={14} />}
        </button>

        <div className="rail-footer">
          <button className="rail-icon-btn" onClick={toggle} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'} style={{ justifyContent: expanded ? 'flex-start' : 'center', width: '100%', gap: 8, padding: '7px 8px' }}>
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            {expanded && <span style={{ fontSize: 11.5 }}>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span>}
          </button>
          <div className="rail-user">
            <UserAvatar user={user} size={28} />
            <div className="rail-user-info">
              <div className="rail-user-name">{user?.userName || user?.email?.split('@')[0] || 'User'}</div>
              <div className="rail-user-role">{user?.role}</div>
            </div>
            {expanded && (
              <button className="rail-icon-btn rail-icon-btn--danger" onClick={handleLogout} title="Sign out">
                <LogOut size={15} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className={`app-main${expanded ? ' rail-expanded' : ''}`}>
        <div className="topbar">
          <Breadcrumb />
          <FleetStrip />
          <button className="topbar-search" onClick={() => setPaletteOpen(true)}>
            <Search size={13} />
            Jump to…
            <kbd>⌘K</kbd>
          </button>
        </div>
        <Outlet />
      </main>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}

function RailLink({ to, icon, label }) {
  const Icon = icon
  return (
    <NavLink to={to} className={({ isActive }) => `rail-link${isActive ? ' active' : ''}`} title={label}>
      <Icon size={16} />
      <span className="rail-link-label">{label}</span>
    </NavLink>
  )
}

export default function AppShell() {
  return (
    <FleetProvider>
      <ShellInner />
    </FleetProvider>
  )
}
