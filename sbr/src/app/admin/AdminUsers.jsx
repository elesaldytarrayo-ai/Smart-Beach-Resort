/* ============================================================
   src/app/admin/AdminUsers.jsx
   User Management — lahat ng icons Font Awesome.
   ============================================================ */

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import { decrypt } from '../../encryption.js';
import AdminLayout from './AdminLayout.jsx';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function refresh() {
    try {
      setErr('');
      const { data, error } = await supabase
        .from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setUsers((data || []).map((u) => ({ ...u, phone: decrypt(u.phone) })));
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  async function changeRole(user, role) {
    if (!confirm(`Change ${user.email} to "${role}"?`)) return;
    setErr(''); setMsg('');
    const { error } = await supabase.from('profiles').update({ role }).eq('id', user.id);
    if (error) return setErr(error.message);
    setMsg(`${user.email} is now ${role}`);
    refresh();
  }

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = `${u.full_name || ''} ${u.email || ''} ${u.phone || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: users.length,
    user: users.filter((u) => u.role === 'user').length,
    staff: users.filter((u) => u.role === 'staff').length,
    admin: users.filter((u) => u.role === 'admin').length
  };

  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>User Management</h1>
        <p>View at i-manage ang lahat ng accounts.</p>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card blue">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Total Accounts</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-users"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.all}</div>
            <div className="admin-stat-sub">All users</div>
          </div>
        </div>
        <div className="admin-stat-card green">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Users</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-user"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.user}</div>
            <div className="admin-stat-sub">Regular accounts</div>
          </div>
        </div>
        <div className="admin-stat-card orange">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Staff</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-user-tie"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.staff}</div>
            <div className="admin-stat-sub">Employees</div>
          </div>
        </div>
        <div className="admin-stat-card purple">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Admins</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-user-shield"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.admin}</div>
            <div className="admin-stat-sub">Full access</div>
          </div>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="col">
            <input className="admin-input" placeholder="Search by name, email, or phone…"
              value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
          </div>
          <div className="col" style={{ flex: '0 0 180px' }}>
            <select className="admin-select" value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)} style={{ marginBottom: 0 }}>
              <option value="all">All roles</option>
              <option value="user">Users</option>
              <option value="staff">Staff</option>
              <option value="admin">Admins</option>
            </select>
          </div>
          <button className="app-btn app-btn-secondary" onClick={refresh}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      {err && <p className="admin-error" style={{ marginBottom: 12 }}>{err}</p>}
      {msg && <p className="admin-success" style={{ marginBottom: 12 }}>{msg}</p>}

      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-users"></i> All Accounts ({users.length})
          </h3>
        </div>

        {loading && <p className="muted center">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="muted center">No accounts match.</p>}

        {!loading && filtered.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Phone</th>
                <th>Role</th><th>Created</th><th>Change Role</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td><strong>{u.full_name || '—'}</strong></td>
                  <td>{u.email}</td>
                  <td className="muted">{u.phone || '—'}</td>
                  <td>
                    <span className={`admin-pill ${u.role}`}>
                      <i className={
                        u.role === 'admin' ? 'fa-solid fa-user-shield' :
                        u.role === 'staff' ? 'fa-solid fa-user-tie' :
                        'fa-solid fa-user'
                      }></i>
                      {u.role}
                    </span>
                  </td>
                  <td className="muted">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <select className="admin-select" value={u.role}
                      onChange={(e) => changeRole(u, e.target.value)}
                      style={{ marginBottom: 0, maxWidth: 120, fontSize: 13, padding: '6px 10px' }}>
                      <option value="user">user</option>
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}