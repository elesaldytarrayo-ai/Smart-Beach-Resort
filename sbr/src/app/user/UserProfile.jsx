// src/app/UserProfile.jsx
// Personal info + password change.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../supabase.js';

export default function UserProfile() {
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' });
  const [pw, setPw] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data: p } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
      if (p) setProfile(p);
    })();
  }, []);

  async function saveProfile(e) {
    e.preventDefault(); setErr(''); setMsg('');
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from('profiles').update({
      full_name: profile.full_name,
      phone: profile.phone
    }).eq('id', auth.user.id);
    if (error) return setErr(error.message);
    setMsg('Profile updated.');
  }

  async function changePassword(e) {
    e.preventDefault(); setErr(''); setMsg('');
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) return setErr(error.message);
    setMsg('Password updated.');
    setPw('');
  }

  return (
    <>
      <div className="nav">
        <strong>SBR · Profile</strong>
        <div className="row" style={{ marginLeft: 'auto' }}>
          <Link to="/user">Dashboard</Link>
          <Link to="/user/booking">Bookings</Link>
          <Link to="/user/profile">Profile</Link>
        </div>
      </div>

      <div className="page-pad">
        <div className="neu-card">
          <h2>Personal Information</h2>
          <form onSubmit={saveProfile}>
            <input className="neu-input" placeholder="Full name" value={profile.full_name || ''}
              onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            <input className="neu-input" placeholder="Phone" value={profile.phone || ''}
              onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <input className="neu-input" value={profile.email || ''} disabled />
            <button className="neu-button primary">Save</button>
          </form>
        </div>

        <div className="neu-card" style={{ marginTop: 20 }}>
          <h2>Change Password</h2>
          <form onSubmit={changePassword}>
            <input className="neu-input" type="password" placeholder="New password" value={pw}
              onChange={(e) => setPw(e.target.value)} minLength={6} required />
            <button className="neu-button primary">Update password</button>
          </form>
        </div>

        {err && <p style={{ color: 'var(--danger)' }}>{err}</p>}
        {msg && <p style={{ color: 'var(--success)' }}>{msg}</p>}
      </div>
    </>
  );
}