import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';

//Components
import LoginPage from './components/auth/LoginPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import DashboardLayout from './components/dashboard/DashboardLayout';
import DashboardHome from './components/dashboard/pages/DashboardHome';
import UserAccounts from './components/dashboard/pages/UserAccounts';

function App() {
    return (
        <BrowserRouter>
            <AuthProvider>
                <Routes>
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route 
                        path="/dashboard/*"
                        element={
                            <ProtectedRoute>
                                <DashboardLayout>
                                    <Routes>
                                        <Route index element={<DashboardHome />} />
                                        <Route path="accounts" element={<UserAccounts />} />
                                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                                    </Routes>
                                </DashboardLayout>
                            </ProtectedRoute>
                        }
                    />
                    <Route path="*" element={<Navigate to="dashboard" replace />} />
                </Routes>
            </AuthProvider>
        </BrowserRouter>
    )
}

export default App;