import React from "react";
import { Box, Typography, Paper } from '@mui/material';

function UserAccounts() {
    return (
        <Box>
            <Paper
                elevation={2}
                sx={{
                    p: 4,
                    textAlign: 'center',
                    minHeight: '400px',
                    minWidth: '400px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'column',
                    alignItems: 'center'
                }}
            >
                <Typography variant="h5" color="text.secondary" gutterBotttom>
                    User Accounts
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Placeholder
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Placeholder2                
                </Typography>
            </Paper>
        </Box>
    );
};

export default UserAccounts;