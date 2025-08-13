"use client";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import useSWR from "swr";
import { useApi } from "@/hooks/use-api";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface FollowerNotification {
  id: string;
  type: "new_message" | "status_change" | "assignment_change" | "new_note";
  title: string;
  message: string;
  createdAt: string;
  conversation: {
    id: number;
    slug: string;
    subject: string;
  };
}

export function FollowerNotifications() {
  const api = useApi();
  const { data, mutate } = useSWR<{ data: FollowerNotification[] }>("/notifications/follower");

  const notifications = data?.data || [];
  const unreadCount = notifications.length;

  const markAsRead = async (notificationId: string) => {
    if (!api) return;
    
    try {
      await api.post(`/notifications/follower/${notificationId}/read`);
      mutate();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_message":
        return "💬";
      case "status_change":
        return "🔄";
      case "assignment_change":
        return "👤";
      case "new_note":
        return "📝";
      default:
        return "🔔";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No new notifications
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className="flex flex-col items-start p-3 cursor-pointer"
              onClick={() => markAsRead(notification.id)}
            >
              <Link
                href={`/conversations/${notification.conversation.slug}`}
                className="w-full"
              >
                <div className="flex items-start gap-2 w-full">
                  <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{notification.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}