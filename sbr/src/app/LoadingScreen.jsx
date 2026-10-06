/* ============================================================
   src/app/LoadingScreen.jsx
   Loading screen na may SBR logo + ocean wave animation.
   Walang title — nasa logo na ang pangalan.
   ============================================================ */

export default function LoadingScreen({ message = 'Loading...' }) {
  return (
    <div className="loading-screen">
      {/* Animated ocean waves sa ilalim */}
      <div className="loading-waves">
        <div className="wave wave-1"></div>
        <div className="wave wave-2"></div>
        <div className="wave wave-3"></div>
      </div>

      {/* Logo + dots + message */}
      <div className="loading-content">
        <div className="loading-logo-wrap">
          <img
            src="/sbr-logo.png"
            alt="Smart Beach Resort"
            className="loading-logo"
          />
        </div>

        <p className="loading-subtitle">Your beach escape awaits 🌊</p>

        {/* Animated dots */}
        <div className="loading-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>

        {message && <p className="loading-message">{message}</p>}
      </div>
    </div>
  );
}