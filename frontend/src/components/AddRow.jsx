import { Plus } from 'lucide-react'

export default function AddRow({ colSpan, label, onClick }) {
  return (
    <tr className="add-row" onClick={onClick}>
      <td colSpan={colSpan}>
        <button className="add-row-btn" type="button">
          <Plus size={13} />
          {label}
        </button>
      </td>
    </tr>
  )
}
