// Imports — React hooks, Supabase (secure), encryption helpers, and layout wrapper
import { useEffect, useState } from 'react';
import { supabase, secureSelect, secureUpdate } from '../../supabase.js';
import { encrypt, decrypt } from '../../encryption.js';
import UserLayout from './UserLayout.jsx';

export default function UserProfile() {
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '', password: '' });

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  async function loadProfile() {
    setLoading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) return;

      const data = await secureSelect('profiles', {
        columns: '*',
        match: { id: auth.user.id },
        single: true
      });

      setProfile({
        full_name: data.full_name || '',
        email: data.email || auth.user.email || '',
        phone: data.phone || '',
        password: data.password || ''
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfileError('Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProfile(); }, []);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setSavingProfile(true);

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) throw new Error('No active session. Please log in again.');

      await secureUpdate(
        'profiles',
        { id: auth.user.id },
        {
          full_name: profile.full_name.trim(),
          phone: profile.phone ? profile.phone.trim() : null
        }
      );

      setProfileMessage('Profile updated successfully.');
    } catch (error) {
      setProfileError(error.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    if (newPassword !== confirmPassword) {
      return setPasswordError('Passwords do not match.');
    }
    if (newPassword.length < 6) {
      return setPasswordError('Password must be at least 6 characters.');
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user) {
        await secureUpdate('profiles', { id: auth.user.id }, { password: newPassword });
      }

      setPasswordMessage('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <UserLayout>

      <div className="profile-welcome">
        <h1>My Profile</h1>
        <p>Update your personal information and change your password.</p>
      </div>

      <div className="profile-grid">

        <div className="profile-panel">
          <div className="profile-panel-header">
            <h3 className="profile-panel-title"><i className="circle-user"></i> Personal Information</h3>
          </div>

          <form onSubmit={handleSaveProfile}>
            <div className="profile-field">
              <label htmlFor="full-name"><i className="user"></i> Full Name</label>
              <input id="full-name" className="profile-input" placeholder="Juan Dela Cruz" value={profile.full_name || ''} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} disabled={loading} required />
            </div>

            <div className="profile-field">
              <label htmlFor="email"><i className="envelope"></i> Email</label>
              <input id="email" className="profile-input" value={profile.email || ''} disabled />
              <p className="profile-hint">Email cannot be changed.</p>
            </div>

            <div className="profile-field">
              <label htmlFor="phone"><i className="phone"></i> Phone 🔒</label>
              <input id="phone" className="profile-input" placeholder="0912 345 6789" value={profile.phone || ''} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} disabled={loading} />
              <p className="profile-hint">🔓 Naka-decrypt sa display. 🔒 Naka-encrypt sa Supabase.</p>
            </div>

            {profileError && <p className="profile-error">{profileError}</p>}
            {profileMessage && <p className="profile-success">{profileMessage}</p>}

            <div className="profile-actions">
              <button type="submit" className="profile-btn profile-btn-primary" disabled={savingProfile || loading}>
                <i className={savingProfile ? 'spinner' : 'floppy-disk'}></i>
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="profile-panel">
          <div className="profile-panel-header">
            <h3 className="profile-panel-title"><i className="key"></i> Change Password</h3>
          </div>

          <form onSubmit={handleChangePassword}>
            <div className="profile-field">
              <label htmlFor="new-password"><i className="lock"></i> New Password</label>
              <input id="new-password" className="profile-input" type="password" placeholder="Min 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>

            <div className="profile-field">
              <label htmlFor="confirm-password"><i className="lock"></i> Confirm Password</label>
              <input id="confirm-password" className="profile-input" type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>

            {passwordError && <p className="profile-error">{passwordError}</p>}
            {passwordMessage && <p className="profile-success">{passwordMessage}</p>}

            <div className="profile-actions">
              <button type="submit" className="profile-btn profile-btn-primary" disabled={changingPassword}>
                <i className={changingPassword ? 'spinner' : 'shield-halved'}></i>
                {changingPassword ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </UserLayout>
  );
}