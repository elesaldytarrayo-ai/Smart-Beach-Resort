import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

export default function HomePage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setErr('');
    setLoggingIn(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setErr(error.message);
      setLoggingIn(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single();

    const role = profile?.role || 'user';

    if (role === 'admin') navigate('/admin');
    else if (role === 'staff') navigate('/staff');
    else navigate('/user');

    setLoggingIn(false);
  }

  return (
    <AppLayout nav={false} footer={false}>
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-icon">
            <i className="fa-solid fa-lock"></i>
          </div>

          <h2>Sign In</h2>
          <p className="subtitle">Welcome back! Log in to continue.</p>

          <form onSubmit={handleLogin}>
            {/* Email — may id + htmlFor + name + autoComplete */}
            <div className="admin-field">
              <label htmlFor="login-email">
                <i className="fa-solid fa-envelope"></i> Email
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-envelope"></i>
                <input
                  id="login-email"
                  name="email"
                  className="admin-input"
                  type="email"
                  placeholder="you@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password — may id + htmlFor + name + autoComplete */}
            <div className="admin-field">
              <label htmlFor="login-password">
                <i className="fa-solid fa-lock"></i> Password
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-key"></i>
                <input
                  id="login-password"
                  name="password"
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

            {err && <p className="admin-error">{err}</p>}

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

          <div className="auth-divider">
            <span>or</span>
          </div>

          <p className="auth-alt">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="auth-link"
            >
              Create one
            </button>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}