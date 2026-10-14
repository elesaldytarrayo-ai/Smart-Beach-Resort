/* ============================================================
   src/app/ResetPassword.jsx
   Handles the password reset page after the user clicks the
   reset link in their email. Uses the session established by
   Supabase from the email link to update the password.
   ============================================================ */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

export default function ResetPassword() {
  const navigate = useNavigate();

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [err, setErr] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Session validity state
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if the user arrived from a valid reset link
  // (Supabase automatically creates a session from the email link)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setErr('Invalid or expired reset link. Please request a new one.');
        setChecking(false);
        return;
      }

      setHasSession(true);
      setChecking(false);
    })();
  }, []);

  async function handleReset(e) {
    e.preventDefault();
    setErr('');
    setMessage('');

    // Client-side validation
    if (password !== confirmPassword) {
      return setErr('Passwords do not match.');
    }
    if (password.length < 6) {
      return setErr('Password must be at least 6 characters.');
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setMessage('✅ Password updated successfully. Redirecting to login…');
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setErr(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  // Loading state — while checking if the session is valid
  if (checking) {
    return (
      <AppLayout nav={false} footer={false}>
        <div className="auth-wrap">
          <div className="auth-card center">
            <div className="auth-icon">
              <i className="fa-solid fa-spinner fa-spin"></i>
            </div>
            <h2>Verifying…</h2>
            <p className="subtitle">Checking your reset link…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Invalid or expired session
  if (!hasSession) {
    return (
      <AppLayout nav={false} footer={false}>
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-icon">
              <i className="fa-solid fa-circle-exclamation"></i>
            </div>
            <h2>Link Expired</h2>
            <p className="subtitle">{err}</p>

            <Link
              to="/forgot"
              className="app-btn app-btn-primary"
              style={{ width: '100%', padding: '12px 20px', marginTop: 16 }}
            >
              <i className="fa-solid fa-rotate-right mr-1"></i>
              Request New Link
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Valid session — show the reset form
  return (
    <AppLayout nav={false} footer={false}>
      <div className="auth-wrap">
        <div className="auth-card">

          {/* Header */}
          <div className="auth-icon">
            <i className="fa-solid fa-lock"></i>
          </div>
          <h2>Set New Password</h2>
          <p className="subtitle">Enter your new password below</p>

          {/* Form */}
          <form onSubmit={handleReset}>

            {/* New password */}
            <div className="admin-field">
              <label htmlFor="reset-password">
                <i className="fa-solid fa-lock"></i> New Password
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-key"></i>
                <input
                  id="reset-password"
                  className="admin-input"
                  type="password"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Confirm password */}
            <div className="admin-field">
              <label htmlFor="reset-confirm">
                <i className="fa-solid fa-lock"></i> Confirm Password
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-key"></i>
                <input
                  id="reset-confirm"
                  className="admin-input"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Feedback */}
            {err && <p className="admin-error">{err}</p>}
            {message && <p className="admin-success">{message}</p>}

            {/* Submit */}
            <button
              type="submit"
              className="app-btn app-btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px 20px', marginTop: 8 }}
            >
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-check'}`}></i>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>

          {/* Footer */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          <p className="auth-alt">
            <Link to="/login" className="auth-link">
              <i className="fa-solid fa-arrow-left mr-1"></i>
              Back to Sign In
            </Link>
          </p>

        </div>
      </div>
    </AppLayout>
  );
}