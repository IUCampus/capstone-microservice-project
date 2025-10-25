import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import SeatMap from '../components/SeatMap';
import { fetchScreening, holdSeats } from '../api/booking';
export default function Screening() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [selected, setSelected] = useState([]);
    const [hold, setHold] = useState(null);
    const { data, isLoading, isError } = useQuery({
        queryKey: ['screening', id],
        queryFn: () => fetchScreening(id),
        enabled: Boolean(id),
    });
    const holdMutation = useMutation({
        mutationFn: () => holdSeats(id, selected),
        onSuccess: (res) => setHold({ hold_id: res.hold_id }),
    });
    const toggleSeat = (label) => {
        setSelected((prev) => prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]);
    };
    if (isLoading)
        return React.createElement(Typography, null, "Loading...");
    if (isError || !data)
        return React.createElement(Alert, { severity: "error" }, "Failed to load screening");
    const seats = Array.isArray(data?.seats)
        ? data.seats
        : [];
    return (React.createElement(Stack, { spacing: 2 },
        React.createElement(Typography, { variant: "h5" }, data.movieTitle),
        React.createElement(Typography, { variant: "body2" }, new Date(data.startsAt).toLocaleString()),
        React.createElement(Paper, { sx: { p: 2 } }, seats.length === 0 ? (React.createElement(Alert, { severity: "info" }, "No seats available for this screening.")) : (React.createElement(SeatMap, { seats: seats, selected: selected, onToggle: toggleSeat }))),
        React.createElement(Box, { display: "flex", gap: 2 },
            React.createElement(Button, { variant: "contained", disabled: selected.length === 0 || holdMutation.isPending, onClick: () => holdMutation.mutate() },
                "Hold ",
                selected.length,
                " seat",
                selected.length === 1 ? '' : 's'),
            hold && (React.createElement(Button, { variant: "outlined", onClick: () => navigate('/confirm', { state: { hold, id } }) }, "Continue to confirm")))));
}
