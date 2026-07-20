import { useState, useRef, useEffect } from 'react'
import { Check, ChevronDown } from 'lucide-react'

// Custom listbox to replace native <select> — the native element can't be
// themed once open (the popup is OS-drawn), so anywhere the app needs the
// dropdown itself to match the theme, this renders its own options panel
// instead. Options are [{ value, label }]; onChange receives the raw value
// (not an event), so callers don't need e.target.value / Number() coercion.
export default function Select({ value, onChange, options, placeholder = 'Select…', style, wrapperStyle, disabled, id }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [highlighted, setHighlighted] = useState(0)
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)

  const selectedIdx = options.findIndex(o => String(o.value) === String(value))
  const selected = selectedIdx >= 0 ? options[selectedIdx] : null

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  function openMenu() {
    if (disabled || options.length === 0) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    setHighlighted(Math.max(0, selectedIdx))
    setOpen(true)
  }

  function commit(idx) {
    const opt = options[idx]
    if (!opt) return
    onChange(opt.value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function onKeyDown(e) {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        openMenu()
      }
      return
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(options.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); commit(highlighted) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); triggerRef.current?.focus() }
    else if (e.key === 'Tab') { setOpen(false) }
  }

  return (
    <div className="select" ref={wrapRef} style={wrapperStyle}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        className="select-trigger"
        style={style}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="select-value">
          {selected ? selected.label : <span className="text-muted">{placeholder}</span>}
        </span>
        <ChevronDown size={13} className="select-chevron" />
      </button>

      {open && pos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 159 }} onMouseDown={() => setOpen(false)} />
          <div className="select-menu" role="listbox" style={{ top: pos.top, left: pos.left, minWidth: pos.width }}>
            {options.map((o, i) => (
              <div
                key={o.value}
                role="option"
                aria-selected={i === selectedIdx}
                className={`select-option${i === highlighted ? ' highlighted' : ''}${i === selectedIdx ? ' selected' : ''}`}
                onMouseEnter={() => setHighlighted(i)}
                onMouseDown={e => { e.preventDefault(); commit(i) }}
              >
                <span className="truncate">{o.label}</span>
                {i === selectedIdx && <Check size={13} style={{ flexShrink: 0 }} />}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
