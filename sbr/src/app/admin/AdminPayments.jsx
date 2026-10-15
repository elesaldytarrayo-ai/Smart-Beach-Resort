// Imports
import { useEffect, useState } from 'react';
import { supabase, secureSelect } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

const REFRESH_INTERVAL_MS = 10000;

const METHOD_ICON_MAP = {
  paymongo: 'mobile-screen',
  'manual-admin': 'user-shield'
};

const FILTERS = [
  { key: 'all',     label: 'All' },
  { key: 'paid',    label: 'Paid' },
  { key: 'pending', label: 'Pending' },
  { key: 'failed',  label: 'Failed' }
];

function StatCard({ color, icon, label, value, sub }) {
  return (
    <div className={`admin-stat-card ${color}`}>
      <div className="admin-stat-top">
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-icon"><i className={icon}></i></span>
      </div>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-sub">{sub}</div>
      </div>
    </div>
  );
}

function MethodIcon({ method }) {
  const icon = METHOD_ICON_MAP[method] || 'credit-card';
  return (<><i className={`${icon} admin-gap`}></i>{method || '—'}</>);
}

function FormattedDate({ value }) {
  if (!value) return <span className="admin-muted">—</span>;
  return <span className="admin-muted">{new Date(value).toLocaleString()}</span>;
}

function TruncatedId({ value }) {
  if (!value) return <span className="admin-muted">—</span>;
  return (
    <span className="admin-muted" title={value}>
      {String(value).slice(0, 8)}…
    </span>
  );
}

function DecryptedCell({ value, length = 20 }) {
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
      <td><strong>₱{Number(payment.amount || 0).toLocaleString()}</strong></td>
      <td><MethodIcon method={payment.method} /></td>
      <td><span className={`admin-pill ${payment.status}`}>{payment.status}</span></td>
      <td><DecryptedCell value={payment.reference_number} length={20} /></td>
      <td><DecryptedCell value={payment.paymongo_id} length={20} /></td>
      <td><FormattedDate value={payment.paid_at} /></td>
    </tr>
  );
}

export default function AdminPayments() {
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function fetchPayments(isInitialLoad = false) {
    if (isInitialLoad) setLoading(true);
    try {
      setError('');
      const data = await secureSelect('payments', {
        columns: `
          *,
          bookings (
            id, check_in, check_out, total_amount, payment_status, status,
            profiles (full_name, email, phone),
            rooms (room_number, room_type)
          )
        `,
        order: { column: 'created_at', ascending: false }
      });
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

  const counts = {
    all: payments.length,
    paid: payments.filter((p) => p.status === 'paid').length,
    pending: payments.filter((p) => p.status === 'pending').length,
    failed: payments.filter((p) => p.status === 'failed').length
  };

  const totalRevenue = payments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const paymongoCount = payments.filter((p) => p.method === 'paymongo').length;

  const filteredPayments = payments.filter((payment) => {
    if (filter !== 'all' && payment.status !== filter) return false;

    if (search.trim()) {
      const query = search.toLowerCase().trim();
      const searchable = [
        payment.id,
        payment.booking_id,
        payment.reference_number,
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

  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Payments</h1>
        <p>All payment transactions. Reference Number at PayMongo ID ay auto-decrypted.</p>
      </div>

      <div className="admin-stat-grid">
        <StatCard color="blue"   icon="credit-card"    label="Total Payments" value={counts.all}                         sub={`${paymongoCount} via PayMongo`} />
        <StatCard color="green"  icon="circle-check"   label="Paid"           value={counts.paid}                        sub="Completed" />
        <StatCard color="orange" icon="hourglass-half" label="Pending"        value={counts.pending}                     sub="Awaiting" />
        <StatCard color="purple" icon="peso-sign"      label="Total Revenue"  value={`₱${totalRevenue.toLocaleString()}`} sub="All-time" />
      </div>

      <div className="admin-panel admin-gap-bottom">
        <div className="admin-row admin-row-center">
          <div className="admin-col">
            <input
              className="admin-input"
              placeholder="Search ID, guest, reference, paymongo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="admin-col admin-col-fixed">
            <select className="admin-select" value={filter} onChange={(e) => setFilter(e.target.value)}>
              {FILTERS.map((f) => (
                <option key={f.key} value={f.key}>{f.label} ({counts[f.key]})</option>
              ))}
            </select>
          </div>
          <button className="admin-btn admin-btn-secondary" onClick={() => fetchPayments(true)}>
            <i className="rotate"></i> Refresh
          </button>
        </div>
      </div>

      {error && <p className="admin-error admin-gap-top">{error}</p>}

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
                <th>🔓 Reference Number</th>
                <th>🔓 PayMongo ID</th>
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