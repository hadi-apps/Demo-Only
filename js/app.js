/* Router, kerangka halaman, login, dan hub */
(function () {
  var h = U.h, app = document.getElementById('app'), current = null, pending = null;
  var ICON = {
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/><path d="M12 15v2"/>',
    tes: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/><path d="M9 14l2 2 4-4"/>',
    hris: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.4"/><path d="M16 14.2c2.9 0 5 2 5 4.8"/>',
    chart: '<path d="M5 20V11M11 20V4M17 20v-6M3 20h18"/>'
  };
  var ROUTES = { pdflocker: PDFLocker, tes: Tes, hris: HRIS, aktivitas: Admin };

  function route() { return (location.hash.replace(/^#\/?/, '') || '').split('?')[0]; }
  function go(r) { location.hash = '#/' + r; }

  function shell() {
    U.clear(app);
    var u = API.user;
    app.appendChild(h('header', { class: 'topbar' }, h('div', { class: 'in' },
      h('a', { class: 'brand', href: '#/hub' }, h('span', { class: 'mark' }, 'D'), 'Demo Aplikasi'),
      h('div', { class: 'sp' }),
      u ? h('div', { class: 'user-chip' }, h('b', null, u.nama), u.role === 'admin' ? 'Admin' : u.jabatan) : null,
      u ? h('button', { class: 'btn-top', onclick: logout }, 'Keluar') : null)));
    var body = h('main'); app.appendChild(body);
    app.appendChild(h('div', { class: 'foot' }, 'Aplikasi demo ini adalah properti pribadi Deiky Catur Hadi. Seluruh data bersifat fiktif.'));
    return body;
  }

  function logout() {
    API.call('logout').catch(function () {}).then(function () { API.setSession(null, null); go('login'); });
  }

  function login(body) {
    var next = pending && pending !== 'login' ? pending : 'hub';
    var userIn = h('input', { type: 'text', id: 'u', autocomplete: 'username', autocapitalize: 'none', spellcheck: 'false' });
    var passIn = h('input', { type: 'password', id: 'p', autocomplete: 'current-password' });
    var err = h('div', { class: 'hint', style: { color: 'var(--bad)', minHeight: '18px' } });
    function submit(ev) {
      if (ev) ev.preventDefault();
      var btn = document.getElementById('loginBtn'); U.busy(btn, true, 'Masuk...'); err.textContent = '';
      API.call('login', { username: userIn.value, password: passIn.value }).then(function (d) {
        API.setSession(d.token, d.user); pending = null; go(next);
      }).catch(function (e) { err.textContent = e.message; U.busy(btn, false); });
    }
    body.appendChild(h('div', { class: 'login-wrap' },
      h('div', null,
        h('div', { class: 'eyebrow' }, h('i'), 'Demo Aplikasi'),
        h('h1', null, 'Coba langsung aplikasi yang saya bangun.'),
        h('p', { class: 'lead', style: { marginBottom: '14px' } }, 'Tiga aplikasi internal dalam versi demo: PDFlocker, Tes Tulis Daring, dan HRIS. Anda bebas mencobanya, dan seluruh data di dalamnya fiktif.'),
        h('div', { class: 'tags' }, ['Tanpa instalasi', 'Data fiktif', 'Berkas PDF diproses di perangkat Anda'].map(function (t) { return h('span', { class: 'tag' }, t); }))),
      h('form', { class: 'card', onsubmit: submit },
        h('h3', { style: { marginBottom: '14px' } }, 'Masuk'),
        h('div', { class: 'field' }, h('label', { class: 'f', for: 'u' }, 'Username'), userIn),
        h('div', { class: 'field' }, h('label', { class: 'f', for: 'p' }, 'Password'), passIn),
        err,
        h('button', { class: 'btn btn-primary', id: 'loginBtn', type: 'submit', style: { width: '100%' } }, 'Masuk'),
        h('div', { class: 'demo-hint' }, h('b', null, 'Akun Demo'),
          h('button', { class: 'demo-link', type: 'button', onclick: function () { userIn.value = 'akundemo'; passIn.value = 'akundemo'; err.textContent = ''; } }, 'Klik Di Sini')))));
  }

  function hub(body) {
    var u = API.user, wrap = h('div', { class: 'page' }); body.appendChild(wrap);
    wrap.appendChild(h('div', { class: 'eyebrow' }, h('i'), 'Selamat datang, ' + u.nama));
    wrap.appendChild(h('h1', null, 'Pilih aplikasi demo'));
    wrap.appendChild(h('p', { class: 'lead' }, 'Silakan coba satu per satu. Setiap halaman diberi watermark, dan semua data hanya contoh.'));
    if (!API.remote()) wrap.appendChild(h('div', { class: 'banner' }, 'Mode lokal: server demo belum dihubungkan, jadi data hanya tersimpan di browser ini.'));
    function card(href, color, soft, icon, title, desc, tags, cta) {
      return h('a', { class: 'card app-card', href: '#/' + href, style: { '--c': color, '--soft': soft } },
        h('div', { class: 'ico' }, U.icon(icon, 24)), h('h3', null, title), h('p', null, desc),
        h('div', { class: 'tags' }, tags.map(function (t) { return h('span', { class: 'tag' }, t); })), h('div', { class: 'cta' }, cta + ' →'));
    }
    var cards = [
      card('pdflocker', '#5C8A77', '#E3EDE8', ICON.lock, 'PDFlocker', 'Mengunci PDF hasil pasien. Tanggal pada dokumen otomatis menjadi kata sandi, atau Anda tentukan sendiri.', ['Core Bisnis', 'Diproses di perangkat'], 'Coba PDFlocker'),
      card('tes', '#3E5C76', '#E6ECF1', ICON.tes, 'Tes Tulis Daring', 'Tes soft skill dan administrasi umum dengan nilai otomatis, lalu unduh laporan hasilnya sebagai PDF.', ['Human Resources', '13 soal · 10 menit'], 'Mulai tes'),
      card('hris', '#3E5C76', '#E6ECF1', ICON.hris, 'HRIS', 'Presensi dengan foto berstempel waktu dan lokasi, serta pengajuan cuti berjenjang yang disetujui admin.', ['Human Resources', 'Paling pas di HP'], u.role === 'admin' ? 'Buka panel admin' : 'Coba HRIS')
    ];
    if (u.role === 'admin') cards.push(card('aktivitas', '#A98C5A', '#F0E9DA', ICON.chart, 'Aktivitas Demo', 'Ringkasan pemakaian demo oleh pengunjung. Khusus admin.', ['Admin'], 'Lihat aktivitas'));
    wrap.appendChild(h('div', { class: 'grid3' }, cards));
  }

  function render() {
    if (current && current.unmount) { try { current.unmount(); } catch (e) {} }
    current = null;
    var r = route(), body = shell();
    if (!API.user && r !== 'login') { pending = r || null; if (r) { go('login'); return; } }
    if (r === '' ) { go(API.user ? 'hub' : 'login'); return; }
    if (r === 'login') { if (API.user) { go('hub'); return; } login(body); return; }
    if (!API.user) { go('login'); return; }
    if (r === 'hub') { hub(body); return; }
    if (r === 'aktivitas' && API.user.role !== 'admin') { go('hub'); return; }
    var mod = ROUTES[r];
    if (!mod) { go('hub'); return; }
    current = mod; mod.mount(body);
    window.scrollTo(0, 0);
  }

  API.onSessionLost(function () { U.toast('Sesi berakhir. Silakan masuk kembali.', 'err'); go('login'); });
  window.addEventListener('hashchange', render);
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(U.mountWatermark, 200); });
  U.mountWatermark(); API.syncTime(); render();
})();
