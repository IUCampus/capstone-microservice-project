import React from "react";
import {
  Box,
  Stack,
  Paper,
  Typography,
  TextField,
  InputAdornment,
  IconButton,
  Button,
  Divider,
  Chip,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
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

import axios, { AxiosError } from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSnackbar } from "notistack";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

type Booking = {
  id: string;
  movieTitle: string;
  screeningTime: string; // ISO date string
  seats: string[];
  status: BookingStatus;
  total: number;
  currency: string; // e.g. "USD"
  createdAt: string; // ISO date string
  venue?: string;
  screen?: string;
  qrCodeUrl?: string;
};

type PageResult<T> = {
  items: T[];
  page: number; // 1-based from server
  pageSize: number;
  total: number;
};

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

const pageResultSchema = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({
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

const statusColor: Record<BookingStatus, "default" | "success" | "warning" | "error"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CANCELLED: "default",
};

const currencyFormat = (value: number, currency = "USD") =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

const dateFormat = (iso: string) =>
  new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(iso));

const timeFormat = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

const filtersSchema = z.object({
  q: z.string().optional(),
  from: z.string().optional(), // yyyy-MM-dd
  to: z.string().optional(), // yyyy-MM-dd
  status: z.enum(["ALL", "PENDING", "CONFIRMED", "CANCELLED"]).default("ALL"),
});

type Filters = z.infer<typeof filtersSchema>;

function useDebouncedValue<T>(value: T, delay = 400) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

