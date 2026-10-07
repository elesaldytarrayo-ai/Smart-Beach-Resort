/* ============================================================
   src/app/user/UserProfile.jsx
   Profile + Password — with UserLayout.
   ============================================================ */

import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import { encrypt, decrypt } from '../../encryption.js';
import UserLayout from './UserLayout.jsx';

export default function UserProfile() {
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' });
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: p } = await supabase
        .from('profiles').select('*').eq('id', auth.user.id).single();
      if (p) setProfile({ ...p, phone: decrypt(p.phone) });
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

  return (
    <UserLayout>
      <div className="admin-welcome">
        <h1>My Profile</h1>
        <p>Update your personal information and password.</p>
      </div>

      {err && <p className="admin-error">{err}</p>}
      {msg && <p className="admin-success">{msg}</p>}

      <div className="admin-dashboard-grid">
        {/* Personal Info */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-circle-user"></i> Personal Information
            </h3>
          </div>

          <form onSubmit={saveProfile}>
            <div className="admin-field">
              <label><i className="fa-solid fa-user"></i> Full Name</label>
              <input className="admin-input" placeholder="Juan Dela Cruz"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            </div>

            <div className="admin-field">
              <label><i className="fa-solid fa-envelope"></i> Email</label>
              <input className="admin-input" value={profile.email || ''} disabled />
              <p className="admin-field-hint">Email cannot be changed.</p>
            </div>

            <div className="admin-field">
              <label><i className="fa-solid fa-phone"></i> Phone</label>
              <input className="admin-input" placeholder="0912 345 6789"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            </div>

            <div className="admin-form-actions">
              <button className="app-btn app-btn-primary">
                <i className="fa-solid fa-floppy-disk"></i> Save Changes
              </button>
            </div>
          </form>
        </div>

        {/* Change Password */}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-key"></i> Change Password
            </h3>
          </div>

          <form onSubmit={changePassword}>
            <div className="admin-field">
              <label><i className="fa-solid fa-lock"></i> New Password</label>
              <input className="admin-input" type="password"
                placeholder="Min 6 characters"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                required minLength={6} />
            </div>

            <div className="admin-field">
              <label><i className="fa-solid fa-lock"></i> Confirm Password</label>
              <input className="admin-input" type="password"
                placeholder="Re-enter password"
                value={pw2}
                onChange={(e) => setPw2(e.target.value)}
                required minLength={6} />
            </div>

            <div className="admin-form-actions">
              <button className="app-btn app-btn-primary">
                <i className="fa-solid fa-shield-halved"></i> Update Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </UserLayout>
  );
}