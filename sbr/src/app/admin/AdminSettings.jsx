import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import { decrypt, encrypt } from '../../encryption.js';
import AdminLayout from './AdminLayout.jsx';

// --- Constants ---
const RESORT_KEY = 'sbr:resortSettings';
const BACKEND_URL = 'http://localhost:5000';

/** Default resort settings, used when no saved settings are found. */
const DEFAULT_RESORT = {
  name: 'Smart Beach Resort',
  tagline: 'Your beach escape awaits',
  contact: '+63 912 345 6789',
  address: 'Beachfront Drive, NwSSU, Philippines',
  currency: 'PHP'
};

/** Default system status while backend connectivity is being checked. */
const INITIAL_SYSTEM_STATUS = {
  backend: 'checking',
  supabase: 'checking',
  paymongo: 'checking',
  nfc: 'checking'
};

/** Initial system summary counts. */
const INITIAL_SUMMARY = {
  totalBookings: 0,
  totalPayments: 0,
  totalRooms: 0,
  totalUsers: 0
};

/** Supported currency options for the resort settings. */
const CURRENCIES = [
  { value: 'PHP', label: 'PHP (₱)' },
  { value: 'USD', label: 'USD ($)' },
  { value: 'EUR', label: 'EUR (€)' }
];

// Configuration for the system status KPI cards.
// Each entry maps a status key to its display metadata.
const SYSTEM_STATUS_ITEMS = [
  { key: 'backend', color: 'blue', icon: 'fa-server', label: 'Backend API', sub: 'localhost:5000' },
  { key: 'supabase', color: 'green',  icon: 'fa-database', label: 'Supabase', sub: 'Database connection' },
  { key: 'paymongo', color: 'orange', icon: 'fa-credit-card', label: 'PayMongo', sub: 'Payment gateway' },
  { key: 'nfc', color: 'purple', icon: 'fa-satellite-dish', label: 'NFC Service', sub: 'Token service' }
];

// Configuration for the system summary list.
const SUMMARY_ITEMS = [
  { key: 'totalBookings', label: 'Total Bookings', color: '#1e5fa8' },
  { key: 'totalPayments', label: 'Total Payments', color: '#22c55e' },
  { key: 'totalRooms', label: 'Total Rooms', color: '#ea8c00' },
  { key: 'totalUsers', label: 'Total Users', color: '#7c3aed' }
];

// REUSABLE SUB-COMPONENTS
// SystemStatusCard Component
// Displays a single system health KPI.
function SystemStatusCard({ color, icon, label, value, sub }) {
  return (
    <div className={`admin-stat-card ${color}`}>
      <div className="admin-stat-top">
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-icon">
          <i className={`fa-solid ${icon}`}></i>
        </span>
      </div>
      <div>
        <div className="admin-stat-value status-value">{value}</div>
        <div className="admin-stat-sub">{sub}</div>
      </div>
    </div>
  );
}

// AdminProfileForm Component
// Renders the admin profile edit form.
function AdminProfileForm({ profile, onChange, onSubmit, error, message }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3 className="admin-panel-title">
          <i className="fa-solid fa-user-shield"></i> Admin Profile
        </h3>
      </div>

      <form onSubmit={onSubmit}>
        <label className="admin-label" htmlFor="admin-name">Full Name</label>
        <input
          id="admin-name"
          className="admin-input"
          value={profile.full_name || ''}
          onChange={(e) => onChange('full_name', e.target.value)}
          placeholder="Juan Dela Cruz"
        />

        <label className="admin-label" htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          className="admin-input"
          value={profile.email || ''}
          disabled
        />

        <label className="admin-label" htmlFor="admin-phone">Phone</label>
        <input
          id="admin-phone"
          className="admin-input"
          value={profile.phone || ''}
          onChange={(e) => onChange('phone', e.target.value)}
          placeholder="0912 345 6789"
        />

        {error && <p className="admin-error mt-1">{error}</p>}
        {message && <p className="admin-success mt-1">{message}</p>}

        <button type="submit" className="app-btn app-btn-primary w-full mt-2">
          <i className="fa-solid fa-floppy-disk mr-1"></i> Save Profile
        </button>
      </form>
    </div>
  );
}

