// Imports — routing link and layout wrapper
import { Link } from 'react-router-dom';
import AppLayout from './AppLayout.jsx';

// HomePage — landing page with hero section and navigation buttons
export default function HomePage() {
  return (
    <AppLayout>
      {/* Hero — centered brand icon, title, subtitle, and action buttons */}
      <div className="home-hero">
        <div className="home-hero-inner">

          {/* Brand icon */}
          <div className="home-icon">
            <i className="fa-solid fa-umbrella-beach"></i>
          </div>

          {/* Title and subtitle */}
          <h1>Smart Beach Resort</h1>
          <p className="home-subtitle">
            Book rooms, manage reservations, and enjoy a seamless beachside stay.
          </p>

          {/* Action buttons — Sign In and Create Account */}
          <div className="home-actions">
            <Link to="/login" className="app-btn app-btn-primary">
              <i className="fa-solid fa-right-to-bracket"></i>
              Sign In
            </Link>
            <Link to="/register" className="app-btn app-btn-secondary">
              <i className="fa-solid fa-user-plus"></i>
              Create Account
            </Link>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}