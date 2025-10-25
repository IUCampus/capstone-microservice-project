import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ColorModeProvider from './theme/ColorModeContext'
import { router } from './routes'

const qc = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ColorModeProvider>
            <QueryClientProvider client={qc}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </ColorModeProvider>
    </React.StrictMode>
)