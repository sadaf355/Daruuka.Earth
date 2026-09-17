export type NotificationSeverity = "info" | "warning" | "critical";

export interface NotificationItem {
  id: string;
  site_id: string;
  message: string;
  severity: NotificationSeverity;
  created_at: string;
  read_at: string | null;
}
