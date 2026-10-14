// Imports — React hooks, Supabase, encryption helpers, and layout wrapper
import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import { encrypt, decrypt } from '../../encryption.js';
import UserLayout from './UserLayout.jsx';

// UserProfile — renders two forms: one for personal info, one for password
export default function UserProfile() {

  // --- Profile state — full name, email, and phone ---
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' });

  // --- Password state — new password and confirm password ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // --- Feedback state — split per form (profile vs password) ---
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // --- Loading states — initial load, saving profile, changing password ---
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  // loadProfile — loads the user's profile and decrypts the phone number
  // Returns early if there's no active session (no redirect needed)
  async function loadProfile() {
    setLoading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', auth.user.id)
        .single();

      if (error) throw error;

      // Decrypt phone if it exists
      setProfile({
        full_name: data.full_name || '',
        email: data.email || auth.user.email || '',
        phone: data.phone ? decrypt(data.phone) : ''
      });
    } catch (error) {
      console.error('Failed to load profile:', error);
      setProfileError('Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  }

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  // handleSaveProfile — saves name and encrypted phone to Supabase
  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setSavingProfile(true);

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) throw new Error('No active session. Please log in again.');

      // Encrypt phone before saving
      const updatePayload = {
        full_name: profile.full_name.trim(),
        phone: profile.phone ? encrypt(profile.phone.trim()) : null
      };

      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', auth.user.id);

      if (error) throw error;

      setProfileMessage('Profile updated successfully.');
    } catch (error) {
      setProfileError(error.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  // handleChangePassword — updates password via Supabase Auth
  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMessage('');

    // Client-side validation
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

      setPasswordMessage('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      setPasswordError(error.message || 'Failed to update password.');
    } finally {
      setChangingPassword(false);
    }
  }

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <UserLayout>

      {/* Welcome header */}
      <div className="profile-welcome">
        <h1>My Profile</h1>
        <p>Update your personal information and change your password.</p>
      </div>

      <div className="profile-grid">

        {/* ============================================================
            PERSONAL INFO PANEL
            ============================================================ */}
        <div className="profile-panel">
          <div className="profile-panel-header">
            <h3 className="profile-panel-title">
              <i className="circle-user"></i> Personal Information
            </h3>
          </div>

          <form onSubmit={handleSaveProfile}>

            {/* Full name field */}
            <div className="profile-field">
              <label htmlFor="full-name">
                <i className="user"></i> Full Name
              </label>
              <input
                id="full-name"
                className="profile-input"
                placeholder="Juan Dela Cruz"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                disabled={loading}
                required
              />
            </div>

            {/* Email field (read-only) */}
            <div className="profile-field">
              <label htmlFor="email">
                <i className="envelope"></i> Email
              </label>
              <input
                id="email"
                className="profile-input"
                value={profile.email || ''}
                disabled
              />
              <p className="profile-hint">Email cannot be changed.</p>
            </div>

            {/* Phone field */}
            <div className="profile-field">
              <label htmlFor="phone">
                <i className="phone"></i> Phone
              </label>
              <input
                id="phone"
                className="profile-input"
                placeholder="0912 345 6789"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                disabled={loading}
              />
            </div>

            {/* Feedback messages */}
            {profileError && <p className="profile-error">{profileError}</p>}
            {profileMessage && <p className="profile-success">{profileMessage}</p>}

            {/* Save button */}
            <div className="profile-actions">
              <button type="submit" className="profile-btn profile-btn-primary" disabled={savingProfile || loading}>
                <i className={savingProfile ? 'spinner' : 'floppy-disk'}></i>
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* ============================================================
            CHANGE PASSWORD PANEL
            ============================================================ */}
        <div className="profile-panel">
          <div className="profile-panel-header">
            <h3 className="profile-panel-title">
              <i className="key"></i> Change Password
            </h3>
          </div>

          <form onSubmit={handleChangePassword}>

            {/* New password field */}
            <div className="profile-field">
              <label htmlFor="new-password">
                <i className="lock"></i> New Password
              </label>
              <input
                id="new-password"
                className="profile-input"
                type="password"
                placeholder="Min 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {/* Confirm password field */}
            <div className="profile-field">
              <label htmlFor="confirm-password">
                <i className="lock"></i> Confirm Password
              </label>
              <input
                id="confirm-password"
                className="profile-input"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {/* Feedback messages */}
            {passwordError && <p className="profile-error">{passwordError}</p>}
            {passwordMessage && <p className="profile-success">{passwordMessage}</p>}

            {/* Update button */}
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