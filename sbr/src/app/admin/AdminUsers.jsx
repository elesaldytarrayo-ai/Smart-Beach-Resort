import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import { decrypt } from '../../encryption.js';
import AdminLayout from './AdminLayout.jsx';

// --- Constants ---
const REFRESH_INTERVAL_MS = 10000;

// Maps a user role to its Font Awesome icon.
// Used in the role pill and the change-role dropdown.
const ROLE_ICON_MAP = {
  admin: 'fa-user-shield',
  staff: 'fa-user-tie',
  user: 'fa-user'
};

/** Available roles for the change-role dropdown. */
const ROLE_OPTIONS = ['user', 'staff', 'admin'];

// Defines the filter options for the role dropdown.
const ROLE_FILTERS = [
  { key: 'all', label: 'All roles' },
  { key: 'user', label: 'Users' },
  { key: 'staff', label: 'Staff' },
  { key: 'admin', label: 'Admins' }
];

// REUSABLE SUB-COMPONENTS
// StatCard Component
// Displays a large KPI card on the user management dashboard.
function StatCard({ color, icon, label, value, sub }) {
  return (
    <div className={`admin-stat-card ${color}`}>
      <div className="admin-stat-top">
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-icon">
          <i className={`fa-solid ${icon}`}></i>
        </span>
      </div>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-sub">{sub}</div>
      </div>
    </div>
  );
}

// RolePill Component
// Renders a colored pill for a user's role.
function RolePill({ role }) {
  const icon = ROLE_ICON_MAP[role] || 'fa-user';
  return (
    <span className={`admin-pill ${role}`}>
      <i className={`fa-solid ${icon}`}></i>
      {role}
    </span>
  );
}

//UserRow Component
// Renders a single user row with an inline role-change dropdown.
function UserRow({ user, updatingId, onRoleChange }) {
  const isUpdating = updatingId === user.id;

  return (
    <tr>
      <td><strong>{user.full_name || '—'}</strong></td>
      <td>{user.email}</td>
      <td className="muted">{user.phone || '—'}</td>
      <td><RolePill role={user.role} /></td>
      <td className="muted">
        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
      </td>
      <td>
        <select
          className="admin-select role-select"
          value={user.role}
          onChange={(e) => onRoleChange(user, e.target.value)}
          disabled={isUpdating}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </td>
    </tr>
  );
}

// MAIN ADMIN USERS COMPONENT
// AdminUsers Component
// Displays all user accounts with role filtering, search, and
// inline role changes.
export default function AdminUsers() {
  // --- State Management ---
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // DATA FETCHING
  // Fetches all user profiles and decrypts their phone numbers.
  async function fetchUsers(isInitialLoad = false) {
    if (isInitialLoad) setLoading(true);
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Decrypt phone numbers for each user
      const decrypted = (data || []).map((u) => ({
        ...u,
        phone: u.phone ? decrypt(u.phone) : ''
      }));
      setUsers(decrypted);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers(true);
    const interval = setInterval(() => fetchUsers(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ACTIONS
  // Changes the role of a user after confirmation.
  async function handleRoleChange(user, newRole) {
    if (newRole === user.role) return; // No-op if the role didn't change

    const confirmed = window.confirm(`Change ${user.email} to "${newRole}"?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    setUpdatingId(user.id);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setMessage(`${user.email} is now ${newRole}.`);
      await fetchUsers(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // DERIVED DATA
  /** Counts per role for stat cards and filter dropdown. */
  const counts = {
    all: users.length,
    user: users.filter((u) => u.role === 'user').length,
    staff: users.filter((u) => u.role === 'staff').length,
    admin: users.filter((u) => u.role === 'admin').length
  };

  /** Users after applying the role filter and search query. */
  const filteredUsers = users.filter((user) => {
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const searchable = `${user.full_name || ''} ${user.email || ''} ${user.phone || ''}`.toLowerCase();
      if (!searchable.includes(query)) return false;
    }
    return true;
  });

  // RENDER
  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>User Management</h1>
        <p>View and manage all accounts.</p>
      </div>

      {/*KPI STAT CARDS*/}
      <div className="admin-stat-grid">
        <StatCard
          color="blue"
          icon="fa-users"
          label="Total Accounts"
          value={counts.all}
          sub="All users"
        />
        <StatCard
          color="green"
          icon="fa-user"
          label="Users"
          value={counts.user}
          sub="Regular accounts"
        />
        <StatCard
          color="orange"
          icon="fa-user-tie"
          label="Staff"
          value={counts.staff}
          sub="Employees"
        />
        <StatCard
          color="purple"
          icon="fa-user-shield"
          label="Admins"
          value={counts.admin}
          sub="Full access"
        />
      </div>

      {/*TOOLBAR*/}
      <div className="admin-panel mb-4">
        <div className="row row-center">
          <div className="col">
            <input
              className="admin-input"
              placeholder="Search by name, email, or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col col-fixed-180">
            <select
              className="admin-select"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
            >
              {ROLE_FILTERS.map((f) => (
                <option key={f.key} value={f.key}>{f.label}</option>
              ))}
            </select>
          </div>
          <button className="app-btn app-btn-secondary" onClick={() => fetchUsers(true)}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      {/*FEEDBACK*/}
      {error && <p className="admin-error mb-2">{error}</p>}
      {message && <p className="admin-success mb-2">{message}</p>}

      {/*USERS TABLE*/}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-users"></i> All Accounts ({users.length})
          </h3>
        </div>

        {loading && <p className="muted center">Loading…</p>}

        {!loading && filteredUsers.length === 0 && (
          <p className="muted center">No accounts match.</p>
        )}

        {!loading && filteredUsers.length > 0 && (
          <table className="admin-table">
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
              {filteredUsers.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  updatingId={updatingId}
                  onRoleChange={handleRoleChange}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}