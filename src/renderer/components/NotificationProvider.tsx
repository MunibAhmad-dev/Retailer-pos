import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';

export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  timestamp: string;
  read: boolean;
}

interface NotificationContextProps {
  notifications: AppNotification[];
  unreadCount: number;
  addNotification: (title: string, message: string, type?: NotificationType) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const NotificationContext = createContext<NotificationContextProps | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('pos-notifications');
    if (stored) {
      try {
        setNotifications(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse notifications', e);
      }
    }
  }, []);

  // Save to localStorage whenever notifications change
  useEffect(() => {
    localStorage.setItem('pos-notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (title: string, message: string, type: NotificationType = 'info') => {
    const newNotif: AppNotification = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false,
    };

    setNotifications(prev => [newNotif, ...prev].slice(0, 50)); // Keep only last 50

    // Also trigger Sonner toast
    if (type === 'success') toast.success(title, { description: message });
    else if (type === 'error') toast.error(title, { description: message });
    else if (type === 'warning') toast.warning(title, { description: message });
    else toast.info(title, { description: message });
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, addNotification, markAsRead, markAllAsRead, clearAll }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
