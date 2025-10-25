import { useMemo } from 'react';
import { Alert, AlertTitle, Snackbar, } from '@mui/material';
import React from 'react';
/**
 * Attempts to extract a user-friendly message from unknown error shapes.
 * Handles common patterns from Axios, Zod, and generic Error objects.
 */
export function extractErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
    if (!error)
        return fallback;
    if (typeof error === 'string') {
        return error.trim() || fallback;
    }
    // Handle arrays of errors
    if (Array.isArray(error)) {
        const combined = error
            .map((e) => extractErrorMessage(e, ''))
            .filter(Boolean)
            .join('; ');
        return combined || fallback;
    }
    const e = error;
    // Zod-like error shape
    if (e?.issues && Array.isArray(e.issues)) {
        const zodMessages = e.issues
            .map((i) => i?.message)
            .filter((m) => typeof m === 'string');
        if (zodMessages.length > 0)
            return zodMessages.join('; ');
    }
    // Axios-like error shape
    if (e?.isAxiosError) {
        const data = e?.response?.data;
        // Common API error payload shapes
        if (typeof data === 'string')
            return data;
        if (data && typeof data === 'object') {
            if (typeof data.message === 'string')
                return data.message;
            if (typeof data.detail === 'string')
                return data.detail;
            // Optional: flatten first string found
            const vals = Object.values(data).flat();
            const first = vals.find((v) => typeof v === 'string') ??
                (vals[0] && Array.isArray(vals[0])
                    ? vals[0].find((v) => typeof v === 'string')
                    : undefined);
            if (typeof first === 'string')
                return first;
        }
        if (typeof e?.message === 'string' && e.message)
            return e.message;
    }
    // Generic Error
    if (e && typeof e === 'object' && typeof e.message === 'string') {
        return e.message || fallback;
    }
    // Generic API shapes
    if (e && typeof e === 'object') {
        if (typeof e.detail === 'string')
            return e.detail;
        if (typeof e.error === 'string')
            return e.error;
        if (typeof e.message === 'string')
            return e.message;
    }
    try {
        return JSON.stringify(error);
    }
    catch {
        return fallback;
    }
}
/**
 * A reusable error alert component that shows a dismissible MUI Alert inside a Snackbar.
 * Use `message` for a known string, or `error` to let it extract a friendly message.
 */
export default function ErrorAlert({ open, onClose, message, error, title, severity = 'error', variant = 'filled', autoHideDuration = null, anchorOrigin = { vertical: 'top', horizontal: 'center' }, actions, }) {
    const text = useMemo(() => {
        if (typeof message === 'string' && message.trim().length > 0)
            return message;
        return extractErrorMessage(error);
    }, [message, error]);
    // Handle Snackbar close reasons (e.g., ignore clickaway if desired)
    const handleClose = (_, reason) => {
        if (reason === 'clickaway')
            return;
        onClose?.();
    };
    if (!text)
        return null;
    return (React.createElement(Snackbar, { open: open, onClose: handleClose, autoHideDuration: autoHideDuration ?? undefined, anchorOrigin: anchorOrigin },
        React.createElement(Alert, { onClose: onClose, severity: severity, variant: variant, sx: { width: '100%' }, action: actions },
            title ? React.createElement(AlertTitle, null, title) : null,
            text)));
}
