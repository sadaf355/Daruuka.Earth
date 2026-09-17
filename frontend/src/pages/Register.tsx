import { useState, type FormEvent } from "react";
import { ArrowRight, Leaf, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { ApiError } from "../services/api";

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email.trim(), password);
      navigate("/app/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create account. Is the backend running?");
    } finally {
      setLoading(false);
    }
  }

  return <div className="auth simple-auth"><form className="form-box" onSubmit={handleSubmit}><div className="brand big"><div className="brand-mark"><Leaf /></div><b>DARUKAA<span>.EARTH</span></b></div><div className="eyebrow">GET STARTED</div><h2>Create your workspace</h2><p className="muted">Create an account to manage environmental projects.</p><label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" placeholder="admin@example.com" /></label><label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required minLength={8} autoComplete="new-password" placeholder="Minimum 8 characters" /></label>{error && <p className="form-error">{error}</p>}<button className="btn primary wide" disabled={loading} type="submit">{loading ? <Loader2 className="spin" size={17} /> : <>Create account <ArrowRight size={17} /></>}</button><p className="center muted">Already registered? <Link to="/login">Sign in</Link></p></form></div>;
}
