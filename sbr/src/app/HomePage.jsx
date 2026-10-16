/* HomePage — the landing page.
   Shows the brand, a short description, and two action buttons
   for signing in or creating a new account.
*/

import { Link } from 'react-router-dom';
import AppLayout from './AppLayout.jsx';

/* Action buttons shown on the landing page */
const ACTIONS = [
  {
    to: '/login',
    label: 'Sign In',
    icon: 'sign-in',
    variant: 'primary'
  },
  {
    to: '/register',
    label: 'Create Account',
    icon: 'register',
    variant: 'secondary'
  }
];

/* Main component — the landing page */
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

          {/* Action buttons */}
          <div className="page-actions">
            {ACTIONS.map((action) => (
              <Link
                key={action.to}
                to={action.to}
                className={`home-btn page-btn-${action.variant}`}
              >
                <i className={action.icon}></i>
                {action.label}
              </Link>
            ))}
          </div>

        </div>
      </div>
    </AppLayout>
  );
}