import { useState } from "react";
import { AlertTriangle, CheckCircle2, Info, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { useNotifications } from "../hooks/useNotifications";

type Filter = "all" | "critical" | "warning" | "read";
const FILTERS: Filter[] = ["all", "critical", "warning", "read"];

export function Alerts() {
  const navigate = useNavigate();
  const { data, loading, markAllRead, markRead, reload } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = data.filter((item) => {
    if (filter === "all") return true;
    if (filter === "read") return Boolean(item.read_at);
    return item.severity === filter;
  });

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">MONITORING</div>
          <h1>Alerts</h1>
          <p>Agent-raised events that need attention.</p>
        </div>
        <div className="title-actions">
          <Button variant="secondary" onClick={() => void markAllRead()}>
            Mark all read
          </Button>
          <Button variant="secondary" onClick={() => void reload()}>
            <RefreshCw size={15} /> Refresh
          </Button>
        </div>
      </div>

      <div className="tabs alert-filters">
        {FILTERS.map((item) => (
          <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
            {item[0].toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      <div className="alert-list">
        {loading ? (
          <div className="empty-state">
            <b>Loading alerts…</b>
          </div>
        ) : filtered.length ? (
          filtered.map((item) => (
            <div
              className={`alert-card ${item.severity}`}
              key={item.id}
              onClick={() => !item.read_at && void markRead(item.id)}
            >
              <span>
                {item.severity === "critical" ? (
                  <AlertTriangle />
                ) : item.severity === "warning" ? (
                  <Info />
                ) : (
                  <CheckCircle2 />
                )}
              </span>
              <div>
                <span>
                  {item.severity.toUpperCase()} · {new Date(item.created_at).toLocaleString()}
                </span>
                <h3>{item.message}</h3>
                <p>{item.read_at ? "Read" : "Unread · click to mark read"}</p>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    // SPA navigation — a window.location assignment here would full-page
                    // reload and drop the auth context and notification poll.
                    navigate(`/app/sites/${item.site_id}`);
                  }}
                >
                  View site →
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <b>No matching alerts</b>
            <small>New agent events will appear here automatically.</small>
          </div>
        )}
      </div>
    </>
  );
}
