import React from 'react';
import {
  Avatar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import LogoutIcon from '@mui/icons-material/Logout';
import EmailIcon from '@mui/icons-material/Email';
import PersonIcon from '@mui/icons-material/Person';
import PhoneIphoneIcon from '@mui/icons-material/PhoneIphone';
import LockResetIcon from '@mui/icons-material/LockReset';
import SaveIcon from '@mui/icons-material/Save';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import axios, { type AxiosRequestConfig } from 'axios';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
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

// Types
type User = {
  id?: string;
  name: string;
  phone?: string | null;
  email: string;
  avatarUrl?: string | null;
  createdAt?: string;
  preferences?: { emailNotifications: boolean };
};

type UpdateMePayload = {
  name: string;
  phone: string | null;
  preferences: { emailNotifications: boolean };
};

type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

// Fetch user data and handle authentication headers
function useAuthHeaders(): AxiosRequestConfig {
  const token = useAuthStore((s) => s.token);
  return React.useMemo(
    () => ({
      withCredentials: true,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }),
    [token],
  );
}

async function fetchMe(config: AxiosRequestConfig): Promise<User> {
  const res = await axios.get(`http://localhost:5000/users/me`, config);
  return res.data;
}

async function updateMe(payload: UpdateMePayload, config: AxiosRequestConfig): Promise<User> {
  const res = await axios.patch(`http://localhost:5000/users/me`, payload, config);
  return res.data;
}

async function uploadAvatar(
  file: File,
  config: AxiosRequestConfig,
): Promise<{ avatarUrl: string }> {
  const form = new FormData();
  form.append('avatar', file);
  const res = await axios.post(`http://localhost:5000/users/me/avatar`, form, {
    ...config,
    headers: { ...config.headers, 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

async function changePassword(payload: ChangePasswordPayload, config: AxiosRequestConfig) {
  await axios.post(`http://localhost:5000/users/me/password`, payload, config);
}

// Main ProfileContent component
function ProfileContent() {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const authConfig = useAuthHeaders();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery<User>({
    queryKey: ['me'],
    queryFn: () => fetchMe(authConfig),
    staleTime: 60000,
  });

  type ProfileFormValues = z.infer<typeof profileSchema>;
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
    watch,
    setValue,
  } = useForm<ProfileFormValues>({
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

  const updateMutation = useMutation<User, unknown, UpdateMePayload>({
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
      const message =
        (axios.isAxiosError(err) && (err.response?.data?.message || err.message)) ||
        'Failed to update profile';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });

  const avatarMutation = useMutation<{ avatarUrl: string }, unknown, File>({
    mutationFn: (file) => uploadAvatar(file, authConfig),
    onSuccess: ({ avatarUrl }) => {
      enqueueSnackbar('Avatar updated', { variant: 'success' });
      queryClient.setQueryData<User | undefined>(['me'], (prev) =>
        prev ? { ...prev, avatarUrl } : prev,
      );
    },
    onError: () => enqueueSnackbar('Failed to upload avatar', { variant: 'error' }),
  });

  const passwordMutation = useMutation<void, unknown, ChangePasswordPayload>({
    mutationFn: (payload) => changePassword(payload, authConfig),
    onSuccess: () => enqueueSnackbar('Password changed successfully', { variant: 'success' }),
    onError: (err) => {
      const message =
        (axios.isAxiosError(err) && (err.response?.data?.message || err.message)) ||
        'Failed to change password';
      enqueueSnackbar(message, { variant: 'error' });
    },
  });

  const onSubmit = (values: ProfileFormValues) => {
    const payload: UpdateMePayload = {
      name: values.name.trim(),
      phone: values.phone?.trim() || null,
      preferences: { emailNotifications: values.emailNotifications },
    };
    return updateMutation.mutateAsync(payload);
  };

  const [pwVisible, setPwVisible] = React.useState(false);

  type PasswordFormValues = z.infer<typeof passwordSchema>;
  const {
    register: registerPw,
    handleSubmit: handleSubmitPw,
    reset: resetPw,
    formState: { errors: pwErrors, isSubmitting: pwIsSubmitting },
  } = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    mode: 'onTouched',
  });

  const onChangePassword = (values: PasswordFormValues) =>
    passwordMutation
      .mutateAsync({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      .then(() => resetPw());

  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const onPickAvatar = () => fileInputRef.current?.click();

  const onAvatarSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
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
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack direction="row" spacing={3} alignItems="center">
            <Skeleton variant="circular" width={88} height={88} />
            <Stack spacing={1} flex={1}>
              <Skeleton variant="text" width="30%" />
              <Skeleton variant="text" width="50%" />
            </Stack>
          </Stack>
          <Divider sx={{ my: 3 }} />
          <Skeleton variant="rounded" height={56} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={56} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={56} sx={{ mb: 2 }} />
        </Paper>
      </Container>
    );
  }

  if (isError || !data) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Unable to load profile
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please try again.
          </Typography>
          <Button variant="contained" onClick={() => refetch()}>
            Retry
          </Button>
        </Paper>
      </Container>
    );
  }

  const initials =
    (data.name ?? '')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .filter(Boolean)
      .join('') || data.email?.[0]?.toUpperCase() || '?';

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              badgeContent={
                <Tooltip title="Change avatar">
                  <IconButton
                    color="primary"
                    size="small"
                    sx={{
                      bgcolor: 'background.paper',
                      boxShadow: 1,
                      '&:hover': { bgcolor: 'background.paper' },
                    }}
                    onClick={onPickAvatar}
                  >
                    {avatarMutation.isPending ? (
                      <CircularProgress size={18} />
                    ) : (
                      <PhotoCameraIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
              }
            >
              <Avatar src={data.avatarUrl || undefined} sx={{ width: 96, height: 96, fontSize: 28 }}>
                {initials}
              </Avatar>
            </Badge>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={onAvatarSelected}
            />
            <Box flex={1} minWidth={0}>
              <Typography variant="h6" noWrap>
                {data.name || 'Your name'}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap>
                {data.email}
              </Typography>
              {data.createdAt && (
                <Typography variant="caption" color="text.secondary">
                  Member since {new Date(data.createdAt).toLocaleDateString()}
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<LogoutIcon />}
                onClick={handleLogout}
              >
                Sign out
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ mb: 2 }}>
            Account details
          </Typography>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Full name"
                fullWidth
                autoComplete="name"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                error={!!errors.name}
                helperText={errors.name?.message}
                {...register('name')}
              />
              <TextField
                label="Email"
                fullWidth
                value={data.email}
                disabled
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                helperText="Email address is not editable"
              />
              <TextField
                label="Phone"
                fullWidth
                placeholder="+1 (555) 123-4567"
                autoComplete="tel"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneIphoneIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
                error={!!errors.phone}
                helperText={errors.phone?.message}
                {...register('phone')}
              />
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{
                  px: 1,
                  py: 1,
                  border: (t) => `1px solid ${t.palette.divider}`,
                  borderRadius: 1,
                }}
              >
                <Box>
                  <Typography variant="body1">Email notifications</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Receive updates and reminders
                  </Typography>
                </Box>
                <Switch
                  {...register('emailNotifications')}
                  checked={watch('emailNotifications')}
                  onChange={(_, checked) =>
                    setValue('emailNotifications', checked, { shouldDirty: true })
                  }
                />
              </Stack>

              <Stack direction="row" spacing={1} justifyContent="flex-end">
                <Button
                  type="button"
                  variant="outlined"
                  startIcon={<RestartAltIcon />}
                  disabled={!isDirty || isSubmitting}
                  onClick={() =>
                    reset({
                      name: data.name ?? '',
                      phone: data.phone ?? '',
                      emailNotifications: data.preferences?.emailNotifications ?? true,
                    })
                  }
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={
                    isSubmitting || updateMutation.isPending ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <SaveIcon />
                    )
                  }
                  disabled={!isDirty || isSubmitting || updateMutation.isPending}
                >
                  Save changes
                </Button>
              </Stack>
            </Stack>
          </form>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <LockResetIcon fontSize="small" color="action" />
            <Typography variant="subtitle1">Change password</Typography>
          </Stack>
          <form onSubmit={handleSubmitPw(onChangePassword)} noValidate>
            <Stack spacing={2}>
              <TextField
                label="Current password"
                type={pwVisible ? 'text' : 'password'}
                fullWidth
                error={!!pwErrors.currentPassword}
                helperText={pwErrors.currentPassword?.message}
                {...registerPw('currentPassword')}
              />
              <TextField
                label="New password"
                type={pwVisible ? 'text' : 'password'}
                fullWidth
                error={!!pwErrors.newPassword}
                helperText={pwErrors.newPassword?.message}
                {...registerPw('newPassword')}
              />
              <TextField
                label="Confirm new password"
                type={pwVisible ? 'text' : 'password'}
                fullWidth
                error={!!pwErrors.confirmNewPassword}
                helperText={pwErrors.confirmNewPassword?.message}
                {...registerPw('confirmNewPassword')}
              />
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                <Button
                  type="button"
                  size="small"
                  onClick={() => setPwVisible((v) => !v)}
                  startIcon={<EditIcon />}
                >
                  {pwVisible ? 'Hide' : 'Show'} passwords
                </Button>
                <Stack direction="row" spacing={1}>
                  <Button
                    type="button"
                    variant="outlined"
                    color="inherit"
                    onClick={() => resetPw()}
                    startIcon={<RestartAltIcon />}
                    disabled={pwIsSubmitting || passwordMutation.isPending}
                  >
                    Clear
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    startIcon={
                      pwIsSubmitting || passwordMutation.isPending ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <SaveIcon />
                      )
                    }
                    disabled={pwIsSubmitting || passwordMutation.isPending}
                  >
                    Update password
                  </Button>
                </Stack>
              </Stack>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Container>
  );
}

const queryClient = new QueryClient();

export default function Profile() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileContent />
    </QueryClientProvider>
  );
}