import { get, post, del } from './client';

export interface LicenseKey {
  key: string;
  plan: string;
  duration_days: number;
  notes?: string;
  assigned_to?: string;
  assigned_at?: string;
  created_at: string;
  expires_at?: string;
}

export interface CreateLicenseBody {
  plan: string;
  duration_days: number;
  notes?: string;
}

export function getLicenses(): Promise<LicenseKey[]> {
  return get<LicenseKey[]>('/api/admin/licenses');
}

export function createLicense(body: CreateLicenseBody): Promise<LicenseKey> {
  return post<LicenseKey>('/api/admin/licenses', body);
}

export function deleteLicense(key: string): Promise<void> {
  return del<void>(`/api/admin/licenses/${key}`);
}
