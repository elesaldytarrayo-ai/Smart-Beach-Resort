/* ============================================================
   src/app/ForgotPassword.jsx
   Handles the password reset request flow.
   Uses AppLayout with the navigation bar hidden for a focused UX.
   ============================================================ */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

// ForgotPassword Component
// Renders a form where users can enter their email to receive a password reset link.
export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handles the form submission to request a password reset link.
  async function handleReset(e) {
    e.preventDefault();
    
    // Reset previous states
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        // Security Best Practice: Use a generic message to prevent email enumeration attacks
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
          
          {/* Header Icon & Text */}
          <div className="auth-icon">
            <i className="fa-solid fa-key"></i>
          </div>
          <h2>Forgot Password</h2>
          <p className="subtitle">We'll send a reset link to your email</p>

          {/* Reset Form */}
          <form onSubmit={handleReset}>
            <input
              className="neu-input"
              type="email"
              placeholder="Your email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label="Email address"
            />

            {/* Feedback Messages */}
            {error && (
              <p className="error-text" aria-live="polite">
                <i className="fa-solid fa-circle-exclamation mr-1"></i>
                {error}
              </p>
            )}
            {message && (
              <p className="success-text" aria-live="polite">
                <i className="fa-solid fa-circle-check mr-1"></i>
                {message}
              </p>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              className="neu-button primary btn-full-width" 
              disabled={loading}
            >
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-paper-plane'} mr-1`}></i>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>

          {/* Back to Login Link */}
          <p className="muted mt-3 text-center">
            <Link to="/login">
              <i className="fa-solid fa-arrow-left mr-1"></i>
              Back to login
            </Link>
          </p>
          
        </div>
      </div>
    </AppLayout>
  );
}