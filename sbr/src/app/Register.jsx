import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  // Generic input handler
  function handleInputChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

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

  return (
    <AppLayout nav={false} footer={false}>
      <div className="auth-wrap">
        <div className="auth-card">
          {/* Header */}
          <div className="auth-icon">
            <i className="fa-solid fa-user-plus"></i>
          </div>

          <h2>Create Account</h2>
          <p className="subtitle">Join Smart Beach Resort today</p>

          {/* Form */}
          <form onSubmit={handleRegister}>
            {/* Full name */}
            <div className="admin-field">
              <label>
                <i className="fa-solid fa-user"></i> Full Name
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-user"></i>
                <input
                  className="admin-input"
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

            {/* Email */}
            <div className="admin-field">
              <label>
                <i className="fa-solid fa-envelope"></i> Email
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-envelope"></i>
                <input
                  className="admin-input"
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

            {/* Phone */}
            <div className="admin-field">
              <label>
                <i className="fa-solid fa-phone"></i> Phone
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-phone"></i>
                <input
                  className="admin-input"
                  name="phone"
                  type="tel"
                  placeholder="0912 345 6789"
                  value={form.phone}
                  onChange={handleInputChange}
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Password */}
            <div className="admin-field">
              <label>
                <i className="fa-solid fa-lock"></i> Password
              </label>
              <div className="admin-input-wrap">
                <i className="fa-solid fa-key"></i>
                <input
                  className="admin-input"
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
              <p className="admin-field-hint">Minimum 6 characters</p>
            </div>

            {/* Error / Success */}
            {err && <p className="admin-error">{err}</p>}
            {ok && <p className="admin-success">{ok}</p>}

            {/* Submit */}
            <button
              className="app-btn app-btn-primary"
              disabled={loading}
              style={{ width: '100%', padding: '12px 20px', fontSize: 14 }}
              type="submit"
            >
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-user-plus'}`}></i>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Login link */}
          <p className="auth-alt">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}