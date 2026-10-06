/* ============================================================
   src/app/Login.jsx
   Login page — neomorphic auth card.
   ============================================================ */

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../supabase.js";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]           = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErr("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const role = profile?.role || "user";
    if (role === "admin")      nav("/admin");
    else if (role === "staff") nav("/staff");
    else                       nav("/user");

    setLoading(false);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="auth-icon">🔐</span>
        <h2>Welcome Back</h2>
        <p className="subtitle">Sign in to your Smart Beach Resort account</p>

        <form onSubmit={handleLogin}>
          <input
            className="neu-input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <input
            className="neu-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {err && <p className="error-text">⚠️ {err}</p>}

          <button className="neu-button primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Logging in…" : "Sign In"}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 20, textAlign: "center" }}>
          <Link to="/forgot">Forgot password?</Link>
          {" · "}
          <Link to="/register">Create account</Link>
        </p>

        <p className="muted" style={{ marginTop: 12, textAlign: "center" }}>
          <Link to="/">← Back to home</Link>
        </p>
      </div>
    </div>
  );
}