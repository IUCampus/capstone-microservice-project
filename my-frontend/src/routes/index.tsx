import React from 'react'
import { createBrowserRouter } from 'react-router-dom'
import App from '../App'
import Home from '../pages/Home'
import Login from '../pages/Login'
import Booking from '../pages/Bookings'
import Screening from '../pages/Screening'
import Confirm from '../pages/Confirm'
import Profile from '../pages/Profile'
import ProtectedRoute from './ProtectedRoute'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'login', element: <Login /> },
      { path: 'bookings', element: <Booking /> },
      { path: 'profile', element:  <Profile /> },
      {
        path: 'screenings/:id',
        element: (
          <ProtectedRoute>
            <Screening />
          </ProtectedRoute>
        ),
      },
      {
        path: 'confirm',
        element: (
          <ProtectedRoute>
            <Confirm />
          </ProtectedRoute>
        ),
      },
    ],
  },
])