/* Register page — creates a new user account.
   Encrypts the phone and password into the profiles table,
   then redirects to the login page.
*/

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, secureUpdate } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

/* Initial form state — reused when resetting the form */
const INITIAL_FORM = {
  full_name: '',
  email: '',
  phone: '',
  password: ''
};

/* Delay before redirecting to login after a successful signup */
const REDIRECT_DELAY_MS = 1400;

/* Minimum password length */
const MIN_PASSWORD_LENGTH = 6;

/* Main component — the registration page */
export default function Register() {
  const navigate = useNavigate();

  /* Form and feedback state */
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  /* Generic input change handler */
  function handleInputChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  /* Handle the registration form submission */
  async function handleRegister(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      /* Create the auth user */
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim() } }
      });

      if (signUpError) throw signUpError;

      /* Update the profile with encrypted phone + password.
         secureUpdate handles the encryption automatically.
      */
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        try {
          await secureUpdate(
            'profiles',
            { id: user.id },
            {
              full_name: form.full_name.trim(),
              phone: form.phone.trim() || null,
              password: form.password
            }
          );
        } catch (profileError) {
          /* Log but do not block signup if the profile update fails */
          console.warn('Profile update failed:', profileError);
        }
      }

      /* Show success and redirect to login */
      setSuccess('Account created! Redirecting to login…');
      setTimeout(() => navigate('/login'), REDIRECT_DELAY_MS);

    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
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
            <i className="user-plus"></i>
          </div>
          <h2>Create Account</h2>
          <p className="subtitle">Join Smart Beach Resort today</p>

          {/* Form */}
          <form onSubmit={handleRegister}>

            {/* Full Name */}
            <div className="admin-field">
              <label htmlFor="reg-name">
                <i className="user"></i> Full Name
              </label>
              <div className="admin-input-wrap">
                <i className="user"></i>
                <input
                  id="reg-name"
                  className="admin-input"
                  name="full_name"
                  type="text"
                  placeholder="Enter your full name"
                  value={form.full_name}
                  onChange={handleInputChange}
                  required
                  autoComplete="name"
                />
              </div>
            </div>

            {/* Email */}
            <div className="admin-field">
              <label htmlFor="reg-email">
                <i className="envelope"></i> Email
              </label>
              <div className="admin-input-wrap">
                <i className="envelope"></i>
                <input
                  id="reg-email"
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
              <label htmlFor="reg-phone">
                <i className="phone"></i> Phone
              </label>
              <div className="admin-input-wrap">
                <i className="phone"></i>
                <input
                  id="reg-phone"
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
              <label htmlFor="reg-password">
                <i className="lock"></i> Password
              </label>
              <div className="admin-input-wrap">
                <i className="key"></i>
                <input
                  id="reg-password"
                  className="admin-input"
                  name="password"
                  type="password"
                  placeholder="Min 6 characters"
                  value={form.password}
                  onChange={handleInputChange}
                  minLength={MIN_PASSWORD_LENGTH}
                  required
                  autoComplete="new-password"
                />
              </div>
              <p className="admin-field-hint">Minimum {MIN_PASSWORD_LENGTH} characters</p>
            </div>

            {/* Feedback messages */}
            {error && <p className="admin-error" aria-live="polite">{error}</p>}
            {success && <p className="admin-success" aria-live="polite">{success}</p>}

            {/* Submit button */}
            <button
              className="app-btn app-btn-primary btn-full-width mt-2"
              disabled={loading}
              type="submit"
            >
              <i className={loading ? 'spinner' : 'user-plus'}></i>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div className="auth-divider">
            <span>or</span>
          </div>

          {/* Already have an account link */}
          <p className="auth-alt">
            Already have an account?{' '}
            <Link to="/login" className="auth-link">Sign in</Link>
          </p>

        </div>
      </div>
    </AppLayout>
  );
}