import { Link } from 'react-router-dom';
import AppLayout from './AppLayout.jsx';

export default function HomePage() {
  return (
    <AppLayout>
      <div className="home-hero">
        <div className="home-hero-inner">
          <div className="home-icon">
            <i className="fa-solid fa-umbrella-beach"></i>
          </div>

          <h1>Smart Beach Resort</h1>
          <p className="home-subtitle">
            Book rooms, manage reservations, and enjoy a seamless beachside stay.
          </p>

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