// src/nfc.js
// Web NFC wrapper. Works only in Chrome on Android.
// Falls back to simulation mode for desktop testing.

// Write text onto an NFC tag.
export async function writeNFC(text) {
  // If the browser doesn't support NFC, simulate it.
  if (!('NDEFReader' in window)) {
    console.log('[NFC SIMULATION] wrote:', text);
    return { ok: true, simulated: true };
  }

  try {
    const writer = new NDEFReader();
    await writer.write({ records: [{ recordType: 'text', data: text }] });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Read the next NFC tap and return its text.
export async function readNFC() {
  // If the browser doesn't support NFC, simulate a tap.
  if (!('NDEFReader' in window)) {
    const last = sessionStorage.getItem('sbr:lastNfcToken') || 'SIMULATED-TOKEN';
    return { ok: true, text: last, simulated: true };
  }

  try {
    const reader = new NDEFReader();
    await reader.scan();

    // Wait for a tap and return the first text record found.
    return await new Promise((resolve, reject) => {
      reader.onreading = ({ message }) => {
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const text = new TextDecoder().decode(record.data);
            resolve({ ok: true, text });
            return;
          }
        }
        reject(new Error('No text record found'));
      };
      reader.onreadingerror = () => reject(new Error('NFC read error'));
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}