import React, { createContext, useMemo, useState } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from './index';
export const ColorModeContext = createContext({ toggleColorMode: () => { } });
export default function ColorModeProvider({ children }) {
    const [mode, setMode] = useState(localStorage.getItem('color-mode') || 'light');
    const value = useMemo(() => ({
        toggleColorMode: () => {
            setMode(prev => {
                const next = prev === 'light' ? 'dark' : 'light';
                localStorage.setItem('color-mode', next);
                return next;
            });
        },
    }), []);
    const theme = useMemo(() => getTheme(mode), [mode]);
    return (React.createElement(ColorModeContext.Provider, { value: value },
        React.createElement(ThemeProvider, { theme: theme },
            React.createElement(CssBaseline, null),
            children)));
}
