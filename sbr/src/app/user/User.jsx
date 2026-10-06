/* ============================================================
   src/app/User.jsx
   User dashboard — enhanced design with icons and stats.
   ============================================================ */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../supabase.js";

export default function User() {
  const nav = useNavigate();

  const [profile,  setProfile]  = useState(null);
  const [rooms,    setRooms]    = useState([]);
  const [bookings, setBookings] = useState([]);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: auth, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;
        if (!auth.user) { nav("/login"); return; }

        const { data: p, error: pErr } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", auth.user.id)
          .single();
        if (pErr) throw pErr;
        setProfile(p);

        const { data: r, error: rErr } = await supabase
          .from("rooms")
          .select("*")
          .order("room_number");
        if (rErr) throw rErr;
        setRooms(r || []);

        const { data: b, error: bErr } = await supabase
          .from("bookings")
          .select("*, rooms(room_number,room_type)")
          .eq("user_id", auth.user.id)
          .order("created_at", { ascending: false });
        if (bErr) throw bErr;
        setBookings(b || []);
      } catch (e) {
        console.error("LOAD ERROR:", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [nav]);

  async function logout() {
    await supabase.auth.signOut();
    nav("/login");
  }

  if (loading) {
    return (
      <div className="page-pad">
        <div className="neu-card center">Loading…</div>
      </div>
    );
  }

  const availableCount  = rooms.filter(r => r.status === "available").length;
  const activeBookings  = bookings.filter(b => b.status !== "checked_out").length;

  return (
    <>
      <nav className="nav">
        <div className="brand">
          <span className="brand-icon">🏖️</span>
          <span>SBR · User</span>
        </div>
        <div className="row" style={{ marginLeft: "auto" }}>
          <Link to="/user">Dashboard</Link>
          <Link to="/user/booking">Bookings</Link>
          <Link to="/user/profile">Profile</Link>
          <button className="neu-button" onClick={logout}>Logout</button>
        </div>
      </nav>

      <div className="page-pad">
        {error && (
          <div className="neu-card" style={{ borderLeft: "4px solid #e11d48", marginBottom: 20 }}>
            <strong style={{ color: "#e11d48" }}>Error:</strong>
            <p className="muted" style={{ marginTop: 6 }}>{error}</p>
          </div>
        )}

        {/* Welcome hero */}
        <section className="hero" style={{ padding: "40px 32px", textAlign: "left" }}>
          <div className="hero-content">
            <span style={{ fontSize: 40 }}>👋</span>
            <h1 style={{ fontSize: 28, marginTop: 8 }}>
              Welcome back, {profile?.full_name?.split(" ")[0] || "Guest"}!
            </h1>
            <p style={{ margin: 0, textAlign: "left" }}>
              {profile?.email}
            </p>
          </div>
        </section>

        {/* Quick stats */}
        <div className="row" style={{ marginTop: 20 }}>
          <div className="neu-card col center">
            <p className="muted">Available Rooms</p>
            <h2 style={{ color: "var(--accent)" }}>{availableCount}</h2>
          </div>
          <div className="neu-card col center">
            <p className="muted">My Reservations</p>
            <h2 style={{ color: "var(--accent)" }}>{bookings.length}</h2>
          </div>
          <div className="neu-card col center">
            <p className="muted">Active Bookings</p>
            <h2 style={{ color: "var(--accent)" }}>{activeBookings}</h2>
          </div>
        </div>

        {/* Available rooms preview */}
        <div className="section-title" style={{ marginTop: 40 }}>
          <h2>Available Rooms</h2>
          <p>Pumili ng room para sa iyong susunod na beach getaway</p>
        </div>

        {rooms.length === 0 ? (
          <div className="neu-card center">
            <p className="muted">Walang rooms sa database. I-run ang seed SQL.</p>
          </div>
        ) : (
          <div className="room-grid">
            {rooms.slice(0, 4).map((r) => (
              <div key={r.id} className="room-card">
                <span
                  className="room-badge"
                  style={{
                    background: r.status === "available" ? "#d1fae5" : "#fee2e2",
                    color:      r.status === "available" ? "#065f46" : "#991b1b",
                  }}
                >
                  {r.status}
                </span>
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

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link to="/user/booking">
            <button className="neu-button primary" style={{ padding: "14px 32px" }}>
              🎫 Book a Room
            </button>
          </Link>
        </div>

        {/* Recent bookings */}
        <div className="section-title" style={{ marginTop: 40 }}>
          <h2>Recent Reservations</h2>
        </div>

        <div className="neu-card">
          {bookings.length === 0 ? (
            <p className="muted center">Wala ka pang booking. Book na ngayon!</p>
          ) : (
            bookings.slice(0, 5).map((b) => (
              <div
                key={b.id}
                className="space-between"
                style={{ padding: "14px 0", borderBottom: "1px solid #cfd6e4" }}
              >
                <div>
                  <strong>Room {b.rooms?.room_number}</strong>
                  <br />
                  <span className="muted">{b.check_in} → {b.check_out}</span>
                </div>
                <div>
                  <span className={`pill ${b.payment_status}`}>{b.payment_status}</span>{" "}
                  <span className={`pill ${b.status}`}>{b.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}