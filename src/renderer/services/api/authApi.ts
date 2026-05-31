import axios from 'axios';
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
  fingerprint?: string;   // daily-rotating device fingerprint for admin display
  branchName?: string;    // e.g. "Main Branch", "Saddar Branch"
}

export interface ApprovalStatusResponse {
  status: 'pending' | 'approved' | 'rejected';
  licenseKey?: string;
  message?: string;
}

export async function login(payload: LoginPayload) {
  const data = await request<any>({ method: 'POST', url: '/auth/login', data: payload });
  if (data?.token) setAuthToken(data.token);
  return data;
}

export async function registerBusiness(payload: RegisterBusinessPayload) {
  return request<any>({ method: 'POST', url: '/businesses/register', data: payload });
}

export async function validateLicense(licenseKey: string) {
  return request<any>({ method: 'POST', url: '/licenses/validate', data: { licenseKey } });
}

export async function refreshToken(refreshTokenValue: string) {
  const data = await request<any>({ method: 'POST', url: '/auth/refresh', data: { refreshToken: refreshTokenValue } });
  if (data?.token) setAuthToken(data.token);
  return data;
}

// Submits a new business registration to the cloud backend for admin approval.
// Uses mobile number as the unique identifier (instance_id).
// Returns { success, api_key, approval_status } on success.
export async function submitRegistration(
  payload: RegisterBusinessPayload,
  backendUrl: string,
  _retries = 3,
): Promise<{ success: boolean; instance_id?: string; api_key?: string; approval_status?: string; message?: string }> {
  const url = `${backendUrl.replace(/\/$/, '')}/api/register-business`;
  let lastErr: any;
  for (let attempt = 1; attempt <= _retries; attempt++) {
    try {
      const res = await axios.post(url, payload, {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' },
      });
      return res.data;
    } catch (err: any) {
      lastErr = err;
      // Don't retry on 4xx client errors (bad request, auth etc.)
      if (err?.response?.status && err.response.status < 500) throw err;
      // Wait before retrying (2 s, 4 s)
      if (attempt < _retries) await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }
  throw lastErr;
}

// Polls the cloud backend for the approval status.
// Prefer instance_id (UUID) for new multi-branch flow; falls back to mobile for old installs.
export async function checkApprovalStatus(
  mobile: string,
  backendUrl: string,
  instanceId?: string,
): Promise<{ success: boolean; status: 'pending' | 'approved' | 'blocked' | 'not_registered'; licenseKey?: string }> {
  const params = instanceId ? { instance_id: instanceId } : { mobile };
  const res = await axios.get(
    `${backendUrl.replace(/\/$/, '')}/api/approval-status`,
    { params, timeout: 10000 }
  );
  return res.data;
}