// Imports — React, routing, Supabase client, and layout wrapper
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

// ForgotPassword — sends a password reset link to the user's email
export default function ForgotPassword() {

  // Form states — email input, feedback messages, and loading indicator
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // handleReset — sends the reset email via Supabase
  // Uses a generic message to prevent email enumeration attacks
  async function handleReset(e) {
    e.preventDefault();

    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: `${window.location.origin}/reset-password` }
      );

      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage('If that email exists, a reset link was sent.');
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      console.error('Password reset error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Render — auth card with email form, feedback, and back-to-login link
  return (
    <AppLayout nav={false}>
      <div className="auth-wrap">
        <div className="auth-card">

          {/* Header — icon, title, and subtitle */}
          <div className="auth-icon">
            <i className="fa-solid fa-key"></i>
          </div>
          <h2>Forgot Password</h2>
          <p className="subtitle">We'll send a reset link to your email</p>

          {/* Form — email input, error/success messages, and submit button */}
          <form onSubmit={handleReset}>
            <div className="admin-field">
              <label htmlFor="forgot-email">
                <i className="fa-solid fa-envelope"></i> Email
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-envelope"></i>
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

            {error && <p className="admin-error">{error}</p>}
            {message && <p className="admin-success">{message}</p>}

            <button
              type="submit"
              className="app-btn app-btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px 20px', fontSize: 14, marginTop: 8 }}
            >
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>

          {/* Footer — divider and back-to-login link */}
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