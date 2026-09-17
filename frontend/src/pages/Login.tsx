import { useState, type FormEvent } from "react";
import { Leaf, ArrowRight, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";

export function Login() {
  const n = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("admin@darukaa.earth");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      n("/app/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to sign in. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-visual">
        <div className="auth-brand">
          <Leaf /> DARUKAA<span>.EARTH</span>
        </div>
        <div>
          <div className="eyebrow">GEOSPATIAL INTELLIGENCE</div>
          <h1>
            Understand Earth.
            <br />
            <em>Protect what matters.</em>
          </h1>
          <p>Monitor carbon, biodiversity and ecosystem health from one intelligent spatial workspace.</p>
        </div>
        <div className="auth-foot">Geospatial analytics · ML forecasting · AI monitoring</div>
      </div>
      <div className="auth-form">
        <div className="mobile-brand">
          <Leaf /> DARUKAA.EARTH
        </div>
        <form className="form-box" onSubmit={handleSubmit}>
          <div className="eyebrow">WELCOME BACK</div>
          <h2>Sign in</h2>
          <p className="muted">Access your environmental portfolio.</p>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </label>
          <label>
            Password
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="btn primary wide" disabled={loading} type="submit">
            {loading ? <Loader2 className="spin" size={17} /> : <>Sign in <ArrowRight size={17} /></>}
          </button>
          <p className="center muted">
            Don't have an account? <Link to="/register">Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

