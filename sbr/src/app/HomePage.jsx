/* ============================================================
   src/app/HomePage.jsx
   Landing page — hero, features, featured rooms, CTA, footer.
   Pinapakita ang mga available rooms mula sa Supabase.
   ============================================================ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../supabase.js";

export default function HomePage() {
  const [rooms, setRooms]     = useState([]);
  const [loading, setLoading] = useState(true);

  /* -------- Load featured rooms (available only, max 4) -------- */
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("rooms")
          .select("*")
          .eq("status", "available")
          .order("price", { ascending: false })
          .limit(4);

        if (error) throw error;
        setRooms(data || []);
      } catch (e) {
        console.error("HOMEPAGE ROOMS ERROR:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      {/* ============ NAVIGATION ============ */}
      <nav className="nav">
        <div className="brand">
          <span className="brand-icon">🏖️</span>
          <span>Smart Beach Resort</span>
        </div>
        <div className="row" style={{ marginLeft: "auto" }}>
          <Link to="/login">Login</Link>
          <Link to="/register">
            <button className="neu-button primary" style={{ padding: "8px 18px", fontSize: 13 }}>
              Get Started
            </button>
          </Link>
        </div>
      </nav>

      <div className="page-pad">
        {/* ============ HERO ============ */}
        <section className="hero">
          <div className="hero-content">
            <span className="hero-emoji">🌴</span>
            <h1>Welcome to Smart Beach Resort</h1>
            <p>
              Book your dream beach getaway in seconds. Pay online, tap your phone
              to check in with NFC, and enjoy a seamless stay — all in one app.
            </p>

            <div className="hero-actions">
              <Link to="/register">
                <button className="neu-button primary" style={{ padding: "14px 32px" }}>
                  🚀 Get Started Free
                </button>
              </Link>
              <Link to="/login">
                <button className="neu-button" style={{ padding: "14px 32px" }}>
                  I have an account
                </button>
              </Link>
            </div>
          </div>
        </section>

        {/* ============ FEATURES ============ */}
        <div className="section-title">
          <h2>Why Choose Smart Beach Resort?</h2>
          <p>Modern features built for a hassle-free beach vacation</p>
        </div>

        <div className="feature-grid">
          <Feature
            icon="📶"
            title="NFC Check-In"
            text="Tap your phone sa room NFC reader para mabilisang check-in. Walang pila, walang hassle."
          />
          <Feature
            icon="💳"
            title="Secure Payments"
            text="Bayaran ang booking online gamit ang GCash, card, o kahit anong method — safe at secure."
          />
          <Feature
            icon="🌊"
            title="Beachfront Rooms"
            text="Pumili mula sa Standard, Deluxe, Suite, o Beachfront rooms — lahat may magandang view."
          />
          <Feature
            icon="🔒"
            title="Smart Check-Out"
            text="Pag-check-out mo, awtomatikong na-invalidate ang lumang NFC code para sa seguridad."
          />
          <Feature
            icon="👥"
            title="User Friendly"
            text="Simple dashboard para sa users, staff, at admin. Lahat ng kailangan mo, isang click lang."
          />
          <Feature
            icon="⚡"
            title="Real-Time Updates"
            text="Agad-agad na nakikita ang room availability at booking status — walang delay."
          />
        </div>

        {/* ============ FEATURED ROOMS ============ */}
        <div className="section-title">
          <h2>Featured Rooms</h2>
          <p>Pinaka-prestigious at premium rooms namin — book agad!</p>
        </div>

        {loading && (
          <div className="neu-card center">
            <p className="muted">Loading rooms…</p>
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="neu-card center">
            <p className="muted">
              Walang available rooms sa ngayon. Balik ka mamaya!
            </p>
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="room-grid">
            {rooms.map((r) => (
              <div key={r.id} className="room-card">
                <span className="room-badge">Available</span>
                <p className="room-type">{r.room_type}</p>
                <p className="room-number">#{r.room_number}</p>
                <p className="room-price">
                  ₱{Number(r.price).toLocaleString()}
                  <span> / night</span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* ============ CTA SECTION ============ */}
        <section className="cta-section">
          <h2>Ready for your beach escape? 🌊</h2>
          <p>Create a free account and book your room in under a minute.</p>
          <Link to="/register">
            <button className="neu-button" style={{ padding: "14px 32px" }}>
              Create Free Account
            </button>
          </Link>
        </section>

        {/* ============ FOOTER ============ */}
        <footer className="footer">
          <p>© {new Date().getFullYear()} Smart Beach Resort · Built with React + Supabase</p>
          <p className="muted" style={{ marginTop: 6 }}>
            Capstone Project · All rights reserved
          </p>
        </footer>
      </div>
    </>
  );
}

/* -------- Feature card component -------- */
function Feature({ icon, title, text }) {
  return (
    <div className="feature-card">
      <span className="feature-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}