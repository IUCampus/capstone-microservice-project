import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import React, { JSX } from 'react'

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
    const { isAuthenticated } = useAuth()
    return isAuthenticated ? children : <Navigate to="/login" replace />
}