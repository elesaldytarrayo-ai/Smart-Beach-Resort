/* ============================================================
   src/app/admin/AdminStaff.jsx
   Staff Management — lahat ng icons Font Awesome.
   ============================================================ */

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

const API = 'http://localhost:5000';

export default function AdminStaff() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [staffList, setStaffList] = useState([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function loadStaff() {
    const { data } = await supabase
      .from('profiles').select('*').eq('role', 'staff')
      .order('created_at', { ascending: false });
    setStaffList(data || []);
  }

  useEffect(() => { loadStaff(); }, []);

  async function createStaff(e) {
    e.preventDefault();
    setErr(''); setMsg(''); setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
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
      setMsg(`Staff account created: ${form.email}`);
      setForm({ full_name: '', email: '', phone: '', password: '' });
      loadStaff();
    } catch (e) {
      setLoading(false);
      setErr(e.message);
    }
  }

  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Staff Management</h1>
        <p>Gumawa ng bagong staff accounts para sa resort.</p>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card blue">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Total Staff</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-user-tie"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{staffList.length}</div>
            <div className="admin-stat-sub">Active employees</div>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-user-plus"></i> Create Staff Account
            </h3>
          </div>
          <p className="muted" style={{ marginBottom: 20 }}>
            Ang staff account ay awtomatikong saved sa Supabase with role = "staff".
          </p>

          <form onSubmit={createStaff}>
            <label className="admin-label">Full Name</label>
            <input className="admin-input" placeholder="Juan Dela Cruz"
              value={form.full_name} onChange={set('full_name')} required />

            <label className="admin-label">Email</label>
            <input className="admin-input" type="email" placeholder="staff@sbr.com"
              value={form.email} onChange={set('email')} required />

            <label className="admin-label">Phone</label>
            <input className="admin-input" placeholder="0912 345 6789"
              value={form.phone} onChange={set('phone')} />

            <label className="admin-label">Temporary Password</label>
            <input className="admin-input" type="password" placeholder="Min 6 characters"
              value={form.password} onChange={set('password')} required minLength={6} />

            {err && <p className="admin-error">{err}</p>}
            {msg && <p className="admin-success">{msg}</p>}

            <button className="app-btn app-btn-primary" disabled={loading}
              style={{ width: '100%', marginTop: 8 }}>
              <i className={loading ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-user-plus'}></i>
              {loading ? 'Creating…' : 'Create Staff Account'}
            </button>
          </form>
        </div>

        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-list"></i> Existing Staff ({staffList.length})
            </h3>
          </div>

          {staffList.length === 0 && <p className="muted center">Wala pang staff accounts.</p>}

          {staffList.length > 0 && (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th><th>Email</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((s) => (
                  <tr key={s.id}>
                    <td><strong>{s.full_name || '—'}</strong></td>
                    <td className="muted">{s.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}