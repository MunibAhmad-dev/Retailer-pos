import { get, post, del } from './client';

export interface AdminNotification {
  id: number;
  title: string;
  body: string;
  instance_id?: string;
  created_at: string;
}

export interface CreateNotificationBody {
  title: string;
  body: string;
  instance_id?: string;
}

export function getNotifications(): Promise<AdminNotification[]> {
  return get<AdminNotification[]>('/api/admin/notifications');
}

export function createNotification(
  body: CreateNotificationBody,
): Promise<AdminNotification> {
  return post<AdminNotification>('/api/admin/notifications', body);
}

export function deleteNotification(id: number): Promise<void> {
  return del<void>(`/api/admin/notifications/${id}`);
}
