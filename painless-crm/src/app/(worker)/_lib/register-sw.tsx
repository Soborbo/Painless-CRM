'use client';

import { useEffect } from 'react';

// Registers the worker PWA service worker. Mounted only inside the worker
// layout, so the office dashboard never registers it. The SW itself only acts
// on worker-app navigations (see public/sw.js).
export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Registration failures are non-fatal — the app still works online.
      });
    };
    if (document.readyState === 'complete') register();
    else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);
  return null;
}
