import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { Health } from "../types";

const HEALTH_LABEL: Record<Health, string> = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At Risk",
};

export function HealthBadge({ health }: { health: Health }) {
  return (
    <span className={`badge ${health}`}>
      <span /> {HEALTH_LABEL[health]}
    </span>
  );
}

export function Kpi({
  label,
  value,
  sub,
  trend,
}: {
  label: string;
  value: string;
  sub: string;
  trend?: number;
}) {
  const direction = trend && trend > 0 ? "up" : trend && trend < 0 ? "down" : null;
  return (
    <div className="kpi">
      <div className="muted">{label}</div>
      <strong>{value}</strong>
      <div className={direction ? `trend ${direction}` : "muted"}>
        {direction === "up" ? (
          <ArrowUpRight size={14} />
        ) : direction === "down" ? (
          <ArrowDownRight size={14} />
        ) : (
          <Minus size={13} />
        )}{" "}
        {sub}
      </div>
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`btn ${variant}`}>
      {children}
    </button>
  );
}
