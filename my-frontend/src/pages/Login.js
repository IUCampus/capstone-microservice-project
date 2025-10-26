import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography, } from '@mui/material';
import { useAuthStore } from '../store/auth';
async function handleLogin(email, password) {
    const res = await axios.post('http://localhost:5000/users/login', { email, password });
    const { access_token, refresh_token, user } = res.data ?? {};
    if (!access_token) {
        throw new Error('Login response missing access_token');
    }
    // Derive user id (prefer API user.id, fallback to JWT "sub")
    let userId = user?.id;
    if (!userId) {
        try {
            const [, payload] = access_token.split('.');
            if (payload) {
                const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
                const json = decodeURIComponent(atob(base64)
                    .split('')
                    .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join(''));
                const data = JSON.parse(json);
                userId = data.sub ?? data.user_id ?? undefined;
            }
        }
        catch {
            /* ignore */
        }
    }
    if (!userId)
        throw new Error('Could not determine user id from response');
    // Persist via auth store
    useAuthStore.getState().login(access_token, userId);
    // Keep refresh token for silent renewals
    if (refresh_token) {
        localStorage.setItem('refresh_token', refresh_token);
    }
    // Ensure subsequent requests carry the token immediately
    axios.defaults.headers.common.Authorization = `Bearer ${access_token}`;
    return { userId };
}
const Login = () => {
    const navigate = useNavigate();
    const [serverError, setServerError] = useState(null);
    const { register, handleSubmit, formState: { errors, isSubmitting }, } = useForm({
        defaultValues: { email: '', password: '' },
    });
    const onSubmit = async (data) => {
        setServerError(null);
        try {
            await handleLogin(data.email, data.password);
            navigate('/profile');
        }
        catch (err) {
            const message = err?.response?.data?.error ??
                err?.message ??
                'Login failed. Please try again.';
            setServerError(message);
        }
    };
    return (React.createElement(Box, { display: "flex", justifyContent: "center", mt: 6 },
        React.createElement(Paper, { sx: { p: 4, width: 420 } },
            React.createElement(Typography, { variant: "h5", mb: 2 }, "Login"),
            serverError ? (React.createElement(Alert, { severity: "error", sx: { mb: 2 } }, serverError)) : null,
            React.createElement("form", { onSubmit: handleSubmit(onSubmit), noValidate: true },
                React.createElement(Stack, { spacing: 2 },
                    React.createElement(TextField, { label: "Email", type: "email", autoComplete: "email", fullWidth: true, error: !!errors.email, helperText: errors.email?.message, ...register('email', {
                            required: 'Email is required',
                            pattern: {
                                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                                message: 'Enter a valid email address',
                            },
                        }) }),
                    React.createElement(TextField, { label: "Password", type: "password", autoComplete: "current-password", fullWidth: true, error: !!errors.password, helperText: errors.password?.message, ...register('password', {
                            required: 'Password is required',
                            minLength: {
                                value: 6,
                                message: 'Password must be at least 6 characters',
                            },
                        }) }),
                    React.createElement(Button, { type: "submit", variant: "contained", disabled: isSubmitting, fullWidth: true, size: "large" }, isSubmitting ? (React.createElement(React.Fragment, null,
                        React.createElement(CircularProgress, { color: "inherit", size: 20, sx: { mr: 1 } }),
                        "Logging in...")) : ('Login'))),
                React.createElement(Stack, { sx: { mt: 2 } },
                    React.createElement(Typography, { variant: "body2" },
                        "Don't have an account?",
                        ' ',
                        React.createElement("a", { href: "/bookings" },
                            React.createElement("strong", null, "Booking"))))))));
};
export default Login;
