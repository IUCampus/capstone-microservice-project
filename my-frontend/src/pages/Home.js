import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Box, Container, Card, CardContent, CardActions, CardMedia, Typography, Button, Stack, Chip, Skeleton, TextField, InputAdornment, IconButton, ToggleButtonGroup, ToggleButton, Alert, Divider, Grid } from '@mui/material';
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
function getPosterUrl(movie) {
    const src = String(movie.posterUrl ?? '').trim();
    // Absolute or data/blob URLs
    if (/^(https?:|data:|blob:)/i.test(src))
        return src;
    // Try exact relative/path match (case-insensitive)
    const exact = Object.entries(posters).find(([p]) => p.toLowerCase().endsWith(src.toLowerCase()));
    if (exact)
        return exact[1];
    // Try by filename only
    const file = src.split('/').pop();
    if (file) {
        const byFile = Object.entries(posters).find(([p]) => p.toLowerCase().endsWith(file.toLowerCase()));
        if (byFile)
            return byFile[1];
    }
    // Try by movie id with common extensions
    const idStr = String(movie.id);
    const exts = ['jpg', 'jpeg', 'png', 'webp', 'svg'];
    for (const ext of exts) {
        const found = Object.entries(posters).find(([p]) => p.toLowerCase().endsWith(`/${idStr.toLowerCase()}.${ext}`));
        if (found)
            return found[1];
    }
    return '';
}
export default function Home() {
    const [movies, setMovies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState('title');
    const [reloadTick, setReloadTick] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        let isActive = true;
        const fetchMovies = async () => {
            try {
                setLoading(true);
                setError(null);
                const res = await axios.get('/api/movies/all', { signal: controller.signal });
                const data = Array.isArray(res.data) ? res.data : res.data?.movies ?? [];
                if (isActive) {
                    setMovies(data);
                }
            }
            catch (err) {
                if (axios.isCancel(err))
                    return;
                if (isActive) {
                    console.error(err);
                    setError('Failed to load movies.');
                }
            }
            finally {
                if (isActive)
                    setLoading(false);
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
        if (!q)
            return movies;
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
    return (React.createElement(Container, { maxWidth: "lg", sx: { py: 4 } },
        React.createElement(Stack, { direction: { xs: 'column', sm: 'row' }, alignItems: "center", justifyContent: "space-between", spacing: 2, sx: { mb: 3 } },
            React.createElement(Typography, { variant: "h4", fontWeight: 700 }, "Now Showing"),
            React.createElement(Stack, { direction: "row", spacing: 1, width: { xs: '100%', sm: 'auto' } },
                React.createElement(TextField, { fullWidth: true, size: "small", placeholder: "Search movies...", value: query, onChange: (e) => setQuery(e.target.value), InputProps: {
                        startAdornment: (React.createElement(InputAdornment, { position: "start" },
                            React.createElement(SearchIcon, { color: "action" }))),
                    }, inputProps: { 'aria-label': 'Search movies' } }),
                React.createElement(ToggleButtonGroup, { size: "small", value: sortKey, exclusive: true, onChange: (_, v) => v && setSortKey(v), "aria-label": "Sort movies" },
                    React.createElement(ToggleButton, { value: "title", "aria-label": "Sort by title" },
                        React.createElement(SortByAlphaIcon, { fontSize: "small", sx: { mr: 0.5 } }),
                        "Title"),
                    React.createElement(ToggleButton, { value: "rating", "aria-label": "Sort by rating" },
                        React.createElement(StarRateIcon, { fontSize: "small", sx: { mr: 0.5 } }),
                        "Rating"),
                    React.createElement(ToggleButton, { value: "runtime", "aria-label": "Sort by runtime" },
                        React.createElement(AccessTimeIcon, { fontSize: "small", sx: { mr: 0.5 } }),
                        "Runtime")),
                React.createElement(IconButton, { "aria-label": "Refresh", onClick: handleRetry, color: "primary" },
                    React.createElement(RefreshIcon, null)))),
        error && (React.createElement(Alert, { severity: "error", action: React.createElement(Button, { color: "inherit", size: "small", onClick: handleRetry }, "Retry"), sx: { mb: 2 } }, error)),
        loading ? (React.createElement(Grid, { container: true, spacing: 2 }, Array.from({ length: 8 }).map((_, i) => (React.createElement(Grid, { key: i },
            React.createElement(Card, { sx: { height: '100%', display: 'flex', flexDirection: 'column' } },
                React.createElement(Skeleton, { variant: "rectangular", height: 220 }),
                React.createElement(CardContent, { sx: { flexGrow: 1 } },
                    React.createElement(Skeleton, { width: "60%" }),
                    React.createElement(Skeleton, { width: "40%" }),
                    React.createElement(Stack, { direction: "row", spacing: 1, sx: { mt: 1 } },
                        React.createElement(Skeleton, { variant: "rounded", width: 60, height: 24 }),
                        React.createElement(Skeleton, { variant: "rounded", width: 80, height: 24 })),
                    React.createElement(Skeleton, { width: "80%", sx: { mt: 1 } })),
                React.createElement(CardActions, { sx: { px: 2, pb: 2 } },
                    React.createElement(Skeleton, { variant: "rounded", width: "100%", height: 36 })))))))) : hasData ? (React.createElement(Grid, { container: true, spacing: 3 }, sorted.map((movie) => {
            const title = movie.title ?? 'Untitled';
            const poster = getPosterUrl(movie);
            const runtime = movie.runtime ? `${movie.runtime} min` : undefined;
            const rating = typeof movie.rating === 'number' && Number.isFinite(movie.rating)
                ? movie.rating.toFixed(1)
                : undefined;
            const genres = Array.isArray(movie.genres) ? movie.genres : [];
            const to = `/screenings/${movie.id}`;
            return (React.createElement(Grid, { key: String(movie.id) },
                React.createElement(Card, { sx: {
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        borderRadius: 2,
                        overflow: 'hidden',
                    }, elevation: 2 },
                    poster ? (React.createElement(CardMedia, { component: "img", height: "220", image: poster, alt: `Poster for ${title}`, sx: { objectFit: 'cover' } })) : (React.createElement(Box, { height: 220, sx: {
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: (t) => (t.palette.mode === 'dark' ? 'grey.900' : 'grey.100'),
                        } },
                        React.createElement(Typography, { variant: "h6", color: "text.secondary" }, "No Poster"))),
                    React.createElement(CardContent, { sx: { flexGrow: 1 } },
                        React.createElement(Typography, { variant: "h6", fontWeight: 700, gutterBottom: true, noWrap: true }, title),
                        React.createElement(Stack, { direction: "row", spacing: 1, alignItems: "center", sx: { mb: 1 } },
                            rating && (React.createElement(Chip, { size: "small", color: "warning", icon: React.createElement(StarRateIcon, { fontSize: "small" }), label: rating, sx: { fontWeight: 600 } })),
                            runtime && (React.createElement(Chip, { size: "small", color: "default", icon: React.createElement(AccessTimeIcon, { fontSize: "small" }), label: runtime, variant: "outlined" }))),
                        React.createElement(Stack, { direction: "row", spacing: 1, flexWrap: "wrap", useFlexGap: true }, genres.slice(0, 3).map((g) => (React.createElement(Chip, { key: g, size: "small", label: g, variant: "outlined" })))),
                        movie.synopsis && (React.createElement(React.Fragment, null,
                            React.createElement(Divider, { sx: { my: 1.5 } }),
                            React.createElement(Typography, { variant: "body2", color: "text.secondary", sx: {
                                    display: '-webkit-box',
                                    WebkitLineClamp: 3,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                } }, String(movie.synopsis))))),
                    React.createElement(CardActions, { sx: { px: 2, pb: 2 } },
                        React.createElement(Button, { fullWidth: true, variant: "contained", component: Link, to: to, disableElevation: true, sx: { textTransform: 'none', fontWeight: 700 } }, "Select Seats")))));
        }))) : (React.createElement(Box, { sx: { py: 8, textAlign: 'center', color: 'text.secondary' } },
            React.createElement(Typography, { variant: "h6", gutterBottom: true }, "No movies available"),
            React.createElement(Typography, { variant: "body2", sx: { mb: 2 } }, "Try refreshing or check back later."),
            React.createElement(Button, { variant: "outlined", startIcon: React.createElement(RefreshIcon, null), onClick: handleRetry }, "Refresh")))));
}
