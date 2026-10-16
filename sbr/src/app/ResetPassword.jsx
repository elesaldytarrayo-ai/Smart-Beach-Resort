/* Password reset page.
   Shown after the user clicks the reset link in their email.
   Supabase automatically creates a session from the link,
   and we use that session to update the password.
*/

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

/* Delay before redirecting after a successful password change */
const REDIRECT_DELAY_MS = 1800;

/* Minimum allowed password length */
const MIN_PASSWORD_LENGTH = 6;

/* Main component — the reset password page */
export default function ResetPassword() {
  const navigate = useNavigate();

  /* Form state */
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  /* Session validity state */
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  /* Check if the user arrived from a valid reset link.
     Supabase automatically creates a session from the email link.
  */
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!isMounted) return;

      /* No session — link is invalid or expired */
      if (!session) {
        setError('Invalid or expired reset link. Please request a new one.');
        setChecking(false);
        return;
      }

      /* Session found — allow the user to reset the password */
      setHasSession(true);
      setChecking(false);
    }

    checkSession();

    /* Prevent state updates on unmounted component */
    return () => { isMounted = false; };
  }, []);

  /* Handle the password update form submission */
  async function handleReset(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    /* Client-side validation */
    if (password !== confirmPassword) {
      return setError('Passwords do not match.');
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    setLoading(true);

    try {
      /* Ask Supabase to update the password for the current session */
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      setMessage('Password updated successfully. Redirecting to login…');
      setTimeout(() => navigate('/login'), REDIRECT_DELAY_MS);
    } catch (err) {
      setError(err.message || 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  }

  /* Loading state — checking if the session is valid */
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

  /* Invalid or expired session */
  if (!hasSession) {
    return (
      <AppLayout nav={false} footer={false}>
        <div className="auth-wrap">
          <div className="auth-card">
            <div className="auth-icon">
              <i className="fa-solid fa-circle-exclamation"></i>
            </div>
            <h2>Link Expired</h2>
            <p className="subtitle">{error}</p>

            {/* Ask the user to request a new link */}
            <Link to="/forgot" className="app-btn app-btn-primary btn-full-width mt-3">
              <i className="fa-solid fa-rotate-right mr-1"></i>
              Request New Link
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  /* Valid session — show the reset form */
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

            {/* New password field */}
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
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Confirm password field */}
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
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                />
              </div>
            </div>

            {/* Feedback messages */}
            {error && <p className="admin-error" aria-live="polite">{error}</p>}
            {message && <p className="admin-success" aria-live="polite">{message}</p>}

            {/* Submit button */}
            <button
              type="submit"
              className="app-btn app-btn-primary btn-full-width mt-2"
              disabled={loading}
            >
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-check'} mr-1`}></i>
              {loading ? 'Updating…' : 'Update Password'}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Back to login link */}
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