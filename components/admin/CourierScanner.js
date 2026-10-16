'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Live camera view that reads QR codes and barcodes continuously.
 * Mount it to start the camera, unmount it to stop.
 * onScan(text) fires for every read; the parent decides what to do with repeats.
 */
export default function CourierScanner({ onScan }) {
  const elId = useRef(`courier-scanner-${Math.random().toString(36).slice(2, 8)}`).current;
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan; // always call the latest handler (avoids stale state)

  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let scanner = null;

    const startPromise = (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats: F } = await import('html5-qrcode');
      if (cancelled) return;

      scanner = new Html5Qrcode(elId, {
        verbose: false,
        formatsToSupport: [F.QR_CODE, F.CODE_128, F.CODE_39, F.EAN_13, F.ITF, F.DATA_MATRIX],
      });

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          // wide box: works for barcodes and QR codes
          qrbox: (w, h) => ({
            width: Math.max(180, Math.min(w - 24, 340)),
            height: Math.max(120, Math.min(h - 24, 190)),
          }),
        },
        (text) => onScanRef.current?.(text),
        () => {} // ignore per-frame "nothing found"
      );
      if (!cancelled) setReady(true);
    })().catch((err) => {
      console.error('Scanner error', err);
      if (!cancelled) {
        setError(
          'Camera could not start. Allow camera permission in your browser (the site must use HTTPS), or type the code below.'
        );
      }
    });

    return () => {
      cancelled = true;
      startPromise.then(async () => {
        try {
          if (scanner?.isScanning) await scanner.stop();
          scanner?.clear();
        } catch { /* already stopped */ }
      });
    };
  }, [elId]);

  return (
    <div>
      <div
        id={elId}
        className="w-full overflow-hidden rounded-xl bg-brand-ink/5 min-h-[220px]"
      />
      {!ready && !error && (
        <p className="text-xs text-brand-ink/50 mt-2">Starting camera…</p>
      )}
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}