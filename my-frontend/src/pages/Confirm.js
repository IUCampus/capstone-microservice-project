import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { confirmSeats } from '../api/booking';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import React from 'react';
export default function Confirm() {
    const nav = useNavigate();
    const { state } = useLocation();
    const [idempotencyKey, setIdempotencyKey] = useState(crypto.randomUUID());
    const confirmMutation = useMutation({
        mutationFn: () => confirmSeats({
            screening_id: state.screening_id,
            seat_labels: state.seat_labels,
            hold_id: state.hold_id,
            idempotency_key: idempotencyKey,
            total_amount: state.seat_labels.length * 12.5,
        }),
        onSuccess: (res) => {
            if (res.ok)
                nav('/', { replace: true });
        },
    });
    if (!state) {
        return React.createElement(Alert, { severity: "warning" }, "No hold information found.");
    }
    // @ts-ignore
    // @ts-ignore
    return (React.createElement(Paper, { sx: { p: 3 } },
        React.createElement(Stack, { spacing: 2 },
            React.createElement(Typography, { variant: "h6" }, "Confirm Booking"),
            React.createElement(Typography, null,
                "Seats: ",
                state.seat_labels.join(', ')),
            React.createElement(TextField, { label: "Idempotency Key", value: idempotencyKey, onChange: e => setIdempotencyKey(e.target.value), helperText: "Used to safely retry without creating duplicate bookings" }),
            React.createElement(Box, { display: "flex", gap: 2 },
                React.createElement(Button, { onClick: () => nav(-1) }, "Back"),
                React.createElement(Button, { onClick: () => confirmMutation.mutate() }, "Confirm and Pay")),
            confirmMutation.isError && (React.createElement(Alert, { severity: "error" },
                "Failed to confirm: ",
                String(confirmMutation.error?.message || 'Unknown error'))))));
}
