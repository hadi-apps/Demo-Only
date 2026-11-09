/* HRIS: presensi kamera (foto + cap waktu + geotag) dan cuti berjenjang. Admin: persetujuan. */
var HRIS = (function () {
  var h = U.h, rgb = PDFLib.rgb, st = {}, pollId = null, stream = null, watchId = null;

  function isAdmin() { return API.user && API.user.role === 'admin'; }

  function mount(root) {
    st = { me: null, list: [], tab: isAdmin() ? 'approve' : 'presensi', phase: 'idle', tipe: 'Masuk', pos: null, posErr: '', shot: null, seen: {} };
    st.wrap = h('div', { class: 'page' }); root.appendChild(st.wrap);
    st.wrap.appendChild(h('div', { class: 'crumb' }, h('a', { href: '#/hub' }, '← Semua aplikasi')));
    st.wrap.appendChild(h('div', { class: 'eyebrow' }, h('i'), 'Human Resources'));
    st.wrap.appendChild(h('h1', null, 'HRIS'));
    st.wrap.appendChild(h('p', { class: 'lead' }, isAdmin()
      ? 'Panel admin: putuskan pengajuan cuti berjenjang dan pantau presensi peserta demo.'
      : 'Presensi dengan foto berstempel waktu dan lokasi, serta pengajuan cuti berjenjang. Seluruh data di sini fiktif.'));
    st.tabsEl = h('div', { class: 'tabs' }); st.wrap.appendChild(st.tabsEl);
    st.content = h('div'); st.wrap.appendChild(st.content);
    st.content.appendChild(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Memuat data...'));
    API.syncTime();
    (isAdmin() ? API.call('hris.cuti.list', { pending: true }).then(function (d) { st.list = d.cuti; })
               : API.call('hris.me').then(function (d) { st.me = d; U.setServerTime(d.now); st.list = d.cuti; }))
      .then(function () { drawTabs(); show(st.tab); })
      .catch(function (e) { U.clear(st.content); st.content.appendChild(h('div', { class: 'banner' }, e.message)); });
  }
  function unmount() { stopCam(); stopPoll(); }
  function stopPoll() { if (pollId) clearInterval(pollId); pollId = null; }

  function drawTabs() {
    U.clear(st.tabsEl);
    var tabs = isAdmin() ? [['approve', 'Persetujuan Cuti'], ['cutiall', 'Semua Pengajuan'], ['presall', 'Presensi Peserta']] : [['presensi', 'Presensi'], ['cuti', 'Pengajuan Cuti']];
    tabs.forEach(function (t) { st.tabsEl.appendChild(h('button', { class: 'tab' + (st.tab === t[0] ? ' on' : ''), onclick: function () { show(t[0]); } }, t[1])); });
  }
  function show(tab) {
    if (tab !== 'presensi') stopCam();
    stopPoll(); st.tab = tab; drawTabs(); U.clear(st.content);
    if (tab === 'presensi') buildPresensi();
    else if (tab === 'cuti') { buildCuti(); pollId = setInterval(refreshCuti, 6000); }
    else if (tab === 'approve') { buildApprove(); pollId = setInterval(refreshApprove, 8000); }
    else if (tab === 'cutiall') buildCutiAll();
    else if (tab === 'presall') buildPresAll();
  }

  function sChip(s) { return h('span', { class: 'chip ' + (s === 'Disetujui' ? 'ok' : s === 'Ditolak' ? 'bad' : 'wait') }, s); }

  /* ================= PRESENSI ================= */
  function stopCam() {
    if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
    if (watchId !== null && navigator.geolocation) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  }
  function buildPresensi() {
    st.phase = 'idle'; st.shot = null;
    st.camBox = h('div', { class: 'cam' }); st.ctrl = h('div', { style: { marginTop: '14px' } }); st.locEl = h('div', { class: 'loc' });
    st.histEl = h('div');
    st.content.appendChild(h('div', { class: 'grid2' },
      h('div', { class: 'card' }, h('h3', { style: { marginBottom: '4px' } }, 'Presensi Kamera'),
        h('div', { class: 'hint', style: { marginBottom: '12px' } }, 'Foto diambil langsung dari kamera (tanpa unggah galeri). Waktu server dan koordinat lokasi dicetak pada foto.'),
        st.camBox, st.locEl, st.ctrl,
        h('div', { class: 'hint', style: { marginTop: '10px' } }, 'Mode demo: radius lokasi kantor tidak diterapkan. Foto tidak disimpan di server, hanya hash sidik jarinya.')),
      h('div', { class: 'card' }, h('h3', { style: { marginBottom: '10px' } }, 'Riwayat Presensi'), st.histEl)));
    drawCam(); drawHist();
  }
  function drawLoc() {
    U.clear(st.locEl);
    var dot = 'wait', txt = 'Lokasi belum diaktifkan.';
    if (st.posErr) { dot = 'bad'; txt = st.posErr; }
    else if (st.pos) { dot = 'ok'; txt = 'Lokasi terkunci: ' + st.pos.lat.toFixed(5) + ', ' + st.pos.lon.toFixed(5) + ' (±' + Math.round(st.pos.acc) + ' m)'; }
    else if (st.phase === 'live') txt = 'Mencari lokasi...';
    st.locEl.appendChild(h('span', { class: 'dot ' + dot })); st.locEl.appendChild(h('span', null, txt));
  }
  function drawCam() {
    drawLoc(); U.clear(st.camBox); U.clear(st.ctrl);
    if (st.phase === 'idle') {
      st.camBox.appendChild(h('div', { class: 'ph' }, 'Kamera belum aktif'));
      st.ctrl.appendChild(h('button', { class: 'btn btn-primary', onclick: startCam }, 'Aktifkan Kamera dan Lokasi'));
    } else if (st.phase === 'live') {
      st.video = h('video', { autoplay: true, playsinline: true, muted: true }); st.video.muted = true; st.video.srcObject = stream;
      st.camBox.appendChild(st.video); st.video.play().catch(function () {});
      var sel = h('select', { style: { width: 'auto' }, onchange: function (ev) { st.tipe = ev.target.value; } },
        ['Masuk', 'Pulang'].map(function (t) { return h('option', { value: t, selected: st.tipe === t }, 'Presensi ' + t); }));
      st.ctrl.appendChild(h('div', { class: 'row' }, sel, h('button', { class: 'btn btn-sage', id: 'snapBtn', onclick: capture }, 'Ambil Foto')));
    } else if (st.phase === 'shot' || st.phase === 'sent') {
      st.camBox.appendChild(h('img', { src: st.shot.url, alt: 'Foto presensi' }));
      var row = h('div', { class: 'row' });
      if (st.phase === 'shot') row.appendChild(h('button', { class: 'btn btn-primary', onclick: sendPresensi }, 'Kirim Presensi'));
      else row.appendChild(h('span', { class: 'chip ok' }, 'Presensi tercatat'));
      row.appendChild(h('button', { class: 'btn btn-ghost', onclick: function () { U.download(st.shot.blob, 'presensi-' + st.shot.tipe.toLowerCase() + '.jpg'); } }, 'Unduh Foto'));
      row.appendChild(h('button', { class: 'btn btn-ghost', onclick: startCam }, st.phase === 'shot' ? 'Ulangi' : 'Presensi Lagi'));
      st.ctrl.appendChild(row);
      st.ctrl.appendChild(h('div', { class: 'hint', style: { marginTop: '8px' } }, 'Cap waktu foto: ' + U.fmtWib(st.shot.ts) + ' · Hash: ' + st.shot.hash.slice(0, 16) + '...'));
    }
  }
  async function startCam() {
    stopCam(); st.pos = null; st.posErr = ''; st.shot = null;
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { U.toast('Kamera dan lokasi memerlukan koneksi aman (HTTPS).', 'err'); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } }, audio: false });
    } catch (e) {
      U.toast(e && e.name === 'NotFoundError' ? 'Kamera tidak ditemukan pada perangkat ini.' : 'Izin kamera ditolak. Aktifkan izin kamera pada pengaturan browser, lalu coba lagi.', 'err'); return;
    }
    st.phase = 'live';
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(function (p) {
        st.pos = { lat: p.coords.latitude, lon: p.coords.longitude, acc: p.coords.accuracy || 0 }; st.posErr = ''; drawLoc();
      }, function (err) {
        st.posErr = err && err.code === 1 ? 'Izin lokasi ditolak. Aktifkan izin lokasi lalu aktifkan kamera lagi.' : 'Lokasi tidak tersedia. Pastikan GPS aktif.'; drawLoc();
      }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
    } else st.posErr = 'Perangkat tidak mendukung geolokasi.';
    drawCam();
  }

  async function capture(ev) {
    if (!st.pos) { U.toast('Lokasi belum terkunci. Tunggu sebentar atau periksa izin lokasi.', 'err'); return; }
    var v = st.video; if (!v || !v.videoWidth) { U.toast('Kamera belum siap.', 'err'); return; }
    U.busy(ev.target, true, 'Memproses...');
    var scale = Math.min(1, 960 / v.videoWidth), W = Math.round(v.videoWidth * scale), H = Math.round(v.videoHeight * scale);
    var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
    x.drawImage(v, 0, 0, W, H);
    var ts = U.nowServer(), pos = { lat: st.pos.lat, lon: st.pos.lon, acc: st.pos.acc }, tipe = st.tipe, u = API.user;
    /* watermark miring (kiri-bawah ke kanan-atas) */
    x.save(); x.translate(W / 2, H / 2); x.rotate(-30 * Math.PI / 180);
    var fs = Math.max(11, Math.round(W / 38)); x.font = '700 ' + fs + 'px Inter, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = 'rgba(255,255,255,0.38)'; x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = 3;
    var diag = Math.sqrt(W * W + H * H), gap = fs * 5, tw = x.measureText(U.WM_TEXT).width + fs * 2, row = 0;
    for (var yy = -diag / 2; yy < diag / 2; yy += gap, row++) for (var xx = -diag / 2 - (row % 2) * tw / 2; xx < diag / 2; xx += tw) x.fillText(U.WM_TEXT, xx, yy);
    x.restore(); x.shadowBlur = 0;
    /* bilah cap waktu & geotag */
    var bar = Math.round(H * 0.2), f1 = Math.max(12, Math.round(W / 30)), f2 = Math.max(11, Math.round(W / 38));
    x.fillStyle = 'rgba(20,30,40,0.78)'; x.fillRect(0, H - bar, W, bar);
    x.fillStyle = '#fff'; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
    x.font = '700 ' + f1 + 'px Inter, Arial, sans-serif'; x.fillText(u.nama + '  ·  PRESENSI ' + tipe.toUpperCase(), 14, H - bar + f1 + 8);
    x.font = '500 ' + f2 + 'px Inter, Arial, sans-serif';
    x.fillText(U.fmtWib(ts), 14, H - bar + f1 + f2 + 16);
    x.fillText('Lat ' + pos.lat.toFixed(6) + '   Lon ' + pos.lon.toFixed(6) + '   (±' + Math.round(pos.acc) + ' m)', 14, H - bar + f1 + 2 * f2 + 24);
    try {
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.88); });
      var hash = await U.sha256Hex(await blob.arrayBuffer());
      st.shot = { blob: blob, url: URL.createObjectURL(blob), hash: hash, ts: ts, pos: pos, tipe: tipe };
      stopCam(); st.phase = 'shot'; drawCam();
    } catch (e) { U.busy(ev.target, false); U.toast('Gagal memproses foto.', 'err'); }
  }
  function sendPresensi(ev) {
    var s = st.shot; U.busy(ev.target, true, 'Mengirim...');
    API.call('hris.presensi', { tipe: s.tipe, lat: s.pos.lat, lon: s.pos.lon, acc: s.pos.acc, hash: s.hash }).then(function (row) {
      st.me.presensi.unshift(row); st.phase = 'sent'; drawCam(); drawHist(); U.toast('Presensi tercatat: ' + row.tsText, 'ok');
    }).catch(function (e) { U.busy(ev.target, false); U.toast(e.message, 'err'); });
  }
  function drawHist() {
    U.clear(st.histEl);
    if (!st.me.presensi.length) { st.histEl.appendChild(h('div', { class: 'empty' }, 'Belum ada presensi.')); return; }
    st.me.presensi.slice(0, 12).forEach(function (p) {
      st.histEl.appendChild(h('div', { class: 'list-item' },
        h('div', null, h('b', null, 'Presensi ' + p.tipe), ' ', p.seed ? h('span', { class: 'chip seed' }, 'Contoh') : null,
          h('div', { class: 'hint', style: { marginTop: '2px' } }, p.tsText),
          h('div', { class: 'hint mono', style: { marginTop: '2px' } }, p.lat.toFixed(5) + ', ' + p.lon.toFixed(5) + ' · ' + (p.hash && p.hash.length > 12 ? p.hash.slice(0, 12) + '...' : p.hash))),
        h('span', { class: 'chip ' + (p.tipe === 'Masuk' ? 'ok' : 'neutral') }, p.tipe)));
    });
  }

  /* ================= CUTI (user) ================= */
  function levels() { return (st.me && st.me.levels) || ['Atasan Langsung', 'Manager HRGA & IT', 'Direktur']; }
  function buildCuti() {
    var today = U.ymd(U.nowServer()), tomorrow = U.ymd(U.nowServer() + 86400000);
    var jenis = h('select', null, ['Cuti Tahunan', 'Cuti Penting', 'Izin'].map(function (j) { return h('option', { value: j }, j); }));
    var a = h('input', { type: 'date', min: today, value: tomorrow }), b = h('input', { type: 'date', min: today, value: tomorrow });
    var ket = h('textarea', { placeholder: 'Contoh: keperluan keluarga', maxlength: '200' });
    var info = h('div', { class: 'hint' });
    function upd() { var n = U.workdays(a.value, b.value); info.textContent = n ? 'Jumlah hari kerja: ' + n + ' hari (Senin-Jumat)' : 'Rentang tanggal tidak valid atau hanya berisi akhir pekan.'; }
    a.addEventListener('change', function () { if (b.value < a.value) b.value = a.value; upd(); }); b.addEventListener('change', upd); upd();
    st.quotaEl = h('div'); st.listEl = h('div');
    var form = h('div', { class: 'card' }, h('h3', { style: { marginBottom: '4px' } }, 'Ajukan Cuti'), st.quotaEl,
      h('div', { class: 'field' }, h('label', { class: 'f' }, 'Jenis'), jenis),
      h('div', { class: 'grid2', style: { gap: '10px' } }, h('div', { class: 'field' }, h('label', { class: 'f' }, 'Mulai'), a), h('div', { class: 'field' }, h('label', { class: 'f' }, 'Selesai'), b)),
      info, h('div', { class: 'field', style: { marginTop: '12px' } }, h('label', { class: 'f' }, 'Keperluan'), ket),
      h('button', { class: 'btn btn-primary', onclick: function (ev) {
        U.busy(ev.target, true, 'Mengajukan...');
        API.call('hris.cuti.submit', { jenis: jenis.value, mulai: a.value, selesai: b.value, keperluan: ket.value }).then(function (c) {
          st.list.unshift(c); st.seen[c.id] = c.status; ket.value = ''; U.toast('Pengajuan terkirim. Menunggu persetujuan berjenjang.', 'ok'); refreshQuota(); drawCutiList();
        }).catch(function (e) { U.toast(e.message, 'err'); }).then(function () { U.busy(ev.target, false); });
      } }, 'Ajukan Cuti'),
      h('div', { class: 'hint', style: { marginTop: '10px' } }, 'Persetujuan berjenjang: ' + levels().join(' → ') + '. Silakan tunggu, admin akan memprosesnya.'));
    st.content.appendChild(h('div', { class: 'grid2', style: { alignItems: 'start' } }, form, h('div', { class: 'card' }, h('h3', { style: { marginBottom: '10px' } }, 'Pengajuan Saya'), st.listEl)));
    st.list.forEach(function (c) { st.seen[c.id] = c.status; });
    refreshQuota(); drawCutiList();
  }
  function refreshQuota() {
    if (!st.quotaEl || !st.me) return;
    var used = 0; st.list.forEach(function (c) { if (c.jenis === 'Cuti Tahunan' && (c.status === 'Disetujui' || c.status.indexOf('Menunggu') === 0)) used += c.hari; });
    st.me.quota = { total: 12, terpakai: used, sisa: Math.max(0, 12 - used) };
    U.clear(st.quotaEl); st.quotaEl.appendChild(h('div', { class: 'hint', style: { marginBottom: '12px' } }, 'Sisa cuti tahunan: ', h('b', null, st.me.quota.sisa + ' dari ' + st.me.quota.total + ' hari')));
  }
  function refreshCuti() {
    API.call('hris.cuti.list').then(function (d) {
      d.cuti.forEach(function (c) {
        if (st.seen[c.id] && st.seen[c.id] !== c.status) U.toast('Pengajuan ' + c.id + ': ' + c.status, c.status === 'Ditolak' ? 'err' : 'ok');
        st.seen[c.id] = c.status;
      });
      st.list = d.cuti; refreshQuota(); drawCutiList();
    }).catch(function () {});
  }
  function stepper(c) {
    var lv = levels();
    return h('div', { class: 'stepper' }, lv.map(function (label, i) {
      var rec = c.riwayat.filter(function (r) { return r.level === i + 1; })[0], cls = '', sub = '';
      if (rec) { cls = rec.keputusan === 'Disetujui' ? 'done' : 'rej'; sub = rec.tsText.replace(' WIB', ''); }
      else if (c.status.indexOf('Menunggu') === 0 && c.level === i + 1) { cls = 'cur'; sub = 'menunggu'; }
      return h('div', { class: 'sp-step ' + cls }, h('b', null, label), h('small', null, sub));
    }));
  }
  function drawCutiList() {
    if (!st.listEl) return; U.clear(st.listEl);
    if (!st.list.length) { st.listEl.appendChild(h('div', { class: 'empty' }, 'Belum ada pengajuan.')); return; }
    st.list.forEach(function (c) {
      var rej = c.riwayat.filter(function (r) { return r.keputusan === 'Ditolak'; })[0];
      st.listEl.appendChild(h('div', { class: 'cuti-card' },
        h('div', { class: 'cuti-head' }, h('div', null, h('b', null, c.jenis), ' ', c.seed ? h('span', { class: 'chip seed' }, 'Contoh') : null,
          h('div', { class: 'hint mono', style: { marginTop: '1px' } }, c.id)), sChip(c.status)),
        h('div', { style: { fontSize: '14px', margin: '8px 0 2px' } }, U.fmtTanggal(c.mulai) + (c.selesai !== c.mulai ? ' s.d. ' + U.fmtTanggal(c.selesai) : '') + ' · ' + c.hari + ' hari kerja'),
        h('div', { class: 'hint', style: { marginTop: 0 } }, c.keperluan.trim()),
        stepper(c),
        rej && rej.catatan ? h('div', { class: 'hint' }, 'Catatan penolakan: ' + rej.catatan) : null,
        c.status === 'Disetujui' ? h('div', { style: { marginTop: '10px' } }, h('button', { class: 'btn btn-sage sm', onclick: function (ev) { downloadCuti(c, ev.target); } }, 'Unduh Formulir (PDF)')) : null));
    });
  }

  async function downloadCuti(c, btn) {
    U.busy(btn, true, 'Menyusun PDF...');
    try {
      var d = await PK.newDoc(), w = new PK.Writer(d.doc, d.fonts), u = API.user;
      w.text('FORMULIR PENGAJUAN CUTI / IZIN', { size: 16, bold: true, gap: 2 });
      w.text('Versi demo. Dokumen ini bukan dokumen resmi dan seluruh datanya fiktif.', { size: 9, color: PK.colors.MUT, gap: 8 }); w.rule();
      w.kv('No. Pengajuan', c.id); w.kv('Nama', u.nama); w.kv('Jabatan', u.jabatan); w.kv('Jenis', c.jenis);
      w.kv('Periode', U.fmtTanggal(c.mulai) + (c.selesai !== c.mulai ? ' s.d. ' + U.fmtTanggal(c.selesai) : '')); w.kv('Jumlah hari kerja', c.hari + ' hari');
      w.kv('Keperluan', c.keperluan.trim()); w.kv('Diajukan', c.diajukanText); w.kv('Status', c.status); w.rule(12);
      w.text('Riwayat Persetujuan Berjenjang', { size: 12, bold: true, gap: 6 });
      c.riwayat.forEach(function (r) {
        w.text(r.level + '. ' + r.label + ': ' + r.keputusan + ' oleh ' + r.oleh + ' pada ' + r.tsText + (r.catatan ? ' (catatan: ' + r.catatan + ')' : ''), { size: 10, gap: 4 });
      });
      w.y -= 10; w.ensure(110);
      var bw = (w.W - w.m * 2 - 20) / 3, top = w.y;
      levels().forEach(function (label, i) {
        var r = c.riwayat.filter(function (x) { return x.level === i + 1; })[0], x0 = w.m + i * (bw + 10);
        w.page.drawRectangle({ x: x0, y: top - 92, width: bw, height: 92, borderColor: rgb(0.8, 0.78, 0.72), borderWidth: 0.8 });
        w.page.drawText(PK.safe(label), { x: x0 + 8, y: top - 16, size: 9.5, font: d.fonts.bold, color: PK.colors.INK });
        w.page.drawText(r ? 'Disetujui secara elektronik' : '-', { x: x0 + 8, y: top - 40, size: 8.5, font: d.fonts.reg, color: PK.colors.SAGE });
        w.page.drawText(PK.safe(r ? r.oleh : ''), { x: x0 + 8, y: top - 60, size: 10, font: d.fonts.bold, color: PK.colors.INK });
        w.page.drawText(PK.safe(r ? r.tsText : ''), { x: x0 + 8, y: top - 76, size: 8, font: d.fonts.reg, color: PK.colors.MUT });
      });
      w.y = top - 106;
      var last = c.riwayat.length ? c.riwayat[c.riwayat.length - 1].ts : c.diajukan;
      var code = (await U.sha256Hex(new TextEncoder().encode(c.id + '|' + c.status + '|' + last))).slice(0, 12).toUpperCase();
      w.text('Kode verifikasi demo: ' + code, { size: 9.5, color: PK.colors.MUT });
      PK.footerAll(d.doc, d.fonts.reg, 'Formulir Cuti (Demo) ' + c.id);
      PK.watermark(d.doc, d.fonts.bold);
      U.download(new Blob([await d.doc.save()], { type: 'application/pdf' }), 'Formulir-Cuti-' + c.id + '.pdf');
      API.track('hris', 'unduh formulir cuti');
    } catch (e) { console.error(e); U.toast('Gagal membuat PDF: ' + e.message, 'err'); }
    U.busy(btn, false);
  }

  /* ================= ADMIN ================= */
  function buildApprove() { st.listEl = h('div'); st.content.appendChild(st.listEl); drawApprove(); }
  function refreshApprove() {
    API.call('hris.cuti.list', { pending: true }).then(function (d) { var changed = d.cuti.length !== st.list.length || d.cuti.some(function (c, i) { return !st.list[i] || st.list[i].status !== c.status; }); st.list = d.cuti; if (changed && !document.activeElement.matches('input,textarea')) drawApprove(); }).catch(function () {});
  }
  function drawApprove() {
    U.clear(st.listEl);
    var pend = st.list.filter(function (c) { return c.status.indexOf('Menunggu') === 0; });
    if (!pend.length) { st.listEl.appendChild(h('div', { class: 'card' }, h('div', { class: 'empty' }, 'Tidak ada pengajuan yang menunggu. Halaman ini diperbarui otomatis.'))); return; }
    var lv = ['Atasan Langsung', 'Manager HRGA & IT', 'Direktur'];
    pend.forEach(function (c) {
      var note = h('input', { type: 'text', placeholder: 'Catatan (opsional)', maxlength: '120' }), label = lv[c.level - 1];
      function decide(dec, btn) {
        U.busy(btn, true, '...');
        API.call('hris.cuti.decide', { id: c.id, decision: dec, catatan: note.value }).then(function (r) {
          U.toast(dec === 'setuju' ? 'Disetujui sebagai ' + label + '. Status: ' + r.status : 'Pengajuan ditolak.', 'ok'); refreshApprove();
        }).catch(function (e) { U.busy(btn, false); U.toast(e.message, 'err'); });
      }
      st.listEl.appendChild(h('div', { class: 'card' },
        h('div', { class: 'cuti-head' }, h('div', null, h('b', null, c.nama + ' · ' + c.jenis), h('div', { class: 'hint mono', style: { marginTop: '1px' } }, c.id + ' · perangkat ' + String(c.device).slice(0, 6))), sChip(c.status)),
        h('div', { style: { margin: '8px 0 2px', fontSize: '14px' } }, U.fmtTanggal(c.mulai) + (c.selesai !== c.mulai ? ' s.d. ' + U.fmtTanggal(c.selesai) : '') + ' · ' + c.hari + ' hari kerja'),
        h('div', { class: 'hint', style: { marginTop: 0 } }, c.keperluan.trim() + ' · diajukan ' + c.diajukanText),
        stepper(c),
        h('div', { class: 'row', style: { marginTop: '10px' } }, note,
          h('button', { class: 'btn btn-sage sm', onclick: function (ev) { decide('setuju', ev.target); } }, 'Setujui sebagai ' + label),
          h('button', { class: 'btn btn-danger sm', onclick: function (ev) { decide('tolak', ev.target); } }, 'Tolak'))));
    });
  }
  function table(cols, rows) {
    return h('div', { class: 'scroll-x' }, h('table', { class: 't' }, h('thead', null, h('tr', null, cols.map(function (c) { return h('th', null, c); }))),
      h('tbody', null, rows.map(function (r) { return h('tr', null, r.map(function (cell) { return h('td', null, cell); })); }))));
  }
  function buildCutiAll() {
    var box = h('div', { class: 'card' }, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Memuat...')); st.content.appendChild(box);
    API.call('hris.cuti.list').then(function (d) {
      U.clear(box);
      if (!d.cuti.length) { box.appendChild(h('div', { class: 'empty' }, 'Belum ada pengajuan dari peserta.')); return; }
      box.appendChild(table(['No.', 'Peserta', 'Jenis', 'Periode', 'Hari', 'Status'], d.cuti.map(function (c) { return [h('span', { class: 'mono' }, c.id), c.nama + ' (' + String(c.device).slice(0, 6) + ')', c.jenis, U.fmtTanggal(c.mulai) + ' - ' + U.fmtTanggal(c.selesai), String(c.hari), sChip(c.status)]; })));
    }).catch(function (e) { U.clear(box); box.appendChild(h('div', { class: 'empty' }, e.message)); });
  }
  function buildPresAll() {
    var box = h('div', { class: 'card' }, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Memuat...')); st.content.appendChild(box);
    API.call('hris.presensi.all').then(function (d) {
      U.clear(box);
      if (!d.presensi.length) { box.appendChild(h('div', { class: 'empty' }, 'Belum ada presensi dari peserta.')); return; }
      box.appendChild(table(['Waktu', 'Peserta', 'Jenis', 'Lokasi', 'Hash foto'], d.presensi.map(function (p) {
        return [p.tsText, p.nama + ' (' + String(p.device).slice(0, 6) + ')', p.tipe,
          h('a', { href: 'https://www.google.com/maps?q=' + p.lat + ',' + p.lon, target: '_blank', rel: 'noopener' }, p.lat.toFixed(5) + ', ' + p.lon.toFixed(5) + ' (±' + p.acc + ' m)'), h('span', { class: 'mono' }, p.hash.slice(0, 14) + '...')];
      })));
    }).catch(function (e) { U.clear(box); box.appendChild(h('div', { class: 'empty' }, e.message)); });
  }

  return { mount: mount, unmount: unmount };
})();
