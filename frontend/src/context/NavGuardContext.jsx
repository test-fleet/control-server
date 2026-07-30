import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react'
import Modal from '../components/Modal'

// Lets a page (currently just scene editing) register "don't let the user
// silently navigate away from this" state that the *global* nav surfaces —
// the rail links, the ⌘K command palette, and any in-page back-link — all
// have to respect. Placed above <Outlet/> in AppShell so it survives page
// swaps and is reachable from all three of those trigger points, which live
// in different parts of the component tree from whatever page registers it.
//
// Deliberately not a `useBlocker`-based solution: the app uses a plain
// <BrowserRouter>, not a data router, so that hook isn't available without a
// larger router migration. This covers every in-app navigation click, which
// is the actual reported gap — it does not catch browser back/forward or a
// hard reload/tab close.
const NavGuardContext = createContext(null)

export function NavGuardProvider({ children }) {
  const [guard, setGuard] = useState(null)
  const [pending, setPending] = useState(null) // { navigate, path } awaiting a decision
  const [resolving, setResolving] = useState(false)

  // requestNavigation only ever needs guard's truthiness, not its content —
  // reading it from a ref (instead of closing over the `guard` state
  // directly) keeps this callback's identity permanently stable. It used to
  // depend on `guard`, which the scene editor replaces with a new object on
  // every keystroke of an in-progress frame draft; that churned the context
  // value below and forced every consumer (rail nav, every link in it, ⌘K)
  // to re-render on every keystroke, which is what made the dialog itself
  // feel laggy — it was competing with an app-wide re-render storm for the
  // main thread, not a CSS animation problem.
  const guardRef = useRef(guard)
  guardRef.current = guard

  const requestNavigation = useCallback((navigate, path) => {
    if (guardRef.current) {
      setPending({ navigate, path })
      return false
    }
    navigate(path)
    return true
  }, [])

  // Stable across guard/pending/resolving churn — only setGuard/requestNavigation
  // (both permanently stable) are actually exposed, so this should never change.
  const value = useMemo(() => ({ setGuard, requestNavigation }), [requestNavigation])

  async function resolve(action) {
    if (action === 'cancel') { setPending(null); return }
    if (action === 'confirm') {
      setResolving(true)
      const ok = await guard.onConfirm()
      setResolving(false)
      if (!ok) return // save/stage failed — stay put, keep the dialog open
    } else if (action === 'discard') {
      guard.onDiscard()
    }
    const { navigate, path } = pending
    setPending(null)
    navigate(path)
  }

  return (
    <NavGuardContext.Provider value={value}>
      {children}
      {pending && guard && (
        <Modal title={guard.title} onClose={() => resolve('cancel')}>
          <div className="modal-body">
            <p style={{ color: 'var(--text-dim)' }}>{guard.message}</p>
            {guard.hint && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{guard.hint}</p>}
          </div>
          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={() => resolve('cancel')}>Cancel</button>
            <button className="btn btn--ghost" style={{ color: 'var(--error)' }} onClick={() => resolve('discard')}>Discard</button>
            <button className="btn btn--primary" disabled={!guard.canConfirm || resolving} onClick={() => resolve('confirm')}>
              {resolving ? <><div className="spinner" style={{ width: 12, height: 12 }} />{guard.confirmingLabel}…</> : guard.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
    </NavGuardContext.Provider>
  )
}

export function useNavGuard() {
  const ctx = useContext(NavGuardContext)
  if (!ctx) throw new Error('useNavGuard must be used within a NavGuardProvider')
  return ctx
}
