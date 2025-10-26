import { useLocation, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { confirmSeats } from '../api/booking'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'
import React from 'react'

export default function Confirm() {
  const nav = useNavigate()
  const { state } = useLocation() as {
    state?: { screening_id: string; seat_labels: string[]; hold_id: string }
  }
  const [idempotencyKey, setIdempotencyKey] = useState<string>(crypto.randomUUID())
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const confirmMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null)
      const res = await confirmSeats({
        screening_id: state!.screening_id,
        seat_labels: state!.seat_labels,
        hold_id: state!.hold_id,
        idempotency_key: idempotencyKey,
        total_amount: state!.seat_labels.length * 12.5,
      })
      if (!res.ok) {
        // @ts-ignore
          // @ts-ignore
          const text = await res.text().catch(() => '')
        // @ts-ignore
          throw new Error(text || `Request failed with status ${res.status}`)
      }
      return res
    },
    onSuccess: () => {
      nav('/', { replace: true })
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Something went wrong while confirming seats.'
      setErrorMsg(message)
    },
  })

  if (!state) {
    return <Alert severity="warning">No hold information found.</Alert>
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Confirm Booking</Typography>
        <Typography>Seats: {state.seat_labels.join(', ')}</Typography>
        <TextField
          label="Idempotency Key"
          value={idempotencyKey}
          onChange={(e) => setIdempotencyKey(e.target.value)}
          helperText="Used to safely retry without creating duplicate bookings"
        />
        {errorMsg && <Alert severity="error">{errorMsg}</Alert>}
        <Box display="flex" gap={2}>
          <Button onClick={() => nav(-1)}>Back</Button>
          <Button
            disabled={confirmMutation.isPending}
            onClick={() => confirmMutation.mutate()}
            variant="contained"
          >
            {confirmMutation.isPending ? 'Confirming…' : 'Confirm'}
          </Button>
        </Box>
      </Stack>
    </Paper>
  )
}