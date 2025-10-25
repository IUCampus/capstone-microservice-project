import api from './client'
import { ConfirmRequest, BookingResponse } from './types'

export async function fetchScreening(screeningId: string) {
    const { data } = await api.get(`/screenings/${screeningId}`)
    return data
}

export async function holdSeats(screeningId: string, seatLabels: string[], ttl = 600) {
    // assumes backend endpoint for holds (POST /holds)
    const { data } = await api.post('/holds', {
        screening_id: screeningId,
        seat_labels: seatLabels,
        ttl_seconds: ttl,
    })
    return data // { ok: true, hold_id, expires_at, ... }
}

export async function confirmSeats(payload: ConfirmRequest) {
    const { data } = await api.post<BookingResponse>('/bookings/confirm', payload)
    return data
}