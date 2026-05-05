import React from 'react';
import { 
  Bell, CheckCircle2, AlertCircle, Info, Trash2 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { useNotifications } from './NotificationProvider';
import { cn } from '../lib/utils';

export function NotificationCenter() {
  const { 
    notifications, 
    unreadCount, 
    markAsRead, 
    markAllAsRead, 
    clearAll 
  } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="rounded-full h-10 w-10 border-border bg-background relative hover:bg-accent transition-all">
          <Bell size={18} className="text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-in zoom-in">
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0 shadow-2xl rounded-xl border-border bg-card">
        <div className="flex items-center justify-between p-4 border-b">
          <DropdownMenuLabel className="p-0 font-semibold text-base">Notifications</DropdownMenuLabel>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={markAllAsRead} 
            className="h-auto p-0 text-xs text-primary hover:bg-transparent hover:text-primary/80"
          >
            Mark all read
          </Button>
        </div>
        
        <div className="max-h-[350px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center">
              <Bell size={40} className="opacity-10 mb-2"/>
              <p>No new notifications</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={cn(
                  "p-4 border-b last:border-0 hover:bg-muted/50 cursor-pointer transition-colors flex gap-3",
                  !notif.read && "bg-primary/5"
                )}
                onClick={() => markAsRead(notif.id)}
              >
                 <div className="shrink-0 mt-0.5">
                   {notif.type === 'success' && <CheckCircle2 size={16} className="text-green-500" />}
                   {notif.type === 'error' && <AlertCircle size={16} className="text-destructive" />}
                   {notif.type === 'info' && <Info size={16} className="text-blue-500" />}
                   {notif.type === 'warning' && <AlertCircle size={16} className="text-orange-500" />}
                 </div>
                 <div className="flex-1 space-y-1">
                   <div className="flex justify-between items-start">
                     <p className={cn("text-sm font-bold leading-none", !notif.read ? "text-foreground" : "text-muted-foreground")}>
                       {notif.title}
                     </p>
                   </div>
                   <p className="text-xs text-muted-foreground line-clamp-2">{notif.message}</p>
                   <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase font-mono">
                     {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                   </p>
                 </div>
              </div>
            ))
          )}
        </div>
        
        {notifications.length > 0 && (
          <div className="p-2 border-t text-center">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs text-muted-foreground hover:text-destructive gap-2 h-8" 
              onClick={clearAll}
            >
              <Trash2 size={12} /> Clear All
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
