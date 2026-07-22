import { useState, Fragment } from 'react'
import { useOutletContext } from 'react-router-dom'
import { Plus, Trash2, Save, Info } from 'lucide-react'
import { api } from '../../api/client'
import { FrameDetail } from '../../components/FrameDetail'
import MethodBadge from '../../components/MethodBadge'
import Select from '../../components/Select'
import VariableField from '../../components/VariableField'
import {
  frameToFormValues, transformFrameForApi,
  resolveVariables, unresolvedVariables, formatJsonBody,
} from '../../lib/sceneHelpers'

const FIELD_LABEL = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
  display: 'block', marginBottom: 3,
}
const SUBSECTION_LABEL = {
  fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-mono)',
}
const INPUT_SM = { padding: '5px 8px', fontSize: 12, height: 30 }

const DATA_TYPE_OPTIONS = ['string', 'number', 'boolean', 'null'].map(t => ({ value: t, label: t }))
const METHOD_OPTIONS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => ({ value: m, label: m }))
const EXTRACTOR_TYPE_OPTIONS = [{ value: 'json', label: 'json' }, { value: 'header', label: 'header' }]
const ASSERTION_TYPE_OPTIONS = [{ value: 'status', label: 'status' }, { value: 'json', label: 'json' }, { value: 'header', label: 'header' }]

// One-time column-header row for a repeating input grid — cheaper than a
// label on every row, but still says what each field means at a glance.
function GridLabels({ columns, labels }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: columns, gap: 4, marginBottom: 4 }}>
      {labels.map((l, i) => <span key={i} style={{ ...FIELD_LABEL, marginBottom: 0 }}>{l}</span>)}
    </div>
  )
}

const BLANK_HEADER = { key: '', value: '' }
const BLANK_EXTRACTOR = { name: '', type: 'json', source: '', dataType: 'string' }
const BLANK_ASSERTION = { type: 'status', operator: 'eq', expected: '200', source: '' }
const BLANK_FRAME = { name: '', enabled: true, method: 'GET', url: '', body: '', timeout: 30, headers: [], extractors: [], assertions: [] }

// ── Variables panel ──────────────────────────────────────────────────────

