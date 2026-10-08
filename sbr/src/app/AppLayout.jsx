import { useNavigate } from 'react-router-dom';

// Public Navigation
// PublicNav Component
// Renders the top navigation bar with the brand logo, a Login button, 
// and a Get Started button.
export function PublicNav() {
  const navigate = useNavigate();

  // Navigates to a specified path.

  const handleNavigation = (path) => {
    navigate(path);
  };

  return (
    <nav className="pub-nav">
      {/* Brand Logo*/}
      <button
        type="button"
        onClick={() => handleNavigation('/')}
        className="pub-nav-brand brand-btn"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        aria-label="Go to homepage"
      >
        <div className="pub-nav-brand-icon">
          <i className="fa-solid fa-umbrella-beach"></i>
        </div>
        <div className="pub-nav-brand-text">
          <span className="pub-nav-brand-title">Smart Beach</span>
          <span className="pub-nav-brand-sub">RESORT</span>
        </div>
      </button>

      {/*Action Buttons*/}
      <div className="pub-nav-actions">
        {/*Login Button -> /Login*/}
        <button
          type="button"
          onClick={() => handleNavigation('/login')}
          className="pub-nav-btn pub-nav-btn-ghost"
        >
          <i className="fa-solid fa-right-to-bracket"></i>
          <span>Login</span>
        </button>

        {/*Get Started Button -> /register*/}
        <button
          type="button"
          onClick={() => handleNavigation('/register')}
          className="pub-nav-btn pub-nav-btn-primary"
        >
          <i className="fa-solid fa-rocket"></i>
          <span>Get Started</span>
        </button>
      </div>
    </nav>
  );
}

// Public Footer
export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="footer">
      <p>© {currentYear} Smart Beach Resort · IT302</p>
      <p className="muted" style={{ marginTop: 6 }}>
        MCO1 · All rights reserved
      </p>
    </footer>
  );
}

// App Layout Wrapper
export default function AppLayout({ children, nav = true, footer = false }) {
  return (
    <>
      {nav && <PublicNav />}
      <main>{children}</main>
      {footer && <PublicFooter />}
    </>
  );
}