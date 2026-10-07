/* ============================================================
   src/app/HomePage.jsx
   Landing page — Hero + Features + Featured Rooms + Footer.
   Navigation: useNavigate hook — 100% reliable redirect.
   ============================================================ */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout, { PublicFooter } from './AppLayout.jsx';

export default function HomePage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('rooms')
          .select('*')
          .eq('status', 'available')
          .order('price', { ascending: false })
          .limit(4);
        if (error) throw error;
        setRooms(data || []);
      } catch (e) {
        console.error('HOMEPAGE ROOMS ERROR:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <AppLayout nav footer={false}>
      <div className="page-pad">
        {/* ============ HERO ============ */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-icon-wrap">
              <i className="fa-solid fa-umbrella-beach"></i>
            </div>

            <h1>Welcome to Smart Beach Resort</h1>
            <p>
              Book your dream beach getaway in seconds. Pay online, tap your phone
              to check in with NFC, and enjoy a seamless stay — all in one app.
            </p>

            <div className="hero-actions">
              {/* ⭐ Get Started Free → /register */}
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="hero-btn hero-btn-primary"
              >
                <i className="fa-solid fa-rocket"></i>
                <span>Get Started Free</span>
              </button>

              {/* ⭐ I have an account → /login */}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="hero-btn hero-btn-secondary"
              >
                <i className="fa-solid fa-right-to-bracket"></i>
                <span>I have an account</span>
              </button>
            </div>
          </div>
        </section>

        {/* ============ 6 FEATURE BOXES ============ */}
        <div className="section-title" id="features">
          <h2>Why Choose Smart Beach Resort?</h2>
          <p>Modern features built for a hassle-free beach vacation</p>
        </div>

        <div className="feature-grid">
          <Feature color="blue" icon="fa-wifi" title="NFC Check-In"
            text="Tap your phone sa room NFC reader para mabilisang check-in. Walang pila, walang hassle." />
          <Feature color="green" icon="fa-credit-card" title="Secure Payments"
            text="Bayaran ang booking online gamit ang GCash, card, o kahit anong method — safe at secure." />
          <Feature color="purple" icon="fa-water" title="Beachfront Rooms"
            text="Pumili mula sa Standard, Deluxe, Suite, o Beachfront rooms — lahat may magandang view." />
          <Feature color="orange" icon="fa-shield-halved" title="Smart Check-Out"
            text="Pag-check-out mo, awtomatikong na-invalidate ang lumang NFC code para sa seguridad." />
          <Feature color="blue" icon="fa-users" title="User Friendly"
            text="Simple dashboard para sa users, staff, at admin. Lahat ng kailangan mo, isang click lang." />
          <Feature color="gold" icon="fa-bolt" title="Real-Time Updates"
            text="Agad-agad na nakikita ang room availability at booking status — walang delay." />
        </div>

        {/* ============ FEATURED ROOMS ============ */}
        <div className="section-title" id="rooms">
          <h2>Featured Rooms</h2>
          <p>Pinaka-prestigious at premium rooms namin — book agad!</p>
        </div>

        {loading && (
          <div className="neu-card center">
            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: '#2d8ecf' }}></i>
            <p className="muted" style={{ marginTop: 12 }}>Loading rooms…</p>
          </div>
        )}

        {!loading && rooms.length === 0 && (
          <div className="neu-card center">
            <i className="fa-solid fa-bed" style={{ fontSize: 40, color: '#d0dbe5' }}></i>
            <p className="muted" style={{ marginTop: 12 }}>
              Walang available rooms sa ngayon. Balik ka mamaya!
            </p>
          </div>
        )}

        {!loading && rooms.length > 0 && (
          <div className="room-grid">
            {rooms.map((r) => (
              <div key={r.id} className="room-card">
                <span className="room-badge">
                  <i className="fa-solid fa-circle-check" style={{ marginRight: 4 }}></i>
                  Available
                </span>
                <p className="room-type">{r.room_type}</p>
                <p className="room-number">#{r.room_number}</p>
                <p className="room-price">
                  ₱{Number(r.price).toLocaleString()}<span> / night</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <PublicFooter />
    </AppLayout>
  );
}

/* Feature component */
function Feature({ color = 'blue', icon, title, text }) {
  return (
    <div className="feature-card">
      <div className={`feature-icon-badge ${color}`}>
        <i className={`fa-solid ${icon}`}></i>
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}