function VariablesPanel({ scene, frames, refreshScene, toast }) {
  const [editing, setEditing] = useState(false)
  const [rows, setRows] = useState(() => sceneVarsToRows(scene.variables))
  const [saving, setSaving] = useState(false)

  function sceneVarsToRows(vars) {
    return Object.entries(vars || {}).map(([name, v]) => ({ name, type: v.type || 'string', value: v.value ?? '' }))
  }

  function startEdit() {
    setRows(sceneVarsToRows(scene.variables))
    setEditing(true)
  }

  function updRow(i, key, val) {
    setRows(r => { const next = [...r]; next[i] = { ...next[i], [key]: val }; return next })
  }
  function addRow() { setRows(r => [...r, { name: '', type: 'string', value: '' }]) }
  function removeRow(i) { setRows(r => r.filter((_, j) => j !== i)) }

  async function save() {
    setSaving(true)
    try {
      const variables = {}
      rows.forEach(r => {
        if (!r.name.trim()) return
        let value = r.value
        if (r.type === 'number') value = Number(value)
        if (r.type === 'boolean') value = value === true || value === 'true'
        variables[r.name.trim()] = { type: r.type, value }
      })
      await api.put(`/scene/${scene.id}`, { variables })
      toast.success('Scene variables updated')
      refreshScene()
      setEditing(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const existing = Object.entries(scene.variables || {})

  // Extractors aren't stored on the scene — the runner computes them fresh
  // each run from every enabled frame's `extractors`, in frame order. Listed
  // here (read-only) so it's clear what ${vars} are available further down
  // the pipeline without having to open each frame individually.
  const extracted = (frames || [])
    .filter(f => f.enabled)
    .slice()
    .sort((a, b) => a.order - b.order)
    .flatMap(f => (f.extractors || []).map(ex => ({ ...ex, frameOrder: f.order, frameName: f.name })))

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: existing.length || editing ? 10 : 0 }}>
        <span style={SUBSECTION_LABEL}>Scene variables — seeded before frame 1 runs</span>
        {!editing && (
          <button className="btn btn--ghost btn--sm" style={{ fontSize: 11 }} onClick={startEdit}>Edit</button>
        )}
      </div>

      {!editing ? (
        existing.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
            None yet. Add one if an early frame needs a value that isn't extracted from an earlier response, e.g. a base URL.
          </p>
        ) : (
          <div>
            <GridLabels columns="140px 60px 1fr" labels={['Name', 'Type', 'Value']} />
            {existing.map(([name, v]) => (
              <div key={name} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '4px 0', fontFamily: 'var(--font-mono)' }}>
                <span style={{ color: 'var(--blue)', minWidth: 140 }}>{name}</span>
                <span style={{ color: 'var(--text-muted)', minWidth: 60 }}>{v.type}</span>
                <span style={{ color: 'var(--text-dim)' }}>{String(v.value)}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        <div>
          <GridLabels columns="1fr 90px 1fr 26px" labels={['Name', 'Type', 'Value', '']} />
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr 26px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
              <input className="form-input" style={INPUT_SM} placeholder="baseUrl" value={r.name} onChange={e => updRow(i, 'name', e.target.value)} />
              <Select style={INPUT_SM} value={r.type} onChange={t => updRow(i, 'type', t)} options={DATA_TYPE_OPTIONS} />
              <input className="form-input" style={INPUT_SM} placeholder="https://api.example.com" value={r.value} onChange={e => updRow(i, 'value', e.target.value)} />
              <button type="button" className="btn btn--ghost btn--icon" style={{ color: 'var(--error)', width: 26, height: 26 }} onClick={() => removeRow(i)}><Trash2 size={12} /></button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button type="button" className="btn btn--ghost btn--sm" style={{ fontSize: 11, gap: 4 }} onClick={addRow}><Plus size={11} />Add variable</button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setEditing(false)}>Cancel</button>
              <button type="button" className="btn btn--primary btn--sm" disabled={saving} onClick={save}>
                {saving ? <><div className="spinner" style={{ width: 11, height: 11 }} />Saving…</> : <><Save size={11} />Save</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {extracted.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <div style={{ ...SUBSECTION_LABEL, marginBottom: 8 }}>Extracted by frames — available once that frame runs</div>
          <GridLabels columns="140px 60px 1fr" labels={['Name', 'Type', 'From']} />
          {extracted.map(ex => (
            <div key={`${ex.frameOrder}-${ex.name}`} style={{ display: 'flex', gap: 10, fontSize: 12, padding: '4px 0', fontFamily: 'var(--font-mono)' }}>
              <span style={{ color: 'var(--teal)', minWidth: 140 }}>{ex.name}</span>
              <span style={{ color: 'var(--text-muted)', minWidth: 60 }}>{ex.dataType}</span>
              <span style={{ color: 'var(--text-dim)' }}>Frame {ex.frameOrder + 1}: {ex.frameName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Frame form (headers + extractors + assertions) ───────────────────────

function FrameFormBuilder({ value, onChange, knownVarNames }) {
  const [bodyFormatError, setBodyFormatError] = useState(false)

  function upd(key, val) { onChange({ ...value, [key]: val }) }

  function formatBody() {
    const formatted = formatJsonBody(value.body)
    if (formatted === null) {
      setBodyFormatError(true)
      return
    }
    setBodyFormatError(false)
    upd('body', formatted)
  }

  function addHeader() { onChange({ ...value, headers: [...value.headers, { ...BLANK_HEADER }] }) }
  function removeHeader(i) { onChange({ ...value, headers: value.headers.filter((_, j) => j !== i) }) }
  function updHeader(i, key, val) {
    const h = [...value.headers]; h[i] = { ...h[i], [key]: val }; onChange({ ...value, headers: h })
  }

  function addExtractor() { onChange({ ...value, extractors: [...value.extractors, { ...BLANK_EXTRACTOR }] }) }
  function removeExtractor(i) { onChange({ ...value, extractors: value.extractors.filter((_, j) => j !== i) }) }
  function updExtractor(i, key, val) {
    const ex = [...value.extractors]; ex[i] = { ...ex[i], [key]: val }; onChange({ ...value, extractors: ex })
  }

  function addAssertion() { onChange({ ...value, assertions: [...value.assertions, { ...BLANK_ASSERTION }] }) }
  function removeAssertion(i) { onChange({ ...value, assertions: value.assertions.filter((_, j) => j !== i) }) }
  function updAssertion(i, key, val) {
    const as = [...value.assertions]; as[i] = { ...as[i], [key]: val }; onChange({ ...value, assertions: as })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 6 }}>
        <div>
          <label style={FIELD_LABEL}>Method</label>
          <Select style={INPUT_SM} value={value.method} onChange={m => upd('method', m)} options={METHOD_OPTIONS} />
        </div>
        <div>
          <label style={FIELD_LABEL}>URL *</label>
          <VariableField style={INPUT_SM} placeholder="https://api.example.com/endpoint" value={value.url} onChange={v => upd('url', v)} knownVars={knownVarNames} required />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: 6 }}>
        <div>
          <label style={FIELD_LABEL}>Name *</label>
          <input className="form-input" style={INPUT_SM} value={value.name} onChange={e => upd('name', e.target.value)} required />
        </div>
        <div>
          <label style={FIELD_LABEL}>Timeout (s)</label>
          <input className="form-input" style={INPUT_SM} type="number" min={1} value={value.timeout} onChange={e => upd('timeout', e.target.value)} />
        </div>
      </div>

      {/* Headers */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={SUBSECTION_LABEL}>Headers{value.headers.length > 0 ? ` (${value.headers.length})` : ''}</span>
          <button type="button" className="btn btn--ghost btn--sm" style={{ fontSize: 11, gap: 4, padding: '2px 8px' }} onClick={addHeader}>
            <Plus size={11} />Add
          </button>
        </div>
        {value.headers.length === 0
          ? <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No custom headers.</p>
          : <>
              <GridLabels columns="1fr 1fr 26px" labels={['Header', 'Value', '']} />
              {value.headers.map((h, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 26px', gap: 4, marginBottom: 4 }}>
                <input className="form-input" style={INPUT_SM} placeholder="Authorization" value={h.key} onChange={e => updHeader(i, 'key', e.target.value)} />
                <VariableField style={INPUT_SM} placeholder="Bearer ${apiKey}" value={h.value} onChange={v => updHeader(i, 'value', v)} knownVars={knownVarNames} />
                <button type="button" className="btn btn--ghost btn--icon" style={{ color: 'var(--error)', width: 26, height: 26 }} onClick={() => removeHeader(i)}><Trash2 size={12} /></button>
              </div>
              ))}
            </>
        }
      </div>

      {['POST', 'PUT', 'PATCH'].includes(value.method) && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <label style={{ ...FIELD_LABEL, marginBottom: 0 }}>Request Body</label>
            <button type="button" className="btn btn--ghost btn--sm" style={{ fontSize: 10, padding: '1px 6px', height: 'auto' }} onClick={formatBody}>
              Format
            </button>
          </div>
          <VariableField
            as="textarea"
            autoClose
            highlightJson
            style={{ fontSize: 12, resize: 'vertical', minHeight: 180, fontFamily: 'var(--font-mono)', display: 'block' }}
            placeholder='{"key": "value"}'
            value={value.body}
            onChange={v => { upd('body', v); setBodyFormatError(false) }}
            onBlur={() => {
              if (!value.body?.trim()) return
              const formatted = formatJsonBody(value.body)
              if (formatted !== null) upd('body', formatted)
            }}
            knownVars={knownVarNames}
          />
          {bodyFormatError && (
            <p style={{ fontSize: 11, color: 'var(--error)', margin: '3px 0 0', fontStyle: 'italic' }}>
              Not valid JSON — can't auto-format.
            </p>
          )}
        </div>
      )}

      {/* Extractors */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={SUBSECTION_LABEL}>Extractors{value.extractors.length > 0 ? ` (${value.extractors.length})` : ''}</span>
          <button type="button" className="btn btn--ghost btn--sm" style={{ fontSize: 11, gap: 4, padding: '2px 8px' }} onClick={addExtractor}>
            <Plus size={11} />Add
          </button>
        </div>
        {value.extractors.length === 0
          ? <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No extractors — variables will not be saved from this frame.</p>
          : <>
              <GridLabels columns="1fr 90px 1fr 105px 26px" labels={['Variable', 'Type', 'Source', 'Data Type', '']} />
              {value.extractors.map((ex, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 1fr 105px 26px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                <input className="form-input" style={INPUT_SM} placeholder="token" value={ex.name} onChange={e => updExtractor(i, 'name', e.target.value)} required />
                <Select style={INPUT_SM} value={ex.type} onChange={t => updExtractor(i, 'type', t)} options={EXTRACTOR_TYPE_OPTIONS} />
                <input className="form-input" style={INPUT_SM} placeholder={ex.type === 'json' ? 'res.body.data.id' : 'Content-Type'} value={ex.source} onChange={e => updExtractor(i, 'source', e.target.value)} required />
                <Select style={INPUT_SM} value={ex.dataType} onChange={t => updExtractor(i, 'dataType', t)} options={DATA_TYPE_OPTIONS} />
                <button type="button" className="btn btn--ghost btn--icon" style={{ color: 'var(--error)', width: 26, height: 26 }} onClick={() => removeExtractor(i)}><Trash2 size={12} /></button>
              </div>
              ))}
            </>
        }
      </div>

      {/* Assertions */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={SUBSECTION_LABEL}>Assertions{value.assertions.length > 0 ? ` (${value.assertions.length})` : ''}</span>
          <button type="button" className="btn btn--ghost btn--sm" style={{ fontSize: 11, gap: 4, padding: '2px 8px' }} onClick={addAssertion}>
            <Plus size={11} />Add
          </button>
        </div>
        {value.assertions.length === 0
          ? <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>No assertions — response will not be validated.</p>
          : <>
              <GridLabels columns="100px 64px 1fr 1fr 26px" labels={['Type', 'Op', 'Expected', 'Source', '']} />
              {value.assertions.map((as, i) => {
              const allOps = [
                { value: 'eq', label: '=' }, { value: 'ne', label: '≠' },
                { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
                { value: 'lt', label: '<' }, { value: 'lte', label: '≤' },
                { value: 'contains', label: 'contains' },
              ]
              const ops = as.type === 'status' ? allOps.filter(o => o.value !== 'contains') : allOps
              const expectedPlaceholder = as.type === 'status' ? '200' : as.type === 'header' ? 'text value' : 'value'
              const sourcePlaceholder = as.type === 'json' ? 'res.body.field' : 'Header-Name'
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 64px 1fr 1fr 26px', gap: 4, marginBottom: 4, alignItems: 'center' }}>
                  <Select style={INPUT_SM} value={as.type} options={ASSERTION_TYPE_OPTIONS} onChange={newType => {
                    const updated = [...value.assertions]
                    updated[i] = { ...updated[i], type: newType, expected: '', source: '' }
                    onChange({ ...value, assertions: updated })
                  }} />
                  <Select style={INPUT_SM} value={as.operator} onChange={op => updAssertion(i, 'operator', op)} options={ops} />
                  <input className="form-input" style={INPUT_SM} placeholder={expectedPlaceholder} value={as.expected} onChange={e => updAssertion(i, 'expected', e.target.value)} />
                  {as.type !== 'status'
                    ? <input className="form-input" style={INPUT_SM} placeholder={sourcePlaceholder} value={as.source} onChange={e => updAssertion(i, 'source', e.target.value)} />
                    : <div />
                  }
                  <button type="button" className="btn btn--ghost btn--icon" style={{ color: 'var(--error)', width: 26, height: 26 }} onClick={() => removeAssertion(i)}><Trash2 size={12} /></button>
                </div>
              )
              })}
            </>
        }
      </div>

      {/* Enabled toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
        <button type="button" className={`toggle-switch${value.enabled ? ' on' : ''}`} onClick={() => upd('enabled', !value.enabled)} />
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{value.enabled ? 'Enabled — runs as part of this scene' : 'Disabled — skipped when this scene runs'}</span>
      </div>
    </div>
  )
}

// ── Test action (resolves ${var} using scene variables) ──────────────────
// Result stays visible next to the form (not hidden behind a toggle) so the
// response body/headers are on-screen while you fill in extractors/assertions
// that reference them.

function TestPanel({ value, knownVars, toast }) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)

  const fieldsToScan = [value.url, value.body, ...value.headers.map(h => h.value), ...value.assertions.map(a => a.source)]
  const unresolved = [...new Set(fieldsToScan.flatMap(f => unresolvedVariables(f, knownVars)))]

  async function runTest() {
    setTesting(true)
    try {
      const { assertions, headers } = transformFrameForApi(value)
      const res = await api.post('/frames/test', {
        request: {
          method: value.method,
          url: resolveVariables(value.url.trim(), knownVars),
          headers: Object.fromEntries(Object.entries(headers).map(([k, v]) => [k, resolveVariables(v, knownVars)])),
          body: resolveVariables(value.body?.trim() || '', knownVars),
          timeout: Math.floor(Number(value.timeout) * 1000),
        },
        assertions,
      })
      setResult(res.frame)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div
      className="card hud-corners"
      style={{
        position: 'sticky', top: 12, padding: 14, background: 'var(--surface-raised)',
        display: 'flex', flexDirection: 'column', maxHeight: 'calc(100vh - 140px)',
      }}
    >
      <button
        type="button"
        onClick={runTest}
        disabled={testing || !value.url.trim()}
        style={{
          width: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '10px 14px', borderRadius: 8, cursor: testing || !value.url.trim() ? 'not-allowed' : 'pointer',
          border: '1px solid var(--blue)', background: 'var(--blue-dim)', color: 'var(--blue)',
          fontSize: 13, fontWeight: 700, opacity: !value.url.trim() ? 0.5 : 1,
        }}
      >
        {testing ? <><div className="spinner" style={{ width: 13, height: 13 }} />Testing…</> : <>▶ Test Frame</>}
      </button>

      {unresolved.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-muted)', marginTop: 10, flexShrink: 0 }}>
          <Info size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            References {unresolved.map(v => `\${${v}}`).join(', ')} from an earlier frame's extractor — not known yet, so this test won't substitute {unresolved.length === 1 ? 'it' : 'them'}.
          </span>
        </div>
      )}

      {result ? (
        // flex:1 + min-height:0 is what lets this scroll internally instead of
        // growing the panel (and the whole frame editor) taller — toggling
        // response body/headers below just extends the scroll area, not the layout.
        <div style={{ marginTop: 12, flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
          <FrameDetail frame={result} />
        </div>
      ) : (
        <p style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 10, marginBottom: 0, fontStyle: 'italic' }}>
          Run a test to see the response status, headers, and body here — useful for picking extractor/assertion paths.
        </p>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function SceneFrames() {
  const { scene, frames, refreshFrames, refreshScene, toast } = useOutletContext()

  const [staged, setStaged] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...BLANK_FRAME })
  const [expandedId, setExpandedId] = useState(null)
  const [expandedForm, setExpandedForm] = useState(null)
  const [savingFrame, setSavingFrame] = useState(false)
  const [committing, setCommitting] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [dragIdx, setDragIdx] = useState(null)
  const [dragOverIdx, setDragOverIdx] = useState(null)

  const knownVars = Object.fromEntries(
    Object.entries(scene.variables || {}).map(([k, v]) => [k, v.value])
  )

  // Full variable vocabulary for ${…} autocomplete — scene-seeded names plus
  // every enabled frame's extractor names. Not order-restricted (a variable
  // from a later frame will still autocomplete), but that's a fine trade
  // for "never mistype a name," which is the actual goal here.
  const allVarNames = [
    ...Object.keys(scene.variables || {}),
    ...frames.filter(f => f.enabled).flatMap(f => (f.extractors || []).map(ex => ex.name)),
  ].filter(Boolean)

  const allItems = [
    ...frames.map(f => ({ ...f, _it: 'c' })),
    ...staged.map(f => ({ ...f, _it: 's' })),
  ]

  function handleDragStart(e, idx) { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move' }
  function handleDragOver(e, idx) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverIdx !== idx) setDragOverIdx(idx) }

  function handleDrop(e, toIdx) {
    e.preventDefault()
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setDragOverIdx(null); return }

    const newAll = [...allItems]
    const [moved] = newAll.splice(dragIdx, 1)
    newAll.splice(toIdx, 0, moved)

    const newCommitted = newAll.filter(f => f._it === 'c').map(({ _it, ...f }) => f)
    const newStaged = newAll.filter(f => f._it === 's').map(({ _it, ...f }) => f)
    const orderChanged = newCommitted.some((f, i) => f._id !== frames[i]?._id)
    setStaged(newStaged)

    if (orderChanged && newCommitted.length > 0) {
      api.put(`/scenes/${scene.id}/frames/reorder`, { frameIds: newCommitted.map(f => f._id) })
        .then(refreshFrames)
        .catch(err => toast.error('Failed to save order: ' + err.message))
    }

    setDragIdx(null)
    setDragOverIdx(null)
  }

  function toggleExpand(frame) {
    if (expandedId === frame._id) {
      setExpandedId(null); setExpandedForm(null)
    } else {
      setExpandedId(frame._id)
      const values = frameToFormValues(frame)
      const formattedBody = formatJsonBody(values.body)
      setExpandedForm(formattedBody !== null ? { ...values, body: formattedBody } : values)
    }
  }

  async function handleFrameUpdate(frame) {
    setSavingFrame(true)
    try {
      const { extractors, assertions, headers } = transformFrameForApi(expandedForm)
      await api.put(`/scenes/${scene.id}/frames/${frame._id}`, {
        name: expandedForm.name.trim(),
        enabled: expandedForm.enabled,
        request: {
          method: expandedForm.method,
          url: expandedForm.url.trim(),
          headers,
          body: expandedForm.body.trim(),
          timeout: Math.floor(Number(expandedForm.timeout) * 1000),
        },
        extractors,
        assertions,
      })
      setExpandedId(null)
      setExpandedForm(null)
      toast.success(`Frame "${expandedForm.name}" updated`)
      refreshFrames()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingFrame(false)
    }
  }

  async function handleToggleFrameEnabled(frame) {
    try {
      await api.put(`/scenes/${scene.id}/frames/${frame._id}`, { enabled: !frame.enabled })
      refreshFrames()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function stageFrame() {
    if (!form.name.trim() || !form.url.trim()) return
    setStaged(s => [...s, { ...form, _sid: Date.now() }])
    setForm({ ...BLANK_FRAME })
    setShowForm(false)
  }

  async function commitAll() {
    setCommitting(true)
    let addedCount = 0
    for (const f of staged) {
      try {
        const { extractors, assertions, headers } = transformFrameForApi(f)
        await api.post(`/scenes/${scene.id}/frames`, {
          name: f.name.trim(),
          enabled: f.enabled,
          request: { method: f.method, url: f.url.trim(), headers, body: f.body.trim(), timeout: Math.floor(Number(f.timeout) * 1000) },
          extractors,
          assertions,
        })
        addedCount++
      } catch (err) {
        toast.error(`Failed to save "${f.name}": ${err.message}`)
      }
    }
    setStaged(s => s.slice(addedCount))
    if (addedCount > 0) {
      toast.success(`${addedCount} frame${addedCount !== 1 ? 's' : ''} saved`)
      refreshFrames()
      refreshScene()
    }
    setCommitting(false)
  }

  async function handleDelete(frame) {
    setDeletingId(frame._id)
    try {
      await api.delete(`/scenes/${scene.id}/frames/${frame._id}`)
      toast.success(`Frame "${frame.name}" deleted`)
      refreshFrames()
      refreshScene()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div>
      <VariablesPanel scene={scene} frames={frames} refreshScene={refreshScene} toast={toast} />

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={SUBSECTION_LABEL}>Pipeline — frames run in order top to bottom</span>
          {staged.length > 0 && (
            <button className="btn btn--primary btn--sm" disabled={committing} onClick={commitAll} style={{ fontSize: 11, gap: 4 }}>
              {committing ? <><div className="spinner" style={{ width: 11, height: 11 }} />Saving…</> : <><Save size={11} />Save {staged.length} Frame{staged.length !== 1 ? 's' : ''}</>}
            </button>
          )}
        </div>

        {allItems.length === 0 && !showForm && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 8px', fontStyle: 'italic' }}>
            No frames yet. Add one to define the HTTP requests this scene will run.
          </p>
        )}

        <div className="pipeline">
          {allItems.map((frame, idx) => {
            const isPending = frame._it === 's'
            const method = isPending ? frame.method : frame.request?.method
            const url = isPending ? frame.url : frame.request?.url
            const extCount = frame.extractors?.length || 0
            const assertCount = frame.assertions?.length || 0
            const isDragging = dragIdx === idx
            const isDragOver = dragOverIdx === idx && dragIdx !== null && dragIdx !== idx
            const isExpanded = !isPending && expandedId === frame._id
            const key = isPending ? frame._sid : frame._id
            const isDisabled = !frame.enabled
            const isLast = idx === allItems.length - 1

            return (
              <div key={key} className={`pipeline-step${isDisabled ? ' disabled' : ''}`}>
                <div className="pipeline-rail">
                  <div className="pipeline-node" style={{ borderColor: isPending ? 'var(--blue)' : isExpanded ? 'var(--blue)' : undefined, color: isPending ? 'var(--blue)' : undefined }}>
                    {idx + 1}
                  </div>
                  {(!isLast || !showForm) && <div className="pipeline-connector" />}
                </div>

                <div className="pipeline-card" style={{ borderColor: isDragOver ? 'var(--blue)' : isExpanded ? 'var(--blue)' : isPending ? 'var(--blue-border)' : undefined, background: isPending ? 'var(--blue-dim)' : undefined, opacity: isDragging ? 0.35 : 1 }}>
                  <div
                    draggable
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={e => handleDrop(e, idx)}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null) }}
                    onClick={() => { if (!isPending) toggleExpand(frame) }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: isPending ? 'grab' : 'pointer' }}
                  >
                    <span style={{ color: 'var(--border-bright)', fontSize: 14, userSelect: 'none', lineHeight: 1, cursor: 'grab' }} onMouseDown={e => e.stopPropagation()}>⠿</span>
                    <MethodBadge method={method} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, color: isDisabled ? 'var(--text-muted)' : 'var(--text)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {frame.name}
                        {isPending && <span style={{ fontSize: 10, color: 'var(--blue)', fontFamily: 'var(--font-mono)', fontWeight: 400 }}>pending</span>}
                      </div>
                      <div className="truncate" style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{url}</div>
                    </div>
                    {(extCount > 0 || assertCount > 0) && (
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {extCount > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{extCount} extractor{extCount !== 1 ? 's' : ''}</span>}
                        {assertCount > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{assertCount} assertion{assertCount !== 1 ? 's' : ''}</span>}
                      </div>
                    )}
                    <button
                      type="button"
                      className={`toggle-switch${frame.enabled ? ' on' : ''}`}
                      title={frame.enabled ? 'Disable frame' : 'Enable frame'}
                      onClick={e => {
                        e.stopPropagation()
                        isPending
                          ? setStaged(s => s.map(f => f._sid === frame._sid ? { ...f, enabled: !f.enabled } : f))
                          : handleToggleFrameEnabled(frame)
                      }}
                    />
                    <button
                      className="btn btn--ghost btn--icon"
                      style={{ color: isPending ? 'var(--text-muted)' : 'var(--error)', opacity: deletingId === frame._id ? 0.5 : 1 }}
                      disabled={!isPending && deletingId === frame._id}
                      onClick={e => {
                        e.stopPropagation()
                        isPending ? setStaged(s => s.filter(f => f._sid !== frame._sid)) : handleDelete(frame)
                      }}
                      title={isPending ? 'Remove' : 'Delete frame'}
                    >
                      {!isPending && deletingId === frame._id ? <div className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={13} />}
                    </button>
                  </div>

                  {isExpanded && expandedForm && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 65fr) minmax(280px, 35fr)', gap: 16, alignItems: 'start' }}>
                        <FrameFormBuilder value={expandedForm} onChange={setExpandedForm} knownVarNames={allVarNames} />
                        <TestPanel value={expandedForm} knownVars={knownVars} toast={toast} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 12 }}>
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setExpandedId(null); setExpandedForm(null) }}>Cancel</button>
                        <button type="button" className="btn btn--primary btn--sm" disabled={savingFrame || !expandedForm.name.trim() || !expandedForm.url.trim()} onClick={() => handleFrameUpdate(frame)}>
                          {savingFrame ? <><div className="spinner" style={{ width: 12, height: 12 }} />Saving…</> : <><Save size={12} />Save Changes</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {!showForm && (
            <div className="pipeline-step">
              <div className="pipeline-rail">
                <div className="pipeline-node" style={{ borderStyle: 'dashed', borderColor: 'var(--blue)', color: 'var(--blue)' }}>
                  <Plus size={12} />
                </div>
              </div>
              <button type="button" className="pipeline-card pipeline-card--ghost" onClick={() => setShowForm(true)}>
                <Plus size={14} />Add Frame
              </button>
            </div>
          )}
        </div>

        {showForm && (
          <div style={{ padding: 14, borderRadius: 9, border: '1px dashed var(--blue)', background: 'var(--blue-dim)', marginTop: allItems.length > 0 ? 8 : 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 65fr) minmax(280px, 35fr)', gap: 16, alignItems: 'start' }}>
              <FrameFormBuilder value={form} onChange={setForm} knownVarNames={allVarNames} />
              <TestPanel value={form} knownVars={knownVars} toast={toast} />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => { setShowForm(false); setForm({ ...BLANK_FRAME }) }}>Cancel</button>
              <button type="button" className="btn btn--primary btn--sm" disabled={!form.name.trim() || !form.url.trim()} onClick={stageFrame}>
                <Plus size={12} />Stage Frame
              </button>
            </div>
          </div>
        )}

        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          Frames run in order. If a frame's assertions fail, the run stops there — later frames are skipped, not executed.
        </p>
      </div>
    </div>
  )
}
