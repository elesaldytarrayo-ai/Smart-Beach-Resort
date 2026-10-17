/* Import React hooks for state and lifecycle */
import { useEffect, useState } from 'react';

/* Import Link for navigation and secureSelect for querying Supabase */
import { Link } from 'react-router-dom';
import { secureSelect } from '../supabase.js';

/* Import the decrypt helper (adjust path if needed) */
import { decrypt } from '../encryption.js';

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
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 60);
  const str = String(value);
  return str.length > maxLength ? str.slice(0, maxLength) + '…' : str;
}

/* Safely decrypt a value; returns { ok, value } */
function safeDecrypt(cipher) {
  if (cipher === null || cipher === undefined || cipher === '') {
    return { ok: false, value: '—' };
  }
  if (typeof cipher !== 'string') {
    return { ok: false, value: String(cipher) };
  }
  try {
    const plain = decrypt(cipher);
    if (!plain) return { ok: false, value: '(decrypt failed)' };
    return { ok: true, value: plain };
  } catch (err) {
    console.error('Decrypt error:', err);
    return { ok: false, value: '(decrypt error)' };
  }
}

/* Return the correct CSS class for a column (encrypted / decrypted / normal) */
function getColumnClass(key) {
  if (key.endsWith('_encrypted')) return 'col-encrypted';
  if (DECRYPTED_FIELDS.includes(key)) return 'col-decrypted';
  return '';
}

/* Build display columns.
   - Detect EVERY column ending in "_encrypted" (generic, not hardcoded).
   - Show all normal columns first.
   - Then ALL encrypted columns.
   - Then the decrypted counterpart for EACH encrypted column.
   - Other tables: unchanged (original order).
*/
function buildDisplayColumns(columns, table) {
  /* Non-profiles tables: return columns as-is */
  if (table !== 'profiles') {
    return columns.map((key) => ({
      key,
      kind: key.endsWith('_encrypted') ? 'encrypted' : 'normal'
    }));
  }

  /* Detect every *_encrypted column dynamically */
  const encryptedCols = columns.filter((k) => k.endsWith('_encrypted'));
  const normalCols = columns.filter((k) => !k.endsWith('_encrypted'));

  /* Preferred order (if they exist): password_encrypted, phone_encrypted, then the rest */
  const preferred = ['password_encrypted', 'phone_encrypted'];
  const orderedEncrypted = [
    ...preferred.filter((k) => encryptedCols.includes(k)),
    ...encryptedCols.filter((k) => !preferred.includes(k))
  ];

  const out = [];

  /* 1. All normal columns first */
  normalCols.forEach((key) => {
    out.push({ key, kind: 'normal' });
  });

  /* 2. ALL encrypted columns (cipher values like "jfkafaok...") */
  orderedEncrypted.forEach((key) => {
    out.push({ key, kind: 'encrypted' });
  });

  /* 3. Decrypted counterpart for EACH encrypted column */
  orderedEncrypted.forEach((key) => {
    const plainKey = key.replace(/_encrypted$/, '');
    out.push({ key: plainKey, kind: 'decrypted', sourceKey: key });
  });

  return out;
}

/* Main component — shows the decrypted values viewer */
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

  const originalColumns = rows.length > 0 ? Object.keys(rows[0]) : [];

  /* Display columns depend on the selected table */
  const displayColumns = buildDisplayColumns(originalColumns, table);

  const hasData = !loading && rows.length > 0;

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
            View decrypted values from Supabase tables.
          </p>
        </div>

        <div className="decrypt-toolbar">
          <label><i className="database"></i> Table:</label>

          <select value={table} onChange={(e) => setTable(e.target.value)}>
            {AVAILABLE_TABLES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
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
            <span className="decrypt-stat encrypted"><i className="lock"></i> Encrypted</span>
            <span className="decrypt-stat decrypted"><i className="key"></i> Decrypted</span>
          </div>
        </div>

        {error && (
          <div className="decrypt-error">
            <i className="circle-exclamation"></i>{error}
          </div>
        )}

        {loading && (
          <div className="decrypt-loading">
            <i className="spinner"></i>Loading data…
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="decrypt-empty">
            <i className="database"></i>
            <div className="decrypt-empty-title">No data in this table</div>
            <div className="decrypt-empty-desc">Save data from another page first.</div>
          </div>
        )}

        {hasData && (
          <>
            <div className="decrypt-table-wrap">
              <table className="decrypt-table">

                <thead>
                  <tr>
                    <th className="decrypt-th-num">#</th>

                    {displayColumns.map((col) => {
                      const isEncrypted = col.kind === 'encrypted';
                      const isDecrypted = col.kind === 'decrypted';
                      const isPlain = DECRYPTED_FIELDS.includes(col.key);

                      let cls = '';
                      if (isEncrypted) cls = 'col-encrypted';
                      else if (isDecrypted) cls = 'col-decrypted';
                      else cls = getColumnClass(col.key);

                      return (
                        <th key={col.key} className={cls}>
                          <span className="decrypt-th-content">
                            {col.key}
                            {isEncrypted && <span className="col-badge">🔒</span>}
                            {(isDecrypted || isPlain) && <span className="col-badge">🔓</span>}
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

                      {displayColumns.map((col) => {
                        /* Encrypted column — show cipher (e.g., "jfkafaok...") */
                        if (col.kind === 'encrypted') {
                          return (
                            <td key={col.key} className="col-encrypted">
                              <code className="decrypt-cell-code">
                                {formatCellValue(row[col.key], 32)}
                              </code>
                            </td>
                          );
                        }

                        /* Decrypted column — decrypt the source */
                        if (col.kind === 'decrypted') {
                          const { value } = safeDecrypt(row[col.sourceKey]);
                          return (
                            <td key={col.key} className="col-decrypted">
                              <code className="decrypt-cell-code">
                                {value}
                              </code>
                            </td>
                          );
                        }

                        /* Normal column */
                        return (
                          <td key={col.key} className={getColumnClass(col.key)}>
                            <code className="decrypt-cell-code">
                              {formatCellValue(row[col.key])}
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
              <span>Columns: <strong>{displayColumns.length}</strong></span>
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
              <span>
                <strong className="legend-encrypted">Encrypted</strong> — stored in Supabase
              </span>
            </div>

            <div className="decrypt-legend-item">
              <span className="decrypt-legend-swatch decrypted"></span>
              <span>
                <strong className="legend-decrypted">Decrypted</strong> — shown in frontend
              </span>
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