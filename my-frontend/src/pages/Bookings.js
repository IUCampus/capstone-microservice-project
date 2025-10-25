import React from "react";
import { Box, Stack, Paper, Typography, TextField, InputAdornment, IconButton, Button, Divider, Chip, Tooltip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination, Skeleton, Dialog, DialogTitle, DialogContent, DialogActions, } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LocalActivityOutlinedIcon from "@mui/icons-material/LocalActivityOutlined";
import TheatersOutlinedIcon from "@mui/icons-material/TheatersOutlined";
import PaidOutlinedIcon from "@mui/icons-material/PaidOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
const bookingSchema = z.object({
    id: z.string(),
    movieTitle: z.string(),
    screeningTime: z.string(),
    seats: z.array(z.string()),
    status: z.enum(["PENDING", "CONFIRMED", "CANCELLED"]),
    total: z.number(),
    currency: z.string(),
    createdAt: z.string(),
    venue: z.string().optional(),
    screen: z.string().optional(),
    qrCodeUrl: z.string().url().optional(),
});
const pageResultSchema = (inner) => z.object({
    items: z.array(inner),
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
});
const API_BASE = import.meta.env.VITE_API_URL ?? "";
const client = axios.create({
    baseURL: API_BASE,
    withCredentials: true,
});
function getAuthHeaders() {
    const token = localStorage.getItem("auth_token"); // adjust if your app uses a different key
    return token ? { Authorization: `Bearer ${token}` } : {};
}
const statusColor = {
    PENDING: "warning",
    CONFIRMED: "success",
    CANCELLED: "default",
};
const currencyFormat = (value, currency = "USD") => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
const dateFormat = (iso) => new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
}).format(new Date(iso));
const timeFormat = (iso) => new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const filtersSchema = z.object({
    q: z.string().optional(),
    from: z.string().optional(), // yyyy-MM-dd
    to: z.string().optional(), // yyyy-MM-dd
    status: z.enum(["ALL", "PENDING", "CONFIRMED", "CANCELLED"]).default("ALL"),
});
function useDebouncedValue(value, delay = 400) {
    const [v, setV] = React.useState(value);
    React.useEffect(() => {
        const t = setTimeout(() => setV(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return v;
}
async function fetchBookings(params) {
    const { page, pageSize, q, from, to, status } = params;
    const res = await client.get("/bookings", {
        headers: getAuthHeaders(),
        params: {
            page: page + 1, // server 1-based
            pageSize,
            q: q || undefined,
            from: from || undefined,
            to: to || undefined,
            status: status && status !== "ALL" ? status : undefined,
        },
    });
    const schema = pageResultSchema(bookingSchema);
    const parsed = schema.safeParse(res.data);
    if (!parsed.success) {
        // Fallback: try to normalize a few common shapes to be resilient
        const data = res.data;
        const items = (data.items ?? data.data ?? data.results ?? []).map((b) => ({
            id: String(b.id ?? b._id ?? ""),
            movieTitle: String(b.movieTitle ?? b.movie ?? "Untitled"),
            screeningTime: String(b.screeningTime ?? b.time ?? b.startsAt ?? new Date().toISOString()),
            seats: Array.isArray(b.seats) ? b.seats.map(String) : [],
            status: (b.status ?? "PENDING"),
            total: Number(b.total ?? b.amount ?? 0),
            currency: String(b.currency ?? "USD"),
            createdAt: String(b.createdAt ?? b.created_at ?? new Date().toISOString()),
            venue: b.venue ? String(b.venue) : undefined,
            screen: b.screen ? String(b.screen) : undefined,
            qrCodeUrl: b.qrCodeUrl ? String(b.qrCodeUrl) : undefined,
        }));
        return {
            items,
            page: Number(data.page ?? 1),
            pageSize: Number(data.pageSize ?? data.limit ?? items.length),
            total: Number(data.total ?? data.count ?? items.length),
        };
    }
    return parsed.data;
}
function useCancelBooking() {
    const qc = useQueryClient();
    const { enqueueSnackbar } = useSnackbar();
    return useMutation({
        mutationFn: async (bookingId) => {
            const res = await client.post(`/bookings/${encodeURIComponent(bookingId)}/cancel`, {}, { headers: getAuthHeaders() });
            return res.data;
        },
        onMutate: async (bookingId) => {
            await qc.cancelQueries({ queryKey: ["bookings"] });
            const prev = qc.getQueriesData({ queryKey: ["bookings"] });
            // optimistic: mark as CANCELLED in all cached pages
            prev.forEach(([key, data]) => {
                if (!data)
                    return;
                const next = {
                    ...data,
                    items: data.items.map((b) => (b.id === bookingId ? { ...b, status: "CANCELLED" } : b)),
                };
                qc.setQueryData(key, next);
            });
            return { prev };
        },
        onError: (error, _id, ctx) => {
            // rollback
            ctx?.prev?.forEach(([key, data]) => {
                if (data)
                    qc.setQueryData(key, data);
            });
            const message = error?.response?.data?.message ||
                error.message ||
                "Failed to cancel booking";
            enqueueSnackbar(message, { variant: "error" });
        },
        onSuccess: () => {
            enqueueSnackbar("Booking cancelled", { variant: "success" });
        },
        onSettled: () => {
            qc.invalidateQueries({ queryKey: ["bookings"] });
        },
    });
}
export default function Bookings() {
    const [page, setPage] = React.useState(0);
    const [pageSize, setPageSize] = React.useState(10);
    const [selected, setSelected] = React.useState(null);
    const { control, watch, handleSubmit, reset } = useForm({
        //resolver: zodResolver(filtersSchema),
        defaultValues: {
            q: "",
            status: "ALL",
            from: "",
            to: "",
        },
        mode: "onChange",
    });
    const rawFilters = watch();
    const debouncedQ = useDebouncedValue(rawFilters.q ?? "", 400);
    const effectiveFilters = { ...rawFilters, q: debouncedQ };
    // @ts-ignore
    const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
        queryKey: ["bookings", page, pageSize, effectiveFilters],
        queryFn: () => fetchBookings({
            page,
            pageSize,
            q: effectiveFilters.q,
            from: effectiveFilters.from || undefined,
            to: effectiveFilters.to || undefined,
            status: effectiveFilters.status,
        }),
        staleTime: 15000,
        // keepPreviousData: true,
    });
    const cancelMutation = useCancelBooking();
    const onSubmitFilters = () => {
        // When filters change, reset to first page
        setPage(0);
        refetch();
    };
    const clearFilters = () => {
        reset({ q: "", status: "ALL", from: "", to: "" });
        setPage(0);
    };
    const items = data?.items ?? [];
    const total = data?.total ?? 0;
    return (React.createElement(Box, { sx: { p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" } },
        React.createElement(Stack, { direction: "row", alignItems: "center", justifyContent: "space-between", sx: { mb: 2 } },
            React.createElement(Stack, { direction: "row", alignItems: "center", spacing: 1 },
                React.createElement(LocalActivityOutlinedIcon, { color: "primary" }),
                React.createElement(Typography, { variant: "h5", fontWeight: 700 }, "My Bookings"),
                isFetching && (React.createElement(Chip, { size: "small", label: "Refreshing...", variant: "outlined", color: "default", sx: { ml: 1 } }))),
            React.createElement(Tooltip, { title: "Refresh" },
                React.createElement("span", null,
                    React.createElement(IconButton, { onClick: () => refetch(), disabled: isFetching },
                        React.createElement(RefreshIcon, null))))),
        React.createElement(Paper, { variant: "outlined", sx: { p: 2, mb: 2 } },
            React.createElement("form", { onSubmit: handleSubmit(onSubmitFilters), noValidate: true },
                React.createElement(Stack, { direction: { xs: "column", md: "row" }, spacing: 2 },
                    React.createElement(Controller, { control: control, name: "q", render: ({ field }) => (React.createElement(TextField, { ...field, fullWidth: true, label: "Search by movie or seat", placeholder: "e.g. Inception, A12", InputProps: {
                                startAdornment: (React.createElement(InputAdornment, { position: "start" },
                                    React.createElement(SearchIcon, { fontSize: "small" }))),
                            } })) }),
                    React.createElement(Controller, { control: control, name: "status", render: ({ field }) => (React.createElement(TextField, { select: true, label: "Status", ...field, sx: { minWidth: 180 } },
                            React.createElement("option", { value: "ALL" }, "All"),
                            React.createElement("option", { value: "PENDING" }, "Pending"),
                            React.createElement("option", { value: "CONFIRMED" }, "Confirmed"),
                            React.createElement("option", { value: "CANCELLED" }, "Cancelled"))) }),
                    React.createElement(Controller, { control: control, name: "from", render: ({ field }) => (React.createElement(TextField, { ...field, label: "From", type: "date", InputLabelProps: { shrink: true }, sx: { minWidth: 180 } })) }),
                    React.createElement(Controller, { control: control, name: "to", render: ({ field }) => (React.createElement(TextField, { ...field, label: "To", type: "date", InputLabelProps: { shrink: true }, sx: { minWidth: 180 } })) }),
                    React.createElement(Stack, { direction: "row", spacing: 1, sx: { ml: "auto" } },
                        React.createElement(Button, { variant: "outlined", onClick: clearFilters }, "Clear"),
                        React.createElement(Button, { variant: "contained", type: "submit" }, "Apply"))))),
        React.createElement(Paper, { variant: "outlined" },
            React.createElement(TableContainer, null,
                React.createElement(Table, { size: "medium", "aria-label": "bookings table" },
                    React.createElement(TableHead, null,
                        React.createElement(TableRow, null,
                            React.createElement(TableCell, null, "Movie"),
                            React.createElement(TableCell, null, "When"),
                            React.createElement(TableCell, null, "Venue"),
                            React.createElement(TableCell, null, "Seats"),
                            React.createElement(TableCell, null, "Status"),
                            React.createElement(TableCell, { align: "right" }, "Total"),
                            React.createElement(TableCell, { align: "right", width: 140 }, "Actions"))),
                    React.createElement(TableBody, null, isLoading
                        ? Array.from({ length: pageSize }).map((_, i) => (React.createElement(TableRow, { key: `sk-${i}` },
                            React.createElement(TableCell, { colSpan: 7 },
                                React.createElement(Skeleton, { variant: "rectangular", height: 42 })))))
                        : items.length === 0
                            ? (React.createElement(TableRow, null,
                                React.createElement(TableCell, { colSpan: 7 },
                                    React.createElement(EmptyState, { onReset: clearFilters }))))
                            : items.map((b) => (React.createElement(TableRow, { key: b.id, hover: true },
                                React.createElement(TableCell, null,
                                    React.createElement(Stack, { spacing: 0.5 },
                                        React.createElement(Stack, { direction: "row", alignItems: "center", spacing: 1 },
                                            React.createElement(TheatersOutlinedIcon, { fontSize: "small", color: "action" }),
                                            React.createElement(Typography, { fontWeight: 600 }, b.movieTitle)),
                                        React.createElement(Stack, { direction: "row", spacing: 1, alignItems: "center", sx: { color: "text.secondary" } },
                                            React.createElement(EventOutlinedIcon, { fontSize: "small" }),
                                            React.createElement(Typography, { variant: "body2" }, dateFormat(b.screeningTime)),
                                            React.createElement(AccessTimeOutlinedIcon, { fontSize: "small", sx: { ml: 1 } }),
                                            React.createElement(Typography, { variant: "body2" }, timeFormat(b.screeningTime))))),
                                React.createElement(TableCell, null,
                                    React.createElement(Typography, { variant: "body2" }, dateFormat(b.screeningTime)),
                                    React.createElement(Typography, { variant: "caption", color: "text.secondary" }, timeFormat(b.screeningTime))),
                                React.createElement(TableCell, null,
                                    React.createElement(Stack, { spacing: 0.5 },
                                        React.createElement(Stack, { direction: "row", spacing: 1, alignItems: "center" },
                                            React.createElement(PlaceOutlinedIcon, { fontSize: "small", color: "action" }),
                                            React.createElement(Typography, { variant: "body2" }, b.venue || "—")),
                                        React.createElement(Typography, { variant: "caption", color: "text.secondary" }, b.screen ? `Screen ${b.screen}` : ""))),
                                React.createElement(TableCell, null,
                                    React.createElement(Stack, { direction: "row", spacing: 0.5, flexWrap: "wrap" },
                                        b.seats.slice(0, 4).map((s) => (React.createElement(Chip, { key: s, size: "small", label: s, variant: "outlined" }))),
                                        b.seats.length > 4 && (React.createElement(Chip, { size: "small", label: `+${b.seats.length - 4}`, variant: "outlined" })))),
                                React.createElement(TableCell, null,
                                    React.createElement(Chip, { size: "small", label: capitalize(b.status), color: statusColor[b.status], variant: b.status === "CANCELLED" ? "outlined" : "filled" })),
                                React.createElement(TableCell, { align: "right" },
                                    React.createElement(Stack, { direction: "row", spacing: 1, justifyContent: "flex-end", alignItems: "center" },
                                        React.createElement(PaidOutlinedIcon, { fontSize: "small", color: "action" }),
                                        React.createElement(Typography, { fontWeight: 600 }, currencyFormat(b.total, b.currency)))),
                                React.createElement(TableCell, { align: "right" },
                                    React.createElement(Stack, { direction: "row", spacing: 1, justifyContent: "flex-end" },
                                        React.createElement(Tooltip, { title: "Details" },
                                            React.createElement("span", null,
                                                React.createElement(IconButton, { onClick: () => setSelected(b), "aria-label": "details" },
                                                    React.createElement(InfoOutlinedIcon, null)))),
                                        React.createElement(Tooltip, { title: b.status === "CANCELLED" ? "Already cancelled" : "Cancel booking" },
                                            React.createElement("span", null,
                                                React.createElement(IconButton, { "aria-label": "cancel", onClick: () => cancelMutation.mutate(b.id), disabled: b.status === "CANCELLED" || cancelMutation.isPending, color: "error" },
                                                    React.createElement(DeleteOutlineIcon, null)))))))))))),
            React.createElement(Divider, null),
            React.createElement(TablePagination, { component: "div", count: total, page: page, onPageChange: (_, p) => setPage(p), rowsPerPage: pageSize, onRowsPerPageChange: (e) => {
                    setPageSize(parseInt(e.target.value, 10));
                    setPage(0);
                }, rowsPerPageOptions: [5, 10, 20, 50], labelRowsPerPage: "Rows" })),
        React.createElement(BookingDetailsDialog, { booking: selected, onClose: () => setSelected(null), onCancel: (id) => cancelMutation.mutate(id), cancelDisabled: cancelMutation.isPending }),
        isError && (React.createElement(Box, { sx: { mt: 2 } },
            React.createElement(ErrorBanner, { error: error, onRetry: () => refetch() })))));
}
function EmptyState({ onReset }) {
    return (React.createElement(Stack, { alignItems: "center", justifyContent: "center", spacing: 1, sx: { py: 6, color: "text.secondary", textAlign: "center" } },
        React.createElement(LocalActivityOutlinedIcon, { color: "disabled", sx: { fontSize: 48 } }),
        React.createElement(Typography, null, "No bookings found"),
        React.createElement(Typography, { variant: "body2" }, "Try adjusting your filters or search query."),
        React.createElement(Button, { variant: "outlined", onClick: onReset, sx: { mt: 1 } }, "Reset filters")));
}
function ErrorBanner({ error, onRetry }) {
    const message = error?.response?.data?.message ||
        error?.message ||
        "Something went wrong";
    return (React.createElement(Paper, { variant: "outlined", sx: { p: 2, borderColor: "error.main", bgcolor: "error.main", color: "error.contrastText" } },
        React.createElement(Stack, { direction: { xs: "column", sm: "row" }, alignItems: { xs: "flex-start", sm: "center" }, spacing: 2 },
            React.createElement(Typography, { sx: { flex: 1 } },
                "Error: ",
                message),
            React.createElement(Button, { onClick: onRetry, variant: "contained", color: "inherit" }, "Retry"))));
}
function BookingDetailsDialog({ booking, onClose, onCancel, cancelDisabled, }) {
    if (!booking)
        return null;
    return (React.createElement(Dialog, { open: true, onClose: onClose, fullWidth: true, maxWidth: "sm" },
        React.createElement(DialogTitle, null, "Booking Details"),
        React.createElement(DialogContent, { dividers: true },
            React.createElement(Stack, { spacing: 2 },
                React.createElement(Stack, { spacing: 0.5 },
                    React.createElement(Typography, { variant: "overline", color: "text.secondary" }, "Movie"),
                    React.createElement(Typography, { variant: "h6" }, booking.movieTitle)),
                React.createElement(Stack, { direction: "row", spacing: 2, flexWrap: "wrap" },
                    React.createElement(InfoItem, { icon: React.createElement(EventOutlinedIcon, { fontSize: "small" }), label: "Date", value: dateFormat(booking.screeningTime) }),
                    React.createElement(InfoItem, { icon: React.createElement(AccessTimeOutlinedIcon, { fontSize: "small" }), label: "Time", value: timeFormat(booking.screeningTime) }),
                    React.createElement(InfoItem, { icon: React.createElement(PlaceOutlinedIcon, { fontSize: "small" }), label: "Venue", value: booking.venue || "—" }),
                    React.createElement(InfoItem, { icon: React.createElement(TheatersOutlinedIcon, { fontSize: "small" }), label: "Screen", value: booking.screen || "—" })),
                React.createElement(Stack, { spacing: 0.5 },
                    React.createElement(Typography, { variant: "overline", color: "text.secondary" }, "Seats"),
                    React.createElement(Stack, { direction: "row", spacing: 0.5, flexWrap: "wrap" }, booking.seats.map((s) => (React.createElement(Chip, { key: s, size: "small", label: s, variant: "outlined" }))))),
                React.createElement(Stack, { direction: "row", spacing: 1, alignItems: "center" },
                    React.createElement(Typography, { variant: "overline", color: "text.secondary" }, "Status:"),
                    React.createElement(Chip, { size: "small", label: capitalize(booking.status), color: statusColor[booking.status], variant: booking.status === "CANCELLED" ? "outlined" : "filled" })),
                React.createElement(Divider, null),
                React.createElement(Stack, { direction: "row", alignItems: "center", justifyContent: "space-between" },
                    React.createElement(Typography, { variant: "subtitle2", color: "text.secondary" }, "Total Paid"),
                    React.createElement(Typography, { variant: "h6" }, currencyFormat(booking.total, booking.currency))),
                booking.qrCodeUrl && (React.createElement(React.Fragment, null,
                    React.createElement(Divider, null),
                    React.createElement(Stack, { spacing: 1, alignItems: "center" },
                        React.createElement("img", { src: booking.qrCodeUrl, alt: "Booking QR code", style: { width: 180, height: 180, objectFit: "contain" } }),
                        React.createElement(Typography, { variant: "caption", color: "text.secondary" }, "Present this QR code at the venue")))))),
        React.createElement(DialogActions, null,
            React.createElement(Button, { onClick: onClose }, "Close"),
            React.createElement(Button, { color: "error", startIcon: React.createElement(DeleteOutlineIcon, null), onClick: () => onCancel(booking.id), disabled: booking.status === "CANCELLED" || cancelDisabled }, "Cancel booking"))));
}
function InfoItem({ icon, label, value }) {
    return (React.createElement(Stack, { direction: "row", spacing: 1, alignItems: "center", sx: { minWidth: 180 } },
        icon,
        React.createElement(Stack, { spacing: 0 },
            React.createElement(Typography, { variant: "caption", color: "text.secondary" }, label),
            React.createElement(Typography, { variant: "body2" }, value))));
}
function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
