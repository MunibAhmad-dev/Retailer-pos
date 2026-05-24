import { request, setAuthToken } from './apiClient';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterBusinessPayload {
  businessName: string;
  ownerName: string;
  mobile: string;
  email?: string;
  address?: string;
}

// Authenticates a cloud/admin user and stores the returned token when present.
export async function login(payload: LoginPayload) {
  const data = await request<any>({ method: 'POST', url: '/auth/login', data: payload });
  if (data?.token) setAuthToken(data.token);
  return data;
}

// Registers the current business with the cloud backend.
export async function registerBusiness(payload: RegisterBusinessPayload) {
  return request<any>({ method: 'POST', url: '/businesses/register', data: payload });
}

// Validates a license without requiring local POS storage to stop working.
export async function validateLicense(licenseKey: string) {
  return request<any>({ method: 'POST', url: '/licenses/validate', data: { licenseKey } });
}

// Refreshes the cloud auth token and stores the new one for future requests.
export async function refreshToken(refreshTokenValue: string) {
  const data = await request<any>({ method: 'POST', url: '/auth/refresh', data: { refreshToken: refreshTokenValue } });
  if (data?.token) setAuthToken(data.token);
  return data;
}
