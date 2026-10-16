/* Login page — signs in the user and redirects them
   to the correct dashboard based on their role.
*/

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

/* Role-to-destination map for faster lookups */
const ROLE_DESTINATIONS = {
  admin: '/admin',
  staff: '/staff',
  user:  '/user'
};

/* Main component — the login page */
export default function Login() {
  const navigate = useNavigate();

  /* Form and feedback state */
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  /* Handle the login form submission */
  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoggingIn(true);

    try {
      /* Authenticate with Supabase */
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authError) throw authError;

      /* Fetch the user's role from the profiles table */
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.warn('Could not fetch profile role, defaulting to "user".', profileError);
      }

      /* Redirect based on the user's role */
      const role = profile?.role || 'user';
      navigate(ROLE_DESTINATIONS[role] || '/user');

    } catch (err) {
      setError(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoggingIn(false);
    }
  }

  return (
    <AppLayout nav={false} footer={false}>
      <div className="login-wrap">
        <div className="login-card">

          {/* Header */}
          <div className="login-icon">
            <i className="lock"></i>
          </div>
          <h2>Welcome Back</h2>
          <p className="login-subtitle">Sign in to your Smart Beach Resort account</p>

          {/* Login form */}
          <form onSubmit={handleLogin}>

            {/* Email field */}
            <div className="login-field">
              <label htmlFor="login-email">
                <i className="envelope"></i> Email
              </label>
              <div className="login-input-wrap">
                <i className="envelope"></i>
                <input
                  id="login-email"
                  name="email"
                  className="login-input"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="login-field">
              <label htmlFor="login-password">
                <i className="lock"></i> Password
              </label>
              <div className="login-input-wrap">
                <i className="key"></i>
                <input
                  id="login-password"
                  name="password"
                  className="login-input"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Forgot password link */}
            <div className="login-forgot">
              <Link to="/forgot" className="login-forgot-link">
                Forgot password?
              </Link>
            </div>

            {/* Error message */}
            {error && <p className="login-error" aria-live="polite">{error}</p>}

            {/* Submit button */}
            <button
              className="login-btn login-btn-primary btn-full-width"
              disabled={loggingIn}
              type="submit"
            >
              <i className={loggingIn ? 'spinner' : 'sign-in'}></i>
              {loggingIn ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="login-divider">
            <span>or</span>
          </div>

          {/* Create account link */}
          <p className="login-alt">
            Don't have an account?{' '}
            <Link to="/register" className="login-link">Create one</Link>
          </p>

        </div>
      </div>
    </AppLayout>
  );
}