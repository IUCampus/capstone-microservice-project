import { Container } from '@mui/material';
import { Outlet } from 'react-router-dom';
import TopBar from './components/TopBar';
import React from 'react';
export default function App() {
    return (React.createElement(React.Fragment, null,
        React.createElement(TopBar, null),
        React.createElement(Container, { maxWidth: "lg", sx: { py: 3 } },
            React.createElement(Outlet, null))));
}
