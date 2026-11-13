// Tombol ikon mata untuk input password.
// Pakai: <div class="kolom-sandi"><input id="sandi" type="password">
//          <button class="lihat-sandi" data-target="sandi" type="button"></button></div>
// lalu muat /lib/sandi.js. Semua tombol ber-class lihat-sandi otomatis dipasangi ikon.
(function (global) {
  var MATA =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>' +
    '<circle cx="12" cy="12" r="3.2"/></svg>';
  var MATA_TUTUP =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round"><path d="M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-2.4 3.4"/>' +
    '<path d="M6.5 7.1C4 8.8 2.5 12 2.5 12S6 18.5 12 18.5a9.9 9.9 0 0 0 4.1-.9"/>' +
    '<path d="M9.9 9.9a3.2 3.2 0 0 0 4.2 4.2"/><path d="m3 3 18 18"/></svg>';

  function pasang(root) {
    var wadah = root || document;
    var tombol = wadah.querySelectorAll('button.lihat-sandi[data-target]');
    Array.prototype.forEach.call(tombol, function (btn) {
      if (btn.getAttribute('data-siap')) return;
      var input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;
      btn.setAttribute('data-siap', '1');
      btn.setAttribute('type', 'button');
      btn.innerHTML = MATA;
      btn.title = 'Tampilkan password';
      btn.setAttribute('aria-label', 'Tampilkan password');
      btn.addEventListener('click', function () {
        var tampil = input.type === 'password';
        input.type = tampil ? 'text' : 'password';
        btn.innerHTML = tampil ? MATA_TUTUP : MATA;
        btn.title = tampil ? 'Sembunyikan password' : 'Tampilkan password';
        btn.setAttribute('aria-label', btn.title);
        input.focus();
      });
    });
  }

  global.Sandi = { pasang: pasang };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { pasang(); });
  } else {
    pasang();
  }
})(window);
