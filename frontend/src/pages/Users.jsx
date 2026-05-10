import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Shield, UserX, MoreHorizontal } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import Badge from '../components/Badge'
import { UserAvatar } from '../components/Layout'

function AddRow({ colSpan, label, onClick }) {
  const [hover, setHover] = useState(false)
  return (
    <tr
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ cursor: 'pointer' }}
    >
      <td
        colSpan={colSpan}
        style={{
          textAlign: 'center',
          padding: '11px 16px',
          color: hover ? '#60e8ff' : 'var(--blue)',
          background: hover ? 'var(--blue-dim)' : 'transparent',
          borderBottom: `1px dashed ${hover ? 'var(--blue)' : 'rgba(0,200,240,0.35)'}`,
          transition: 'color 0.12s, background 0.12s, border-color 0.12s',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.04em',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <Plus size={13} />
          {label}
        </div>
      </td>
    </tr>
  )
}

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ActionsMenu({ user: targetUser, currentUser, onUpdate }) {
  const [pos, setPos] = useState(null)
  const toast = useToast()
  const isSelf = targetUser._id === currentUser.id

  function toggle(e) {
    if (pos) { setPos(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
  }

  async function changeRole(role) {
    try {
      await api.put(`/users/${targetUser._id}/role`, { role })
      toast.success(`Role updated to ${role}`)
      onUpdate()
    } catch (err) {
      toast.error(err.message)
    }
    setPos(null)
  }

  async function changeStatus(status) {
    try {
      await api.put(`/users/${targetUser._id}/status`, { status })
      toast.success(`Status updated to ${status}`)
      onUpdate()
    } catch (err) {
      toast.error(err.message)
    }
    setPos(null)
  }

  if (isSelf) return <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>You</span>

  const menuStyle = {
    position: 'fixed',
    top: pos?.top,
    right: pos?.right,
    zIndex: 200,
    background: 'var(--surface-raised)',
    border: '1px solid var(--border-bright)',
    borderRadius: 8,
    padding: 4,
    minWidth: 160,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  }

  const itemStyle = (color = 'var(--text)') => ({
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '7px 10px',
    background: 'none', border: 'none',
    color, fontSize: 13, borderRadius: 5, cursor: 'pointer',
  })

  return (
    <>
      <button className="btn btn--ghost btn--icon" onClick={toggle} title="Actions">
        <MoreHorizontal size={15} />
      </button>
      {pos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 199 }} onClick={() => setPos(null)} />
          <div style={menuStyle}>
            {targetUser.role !== 'admin' && (
              <button
                style={itemStyle()}
                onClick={() => changeRole('admin')}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Shield size={13} />Make Admin
              </button>
            )}
            {targetUser.role !== 'user' && (
              <button
                style={itemStyle()}
                onClick={() => changeRole('user')}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Shield size={13} style={{ opacity: 0.5 }} />Make User
              </button>
            )}
            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
            {targetUser.status !== 'disabled' ? (
              <button
                style={itemStyle('var(--error)')}
                onClick={() => changeStatus('disabled')}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--error-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <UserX size={13} />Disable User
              </button>
            ) : (
              <button
                style={itemStyle('var(--success)')}
                onClick={() => changeStatus('active')}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--success-bg)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <Shield size={13} />Re-enable User
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const toast = useToast()

  const [users, setUsers] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ email: '', role: 'user' })
  const [submitting, setSubmitting] = useState(false)

  const limit = 20

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/users?page=${page}&limit=${limit}`)
      .then(data => {
        setUsers(data.data || [])
        setTotal(data.total || 0)
      })
      .catch(err => toast.error(err.message))
      .finally(() => setLoading(false))
  }, [page]) // eslint-disable-line

  useEffect(() => { load() }, [load])

  async function handleInvite(e) {
    e.preventDefault()
    if (!form.email.trim()) return
    setSubmitting(true)
    try {
      await api.post('/users/invite', { email: form.email.trim(), role: form.role })
      toast.success(`Invite sent to ${form.email.trim()}`)
      setForm({ email: '', role: 'user' })
      setShowInvite(false)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const pages = Math.ceil(total / limit)

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Users</h1>
          <p className="page-subtitle">
            {total} team member{total !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <button className="btn btn--secondary btn--sm" onClick={load}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spinner--lg" />
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Last Login</th>
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                <AddRow colSpan={6} label="Invite User" onClick={() => setShowInvite(true)} />
                {users.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <UserAvatar user={u} size={28} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{u.userName || '—'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td><Badge variant={u.role}>{capitalize(u.role)}</Badge></td>
                    <td><Badge variant={u.status}>{capitalize(u.status)}</Badge></td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(u.invitedAt || u.createdAt)}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{formatDate(u.lastLogin)}</td>
                    <td>
                      <ActionsMenu
                        user={u}
                        currentUser={currentUser}
                        onUpdate={load}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pages > 1 && (
              <Pagination page={page} totalPages={pages} onPageChange={setPage} />
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <Modal title="Invite User" onClose={() => setShowInvite(false)}>
          <form onSubmit={handleInvite}>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Email Address <span style={{ color: 'var(--error)' }}>*</span></label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="colleague@company.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  autoFocus
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-select"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="alert alert--info">
                The user will be able to sign in with SSO once their invitation is registered.
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn--secondary" onClick={() => setShowInvite(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={submitting || !form.email.trim()}>
                {submitting
                  ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Inviting…</>
                  : 'Send Invite'
                }
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : ''
}
