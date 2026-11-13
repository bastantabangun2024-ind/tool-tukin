// Service worker Tool Tukin.
// Hanya menyentuh berkas statis same-origin. API, login, dan Supabase selalu
// langsung ke jaringan supaya data presensi/tukin tidak pernah basi.
const CACHE = 'tool-tukin-v1';
const ASET_AWAL = [
  '/gaya.css',
  '/manifest.webmanifest',
  '/lib/pwa.js',
  '/lib/sandi.js',
  '/ikon/tt-192.png',
  '/ikon/tt-512.png',
  '/ikon/tt-180.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASET_AWAL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((kunci) => Promise.all(kunci.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  const statis = /^\/(gaya\.css|manifest\.webmanifest|ikon\/|lib\/)/.test(url.pathname);
  if (!statis) return;

  // Network-first: perubahan langsung terpakai, cache hanya cadangan offline.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const salinan = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, salinan));
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});