async function fetchBookings(params: {
  page: number; // 0-based UI
  pageSize: number;
  q?: string;
  from?: string;
  to?: string;
  status?: BookingStatus | "ALL";
}): Promise<PageResult<Booking>> {
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
    const items: Booking[] = (data.items ?? data.data ?? data.results ?? []).map((b: any) => ({
      id: String(b.id ?? b._id ?? ""),
      movieTitle: String(b.movieTitle ?? b.movie ?? "Untitled"),
      screeningTime: String(b.screeningTime ?? b.time ?? b.startsAt ?? new Date().toISOString()),
      seats: Array.isArray(b.seats) ? b.seats.map(String) : [],
      status: (b.status ?? "PENDING") as BookingStatus,
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
    mutationFn: async (bookingId: string) => {
      const res = await client.post(
        `/bookings/${encodeURIComponent(bookingId)}/cancel`,
        {},
        { headers: getAuthHeaders() }
      );
      return res.data as { success: boolean };
    },
    onMutate: async (bookingId) => {
      await qc.cancelQueries({ queryKey: ["bookings"] });
      const prev = qc.getQueriesData<PageResult<Booking>>({ queryKey: ["bookings"] });

      // optimistic: mark as CANCELLED in all cached pages
      prev.forEach(([key, data]) => {
        if (!data) return;
        const next: PageResult<Booking> = {
          ...data,
          items: data.items.map((b) => (b.id === bookingId ? { ...b, status: "CANCELLED" } as Booking : b)),
        };
        qc.setQueryData(key, next);
      });

      return { prev };
    },
    onError: (error, _id, ctx) => {
      // rollback
      ctx?.prev?.forEach(([key, data]) => {
        if (data) qc.setQueryData(key, data);
      });
      const message =
        (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
        (error as Error).message ||
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
  const [selected, setSelected] = React.useState<Booking | null>(null);

    const { control, watch, handleSubmit, reset } = useForm<Filters>({
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
    queryFn: () =>
      fetchBookings({
        page,
        pageSize,
        q: effectiveFilters.q,
        from: effectiveFilters.from || undefined,
        to: effectiveFilters.to || undefined,
        status: effectiveFilters.status,
      }),
    staleTime: 15_000,
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

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1400, mx: "auto" }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <LocalActivityOutlinedIcon color="primary" />
          <Typography variant="h5" fontWeight={700}>
            My Bookings
          </Typography>
          {isFetching && (
            <Chip size="small" label="Refreshing..." variant="outlined" color="default" sx={{ ml: 1 }} />
          )}
        </Stack>
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={() => refetch()} disabled={isFetching}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <form onSubmit={handleSubmit(onSubmitFilters)} noValidate>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <Controller
              control={control}
              name="q"
              render={({ field }) => (
                <TextField
                  {...field}
                  fullWidth
                  label="Search by movie or seat"
                  placeholder="e.g. Inception, A12"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  }}
                />
              )}
            />
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <TextField select label="Status" {...field} sx={{ minWidth: 180 }}>
                  <option value="ALL">All</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="CANCELLED">Cancelled</option>
                </TextField>
              )}
            />
            <Controller
              control={control}
              name="from"
              render={({ field }) => (
                <TextField
                  {...field}
                  label="From"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 180 }}
                />
              )}
            />
            <Controller
              control={control}
              name="to"
              render={({ field }) => (
                <TextField
                  {...field}
                  label="To"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  sx={{ minWidth: 180 }}
                />
              )}
            />
            <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
              <Button variant="outlined" onClick={clearFilters}>
                Clear
              </Button>
              <Button variant="contained" type="submit">
                Apply
              </Button>
            </Stack>
          </Stack>
        </form>
      </Paper>

      <Paper variant="outlined">
        <TableContainer>
          <Table size="medium" aria-label="bookings table">
            <TableHead>
              <TableRow>
                <TableCell>Movie</TableCell>
                <TableCell>When</TableCell>
                <TableCell>Venue</TableCell>
                <TableCell>Seats</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell align="right" width={140}>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading
                ? Array.from({ length: pageSize }).map((_, i) => (
                    <TableRow key={`sk-${i}`}>
                      <TableCell colSpan={7}>
                        <Skeleton variant="rectangular" height={42} />
                      </TableCell>
                    </TableRow>
                  ))
                : items.length === 0
                ? (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <EmptyState onReset={clearFilters} />
                    </TableCell>
                  </TableRow>
                  )
                : items.map((b) => (
                    <TableRow key={b.id} hover>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <TheatersOutlinedIcon fontSize="small" color="action" />
                            <Typography fontWeight={600}>{b.movieTitle}</Typography>
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
                            <EventOutlinedIcon fontSize="small" />
                            <Typography variant="body2">{dateFormat(b.screeningTime)}</Typography>
                            <AccessTimeOutlinedIcon fontSize="small" sx={{ ml: 1 }} />
                            <Typography variant="body2">{timeFormat(b.screeningTime)}</Typography>
                          </Stack>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{dateFormat(b.screeningTime)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {timeFormat(b.screeningTime)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <PlaceOutlinedIcon fontSize="small" color="action" />
                            <Typography variant="body2">{b.venue || "—"}</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {b.screen ? `Screen ${b.screen}` : ""}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5} flexWrap="wrap">
                          {b.seats.slice(0, 4).map((s) => (
                            <Chip key={s} size="small" label={s} variant="outlined" />
                          ))}
                          {b.seats.length > 4 && (
                            <Chip size="small" label={`+${b.seats.length - 4}`} variant="outlined" />
                          )}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={capitalize(b.status)}
                          color={statusColor[b.status]}
                          variant={b.status === "CANCELLED" ? "outlined" : "filled"}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end" alignItems="center">
                          <PaidOutlinedIcon fontSize="small" color="action" />
                          <Typography fontWeight={600}>{currencyFormat(b.total, b.currency)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Tooltip title="Details">
                            <span>
                              <IconButton onClick={() => setSelected(b)} aria-label="details">
                                <InfoOutlinedIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title={b.status === "CANCELLED" ? "Already cancelled" : "Cancel booking"}>
                            <span>
                              <IconButton
                                aria-label="cancel"
                                onClick={() => cancelMutation.mutate(b.id)}
                                disabled={b.status === "CANCELLED" || cancelMutation.isPending}
                                color="error"
                              >
                                <DeleteOutlineIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Divider />
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={pageSize}
          onRowsPerPageChange={(e) => {
            setPageSize(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[5, 10, 20, 50]}
          labelRowsPerPage="Rows"
        />
      </Paper>

      <BookingDetailsDialog
        booking={selected}
        onClose={() => setSelected(null)}
        onCancel={(id) => cancelMutation.mutate(id)}
        cancelDisabled={cancelMutation.isPending}
      />

      {isError && (
        <Box sx={{ mt: 2 }}>
          <ErrorBanner error={error} onRetry={() => refetch()} />
        </Box>
      )}
    </Box>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <Stack
      alignItems="center"
      justifyContent="center"
      spacing={1}
      sx={{ py: 6, color: "text.secondary", textAlign: "center" }}
    >
      <LocalActivityOutlinedIcon color="disabled" sx={{ fontSize: 48 }} />
      <Typography>No bookings found</Typography>
      <Typography variant="body2">Try adjusting your filters or search query.</Typography>
      <Button variant="outlined" onClick={onReset} sx={{ mt: 1 }}>
        Reset filters
      </Button>
    </Stack>
  );
}

function ErrorBanner({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message =
    (error as AxiosError<{ message?: string }>)?.response?.data?.message ||
    (error as Error)?.message ||
    "Something went wrong";
  return (
    <Paper variant="outlined" sx={{ p: 2, borderColor: "error.main", bgcolor: "error.main", color: "error.contrastText" }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} spacing={2}>
        <Typography sx={{ flex: 1 }}>Error: {message}</Typography>
        <Button onClick={onRetry} variant="contained" color="inherit">
          Retry
        </Button>
      </Stack>
    </Paper>
  );
}

function BookingDetailsDialog({
  booking,
  onClose,
  onCancel,
  cancelDisabled,
}: {
  booking: Booking | null;
  onClose: () => void;
  onCancel: (id: string) => void;
  cancelDisabled?: boolean;
}) {
  if (!booking) return null;

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Booking Details</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Stack spacing={0.5}>
            <Typography variant="overline" color="text.secondary">
              Movie
            </Typography>
            <Typography variant="h6">{booking.movieTitle}</Typography>
          </Stack>

          <Stack direction="row" spacing={2} flexWrap="wrap">
            <InfoItem icon={<EventOutlinedIcon fontSize="small" />} label="Date" value={dateFormat(booking.screeningTime)} />
            <InfoItem icon={<AccessTimeOutlinedIcon fontSize="small" />} label="Time" value={timeFormat(booking.screeningTime)} />
            <InfoItem icon={<PlaceOutlinedIcon fontSize="small" />} label="Venue" value={booking.venue || "—"} />
            <InfoItem icon={<TheatersOutlinedIcon fontSize="small" />} label="Screen" value={booking.screen || "—"} />
          </Stack>

          <Stack spacing={0.5}>
            <Typography variant="overline" color="text.secondary">
              Seats
            </Typography>
            <Stack direction="row" spacing={0.5} flexWrap="wrap">
              {booking.seats.map((s) => (
                <Chip key={s} size="small" label={s} variant="outlined" />
              ))}
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="overline" color="text.secondary">
              Status:
            </Typography>
            <Chip
              size="small"
              label={capitalize(booking.status)}
              color={statusColor[booking.status]}
              variant={booking.status === "CANCELLED" ? "outlined" : "filled"}
            />
          </Stack>

          <Divider />

          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle2" color="text.secondary">
              Total Paid
            </Typography>
            <Typography variant="h6">{currencyFormat(booking.total, booking.currency)}</Typography>
          </Stack>

          {booking.qrCodeUrl && (
            <>
              <Divider />
              <Stack spacing={1} alignItems="center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={booking.qrCodeUrl}
                  alt="Booking QR code"
                  style={{ width: 180, height: 180, objectFit: "contain" }}
                />
                <Typography variant="caption" color="text.secondary">
                  Present this QR code at the venue
                </Typography>
              </Stack>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button
          color="error"
          startIcon={<DeleteOutlineIcon />}
          onClick={() => onCancel(booking.id)}
          disabled={booking.status === "CANCELLED" || cancelDisabled}
        >
          Cancel booking
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 180 }}>
      {icon}
      <Stack spacing={0}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2">{value}</Typography>
      </Stack>
    </Stack>
  );
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}