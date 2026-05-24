import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const TOKEN_KEY = 'retail_pos_auth_token';
const API_BASE_URL_KEY = 'retail_pos_api_base_url';

// Central Axios instance. UI components should call domain API modules, not this file directly.
export const apiClient = axios.create({
  baseURL: localStorage.getItem(API_BASE_URL_KEY) || '',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Keeps the base URL configurable from setup/settings without rebuilding the app.
export function setApiBaseUrl(baseURL: string) {
  localStorage.setItem(API_BASE_URL_KEY, baseURL);
  apiClient.defaults.baseURL = baseURL;
}

// Stores auth tokens in renderer storage so requests can attach them automatically.
export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Wraps Axios errors into plain Error objects so callers get consistent messages.
export function normalizeApiError(error: unknown) {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>;
    return new Error(axiosError.response?.data?.message || axiosError.response?.data?.error || axiosError.message || 'API request failed');
  }
  return error instanceof Error ? error : new Error('Unexpected API error');
}

// Generic request helper used by all API modules. It always returns response.data.
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  try {
    const response = await apiClient.request<T>(config);
    return response.data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
