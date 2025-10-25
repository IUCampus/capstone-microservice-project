import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { useAuthStore } from '../store/auth'

type LoginResponse = {
  access_token?: string
  refresh_token?: string
  role?: string
  user?: { id: string; email: string; name?: string }
}

type LoginFormInputs = {
  email: string
  password: string
}

async function handleLogin(email: string, password: string) {

  const res = await axios.post<LoginResponse>('/api/users/login', { email, password })
  const { access_token, refresh_token, user } = res.data ?? {}

  if (!access_token) {
    throw new Error('Login response missing access_token')
  }

  // Derive user id (prefer API user.id, fallback to JWT "sub")
  let userId = user?.id
  if (!userId) {
    try {
      const [, payload] = access_token.split('.')
      if (payload) {
        const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
        const json = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        )
        const data = JSON.parse(json) as { sub?: string; user_id?: string }
        userId = data.sub ?? data.user_id ?? undefined
      }
    } catch {
      /* ignore */
    }
  }
  if (!userId) throw new Error('Could not determine user id from response')

  // Persist via auth store
  useAuthStore.getState().login(access_token, userId)

  // Keep refresh token for silent renewals
  if (refresh_token) {
    localStorage.setItem('refresh_token', refresh_token)
  }

  // Ensure subsequent requests carry the token immediately
  axios.defaults.headers.common.Authorization = `Bearer ${access_token}`

  return { userId }
}

const Login: React.FC = () => {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormInputs>({
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginFormInputs) => {
    setServerError(null)
    try {
      await handleLogin(data.email, data.password)
      navigate('/profile')
    } catch (err) {
      const message =
        (err as any)?.response?.data?.error ??
        (err as Error)?.message ??
        'Login failed. Please try again.'
      setServerError(message)
    }
  }

  return (
    <Box display="flex" justifyContent="center" mt={6}>
      <Paper sx={{ p: 4, width: 420 }}>
        <Typography variant="h5" mb={2}>
          Login
        </Typography>

        {serverError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {serverError}
          </Alert>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={2}>
            <TextField
              label="Email"
              type="email"
              autoComplete="email"
              fullWidth
              error={!!errors.email}
              helperText={errors.email?.message}
              {...register('email', {
                required: 'Email is required',
                pattern: {
                  value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                  message: 'Enter a valid email address',
                },
              })}
            />

            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              fullWidth
              error={!!errors.password}
              helperText={errors.password?.message}
              {...register('password', {
                required: 'Password is required',
                minLength: {
                  value: 6,
                  message: 'Password must be at least 6 characters',
                },
              })}
            />

            <Button type="submit" variant="contained" disabled={isSubmitting} fullWidth size="large">
              {isSubmitting ? (
                <>
                  <CircularProgress color="inherit" size={20} sx={{ mr: 1 }} />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </Stack>

          <Stack sx={{ mt: 2 }}>
            <Typography variant="body2">
              Don&apos;t have an account?{' '}
              <a href="/bookings">
                <strong>Booking</strong>
              </a>
            </Typography>
          </Stack>
        </form>
      </Paper>
    </Box>
  )
}

export default Login