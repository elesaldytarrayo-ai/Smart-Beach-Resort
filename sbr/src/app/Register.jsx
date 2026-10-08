import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

// Register Component
// Renders the registration form and handles account creation via Supabase.
// Creates an auth user, updates the profile with a phone number, and redirects to login.
export default function Register() {
  const navigate = useNavigate();
  
  // Form State
  const [form, setForm] = useState({ 
    full_name: '', 
    email: '', 
    phone: '', 
    password: '' 
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Generic input change handler.
  // Updates the corresponding field in the form state.
  function handleInputChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // Handles the registration form submission.
  // Signs up the user, updates their profile, and redirects to login.
  async function handleRegister(e) {
    e.preventDefault();
    
    // Reset previous states
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      // 1. Create the auth user
      const { error: signUpError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { data: { full_name: form.full_name.trim() } }
      });

      if (signUpError) throw signUpError;

      // 2. Update the profile with the phone number (if user session exists)
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

      // 3. Show success and redirect
      setSuccessMessage('Account created! Redirecting…');
      setTimeout(() => navigate('/login'), 1200);
      
    } catch (err) {
      setError(err.message || 'Failed to create account. Please try again.');
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
            <i className="fa-solid fa-user-plus"></i>
          </div>
          <h2>Create Account</h2>
          <p className="subtitle">Join Smart Beach Resort today</p>

          {/* Registration Form */}
          <form onSubmit={handleRegister}>
            <input
              className="neu-input"
              name="full_name"
              placeholder="Full name"
              value={form.full_name}
              onChange={handleInputChange}
              required
              aria-label="Full name"
            />
            <input
              className="neu-input"
              type="email"
              name="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleInputChange}
              required
              aria-label="Email address"
            />
            <input
              className="neu-input"
              name="phone"
              placeholder="Phone number"
              value={form.phone}
              onChange={handleInputChange}
              aria-label="Phone number"
            />
            <input
              className="neu-input"
              type="password"
              name="password"
              placeholder="Password (min 6 chars)"
              value={form.password}
              onChange={handleInputChange}
              minLength={6}
              required
              aria-label="Password"
            />

            {/* Feedback Messages */}
            {error && (
              <p className="error-text" aria-live="polite">
                <i className="fa-solid fa-circle-exclamation mr-1"></i>
                {error}
              </p>
            )}
            {successMessage && (
              <p className="success-text" aria-live="polite">
                <i className="fa-solid fa-circle-check mr-1"></i>
                {successMessage}
              </p>
            )}

            {/* Submit Button */}
            <button 
              type="submit" 
              className="neu-button primary btn-full-width" 
              disabled={loading}
            >
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-user-plus'} mr-1`}></i>
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </form>

          {/* Navigation Links */}
          <p className="muted mt-3 text-center">
            Already have an account? <Link to="/login">Login</Link>
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