// PasswordForm Component
// Renders the password change form.
function PasswordForm({ password, confirmPassword, onChange, onSubmit, error, message }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3 className="admin-panel-title">
          <i className="fa-solid fa-key"></i> Change Password
        </h3>
      </div>

      <form onSubmit={onSubmit}>
        <label className="admin-label" htmlFor="new-pw">New Password</label>
        <input
          id="new-pw"
          className="admin-input"
          type="password"
          value={password}
          onChange={(e) => onChange('password', e.target.value)}
          placeholder="Min 6 characters"
          required
          minLength={6}
          autoComplete="new-password"
        />

        <label className="admin-label" htmlFor="confirm-pw">Confirm Password</label>
        <input
          id="confirm-pw"
          className="admin-input"
          type="password"
          value={confirmPassword}
          onChange={(e) => onChange('confirmPassword', e.target.value)}
          placeholder="Re-enter password"
          required
          minLength={6}
          autoComplete="new-password"
        />

        {error && <p className="admin-error mt-1">{error}</p>}
        {message && <p className="admin-success mt-1">{message}</p>}

        <button type="submit" className="app-btn app-btn-primary w-full mt-2">
          <i className="fa-solid fa-lock mr-1"></i> Update Password
        </button>
      </form>
    </div>
  );
}

// ResortInfoForm Component
// Renders the resort information edit form.
function ResortInfoForm({ resort, onChange, onSubmit, error, message }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3 className="admin-panel-title">
          <i className="fa-solid fa-umbrella-beach"></i> Resort Information
        </h3>
      </div>

      <form onSubmit={onSubmit}>
        <label className="admin-label" htmlFor="resort-name">Resort Name</label>
        <input
          id="resort-name"
          className="admin-input"
          value={resort.name}
          onChange={(e) => onChange('name', e.target.value)}
        />

        <label className="admin-label" htmlFor="resort-tagline">Tagline</label>
        <input
          id="resort-tagline"
          className="admin-input"
          value={resort.tagline}
          onChange={(e) => onChange('tagline', e.target.value)}
        />

        <label className="admin-label" htmlFor="resort-contact">Contact</label>
        <input
          id="resort-contact"
          className="admin-input"
          value={resort.contact}
          onChange={(e) => onChange('contact', e.target.value)}
        />

        <label className="admin-label" htmlFor="resort-address">Address</label>
        <input
          id="resort-address"
          className="admin-input"
          value={resort.address}
          onChange={(e) => onChange('address', e.target.value)}
        />

        <label className="admin-label" htmlFor="resort-currency">Currency</label>
        <select
          id="resort-currency"
          className="admin-select"
          value={resort.currency}
          onChange={(e) => onChange('currency', e.target.value)}
        >
          {CURRENCIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        {error && <p className="admin-error mt-1">{error}</p>}
        {message && <p className="admin-success mt-1">{message}</p>}

        <button type="submit" className="app-btn app-btn-primary w-full mt-2">
          <i className="fa-solid fa-floppy-disk mr-1"></i> Save Resort Info
        </button>
      </form>
    </div>
  );
}

// SystemSummary Component
// Renders the high-level counts of bookings, payments, rooms, and users.
function SystemSummary({ summary }) {
  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3 className="admin-panel-title">
          <i className="fa-solid fa-chart-simple"></i> System Summary
        </h3>
      </div>

      <div className="admin-donut-legend">
        {SUMMARY_ITEMS.map((item) => (
          <div key={item.key} className="admin-legend-item">
            <span className="admin-legend-left">
              <span
                className="admin-legend-dot"
                style={{ background: item.color }}
              />
              {item.label}
            </span>
            <strong>{summary[item.key]}</strong>
          </div>
        ))}
      </div>

      <p className="muted mt-3 text-sm text-center">
        Smart Beach Resort · v1.0.0
        <br />
        Built with React + Supabase
      </p>
    </div>
  );
}

