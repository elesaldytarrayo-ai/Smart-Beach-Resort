/* ============================================================
   src/app/AppLayout.jsx
   Public layout — brand, nav buttons (Login + Get Started).
   Navigation: useNavigate hook — guaranteed redirect.
   ============================================================ */

import { useNavigate } from 'react-router-dom';

/* ============================================================
   PUBLIC NAV
   ============================================================ */
export function PublicNav() {
  const navigate = useNavigate();

  return (
    <nav className="pub-nav">
      {/* Brand — clickable → home */}
      <button
        type="button"
        onClick={() => navigate('/')}
        className="pub-nav-brand"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <div className="pub-nav-brand-icon">
          <i className="fa-solid fa-umbrella-beach"></i>
        </div>
        <div className="pub-nav-brand-text">
          <span className="pub-nav-brand-title">Smart Beach</span>
          <span className="pub-nav-brand-sub">RESORT</span>
        </div>
      </button>

      {/* Buttons — Login + Get Started */}
      <div className="pub-nav-actions">
        {/* ⭐ Login → /login (Login.jsx) */}
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="pub-nav-btn pub-nav-btn-ghost"
        >
          <i className="fa-solid fa-right-to-bracket"></i>
          <span>Login</span>
        </button>

        {/* ⭐ Get Started → /register (Register.jsx) */}
        <button
          type="button"
          onClick={() => navigate('/register')}
          className="pub-nav-btn pub-nav-btn-primary"
        >
          <i className="fa-solid fa-rocket"></i>
          <span>Get Started</span>
        </button>
      </div>
    </nav>
  );
}

/* ============================================================
   PUBLIC FOOTER
   ============================================================ */
export function PublicFooter() {
  return (
    <footer className="footer">
      <p>© {new Date().getFullYear()} Smart Beach Resort · Built with React + Supabase</p>
      <p className="muted" style={{ marginTop: 6 }}>Capstone Project · All rights reserved</p>
    </footer>
  );
}

/* ============================================================
   APP LAYOUT
   ============================================================ */
export default function AppLayout({ children, nav = true, footer = false }) {
  return (
    <>
      {nav && <PublicNav />}
      {children}
      {footer && <PublicFooter />}
    </>
  );
}