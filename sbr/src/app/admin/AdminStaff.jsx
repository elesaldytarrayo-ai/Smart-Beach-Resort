/* ============================================================
   src/app/admin/AdminStaff.jsx
   Admin — gumagawa ng staff accounts (saved sa Supabase).
   ============================================================ */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase.js';

const API = 'http://localhost:5000';

export default function AdminStaff() {
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: ''
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function createStaff(e) {
    e.preventDefault();
    setErr(''); setMsg(''); setLoading(true);

    const { data: { session } } = await supabase.auth.getSession();

    // Call backend (uses service-role key to create auth user + profile)
    const res = await fetch(`${API}/api/admin/create-staff`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify(form)
    });
    const json = await res.json();
    setLoading(false);

    if (!json.ok) return setErr(json.error || 'Failed');
    setMsg(`✅ Staff account created: ${form.email}`);
    setForm({ full_name: '', email: '', phone: '', password: '' });
  }

  return (
    <>
      <nav className="nav">
        <div className="brand">
          <span className="brand-icon">🛡️</span>
          <span>SBR · Admin</span>
        </div>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <Link to="/admin">Dashboard</Link>
          <Link to="/admin/rooms">Rooms</Link>
          <Link to="/admin/users">Users</Link>
          <Link to="/admin/staff">Staff</Link>
          <Link to="/admin/bookings">Bookings</Link>
          <Link to="/admin/payments">Payments</Link>
        </div>
      </nav>

      <div className="page-pad" style={{ maxWidth: 520 }}>
        <div className="neu-card">
          <h2>Create Staff Account</h2>
          <p className="muted" style={{ marginBottom: 16 }}>
            Ang staff account ay awtomatikong saved sa Supabase with role = "staff".
          </p>

          <form onSubmit={createStaff}>
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
              placeholder="Email"
              value={form.email}
              onChange={set('email')}
              required
            />
            <input
              className="neu-input"
              placeholder="Phone"
              value={form.phone}
              onChange={set('phone')}
            />
            <input
              className="neu-input"
              type="password"
              placeholder="Temporary password"
              value={form.password}
              onChange={set('password')}
              required
              minLength={6}
            />

            {err && <p className="error-text">⚠️ {err}</p>}
            {msg && <p className="success-text">{msg}</p>}

            <button
              className="neu-button primary"
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Creating…' : 'Create Staff'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}