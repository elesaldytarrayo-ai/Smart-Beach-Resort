import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

// --- Constants ---
const API = 'http://localhost:5000';

/** Empty form shape, used for both initial state and reset. */
const INITIAL_FORM = {
  full_name: '',
  email: '',
  phone: '',
  password: ''
};

// REUSABLE SUB-COMPONENTS
// StaffStatCard Component
// Displays a single KPI card for the staff dashboard.
function StaffStatCard({ icon, label, value, sub }) {
  return (
    <div className="admin-stat-card blue">
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

// CreateStaffForm Component
// Renders the form for creating a new staff account.
function CreateStaffForm({ form, onChange, onSubmit, loading, error, message }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3 className="admin-panel-title">
          <i className="fa-solid fa-user-plus"></i> Create Staff Account
        </h3>
      </div>

      <p className="muted mb-3">
        The new staff account will be created in Supabase with the role "staff".
      </p>

      <form onSubmit={onSubmit}>
        <label className="admin-label" htmlFor="staff-name">Full Name</label>
        <input
          id="staff-name"
          className="admin-input"
          placeholder="Juan Dela Cruz"
          value={form.full_name}
          onChange={(e) => onChange('full_name', e.target.value)}
          required
        />

        <label className="admin-label" htmlFor="staff-email">Email</label>
        <input
          id="staff-email"
          className="admin-input"
          type="email"
          placeholder="staff@sbr.com"
          value={form.email}
          onChange={(e) => onChange('email', e.target.value)}
          required
        />

        <label className="admin-label" htmlFor="staff-phone">Phone</label>
        <input
          id="staff-phone"
          className="admin-input"
          placeholder="0912 345 6789"
          value={form.phone}
          onChange={(e) => onChange('phone', e.target.value)}
        />

        <label className="admin-label" htmlFor="staff-password">Temporary Password</label>
        <input
          id="staff-password"
          className="admin-input"
          type="password"
          placeholder="Min 6 characters"
          value={form.password}
          onChange={(e) => onChange('password', e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />

        {error && <p className="admin-error">{error}</p>}
        {message && <p className="admin-success">{message}</p>}

        <button
          type="submit"
          className="app-btn app-btn-primary w-full mt-2"
          disabled={loading}
        >
          <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-user-plus'} mr-1`}></i>
          {loading ? 'Creating…' : 'Create Staff Account'}
        </button>
      </form>
    </div>
  );
}

// StaffTable Component
// Renders the list of existing staff members.
function StaffTable({ staffList }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3 className="admin-panel-title">
          <i className="fa-solid fa-list"></i> Existing Staff ({staffList.length})
        </h3>
      </div>

      {staffList.length === 0 && (
        <p className="muted center">No staff accounts yet.</p>
      )}

      {staffList.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map((staff) => (
              <tr key={staff.id}>
                <td><strong>{staff.full_name || '—'}</strong></td>
                <td className="muted">{staff.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// MAIN ADMIN STAFF COMPONENS
// AdminStaff Component
// Allows the admin to create and view staff accounts. The actual
// account creation is delegated to the backend Admin API so that
// we can bypass Supabase's signUp rate limits and auto-confirm
// the email in a single call.
export default function AdminStaff() {
  // --- State Management ---
  const [form, setForm] = useState(INITIAL_FORM);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // DATA FETCHING
  // Fetches all profiles with the 'staff' role.
  async function fetchStaff() {
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'staff')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setStaffList(data || []);
    } catch (err) {
      console.error('Failed to load staff:', err);
      setError('Failed to load staff list: ' + err.message);
    }
  }

  useEffect(() => {
    fetchStaff();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // FORM HANDLERS
  // Generic input change handler.
  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Creates a new staff account via the backend Admin API.
  // On success, clears the form and refreshes the staff list.
  async function handleCreateStaff(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      // 1. Get the admin's session to authorize the request
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session. Please log in again.');

      // 2. Call the backend Admin API
      const response = await fetch(`${API}/api/admin/create-staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(form)
      });

      const json = await response.json();
      if (!json.ok) throw new Error(json.error || 'Failed to create staff account.');

      // 3. Success: reset form and refresh list
      setMessage(`Staff account created: ${form.email}`);
      setForm(INITIAL_FORM);
      await fetchStaff();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  // RENDER
  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Staff Management</h1>
        <p>Create new staff accounts for the resort.</p>
      </div>

      {/*KPI STAT CARDS*/}
      <div className="admin-stat-grid">
        <StaffStatCard
          icon="fa-user-tie"
          label="Total Staff"
          value={staffList.length}
          sub="Active employees"
        />
      </div>

      {/*TWO-COLUMN GRID*/}
      <div className="admin-dashboard-grid">
        <CreateStaffForm
          form={form}
          onChange={handleChange}
          onSubmit={handleCreateStaff}
          loading={loading}
          error={error}
          message={message}
        />
        <StaffTable staffList={staffList} />
      </div>
    </AdminLayout>
  );
}