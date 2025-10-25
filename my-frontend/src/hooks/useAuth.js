import { useAuthStore } from '../store/auth';
export const useAuth = () => {
    const { token, userId, login, logout } = useAuthStore();
    const isAuthenticated = Boolean(token && userId);
    return { token, userId, login, logout, isAuthenticated };
};
Object.defineProperty(globalThis, 'localStorage', {
    value: {
        getItem: () => null,
        setItem: () => { },
        removeItem: () => { },
        clear: () => { },
    },
    writable: true,
});
