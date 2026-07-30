import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clapperboard, Server, Users as UsersIcon, LayoutDashboard, PlayCircle, HelpCircle } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useNavGuard } from '../context/NavGuardContext'

const STATIC_ITEMS = [
  { group: 'Go to', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { group: 'Go to', label: 'Runners', icon: Server, path: '/runners' },
  { group: 'Go to', label: 'Scenes', icon: Clapperboard, path: '/scenes' },
  { group: 'Go to', label: 'Runs', icon: PlayCircle, path: '/runs' },
  { group: 'Go to', label: 'Help Center', icon: HelpCircle, path: '/settings/help' },
]

export default function CommandPalette({ onClose }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { requestNavigation } = useNavGuard()
  const [query, setQuery] = useState('')
  const [scenes, setScenes] = useState([])
  const [runners, setRunners] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
    Promise.allSettled([
      api.get('/scenes?limit=200'),
      api.get('/runners?limit=200'),
    ]).then(([sRes, rRes]) => {
      if (sRes.status === 'fulfilled') setScenes(sRes.value.data || [])
      if (rRes.status === 'fulfilled') setRunners(rRes.value.data || [])
    })
  }, [])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sceneItems = scenes.map(s => ({ group: 'Scenes', label: s.name, icon: Clapperboard, path: `/scenes/${s.id}` }))
    const runnerItems = runners.map(r => ({ group: 'Runners', label: r.name, icon: Server, path: `/runners/${r._id}` }))
    const userItem = user?.role === 'admin' ? [{ group: 'Go to', label: 'Users', icon: UsersIcon, path: '/settings/users' }] : []
    const all = [...STATIC_ITEMS, ...userItem, ...runnerItems, ...sceneItems]
    if (!q) return all.slice(0, 20)
    return all.filter(i => i.label.toLowerCase().includes(q)).slice(0, 30)
  }, [query, scenes, runners, user])

  const grouped = useMemo(() => {
    const map = new Map()
    for (const item of results) {
      if (!map.has(item.group)) map.set(item.group, [])
      map.get(item.group).push(item)
    }
    return [...map.entries()]
  }, [results])

  function go(path) {
    onClose()
    requestNavigation(navigate, path)
  }

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="cmdk-overlay" onMouseDown={onClose}>
      <div className="cmdk" onMouseDown={e => e.stopPropagation()}>
        <div className="cmdk-input-row">
          <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="cmdk-input"
            placeholder="Jump to a scene, runner, or page…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <kbd style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--border-bright)', borderRadius: 4, padding: '1px 5px' }}>ESC</kbd>
        </div>
        <div className="cmdk-results">
          {grouped.length === 0 && <div className="cmdk-empty">No matches</div>}
          {grouped.map(([group, items]) => (
            <div key={group}>
              <div className="cmdk-group-label">{group}</div>
              {items.map((item, i) => (
                <div key={`${group}-${i}`} className="cmdk-item" onClick={() => go(item.path)}>
                  <span className="cmdk-item-icon"><item.icon size={14} /></span>
                  {item.label}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
