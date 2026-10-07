/* ============================================================
   src/app/Register.jsx
   Register page — uses AppLayout (no nav).
   ============================================================ */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleRegister(e) {
    e.preventDefault();
    setErr(''); setOk('');
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.full_name } }
    });

    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      await supabase.from('profiles').update({ phone: form.phone }).eq('id', data.user.id);
    }

    setOk('Account created! Redirecting…');
    setTimeout(() => nav('/login'), 1200);
    setLoading(false);
  }

  return (
    <AppLayout nav={false}>
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-icon">
            <i className="fa-solid fa-user-plus"></i>
          </div>
          <h2>Create Account</h2>
          <p className="subtitle">Join Smart Beach Resort today</p>

          <form onSubmit={handleRegister}>
            <input
              className="neu-input"
              placeholder="Full name"
              value={form.full_name}
              onChange={set('full_name')}
              required
            />
            <input
              className="neu-input"
              type="email"
              placeholder="Email address"
              value={form.email}
              onChange={set('email')}
              required
            />
            <input
              className="neu-input"
              placeholder="Phone number"
              value={form.phone}
              onChange={set('phone')}
            />
            <input
              className="neu-input"
              type="password"
              placeholder="Password (min 6 chars)"
              value={form.password}
              onChange={set('password')}
              minLength={6}
              required
            />

            {err && <p className="error-text">
              <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 6 }}></i>
              {err}
            </p>}
            {ok && <p className="success-text">
              <i className="fa-solid fa-circle-check" style={{ marginRight: 6 }}></i>
              {ok}
            </p>}

            <button className="neu-button primary" disabled={loading} style={{ width: '100%' }}>
              <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-user-plus'}`}></i>
              {loading ? 'Creating…' : 'Create Account'}
            </button>
          </form>

          <p className="muted" style={{ marginTop: 20, textAlign: 'center' }}>
            Already have an account? <Link to="/login">Login</Link>
          </p>
          <p className="muted" style={{ marginTop: 12, textAlign: 'center' }}>
            <Link to="/">
              <i className="fa-solid fa-arrow-left" style={{ marginRight: 6 }}></i>
              Back to home
            </Link>
          </p>
        </div>
      </div>
    </AppLayout>
  );
}