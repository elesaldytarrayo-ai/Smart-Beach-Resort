// Imports — React hooks, Supabase (secure), and admin layout wrapper
import { useEffect, useState } from 'react';
import { supabase, secureSelect, secureUpdate } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

// ============================================================
// CONSTANTS
// ============================================================
const REFRESH_INTERVAL_MS = 10000;
const FETCH_LIMIT = 200;

const STATUS_PILL_MAP = {
  active: 'confirmed',
  used: 'pending',
  invalidated: 'unpaid',
  expired: 'unpaid'
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'used', label: 'Used' },
  { key: 'invalidated', label: 'Invalidated' },
  { key: 'expired', label: 'Expired' }
];

// ============================================================
// REUSABLE SUB-COMPONENTS
// ============================================================

function StatCard({ color, icon, label, value, sub }) {
  return (
    <div className={`admin-stat-card ${color}`}>
      <div className="admin-stat-top">
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-icon">
          <i className={icon}></i>
        </span>
      </div>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-sub">{sub}</div>
      </div>
    </div>
  );
}

function PurposePill({ purpose }) {
  const isCheckIn = purpose === 'check_in';
  return (
    <span className={`admin-pill ${isCheckIn ? 'confirmed' : 'pending'}`}>
      <i className={isCheckIn ? 'right-to-bracket' : 'right-from-bracket'}></i>
      {isCheckIn ? 'Check-in' : 'Check-out'}
    </span>
  );
}

function FormattedDate({ value, withTime = false }) {
  if (!value) return <span className="admin-muted">—</span>;
  const date = new Date(value);
  return (
    <span className="admin-muted">
      {withTime ? date.toLocaleString() : date.toLocaleDateString()}
    </span>
  );
}

// ✅ Decrypted NFC UID/Token
function DecryptedNfc({ value, length = 20 }) {
  if (!value) return <span className="admin-muted">—</span>;
  return (
    <span
      className="admin-muted"
      title={value}
      style={{
        color: '#2e7d32',
        fontWeight: 600,
        fontSize: 12,
        fontFamily: 'Courier New, monospace'
      }}
    >
      🔓 {String(value).slice(0, length)}{String(value).length > length ? '…' : ''}
    </span>
  );
}

function TokenRow({ token, updatingId, onInvalidate }) {
  const guest = token.bookings?.profiles;
  const room = token.bookings?.rooms;
  const isActive = token.status === 'active';
  const isUpdating = updatingId === token.id;

  return (
    <tr>
      <td className="admin-muted" title={token.id}>{String(token.id).slice(0, 8)}…</td>
      <td><PurposePill purpose={token.purpose} /></td>
      <td>
        <div className="admin-cell-main">{guest?.full_name || '—'}</div>
        <div className="admin-cell-sub">{guest?.email}</div>
      </td>
      <td>Room {room?.room_number || '—'}</td>
      <td className="admin-muted" title={token.booking_id}>
        {String(token.booking_id || '').slice(0, 8)}…
      </td>
      <td>
        <span className={`admin-pill ${STATUS_PILL_MAP[token.status] || ''}`}>
          {token.status}
        </span>
      </td>
      {/* ✅ Decrypted NFC UID */}
      <td><DecryptedNfc value={token.nfc_uid} length={16} /></td>
      {/* ✅ Decrypted NFC Token */}
      <td><DecryptedNfc value={token.nfc_token} length={20} /></td>
      <td><FormattedDate value={token.expires_at} withTime /></td>
      <td><FormattedDate value={token.used_at} withTime /></td>
      <td>
        {isActive ? (
          <button
            className="admin-btn admin-btn-danger admin-btn-sm"
            onClick={() => onInvalidate(token)}
            disabled={isUpdating}
          >
            <i className={isUpdating ? 'spinner' : 'ban'}></i>
            {isUpdating ? 'Invalidating…' : 'Invalidate'}
          </button>
        ) : (
          <span className="admin-muted admin-sm">—</span>
        )}
      </td>
    </tr>
  );
}

