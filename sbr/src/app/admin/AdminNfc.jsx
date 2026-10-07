/* ============================================================
   src/app/admin/AdminNfc.jsx
   NFC Management — lahat ng icons Font Awesome.
   ============================================================ */

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

export default function AdminNfc() {
  const [tokens, setTokens] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function refresh() {
    try {
      setErr('');
      const { data, error } = await supabase
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
        .limit(200);
      if (error) throw error;
      setTokens(data || []);
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, []);

  async function invalidateToken(token) {
    if (!confirm(`Invalidate this NFC token?\n\nPurpose: ${token.purpose}`)) return;
    setErr(''); setMsg('');
    const { error } = await supabase.from('nfc_tokens').update({
      status: 'invalidated', invalidated_at: new Date().toISOString()
    }).eq('id', token.id);
    if (error) return setErr(error.message);
    setMsg('Token invalidated.');
    refresh();
  }

  const filtered = tokens.filter((t) => {
    if (filter !== 'all' && t.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      const hay = [
        t.id, t.booking_id, t.token_hash, t.purpose,
        t.bookings?.profiles?.full_name, t.bookings?.profiles?.email,
        t.bookings?.rooms?.room_number
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    all: tokens.length,
    active: tokens.filter((t) => t.status === 'active').length,
    used: tokens.filter((t) => t.status === 'used').length,
    invalidated: tokens.filter((t) => t.status === 'invalidated').length,
    expired: tokens.filter((t) => t.status === 'expired').length
  };

  const statusPill = (status) => {
    const map = {
      active: 'confirmed',
      used: 'pending',
      invalidated: 'unpaid',
      expired: 'unpaid'
    };
    return map[status] || '';
  };

  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>NFC Management</h1>
        <p>View, monitor, at i-invalidate ang lahat ng NFC tokens.</p>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card blue">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Total Tokens</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-satellite-dish"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.all}</div>
            <div className="admin-stat-sub">All-time</div>
          </div>
        </div>
        <div className="admin-stat-card green">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Active</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-circle-check"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.active}</div>
            <div className="admin-stat-sub">Ready for check-in</div>
          </div>
        </div>
        <div className="admin-stat-card orange">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Used</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-wifi"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.used}</div>
            <div className="admin-stat-sub">Already tapped</div>
          </div>
        </div>
        <div className="admin-stat-card purple">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Invalidated</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-lock"></i></span>
          </div>
          <div>
            <div className="admin-stat-value">{counts.invalidated}</div>
            <div className="admin-stat-sub">{counts.expired} expired</div>
          </div>
        </div>
      </div>

      <div className="admin-panel" style={{ marginBottom: 20 }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <div className="col">
            <input className="admin-input" placeholder="Search by guest, room, booking, token…"
              value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 0 }} />
          </div>
          <div className="col" style={{ flex: '0 0 200px' }}>
            <select className="admin-select" value={filter}
              onChange={(e) => setFilter(e.target.value)} style={{ marginBottom: 0 }}>
              <option value="all">All ({counts.all})</option>
              <option value="active">Active ({counts.active})</option>
              <option value="used">Used ({counts.used})</option>
              <option value="invalidated">Invalidated ({counts.invalidated})</option>
              <option value="expired">Expired ({counts.expired})</option>
            </select>
          </div>
          <button className="app-btn app-btn-secondary" onClick={refresh}>
            <i className="fa-solid fa-rotate"></i> Refresh
          </button>
        </div>
      </div>

      {err && <p className="admin-error" style={{ marginBottom: 12 }}>{err}</p>}
      {msg && <p className="admin-success" style={{ marginBottom: 12 }}>{msg}</p>}

      <div className="admin-panel" style={{ overflowX: 'auto' }}>
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-satellite-dish"></i> All NFC Tokens ({filtered.length})
          </h3>
        </div>

        {loading && <p className="muted center">Loading…</p>}
        {!loading && filtered.length === 0 && <p className="muted center">Wala pang NFC tokens.</p>}

        {!loading && filtered.length > 0 && (
          <table className="admin-table" style={{ minWidth: 1100 }}>
            <thead>
              <tr>
                <th>Token ID</th><th>Purpose</th><th>Guest</th><th>Room</th>
                <th>Booking ID</th><th>Status</th><th>Expires</th>
                <th>Used at</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const guest = t.bookings?.profiles;
                const room = t.bookings?.rooms;
                const isActive = t.status === 'active';

                return (
                  <tr key={t.id}>
                    <td className="muted" title={t.id}>{String(t.id).slice(0, 8)}…</td>
                    <td>
                      <span className={`admin-pill ${t.purpose === 'check_in' ? 'confirmed' : 'pending'}`}>
                        <i className={t.purpose === 'check_in' ? 'fa-solid fa-right-to-bracket' : 'fa-solid fa-right-from-bracket'}></i>
                        {t.purpose === 'check_in' ? 'Check-in' : 'Check-out'}
                      </span>
                    </td>
                    <td>
                      <strong>{guest?.full_name || '—'}</strong>
                      <br />
                      <span className="muted">{guest?.email}</span>
                    </td>
                    <td>Room {room?.room_number || '—'}</td>
                    <td className="muted" title={t.booking_id}>{String(t.booking_id || '').slice(0, 8)}…</td>
                    <td>
                      <span className={`admin-pill ${statusPill(t.status)}`}>{t.status}</span>
                    </td>
                    <td className="muted">
                      {t.expires_at ? new Date(t.expires_at).toLocaleString() : '—'}
                    </td>
                    <td className="muted">
                      {t.used_at ? new Date(t.used_at).toLocaleString() : '—'}
                    </td>
                    <td className="muted">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString() : '—'}
                    </td>
                    <td>
                      {isActive ? (
                        <button className="app-btn app-btn-danger"
                          onClick={() => invalidateToken(t)}
                          style={{ padding: '6px 10px', fontSize: 12 }}>
                          <i className="fa-solid fa-ban"></i> Invalidate
                        </button>
                      ) : (
                        <span className="muted" style={{ fontSize: 12 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}