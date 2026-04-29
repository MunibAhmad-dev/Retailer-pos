import React from 'react';
import { Navigate } from 'react-router-dom';
import { subService } from '../services/subscription';
import { useNotifications } from './NotificationProvider';

interface Props {
  routeName: string;
  children: React.ReactNode;
}

export function ProtectedRoute({ routeName, children }: Props) {
  const { addNotification } = useNotifications();
  
  if (!subService.canAccess(routeName)) {
    addNotification("Access Denied", "Your subscription has expired. Please renew to access this module.", "error");
    return <Navigate to="/sales" replace />;
  }

  return <>{children}</>;
}
