import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';

// --- Constants ---
const READ_KEY = 'sbr:admin-notif-read';
const NOTIF_POLL_MS = 15000;
const SEARCH_DEBOUNCE_MS = 250;
const MAX_NOTIFICATIONS = 10;
const MAX_SEARCH_RESULTS = 4;
const FETCH_LIMIT = 50;

// UTILITY HELPERS
// Formats a date string into a relative time string (e.g., "5m ago").
function relativeTime(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(date).toLocaleDateString();
}

// Retrieves the list of read notification IDs from localStorage.
function getReadIds() {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); }
  catch { return []; }
}

// Saves the list of read notification IDs to localStorage.
function saveReadIds(ids) {
  localStorage.setItem(READ_KEY, JSON.stringify(ids));
}

// SUB-COMPONENTS
// AdminSidebar Component
// Renders the sidebar with navigation links and admin info.
function AdminSidebar({ profile, menu, isActive, onLogout }) {
  const initial = (profile?.full_name || 'A').charAt(0).toUpperCase();
  const firstName = profile?.full_name?.split(' ')[0] || 'Admin';

  return (
    <aside className="admin-sidebar">
      {/* Logo */}
      <div className="admin-logo">
        <div className="admin-logo-icon">
          <i className="fa-solid fa-umbrella-beach"></i>
        </div>
        <div className="admin-logo-text">
          <div className="admin-logo-title">SBR</div>
          <div className="admin-logo-subtitle">Smart Beach Resort</div>
        </div>
      </div>

      {/* User Card */}
      <div className="admin-user-card">
        <div className="admin-user-avatar">{initial}</div>
        <div className="admin-user-info">
          <div className="admin-user-name">{firstName}</div>
          <div className="admin-user-role">Admin</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="admin-nav">
        {menu.map((item) => (
          <Link
            key={item.label}
            to={item.to}
            className={`admin-nav-item ${isActive(item.to) ? 'active' : ''}`}
          >
            <span className="admin-nav-icon"><i className={`fa-solid ${item.icon}`}></i></span>
            <span className="admin-nav-label">{item.label}</span>
          </Link>
        ))}

        <div className="admin-nav-divider" />

        {/* Logout */}
        <button
          className="admin-nav-item bg-transparent border-none w-full text-left cursor-pointer"
          onClick={onLogout}
        >
          <span className="admin-nav-icon"><i className="fa-solid fa-right-from-bracket"></i></span>
          <span className="admin-nav-label">Sign Out</span>
        </button>
      </nav>
    </aside>
  );
}

// SearchGroup Component
// Renders a single group of search results (Rooms, Users, Bookings, Payments).
function SearchGroup({ icon, title, items, renderItem, onItemClick, targetPath }) {
  if (items.length === 0) return null;

  return (
    <div className="admin-search-group">
      <div className="admin-search-group-title">
        <i className={`fa-solid ${icon}`}></i> {title}
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          className="admin-search-item"
          onClick={() => onItemClick(targetPath)}
        >
          {renderItem(item)}
        </button>
      ))}
    </div>
  );
}

