import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import SeatMap from '../components/SeatMap'
import { fetchScreening, holdSeats } from '../api/booking'

type Seat = { label: string; status: 'AVAILABLE' | 'HELD' | 'RESERVED' }

export default function Screening() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>([])
  const [hold, setHold] = useState<{ hold_id: string } | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['screening', id],
    queryFn: () => fetchScreening(id!),
    enabled: Boolean(id),
  })

  const holdMutation = useMutation({
    mutationFn: () => holdSeats(id!, selected),
    onSuccess: (res) => setHold({ hold_id: res.hold_id }),
  })

  const toggleSeat = (label: string) => {
    setSelected((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    )
  }

  if (isLoading) return <Typography>Loading...</Typography>

  if (isError || !data)
    return <Alert severity="error">Failed to load screening</Alert>

  const seats: Seat[] = Array.isArray((data as any)?.seats)
    ? (data as any).seats
    : []

  return (
    <Stack spacing={2}>
      <Typography variant="h5">{data.movieTitle}</Typography>
      <Typography variant="body2">
        {new Date(data.startsAt).toLocaleString()}
      </Typography>

      <Paper sx={{ p: 2 }}>
        {seats.length === 0 ? (
          <Alert severity="info">
            No seats available for this screening.
          </Alert>
        ) : (
          <SeatMap seats={seats} selected={selected} onToggle={toggleSeat} />
        )}
      </Paper>

      <Box display="flex" gap={2}>
        <Button
          variant="contained"
          disabled={selected.length === 0 || holdMutation.isPending}
          onClick={() => holdMutation.mutate()}
        >
          Hold {selected.length} seat{selected.length === 1 ? '' : 's'}
        </Button>

        {hold && (
          <Button
            variant="outlined"
            onClick={() => navigate('/confirm', { state: { hold, id } })}
          >
            Continue to confirm
          </Button>
        )}
      </Box>
    </Stack>
  )
}