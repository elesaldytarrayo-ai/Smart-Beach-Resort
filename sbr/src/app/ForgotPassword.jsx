/* ============================================================
   src/app/ForgotPassword.jsx
   Password reset page.
   ============================================================ */

import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase.js";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg]     = useState("");
  const [err, setErr]     = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    setErr(""); setMsg("");
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/login",
    });

    setLoading(false);
    if (error) setErr(error.message);
    else setMsg("✅ If that email exists, a reset link was sent.");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <span className="auth-icon">🔑</span>
        <h2>Forgot Password</h2>
        <p className="subtitle">We'll send a reset link to your email</p>

        <form onSubmit={handleReset}>
          <input
            className="neu-input"
            type="email"
            placeholder="Your email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          {err && <p className="error-text">⚠️ {err}</p>}
          {msg && <p className="success-text">{msg}</p>}

          <button className="neu-button primary" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Sending…" : "Send Reset Link"}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 20, textAlign: "center" }}>
          <Link to="/login">← Back to login</Link>
        </p>
      </div>
    </div>
  );
}