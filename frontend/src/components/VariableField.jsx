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

const CLOSERS = { '{': '}', '[': ']' }

// Returns the whitespace this line opens with, so Enter can continue it and
// the brace-expand case can indent one level deeper — a plain textarea has
// no concept of "current indent" on its own.
function currentLineIndent(text, cursor) {
  const lineStart = text.lastIndexOf('\n', cursor - 1) + 1
  const line = text.slice(lineStart, cursor)
  return line.match(/^[ \t]*/)[0]
}

// ── JSON syntax highlighting ──────────────────────────────────────────────
// Regex-based rather than a real JSON parser on purpose: the body is edited
// live, so it's mid-typing/invalid JSON most of the time (unterminated
// strings, dangling commas). A lexer just needs to color the tokens it can
// recognize and pass everything else through unstyled, never throw.
//
// ${var} is listed first so it wins the match at its own position — e.g. in
// a bare/unquoted placeholder like `"count": ${count}`, the `{`/`}` inside
// it would otherwise get peeled off by the punctuation alternative before
// the placeholder is ever seen as a whole. Inside a quoted string ("${tok}")
// this alternative never gets a chance to fire — the string alternative
// already claims that whole run starting from the opening quote — so those
// are pulled out separately below via splitVars on the matched string.
const JSON_TOKEN_RE = /\$\{[A-Za-z0-9_]+\}|"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b|[{}[\]:,]/g
const VAR_RE = /\$\{[A-Za-z0-9_]+\}/g

// Splits any embedded ${var} placeholder(s) out of a string/key token's text
// so they get their own color instead of inheriting the string's.
function splitVars(text, baseType) {
  const parts = []
  let last = 0
  let m
  VAR_RE.lastIndex = 0
  while ((m = VAR_RE.exec(text)) !== null) {
    if (m.index > last) parts.push({ type: baseType, text: text.slice(last, m.index) })
    parts.push({ type: 'var', text: m[0] })
    last = VAR_RE.lastIndex
  }
  if (last < text.length || parts.length === 0) parts.push({ type: baseType, text: text.slice(last) })
  return parts
}

function tokenizeJson(text) {
  const tokens = []
  let lastIndex = 0
  let m
  JSON_TOKEN_RE.lastIndex = 0
  while ((m = JSON_TOKEN_RE.exec(text)) !== null) {
    if (m.index > lastIndex) tokens.push({ type: 'plain', text: text.slice(lastIndex, m.index) })
    const raw = m[0]
    if (raw[0] === '$') {
      tokens.push({ type: 'var', text: raw })
    } else if (raw[0] === '"') {
      const type = /^\s*:/.test(text.slice(m.index + raw.length)) ? 'key' : 'string'
      tokens.push(...splitVars(raw, type))
    } else if (raw === 'true' || raw === 'false' || raw === 'null') {
      tokens.push({ type: 'bool', text: raw })
    } else if (raw.length === 1 && '{}[]:,'.includes(raw)) {
      tokens.push({ type: 'punct', text: raw })
    } else {
      tokens.push({ type: 'number', text: raw })
    }
    lastIndex = JSON_TOKEN_RE.lastIndex
  }
  if (lastIndex < text.length) tokens.push({ type: 'plain', text: text.slice(lastIndex) })
  return tokens
}

