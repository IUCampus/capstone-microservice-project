import { AppBar, Toolbar, Typography, IconButton, Box, Button } from '@mui/material'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import LogoutIcon from '@mui/icons-material/Logout'
import { useContext } from 'react'
import { ColorModeContext } from '../theme/ColorModeContext'
import { useAuth } from '../hooks/useAuth'
import { Link } from 'react-router-dom'
import React from 'react'

export default function TopBar() {
    const { toggleColorMode } = useContext(ColorModeContext)
    const { isAuthenticated, logout } = useAuth()
    const prefersDark = (localStorage.getItem('color-mode') || 'light') === 'dark'

    return (
        <AppBar position="static" color="transparent" elevation={0}>
            <Toolbar>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
                        {import.meta.env.VITE_APP_NAME || 'Movie Booking'}
                    </Link>
                </Typography>
                <IconButton onClick={toggleColorMode} color="inherit">
                    {prefersDark ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
                {isAuthenticated ? (
                    <Button color="inherit" startIcon={<LogoutIcon />} onClick={logout}>
                        Logout
                    </Button>
                ) : (
                    <Button color="inherit" component={Link} to="/login">
                        Login
                    </Button>
                )}
            </Toolbar>
        </AppBar>
    )
}