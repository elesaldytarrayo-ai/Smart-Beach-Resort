import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

// --- Constants ---
const REFRESH_INTERVAL_MS = 10000;

// Maps a payment method string to its corresponding Font Awesome icon.
// Falls back to a generic credit-card icon for unknown methods.
const METHOD_ICON_MAP = {
  paymongo: 'fa-mobile-screen',
  'manual-admin': 'fa-user-shield'
};

// Defines the filter options for the dropdown.
const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'paid',    label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed',  label: 'Failed' }
];

// REUSABLE SUB-COMPONENTS
// StatCard Component
// Displays a large KPI card on the payments dashboard.
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

// MethodIcon Component
// Renders the payment method with its corresponding icon.
function MethodIcon({ method }) {
  const icon = METHOD_ICON_MAP[method] || 'fa-credit-card';
  return (
    <>
      <i className={`fa-solid ${icon} mr-1`}></i>
      {method || '—'}
    </>
  );
}

// FormattedDate Component
// Renders a date consistently with time, or an em-dash if missing.
function FormattedDate({ value }) {
  if (!value) return <span className="muted">—</span>;
  return <span className="muted">{new Date(value).toLocaleString()}</span>;
}

// TruncatedId Component
// Renders the first 8 characters of an ID with an ellipsis, 
// with the full ID shown on hover.
function TruncatedId({ value }) {
  if (!value) return <span className="muted">—</span>;
  return (
    <span className="muted" title={value}>
      {String(value).slice(0, 8)}…
    </span>
  );
}

// TruncatedText Component
// Renders the first N characters of a text value, with the full text on hover.
function TruncatedText({ value, length = 12 }) {
  if (!value) return <span className="muted">—</span>;
  return (
    <span className="muted" title={value}>
      {String(value).slice(0, length)}…
    </span>
  );
}

// PaymentRow Component
// Renders a single payment row in the payments table.
function PaymentRow({ payment }) {
  const guest = payment.bookings?.profiles;
  const room = payment.bookings?.rooms;

  return (
    <tr>
      <td><TruncatedId value={payment.id} /></td>
      <td><TruncatedId value={payment.booking_id} /></td>
      <td>
        <div className="cell-main">{guest?.full_name || '—'}</div>
        <div className="cell-sub">{guest?.email}</div>
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

// MAIN ADMIN PAYMENTS COMPONENT
// AdminPayments Component
// Displays all payment transactions with filtering, search, and KPIs.
export default function AdminPayments() {
  // --- State Management ---
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // DATA FETCHING
  // Fetches all payments with their related booking, profile, and room data.
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

  useEffect(() => {
    fetchPayments(true);
    const interval = setInterval(() => fetchPayments(false), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // DERIVED DATA
  /** Counts per status for stat cards and filter dropdown. */
  const counts = {
    all: payments.length,
    paid: payments.filter((p) => p.status === 'paid').length,
    pending: payments.filter((p) => p.status === 'pending').length,
    failed: payments.filter((p) => p.status === 'failed').length
  };

  /** Total revenue from paid payments. */
  const totalRevenue = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  /** Count of PayMongo-processed payments for the sub-label. */
  const paymongoCount = payments.filter((p) => p.method === 'paymongo').length;

  /** Payments after applying the active filter and search query. */
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

  // RENDER
  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Payments</h1>
        <p>All payment transactions (PayMongo + manual).</p>
      </div>

      {/* KPI STAT CARDS*/}
      <div className="admin-stat-grid">
        <StatCard
          color="blue"
          icon="fa-credit-card"
          label="Total Payments"
          value={counts.all}
          sub={`${paymongoCount} via PayMongo`}
        />
        <StatCard
          color="green"
          icon="fa-circle-check"
          label="Paid"
          value={counts.paid}
          sub="Completed"
        />
        <StatCard
          color="orange"
          icon="fa-hourglass-half"
          label="Pending"
          value={counts.pending}
          sub="Awaiting"
        />
        <StatCard
          color="purple"
          icon="fa-peso-sign"
          label="Total Revenue"
          value={`₱${totalRevenue.toLocaleString()}`}
          sub="All-time"
        />
      </div>

      {/*TOOLBAR*/}
      <div className="admin-panel mb-4">
        <div className="row row-center">
          <div className="col">
            <input
              className="admin-input"
              placeholder="Search ID, guest, reference…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col col-fixed-180">
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
          <button className="app-btn app-btn-secondary" onClick={() => fetchPayments(true)}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      {/*FEEDBACK*/}
      {error && <p className="admin-error mb-2">{error}</p>}

      {/*PAYMENTS TABLE*/}
      <div className="admin-panel table-scroll-wrapper">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-credit-card"></i> All Payments ({filteredPayments.length})
          </h3>
        </div>

        {loading && <p className="muted center">Loading…</p>}

        {!loading && filteredPayments.length === 0 && (
          <p className="muted center">No payments yet.</p>
        )}

        {!loading && filteredPayments.length > 0 && (
          <table className="admin-table table-wide">
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