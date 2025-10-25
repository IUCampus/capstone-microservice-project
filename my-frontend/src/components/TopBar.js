import { AppBar, Toolbar, Typography, IconButton, Button } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import { useContext } from 'react';
import { ColorModeContext } from '../theme/ColorModeContext';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import React from 'react';
export default function TopBar() {
    const { toggleColorMode } = useContext(ColorModeContext);
    const { isAuthenticated, logout } = useAuth();
    const prefersDark = (localStorage.getItem('color-mode') || 'light') === 'dark';
    return (React.createElement(AppBar, { position: "static", color: "transparent", elevation: 0 },
        React.createElement(Toolbar, null,
            React.createElement(Typography, { variant: "h6", sx: { flexGrow: 1 } },
                React.createElement(Link, { to: "/", style: { textDecoration: 'none', color: 'inherit' } }, import.meta.env.VITE_APP_NAME || 'Movie Booking')),
            React.createElement(IconButton, { onClick: toggleColorMode, color: "inherit" }, prefersDark ? React.createElement(LightModeIcon, null) : React.createElement(DarkModeIcon, null)),
            isAuthenticated ? (React.createElement(Button, { color: "inherit", startIcon: React.createElement(LogoutIcon, null), onClick: logout }, "Logout")) : (React.createElement(Button, { color: "inherit", component: Link, to: "/login" }, "Login")))));
}
