import { Box, CircularProgress } from '@mui/material'
import React from 'react'
export default function Loading() {
    return (
        <Box display="flex" alignItems="center" justifyContent="center" py={6}>
            <CircularProgress />
        </Box>
    )
}