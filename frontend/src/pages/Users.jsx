import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Shield, UserX } from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import Modal from '../components/Modal'
import Pagination from '../components/Pagination'
import Badge from '../components/Badge'
import ActionsMenu from '../components/ActionsMenu'
import AddRow from '../components/AddRow'
import Select from '../components/Select'
import { UserAvatar } from '../components/AppShell'

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function capitalize(s) {
  return s ? s[0].toUpperCase() + s.slice(1) : ''
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

  async function changeRole(targetUser, role) {
    try {
      await api.put(`/users/${targetUser._id}/role`, { role })
      toast.success(`Role updated to ${role}`)
      load()
    } catch (err) {
      toast.error(err.message)
    }
  }

  async function changeStatus(targetUser, status) {
    try {
      await api.put(`/users/${targetUser._id}/status`, { status })
      toast.success(`Status updated to ${status}`)
      load()
    } catch (err) {
      toast.error(err.message)
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
                {users.map(u => {
                  const isSelf = u._id === currentUser.id
                  return (
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
                        {isSelf ? (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>You</span>
                        ) : (
                          <ActionsMenu items={[
                            ...(u.role !== 'admin' ? [{ label: 'Make Admin', icon: Shield, onClick: () => changeRole(u, 'admin') }] : []),
                            ...(u.role !== 'user' ? [{ label: 'Make User', icon: Shield, onClick: () => changeRole(u, 'user') }] : []),
                            { divider: true },
                            u.status !== 'disabled'
                              ? { label: 'Disable User', icon: UserX, danger: true, onClick: () => changeStatus(u, 'disabled') }
                              : { label: 'Re-enable User', icon: Shield, onClick: () => changeStatus(u, 'active') },
                          ]} />
                        )}
                      </td>
                    </tr>
                  )
                })}
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
                <Select
                  value={form.role}
                  onChange={role => setForm(f => ({ ...f, role }))}
                  options={[{ value: 'user', label: 'User' }, { value: 'admin', label: 'Admin' }]}
                />
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
