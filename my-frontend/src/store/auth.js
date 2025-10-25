import { create } from 'zustand';
export const useAuthStore = create((set) => ({
    token: localStorage.getItem('token'),
    userId: localStorage.getItem('userId'),
    login: (token, userId) => {
        localStorage.setItem('token', token);
        localStorage.setItem('userId', userId);
        set({ token, userId });
    },
    logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        set({ token: null, userId: null });
    },
}));