// ============================================================
// MAIN ADMIN NFC COMPONENT
// ============================================================
export default function AdminNfc() {
  const [tokens, setTokens] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // ============================================================
  // DATA FETCHING — AUTO DECRYPT
  // ============================================================
  async function fetchTokens(isInitialLoad = false) {
    if (isInitialLoad) setLoading(true);
    try {
      setError('');

      // ✅ secureSelect — AUTO DECRYPT ang nfc_uid at nfc_token
      const data = await secureSelect('nfc_tokens', {
        columns: `
          *,
          bookings (
            id, check_in, check_out, status, payment_status,
            profiles (full_name, email),
            rooms (room_number, room_type)
          )
        `,
        order: { column: 'created_at', ascending: false },
        limit: FETCH_LIMIT
      });

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

  // ============================================================
  // ACTIONS — AUTO ENCRYPT update
  // ============================================================
  async function handleInvalidate(token) {
    const confirmed = window.confirm(
      `Invalidate this NFC token?\n\nPurpose: ${token.purpose}`
    );
    if (!confirmed) return;

    setError('');
    setMessage('');
    setUpdatingId(token.id);

    try {
      // ✅ secureUpdate — auto-encrypt kung may encrypted fields
      await secureUpdate(
        'nfc_tokens',
        { id: token.id },
        {
          status: 'invalidated',
          invalidated_at: new Date().toISOString()
        }
      );

      setMessage('Token invalidated successfully.');
      await fetchTokens(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // ============================================================
  // DERIVED DATA
  // ============================================================
  const counts = {
    all: tokens.length,
    active: tokens.filter((t) => t.status === 'active').length,
    used: tokens.filter((t) => t.status === 'used').length,
    invalidated: tokens.filter((t) => t.status === 'invalidated').length,
    expired: tokens.filter((t) => t.status === 'expired').length
  };

  const filteredTokens = tokens.filter((token) => {
    if (filter !== 'all' && token.status !== filter) return false;

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const searchable = [
        token.id,
        token.booking_id,
        token.nfc_uid,        // ✅ decrypted — searchable
        token.nfc_token,      // ✅ decrypted — searchable
        token.purpose,
        token.bookings?.profiles?.full_name,
        token.bookings?.profiles?.email,
        token.bookings?.rooms?.room_number
      ].filter(Boolean).join(' ').toLowerCase();

      if (!searchable.includes(query)) return false;
    }
    return true;
  });

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <AdminLayout>

      <div className="admin-welcome">
        <h1>NFC Management</h1>
        <p>View, monitor, and invalidate all NFC tokens. NFC UID at token ay auto-decrypted.</p>
      </div>

      <div className="admin-stat-grid">
        <StatCard
          color="blue"
          icon="satellite-dish"
          label="Total Tokens"
          value={counts.all}
          sub="All-time"
        />
        <StatCard
          color="green"
          icon="circle-check"
          label="Active"
          value={counts.active}
          sub="Ready for check-in"
        />
        <StatCard
          color="orange"
          icon="wifi"
          label="Used"
          value={counts.used}
          sub="Already tapped"
        />
        <StatCard
          color="purple"
          icon="lock"
          label="Invalidated"
          value={counts.invalidated}
          sub={`${counts.expired} expired`}
        />
      </div>

      <div className="admin-panel admin-gap-bottom">
        <div className="admin-row admin-row-center">
          <div className="admin-col">
            <input
              className="admin-input"
              placeholder="Search by guest, room, booking, NFC UID, or token…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="admin-col admin-col-fixed">
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
          <button className="admin-btn admin-btn-secondary" onClick={() => fetchTokens(true)}>
            <i className="rotate"></i> Refresh
          </button>
        </div>
      </div>

      {error && <p className="admin-error admin-gap-top">{error}</p>}
      {message && <p className="admin-success admin-gap-top">{message}</p>}

      <div className="admin-panel admin-scroll-wrapper">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="satellite-dish"></i> All NFC Tokens ({filteredTokens.length})
          </h3>
        </div>

        {loading && <p className="admin-muted admin-center">Loading…</p>}

        {!loading && filteredTokens.length === 0 && (
          <p className="admin-muted admin-center">No NFC tokens found.</p>
        )}

        {!loading && filteredTokens.length > 0 && (
          <table className="admin-table admin-table-wide">
            <thead>
              <tr>
                <th>Token ID</th>
                <th>Purpose</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Booking ID</th>
                <th>Status</th>
                <th>🔓 NFC UID</th>
                <th>🔓 NFC Token</th>
                <th>Expires</th>
                <th>Used at</th>
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