import { useEffect, useState } from 'react';
import { supabase } from '../../supabase.js';
import AdminLayout from './AdminLayout.jsx';

// --- Constants ---
const ROOM_TYPES = ['Standard', 'Deluxe', 'Suite', 'Beachfront'];

// Defines the cycle order for the "Next Status" action.
// available → occupied → maintenance → available → ...
const STATUS_CYCLE = {
  available: 'occupied',
  occupied: 'maintenance',
  maintenance: 'available'
};

const INITIAL_FORM = {
  room_number: '',
  room_type: 'Standard',
  price: '',
  nfc_reader_id: ''
};

// Defines the filter options for the rooms dropdown.
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'available', label: 'Available' },
  { key: 'occupied', label: 'Occupied' },
  { key: 'maintenance', label: 'Maintenance' }
];

// REUSABLE SUB-COMPONENTS
// StatCard Component
// Displays a large KPI card on the room management dashboard.
function StatCard({ color, icon, label, value, sub }) {
  return (
    <div className={`admin-stat-card ${color}`}>
      <div className="admin-stat-top">
        <span className="admin-stat-label">{label}</span>
        <span className="admin-stat-icon">
          <i className={`fa-solid ${icon}`}></i>
        </span>
      </div>
      <div>
        <div className="admin-stat-value">{value}</div>
        <div className="admin-stat-sub">{sub}</div>
      </div>
    </div>
  );
}

