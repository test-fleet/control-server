import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Drawer,
    Toolbar,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Divider,
    Box
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    People as PeopleIcon
} from '@mui/icons-material';

const navigationItems = [
    {
        text: 'Dashboard',
        icon: <DashboardIcon />,
        path: '/dashboard',
        description: 'Overview and main dashboard'
    },
    {
        text: 'User Accounts',
        icon: <PeopleIcon />,
        path: '/dashboard/accounts',
        decription: 'Manage user accounts'
    }
];

function Sidebar({ drawerWidth }) {

    const navigate = useNavigate();
    const location = useLocation();

    const isActive = (path) => {
        if (path === '/dashboard') {
            return location.pathname === '/dashboard';
        }
        return location.pathname.startsWith(path);
    };

    const handleNavigation = (path) => {
        console.log("handleNavigation path: ", path)
        navigate(path);
    };

    const drawerContent = (
        <Box>
            <Toolbar />
            <List>
                {navigationItems.map((item) => {
                    const active = isActive(item.path);

                    return (
                        <ListItem key={item.text} disablePadding>
                            <ListItemButton
                                onClick={() => handleNavigation(item.path)}
                                selected={active}
                                sx={{
                                    minHeight: 48,
                                    backgroundColor: active ? 'action.selected' : 'transparent',
                                    '&:hover': {
                                        backgroundColor: active
                                            ? 'action.selected'
                                            : 'action.hover'
                                    },
                                    borderLeft: active ? '4px solid' : '4px solid transparent',
                                    borderLeftColor: active ? 'primary.main' : 'transparent',
                                    paddingLeft: active ? 1.5 : 2
                                }}
                            >
                                <ListItemIcon
                                    sx={{
                                        minWidth: 40,
                                        color: active ? 'primary.main' : 'text.secondary'
                                    }}
                                >
                                    {item.icon}
                                </ListItemIcon>
                                <ListItemText 
                                    primary={item.text}
                                    sx={{
                                        '& .MuiListItemText-primary': {
                                            fontWeight: active ? 600 : 400,
                                            color: active ? 'primary.main' : 'text.primary'
                                        }
                                    }}
                                />
                            </ListItemButton>
                        </ListItem>

                    );
                })}
            </List>

            <Divider sx={{ my: 1 }} />

        </Box>
    );

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: drawerWidth,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: drawerWidth,
                    boxSizing: 'border-box',
                    borderRight: '1px solid',
                    borderRightColor: 'divider'
                }
            }}
        >
            {drawerContent}
        </Drawer>
    );
};

export default Sidebar;