export default function Badge({ variant, children }) {
  return (
    <span className={`badge badge--${variant}`}>
      {children}
    </span>
  )
}
