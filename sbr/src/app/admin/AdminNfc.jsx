import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

// --- Constants ---
const REFRESH_INTERVAL_MS = 10000;
const FETCH_LIMIT = 200;

// Maps an NFC token status to a CSS pill class for coloring.
// Active → green, Used → yellow, Invalidated/Expired → red.
const STATUS_PILL_MAP = {
  active: 'confirmed',
  used: 'pending',
  invalidated: 'unpaid',
  expired: 'unpaid'
};

// Defines the filter options for the dropdown.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'used', label: 'Used' },
  { key: 'invalidated', label: 'Invalidated' },
  { key: 'expired', label: 'Expired' }
];

// REUSABLE SUB-COMPONENTS
// StatCard Component
// Displays a large KPI card on the NFC dashboard.
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

// PurposePill Component
// Renders a colored pill indicating whether the token is for check-in or check-out.
function PurposePill({ purpose }) {
  const isCheckIn = purpose === 'check_in';
  return (
    <span className={`admin-pill ${isCheckIn ? 'confirmed' : 'pending'}`}>
      <i className={`fa-solid ${isCheckIn ? 'fa-right-to-bracket' : 'fa-right-from-bracket'}`}></i>
      {isCheckIn ? 'Check-in' : 'Check-out'}
    </span>
  );
}

// FormattedDate Component
// Renders a date consistently, or an em-dash if the value is missing.
function FormattedDate({ value, withTime = false }) {
  if (!value) return <span className="muted">—</span>;
  const date = new Date(value);
  return (
    <span className="muted">
      {withTime ? date.toLocaleString() : date.toLocaleDateString()}
    </span>
  );
}

// TokenRow Component
// Renders a single NFC token row in the table with its action button.
function TokenRow({ token, updatingId, onInvalidate }) {
  const guest = token.bookings?.profiles;
  const room = token.bookings?.rooms;
  const isActive = token.status === 'active';
  const isUpdating = updatingId === token.id;

  return (
    <tr>
      <td className="muted" title={token.id}>{String(token.id).slice(0, 8)}…</td>
      <td><PurposePill purpose={token.purpose} /></td>
      <td>
        <div className="cell-main">{guest?.full_name || '—'}</div>
        <div className="cell-sub">{guest?.email}</div>
      </td>
      <td>Room {room?.room_number || '—'}</td>
      <td className="muted" title={token.booking_id}>
        {String(token.booking_id || '').slice(0, 8)}…
      </td>
      <td>
        <span className={`admin-pill ${STATUS_PILL_MAP[token.status] || ''}`}>
          {token.status}
        </span>
      </td>
      <td><FormattedDate value={token.expires_at} withTime /></td>
      <td><FormattedDate value={token.used_at} withTime /></td>
      <td><FormattedDate value={token.created_at} /></td>
      <td>
        {isActive ? (
          <button
            className="app-btn app-btn-danger app-btn-sm"
            onClick={() => onInvalidate(token)}
            disabled={isUpdating}
          >
            <i className={`fa-solid ${isUpdating ? 'fa-spinner fa-spin' : 'fa-ban'}`}></i>
            {isUpdating ? 'Invalidating…' : 'Invalidate'}
          </button>
        ) : (
          <span className="muted text-sm">—</span>
        )}
      </td>
    </tr>
  );
}

/* ============================================================
   MAIN ADMIN NFC COMPONENT
   ============================================================ */

