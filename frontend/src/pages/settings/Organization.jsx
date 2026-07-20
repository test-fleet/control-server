import { useRef, useState } from 'react'
import { Upload, Info } from 'lucide-react'
import { api } from '../../api/client'
import { useToast } from '../../context/ToastContext'

const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED_TYPES = 'image/png,image/jpeg,image/svg+xml,image/webp,image/x-icon'

export default function Organization() {
  const toast = useToast()
  const fileInputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  function handleSelect(e) {
    const selected = e.target.files?.[0]
    if (!selected) return
    if (selected.size > MAX_BYTES) {
      toast.error('Image must be 2MB or smaller')
      e.target.value = ''
      return
    }
    setFile(selected)
    setPreview(URL.createObjectURL(selected))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!file) return

    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('image', file)
      await api.upload('/branding', formData)
      toast.success('Branding image updated')
      setFile(null)
      setPreview(null)
      setTimeout(() => window.location.reload(), 400)
    } catch (err) {
      toast.error(err.message || 'Failed to update branding')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Organization</h1>
          <p className="page-subtitle">Branding shown throughout the app.</p>
        </div>
      </div>
      <div className="page-body">
        <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 480 }}>
          <div className="form-group">
            <label className="form-label">Org logo / favicon</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: 'var(--surface-raised)', border: '1px solid var(--border)', flexShrink: 0 }}>
                <img src={preview || '/api/v1/branding/image'} alt="Current logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div>
                <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} onChange={handleSelect} style={{ display: 'none' }} id="branding-upload-input" />
                <label htmlFor="branding-upload-input" className="btn btn--secondary btn--sm" style={{ cursor: 'pointer' }}>
                  <Upload size={13} />
                  Choose image
                </label>
                {file && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{file.name}</div>}
              </div>
            </div>
          </div>
          <div className="alert alert--info" style={{ marginTop: 14 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>Used as the browser tab icon and the logo throughout the app. PNG, JPEG, SVG, WEBP, or ICO — 2MB max.</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <button type="submit" className="btn btn--primary" disabled={submitting || !file}>
              {submitting ? <><div className="spinner" style={{ width: 14, height: 14 }} /> Uploading…</> : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </>
  )
}