// AddRoomForm Component
// Renders the form for adding a new room.
function AddRoomForm({ form, onChange, onSubmit, error, message }) {
  return (
    <div className="admin-panel mb-4">
      <div className="admin-panel-header">
        <h3 className="admin-panel-title">
          <i className="fa-solid fa-plus"></i> Add New Room
        </h3>
      </div>

      <form onSubmit={onSubmit} className="row">
        <div className="col">
          <label className="admin-label" htmlFor="room-number">Room Number</label>
          <input
            id="room-number"
            className="admin-input"
            placeholder="e.g. 101"
            value={form.room_number}
            onChange={(e) => onChange('room_number', e.target.value)}
            required
          />
        </div>

        <div className="col">
          <label className="admin-label" htmlFor="room-type">Room Type</label>
          <select
            id="room-type"
            className="admin-select"
            value={form.room_type}
            onChange={(e) => onChange('room_type', e.target.value)}
          >
            {ROOM_TYPES.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="col">
          <label className="admin-label" htmlFor="room-price">Price per Night</label>
          <input
            id="room-price"
            className="admin-input"
            type="number"
            placeholder="1500"
            value={form.price}
            onChange={(e) => onChange('price', e.target.value)}
            required
          />
        </div>

        <div className="col">
          <label className="admin-label" htmlFor="room-nfc">NFC Reader ID</label>
          <input
            id="room-nfc"
            className="admin-input"
            placeholder="Optional"
            value={form.nfc_reader_id}
            onChange={(e) => onChange('nfc_reader_id', e.target.value)}
          />
        </div>

        <div className="col col-fixed-140">
          <label className="admin-label invisible">Add</label>
          <button type="submit" className="app-btn app-btn-primary w-full">
            <i className="fa-solid fa-plus mr-1"></i> Add Room
          </button>
        </div>
      </form>

      {error && <p className="admin-error">{error}</p>}
      {message && <p className="admin-success">{message}</p>}
    </div>
  );
}

// RoomRow Component
// Renders a single room in the rooms table with action buttons.
function RoomRow({ room, updatingId, onCycleStatus, onDelete }) {
  const isUpdating = updatingId === room.id;

  return (
    <tr>
      <td><strong>{room.room_number}</strong></td>
      <td>{room.room_type}</td>
      <td>₱{Number(room.price).toLocaleString()}</td>
      <td className="muted">{room.nfc_reader_id || '—'}</td>
      <td>
        <span className={`admin-pill ${room.status}`}>{room.status}</span>
      </td>
      <td>
        <div className="row-actions">
          <button
            className="app-btn app-btn-secondary app-btn-sm"
            onClick={() => onCycleStatus(room)}
            disabled={isUpdating}
          >
            <i className={`fa-solid ${isUpdating ? 'fa-spinner fa-spin' : 'fa-rotate'}`}></i>
            {isUpdating ? 'Updating…' : 'Next'}
          </button>
          <button
            className="app-btn app-btn-danger app-btn-sm"
            onClick={() => onDelete(room)}
            disabled={isUpdating}
          >
            <i className={`fa-solid ${isUpdating ? 'fa-spinner fa-spin' : 'fa-trash'}`}></i>
            {isUpdating ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </td>
    </tr>
  );
}

// MAIN ADMIN ROOMS COMPONENT
// AdminRooms Component
// Displays all rooms with filtering, adding, status cycling, and deletion.
export default function AdminRooms() {
  // --- State Management ---
  const [rooms, setRooms] = useState([]);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // DATA FETCHING
  // Fetches all rooms, sorted by room number.
  async function fetchRooms() {
    try {
      setError('');
      const { data, error: fetchError } = await supabase
        .from('rooms')
        .select('*')
        .order('room_number', { ascending: true });

      if (fetchError) throw fetchError;
      setRooms(data || []);
    } catch (err) {
      setError('Cannot load rooms: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRooms();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // FORM HANDLERS
  // Generic input change handler for the add-room form.
  function handleFormChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // Adds a new room to the database.
  async function handleAddRoom(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!form.room_number.trim() || !form.price) {
      return setError('Room number and price are required.');
    }

    try {
      const { error: insertError } = await supabase.from('rooms').insert({
        room_number: form.room_number.trim(),
        room_type: form.room_type,
        price: Number(form.price),
        nfc_reader_id: form.nfc_reader_id.trim() || null,
        status: 'available'
      });

      if (insertError) throw insertError;

      setMessage(`Room ${form.room_number} added successfully.`);
      setForm(INITIAL_FORM);
      await fetchRooms();
    } catch (err) {
      setError(err.message);
    }
  }

  // ROW ACTIONS
  // Cycles the status of a room through the STATUS_CYCLE.
  async function handleCycleStatus(room) {
    const nextStatus = STATUS_CYCLE[room.status] || 'available';
    setError('');
    setMessage('');
    setUpdatingId(room.id);

    try {
      const { error: updateError } = await supabase
        .from('rooms')
        .update({ status: nextStatus })
        .eq('id', room.id);

      if (updateError) throw updateError;
      await fetchRooms();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // Deletes a room after confirmation.
  async function handleDelete(room) {
    const confirmed = window.confirm(`Delete Room ${room.room_number}?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    setUpdatingId(room.id);

    try {
      const { error: deleteError } = await supabase
        .from('rooms')
        .delete()
        .eq('id', room.id);

      if (deleteError) throw deleteError;

      setMessage(`Room ${room.room_number} deleted.`);
      await fetchRooms();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  // DERIVED DATA
  /** Counts per status for stat cards and filter dropdown. */
  const counts = {
    all: rooms.length,
    available: rooms.filter((r) => r.status === 'available').length,
    occupied: rooms.filter((r) => r.status === 'occupied').length,
    maintenance: rooms.filter((r) => r.status === 'maintenance').length
  };

  /** Rooms after applying the active filter. */
  const filteredRooms = filter === 'all'
    ? rooms
    : rooms.filter((r) => r.status === filter);

  // RENDER
  return (
    <AdminLayout>
      <div className="admin-welcome">
        <h1>Room Management</h1>
        <p>Add, update, and manage all rooms in the resort.</p>
      </div>

      {/*KPI STAT CARDS*/}
      <div className="admin-stat-grid">
        <StatCard
          color="blue"
          icon="fa-bed"
          label="Total Rooms"
          value={counts.all}
          sub="All rooms"
        />
        <StatCard
          color="green"
          icon="fa-circle-check"
          label="Available"
          value={counts.available}
          sub="Ready to book"
        />
        <StatCard
          color="orange"
          icon="fa-user-lock"
          label="Occupied"
          value={counts.occupied}
          sub="Currently in use"
        />
        <StatCard
          color="purple"
          icon="fa-screwdriver-wrench"
          label="Maintenance"
          value={counts.maintenance}
          sub="Under repair"
        />
      </div>

      {/*ADD ROOM FORM*/}
      <AddRoomForm
        form={form}
        onChange={handleFormChange}
        onSubmit={handleAddRoom}
        error={error}
        message={message}
      />

      {/*ROOMS TABLE*/}
      <div className="admin-panel">
        <div className="admin-panel-header">
          <h3 className="admin-panel-title">
            <i className="fa-solid fa-bed"></i> All Rooms ({counts.all})
          </h3>
          <select
            className="admin-select panel-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            {FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label} ({counts[f.key]})
              </option>
            ))}
          </select>
        </div>

        {loading && <p className="muted center">Loading…</p>}

        {!loading && rooms.length === 0 && (
          <p className="muted center">No rooms yet. Add one above to get started.</p>
        )}

        {!loading && rooms.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Room #</th>
                <th>Type</th>
                <th>Price</th>
                <th>NFC Reader</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => (
                <RoomRow
                  key={room.id}
                  room={room}
                  updatingId={updatingId}
                  onCycleStatus={handleCycleStatus}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminLayout>
  );
}