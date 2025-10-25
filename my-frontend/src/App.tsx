import { Container } from '@mui/material'
import { Outlet } from 'react-router-dom'
import TopBar from './components/TopBar'
import React from 'react'

export default function App() {
    return (
        <>
            <TopBar />
            <Container maxWidth="lg" sx={{ py: 3 }}>
                <Outlet />
            </Container>
        </>
    )
}