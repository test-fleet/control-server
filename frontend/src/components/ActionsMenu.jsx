import { useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

// Generic row-actions popover, shared by Scenes/Runners/Users list pages.
// items: [{ label, icon: LucideIcon, onClick, danger }] | [{ divider: true }]
export default function ActionsMenu({ items, icon, title = 'Actions' }) {
  const TriggerIcon = icon || MoreHorizontal
  const [pos, setPos] = useState(null)

  function toggle(e) {
    e.stopPropagation()
    if (pos) { setPos(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
  }

  function act(fn) { setPos(null); fn() }

  return (
    <>
      <button className="btn btn--ghost btn--icon" onClick={toggle} title={title}>
        <TriggerIcon size={15} />
      </button>
      {pos && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 119 }} onClick={() => setPos(null)} />
          <div className="actions-menu" style={{ top: pos.top, right: pos.right }}>
            {items.map((item, i) => item.divider ? (
              <div key={i} className="actions-menu-divider" />
            ) : (
              <button
                key={i}
                className={`actions-menu-item${item.danger ? ' actions-menu-item--danger' : ''}`}
                onClick={() => act(item.onClick)}
              >
                {item.icon && <item.icon size={13} />}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
