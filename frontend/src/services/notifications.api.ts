import { api } from "./api";
import type { NotificationItem } from "../types/notification";

export function listNotifications(unreadOnly = false) {
  return api<NotificationItem[]>(`/notifications${unreadOnly ? "?unread_only=true" : ""}`);
}

export function markNotificationRead(id: string) {
  return api<NotificationItem>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead() {
  return api<{ status: string }>("/notifications/read-all", { method: "POST" });
}
