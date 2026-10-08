import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import { encrypt, decrypt } from '../../encryption.js';
import UserLayout from './UserLayout.jsx';

// UserProfile Component
// Renders two forms: one for personal info updates and one for password changes.
export default function UserProfile() {
  // Profile State ---
  const [profile, setProfile] = useState({ full_name: '', email: '', phone: '' });
  
  // --- Password State ---
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // --- UI Feedback State (split per form) ---
  const [profileError, setProfileError] = useState('');
  const [profileMessage, setProfileMessage] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');

  // --- Loading States ---
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // DATA FETCHING
  // Loads the current user's profile and decrypts the phone number.
  // Redirects implicitly by returning early if there is no active session.
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

  useEffect(() => {
    loadProfile();
  }, []);

  // FORM HANDLERS
  // Saves the personal information (name and encrypted phone) to Supabase.
  async function handleSaveProfile(e) {
    e.preventDefault();
    setProfileError('');
    setProfileMessage('');
    setSavingProfile(true);

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth?.user) throw new Error('No active session. Please log in again.');

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

  // Updates the user's password via Supabase Auth.
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

  // RENDER
  return (
    <UserLayout>
      <div className="admin-welcome">
        <h1>My Profile</h1>
        <p>Update your personal information and change your password.</p>
      </div>

      <div className="admin-dashboard-grid">
        {/*PERSONAL INFO*/}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-circle-user"></i> Personal Information
            </h3>
          </div>

          <form onSubmit={handleSaveProfile}>
            {/* Full Name */}
            <div className="admin-field">
              <label htmlFor="full-name">
                <i className="fa-solid fa-user"></i> Full Name
              </label>
              <input
                id="full-name"
                className="admin-input"
                placeholder="Juan Dela Cruz"
                value={profile.full_name || ''}
                onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                disabled={loading}
                required
              />
            </div>

            {/* Email (read-only) */}
            <div className="admin-field">
              <label htmlFor="email">
                <i className="fa-solid fa-envelope"></i> Email
              </label>
              <input
                id="email"
                className="admin-input"
                value={profile.email || ''}
                disabled
              />
              <p className="admin-field-hint">Email cannot be changed.</p>
            </div>

            {/* Phone */}
            <div className="admin-field">
              <label htmlFor="phone">
                <i className="fa-solid fa-phone"></i> Phone
              </label>
              <input
                id="phone"
                className="admin-input"
                placeholder="0912 345 6789"
                value={profile.phone || ''}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                disabled={loading}
              />
            </div>

            {/* Feedback */}
            {profileError && <p className="admin-error">{profileError}</p>}
            {profileMessage && <p className="admin-success">{profileMessage}</p>}

            <div className="admin-form-actions">
              <button type="submit" className="app-btn app-btn-primary" disabled={savingProfile || loading}>
                <i className={`fa-solid ${savingProfile ? 'fa-spinner fa-spin' : 'fa-floppy-disk'}`}></i>
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/*CHANGE PASSWORD*/}
        <div className="admin-panel">
          <div className="admin-panel-header">
            <h3 className="admin-panel-title">
              <i className="fa-solid fa-key"></i> Change Password
            </h3>
          </div>

          <form onSubmit={handleChangePassword}>
            {/* New Password */}
            <div className="admin-field">
              <label htmlFor="new-password">
                <i className="fa-solid fa-lock"></i> New Password
              </label>
              <input
                id="new-password"
                className="admin-input"
                type="password"
                placeholder="Min 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {/* Confirm Password */}
            <div className="admin-field">
              <label htmlFor="confirm-password">
                <i className="fa-solid fa-lock"></i> Confirm Password
              </label>
              <input
                id="confirm-password"
                className="admin-input"
                type="password"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>

            {/* Feedback */}
            {passwordError && <p className="admin-error">{passwordError}</p>}
            {passwordMessage && <p className="admin-success">{passwordMessage}</p>}

            <div className="admin-form-actions">
              <button type="submit" className="app-btn app-btn-primary" disabled={changingPassword}>
                <i className={`fa-solid ${changingPassword ? 'fa-spinner fa-spin' : 'fa-shield-halved'}`}></i>
                {changingPassword ? 'Updating…' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </UserLayout>
  );
}