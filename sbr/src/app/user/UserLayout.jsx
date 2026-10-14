// Imports — React hooks, routing, and Supabase client
import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';

// ============================================================
// CONSTANTS
// ============================================================

const READ_KEY = 'sbr:user-notif-read';      // localStorage key for read notifications
const NOTIF_POLL_MS = 15000;                 // Poll notifications every 15 seconds
const SEARCH_DEBOUNCE_MS = 250;              // Debounce search input by 250ms
const MAX_NOTIFICATIONS = 10;                // Max notifications to show
const MAX_SEARCH_RESULTS = 5;                // Max search results per category

// ============================================================
// UTILITY HELPERS
// ============================================================

// relativeTime — formats a date string into a relative time string (e.g., "5m ago")
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

// getReadIds — retrieves the list of read notification IDs from localStorage
function getReadIds() {
  try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); }
  catch { return []; }
}

// saveReadIds — saves the list of read notification IDs to localStorage
function saveReadIds(ids) {
  localStorage.setItem(READ_KEY, JSON.stringify(ids));
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

// UserSidebar — renders the sidebar with navigation links and user info
function UserSidebar({ profile, menu, isActive, onLogout }) {
  const initial = (profile?.full_name || 'U').charAt(0).toUpperCase();
  const firstName = profile?.full_name?.split(' ')[0] || 'Guest';

  return (
    <aside className="admin-sidebar">
      {/* Logo — brand icon and text */}
      <div className="admin-logo">
        <div className="admin-logo-icon">
          <i className="fa-solid fa-umbrella-beach"></i>
        </div>
        <div className="admin-logo-text">
          <div className="admin-logo-title">SBR</div>
          <div className="admin-logo-subtitle">Guest Portal</div>
        </div>
      </div>

      {/* User card — avatar, name, and role */}
      <div className="admin-user-card">
        <div className="admin-user-avatar">{initial}</div>
        <div className="admin-user-info">
          <div className="admin-user-name">{firstName}</div>
          <div className="admin-user-role">Guest</div>
        </div>
      </div>

      {/* Navigation — menu links and sign out button */}
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

        {/* Sign out button */}
        <button className="admin-nav-item bg-transparent border-none w-full text-left cursor-pointer" onClick={onLogout}>
          <span className="admin-nav-icon"><i className="fa-solid fa-right-from-bracket"></i></span>
          <span className="admin-nav-label">Sign Out</span>
        </button>
      </nav>
    </aside>
  );
}

// SearchDropdown — displays search results for bookings and rooms
function SearchDropdown({ searchResults, searchQuery, hasSearchResults, onItemClick }) {
  if (!searchQuery.trim()) return null;

  return (
    <div className="admin-search-dropdown">
      {/* Empty state — no results */}
      {!hasSearchResults && (
        <div className="admin-search-empty">No results for "{searchQuery}"</div>
      )}

      {/* Bookings group */}
      {searchResults.bookings.length > 0 && (
        <div className="admin-search-group">
          <div className="admin-search-group-title"><i className="fa-solid fa-ticket mr-1"></i> My Bookings</div>
          {searchResults.bookings.map((booking) => (
            <button key={booking.id} className="admin-search-item" onClick={() => onItemClick('/user/booking')}>
              <div>
                <strong>Room {booking.rooms?.room_number}</strong>
                <div className="admin-search-item-sub">{booking.check_in} · {booking.status}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Rooms group */}
      {searchResults.rooms.length > 0 && (
        <div className="admin-search-group">
          <div className="admin-search-group-title"><i className="fa-solid fa-bed mr-1"></i> Available Rooms</div>
          {searchResults.rooms.map((room) => (
            <button key={room.id} className="admin-search-item" onClick={() => onItemClick('/user/booking')}>
              <div>
                <strong>Room {room.room_number}</strong>
                <div className="admin-search-item-sub">
                  {room.room_type} · ₱{Number(room.price).toLocaleString()} · {room.status}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// NotificationsDropdown — displays a list of user notifications
function NotificationsDropdown({ notifications, unreadCount, onMarkAllRead, onItemClick }) {
  return (
    <div className="admin-notif-dropdown">
      {/* Header — title and mark all read button */}
      <div className="admin-dropdown-header">
        <strong>My Notifications</strong>
        {notifications.length > 0 && (
          <button className="admin-dropdown-link" onClick={onMarkAllRead}>Mark all read</button>
        )}
      </div>

      {/* Empty state */}
      {notifications.length === 0 && (
        <div className="admin-dropdown-empty">No notifications yet.</div>
      )}

      {/* Notification list */}
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
                <span className="admin-notif-icon"><i className={`fa-solid ${notif.icon}`}></i></span>
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

      {/* Footer — view bookings link */}
      <div className="admin-dropdown-footer">
        <button className="admin-dropdown-link" onClick={() => onItemClick('/user/booking')}>
          View my bookings →
        </button>
      </div>
    </div>
  );
}

// UserMenuDropdown — displays the user profile dropdown menu
function UserMenuDropdown({ profile, onNavigate, onLogout }) {
  const initial = (profile?.full_name || 'U').charAt(0).toUpperCase();

  return (
    <div className="admin-user-dropdown">
      {/* Header — avatar, name, and email */}
      <div className="admin-user-dropdown-header">
        <div className="admin-topbar-avatar avatar-lg">{initial}</div>
        <div>
          <div className="fw-bold text-sm">{profile?.full_name || 'Guest'}</div>
          <div className="muted text-sm">{profile?.email}</div>
        </div>
      </div>

      <div className="admin-user-dropdown-divider" />

      {/* Menu items — dashboard, bookings, profile */}
      <button className="admin-user-dropdown-item" onClick={() => onNavigate('/user')}>
        <i className="fa-solid fa-house"></i><span>Dashboard</span>
      </button>
      <button className="admin-user-dropdown-item" onClick={() => onNavigate('/user/booking')}>
        <i className="fa-solid fa-ticket"></i><span>My Bookings</span>
      </button>
      <button className="admin-user-dropdown-item" onClick={() => onNavigate('/user/profile')}>
        <i className="fa-solid fa-circle-user"></i><span>Profile</span>
      </button>

      <div className="admin-user-dropdown-divider" />

      {/* Sign out */}
      <button className="admin-user-dropdown-item danger" onClick={onLogout}>
        <i className="fa-solid fa-right-from-bracket"></i><span>Sign Out</span>
      </button>
    </div>
  );
}

// ============================================================
// MAIN USER LAYOUT COMPONENT
// ============================================================

// UserLayout — main wrapper for all user-facing pages
// Handles global state like notifications, search, and user profile
export default function UserLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // State — profile, search, notifications, and dropdown toggles
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ bookings: [], rooms: [] });
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Refs — used for click-outside detection on dropdowns
  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const initial = (profile?.full_name || 'U').charAt(0).toUpperCase();
  const firstName = profile?.full_name?.split(' ')[0] || 'Guest';

  // ============================================================
  // DATA FETCHING
  // ============================================================

  // fetchProfile — fetches the current user's profile
  async function fetchProfile() {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
    setProfile(data);
  }

  // fetchNotifications — fetches and maps notifications from the user's bookings
  async function fetchNotifications() {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data } = await supabase
        .from('bookings')
        .select('id, status, payment_status, total_amount, check_in, created_at, rooms(room_number)')
        .eq('user_id', auth.user.id)
        .order('created_at', { ascending: false })
        .limit(MAX_NOTIFICATIONS);

      // Map each booking into a notification object
      const notifs = (data || []).map((booking) => ({
        id: `bk-${booking.id}`,
        icon: booking.payment_status === 'paid' ? 'fa-circle-check' :
              booking.status === 'confirmed' ? 'fa-calendar-check' :
              booking.status === 'checked_out' ? 'fa-door-open' : 'fa-hourglass-half',
        title: `Room ${booking.rooms?.room_number || '—'} — ${booking.status}`,
        message: `₱${Number(booking.total_amount || 0).toLocaleString()} · ${booking.payment_status}`,
        time: booking.created_at,
        link: '/user/booking'
      }));

      setNotifications(notifs);
    } catch (err) {
      console.error('Load notifications error:', err);
    }
  }

  // markAllRead — marks all notifications as read
  function markAllRead() {
    const ids = notifications.map((n) => n.id);
    saveReadIds(ids);
    setUnreadCount(0);
    // Force re-render to update read status in the list
    setNotifications([...notifications]);
  }

  // performSearch — performs a debounced search across bookings and rooms
  async function performSearch(query) {
    const q = query.trim().toLowerCase();
    if (!q) {
      setSearchResults({ bookings: [], rooms: [] });
      return;
    }

    try {
      const { data: auth } = await supabase.auth.getUser();

      // Fetch bookings and rooms in parallel
      const [bookingsRes, roomsRes] = await Promise.all([
        supabase.from('bookings')
          .select('id, status, check_in, check_out, total_amount, rooms(room_number,room_type)')
          .eq('user_id', auth.user.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase.from('rooms')
          .select('id, room_number, room_type, price, status')
          .limit(30)
      ]);

      // Filter bookings by room number or status
      const bookings = (bookingsRes.data || []).filter((b) =>
        `${b.rooms?.room_number || ''} ${b.status || ''}`.toLowerCase().includes(q)
      ).slice(0, MAX_SEARCH_RESULTS);

      // Filter rooms by room number or type
      const rooms = (roomsRes.data || []).filter((r) =>
        `${r.room_number} ${r.room_type}`.toLowerCase().includes(q)
      ).slice(0, MAX_SEARCH_RESULTS);

      setSearchResults({ bookings, rooms });
    } catch (err) {
      console.error('Search error:', err);
    }
  }

  // ============================================================
  // EFFECTS
  // ============================================================

  // Load profile on mount
  useEffect(() => {
    fetchProfile();
  }, []);

  // Poll notifications every NOTIF_POLL_MS
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, NOTIF_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  // Update unread count whenever notifications change
  useEffect(() => {
    const read = getReadIds();
    setUnreadCount(notifications.filter((n) => !read.includes(n.id)).length);
  }, [notifications]);

  // Debounced search — waits SEARCH_DEBOUNCE_MS before searching
  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside — closes dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(event.target)) setNotifOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ============================================================
  // HANDLERS
  // ============================================================

  // handleLogout — signs the user out and redirects to login
  async function handleLogout() {
    await supabase.auth.signOut();
    navigate('/login');
  }

  // handleNavigate — closes search and navigates to a path
  function handleNavigate(path) {
    setSearchOpen(false);
    setSearchQuery('');
    navigate(path);
  }

  // Sidebar menu items
  const menu = [
    { icon: 'fa-house',       label: 'Dashboard',   to: '/user' },
    { icon: 'fa-ticket',      label: 'My Bookings', to: '/user/booking' },
    { icon: 'fa-circle-user', label: 'Profile',     to: '/user/profile' }
  ];

  // isActive — checks if a menu path is currently active
  const isActive = (path) => path === '/user'
    ? location.pathname === '/user'
    : location.pathname.startsWith(path);

  // hasSearchResults — true if any search results exist
  const hasSearchResults = searchResults.bookings.length > 0 || searchResults.rooms.length > 0;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="admin-layout">

      {/* Sidebar — navigation and user info */}
      <UserSidebar profile={profile} menu={menu} isActive={isActive} onLogout={handleLogout} />

      <div className="admin-main">

        {/* Topbar — search, notifications, and user menu */}
        <div className="admin-topbar">

          {/* Search bar and dropdown */}
          <div className="admin-search position-relative" ref={searchRef}>
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Search my bookings or rooms..."
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

            {/* Notifications bell and dropdown */}
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
                  unreadCount={unreadCount}
                  onMarkAllRead={markAllRead}
                  onItemClick={(link) => { setNotifOpen(false); navigate(link); }}
                />
              )}
            </div>

            {/* User menu — avatar and dropdown */}
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

        {/* Page content — renders the child component */}
        <div className="admin-content">
          {children}
        </div>

      </div>
    </div>
  );
}