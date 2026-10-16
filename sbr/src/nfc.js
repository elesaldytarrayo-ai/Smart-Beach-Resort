/* Web NFC API helpers — readNFC + writeNFC.
   Supported browsers:
   - Chrome / Edge on Android (real Web NFC)
   - Other browsers: simulated mode using sessionStorage
*/

/* Keys used to save the last written NFC token */
const NFC_TOKEN_KEY = 'sbr:lastNfcToken';
const NFC_PURPOSE_KEY = 'sbr:nfcPurpose';

/* Default timeout for reading a tag (15 seconds) */
const READ_TIMEOUT_MS = 15000;

/* Check if the browser supports Web NFC */
function isNfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/* Simulated read — pull the token from sessionStorage */
function simulateRead() {
  const storedToken = sessionStorage.getItem(NFC_TOKEN_KEY);

  /* Token found — return it as a simulated success */
  if (storedToken) {
    return { ok: true, text: storedToken, simulated: true };
  }

  /* No token saved */
  return {
    ok: false,
    simulated: true,
    error: 'Web NFC not supported. No saved NFC token in session.'
  };
}

/* Simulated write — save the token to sessionStorage */
function simulateWrite(text) {
  sessionStorage.setItem(NFC_TOKEN_KEY, text);
  return { ok: true, simulated: true };
}

/* Extract text from an NFC reading event */
function extractTextFromMessage(message) {
  for (const record of message.records) {
    if (record.recordType === 'text') {
      const decoder = new TextDecoder(record.encoding || 'utf-8');
      return decoder.decode(record.data);
    }
  }
  return '';
}

/* Read text from an NFC tag.
   Returns: { ok, text, simulated, error }
*/
export async function readNFC() {
  /* Fall back to simulated mode if unsupported */
  if (!isNfcSupported()) {
    console.warn('[NFC] Web NFC not supported — using simulated mode.');
    return simulateRead();
  }

  try {
    /* Start the NFC reader */
    const reader = new NDEFReader();
    await reader.scan();
    console.log('[NFC] Reader started — waiting for tag…');

    /* Wait for a reading event or timeout */
    return new Promise((resolve) => {
      /* Timeout in case no tag is tapped */
      const timeout = setTimeout(() => {
        resolve({
          ok: false,
          simulated: false,
          error: 'NFC read timeout. Please tap the tag again.'
        });
      }, READ_TIMEOUT_MS);

      /* Handle a successful tap */
      reader.addEventListener(
        'reading',
        (event) => {
          clearTimeout(timeout);
          const text = extractTextFromMessage(event.message);

          if (!text) {
            resolve({
              ok: false,
              simulated: false,
              error: 'No text record found in NFC tag.'
            });
            return;
          }

          console.log('[NFC] Tag read:', text);
          resolve({ ok: true, text, simulated: false });
        },
        { once: true }
      );

      /* Handle a failed tap */
      reader.addEventListener(
        'readingerror',
        () => {
          clearTimeout(timeout);
          resolve({
            ok: false,
            simulated: false,
            error: 'Failed to read NFC tag.'
          });
        },
        { once: true }
      );
    });
  } catch (err) {
    console.error('[NFC] Read error:', err);
    return {
      ok: false,
      simulated: false,
      error: err.message || 'Failed to read NFC tag.'
    };
  }
}

/* Write text to an NFC tag.
   Returns: { ok, simulated, error }
*/
export async function writeNFC(text) {
  /* Nothing to write */
  if (!text) {
    return { ok: false, error: 'No text to write.' };
  }

  /* Fall back to simulated mode if unsupported */
  if (!isNfcSupported()) {
    console.warn('[NFC] Web NFC not supported — simulated write.');
    return simulateWrite(text);
  }

  try {
    /* Write a single text record */
    const writer = new NDEFReader();
    await writer.write({
      records: [{ recordType: 'text', data: text }]
    });

    console.log('[NFC] Tag written:', text);
    return { ok: true, simulated: false };
  } catch (err) {
    console.error('[NFC] Write error:', err);
    return {
      ok: false,
      simulated: false,
      error: err.message || 'Failed to write NFC tag.'
    };
  }
}

/* Public helper — check if Web NFC is supported */
export function isNFCSupported() {
  return isNfcSupported();
}