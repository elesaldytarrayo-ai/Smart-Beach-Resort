import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

// Login Component
// Renders the login form and handles authentication via Supabase.
// Redirects users to their respective dashboards based on their role.
export default function Login() {
  const navigate = useNavigate();
  
  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Handles the login form submission.
  // Authenticates the user, fetches their role, and redirects them.
  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Authenticate with Supabase Auth
      const { data, error: authError } = await supabase.auth.signInWithPassword({ 
        email: email.trim(), 
        password 
      });

      if (authError) throw authError;

      // 2. Fetch the user's role from the profiles table
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.warn('Could not fetch profile role, defaulting to "user".', profileError);
      }

      // 3. Determine the correct dashboard based on role
      const role = profile?.role || 'user';
      const redirectPath = role === 'admin' ? '/admin' : role === 'staff' ? '/staff' : '/user';
      
      navigate(redirectPath);
      
    } catch (err) {
      setError(err.message || 'Failed to login. Please check your credentials.');
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
            <i className="fa-solid fa-lock"></i>
          </div>
          <h2>Welcome Back</h2>
          <p className="subtitle">Sign in to your Smart Beach Resort account</p>

          {/* Login Form */}
          <form onSubmit={handleLogin}>
            <input
              className="neu-input"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              aria-label="Email address"
            />
            <input
              className="neu-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              aria-label="Password"
            />

            {/* Error Feedback */}
            {error && (
              <p className="error-text" aria-live="polite">
                <i className="fa-solid fa-circle-exclamation mr-1"></i>
                {error}
              </p>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              className="neu-button primary btn-full-width" 
              disabled={loading}
            >
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-right-to-bracket'} mr-1`}></i>
              {loading ? 'Logging in…' : 'Sign In'}
            </button>
          </form>

          {/* Navigation Links */}
          <p className="muted mt-3 text-center">
            <Link to="/forgot">Forgot password?</Link>
            {' · '}
            <Link to="/register">Create account</Link>
          </p>

          <p className="muted mt-2 text-center">
            <Link to="/">
              <i className="fa-solid fa-arrow-left mr-1"></i>
              Back to home
            </Link>
          </p>
          
        </div>
      </div>
    </AppLayout>
  );
}