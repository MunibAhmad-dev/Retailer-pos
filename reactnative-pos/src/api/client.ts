import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { mmkv } from '../utils/storage';
import { EventEmitter } from 'events';

export const authEvents = new EventEmitter();

const DEFAULT_BASE_URL = 'https://osatechcloud.cloud';

function getBaseUrl(): string {
  const saved = mmkv.getString('backend_url');
  return saved || DEFAULT_BASE_URL;
}

const client: AxiosInstance = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor: attach JWT
client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Re-read base URL each request in case it was changed in settings
  config.baseURL = getBaseUrl();

  const token = mmkv.getString('admin_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: unwrap data.data, handle 401
client.interceptors.response.use(
  (response: AxiosResponse) => {
    // Unwrap nested data.data if present
    if (response.data && response.data.data !== undefined) {
      response.data = response.data.data;
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      mmkv.delete('admin_token');
      authEvents.emit('logout');
    }
    return Promise.reject(error);
  },
);

// Typed helper functions
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await client.get<T>(url, { params });
  return response.data;
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const response = await client.post<T>(url, body);
  return response.data;
}

export async function del<T = void>(url: string): Promise<T> {
  const response = await client.delete<T>(url);
  return response.data;
}

export default client;
