import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import Home from '../pages/Home';
import Login from '../pages/Login';
import Booking from '../pages/Bookings';
import Screening from '../pages/Screening';
import Confirm from '../pages/Confirm';
import Profile from '../pages/Profile';
import ProtectedRoute from './ProtectedRoute';
export const router = createBrowserRouter([
    {
        path: '/',
        element: React.createElement(App, null),
        children: [
            { index: true, element: React.createElement(Home, null) },
            { path: 'login', element: React.createElement(Login, null) },
            { path: 'bookings', element: React.createElement(Booking, null) },
            { path: 'profile', element: React.createElement(Profile, null) },
            {
                path: 'screenings/:id',
                element: (React.createElement(ProtectedRoute, null,
                    React.createElement(Screening, null))),
            },
            {
                path: 'confirm',
                element: (React.createElement(ProtectedRoute, null,
                    React.createElement(Confirm, null))),
            },
        ],
    },
]);