// MAIN ADMIN SETTINGS COMPONENS
// AdminSettings Component
// Renders the admin settings page with profile, password, resort info,
// and live system status.
export default function AdminSettings() {
  // --- Profile State ---
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' });
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');

  // --- Password State ---
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // --- Resort State ---
  const [resort, setResort] = useState(DEFAULT_RESORT);
  const [resortError, setResortError] = useState('');
  const [resortMessage, setResortMessage] = useState('');

  // --- System State ---
  const [systemStatus, setSystemStatus] = useState(INITIAL_SYSTEM_STATUS);
  const [summary, setSummary] = useState(INITIAL_SUMMARY);

  // DATA FETCHING
  // Checks the backend health endpoint and returns a normalized status object.
  async function checkSystemStatus() {
    try {
      const response = await fetch(`${BACKEND_URL}/`);
      if (!response.ok) throw new Error('Backend offline');

      const data = await response.json();
      return {
        backend: 'online',
        supabase: data.config?.supabase ? 'configured' : 'missing',
        paymongo: data.config?.paymongo ? 'configured' : 'missing',
        nfc: data.config?.nfc ? 'configured' : 'missing'
      };
    } catch {
      return { backend: 'offline', supabase: 'unknown', paymongo: 'unknown', nfc: 'unknown' };
    }
  }

  // Fetches profile, resort settings, system status, and summary counts.
  async function loadSettings() {
    // 1. Profile
    const { data: auth } = await supabase.auth.getUser();
    if (auth?.user) {
      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', auth.user.id).single();
      if (profileData) {
        setProfile({
          full_name: profileData.full_name || '',
          email: profileData.email || auth.user.email || '',
          phone: profileData.phone ? decrypt(profileData.phone) : ''
        });
      }
    }

    // 2. Resort Settings (from localStorage)
    const stored = localStorage.getItem(RESORT_KEY);
    if (stored) {
      try { setResort(JSON.parse(stored)); } catch { /* fall back to defaults */ }
    }

    // 3. System Status (from backend health check)
    setSystemStatus(await checkSystemStatus());

    // 4. Summary Counts (parallel queries)
    const [bookingsRes, paymentsRes, roomsRes, usersRes] = await Promise.all([
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase.from('payments').select('*', { count: 'exact', head: true }),
      supabase.from('rooms').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true })
    ]);

    setSummary({
      totalBookings: bookingsRes.count || 0,
      totalPayments: paymentsRes.count || 0,
      totalRooms: roomsRes.count || 0,
      totalUsers: usersRes.count || 0
    });
  }

  useEffect(() => {
    loadSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // FORM HANDLERS
  // Saves the admin's profile (name + encrypted phone).
  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');

    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) throw new Error('No active session. Please log in again.');

      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name.trim(),
          phone: profile.phone ? encrypt(profile.phone.trim()) : null
        })
        .eq('id', auth.user.id);

      if (error) throw error;
      setProfileMessage('Profile updated successfully.');
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    }
  }

  // Updates the admin's password via Supabase Auth.
  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    // Client-side validation
    if (password !== confirmPassword) {
      return setPasswordError('Passwords do not match.');
    }
    if (password.length < 6) {
      return setPasswordError('Password must be at least 6 characters.');
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setPasswordMessage('Password updated successfully.');
      setPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'Failed to update password.');
    }
  }

  // Saves the resort settings to localStorage.
  function handleSaveResort(e) {
    e.preventDefault();
    setResortError('');
    setResortMessage('');

    try {
      localStorage.setItem(RESORT_KEY, JSON.stringify(resort));
      setResortMessage('Resort settings saved.');
    } catch (err) {
      setResortError('Failed to save settings: ' + err.message);
    }
  }

  // RENDER
  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Settings</h1>
        <p>Manage your admin profile, resort info, and view system status.</p>
      </div>

      {/*SYSTEM STATUS CARDS*/}
      <div className="admin-stat-grid mb-4">
        {SYSTEM_STATUS_ITEMS.map((item) => (
          <SystemStatusCard
            key={item.key}
            color={item.color}
            icon={item.icon}
            label={item.label}
            value={systemStatus[item.key]}
            sub={item.sub}
          />
        ))}
      </div>

      {/*TWO-COLUMN GRID*/}
      <div className="admin-dashboard-grid">

        {/* Left Column: Profile + Password */}
        <div className="settings-column">
          <AdminProfileForm
            profile={profile}
            onChange={(field, value) => setProfile({ ...profile, [field]: value })}
            onSubmit={handleSaveProfile}
            error={profileError}
            message={profileMessage}
          />
          <PasswordForm
            password={password}
            confirmPassword={confirmPassword}
            onChange={(field, value) => {
              if (field === 'password') setPassword(value);
              else setConfirmPassword(value);
            }}
            onSubmit={handleChangePassword}
            error={passwordError}
            message={passwordMessage}
          />
        </div>

        {/* Right Column: Resort Info + Summary */}
        <div className="settings-column">
          <ResortInfoForm
            resort={resort}
            onChange={(field, value) => setResort({ ...resort, [field]: value })}
            onSubmit={handleSaveResort}
            error={resortError}
            message={resortMessage}
          />
          <SystemSummary summary={summary} />
        </div>

      </div>
    </AdminLayout>
  );
}