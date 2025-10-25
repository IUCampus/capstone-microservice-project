import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
Object.defineProperty(window, 'localStorage', {
    value: {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
    },
    writable: true,
});
describe('App', () => {
    it('renders top bar', () => {
        render(React.createElement(MemoryRouter, null,
            React.createElement(App, null)));
        expect(screen.getByText(/Movie Booking/i));
    });
});
