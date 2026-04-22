import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Box, Container, Paper, Typography, Button, CircularProgress, Alert } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';

function LoginPage() {
    const navigate = useNavigate();
    const { isAuthenticated, isLoading, error, login } = useAuth();

    useEffect(() => {
        if(isAuthenticated && !isLoading) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, isLoading, navigate]);

    const handleLogin = () => {
        login();
    };

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
                <CircularProgress />
            </Box>
        );
    }

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
            <Container maxWidth="sm">
                <Paper
                    elevation={3}
                    sx ={{
                        padding: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        borderRadius: 2
                    }}
                >
                    <Typography
                        component="h1"
                        variant="h4"
                        sx={{
                            marginBottom: 1,
                            fontWeight: 600,
                            color: 'primary.main'
                        }}
                    >
                        Control Server
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        fullWidth
                        startIcon={<LoginIcon />}
                        onClick={handleLogin}
                        sx={{
                        paddingY: 1.5,
                        textTransform: 'none',
                        fontSize: '1rem',
                        fontWeight: 500
                        }}
                    >
                        Login
                    </Button>
                </Paper>
            </Container>
        </Box>
    );
}

export default LoginPage;