// AdminNfc Component
// Displays all NFC tokens with filtering, search, and manual invalidation.
export default function AdminNfc() {
  // --- State Management ---
  const [tokens, setTokens] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // DATA FETCHING
  // Fetches all NFC tokens with their related booking, profile, and room data.
  async function fetchTokens(isInitialLoad = false) {
    if (isInitialLoad) setLoading(true);
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('nfc_tokens')
        .select(`
          *,
          bookings (
            id, check_in, check_out, status, payment_status,
            profiles (full_name, email),
            rooms (room_number, room_type)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(FETCH_LIMIT);

      if (fetchError) throw fetchError;
      setTokens(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }

  useEffect(() => {
    fetchTokens(true);
    const interval = setInterval(() => fetchTokens(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ACTIONS
  // Marks an NFC token as invalidated after confirmation.
  // The token will no longer be accepted by the NFC verify endpoint.
  async function handleInvalidate(token) {
    const confirmed = window.confirm(
      `Invalidate this NFC token?\n\nPurpose: ${token.purpose}`
    );
    if (!confirmed) return;

    setError('');
    setMessage('');
    setUpdatingId(token.id);

    try {
      const { error: updateError } = await supabase
        .from('nfc_tokens')
        .update({
          status: 'invalidated',
          invalidated_at: new Date().toISOString()
        })
        .eq('id', token.id);

      if (updateError) throw updateError;

      setMessage('Token invalidated successfully.');
      await fetchTokens(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // DERIVED DATA
  /** Counts per status for stat cards and filter dropdown. */
  const counts = {
    all: tokens.length,
    active: tokens.filter((t) => t.status === 'active').length,
    used: tokens.filter((t) => t.status === 'used').length,
    invalidated: tokens.filter((t) => t.status === 'invalidated').length,
    expired: tokens.filter((t) => t.status === 'expired').length
  };

  /** Tokens after applying the active filter and search query. */
  const filteredTokens = tokens.filter((token) => {
    if (filter !== 'all' && token.status !== filter) return false;

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const searchable = [
        token.id,
        token.booking_id,
        token.token_hash,
        token.purpose,
        token.bookings?.profiles?.full_name,
        token.bookings?.profiles?.email,
        token.bookings?.rooms?.room_number
      ].filter(Boolean).join(' ').toLowerCase();

      if (!searchable.includes(query)) return false;
    }
    return true;
  });

  // RENDER
  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>NFC Management</h1>
        <p>View, monitor, and invalidate all NFC tokens.</p>
      </div>

      {/*KPI STAT CARDS */}
      <div className="admin-stat-grid">
        <StatCard
          color="blue"
          icon="fa-satellite-dish"
          label="Total Tokens"
          value={counts.all}
          sub="All-time"
        />
        <StatCard
          color="green"
          icon="fa-circle-check"
          label="Active"
          value={counts.active}
          sub="Ready for check-in"
        />
        <StatCard
          color="orange"
          icon="fa-wifi"
          label="Used"
          value={counts.used}
          sub="Already tapped"
        />
        <StatCard
          color="purple"
          icon="fa-lock"
          label="Invalidated"
          value={counts.invalidated}
          sub={`${counts.expired} expired`}
        />
      </div>

      {/*TOOLBAR*/}
      <div className="admin-panel mb-4">
        <div className="row row-center">
          <div className="col">
            <input
              className="admin-input"
              placeholder="Search by guest, room, booking, or token…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col col-fixed-200">
            <select
              className="admin-select"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              {FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label} ({counts[f.key]})
                </option>
              ))}
            </select>
          </div>
          <button className="app-btn app-btn-secondary" onClick={() => fetchTokens(true)}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      {/*FEEDBACK*/}
      {error && <p className="admin-error mb-2">{error}</p>}
      {message && <p className="admin-success mb-2">{message}</p>}

      {/*TOKEN TABLE*/}
      <div className="admin-panel table-scroll-wrapper">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-satellite-dish"></i> All NFC Tokens ({filteredTokens.length})
          </h3>
        </div>

        {loading && <p className="muted center">Loading…</p>}

        {!loading && filteredTokens.length === 0 && (
          <p className="muted center">No NFC tokens found.</p>
        )}

        {!loading && filteredTokens.length > 0 && (
          <table className="admin-table table-wide">
            <thead>
              <tr>
                <th>Token ID</th>
                <th>Purpose</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Booking ID</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Used at</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTokens.map((token) => (
                <TokenRow
                  key={token.id}
                  token={token}
                  updatingId={updatingId}
                  onInvalidate={handleInvalidate}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}