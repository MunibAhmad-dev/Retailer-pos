import axios from 'axios';

// Priority: VITE_API_URL env var (baked in at build time)
//   → production hardcoded URL (always works even if Secret wasn't set)
//   → '/api' dev proxy (localhost only)
const BASE_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'https://osatechcloud.cloud/api';

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

// Attach JWT automatically
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to /login on 401
client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default client;
