/* ============================================================
   src/app/DecryptViewer.jsx
   Horizontal table — nakikita lahat ng text.
   ============================================================ */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { secureSelect } from '../supabase.js';

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

function formatValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function DecryptViewer() {
  const [table, setTable] = useState('payments');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    setRows([]);

    try {
      const data = await secureSelect(table, { columns: '*' });
      setRows(data || []);
    } catch (err) {
      console.error('Load error:', err);
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

  return (
    <div className="decrypt-page">

      <Link to="/" className="decrypt-back">
        <i className="arrow-left"></i> Back to Home
      </Link>

      <div className="decrypt-container">

        <div className="decrypt-icon">
          <i className="lock"></i>
        </div>

        <div className="decrypt-header">
          <h2 className="decrypt-title">
            <i className="key"></i> Decrypted Values Viewer
          </h2>
          <p className="decrypt-subtitle">
            Makikita dito ang lahat ng decrypted values (horizontal scroll).
          </p>
        </div>

        <div className="decrypt-toolbar">
          <label><i className="database"></i> Table:</label>
          <select value={table} onChange={(e) => setTable(e.target.value)}>
            <option value="payments">payments</option>
            <option value="bookings">bookings</option>
            <option value="nfc_tokens">nfc_tokens</option>
            <option value="profiles">profiles</option>
          </select>

          <button
            className="app-btn app-btn-primary"
            onClick={loadData}
            disabled={loading}
            type="button"
          >
            <i className={`${loading ? 'spinner' : 'rotate'} booking-gap-right`}></i>
            {loading ? 'Loading…' : 'Reload'}
          </button>

          <div className="decrypt-stats">
            <span className="decrypt-stat">
              <i className="database"></i>
              {rows.length} row{rows.length !== 1 ? 's' : ''}
            </span>
            <span className="decrypt-stat encrypted">
              <i className="lock"></i> Encrypted
            </span>
            <span className="decrypt-stat decrypted">
              <i className="key"></i> Decrypted
            </span>
          </div>
        </div>

        {error && (
          <div className="decrypt-error">
            <i className="circle-exclamation"></i>
            {error}
          </div>
        )}

        {loading && (
          <div className="decrypt-loading">
            <i className="spinner"></i>
            Loading data…
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="decrypt-empty">
            <i className="database"></i>
            <div className="decrypt-empty-title">Walang data sa table na ito</div>
            <div className="decrypt-empty-desc">Mag-save muna ng data sa ibang page.</div>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            {/* Scroll hint */}
            <div className="decrypt-scroll-hint">
              <i className="arrow-right"></i>
              I-scroll pakanan para makita lahat ng columns
            </div>

            <div className="decrypt-table-wrap">
              <table className="decrypt-table">
                <thead>
                  <tr>
                    <th className="decrypt-th-num">#</th>
                    {columns.map((key) => {
                      const isEncrypted = key.endsWith('_encrypted');
                      const isDecrypted = DECRYPTED_FIELDS.includes(key);

                      let cls = '';
                      if (isEncrypted) cls = 'col-encrypted';
                      else if (isDecrypted) cls = 'col-decrypted';

                      return (
                        <th key={key} className={cls}>
                          <span className="decrypt-th-content">
                            {key}
                            {isEncrypted && <span className="col-badge">🔒</span>}
                            {isDecrypted && <span className="col-badge">🔓</span>}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td className="decrypt-td-num">{i + 1}</td>
                      {columns.map((key) => {
                        const value = row[key];
                        const isEncrypted = key.endsWith('_encrypted');
                        const isDecrypted = DECRYPTED_FIELDS.includes(key);

                        let cls = '';
                        if (isEncrypted) cls = 'cell-encrypted';
                        else if (isDecrypted) cls = 'cell-decrypted';

                        const strValue = formatValue(value);

                        return (
                          <td key={key} className={cls}>
                            <code className="decrypt-cell-code">
                              {strValue}
                            </code>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="decrypt-footer">
              <span>Table: <strong>{table}</strong></span>
              <span>Total: <strong>{rows.length}</strong> row{rows.length !== 1 ? 's' : ''}</span>
              <span>Columns: <strong>{columns.length}</strong></span>
            </div>
          </>
        )}

        <div className="decrypt-legend">
          <div className="decrypt-legend-title">
            <i className="circle-info"></i> Legend
          </div>
          <div className="decrypt-legend-items">
            <div className="decrypt-legend-item">
              <span className="decrypt-legend-swatch encrypted"></span>
              <span><strong style={{ color: '#c62828' }}>Encrypted</strong> — naka-save sa Supabase</span>
            </div>
            <div className="decrypt-legend-item">
              <span className="decrypt-legend-swatch decrypted"></span>
              <span><strong style={{ color: '#2e7d32' }}>Decrypted</strong> — naka-display sa frontend</span>
            </div>
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