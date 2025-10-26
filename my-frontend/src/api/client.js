import axios from 'axios';
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true,
});
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('access_token'); // or from your state/store
    if (token) {
        // @ts-ignore
        config.headers = config.headers ?? {};
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});
// Optional: handle 401 to refresh or redirect
let isRefreshing = false;
let pending = [];
api.interceptors.response.use((res) => res, async (error) => {
    if (error.response?.status !== 401)
        return Promise.reject(error);
    // Avoid infinite loop on refresh endpoint itself
    const original = error.config;
    if (original?.url?.includes('/auth/refresh')) {
        // Refresh failed – logout
        localStorage.removeItem('access_token');
        window.location.href = '/login';
        return Promise.reject(error);
    }
    // Example refresh flow (adjust to your API)
    if (!isRefreshing) {
        isRefreshing = true;
        try {
            const refreshResp = await axios.post('VITE_API_BASE_URL/auth/refresh', {}, { withCredentials: true } // if refresh uses httpOnly cookie
            );
            const newToken = refreshResp.data.accessToken;
            localStorage.setItem('access_token', newToken);
            pending.forEach((resolve) => resolve(newToken));
            pending = [];
            return api({
                ...original,
                headers: { ...original.headers, Authorization: `Bearer ${newToken}` },
            });
        }
        catch (e) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            return Promise.reject(e);
        }
        finally {
            isRefreshing = false;
        }
    }
    // Queue requests while refreshing
    return new Promise((resolve) => {
        pending.push((newToken) => {
            resolve(api({
                ...original,
                headers: { ...original.headers, Authorization: `Bearer ${newToken}` },
            }));
        });
    });
});
export default api;
