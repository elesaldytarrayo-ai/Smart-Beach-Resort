// Imports — React hooks, Supabase, and admin layout wrapper
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

// ============================================================
// CONSTANTS
// ============================================================

const REFRESH_INTERVAL_MS = 10000; // Refresh payments every 10 seconds

// Maps a payment method string to its corresponding icon
// Falls back to a generic credit-card icon for unknown methods
const METHOD_ICON_MAP = {
  paymongo: 'mobile-screen',
  'manual-admin': 'user-shield'
};

// Defines the filter options for the dropdown
const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'paid',    label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed',  label: 'Failed' }
];

// ============================================================
// REUSABLE SUB-COMPONENTS
// ============================================================

// StatCard — displays a large KPI card on the payments dashboard
// Used for the big colored cards at the top (total, paid, pending, revenue)
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

// MethodIcon — renders the payment method with its corresponding icon
function MethodIcon({ method }) {
  const icon = METHOD_ICON_MAP[method] || 'credit-card';
  return (
    <>
      <i className={`${icon} admin-gap`}></i>
      {method || '—'}
    </>
  );
}

// FormattedDate — renders a date consistently with time, or an em-dash if missing
function FormattedDate({ value }) {
  if (!value) return <span className="admin-muted">—</span>;
  return <span className="admin-muted">{new Date(value).toLocaleString()}</span>;
}

// TruncatedId — renders the first 8 characters of an ID with an ellipsis
// Full ID is shown on hover via title attribute
function TruncatedId({ value }) {
  if (!value) return <span className="admin-muted">—</span>;
  return (
    <span className="admin-muted" title={value}>
      {String(value).slice(0, 8)}…
    </span>
  );
}

// TruncatedText — renders the first N characters of a text value
// Full text is shown on hover via title attribute
function TruncatedText({ value, length = 12 }) {
  if (!value) return <span className="admin-muted">—</span>;
  return (
    <span className="admin-muted" title={value}>
      {String(value).slice(0, length)}…
    </span>
  );
}

// PaymentRow — renders a single payment row in the payments table
// Shows payment ID, booking ID, guest, room, amount, method, status, reference, paymongo ID, paid date
function PaymentRow({ payment }) {
  const guest = payment.bookings?.profiles;
  const room = payment.bookings?.rooms;

  return (
    <tr>
      <td><TruncatedId value={payment.id} /></td>
      <td><TruncatedId value={payment.booking_id} /></td>
      <td>
        <div className="admin-cell-main">{guest?.full_name || '—'}</div>
        <div className="admin-cell-sub">{guest?.email}</div>
      </td>
      <td>Room {room?.room_number || '—'}</td>
      <td>
        <strong>₱{Number(payment.amount || 0).toLocaleString()}</strong>
      </td>
      <td><MethodIcon method={payment.method} /></td>
      <td>
        <span className={`admin-pill ${payment.status}`}>{payment.status}</span>
      </td>
      <td><TruncatedText value={payment.reference} length={12} /></td>
      <td><TruncatedText value={payment.paymongo_id} length={12} /></td>
      <td><FormattedDate value={payment.paid_at} /></td>
    </tr>
  );
}

// ============================================================
// MAIN ADMIN PAYMENTS COMPONENT
// ============================================================

// AdminPayments — displays all payment transactions with filtering, search, and KPIs
export default function AdminPayments() {

  // State — payments, filter, search, loading, error
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ============================================================
  // DATA FETCHING
  // ============================================================

  // fetchPayments — fetches all payments with related booking, profile, and room data
  // isInitialLoad controls whether to show the loading spinner
  async function fetchPayments(isInitialLoad = false) {
    if (isInitialLoad) setLoading(true);
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('payments')
        .select(`
          *,
          bookings (
            id, check_in, check_out, total_amount, payment_status, status,
            profiles (full_name, email, phone),
            rooms (room_number, room_type)
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setPayments(data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      if (isInitialLoad) setLoading(false);
    }
  }

  // Load payments on mount + auto-refresh every 10 seconds
  useEffect(() => {
    fetchPayments(true);
    const interval = setInterval(() => fetchPayments(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // DERIVED DATA
  // ============================================================

  // Counts per status for stat cards and filter dropdown
  const counts = {
    all: payments.length,
    paid: payments.filter((p) => p.status === 'paid').length,
    pending: payments.filter((p) => p.status === 'pending').length,
    failed: payments.filter((p) => p.status === 'failed').length
  };

  // Total revenue from paid payments
  const totalRevenue = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // Count of PayMongo-processed payments for the sub-label
  const paymongoCount = payments.filter((p) => p.method === 'paymongo').length;

  // Payments after applying the active filter and search query
  const filteredPayments = payments.filter((payment) => {
    if (filter !== 'all' && payment.status !== filter) return false;

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const searchable = [
        payment.id,
        payment.booking_id,
        payment.reference,
        payment.paymongo_id,
        payment.method,
        payment.bookings?.profiles?.full_name,
        payment.bookings?.profiles?.email,
        payment.bookings?.rooms?.room_number
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

      {/* Welcome header */}
      <div className="admin-welcome">
        <h1>Payments</h1>
        <p>All payment transactions (PayMongo + manual).</p>
      </div>

      {/* KPI stat cards — total, paid, pending, revenue */}
      <div className="admin-stat-grid">
        <StatCard
          color="blue"
          icon="credit-card"
          label="Total Payments"
          value={counts.all}
          sub={`${paymongoCount} via PayMongo`}
        />
        <StatCard
          color="green"
          icon="circle-check"
          label="Paid"
          value={counts.paid}
          sub="Completed"
        />
        <StatCard
          color="orange"
          icon="hourglass-half"
          label="Pending"
          value={counts.pending}
          sub="Awaiting"
        />
        <StatCard
          color="purple"
          icon="peso-sign"
          label="Total Revenue"
          value={`₱${totalRevenue.toLocaleString()}`}
          sub="All-time"
        />
      </div>

      {/* Toolbar — search, filter dropdown, refresh button */}
      <div className="admin-panel admin-gap-bottom">
        <div className="admin-row admin-row-center">
          <div className="admin-col">
            <input
              className="admin-input"
              placeholder="Search ID, guest, reference…"
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
          <button className="admin-btn admin-btn-secondary" onClick={() => fetchPayments(true)}>
            <i className="rotate"></i> Refresh
          </button>
        </div>
      </div>

      {/* Feedback messages */}
      {error && <p className="admin-error admin-gap-top">{error}</p>}

      {/* Payments table */}
      <div className="admin-panel admin-scroll-wrapper">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="credit-card"></i> All Payments ({filteredPayments.length})
          </h3>
        </div>

        {loading && <p className="admin-muted admin-center">Loading…</p>}

        {!loading && filteredPayments.length === 0 && (
          <p className="admin-muted admin-center">No payments yet.</p>
        )}

        {!loading && filteredPayments.length > 0 && (
          <table className="admin-table admin-table-wide">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Booking ID</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Status</th>
                <th>Reference</th>
                <th>PayMongo ID</th>
                <th>Paid at</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <PaymentRow key={payment.id} payment={payment} />
              ))}
            </tbody>
          </table>
        )}
      </div>

    </AdminLayout>
  );
}