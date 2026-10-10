import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

export default function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

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

      // 2. Get role
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

  return (
    <AppLayout nav={false} footer={false}>
      <div className="auth-wrap">
        <div className="auth-card">
          {/* Header */}
          <div className="auth-icon">
            <i className="fa-solid fa-lock"></i>
          </div>

          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in to your Smart Beach Resort account</p>

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            {/* Email field */}
            <div className="admin-field">
              <label>
                <i className="fa-solid fa-envelope"></i> Email
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-envelope"></i>
                <input
                  className="admin-input"
                  type="email"
                  placeholder=" Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="admin-field">
              <label>
                <i className="fa-solid fa-lock"></i> Password
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-key"></i>
                <input
                  className="admin-input"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Forgot link */}
            <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 16 }}>
              <Link to="/forgot" className="auth-forgot-link">
                Forgot password?
              </Link>
            </div>

            {/* Error */}
            {err && <p className="admin-error">{err}</p>}

            {/* Submit */}
            <button
              className="app-btn app-btn-primary"
              disabled={loggingIn}
              style={{ width: '100%', padding: '12px 20px', fontSize: 14 }}
              type="submit"
            >
              <i className={`fa-solid ${loggingIn ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'}`}></i>
              {loggingIn ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Create account link */}
          <p className="auth-alt">
            Don't have an account?{' '}
            <Link to="/register" className="auth-link">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}