// SearchDropdown Component
// Displays categorized search results for rooms, users, bookings, and payments.
function SearchDropdown({ searchResults, searchQuery, hasSearchResults, onItemClick }) {
  if (!searchQuery.trim()) return null;

  const groups = [
    {
      key: 'rooms',
      icon: 'fa-bed',
      title: 'Rooms',
      items: searchResults.rooms,
      targetPath: '/admin/rooms',
      renderItem: (room) => (
        <div>
          <strong>Room {room.room_number}</strong>
          <div className="admin-search-item-sub">
            {room.room_type} · ₱{Number(room.price).toLocaleString()} · {room.status}
          </div>
        </div>
      )
    },
    {
      key: 'users',
      icon: 'fa-user',
      title: 'Users',
      items: searchResults.users,
      targetPath: '/admin/users',
      renderItem: (user) => (
        <div>
          <strong>{user.full_name || '—'}</strong>
          <div className="admin-search-item-sub">{user.email} · {user.role}</div>
        </div>
      )
    },
    {
      key: 'bookings',
      icon: 'fa-calendar-check',
      title: 'Bookings',
      items: searchResults.bookings,
      targetPath: '/admin/bookings',
      renderItem: (booking) => (
        <div>
          <strong>{booking.profiles?.full_name || 'Guest'}</strong>
          <div className="admin-search-item-sub">
            Room {booking.rooms?.room_number} · {booking.status} · ₱{Number(booking.total_amount).toLocaleString()}
          </div>
        </div>
      )
    },
    {
      key: 'payments',
      icon: 'fa-credit-card',
      title: 'Payments',
      items: searchResults.payments,
      targetPath: '/admin/payments',
      renderItem: (payment) => (
        <div>
          <strong>₱{Number(payment.amount).toLocaleString()}</strong>
          <div className="admin-search-item-sub">
            {payment.bookings?.profiles?.full_name || 'Guest'} · {payment.method} · {payment.status}
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="admin-search-dropdown">
      {!hasSearchResults && (
        <div className="admin-search-empty">No results for "{searchQuery}"</div>
      )}

      {groups.map((group) => (
        <SearchGroup
          key={group.key}
          icon={group.icon}
          title={group.title}
          items={group.items}
          renderItem={group.renderItem}
          onItemClick={onItemClick}
          targetPath={group.targetPath}
        />
      ))}
    </div>
  );
}

// NotificationsDropdown Component
// Displays a list of recent activity notifications.
function NotificationsDropdown({ notifications, onMarkAllRead, onItemClick }) {
  return (
    <div className="admin-notif-dropdown">
      <div className="admin-dropdown-header">
        <strong>Notifications</strong>
        {notifications.length > 0 && (
          <button className="admin-dropdown-link" onClick={onMarkAllRead}>
            Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 && (
        <div className="admin-dropdown-empty">No notifications yet.</div>
      )}

      {notifications.length > 0 && (
        <div className="admin-notif-list">
          {notifications.map((notif) => {
            const isRead = getReadIds().includes(notif.id);
            return (
              <button
                key={notif.id}
                className={`admin-notif-item ${isRead ? 'read' : 'unread'}`}
                onClick={() => onItemClick(notif.link)}
              >
                <span className="admin-notif-icon">
                  <i className={`fa-solid ${notif.icon}`}></i>
                </span>
                <div className="admin-notif-content">
                  <div className="admin-notif-title">{notif.title}</div>
                  <div className="admin-notif-message">{notif.message}</div>
                  <div className="admin-notif-time">{relativeTime(notif.time)}</div>
                </div>
                {!isRead && <span className="admin-notif-dot" />}
              </button>
            );
          })}
        </div>
      )}

      <div className="admin-dropdown-footer">
        <button className="admin-dropdown-link" onClick={() => onItemClick('/admin/bookings')}>
          View all activity →
        </button>
      </div>
    </div>
  );
}

// UserMenuDropdown Component
// Displays the admin profile dropdown menu.
function UserMenuDropdown({ profile, onNavigate, onLogout }) {
  const initial = (profile?.full_name || 'A').charAt(0).toUpperCase();

  const menuItems = [
    { icon: 'fa-gear',       label: 'Settings',     to: '/admin/settings' },
    { icon: 'fa-chart-line', label: 'Dashboard',    to: '/admin' },
    { icon: 'fa-users',      label: 'Manage Users', to: '/admin/users' }
  ];

  return (
    <div className="admin-user-dropdown">
      <div className="admin-user-dropdown-header">
        <div className="admin-topbar-avatar avatar-lg">{initial}</div>
        <div>
          <div className="fw-bold text-sm">{profile?.full_name || 'Admin'}</div>
          <div className="muted text-sm">{profile?.email}</div>
        </div>
      </div>

      <div className="admin-user-dropdown-divider" />

      {menuItems.map((item) => (
        <button
          key={item.label}
          className="admin-user-dropdown-item"
          onClick={() => onNavigate(item.to)}
        >
          <i className={`fa-solid ${item.icon}`}></i>
          <span>{item.label}</span>
        </button>
      ))}

      <div className="admin-user-dropdown-divider" />

      <button className="admin-user-dropdown-item danger" onClick={onLogout}>
        <i className="fa-solid fa-right-from-bracket"></i>
        <span>Sign Out</span>
      </button>
    </div>
  );
}

// MAIN ADMIN LAYOUT COMPONENT
// AdminLayout Component
// The main wrapper for all admin-facing pages. Handles global state
// like notifications, search, and admin profile.
export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // --- State Management ---
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({
    rooms: [], users: [], bookings: [], payments: []
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // --- Refs for Click-Outside Detection ---
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const initial = (profile?.full_name || 'A').charAt(0).toUpperCase();
  const firstName = profile?.full_name?.split(' ')[0] || 'Admin';

  // DATA FETCHING
  /** Fetches the current admin's profile. */
  async function fetchProfile() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase
      .from('profiles').select('*').eq('id', auth.user.id).single();
    setProfile(data);
  }

  // Fetches recent activity from both bookings and payments,
  // merges them into a unified notification list, and sorts by time.
  async function fetchNotifications() {
    try {
      const [bookingsRes, paymentsRes] = await Promise.all([
        supabase
          .from('bookings')
          .select('id, status, payment_status, total_amount, created_at, profiles(full_name), rooms(room_number)')
          .order('created_at', { ascending: false })
          .limit(MAX_NOTIFICATIONS),
        supabase
          .from('payments')
          .select('id, amount, method, status, paid_at, bookings(profiles(full_name))')
          .eq('status', 'paid')
          .order('paid_at', { ascending: false })
          .limit(MAX_NOTIFICATIONS)
      ]);

      const notifs = [];

      (bookingsRes.data || []).forEach((booking) => {
        notifs.push({
          id: `bk-${booking.id}`,
          type: 'booking',
          icon: booking.status === 'pending' ? 'fa-calendar-plus' : 'fa-calendar-check',
          title: `New booking from ${booking.profiles?.full_name || 'Guest'}`,
          message: `Room ${booking.rooms?.room_number || '—'} · ₱${Number(booking.total_amount || 0).toLocaleString()}`,
          time: booking.created_at,
          link: '/admin/bookings'
        });
      });

      (paymentsRes.data || []).forEach((payment) => {
        notifs.push({
          id: `pay-${payment.id}`,
          type: 'payment',
          icon: 'fa-credit-card',
          title: `Payment from ${payment.bookings?.profiles?.full_name || 'Guest'}`,
          message: `₱${Number(payment.amount || 0).toLocaleString()} via ${payment.method || 'paymongo'}`,
          time: payment.paid_at,
          link: '/admin/payments'
        });
      });

      notifs.sort((a, b) => new Date(b.time) - new Date(a.time));
      setNotifications(notifs.slice(0, MAX_NOTIFICATIONS));
    } catch (err) {
      console.error('Load notifications error:', err);
    }
  }

  /** Marks all notifications as read. */
  function markAllRead() {
    const ids = notifications.map((n) => n.id);
    saveReadIds(ids);
    setUnreadCount(0);
    setNotifications([...notifications]); // Force re-render
  }

  // Performs a debounced search across four categories: rooms, users, 
  // bookings, and payments.
  async function performSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      setSearchResults({ rooms: [], users: [], bookings: [], payments: [] });
      return;
    }

    try {
      const [roomsRes, usersRes, bookingsRes, paymentsRes] = await Promise.all([
        supabase.from('rooms')
          .select('id, room_number, room_type, price, status')
          .limit(FETCH_LIMIT),
        supabase.from('profiles')
          .select('id, full_name, email, role')
          .limit(FETCH_LIMIT),
        supabase.from('bookings')
          .select('id, status, check_in, check_out, total_amount, profiles(full_name,email), rooms(room_number)')
          .order('created_at', { ascending: false })
          .limit(FETCH_LIMIT),
        supabase.from('payments')
          .select('id, amount, method, status, reference, bookings(profiles(full_name))')
          .order('created_at', { ascending: false })
          .limit(FETCH_LIMIT)
      ]);

      const rooms = (roomsRes.data || []).filter((r) =>
        `${r.room_number} ${r.room_type}`.toLowerCase().includes(q)
      ).slice(0, MAX_SEARCH_RESULTS);

      const users = (usersRes.data || []).filter((u) =>
        `${u.full_name || ''} ${u.email || ''}`.toLowerCase().includes(q)
      ).slice(0, MAX_SEARCH_RESULTS);

      const bookings = (bookingsRes.data || []).filter((b) =>
        `${b.profiles?.full_name || ''} ${b.profiles?.email || ''} ${b.rooms?.room_number || ''} ${b.id}`
          .toLowerCase().includes(q)
      ).slice(0, MAX_SEARCH_RESULTS);

      const payments = (paymentsRes.data || []).filter((p) =>
        `${p.reference || ''} ${p.method || ''} ${p.bookings?.profiles?.full_name || ''} ${p.id}`
          .toLowerCase().includes(q)
      ).slice(0, MAX_SEARCH_RESULTS);

      setSearchResults({ rooms, users, bookings, payments });
    } catch (err) {
      console.error('Search error:', err);
    }
  }

  // EFFECTS
  // Initial Profile Load
  useEffect(() => {
    fetchProfile();
  }, []);

  // Notification Polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, NOTIF_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Update Unread Count
  useEffect(() => {
    const read = getReadIds();
    setUnreadCount(notifications.filter((n) => !read.includes(n.id)).length);
  }, [notifications]);

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click Outside Handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // HANDLERS
  /** Signs the admin out and redirects to login. */
  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  /** Closes search and navigates to a path. */
  function handleNavigate(path) {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(path);
  }

  const menu = [
    { icon: 'fa-chart-line', label: 'Dashboard', to: '/admin' },
    { icon: 'fa-bed', label: 'Rooms', to: '/admin/rooms' },
    { icon: 'fa-users', label: 'Users', to: '/admin/users' },
    { icon: 'fa-user-tie', label: 'Staff', to: '/admin/staff' },
    { icon: 'fa-calendar-check', label: 'Reservations', to: '/admin/bookings' },
    { icon: 'fa-credit-card', label: 'Payments', to: '/admin/payments' },
    { icon: 'fa-satellite-dish', label: 'NFC Management', to: '/admin/nfc' },
    { icon: 'fa-gear', label: 'Settings', to: '/admin/settings' }
  ];

  const isActive = (path) => path === '/admin'
    ? location.pathname === '/admin'
    : location.pathname.startsWith(path);

  const hasSearchResults =
    searchResults.rooms.length > 0 ||
    searchResults.users.length > 0 ||
    searchResults.bookings.length > 0 ||
    searchResults.payments.length > 0;

  return (
    <div className="admin-layout">
      <AdminSidebar profile={profile} menu={menu} isActive={isActive} onLogout={handleLogout} />

      <div className="admin-main">
        <div className="admin-topbar">

          {/*SEARCH*/}
          <div className="admin-search position-relative" ref={searchRef}>
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Search rooms, users, bookings, payments..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && (
              <SearchDropdown
                searchResults={searchResults}
                searchQuery={searchQuery}
                hasSearchResults={hasSearchResults}
                onItemClick={handleNavigate}
              />
            )}
          </div>

          <div className="admin-topbar-actions">

            {/*NOTIFICATIONS*/}
            <div className="position-relative" ref={notifRef}>
              <button
                className="admin-bell"
                onClick={() => {
                  setNotifOpen(!notifOpen);
                  if (!notifOpen) markAllRead();
                }}
                title="Notifications"
              >
                <i className="fa-solid fa-bell"></i>
                {unreadCount > 0 && (
                  <span className="admin-bell-badge">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <NotificationsDropdown
                  notifications={notifications}
                  onMarkAllRead={markAllRead}
                  onItemClick={(link) => { setNotifOpen(false); navigate(link); }}
                />
              )}
            </div>

            {/*USER MENU*/}
            <div className="position-relative" ref={userMenuRef}>
              <div className="admin-topbar-user" onClick={() => setUserMenuOpen(!userMenuOpen)}>
                <div className="admin-topbar-avatar">{initial}</div>
                <span className="admin-topbar-name">{firstName}</span>
                <i className="fa-solid fa-chevron-down text-sm text-muted"></i>
              </div>
              {userMenuOpen && (
                <UserMenuDropdown
                  profile={profile}
                  onNavigate={(path) => { setUserMenuOpen(false); navigate(path); }}
                  onLogout={handleLogout}
                />
              )}
            </div>

          </div>
        </div>

        {/*PAGE CONTENT*/}
        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}