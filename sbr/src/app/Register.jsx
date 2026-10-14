// Imports — React hook, routing, Supabase client, and layout wrapper
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

// Register — creates a new user account and redirects to login
export default function Register() {
  const navigate = useNavigate();

  // Form states — all fields, error, success, and loading indicator
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  // handleInputChange — updates the form state for any input field
  function handleInputChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // handleRegister — creates the auth user, updates profile, then redirects
  async function handleRegister(e) {
    e.preventDefault();
    setErr('');
    setOk('');
    setLoading(true);

    try {
      // 1. Create the auth user
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim() } }
      });

      if (signUpError) throw signUpError;

      // 2. Update profile with phone (if session exists)
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ phone: form.phone.trim() })
          .eq('id', user.id);

        if (profileError) {
          console.warn('Profile phone update failed:', profileError);
        }
      }

      // 3. Success + redirect
      setOk('Account created! Redirecting to login…');
      setTimeout(() => navigate('/login'), 1400);

    } catch (err) {
      setErr(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Render — auth card with registration form and navigation links
  return (
    <AppLayout nav={false} footer={false}>
      <div className="register-wrap">
        <div className="register-card">

          {/* Header — icon, title, and subtitle */}
          <div className="register-icon">
            <i className="user-plus"></i>
          </div>
          <h2>Create Account</h2>
          <p className="register-subtitle">Join Smart Beach Resort today</p>

          {/* Form — full name, email, phone, password, feedback, submit */}
          <form onSubmit={handleRegister}>

            {/* Full name field */}
            <div className="register-field">
              <label>
                <i className="user"></i> Full Name
              </label>
              <div className="register-input-wrap">
                <i className="user"></i>
                <input
                  className="register-input"
                  name="full_name"
                  type="text"
                  placeholder="Enter your name"
                  value={form.full_name}
                  onChange={handleInputChange}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Email field */}
            <div className="register-field">
              <label>
                <i className="envelope"></i> Email
              </label>
              <div className="register-input-wrap">
                <i className="envelope"></i>
                <input
                  className="register-input"
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={handleInputChange}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Phone field */}
            <div className="register-field">
              <label>
                <i className="phone"></i> Phone
              </label>
              <div className="register-input-wrap">
                <i className="phone"></i>
                <input
                  className="register-input"
                  name="phone"
                  type="tel"
                  placeholder="0912 345 6789"
                  value={form.phone}
                  onChange={handleInputChange}
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Password field */}
            <div className="register-field">
              <label>
                <i className="lock"></i> Password
              </label>
              <div className="register-input-wrap">
                <i className="key"></i>
                <input
                  className="register-input"
                  name="password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={handleInputChange}
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
              <p className="register-field-hint">Minimum 6 characters</p>
            </div>

            {/* Error / success messages */}
            {err && <p className="register-error">{err}</p>}
            {ok && <p className="register-success">{ok}</p>}

            {/* Submit button */}
            <button
              className="register-btn register-btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px 20px', fontSize: 14 }}
              type="submit"
            >
              <i className={loading ? 'spinner' : 'user-plus'}></i>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {/* Footer — divider and login link */}
          <div className="register-divider">
            <span>or</span>
          </div>

          <p className="register-alt">
            Already have an account?{' '}
            <Link to="/login" className="register-link">
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </AppLayout>
  );
}