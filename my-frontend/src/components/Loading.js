import { Box, CircularProgress } from '@mui/material';
import React from 'react';
export default function Loading() {
    return (React.createElement(Box, { display: "flex", alignItems: "center", justifyContent: "center", py: 6 },
        React.createElement(CircularProgress, null)));
}
