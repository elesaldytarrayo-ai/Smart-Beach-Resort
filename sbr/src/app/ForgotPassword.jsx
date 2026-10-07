/* ============================================================
   src/app/ForgotPassword.jsx
   Forgot password — uses AppLayout (no nav).
   ============================================================ */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleReset(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`
    });

    setLoading(false);
    if (error) setErr(error.message);
    else setMsg('If that email exists, a reset link was sent.');
  }

  return (
    <AppLayout nav={false}>
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-icon">
            <i className="fa-solid fa-key"></i>
          </div>
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

            {err && <p className="error-text">
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }}></i>
              {err}
            </p>}
            {msg && <p className="success-text">
              <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i>
              {msg}
            </p>}

            <button className="neu-button primary" disabled={loading} style={{ width: '100%' }}>
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>

          <p className="muted" style={{ marginTop: 20, textAlign: 'center' }}>
            <Link to="/login">
              <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }}></i>
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}