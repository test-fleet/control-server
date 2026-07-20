import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import AppShell from './components/AppShell'
import Login from './pages/Login'
import AuthCallback from './pages/AuthCallback'
import Dashboard from './pages/Dashboard'
import Scenes from './pages/Scenes'
import Users from './pages/Users'
import System from './pages/System'
import Organization from './pages/settings/Organization'
import RunnerDetail from './pages/RunnerDetail'
import RunDetail from './pages/RunDetail'
import SceneDetailLayout from './pages/scenes/SceneDetailLayout'
import SceneFrames from './pages/scenes/SceneFrames'
import SceneRuns from './pages/scenes/SceneRuns'
import SceneSettings from './pages/scenes/SceneSettings'

const Runners = lazy(() => import('./pages/Runners'))
const Runs    = lazy(() => import('./pages/Runs'))

function LazyFallback() {
  return <div className="loading-screen"><div className="spinner spinner--lg" /></div>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppShell />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />

                <Route path="/scenes" element={<Scenes />} />
                <Route path="/scenes/:id" element={<SceneDetailLayout />}>
                  <Route index element={<SceneFrames />} />
                  <Route path="runs" element={<SceneRuns />} />
                  <Route path="settings" element={<SceneSettings />} />
                </Route>

                <Route path="/runs" element={<Suspense fallback={<LazyFallback />}><Runs /></Suspense>} />
                <Route path="/runs/:runId" element={<RunDetail />} />

                <Route path="/runners" element={<Suspense fallback={<LazyFallback />}><Runners /></Suspense>} />
                <Route path="/runners/:id" element={<RunnerDetail />} />

                <Route path="/settings/system" element={<System />} />
                <Route element={<AdminRoute />}>
                  <Route path="/settings/organization" element={<Organization />} />
                  <Route path="/settings/users" element={<Users />} />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
