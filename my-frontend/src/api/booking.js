import api from './client';
export async function fetchScreening(screeningId) {
    const { data } = await api.get(`/screenings/${screeningId}`);
    return data;
}
export async function holdSeats(screeningId, seatLabels, ttl = 600) {
    // assumes backend endpoint for holds (POST /holds)
    const { data } = await api.post('/holds', {
        screening_id: screeningId,
        seat_labels: seatLabels,
        ttl_seconds: ttl,
    });
    return data; // { ok: true, hold_id, expires_at, ... }
}
export async function confirmSeats(payload) {
    const { data } = await api.post('/bookings/confirm', payload);
    return data;
}
