import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';

// --- Constants ---
const READ_KEY = 'sbr:staff-notif-read';
const NOTIF_POLL_MS = 15000;
const SEARCH_DEBOUNCE_MS = 250;
const MAX_NOTIFICATIONS = 10;
const MAX_SEARCH_RESULTS = 5;

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
// StaffSidebar Component
// Renders the sidebar with navigation links and staff info.
function StaffSidebar({ profile, menu, isActive, onLogout }) {
  const initial = (profile?.full_name || 'S').charAt(0).toUpperCase();
  const firstName = profile?.full_name?.split(' ')[0] || 'Staff';

  return (
    <aside className="admin-sidebar">
      {/* Logo */}
      <div className="admin-logo">
        <div className="admin-logo-icon">
          <i className="fa-solid fa-bell-concierge"></i>
        </div>
        <div className="admin-logo-text">
          <div className="admin-logo-title">SBR</div>
          <div className="admin-logo-subtitle">Front Desk</div>
        </div>
      </div>

      {/* User Card */}
      <div className="admin-user-card">
        <div className="admin-user-avatar">{initial}</div>
        <div className="admin-user-info">
          <div className="admin-user-name">{firstName}</div>
          <div className="admin-user-role">Staff</div>
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

// SearchDropdown Component
// Displays search results for reservations and rooms.
function SearchDropdown({ searchResults, searchQuery, hasSearchResults, onItemClick }) {
  if (!searchQuery.trim()) return null;

  return (
    <div className="admin-search-dropdown">
      {!hasSearchResults && (
        <div className="admin-search-empty">No results for "{searchQuery}"</div>
      )}

      {searchResults.bookings.length > 0 && (
        <div className="admin-search-group">
          <div className="admin-search-group-title">
            <i className="fa-solid fa-calendar-check mr-1"></i> Reservations
          </div>
          {searchResults.bookings.map((booking) => (
            <button
              key={booking.id}
              className="admin-search-item"
              onClick={() => onItemClick('/staff/reservations')}
            >
              <div>
                <strong>{booking.profiles?.full_name || 'Guest'}</strong>
                <div className="admin-search-item-sub">
                  Room {booking.rooms?.room_number} · {booking.status}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {searchResults.rooms.length > 0 && (
        <div className="admin-search-group">
          <div className="admin-search-group-title">
            <i className="fa-solid fa-bed mr-1"></i> Rooms
          </div>
          {searchResults.rooms.map((room) => (
            <button
              key={room.id}
              className="admin-search-item"
              onClick={() => onItemClick('/staff')}
            >
              <div>
                <strong>Room {room.room_number}</strong>
                <div className="admin-search-item-sub">
                  {room.room_type} · {room.status}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// NotificationsDropdown Component
// Displays a list of staff-facing booking notifications.
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
        <button className="admin-dropdown-link" onClick={() => onItemClick('/staff/reservations')}>
          View all reservations →
        </button>
      </div>
    </div>
  );
}

// UserMenuDropdown Component
// Displays the staff profile dropdown menu.
function UserMenuDropdown({ profile, onNavigate, onLogout }) {
  const initial = (profile?.full_name || 'S').charAt(0).toUpperCase();

  return (
    <div className="admin-user-dropdown">
      <div className="admin-user-dropdown-header">
        <div className="admin-topbar-avatar avatar-lg">{initial}</div>
        <div>
          <div className="fw-bold text-sm">{profile?.full_name || 'Staff'}</div>
          <div className="muted text-sm">{profile?.email}</div>
        </div>
      </div>

      <div className="admin-user-dropdown-divider" />

      <button className="admin-user-dropdown-item" onClick={() => onNavigate('/staff')}>
        <i className="fa-solid fa-gauge-high"></i><span>Dashboard</span>
      </button>
      <button className="admin-user-dropdown-item" onClick={() => onNavigate('/staff/reservations')}>
        <i className="fa-solid fa-calendar-check"></i><span>Reservations</span>
      </button>

      <div className="admin-user-dropdown-divider" />

      <button className="admin-user-dropdown-item danger" onClick={onLogout}>
        <i className="fa-solid fa-right-from-bracket"></i><span>Sign Out</span>
      </button>
    </div>
  );
}

// MAIN STAFF LAYOUT COMPONENT
// StaffLayout Component
// The main wrapper for all staff-facing pages. Handles global state
// like notifications, search, and staff profile.
export default function StaffLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // --- State Management ---
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ bookings: [], rooms: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // --- Refs for Click-Outside Detection ---
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const initial = (profile?.full_name || 'S').charAt(0).toUpperCase();
  const firstName = profile?.full_name?.split(' ')[0] || 'Staff';

  // DATA FETCHING
  /** Fetches the current staff member's profile. */
  async function fetchProfile() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase
      .from('profiles').select('*').eq('id', auth.user.id).single();
    setProfile(data);
  }

  /** Fetches and maps notifications from recent bookings (staff scope). */
  async function fetchNotifications() {
    try {
      const { data } = await supabase
        .from('bookings')
        .select('id, status, payment_status, total_amount, check_in, created_at, profiles(full_name), rooms(room_number)')
        .order('created_at', { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      const notifs = (data || []).map((booking) => ({
        id: `bk-${booking.id}`,
        icon: booking.status === 'pending' ? 'fa-calendar-plus' :
              booking.status === 'confirmed' ? 'fa-calendar-check' :
              booking.status === 'checked_out' ? 'fa-door-open' : 'fa-calendar',
        title: `Room ${booking.rooms?.room_number || '—'} — ${booking.status}`,
        message: `${booking.profiles?.full_name || 'Guest'} · ₱${Number(booking.total_amount || 0).toLocaleString()}`,
        time: booking.created_at,
        link: '/staff/reservations'
      }));

      setNotifications(notifs);
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

  /** Performs a debounced search across reservations and rooms (staff scope). */
  async function performSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      setSearchResults({ bookings: [], rooms: [] });
      return;
    }

    try {
      const [bookingsRes, roomsRes] = await Promise.all([
        supabase.from('bookings')
          .select('id, status, check_in, check_out, total_amount, profiles(full_name,email), rooms(room_number)')
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('rooms')
          .select('id, room_number, room_type, price, status')
          .limit(50)
      ]);

      const bookings = (bookingsRes.data || []).filter((b) =>
        `${b.profiles?.full_name || ''} ${b.profiles?.email || ''} ${b.rooms?.room_number || ''}`
          .toLowerCase().includes(q)
      ).slice(0, MAX_SEARCH_RESULTS);

      const rooms = (roomsRes.data || []).filter((r) =>
        `${r.room_number} ${r.room_type}`.toLowerCase().includes(q)
      ).slice(0, MAX_SEARCH_RESULTS);

      setSearchResults({ bookings, rooms });
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
  /** Signs the staff member out and redirects to login. */
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
    { icon: 'fa-gauge-high',     label: 'Dashboard',    to: '/staff' },
    { icon: 'fa-calendar-check', label: 'Reservations', to: '/staff/reservations' }
  ];

  const isActive = (path) => path === '/staff'
    ? location.pathname === '/staff'
    : location.pathname.startsWith(path);

  const hasSearchResults = searchResults.bookings.length > 0 || searchResults.rooms.length > 0;

  return (
    <div className="admin-layout">
      <StaffSidebar profile={profile} menu={menu} isActive={isActive} onLogout={handleLogout} />

      <div className="admin-main">
        <div className="admin-topbar">

          {/*SEARCH*/}
          <div className="admin-search position-relative" ref={searchRef}>
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Search reservations or rooms..."
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