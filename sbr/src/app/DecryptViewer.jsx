/* Import React hooks for state and lifecycle */
import { useEffect, useState } from 'react';

/* Import Link for navigation and secureSelect for querying Supabase */
import { Link } from 'react-router-dom';
import { secureSelect } from '../supabase.js';

/* List of tables the viewer can display */
const AVAILABLE_TABLES = ['payments', 'bookings', 'nfc_tokens', 'profiles'];

/* Fields that are considered decrypted (shown with a key badge) */
const DECRYPTED_FIELDS = [
  'reference',
  'reference_number',
  'payment_reference',
  'paymongo_id',
  'paymongo_session_id',
  'nfc_uid',
  'nfc_token',
  'password',
  'phone'
];

/* Format a cell value for display — truncate long strings */
function formatCellValue(value, maxLength = 80) {
  /* Show a dash for empty values */
  if (value === null || value === undefined) return '—';

  /* Convert objects (e.g., JSON columns) into a short string */
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 60);

  /* Convert to string and truncate if too long */
  const str = String(value);
  return str.length > maxLength ? str.slice(0, maxLength) + '…' : str;
}

/* Return the correct CSS class for a column (encrypted / decrypted / normal) */
function getColumnClass(key) {
  /* Columns ending in "_encrypted" get the red badge */
  if (key.endsWith('_encrypted')) return 'col-encrypted';

  /* Columns listed in DECRYPTED_FIELDS get the green badge */
  if (DECRYPTED_FIELDS.includes(key)) return 'col-decrypted';

  /* Everything else is a regular column */
  return '';
}

/* Main component — shows the decrypted values viewer */
export default function DecryptViewer() {

  /* Currently selected table (defaults to "payments") */
  const [table, setTable] = useState('payments');

  /* Rows fetched from the selected table */
  const [rows, setRows] = useState([]);

  /* Loading flag while fetching data */
  const [loading, setLoading] = useState(false);

  /* Error message if fetching fails */
  const [error, setError] = useState('');

  /* Fetch all rows from the selected table */
  async function loadData() {
    /* Reset state before fetching */
    setLoading(true);
    setError('');
    setRows([]);

    try {
      /* Query Supabase for all rows in the selected table */
      const data = await secureSelect(table, { columns: '*' });
      setRows(data || []);
    } catch (err) {
      /* Show error if fetch fails */
      console.error('Load error:', err);
      setError(err.message || 'Failed to load data.');
    } finally {
      /* Always stop loading, even on error */
      setLoading(false);
    }
  }

  /* Re-fetch whenever the selected table changes */
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  /* Get column names from the first row (or empty if no data) */
  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  /* Only render the table when data is available */
  const hasData = !loading && rows.length > 0;

  /* Render the page */
  return (
    <div className="decrypt-page">

      {/* Back to home link */}
      <Link to="/" className="decrypt-back">
        <i className="arrow-left"></i> Back to Home
      </Link>

      <div className="decrypt-container">

        {/* Header icon (lock) */}
        <div className="decrypt-icon">
          <i className="lock"></i>
        </div>

        {/* Header title and subtitle */}
        <div className="decrypt-header">
          <h2 className="decrypt-title">
            <i className="key"></i> Decrypted Values Viewer
          </h2>
          <p className="decrypt-subtitle">
            View decrypted values from Supabase tables.
          </p>
        </div>

        {/* Toolbar with table selector, reload button, and stats */}
        <div className="decrypt-toolbar">
          <label><i className="database"></i> Table:</label>

          {/* Table selector dropdown */}
          <select value={table} onChange={(e) => setTable(e.target.value)}>
            {AVAILABLE_TABLES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Reload button */}
          <button
            className="app-btn app-btn-primary"
            onClick={loadData}
            disabled={loading}
            type="button"
          >
            <i className={`${loading ? 'spinner' : 'rotate'} booking-gap-right`}></i>
            {loading ? 'Loading…' : 'Reload'}
          </button>

          {/* Quick stats (row count and badges) */}
          <div className="decrypt-stats">
            <span className="decrypt-stat">
              <i className="database"></i>
              {rows.length} row{rows.length !== 1 ? 's' : ''}
            </span>
            <span className="decrypt-stat encrypted"><i className="lock"></i> Encrypted</span>
            <span className="decrypt-stat decrypted"><i className="key"></i> Decrypted</span>
          </div>
        </div>

        {/* Show error message if any */}
        {error && (
          <div className="decrypt-error">
            <i className="circle-exclamation"></i>{error}
          </div>
        )}

        {/* Show loading indicator */}
        {loading && (
          <div className="decrypt-loading">
            <i className="spinner"></i>Loading data…
          </div>
        )}

        {/* Show empty state if no rows and no error */}
        {!loading && rows.length === 0 && !error && (
          <div className="decrypt-empty">
            <i className="database"></i>
            <div className="decrypt-empty-title">No data in this table</div>
            <div className="decrypt-empty-desc">Save data from another page first.</div>
          </div>
        )}

        {/* Show the data table when rows are available */}
        {hasData && (
          <>
            {/* Scrollable table wrapper */}
            <div className="decrypt-table-wrap">
              <table className="decrypt-table">

                {/* Table header */}
                <thead>
                  <tr>
                    {/* Row number column */}
                    <th className="decrypt-th-num">#</th>

                    {/* Data column headers */}
                    {columns.map((key) => {
                      const isEncrypted = key.endsWith('_encrypted');
                      const isDecrypted = DECRYPTED_FIELDS.includes(key);

                      return (
                        <th key={key} className={getColumnClass(key)}>
                          <span className="decrypt-th-content">
                            {key}
                            {/* Show lock icon for encrypted columns */}
                            {isEncrypted && <span className="col-badge">🔒</span>}
                            {/* Show key icon for decrypted columns */}
                            {isDecrypted && <span className="col-badge">🔓</span>}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                {/* Table body */}
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      {/* Row number (1, 2, 3…) */}
                      <td className="decrypt-td-num">{i + 1}</td>

                      {/* Data cells */}
                      {columns.map((key) => (
                        <td key={key} className={getColumnClass(key)}>
                          <code className="decrypt-cell-code">
                            {formatCellValue(row[key])}
                          </code>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>

              </table>
            </div>

            {/* Footer summary */}
            <div className="decrypt-footer">
              <span>Table: <strong>{table}</strong></span>
              <span>Total: <strong>{rows.length}</strong> row{rows.length !== 1 ? 's' : ''}</span>
              <span>Columns: <strong>{columns.length}</strong></span>
            </div>
          </>
        )}

        {/* Legend for the colors used in the table */}
        <div className="decrypt-legend">
          <div className="decrypt-legend-title">
            <i className="circle-info"></i> Legend
          </div>

          <div className="decrypt-legend-items">
            {/* Encrypted items */}
            <div className="decrypt-legend-item">
              <span className="decrypt-legend-swatch encrypted"></span>
              <span>
                <strong className="legend-encrypted">Encrypted</strong> — stored in Supabase
              </span>
            </div>

            {/* Decrypted items */}
            <div className="decrypt-legend-item">
              <span className="decrypt-legend-swatch decrypted"></span>
              <span>
                <strong className="legend-decrypted">Decrypted</strong> — shown in frontend
              </span>
            </div>

            {/* Regular columns */}
            <div className="decrypt-legend-item">
              <span className="decrypt-legend-swatch regular"></span>
              <span>Regular column</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}