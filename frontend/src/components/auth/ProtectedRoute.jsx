import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Box, CircularProgress } from '@mui/material';

function ProtectedRoute({ children }) {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '100vh',
                    width: '100vw',
                    backgroundColor: '#f5f5f5'
                }}
            >
                <CircularProgress size={60} />
            </Box>
        );
    }

    if (!isAuthenticated) {
        return (
            <Navigate 
                to="/login"
                replace
                state={{ from: location }}
            />
        );
    }

    return children;

}

export default ProtectedRoute;