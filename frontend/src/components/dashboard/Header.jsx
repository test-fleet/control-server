import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    AppBar,
    Toolbar,
    Typography,
    IconButton,
    Menu,
    MenuItem,
    Avatar,
    Box,
    Divider,
    ListItemIcon
} from '@mui/material';
import {
    Menu as MenuIcon,
    AccountCircle,
    Logout
} from '@mui/icons-material';

function Header() {

    const navigate = useNavigate();
    const { user, logout } = useAuth();

    const [anchorEl, setAnchorEl] = useState(null);
    const menuOpen = Boolean(anchorEl);

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        handleMenuClose();
        await logout();
        navigate('/login');
    };

    const getUserIntitials = () => {
        if (!user) return '?';

        if(user.name) {
            const names = user.name.split(' ');
            if (names.length >= 2) {
                return '${name[0][0]}${names[names.length - 1][0]'.toUpperCase();
            }
            return user.name.substring(0, 2).toUpperCase();
        }

        if (user.email) {
            return user.email[0].toUpperCase();
        }

        return 'U';
    };

    return (
        <AppBar
            position="fixed"
            sx={{
                zIndex: (theme) => theme.zIndex.drawer + 1,
                //width: { sm: 'calc(100% - ${drawerWidth}px)' },
                //ml: { sm: '${drawerWidth}px' }
            }}
        >
            <Toolbar>
                <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1}}>
                    Control Server Dashboard
                </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {user && user.email && (
                    <Typography
                        variant="body2"
                        sx={{ display: { xs: 'none', md: 'block' } }}
                    >
                        {user.email}
                    </Typography>
                )}
                <IconButton
                    onClick={handleMenuOpen}
                    size="samll"
                    aria-controls={menuOpen ? 'user-menu' : undefined}
                    aria-haspopup="true"
                    aria-expanded={menuOpen ? 'true' : undefined}
                >
                    <Avatar
                        sx={{
                            width: 32,
                            height: 32,
                            bgcolor: 'secondary.main',
                            fontSize: '0.875rem'
                        }}
                    >
                        {getUserIntitials()}
                    </Avatar>
                </IconButton>
            </Box>

            <Menu
                id="user-menu"
                anchorEl={anchorEl}
                open={menuOpen}
                onClose={handleMenuClose}
                onClick={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom'}}
                PeperProps={{
                    elevation: 3,
                    sx: { 
                        minWidth: 200,
                        mt: 1.5
                    }
                }}
            >
                <Box sx={{ px: 2, py: 1.5 }}>
                    <Typography variant='subtitle2' sx={{ fontWeight: 600 }}>
                        {user?.name || user?.email || 'User'}
                    </Typography>
                    {user?.email && user?.name && ( 
                        <Typography variant="caption" color="text.secondary">
                            {user.email}
                        </Typography>
                    )}
                </Box>

                <Divider />

                <MenuItem>
                    <ListItemIcon>
                        <AccountCircle fontSize="small" />
                    </ListItemIcon>
                    Profile
                </MenuItem>

                <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                        <Logout fontSize="small" />
                    </ListItemIcon>
                    Logout
                </MenuItem>
            </Menu>
        </Toolbar>
    </AppBar>
    );
};

export default Header;