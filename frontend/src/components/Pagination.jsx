import { useState, useEffect } from 'react'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'

export default function Pagination({ page, totalPages, onPageChange }) {
  const [input, setInput] = useState(String(page))

  useEffect(() => {
    setInput(String(page))
  }, [page])

  function commit(val) {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      if (n !== page) onPageChange(n)
    } else {
      setInput(String(page))
    }
  }

  const inputWidth = `${Math.max(2, String(totalPages).length + 1)}ch`

  return (
    <div className="pagination">
      <button
        className="btn btn--ghost btn--sm"
        disabled={page <= 1}
        onClick={() => onPageChange(1)}
        title="First page"
        style={{ padding: '3px 6px' }}
      >
        <ChevronsLeft size={14} />
      </button>
      <button
        className="btn btn--ghost btn--sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft size={14} />Previous
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0 2px', fontSize: 12, color: 'var(--text-muted)' }}>
        <span>Page</span>
        <input
          type="text"
          inputMode="numeric"
          value={input}
          onChange={e => setInput(e.target.value)}
          onBlur={() => commit(input)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.currentTarget.blur(); commit(input) }
            if (e.key === 'Escape') { setInput(String(page)); e.currentTarget.blur() }
          }}
          style={{
            width: inputWidth,
            textAlign: 'center',
            padding: '2px 4px',
            fontSize: 12,
            background: 'var(--surface-raised)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text)',
            fontFamily: 'monospace',
            outline: 'none',
          }}
          onFocus={e => e.currentTarget.select()}
        />
        <span>of {totalPages}</span>
      </div>

      <button
        className="btn btn--ghost btn--sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next<ChevronRight size={14} />
      </button>
      <button
        className="btn btn--ghost btn--sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(totalPages)}
        title="Last page"
        style={{ padding: '3px 6px' }}
      >
        <ChevronsRight size={14} />
      </button>
    </div>
  )
}
