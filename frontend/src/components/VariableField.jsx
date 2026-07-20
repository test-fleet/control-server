import { useState, useRef } from 'react'

// Finds an unclosed "${" before the cursor and returns its start index plus
// whatever partial name has been typed so far — null if the cursor isn't
// inside a ${...} reference (already closed, or no "${" at all).
function activeVariableQuery(text, cursor) {
  const upto = text.slice(0, cursor)
  const start = upto.lastIndexOf('${')
  if (start === -1) return null
  const between = upto.slice(start + 2)
  if (between.includes('}') || between.includes('{') || between.includes('$') || /\s/.test(between)) return null
  // The cursor can be inside an *already-complete* ${varName} — e.g. the
  // user clicked to edit it, not to start a new reference — which the
  // backward-only scan above can't tell apart from "actively typing a new
  // one". Check forward: if the rest of the identifier run immediately
  // closes with "}", this is an existing reference, not a live query.
  const restOfToken = text.slice(cursor).match(/^[A-Za-z0-9_]*/)[0]
  if (text[cursor + restOfToken.length] === '}') return null
  return { start, query: between }
}

// Drop-in replacement for a plain <input>/<textarea> that autocompletes
// ${variableName} references against a known variable list, so a scene/frame
// variable never gets mistyped. Anchored to the field (not the exact cursor
// pixel position) to keep this simple — good enough for the short values
// these fields typically hold.
export default function VariableField({ as = 'input', value, onChange, knownVars = [], className = 'form-input', style, ...rest }) {
  const ref = useRef(null)
  const [query, setQuery] = useState(null) // { start, query } | null
  const [highlighted, setHighlighted] = useState(0)

  const matches = query
    ? knownVars.filter(n => n.toLowerCase().includes(query.query.toLowerCase())).slice(0, 8)
    : []

  function sync() {
    const el = ref.current
    if (!el) return
    const q = activeVariableQuery(el.value, el.selectionStart ?? el.value.length)
    setQuery(q)
    setHighlighted(0)
  }

  // Recomputes the ${ position fresh from the live DOM instead of trusting
  // the `query` state closure — state can lag a keystroke behind the actual
  // input value/cursor (e.g. Enter's keydown firing before a queued state
  // update from the previous keystroke lands), which was inserting at a
  // stale position.
  function commit(name) {
    const el = ref.current
    if (!el || name == null) return
    const cursor = el.selectionStart ?? el.value.length
    const q = activeVariableQuery(el.value, cursor)
    if (!q) return
    const next = el.value.slice(0, q.start) + '${' + name + '}' + el.value.slice(cursor)
    const newCursor = q.start + name.length + 3
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(newCursor, newCursor)
    })
  }

  function onKeyDown(e) {
    if (!query || matches.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(matches.length - 1, h + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(0, h - 1)) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit(matches[highlighted]) }
    else if (e.key === 'Escape') { e.preventDefault(); setQuery(null) }
  }

  const Tag = as

  return (
    <div className="varfield">
      <Tag
        ref={ref}
        className={className}
        style={style}
        value={value}
        onChange={e => { onChange(e.target.value); sync() }}
        onSelect={sync}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 120)}
        {...rest}
      />
      {query && matches.length > 0 && (
        <div className="varsuggest-menu">
          {matches.map((name, i) => (
            <div
              key={name}
              className={`varsuggest-option${i === highlighted ? ' highlighted' : ''}`}
              onMouseDown={e => { e.preventDefault(); commit(name) }}
            >
              {'${' + name + '}'}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
