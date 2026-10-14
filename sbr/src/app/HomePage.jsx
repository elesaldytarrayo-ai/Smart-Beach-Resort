// Imports — routing link and layout wrapper
import { Link } from 'react-router-dom';
import AppLayout from './AppLayout.jsx';

// HomePage — landing page with hero section and buttons
export default function HomePage() {
  return (
    <AppLayout>
      <div className="homepage">
        <div className="page-inner">

          {/* Brand icon */}
          <div className="page-icon">
            <i className="umbrella"></i>
          </div>

          {/* Title and subtitle */}
          <h1>Smart Beach Resort</h1>
          <p className="page-subtitle">
            Book rooms, manage reservations, and enjoy a seamless beachside stay.
          </p>

          {/* Buttons */}
          <div className="page-actions">
            <Link to="/login" className="home-btn page-btn-primary">
              <i className="sign-in"></i>
              Sign In
            </Link>
            <Link to="/register" className="home-btn page-btn-secondary">
              <i className="register"></i>
              Create Account
            </Link>
          </div>

        </div>
      </div>
    </AppLayout>
  );
}