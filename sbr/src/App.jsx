import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';

// Public pages
import HomePage from './app/HomePage.jsx';
import Login from './app/Login.jsx';
import Register from './app/Register.jsx';
import ForgotPassword from './app/ForgotPassword.jsx';
import ResetPassword from './app/ResetPassword.jsx';

// User pages
import User from './app/user/User.jsx';
import UserBooking from './app/user/UserBooking.jsx';
import UserProfile from './app/user/UserProfile.jsx';

// Staff pages
import Staff from './app/staff/Staff.jsx';
import StaffReservations from './app/staff/StaffReservations.jsx';

// Admin pages
import Admin from './app/admin/Admin.jsx';
import AdminRooms from './app/admin/AdminRooms.jsx';
import AdminUsers from './app/admin/AdminUsers.jsx';
import AdminStaff from './app/admin/AdminStaff.jsx';
import AdminBookings from './app/admin/AdminBookings.jsx';
import AdminPayments from './app/admin/AdminPayments.jsx';
import AdminNfc from './app/admin/AdminNfc.jsx';
import AdminSettings from './app/admin/AdminSettings.jsx';

// Protected — check auth + role
function Protected({ role, children }) {
  const [state, setState] = useState({ loading: true, allowed: false });

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return setState({ loading: false, allowed: false });

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      const userRole = profile?.role || 'user';
      setState({ loading: false, allowed: userRole === role });
    })();
  }, [role]);

  // Loading screen habang nagche-check
  if (state.loading) {
    return (
      <main className="loading-screen">
        <i className="spinner"></i>
        <h2>Checking your access…</h2>
        <p>Just a moment while we verify your account.</p>
      </main>
    );
  }

  return state.allowed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* User */}
      <Route path="/user" element={<Protected role="user"><User /></Protected>} />
      <Route path="/user/booking" element={<Protected role="user"><UserBooking /></Protected>} />
      <Route path="/user/profile" element={<Protected role="user"><UserProfile /></Protected>} />

      {/* Staff */}
      <Route path="/staff" element={<Protected role="staff"><Staff /></Protected>} />
      <Route path="/staff/reservations" element={<Protected role="staff"><StaffReservations /></Protected>} />

      {/* Admin */}
      <Route path="/admin" element={<Protected role="admin"><Admin /></Protected>} />
      <Route path="/admin/rooms" element={<Protected role="admin"><AdminRooms /></Protected>} />
      <Route path="/admin/users" element={<Protected role="admin"><AdminUsers /></Protected>} />
      <Route path="/admin/staff" element={<Protected role="admin"><AdminStaff /></Protected>} />
      <Route path="/admin/bookings" element={<Protected role="admin"><AdminBookings /></Protected>} />
      <Route path="/admin/payments" element={<Protected role="admin"><AdminPayments /></Protected>} />
      <Route path="/admin/nfc" element={<Protected role="admin"><AdminNfc /></Protected>} />
      <Route path="/admin/settings" element={<Protected role="admin"><AdminSettings /></Protected>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}