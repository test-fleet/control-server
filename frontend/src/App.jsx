import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Scenes from './pages/Scenes'
import Users from './pages/Users'
import System from './pages/System'

const Runners = lazy(() => import('./pages/Runners'))
const Runs    = lazy(() => import('./pages/Runs'))

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/runners" element={
                <Suspense fallback={<div className="loading-screen"><div className="spinner spinner--lg" /></div>}>
                  <Runners />
                </Suspense>
              } />
                <Route path="/scenes" element={<Scenes />} />
                <Route path="/runs" element={
                  <Suspense fallback={<div className="loading-screen"><div className="spinner spinner--lg" /></div>}>
                    <Runs />
                  </Suspense>
                } />
                <Route path="/users" element={<Users />} />
              <Route path="/system" element={<System />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
