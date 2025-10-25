import React from 'react';
import { Box, Chip, Stack } from '@mui/material';
export default function SeatMap({ seats = [], selected = [], onToggle }) {
    const list = Array.isArray(seats) ? seats : [];
    if (list.length === 0) {
        return (React.createElement(Box, { sx: { p: 2, color: 'text.secondary' } }, "No seats to display."));
    }
    return (React.createElement(Stack, { direction: "row", flexWrap: "wrap", gap: 1 }, list.map((seat) => {
        const isSelected = selected.includes(seat.label);
        const isDisabled = seat.status !== 'AVAILABLE';
        return (React.createElement(Chip, { key: seat.label, label: seat.label, color: isSelected ? 'primary' : 'default', variant: isSelected ? 'filled' : 'outlined', disabled: isDisabled, onClick: !isDisabled && onToggle ? () => onToggle(seat.label) : undefined, sx: {
                opacity: isDisabled ? 0.5 : 1,
                cursor: isDisabled ? 'not-allowed' : 'pointer',
            } }));
    })));
}
