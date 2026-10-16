/* ForgotPassword page — sends a password reset link to the user's email.
   Uses a generic success message to prevent email enumeration attacks.
*/

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

/* Path where the user lands after clicking the reset link */
const RESET_REDIRECT_PATH = '/reset-password';

/* Main component — the forgot password page */
export default function ForgotPassword() {
  /* Form state */
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /* Handle the form submission — send the reset email */
  async function handleReset(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      /* Ask Supabase to send the reset email */
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}${RESET_REDIRECT_PATH}` }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        /* Use a generic message even if the email is not registered */
        setMessage('If that email exists, a reset link was sent.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Password reset error:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppLayout nav={false}>
      <div className="auth-wrap">
        <div className="auth-card">

          {/* Header */}
          <div className="auth-icon">
            <i className="key"></i>
          </div>
          <h2>Forgot Password</h2>
          <p className="subtitle">We'll send a reset link to your email</p>

          {/* Form */}
          <form onSubmit={handleReset}>
            <div className="admin-field">
              <label htmlFor="forgot-email">
                <i className="envelope"></i> Email
              </label>
              <div className="admin-input-wrap">
                <i className="envelope"></i>
                <input
                  id="forgot-email"
                  className="admin-input"
                  type="email"
                  placeholder="enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
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
              <i className={loading ? 'spinner' : 'paper-plane'}></i>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Back to login link */}
          <p className="auth-alt">
            <Link to="/login" className="auth-link">
              <i className="arrow-left mr-1"></i>
              Back to Sign In
            </Link>
          </p>

        </div>
      </div>
    </AppLayout>
  );
}