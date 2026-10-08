import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase.js';
import AppLayout from './AppLayout.jsx';

// FEATURE CARD COMPONENT
// Feature Component
// A reusable card for displaying a single feature or selling point.
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

// HOME PAGE COMPONENT
// HomePage Component
// Fetches featured rooms and renders the main landing page.
export default function HomePage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);

  //Fetches the top 4 available rooms from Supabase.
  async function fetchAvailableRooms() {
    try {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('status', 'available')
        .order('price', { ascending: false })
        .limit(4);

      if (error) throw error;
      setRooms(data || []);
    } catch (error) {
      console.error('Failed to fetch featured rooms:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAvailableRooms();
  }, []);

  return (
    <AppLayout nav footer>
      <div className="page-pad">
        {/*HERO SECTION*/}
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
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="hero-btn hero-btn-primary"
              >
                <i className="fa-solid fa-rocket"></i>
                <span>Get Started Free</span>
              </button>

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

        {/*FEATURES SECTION*/}
        <div className="section-title" id="features">
          <h2>Why Choose Smart Beach Resort?</h2>
          <p>Modern features built for a hassle-free beach vacation</p>
        </div>

        <div className="feature-grid">
          <Feature color="blue" icon="fa-wifi" title="NFC Check-In"
            text="Tap your phone on the room NFC reader for a quick check-in. No lines, no hassle." />
          <Feature color="green" icon="fa-credit-card" title="Secure Payments"
            text="Pay for your booking online using GCash, card, or any method — safe and secure." />
          <Feature color="purple" icon="fa-water" title="Beachfront Rooms"
            text="Choose from Standard, Deluxe, Suite, or Beachfront rooms — all with beautiful views." />
          <Feature color="orange" icon="fa-shield-halved" title="Smart Check-Out"
            text="Upon check-out, the old NFC code is automatically invalidated for security." />
          <Feature color="blue" icon="fa-users" title="User Friendly"
            text="Simple dashboard for users, staff, and admin. Everything you need in just one click." />
          <Feature color="gold" icon="fa-bolt" title="Real-Time Updates"
            text="Room availability and booking status are updated immediately — no delay." />
        </div>

        {/*FEATURED ROOMS SECTION*/}
        <div className="section-title" id="rooms">
          <h2>Featured Rooms</h2>
          <p>Our most prestigious and premium rooms — book now!</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="neu-card center">
            <i className="fa-solid fa-spinner fa-spin loading-spinner"></i>
            <p className="muted mt-3">Loading rooms…</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && rooms.length === 0 && (
          <div className="neu-card center">
            <i className="fa-solid fa-bed empty-icon"></i>
            <p className="muted mt-3">No rooms available right now. Check back later!</p>
          </div>
        )}

        {/* Room Grid */}
        {!loading && rooms.length > 0 && (
          <div className="room-grid">
            {rooms.map((room) => (
              <div key={room.id} className="room-card">
                <span className="room-badge">
                  <i className="fa-solid fa-circle-check mr-1"></i>
                  Available
                </span>
                <p className="room-type">{room.room_type}</p>
                <p className="room-number">#{room.room_number}</p>
                <p className="room-price">
                  ₱{Number(room.price).toLocaleString()}<span> / night</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}