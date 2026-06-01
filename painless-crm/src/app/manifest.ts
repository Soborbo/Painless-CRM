import type { MetadataRoute } from 'next';

// Phase 09 — installable worker PWA. start_url is the crew home; scope stays '/'
// so the single app can host both the office dashboard and the worker app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Painless Crew',
    short_name: 'Painless',
    description: "Painless Removals crew app — today's jobs, clock-in and job sheets.",
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#0066cc',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
