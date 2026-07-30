import { useState } from 'react'
import { FrameDetail } from './FrameDetail'
import Waterfall from './Waterfall'
import StatusPulse from './StatusPulse'
import { statusColor } from '../lib/statusColor'

export { statusColor }

// A frame is "not executed" if the scene defined it *as of this run* (still
// enabled, and created before the run started — a frame added to the scene
// after the fact never ran here and shouldn't be shown as skipped) but this
// runner's result has no entry for it — fail-fast means a failed frame stops
// the run, so everything after it just never ran.
function RunnerFrames({ runner, allFrames }) {
  const [selected, setSelected] = useState(null)
  const frames = runner.frames || []
  const executedIds = new Set(frames.map(f => f.frameId))
  const runStartedAt = new Date(runner.startedAt)
  const skipped = (allFrames || []).filter(f => f.enabled && !executedIds.has(f._id) && new Date(f.createdAt) < runStartedAt)

  const combined = [
    ...frames.map(f => ({ ...f, _key: f.frameId })),
    ...skipped.map(f => ({ order: f.order, name: f.name, request: f.request, status: 'not_executed', durationMs: 0, _key: f._id })),
  ].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  if (combined.length === 0) {
    return <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>No frame data recorded for this runner.</p>
  }

  const selectedFrame = combined.find(f => f._key === selected)

  return (
    <div>
      <Waterfall frames={combined} selectedId={selected} onSelect={key => setSelected(k => k === key ? null : key)} />
      {selectedFrame && (
        selectedFrame.status === 'not_executed' ? (
          <div className="alert alert--info" style={{ marginTop: 10 }}>
            This frame was skipped — an earlier frame's assertion failed and stopped the run before this step.
          </div>
        ) : (
          <div style={{ marginTop: 4 }}><FrameDetail frame={selectedFrame} /></div>
        )
      )}
    </div>
  )
}

// Runner-tabs + frame waterfall for a single run — shared by the standalone
// RunDetail page and the inline expand-in-place row on the Runs list.
export default function RunDetailPanel({ data, allFrames }) {
  const [runnerIdx, setRunnerIdx] = useState(0)
  const runners = data.runners || []
  const safeIdx = Math.min(runnerIdx, runners.length - 1)
  const runner = runners[safeIdx]

  if (runners.length === 0) {
    return <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>No runner results yet.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14 }}>
        {runners.map((r, i) => (
          <button
            key={r.runnerId}
            onClick={() => setRunnerIdx(i)}
            style={{
              display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
              padding: '5px 11px', borderRadius: 7, cursor: 'pointer', fontSize: 12,
              fontWeight: i === safeIdx ? 600 : 400,
              border: '1px solid',
              borderColor: i === safeIdx ? statusColor(r.status) : 'var(--border)',
              background: i === safeIdx ? 'var(--surface-raised)' : 'transparent',
              color: 'var(--text)',
            }}
          >
            <StatusPulse color={statusColor(r.status)} live={r.status === 'pending'} size={7} />
            {r.runnerName}
          </button>
        ))}
      </div>
      {runner && <RunnerFrames key={safeIdx} runner={runner} allFrames={allFrames} />}
    </div>
  )
}
