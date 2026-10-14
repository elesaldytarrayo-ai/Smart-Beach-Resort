// Imports — React hook, routing, Supabase client, and layout wrapper
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

// Login — signs in the user and redirects based on their role
export default function Login() {
  const navigate = useNavigate();

  // Form states — email, password, error message, and loading indicator
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // handleLogin — authenticates the user, fetches their role, then redirects
  async function handleLogin(e) {
    e.preventDefault();
    setErr('');
    setLoggingIn(true);

    try {
      // 1. Authenticate with Supabase
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      });

      if (authError) throw authError;

      // 2. Get role from profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.warn('Could not fetch profile role, defaulting to "user".', profileError);
      }

      // 3. Redirect by role
      const role = profile?.role || 'user';
      if (role === 'admin') navigate('/admin');
      else if (role === 'staff') navigate('/staff');
      else navigate('/user');

    } catch (err) {
      setErr(err.message || 'Failed to login. Please check your credentials.');
    } finally {
      setLoggingIn(false);
    }
  }

  // Render — auth card with login form and navigation links
  return (
    <AppLayout nav={false} footer={false}>
      <div className="login-wrap">
        <div className="login-card">

          {/* Header — icon, title, and subtitle */}
          <div className="login-icon">
            <i className="lock"></i>
          </div>
          <h2>Welcome Back</h2>
          <p className="login-subtitle">Sign in to your Smart Beach Resort account</p>

          {/* Login form — email, password, forgot link, error, submit */}
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
            <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
              <Link to="/forgot" className="login-forgot-link">
                Forgot password?
              </Link>
            </div>

            {/* Error message */}
            {err && <p className="login-error">{err}</p>}

            {/* Submit button */}
            <button
              className="login-btn login-btn-primary"
              disabled={loggingIn}
              style={{ width: '100%', padding: '12px 20px', fontSize: 14 }}
              type="submit"
            >
              <i className={loggingIn ? 'spinner' : 'sign-in'}></i>
              {loggingIn ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Footer — divider and create account link */}
          <div className="login-divider">
            <span>or</span>
          </div>

          <p className="login-alt">
            Don't have an account?{' '}
            <Link to="/register" className="login-link">
              Create one
            </Link>
          </p>

        </div>
      </div>
    </AppLayout>
  );
}