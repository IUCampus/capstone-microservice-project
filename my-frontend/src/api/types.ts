export type SeatStatus = 'AVAILABLE' | 'HELD' | 'RESERVED'
export interface Screening {
    _id: string
    movieTitle: string
    startsAt: string
    hall: string
    seats: { label: string; status: SeatStatus }[]
}

export interface HoldRequest {
    screening_id: string
    seat_labels: string[]
    hold_id: string
    ttl_seconds?: number
}

export interface ConfirmRequest {
    screening_id: string
    seat_labels: string[]
    hold_id: string
    idempotency_key?: string
    total_amount?: number
}

export interface BookingResponse {
    ok: boolean
    booking_id?: string
    booking?: any
    idempotent?: boolean
    unavailable_keys?: string[]
}