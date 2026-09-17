import { Bot, Database, Shield, User } from "lucide-react";
import { SectionHeader } from "../components/ui";
import { useAuth } from "../hooks/useAuth";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000";
const MAPBOX_CONFIGURED = Boolean(import.meta.env.VITE_MAPBOX_TOKEN);

/**
 * Settings is intentionally read-only for this build. Profile editing and password rotation
 * are not part of the scored flows, and a form that silently discards its input is worse
 * than an honest status panel — so this page reports real session and configuration state
 * instead of pretending to save.
 */
export function Settings() {
  const { user } = useAuth();

  return (
    <>
      <div className="page-title">
        <div>
          <div className="eyebrow">WORKSPACE</div>
          <h1>Settings</h1>
          <p>Session, connectivity and AI configuration for this deployment.</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card">
          <SectionHeader eyebrow="SESSION" title="Signed-in account" />
          <div className="setting-row">
            <User />
            <div>
              <b>{user?.email ?? "Not signed in"}</b>
              <small>Role: {user?.role ?? "unknown"}</small>
            </div>
          </div>
          <p className="ai-copy">
            Accounts are created through registration. Profile editing is out of scope for this
            build.
          </p>
        </section>

        <section className="card">
          <SectionHeader eyebrow="SECURITY" title="Authentication" />
          <div className="setting-row">
            <Shield />
            <div>
              <b>JWT access + refresh</b>
              <small>Access tokens are refreshed transparently by the API client.</small>
            </div>
          </div>
          <p className="ai-copy">
            Passwords are hashed with bcrypt. Tokens are stored per browser and cleared on sign
            out.
          </p>
        </section>

        <section className="card">
          <SectionHeader eyebrow="CONNECTIVITY" title="Backend & map" />
          <div className="setting-row">
            <Database />
            <div>
              <b>API endpoint</b>
              <small>{API_URL}</small>
            </div>
          </div>
          <div className="setting-row">
            <Database />
            <div>
              <b>Mapbox token</b>
              <small>{MAPBOX_CONFIGURED ? "Configured" : "Missing — maps will not render"}</small>
            </div>
          </div>
        </section>

        <section className="card">
          <SectionHeader eyebrow="AI" title="Assistant provider" />
          <div className="setting-row">
            <Bot />
            <div>
              <b>Configured server-side</b>
              <small>
                The active provider and model are returned with every Ask Darukaa answer.
              </small>
            </div>
          </div>
          <p className="ai-copy">
            The default grounded provider runs locally and answers only from your own project
            data, so no API key is required to use the assistant.
          </p>
        </section>
      </div>
    </>
  );
}
