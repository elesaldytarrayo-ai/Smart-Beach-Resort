/* ============================================================
   src/app/AdminUsers.jsx
   Admin — lahat ng accounts mula sa Supabase.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase.js';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  async function refresh() {
    try {
      setErr('');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('LOAD USERS ERROR:', e);
      setErr(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  async function changeRole(user, role) {
    if (!confirm(`Change ${user.email} to "${role}"?`)) return;

    setErr(''); setMsg('');
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', user.id);

    if (error) return setErr(error.message);
    setMsg(`✅ ${user.email} is now ${role}`);
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
    all:   users.length,
    user:  users.filter((u) => u.role === 'user').length,
    staff: users.filter((u) => u.role === 'staff').length,
    admin: users.filter((u) => u.role === 'admin').length
  };

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

      <div className="page-pad">
        <div className="space-between" style={{ marginBottom: 20 }}>
          <h1>All Accounts ({users.length})</h1>
          {lastRefresh && (
            <span className="muted">Last refresh: {lastRefresh.toLocaleTimeString()}</span>
          )}
        </div>

        <div className="feature-grid" style={{ marginBottom: 20 }}>
          <MiniStat icon="👥" label="Total"  value={counts.all} />
          <MiniStat icon="👤" label="Users"  value={counts.user} />
          <MiniStat icon="👨‍💼" label="Staff"  value={counts.staff} />
          <MiniStat icon="👑" label="Admins" value={counts.admin} />
        </div>

        <div className="neu-card">
          <div className="row" style={{ alignItems: 'center' }}>
            <div className="col">
              <input
                className="neu-input"
                placeholder="Search by name, email, or phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ marginBottom: 0 }}
              />
            </div>
            <div className="col" style={{ flex: '0 0 180px' }}>
              <select
                className="neu-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ marginBottom: 0 }}
              >
                <option value="all">All roles</option>
                <option value="user">Users</option>
                <option value="staff">Staff</option>
                <option value="admin">Admins</option>
              </select>
            </div>
            <button className="neu-button" onClick={refresh}>🔄 Refresh</button>
          </div>
        </div>

        {err && <p className="error-text" style={{ marginTop: 12 }}>⚠️ {err}</p>}
        {msg && <p className="success-text" style={{ marginTop: 12 }}>{msg}</p>}

        <div className="neu-card" style={{ marginTop: 20 }}>
          {loading && <p className="muted center">Loading…</p>}

          {!loading && filtered.length === 0 && (
            <p className="muted center">No accounts match your filter.</p>
          )}

          {!loading && filtered.length > 0 && (
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Created</th>
                  <th>Change Role</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name || '—'}</td>
                    <td>{u.email}</td>
                    <td className="muted">{u.phone || '—'}</td>
                    <td><span className={`pill ${u.role}`}>{u.role}</span></td>
                    <td className="muted">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      <select
                        className="neu-select"
                        value={u.role}
                        onChange={(e) => changeRole(u, e.target.value)}
                        style={{
                          marginBottom: 0,
                          maxWidth: 120,
                          fontSize: 13,
                          padding: '6px 10px'
                        }}
                      >
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
      </div>
    </>
  );
}

function MiniStat({ icon, label, value }) {
  return (
    <div className="feature-card" style={{ padding: '16px 14px' }}>
      <span className="feature-icon" style={{ fontSize: 24 }}>{icon}</span>
      <p className="muted" style={{ fontSize: 12 }}>{label}</p>
      <h2 style={{ color: 'var(--accent)' }}>{value}</h2>
    </div>
  );
}