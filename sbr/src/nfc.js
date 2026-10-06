// src/nfc.js
// Web NFC wrapper. Web NFC only works in Chrome on Android.
// We include a simulation fallback so you can test on desktop.

// Trigger an NFC write of `text` onto a tag.
export async function writeNFC(text) {
  if (!('NDEFReader' in window)) {
    // Simulation mode — pretend we wrote it.
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

// Read the next NFC tap and return its text payload.
export async function readNFC() {
  if (!('NDEFReader' in window)) {
    // Simulate a tap returning the last-written token.
    const last = sessionStorage.getItem('sbr:lastNfcToken') || 'SIMULATED-TOKEN';
    return { ok: true, text: last, simulated: true };
  }
  try {
    const reader = new NDEFReader();
    await reader.scan();
    return await new Promise((resolve, reject) => {
      reader.onreading = ({ message }) => {
        for (const record of message.records) {
          if (record.recordType === 'text') {
            const text = new TextDecoder().decode(record.data);
            resolve({ ok: true, text });
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