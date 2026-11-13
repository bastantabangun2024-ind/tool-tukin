// Daftarkan service worker supaya Tool Tukin bisa dipasang dari Chrome.
(function () {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {
      // Gagal daftar tidak mengganggu pemakaian situs.
    });
  });
})();
