/* ============================================================
   src/app/staff/StaffLayout.jsx
   Staff sidebar + topbar.
   Icons: fa-bell-concierge (front desk theme).
   ============================================================ */

import { useEffect, useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../supabase.js';

export default function StaffLayout({ children }) {
  const nav = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState({ bookings: [], rooms: [] });
  const [searchOpen, setSearchOpen] = useState(false);

  const [notifications, setNotifications] = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const searchRef = useRef(null);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const READ_KEY = 'sbr:staff-notif-read';

  /* Load staff profile */
  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from('profiles').select('*').eq('id', auth.user.id).single();
      setProfile(data);
    })();
  }, []);

  /* Notifications — recent bookings (staff scope) */
  async function loadNotifications() {
    try {
      const { data } = await supabase
        .from('bookings')
        .select('id, status, payment_status, total_amount, check_in, created_at, profiles(full_name), rooms(room_number)')
        .order('created_at', { ascending: false })
        .limit(10);

      const notifs = (data || []).map((b) => ({
        id: `bk-${b.id}`,
        icon: b.status === 'pending' ? 'fa-calendar-plus' :
              b.status === 'confirmed' ? 'fa-calendar-check' :
              b.status === 'checked_out' ? 'fa-door-open' :
              'fa-calendar',
        title: `Room ${b.rooms?.room_number || '—'} — ${b.status}`,
        message: `${b.profiles?.full_name || 'Guest'} · ₱${Number(b.total_amount || 0).toLocaleString()}`,
        time: b.created_at,
        link: '/staff/reservations'
      }));

      setNotifications(notifs);
    } catch (e) {
      console.error('Load notifications error:', e);
    }
  }

  useEffect(() => {
    loadNotifications();
    const t = setInterval(loadNotifications, 15000);
    return () => clearInterval(t);
  }, []);

  function getReadIds() {
    try { return JSON.parse(localStorage.getItem(READ_KEY) || '[]'); }
    catch { return []; }
  }

  function markAllRead() {
    const ids = notifications.map((n) => n.id);
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
    setUnreadCount(0);
  }

  useEffect(() => {
    const read = getReadIds();
    const unread = notifications.filter((n) => !read.includes(n.id));
    setUnreadCount(unread.length);
  }, [notifications]);

  /* Search — bookings + rooms (staff scope) */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ bookings: [], rooms: [] });
      return;
    }

    const q = searchQuery.trim().toLowerCase();
    const timer = setTimeout(async () => {
      try {
        const [bookingsRes, roomsRes] = await Promise.all([
          supabase.from('bookings')
            .select('id, status, check_in, check_out, total_amount, profiles(full_name,email), rooms(room_number)')
            .order('created_at', { ascending: false })
            .limit(50),
          supabase.from('rooms').select('id, room_number, room_type, price, status').limit(50)
        ]);

        const bookings = (bookingsRes.data || []).filter((b) =>
          `${b.profiles?.full_name || ''} ${b.profiles?.email || ''} ${b.rooms?.room_number || ''}`
            .toLowerCase().includes(q)
        ).slice(0, 5);

        const rooms = (roomsRes.data || []).filter((r) =>
          `${r.room_number} ${r.room_type}`.toLowerCase().includes(q)
        ).slice(0, 4);

        setSearchResults({ bookings, rooms });
      } catch (e) {
        console.error('Search error:', e);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const hasSearchResults = searchResults.bookings.length > 0 || searchResults.rooms.length > 0;

  /* Click outside */
  useEffect(() => {
    function handleClick(e) {
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setUserMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    nav('/login');
  }

  function goTo(path) {
    setSearchOpen(false);
    setSearchQuery('');
    nav(path);
  }

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

  const initial = (profile?.full_name || 'S').charAt(0).toUpperCase();
  const firstName = profile?.full_name?.split(' ')[0] || 'Staff';

  /* STAFF MENU — Front desk icons */
  const menu = [
    { icon: 'fa-gauge-high',       label: 'Dashboard',    to: '/staff' },
    { icon: 'fa-calendar-check',   label: 'Reservations', to: '/staff/reservations' }
  ];

  const isActive = (path) => {
    if (path === '/staff') return location.pathname === '/staff';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="admin-layout">
      {/* ============ SIDEBAR ============ */}
      <aside className="admin-sidebar">
        <div className="admin-logo">
          <div className="admin-logo-icon">
            <i className="fa-solid fa-bell-concierge"></i>
          </div>
          <div className="admin-logo-text">
            <div className="admin-logo-title">SBR</div>
            <div className="admin-logo-subtitle">Front Desk</div>
          </div>
        </div>

        <div className="admin-user-card">
          <div className="admin-user-avatar">{initial}</div>
          <div className="admin-user-info">
            <div className="admin-user-name">{firstName}</div>
            <div className="admin-user-role">Staff</div>
          </div>
        </div>

        <nav className="admin-nav">
          {menu.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className={`admin-nav-item ${isActive(item.to) ? 'active' : ''}`}
            >
              <span className="admin-nav-icon">
                <i className={`fa-solid ${item.icon}`}></i>
              </span>
              <span className="admin-nav-label">{item.label}</span>
            </Link>
          ))}

          <div className="admin-nav-divider" />

          <button
            className="admin-nav-item"
            onClick={logout}
            style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', cursor: 'pointer' }}
          >
            <span className="admin-nav-icon">
              <i className="fa-solid fa-right-from-bracket"></i>
            </span>
            <span className="admin-nav-label">Sign Out</span>
          </button>
        </nav>
      </aside>

      {/* ============ MAIN ============ */}
      <div className="admin-main">
        <div className="admin-topbar">
          {/* SEARCH */}
          <div className="admin-search" ref={searchRef} style={{ position: 'relative' }}>
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Search reservations or rooms..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
            />

            {searchOpen && searchQuery.trim() && (
              <div className="admin-search-dropdown">
                {!hasSearchResults && (
                  <div className="admin-search-empty">No results for "{searchQuery}"</div>
                )}

                {searchResults.bookings.length > 0 && (
                  <div className="admin-search-group">
                    <div className="admin-search-group-title">
                      <i className="fa-solid fa-calendar-check"></i> Reservations
                    </div>
                    {searchResults.bookings.map((b) => (
                      <button key={b.id} className="admin-search-item"
                        onClick={() => goTo('/staff/reservations')}>
                        <div>
                          <strong>{b.profiles?.full_name || 'Guest'}</strong>
                          <div className="admin-search-item-sub">
                            Room {b.rooms?.room_number} · {b.status}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {searchResults.rooms.length > 0 && (
                  <div className="admin-search-group">
                    <div className="admin-search-group-title">
                      <i className="fa-solid fa-bed"></i> Rooms
                    </div>
                    {searchResults.rooms.map((r) => (
                      <button key={r.id} className="admin-search-item"
                        onClick={() => goTo('/staff')}>
                        <div>
                          <strong>Room {r.room_number}</strong>
                          <div className="admin-search-item-sub">
                            {r.room_type} · {r.status}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="admin-topbar-actions">
            {/* NOTIFICATIONS */}
            <div ref={notifRef} style={{ position: 'relative' }}>
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
                <div className="admin-notif-dropdown">
                  <div className="admin-dropdown-header">
                    <strong>Notifications</strong>
                    {notifications.length > 0 && (
                      <button className="admin-dropdown-link" onClick={markAllRead}>
                        Mark all read
                      </button>
                    )}
                  </div>

                  {notifications.length === 0 && (
                    <div className="admin-dropdown-empty">
                      Wala pang notifications.
                    </div>
                  )}

                  {notifications.length > 0 && (
                    <div className="admin-notif-list">
                      {notifications.map((n) => {
                        const read = getReadIds().includes(n.id);
                        return (
                          <button
                            key={n.id}
                            className={`admin-notif-item ${read ? 'read' : 'unread'}`}
                            onClick={() => { setNotifOpen(false); nav(n.link); }}
                          >
                            <span className="admin-notif-icon">
                              <i className={`fa-solid ${n.icon}`}></i>
                            </span>
                            <div className="admin-notif-content">
                              <div className="admin-notif-title">{n.title}</div>
                              <div className="admin-notif-message">{n.message}</div>
                              <div className="admin-notif-time">{relativeTime(n.time)}</div>
                            </div>
                            {!read && <span className="admin-notif-dot" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="admin-dropdown-footer">
                    <button
                      className="admin-dropdown-link"
                      onClick={() => { setNotifOpen(false); nav('/staff/reservations'); }}
                    >
                      View all reservations →
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* USER MENU */}
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <div
                className="admin-topbar-user"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="admin-topbar-avatar">{initial}</div>
                <span className="admin-topbar-name">{firstName}</span>
                <i className="fa-solid fa-chevron-down" style={{ fontSize: 11, color: '#6b7f95' }}></i>
              </div>

              {userMenuOpen && (
                <div className="admin-user-dropdown">
                  <div className="admin-user-dropdown-header">
                    <div className="admin-topbar-avatar" style={{ width: 44, height: 44, fontSize: 18 }}>
                      {initial}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>
                        {profile?.full_name || 'Staff'}
                      </div>
                      <div className="muted" style={{ fontSize: 12 }}>
                        {profile?.email}
                      </div>
                    </div>
                  </div>

                  <div className="admin-user-dropdown-divider" />

                  <button
                    className="admin-user-dropdown-item"
                    onClick={() => { setUserMenuOpen(false); nav('/staff'); }}
                  >
                    <i className="fa-solid fa-gauge-high"></i>
                    <span>Dashboard</span>
                  </button>
                  <button
                    className="admin-user-dropdown-item"
                    onClick={() => { setUserMenuOpen(false); nav('/staff/reservations'); }}
                  >
                    <i className="fa-solid fa-calendar-check"></i>
                    <span>Reservations</span>
                  </button>

                  <div className="admin-user-dropdown-divider" />

                  <button className="admin-user-dropdown-item danger" onClick={logout}>
                    <i className="fa-solid fa-right-from-bracket"></i>
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="admin-content">
          {children}
        </div>
      </div>
    </div>
  );
}