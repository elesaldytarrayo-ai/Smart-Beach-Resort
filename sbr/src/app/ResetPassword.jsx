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
        <div className="reset-wrap">
          <div className="reset-card reset-center">
            <div className="reset-icon">
              <i className="spinner"></i>
            </div>
            <h2>Verifying…</h2>
            <p className="reset-subtitle">Checking your reset link…</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Invalid or expired session
  if (!hasSession) {
    return (
      <AppLayout nav={false} footer={false}>
        <div className="reset-wrap">
          <div className="reset-card">
            <div className="reset-icon">
              <i className="circle-exclamation"></i>
            </div>
            <h2>Link Expired</h2>
            <p className="reset-subtitle">{err}</p>

            <Link
              to="/forgot"
              className="reset-btn reset-btn-primary"
              style={{ width: '100%', padding: '12px 20px', marginTop: 16 }}
            >
              <i className="rotate-right reset-gap"></i>
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
      <div className="reset-wrap">
        <div className="reset-card">

          {/* Header */}
          <div className="reset-icon">
            <i className="lock"></i>
          </div>
          <h2>Set New Password</h2>
          <p className="reset-subtitle">Enter your new password below</p>

          {/* Form */}
          <form onSubmit={handleReset}>

            {/* New password */}
            <div className="reset-field">
              <label htmlFor="reset-password">
                <i className="lock"></i> New Password
              </label>
              <div className="reset-input-wrap">
                <i className="key"></i>
                <input
                  id="reset-password"
                  className="reset-input"
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
            <div className="reset-field">
              <label htmlFor="reset-confirm">
                <i className="lock"></i> Confirm Password
              </label>
              <div className="reset-input-wrap">
                <i className="key"></i>
                <input
                  id="reset-confirm"
                  className="reset-input"
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
            {err && <p className="reset-error">{err}</p>}
            {message && <p className="reset-success">{message}</p>}

            {/* Submit */}
            <button
              type="submit"
              className="reset-btn reset-btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px 20px', marginTop: 8 }}
            >
              <i className={loading ? 'spinner' : 'check'}></i>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>

          {/* Footer */}
          <div className="reset-divider">
            <span>or</span>
          </div>

          <p className="reset-alt">
            <Link to="/login" className="reset-link">
              <i className="arrow-left reset-gap"></i>
              Back to Sign In
            </Link>
          </p>

        </div>
      </div>
    </AppLayout>
  );
}