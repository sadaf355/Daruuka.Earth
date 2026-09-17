import { useCallback, useEffect, useState } from "react";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notifications.api";
import type { NotificationItem } from "../types/notification";

/** Polling interval for the topbar bell. Cheap enough at this scale; SSE would be the upgrade. */
const POLL_MS = 30_000;

export function useNotifications() {
  const [data, setData] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setData(await listNotifications());
    } catch {
      // A failed poll should never break the shell the user is working in.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    const id = window.setInterval(() => void reload(), POLL_MS);
    return () => window.clearInterval(id);
  }, [reload]);

  const markRead = async (id: string) => {
    await markNotificationRead(id);
    await reload();
  };

  const markAllRead = async () => {
    await markAllNotificationsRead();
    await reload();
  };

  return {
    data,
    loading,
    reload,
    markRead,
    markAllRead,
    unread: data.filter((item) => !item.read_at).length,
  };
}
