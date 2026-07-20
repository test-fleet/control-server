import { useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Save } from 'lucide-react'
import { api } from '../../api/client'
import Badge from '../../components/Badge'
import Select from '../../components/Select'
import {
  FREQUENCY_OPTIONS, THRESHOLD_OPTIONS,
  detectFrequency, buildCronSchedule, frequencyLabel, thresholdLabel, formatTimeout,
} from '../../lib/sceneHelpers'

function formatDate(date) {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const labelStyle = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.1em',
  fontFamily: 'monospace', display: 'block', marginBottom: 6,
}

export default function SceneSettings() {
  const { scene, refreshScene, toast } = useOutletContext()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    name: scene.name || '',
    description: scene.description || '',
    timeout: scene.timeout ? Math.round(scene.timeout / 60000) : 5,
    frequency: detectFrequency(scene.cronSchedule),
    passThreshold: scene.passThreshold ?? 1.0,
  }))

  function startEdit() {
    setForm({
      name: scene.name || '',
      description: scene.description || '',
      timeout: scene.timeout ? Math.round(scene.timeout / 60000) : 5,
      frequency: detectFrequency(scene.cronSchedule),
      passThreshold: scene.passThreshold ?? 1.0,
    })
    setEditing(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    try {
      await api.put(`/scene/${scene.id}`, {
        name: form.name.trim(),
        description: form.description.trim(),
        timeout: Math.floor(Number(form.timeout) * 60000),
        cronSchedule: buildCronSchedule(form.frequency),
        passThreshold: form.passThreshold,
      })
      toast.success('Scene updated')
      refreshScene()
      setEditing(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSubmit} className="card">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus required />
          </div>
          <div>
            <label style={labelStyle}>Timeout (minutes)</label>
            <input className="form-input" type="number" min={1} max={1440} value={form.timeout} onChange={e => setForm(f => ({ ...f, timeout: e.target.value }))} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Description</label>
            <textarea className="form-input" placeholder="What does this scene test?" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>Frequency</label>
            <Select value={form.frequency} onChange={frequency => setForm(f => ({ ...f, frequency }))} options={FREQUENCY_OPTIONS} />
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Pass Threshold</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {THRESHOLD_OPTIONS.map(opt => (
                <button
                  key={opt.value} type="button" title={opt.hint}
                  onClick={() => setForm(f => ({ ...f, passThreshold: opt.value }))}
                  style={{
                    flex: 1, padding: '7px 0', fontSize: 11, fontWeight: 700,
                    borderRadius: 6, cursor: 'pointer', border: '1px solid',
                    fontFamily: 'monospace',
                    background: form.passThreshold === opt.value ? 'var(--blue-dim)' : 'transparent',
                    borderColor: form.passThreshold === opt.value ? 'var(--blue)' : 'var(--border)',
                    color: form.passThreshold === opt.value ? 'var(--blue-hover)' : 'var(--text-muted)',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(false)}>Cancel</button>
          <button type="submit" className="btn btn--primary btn--sm" disabled={saving || !form.name.trim()}>
            {saving ? <><div className="spinner" style={{ width: 12, height: 12 }} />Saving…</> : <><Save size={12} />Save Changes</>}
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="card" style={{ position: 'relative' }}>
      <button type="button" className="btn btn--ghost btn--sm" style={{ position: 'absolute', top: 14, right: 14 }} onClick={startEdit}>Edit</button>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px', paddingRight: 70 }}>
        <div>
          <label style={labelStyle}>Name</label>
          <div style={{ fontSize: 13 }}>{scene.name}</div>
        </div>
        <div>
          <label style={labelStyle}>Status</label>
          <Badge variant={scene.enabled ? 'active' : 'disabled'}>{scene.enabled ? 'Enabled' : 'Disabled'}</Badge>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Description</label>
          <div style={{ fontSize: 13 }}>{scene.description || <span style={{ color: 'var(--text-muted)' }}>No description</span>}</div>
        </div>
        <div>
          <label style={labelStyle}>Frequency</label>
          <div style={{ fontSize: 13 }}>{frequencyLabel(scene.cronSchedule)}</div>
        </div>
        <div>
          <label style={labelStyle}>Timeout</label>
          <div style={{ fontSize: 13 }}>{formatTimeout(scene.timeout)}</div>
        </div>
        <div>
          <label style={labelStyle}>Created</label>
          <div style={{ fontSize: 13 }}>{formatDate(scene.createdAt)}</div>
        </div>
        <div>
          <label style={labelStyle}>Pass Threshold</label>
          <div style={{ fontSize: 13 }}>{thresholdLabel(scene.passThreshold)}</div>
        </div>
      </div>
    </div>
  )
}
