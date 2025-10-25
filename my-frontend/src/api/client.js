import axios from 'axios';
const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true,
});
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token)
        config.headers.Authorization = `Bearer ${token}`;
    return config;
});
api.interceptors.response.use(res => res, err => {
    // optionally handle global 401
    if (err?.response?.status === 401) {
        // logout flow hook in store could be dispatched here
    }
    return Promise.reject(err);
});
export default api;
