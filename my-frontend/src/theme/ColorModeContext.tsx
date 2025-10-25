import React, { createContext, useMemo, useState, PropsWithChildren } from 'react'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { getTheme } from './index'

export const ColorModeContext = createContext({ toggleColorMode: () => {} })

export default function ColorModeProvider({ children }: PropsWithChildren) {
    const [mode, setMode] = useState<'light' | 'dark'>(
        (localStorage.getItem('color-mode') as 'light' | 'dark') || 'light'
    )
    const value = useMemo(
        () => ({
            toggleColorMode: () => {
                setMode(prev => {
                    const next = prev === 'light' ? 'dark' : 'light'
                    localStorage.setItem('color-mode', next)
                    return next
                })
            },
        }),
        []
    )
    const theme = useMemo(() => getTheme(mode), [mode])

    return (
        <ColorModeContext.Provider value={value}>
            <ThemeProvider theme={theme}>
                <CssBaseline />
                {children}
            </ThemeProvider>
        </ColorModeContext.Provider>
    )
}