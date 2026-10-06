/* ============================================================
   src/App.jsx
   Main router — maps URL paths to page components.
   Protected() checks the logged-in user's role before rendering.
   May loading screen sa initial load at habang nag-check ng auth.
   ============================================================ */

import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from './supabase.js';
import LoadingScreen from './app/LoadingScreen.jsx';

// Public pages
import HomePage       from './app/HomePage.jsx';
import Login          from './app/Login.jsx';
import Register       from './app/Register.jsx';
import ForgotPassword from './app/ForgotPassword.jsx';

// User pages
import User        from './app/user/User.jsx';
import UserBooking from './app/user/UserBooking.jsx';
import UserProfile from './app/user/UserProfile.jsx';

// Admin pages — nasa admin/ folder
import Admin         from './app/admin/Admin.jsx';
import AdminRooms    from './app/admin/AdminRooms.jsx';
import AdminUsers    from './app/admin/AdminUsers.jsx';
import AdminStaff    from './app/admin/AdminStaff.jsx';
import AdminBookings from './app/admin/AdminBookings.jsx';
import AdminPayments from './app/admin/AdminPayments.jsx';

// Staff pages
import Staff             from './app/staff/Staff.jsx';
import StaffReservations from './app/staff/StaffReservations.jsx';

/* ------------------------------------------------------------
   Protected — only renders children if user's role matches.
   ------------------------------------------------------------ */
function Protected({ role, children }) {
  const [state, setState] = useState({ loading: true, allowed: false });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return setState({ loading: false, allowed: false });

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();

      const userRole = profile?.role || 'user';
      setState({ loading: false, allowed: userRole === role });
    })();
  }, [role]);

  if (state.loading) {
    return <LoadingScreen message="Checking your access…" />;
  }
  return state.allowed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  // ⭐ Show loading screen habang nag-i-initialize ang app
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    // Simulate initial boot (fonts, session check, etc.)
    const timer = setTimeout(() => setAppReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!appReady) {
    return <LoadingScreen message="Preparing your beach escape…" />;
  }

  return (
    <Routes>
      {/* Public */}
      <Route path="/"element={<HomePage />} />
      <Route path="/login"element={<Login />} />
      <Route path="/register"element={<Register />} />
      <Route path="/forgot"element={<ForgotPassword />} />

      {/* User */}
      <Route path="/user"element={<Protected role="user"><User /></Protected>} />
      <Route path="/user/booking"element={<Protected role="user"><UserBooking /></Protected>} />
      <Route path="/user/profile"element={<Protected role="user"><UserProfile /></Protected>} />

      {/* Admin */}
      <Route path="/admin"element={<Protected role="admin"><Admin /></Protected>} />
      <Route path="/admin/rooms"element={<Protected role="admin"><AdminRooms /></Protected>} />
      <Route path="/admin/users"element={<Protected role="admin"><AdminUsers /></Protected>} />
      <Route path="/admin/staff"element={<Protected role="admin"><AdminStaff /></Protected>} />
      <Route path="/admin/bookings"element={<Protected role="admin"><AdminBookings /></Protected>} />
      <Route path="/admin/payments"element={<Protected role="admin"><AdminPayments /></Protected>} />

      {/* Staff */}
      <Route path="/staff"element={<Protected role="staff"><Staff /></Protected>} />
      <Route path="/staff/reservations"element={<Protected role="staff"><StaffReservations /></Protected>} />

      {/* Fallback */}
      <Route path="*"element={<Navigate to="/" replace />} />
    </Routes>
  );
}