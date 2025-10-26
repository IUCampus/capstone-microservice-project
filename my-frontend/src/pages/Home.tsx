import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Box,
  Container,
  Card,
  CardContent,
  CardActions,
  CardMedia,
  Typography,
  Button,
  Stack,
  Chip,
  Skeleton,
  TextField,
  InputAdornment,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  Alert,
  Divider,
  Grid,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import StarRateIcon from '@mui/icons-material/StarRate';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Link } from 'react-router-dom';

// Load all images from /src/assets/img using Vite's glob import
const posters = import.meta.glob('../assets/img/**/*.{png,jpg,jpeg,webp,svg,PNG,JPG,JPEG,WEBP,SVG}', {
  eager: true,
  as: 'url',
});

function getPosterUrl(movie: any): string {
  const src = String(movie.posterUrl ?? '').trim();

  // Absolute or data/blob URLs
  if (/^(https?:|data:|blob:)/i.test(src)) return src;

  // Try exact relative/path match (case-insensitive)
  const exact = Object.entries(posters).find(([p]) => p.toLowerCase().endsWith(src.toLowerCase()));
  if (exact) return exact[1] as string;

  // Try by filename only
  const file = src.split('/').pop();
  if (file) {
    const byFile = Object.entries(posters).find(([p]) => p.toLowerCase().endsWith(file.toLowerCase()));
    if (byFile) return byFile[1] as string;
  }

  // Try by movie id with common extensions
  const idStr = String(movie.id);
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
  for (const ext of exts) {
    const found = Object.entries(posters).find(([p]) =>
      p.toLowerCase().endsWith(`/${idStr.toLowerCase()}.${ext}`),
    );
    if (found) return found[1] as string;
  }

  return '';
}

export default function Home() {
  const [movies, setMovies] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState<string>('');
  const [sortKey, setSortKey] = useState<'title' | 'rating' | 'runtime'>('title');
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;

    const fetchMovies = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await axios.get('http://localhost:5000/movies/all', { signal: controller.signal });
        const data = Array.isArray(res.data) ? res.data : res.data?.movies ?? [];
        if (isActive) {
          setMovies(data);
        }
      } catch (err) {
        if (axios.isCancel(err)) return;
        if (isActive) {
          console.error(err);
          setError('Failed to load movies.');
        }
      } finally {
        if (isActive) setLoading(false);
      }
    };

    fetchMovies();
    return () => {
      isActive = false;
      controller.abort();
    };
  }, [reloadTick]);

  const handleRetry = () => setReloadTick((t) => t + 1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return movies;
    return movies.filter((m) => (m.title ?? '').toString().toLowerCase().includes(q));
  }, [movies, query]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortKey) {
      case 'rating':
        arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        break;
      case 'runtime':
        arr.sort((a, b) => (b.runtime ?? 0) - (a.runtime ?? 0));
        break;
      default:
        arr.sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? '')));
    }
    return arr;
  }, [filtered, sortKey]);

  const hasData = sorted.length > 0;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 3 }}
      >
        <Typography variant="h4" fontWeight={700}>
          Now Showing
        </Typography>

        <Stack direction="row" spacing={1} width={{ xs: '100%', sm: 'auto' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search movies..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
            }}
            inputProps={{ 'aria-label': 'Search movies' }}
          />

          <ToggleButtonGroup
            size="small"
            value={sortKey}
            exclusive
            onChange={(_, v) => v && setSortKey(v)}
            aria-label="Sort movies"
          >
            <ToggleButton value="title" aria-label="Sort by title">
              <SortByAlphaIcon fontSize="small" sx={{ mr: 0.5 }} />
              Title
            </ToggleButton>
            <ToggleButton value="rating" aria-label="Sort by rating">
              <StarRateIcon fontSize="small" sx={{ mr: 0.5 }} />
              Rating
            </ToggleButton>
            <ToggleButton value="runtime" aria-label="Sort by runtime">
              <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
              Runtime
            </ToggleButton>
          </ToggleButtonGroup>

          <IconButton aria-label="Refresh" onClick={handleRetry} color="primary">
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Stack>

      {error && (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={handleRetry}>
              Retry
            </Button>
          }
          sx={{ mb: 2 }}
        >
          {error}
        </Alert>
      )}

      {loading ? (
        <Grid container spacing={2}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Grid key={i} >
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Skeleton variant="rectangular" height={220} />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Skeleton width="60%" />
                  <Skeleton width="40%" />
                  <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                    <Skeleton variant="rounded" width={60} height={24} />
                    <Skeleton variant="rounded" width={80} height={24} />
                  </Stack>
                  <Skeleton width="80%" sx={{ mt: 1 }} />
                </CardContent>
                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Skeleton variant="rounded" width="100%" height={36} />
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : hasData ? (
        <Grid container spacing={3}>
          {sorted.map((movie: any) => {
            const title = movie.title ?? 'Untitled';
            const poster = getPosterUrl(movie);
            const runtime = movie.runtime ? `${movie.runtime} min` : undefined;
            const rating =
              typeof movie.rating === 'number' && Number.isFinite(movie.rating)
                ? movie.rating.toFixed(1)
                : undefined;
            const genres = Array.isArray(movie.genres) ? movie.genres : [];
            const to = `/screenings/${movie.id}`;

            return (
              <Grid key={String(movie.id)} >
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                  elevation={2}
                >
                  {poster ? (
                    <CardMedia image={poster} sx={{ height: 220, objectFit: 'cover' }} />
                  ) : (
                    <Box
                      height={220}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: (t) => (t.palette.mode === 'dark' ? 'grey.900' : 'grey.100'),
                      }}
                    >
                      <Typography variant="h6" color="text.secondary">
                        No Poster
                      </Typography>
                    </Box>
                  )}

                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" fontWeight={700} gutterBottom noWrap>
                      {title}
                    </Typography>

                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                      {rating && (
                        <Chip
                          size="small"
                          color="warning"
                          icon={<StarRateIcon fontSize="small" />}
                          label={rating}
                          sx={{ fontWeight: 600 }}
                        />
                      )}
                      {runtime && (
                        <Chip
                          size="small"
                          color="default"
                          icon={<AccessTimeIcon fontSize="small" />}
                          label={runtime}
                          variant="outlined"
                        />
                      )}
                    </Stack>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {genres.slice(0, 3).map((g: string) => (
                        <Chip key={g} size="small" label={g} variant="outlined" />
                      ))}
                    </Stack>

                    {movie.synopsis && (
                      <>
                        <Divider sx={{ my: 1.5 }} />
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {String(movie.synopsis)}
                        </Typography>
                      </>
                    )}
                  </CardContent>

                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Link to={to} style={{ textDecoration: 'none', width: '100%' }}>
                      <Button
                        fullWidth
                        variant="contained"
                        disableElevation
                        sx={{ textTransform: 'none', fontWeight: 700 }}
                      >
                        Select Seats
                      </Button>
                    </Link>
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <Box sx={{ py: 8, textAlign: 'center,', color: 'text.secondary' }}>
          <Typography variant="h6" gutterBottom>
            No movies available
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Try refreshing or check back later.
          </Typography>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={handleRetry}>
            Refresh
          </Button>
        </Box>
      )}
    </Container>
  );
}