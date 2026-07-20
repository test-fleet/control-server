import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Hard-gates a route to admins. Unlike hiding a nav link, this actually
// stops a non-admin who navigates here directly (the backend doesn't
// role-gate every GET, so the page would otherwise render fine for them).
export default function AdminRoute() {
  const { user } = useAuth()
  if (user?.role !== 'admin') return <Navigate to="/dashboard" replace />
  return <Outlet />
}