// Drop-in replacement for a plain <input>/<textarea> that autocompletes
// ${variableName} references against a known variable list, so a scene/frame
// variable never gets mistyped. Anchored to the field (not the exact cursor
// pixel position) to keep this simple — good enough for the short values
// these fields typically hold.
//
// `autoClose` opts into code-editor-style bracket/quote pairing (auto-insert
// the closing character, skip over it instead of duplicating, delete both
// halves of an empty pair on backspace, expand {}/[] on Enter) — scoped to
// an explicit prop rather than always-on since it'd be unwelcome noise on a
// plain single-line URL/header field.
//
// `highlightJson` (textarea only) draws colored JSON syntax behind the real
// textarea, which is made transparent so its native caret/selection still
// render on top — the standard "fake syntax highlighting" trick for a plain
// textarea, short of pulling in a real code-editor dependency.
export default function VariableField({ as = 'input', value, onChange, knownVars = [], className = 'form-input', style, onBlur, onScroll, autoClose = false, highlightJson = false, ...rest }) {
  const ref = useRef(null)
  const overlayRef = useRef(null)
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

  // Same as commit()'s rAF pattern, plus a sync() so the ${…} autocomplete
  // (which normally only re-checks on the native onChange/onSelect handlers
  // below) still sees the new cursor position — every branch here bypasses
  // those via preventDefault.
  function place(start, end = start) {
    const el = ref.current
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start, end)
      sync()
    })
  }

  function handleAutoClose(e) {
    const el = ref.current
    if (!el) return
    const { value: text, selectionStart: start, selectionEnd: end } = el
    const hasSelection = start !== end
    const before = text.slice(0, start)
    const after = text.slice(end)

    if (e.key in CLOSERS) {
      e.preventDefault()
      const close = CLOSERS[e.key]
      const selected = text.slice(start, end)
      onChange(before + e.key + selected + close + after)
      place(start + 1, hasSelection ? start + 1 + selected.length : start + 1)
      return
    }

    if (e.key === '"') {
      if (!hasSelection && after[0] === '"') { e.preventDefault(); place(start + 1); return }
      e.preventDefault()
      const selected = text.slice(start, end)
      onChange(before + '"' + selected + '"' + after)
      place(start + 1, hasSelection ? start + 1 + selected.length : start + 1)
      return
    }

    if ((e.key === '}' || e.key === ']') && !hasSelection && after[0] === e.key) {
      e.preventDefault()
      place(start + 1)
      return
    }

    if (e.key === 'Backspace' && !hasSelection && CLOSERS[before.slice(-1)] === after[0]) {
      e.preventDefault()
      onChange(before.slice(0, -1) + after.slice(1))
      place(start - 1)
      return
    }

    if (e.key === 'Enter') {
      const opener = before.slice(-1)
      if (CLOSERS[opener] === after[0]) {
        e.preventDefault()
        const indent = currentLineIndent(text, start)
        const inner = `\n${indent}  `
        onChange(before + inner + `\n${indent}` + after)
        place(start + inner.length)
        return
      }
      e.preventDefault()
      const indent = currentLineIndent(text, start)
      onChange(before + '\n' + indent + after)
      place(start + 1 + indent.length)
    }
  }

  function onKeyDown(e) {
    if (query && matches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setHighlighted(h => Math.min(matches.length - 1, h + 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setHighlighted(h => Math.max(0, h - 1)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); commit(matches[highlighted]); return }
      if (e.key === 'Escape') { e.preventDefault(); setQuery(null); return }
      return
    }
    if (autoClose) handleAutoClose(e)
  }

  const Tag = as

  // Every property that affects text metrics/wrapping has to be pinned to
  // the exact same value on both layers, not just left to inherit — a native
  // <textarea> resolves "normal" line-height from its own font metrics as a
  // form control, which doesn't reliably match a plain <pre> even with the
  // same font-family/size, and the two default to different wrap algorithms
  // (word-break vs overflow-wrap). Either mismatch drifts the overlay's text
  // away from the real caret, worse with every line — this is what actually
  // keeps them pixel-aligned.
  const textMetrics = {
    fontSize: style?.fontSize,
    fontFamily: style?.fontFamily,
    lineHeight: 1.5,
    letterSpacing: 'normal',
    tabSize: 2,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
    wordBreak: 'normal',
  }

  // The textarea has to paint after (visually on top of) the overlay for its
  // native caret/selection to be visible — `position: relative` makes it a
  // positioned element too, so DOM order (overlay first) decides paint order
  // instead of the default "positioned always beats static" rule burying it.
  const fieldStyle = highlightJson
    ? { ...style, ...textMetrics, position: 'relative', background: 'transparent', color: 'transparent', caretColor: 'var(--text)' }
    : style

  return (
    <div className="varfield">
      {highlightJson && (
        <pre ref={overlayRef} className="json-highlight-overlay" style={textMetrics} aria-hidden="true">
          {tokenizeJson(value || '').map((tok, i) => (
            tok.type === 'plain' ? tok.text : <span key={i} className={`jsontok-${tok.type}`}>{tok.text}</span>
          ))}
        </pre>
      )}
      <Tag
        ref={ref}
        className={className}
        style={fieldStyle}
        value={value}
        onChange={e => { onChange(e.target.value); sync() }}
        onSelect={sync}
        onKeyDown={onKeyDown}
        onBlur={e => { setTimeout(() => setQuery(null), 120); onBlur?.(e) }}
        onScroll={e => { if (overlayRef.current) { overlayRef.current.scrollTop = e.target.scrollTop; overlayRef.current.scrollLeft = e.target.scrollLeft }; onScroll?.(e) }}
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
