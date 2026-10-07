/* ============================================================
   src/app/admin/AdminSettings.jsx
   Settings — lahat ng icons Font Awesome.
   ============================================================ */

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import { decrypt, encrypt } from '../../encryption.js';
import AdminLayout from './AdminLayout.jsx';

const RESORT_KEY = 'sbr:resortSettings';

export default function AdminSettings() {
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' });
  const [resort, setResort] = useState({
    name: 'Smart Beach Resort',
    tagline: 'Your beach escape awaits',
    contact: '+63 912 345 6789',
    address: 'Beachfront Drive, NwSSU, Philippines',
    currency: 'PHP'
  });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [systemStatus, setSystemStatus] = useState({
    backend: 'checking', supabase: 'checking', paymongo: 'checking', nfc: 'checking'
  });
  const [bookingStats, setBookingStats] = useState({
    totalBookings: 0, totalPayments: 0, totalRooms: 0, totalUsers: 0
  });

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: p } = await supabase
          .from('profiles').select('*').eq('id', auth.user.id).single();
        if (p) setProfile({ ...p, phone: decrypt(p.phone) });
      }

      const stored = localStorage.getItem(RESORT_KEY);
      if (stored) {
        try { setResort(JSON.parse(stored)); } catch {}
      }

      try {
        const res = await fetch('http://localhost:5000/');
        if (res.ok) {
          const data = await res.json();
          setSystemStatus({
            backend: 'online',
            supabase: data.config?.supabase ? 'configured' : 'missing',
            paymongo: data.config?.paymongo ? 'configured' : 'missing',
            nfc: data.config?.nfc ? 'configured' : 'missing'
          });
        } else {
          setSystemStatus({ backend: 'offline', supabase: 'unknown', paymongo: 'unknown', nfc: 'unknown' });
        }
      } catch {
        setSystemStatus({ backend: 'offline', supabase: 'unknown', paymongo: 'unknown', nfc: 'unknown' });
      }

      const [b, p2, r, u] = await Promise.all([
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        supabase.from('payments').select('*', { count: 'exact', head: true }),
        supabase.from('rooms').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true })
      ]);
      setBookingStats({
        totalBookings: b.count || 0,
        totalPayments: p2.count || 0,
        totalRooms: r.count || 0,
        totalUsers: u.count || 0
      });
    })();
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      phone: encrypt(profile.phone)
    }).eq('id', auth.user.id);
    if (error) return setErr(error.message);
    setMsg('Profile updated.');
  }

  async function changePassword(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    if (pw !== pw2) return setErr('Passwords do not match.');
    if (pw.length < 6) return setErr('Password must be at least 6 characters.');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr(error.message);
    setMsg('Password updated.');
    setPw(''); setPw2('');
  }

  function saveResort(e) {
    e.preventDefault();
    setErr(''); setMsg('');
    localStorage.setItem(RESORT_KEY, JSON.stringify(resort));
    setMsg('Resort settings saved.');
  }

  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Settings</h1>
        <p>I-manage ang iyong admin profile, resort info, at tingnan ang system status.</p>
      </div>

      {err && <p className="admin-error" style={{ marginBottom: 12 }}>{err}</p>}
      {msg && <p className="admin-success" style={{ marginBottom: 12 }}>{msg}</p>}

      <div className="admin-stat-grid" style={{ marginBottom: 24 }}>
        <div className="admin-stat-card blue">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Backend API</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-server"></i></span>
          </div>
          <div>
            <div className="admin-stat-value" style={{ fontSize: 20, textTransform: 'capitalize' }}>
              {systemStatus.backend}
            </div>
            <div className="admin-stat-sub">localhost:5000</div>
          </div>
        </div>
        <div className="admin-stat-card green">
          <div className="admin-stat-top">
            <span className="admin-stat-label">Supabase</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-database"></i></span>
          </div>
          <div>
            <div className="admin-stat-value" style={{ fontSize: 20, textTransform: 'capitalize' }}>
              {systemStatus.supabase}
            </div>
            <div className="admin-stat-sub">Database connection</div>
          </div>
        </div>
        <div className="admin-stat-card orange">
          <div className="admin-stat-top">
            <span className="admin-stat-label">PayMongo</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-credit-card"></i></span>
          </div>
          <div>
            <div className="admin-stat-value" style={{ fontSize: 20, textTransform: 'capitalize' }}>
              {systemStatus.paymongo}
            </div>
            <div className="admin-stat-sub">Payment gateway</div>
          </div>
        </div>
        <div className="admin-stat-card purple">
          <div className="admin-stat-top">
            <span className="admin-stat-label">NFC Service</span>
            <span className="admin-stat-icon"><i className="fa-solid fa-satellite-dish"></i></span>
          </div>
          <div>
            <div className="admin-stat-value" style={{ fontSize: 20, textTransform: 'capitalize' }}>
              {systemStatus.nfc}
            </div>
            <div className="admin-stat-sub">Token service</div>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3 className="admin-panel-title">
                <i className="fa-solid fa-user-shield"></i> Admin Profile
              </h3>
            </div>

            <form onSubmit={saveProfile}>
              <label className="admin-label">Full Name</label>
              <input className="admin-input" value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                placeholder="Juan Dela Cruz" />

              <label className="admin-label">Email</label>
              <input className="admin-input" value={profile.email || ''} disabled />

              <label className="admin-label">Phone</label>
              <input className="admin-input" value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                placeholder="0912 345 6789" />

              <button className="app-btn app-btn-primary" style={{ width: '100%', marginTop: 8 }}>
                <i className="fa-solid fa-floppy-disk"></i> Save Profile
              </button>
            </form>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3 className="admin-panel-title">
                <i className="fa-solid fa-key"></i> Change Password
              </h3>
            </div>

            <form onSubmit={changePassword}>
              <label className="admin-label">New Password</label>
              <input className="admin-input" type="password" value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="Min 6 characters" required minLength={6} />

              <label className="admin-label">Confirm Password</label>
              <input className="admin-input" type="password" value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                placeholder="Re-enter password" required minLength={6} />

              <button className="app-btn app-btn-primary" style={{ width: '100%', marginTop: 8 }}>
                <i className="fa-solid fa-lock"></i> Update Password
              </button>
            </form>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3 className="admin-panel-title">
                <i className="fa-solid fa-umbrella-beach"></i> Resort Information
              </h3>
            </div>

            <form onSubmit={saveResort}>
              <label className="admin-label">Resort Name</label>
              <input className="admin-input" value={resort.name}
                onChange={(e) => setResort({ ...resort, name: e.target.value })} />

              <label className="admin-label">Tagline</label>
              <input className="admin-input" value={resort.tagline}
                onChange={(e) => setResort({ ...resort, tagline: e.target.value })} />

              <label className="admin-label">Contact</label>
              <input className="admin-input" value={resort.contact}
                onChange={(e) => setResort({ ...resort, contact: e.target.value })} />

              <label className="admin-label">Address</label>
              <input className="admin-input" value={resort.address}
                onChange={(e) => setResort({ ...resort, address: e.target.value })} />

              <label className="admin-label">Currency</label>
              <select className="admin-select" value={resort.currency}
                onChange={(e) => setResort({ ...resort, currency: e.target.value })}>
                <option value="PHP">PHP (₱)</option>
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>

              <button className="app-btn app-btn-primary" style={{ width: '100%', marginTop: 8 }}>
                <i className="fa-solid fa-floppy-disk"></i> Save Resort Info
              </button>
            </form>
          </div>

          <div className="admin-panel">
            <div className="admin-panel-header">
              <h3 className="admin-panel-title">
                <i className="fa-solid fa-chart-simple"></i> System Summary
              </h3>
            </div>

            <div className="admin-donut-legend">
              <div className="admin-legend-item">
                <span className="admin-legend-left">
                  <span className="admin-legend-dot" style={{ background: '#1e5fa8' }} />
                  Total Bookings
                </span>
                <strong>{bookingStats.totalBookings}</strong>
              </div>
              <div className="admin-legend-item">
                <span className="admin-legend-left">
                  <span className="admin-legend-dot" style={{ background: '#22c55e' }} />
                  Total Payments
                </span>
                <strong>{bookingStats.totalPayments}</strong>
              </div>
              <div className="admin-legend-item">
                <span className="admin-legend-left">
                  <span className="admin-legend-dot" style={{ background: '#ea8c00' }} />
                  Total Rooms
                </span>
                <strong>{bookingStats.totalRooms}</strong>
              </div>
              <div className="admin-legend-item">
                <span className="admin-legend-left">
                  <span className="admin-legend-dot" style={{ background: '#7c3aed' }} />
                  Total Users
                </span>
                <strong>{bookingStats.totalUsers}</strong>
              </div>
            </div>

            <p className="muted" style={{ marginTop: 20, fontSize: 12, textAlign: 'center' }}>
              Smart Beach Resort · v1.0.0
              <br />
              Built with React + Supabase
            </p>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}