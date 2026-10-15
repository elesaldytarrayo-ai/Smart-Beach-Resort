/* ============================================================
   src/nfc.js
   Web NFC API helpers — readNFC + writeNFC.
   ------------------------------------------------------------
   Supported browsers:
   - Chrome/Edge on Android (Web NFC)
   - Other browsers: simulated mode (manual input)
   ============================================================ */

const NFC_TOKEN_KEY = 'sbr:lastNfcToken';
const NFC_PURPOSE_KEY = 'sbr:nfcPurpose';

/* ------------------------------------------------------------
   Check if Web NFC is supported
   ------------------------------------------------------------ */
function isNfcSupported() {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/* ------------------------------------------------------------
   readNFC — Read text from NFC tag
   Returns: { ok, text, simulated, error }
   ------------------------------------------------------------ */
export async function readNFC() {
  // Check browser support
  if (!isNfcSupported()) {
    console.warn('[NFC] Web NFC not supported — using simulated mode.');

    // Simulated mode: kunin ang token mula sa sessionStorage
    const storedToken = sessionStorage.getItem(NFC_TOKEN_KEY);

    if (storedToken) {
      return {
        ok: true,
        text: storedToken,
        simulated: true
      };
    }

    // Walang naka-save na token
    return {
      ok: false,
      simulated: true,
      error: 'Web NFC not supported. Walang naka-save na NFC token sa session.'
    };
  }

  try {
    // Real Web NFC read
    const reader = new NDEFReader();
    await reader.scan();

    console.log('[NFC] Reader started — waiting for tag…');

    // Wait for a reading event (timeout: 15 seconds)
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          ok: false,
          simulated: false,
          error: 'NFC read timeout. Please tap the tag again.'
        });
      }, 15000);

      reader.addEventListener(
        'reading',
        (event) => {
          clearTimeout(timeout);

          const message = event.message;
          let text = '';

          for (const record of message.records) {
            if (record.recordType === 'text') {
              const decoder = new TextDecoder(record.encoding || 'utf-8');
              text = decoder.decode(record.data);
              break;
            }
          }

          if (!text) {
            resolve({
              ok: false,
              simulated: false,
              error: 'No text record found in NFC tag.'
            });
            return;
          }

          console.log('[NFC] Tag read:', text);

          resolve({
            ok: true,
            text,
            simulated: false
          });
        },
        { once: true }
      );

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

/* ------------------------------------------------------------
   writeNFC — Write text to NFC tag
   Returns: { ok, error }
   ------------------------------------------------------------ */
export async function writeNFC(text) {
  if (!text) {
    return { ok: false, error: 'No text to write.' };
  }

  // Check browser support
  if (!isNfcSupported()) {
    console.warn('[NFC] Web NFC not supported — simulated write.');
    // I-save lang sa sessionStorage para sa simulated mode
    sessionStorage.setItem(NFC_TOKEN_KEY, text);
    return {
      ok: true,
      simulated: true
    };
  }

  try {
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

/* ------------------------------------------------------------
   isNFCSupported — Check if browser supports Web NFC
   ------------------------------------------------------------ */
export function isNFCSupported() {
  return isNfcSupported();
}