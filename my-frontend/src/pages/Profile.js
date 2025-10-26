import React from 'react';
import { Avatar, Badge, Box, Button, CircularProgress, Container, Divider, IconButton, InputAdornment, Paper, Skeleton, Stack, Switch, TextField, Tooltip, Typography, } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LogoutIcon from '@mui/icons-material/Logout';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import LockResetIcon from '@mui/icons-material/LockReset';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import axios from 'axios';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { QueryClient, QueryClientProvider, useMutation, useQuery, useQueryClient, } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
// Define Zod schemas for validation
const profileSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long'),
    phone: z
        .string()
        .trim()
        .optional()
        .refine((v) => !v || /^\+?\d[\d\s.-]{7,20}$/.test(v), 'Enter a valid phone number or leave empty'),
    emailNotifications: z.boolean().default(true),
});
const passwordSchema = z
    .object({
    currentPassword: z.string().min(6, 'Current password is required'),
    newPassword: z
        .string()
        .min(8, 'New password must be at least 8 characters')
        .regex(/[A-Z]/, 'Must include an uppercase letter')
        .regex(/[a-z]/, 'Must include a lowercase letter')
        .regex(/\d/, 'Must include a number'),
    confirmNewPassword: z.string().min(1, 'Please confirm your new password'),
})
    .refine((data) => data.newPassword === data.confirmNewPassword, {
    path: ['confirmNewPassword'],
    message: 'Passwords do not match',
});
// Fetch user data and handle authentication headers
function useAuthHeaders() {
    const token = useAuthStore((s) => s.token);
    return React.useMemo(() => ({
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    }), [token]);
}
async function fetchMe(config) {
    const res = await axios.get(`http://localhost:5000/users/me`, config);
    return res.data;
}
async function updateMe(payload, config) {
    const res = await axios.patch(`http://localhost:5000/users/me`, payload, config);
    return res.data;
}
async function uploadAvatar(file, config) {
    const form = new FormData();
    form.append('avatar', file);
    const res = await axios.post(`http://localhost:5000/users/me/avatar`, form, {
        ...config,
        headers: { ...config.headers, 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
}
async function changePassword(payload, config) {
    await axios.post(`http://localhost:5000/users/me/password`, payload, config);
}
// Main ProfileContent component
function ProfileContent() {
    const { enqueueSnackbar } = useSnackbar();
    const navigate = useNavigate();
    const logout = useAuthStore((s) => s.logout);
    const authConfig = useAuthHeaders();
    const queryClient = useQueryClient();
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['me'],
        queryFn: () => fetchMe(authConfig),
        staleTime: 60000,
    });
    const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting }, watch, setValue, } = useForm({
        //resolver: zodResolver(profileSchema),
        defaultValues: {
            name: '',
            phone: '',
            emailNotifications: true,
        },
        mode: 'onTouched',
    });
    React.useEffect(() => {
        if (data) {
            reset({
                name: data.name ?? '',
                phone: data.phone ?? '',
                emailNotifications: data.preferences?.emailNotifications ?? true,
            });
        }
    }, [data, reset]);
    const updateMutation = useMutation({
        mutationFn: (payload) => updateMe(payload, authConfig),
        onSuccess: (updated) => {
            enqueueSnackbar('Profile updated', { variant: 'success' });
            queryClient.setQueryData(['me'], updated);
            reset({
                name: updated.name ?? '',
                phone: updated.phone ?? '',
                emailNotifications: updated.preferences?.emailNotifications ?? true,
            });
        },
        onError: (err) => {
            const message = (axios.isAxiosError(err) && (err.response?.data?.message || err.message)) ||
                'Failed to update profile';
            enqueueSnackbar(message, { variant: 'error' });
        },
    });
    const avatarMutation = useMutation({
        mutationFn: (file) => uploadAvatar(file, authConfig),
        onSuccess: ({ avatarUrl }) => {
            enqueueSnackbar('Avatar updated', { variant: 'success' });
            queryClient.setQueryData(['me'], (prev) => prev ? { ...prev, avatarUrl } : prev);
        },
        onError: () => enqueueSnackbar('Failed to upload avatar', { variant: 'error' }),
    });
    const passwordMutation = useMutation({
        mutationFn: (payload) => changePassword(payload, authConfig),
        onSuccess: () => enqueueSnackbar('Password changed successfully', { variant: 'success' }),
        onError: (err) => {
            const message = (axios.isAxiosError(err) && (err.response?.data?.message || err.message)) ||
                'Failed to change password';
            enqueueSnackbar(message, { variant: 'error' });
        },
    });
    const onSubmit = (values) => {
        const payload = {
            name: values.name.trim(),
            phone: values.phone?.trim() || null,
            preferences: { emailNotifications: values.emailNotifications },
        };
        return updateMutation.mutateAsync(payload);
    };
    const [pwVisible, setPwVisible] = React.useState(false);
    const { register: registerPw, handleSubmit: handleSubmitPw, reset: resetPw, formState: { errors: pwErrors, isSubmitting: pwIsSubmitting }, } = useForm({
        resolver: zodResolver(passwordSchema),
        mode: 'onTouched',
    });
    const onChangePassword = (values) => passwordMutation
        .mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
    })
        .then(() => resetPw());
    const fileInputRef = React.useRef(null);
    const onPickAvatar = () => fileInputRef.current?.click();
    const onAvatarSelected = (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) {
            enqueueSnackbar('Please select an image file (png, jpg, webp, gif)', { variant: 'warning' });
            return;
        }
        if (file.size > 2.5 * 1024 * 1024) {
            enqueueSnackbar('Image too large (max 2.5MB)', { variant: 'warning' });
            return;
        }
        avatarMutation.mutate(file);
        // Reset input so same file can be picked again
        e.currentTarget.value = '';
    };
    const handleLogout = () => {
        logout();
        enqueueSnackbar('Signed out', { variant: 'info' });
        navigate('/login');
    };
    if (isLoading) {
        return (React.createElement(Container, { maxWidth: "md", sx: { py: 4 } },
            React.createElement(Paper, { variant: "outlined", sx: { p: 3 } },
                React.createElement(Stack, { direction: "row", spacing: 3, alignItems: "center" },
                    React.createElement(Skeleton, { variant: "circular", width: 88, height: 88 }),
                    React.createElement(Stack, { spacing: 1, flex: 1 },
                        React.createElement(Skeleton, { variant: "text", width: "30%" }),
                        React.createElement(Skeleton, { variant: "text", width: "50%" }))),
                React.createElement(Divider, { sx: { my: 3 } }),
                React.createElement(Skeleton, { variant: "rounded", height: 56, sx: { mb: 2 } }),
                React.createElement(Skeleton, { variant: "rounded", height: 56, sx: { mb: 2 } }),
                React.createElement(Skeleton, { variant: "rounded", height: 56, sx: { mb: 2 } }))));
    }
    if (isError || !data) {
        return (React.createElement(Container, { maxWidth: "sm", sx: { py: 6 } },
            React.createElement(Paper, { variant: "outlined", sx: { p: 4, textAlign: 'center' } },
                React.createElement(Typography, { variant: "h6", gutterBottom: true }, "Unable to load profile"),
                React.createElement(Typography, { variant: "body2", color: "text.secondary", sx: { mb: 2 } }, "Please try again."),
                React.createElement(Button, { variant: "contained", onClick: () => refetch() }, "Retry"))));
    }
    const initials = (data.name ?? '')
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase())
        .filter(Boolean)
        .join('') || data.email?.[0]?.toUpperCase() || '?';
    return (React.createElement(Container, { maxWidth: "md", sx: { py: 4 } },
        React.createElement(Stack, { spacing: 3 },
            React.createElement(Paper, { variant: "outlined", sx: { p: 3, borderRadius: 2 } },
                React.createElement(Stack, { direction: { xs: 'column', sm: 'row' }, spacing: 3, alignItems: "center" },
                    React.createElement(Badge, { overlap: "circular", anchorOrigin: { vertical: 'bottom', horizontal: 'right' }, badgeContent: React.createElement(Tooltip, { title: "Change avatar" },
                            React.createElement(IconButton, { color: "primary", size: "small", sx: {
                                    bgcolor: 'background.paper',
                                    boxShadow: 1,
                                    '&:hover': { bgcolor: 'background.paper' },
                                }, onClick: onPickAvatar }, avatarMutation.isPending ? (React.createElement(CircularProgress, { size: 18 })) : (React.createElement(PhotoCameraIcon, { fontSize: "small" })))) },
                        React.createElement(Avatar, { src: data.avatarUrl || undefined, sx: { width: 96, height: 96, fontSize: 28 } }, initials)),
                    React.createElement("input", { ref: fileInputRef, type: "file", accept: "image/png,image/jpeg,image/webp,image/gif", hidden: true, onChange: onAvatarSelected }),
                    React.createElement(Box, { flex: 1, minWidth: 0 },
                        React.createElement(Typography, { variant: "h6", noWrap: true }, data.name || 'Your name'),
                        React.createElement(Typography, { variant: "body2", color: "text.secondary", noWrap: true }, data.email),
                        data.createdAt && (React.createElement(Typography, { variant: "caption", color: "text.secondary" },
                            "Member since ",
                            new Date(data.createdAt).toLocaleDateString()))),
                    React.createElement(Stack, { direction: "row", spacing: 1 },
                        React.createElement(Button, { variant: "outlined", color: "inherit", startIcon: React.createElement(LogoutIcon, null), onClick: handleLogout }, "Sign out")))),
            React.createElement(Paper, { variant: "outlined", sx: { p: 3, borderRadius: 2 } },
                React.createElement(Typography, { variant: "subtitle1", sx: { mb: 2 } }, "Account details"),
                React.createElement("form", { onSubmit: handleSubmit(onSubmit), noValidate: true },
                    React.createElement(Stack, { spacing: 2 },
                        React.createElement(TextField, { label: "Full name", fullWidth: true, autoComplete: "name", InputProps: {
                                startAdornment: (React.createElement(InputAdornment, { position: "start" },
                                    React.createElement(PersonIcon, { fontSize: "small" }))),
                            }, error: !!errors.name, helperText: errors.name?.message, ...register('name') }),
                        React.createElement(TextField, { label: "Email", fullWidth: true, value: data.email, disabled: true, InputProps: {
                                startAdornment: (React.createElement(InputAdornment, { position: "start" },
                                    React.createElement(EmailIcon, { fontSize: "small" }))),
                            }, helperText: "Email address is not editable" }),
                        React.createElement(TextField, { label: "Phone", fullWidth: true, placeholder: "+1 (555) 123-4567", autoComplete: "tel", InputProps: {
                                startAdornment: (React.createElement(InputAdornment, { position: "start" },
                                    React.createElement(PhoneIphoneIcon, { fontSize: "small" }))),
                            }, error: !!errors.phone, helperText: errors.phone?.message, ...register('phone') }),
                        React.createElement(Stack, { direction: "row", alignItems: "center", justifyContent: "space-between", sx: {
                                px: 1,
                                py: 1,
                                border: (t) => `1px solid ${t.palette.divider}`,
                                borderRadius: 1,
                            } },
                            React.createElement(Box, null,
                                React.createElement(Typography, { variant: "body1" }, "Email notifications"),
                                React.createElement(Typography, { variant: "body2", color: "text.secondary" }, "Receive updates and reminders")),
                            React.createElement(Switch, { ...register('emailNotifications'), checked: watch('emailNotifications'), onChange: (_, checked) => setValue('emailNotifications', checked, { shouldDirty: true }) })),
                        React.createElement(Stack, { direction: "row", spacing: 1, justifyContent: "flex-end" },
                            React.createElement(Button, { type: "button", variant: "outlined", startIcon: React.createElement(RestartAltIcon, null), disabled: !isDirty || isSubmitting, onClick: () => reset({
                                    name: data.name ?? '',
                                    phone: data.phone ?? '',
                                    emailNotifications: data.preferences?.emailNotifications ?? true,
                                }) }, "Reset"),
                            React.createElement(Button, { type: "submit", variant: "contained", startIcon: isSubmitting || updateMutation.isPending ? (React.createElement(CircularProgress, { size: 18, color: "inherit" })) : (React.createElement(SaveIcon, null)), disabled: !isDirty || isSubmitting || updateMutation.isPending }, "Save changes"))))),
            React.createElement(Paper, { variant: "outlined", sx: { p: 3, borderRadius: 2 } },
                React.createElement(Stack, { direction: "row", alignItems: "center", spacing: 1, sx: { mb: 2 } },
                    React.createElement(LockResetIcon, { fontSize: "small", color: "action" }),
                    React.createElement(Typography, { variant: "subtitle1" }, "Change password")),
                React.createElement("form", { onSubmit: handleSubmitPw(onChangePassword), noValidate: true },
                    React.createElement(Stack, { spacing: 2 },
                        React.createElement(TextField, { label: "Current password", type: pwVisible ? 'text' : 'password', fullWidth: true, error: !!pwErrors.currentPassword, helperText: pwErrors.currentPassword?.message, ...registerPw('currentPassword') }),
                        React.createElement(TextField, { label: "New password", type: pwVisible ? 'text' : 'password', fullWidth: true, error: !!pwErrors.newPassword, helperText: pwErrors.newPassword?.message, ...registerPw('newPassword') }),
                        React.createElement(TextField, { label: "Confirm new password", type: pwVisible ? 'text' : 'password', fullWidth: true, error: !!pwErrors.confirmNewPassword, helperText: pwErrors.confirmNewPassword?.message, ...registerPw('confirmNewPassword') }),
                        React.createElement(Stack, { direction: "row", spacing: 1, alignItems: "center", justifyContent: "space-between" },
                            React.createElement(Button, { type: "button", size: "small", onClick: () => setPwVisible((v) => !v), startIcon: React.createElement(EditIcon, null) },
                                pwVisible ? 'Hide' : 'Show',
                                " passwords"),
                            React.createElement(Stack, { direction: "row", spacing: 1 },
                                React.createElement(Button, { type: "button", variant: "outlined", color: "inherit", onClick: () => resetPw(), startIcon: React.createElement(RestartAltIcon, null), disabled: pwIsSubmitting || passwordMutation.isPending }, "Clear"),
                                React.createElement(Button, { type: "submit", variant: "contained", startIcon: pwIsSubmitting || passwordMutation.isPending ? (React.createElement(CircularProgress, { size: 18, color: "inherit" })) : (React.createElement(SaveIcon, null)), disabled: pwIsSubmitting || passwordMutation.isPending }, "Update password")))))))));
}
const queryClient = new QueryClient();
export default function Profile() {
    return (React.createElement(QueryClientProvider, { client: queryClient },
        React.createElement(ProfileContent, null)));
}
