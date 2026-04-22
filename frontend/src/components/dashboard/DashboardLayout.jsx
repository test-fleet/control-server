import { Box, Toolbar } from '@mui/material';
import Header from './Header';
import Sidebar from './Sidebar';

const DRAWER_WIDTH = 240

function DashboardLayout({ children }) {

    return (
        <Box sx={{ 
            display: 'flex', 
            minHeight: '100vh',
            width: '100vw',
            maxWidth: '100vw',
            overflow: 'hidden',
            position: 'fixed',
            top: 0,
            left: 0
        }}>
            <Header />
            <Sidebar drawerWidth={DRAWER_WIDTH}/>
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: `calc(100vw - ${DRAWER_WIDTH}px)`, 
                    height: '100vh',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    backgroundColor: '#f5f5f5',
                }}
            >
                <Toolbar />
                {children}
            </Box>
        </Box>
    );
}

export default DashboardLayout;