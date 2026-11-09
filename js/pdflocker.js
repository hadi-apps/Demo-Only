/* PDFlocker: kunci PDF dengan kata sandi dari tanggal pada dokumen (diproses di browser) */
var PDFLocker = (function () {
  var h = U.h;
  var MON = { januari: 1, jan: 1, februari: 2, pebruari: 2, feb: 2, maret: 3, mar: 3, april: 4, apr: 4, mei: 5, may: 5, juni: 6, jun: 6, juli: 7, jul: 7,
    agustus: 8, agu: 8, agt: 8, aug: 8, september: 9, sep: 9, sept: 9, oktober: 10, okt: 10, oct: 10, november: 11, nov: 11, nop: 11, desember: 12, des: 12, dec: 12,
    january: 1, february: 2, march: 3, june: 6, july: 7, august: 8, october: 10, december: 12 };
  var state = {};

  function validDate(d, m, y) {
    if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
    var t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
  }
  function p2(n) { return (n < 10 ? '0' : '') + n; }

  /* cari tanggal pada teks; utamakan yang berlabel "lahir" */
  function detectDate(text) {
    var c = [], m, t = text.replace(/\s+/g, ' ');
    function push(idx, len, d, mo, y) { if (validDate(d, mo, y)) c.push({ idx: idx, len: len, d: d, m: mo, y: y }); }
    function pushM(m, g) { var off = m.index + m[1].length; push(off, m[0].length - m[1].length, g[0], g[1], g[2]); }
    var A = /(^|\D)(\d{1,2}) ?[\/\-.] ?(\d{1,2}) ?[\/\-.] ?(\d{4})(?!\d)/g;
    while ((m = A.exec(t))) pushM(m, [+m[2], +m[3], +m[4]]);
    var B = /(^|\D)(\d{4}) ?[\/\-.] ?(\d{1,2}) ?[\/\-.] ?(\d{1,2})(?!\d)/g;
    while ((m = B.exec(t))) pushM(m, [+m[4], +m[3], +m[2]]);
    var C = /(^|\D)(\d{1,2}) ([A-Za-z]{3,10})\.?,? (\d{4})(?!\d)/g;
    while ((m = C.exec(t))) { var mo = MON[m[3].toLowerCase()]; if (mo) pushM(m, [+m[2], mo, +m[4]]); }
    if (!c.length) return null;
    c.sort(function (a, b) { return a.idx - b.idx; });
    var chosen = null, labeled = false;
    for (var i = 0; i < c.length; i++) {
      var before = t.slice(Math.max(0, c[i].idx - 45), c[i].idx);
      if (/(tgl\.?|tanggal)\s*lahir|lahir|\bdob\b|birth|\bttl\b/i.test(before)) { chosen = c[i]; labeled = true; break; }
    }
    if (!chosen) chosen = c[0];
    return { d: chosen.d, m: chosen.m, y: chosen.y, password: p2(chosen.d) + p2(chosen.m) + chosen.y, labeled: labeled, count: c.length,
             context: t.slice(Math.max(0, chosen.idx - 22), chosen.idx + chosen.len + 2).trim() };
  }

  async function extractText(bytes) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    var pdf;
    try { pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise; }
    catch (e) {
      if (e && e.name === 'PasswordException') throw new Error('PDF ini sudah dilindungi kata sandi. Gunakan PDF yang belum terkunci.');
      throw new Error('Berkas tidak dapat dibaca sebagai PDF.');
    }
    var out = '', n = Math.min(pdf.numPages, 10);
    for (var i = 1; i <= n; i++) {
      var pg = await pdf.getPage(i), tc = await pg.getTextContent();
      out += tc.items.map(function (it) { return it.str; }).join(' ') + ' ';
    }
    return { text: out, pages: pdf.numPages };
  }

  function randomOwner() {
    var a = new Uint8Array(18); crypto.getRandomValues(a);
    return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  async function lockPdf(bytes, password) {
    var doc = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    var font = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
    PK.watermark(doc, font);
    doc.encrypt({ userPassword: password, ownerPassword: randomOwner(),
      permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false, fillingForms: false, contentAccessibility: true, documentAssembly: false } });
    return new Uint8Array(await doc.save());
  }
  async function verify(out, password) {
    var needs = false, opens = false;
    try { await pdfjsLib.getDocument({ data: out.slice(0) }).promise; } catch (e) { needs = !!(e && e.name === 'PasswordException'); }
    try { var d = await pdfjsLib.getDocument({ data: out.slice(0), password: password }).promise; opens = d.numPages > 0; } catch (e) { opens = false; }
    return needs && opens;
  }

  function mount(root) {
    state = { name: '', bytes: null, det: null, manual: false, out: null };
    var wrap = h('div', { class: 'page' });
    root.appendChild(wrap);
    wrap.appendChild(h('div', { class: 'crumb' }, h('a', { href: '#/hub' }, '← Semua aplikasi')));
    wrap.appendChild(h('div', { class: 'eyebrow' }, h('i'), 'Core Bisnis · Laboratorium'));
    wrap.appendChild(h('h1', null, 'PDFlocker'));
    wrap.appendChild(h('p', { class: 'lead' }, 'Mengunci PDF hasil pasien secara otomatis. Bila dokumen memuat tanggal, tanggal itu dipakai sebagai kata sandi. Bila tidak ada, Anda memasukkan kata sandi sendiri.'));
    wrap.appendChild(h('div', { class: 'banner' }, 'Berkas diproses di perangkat Anda dan tidak diunggah ke server. Gunakan PDF apa saja, atau pilih contoh dokumen fiktif di bawah.'));
    state.stepsEl = h('div', { class: 'steps' });
    wrap.appendChild(state.stepsEl);
    state.body = h('div');
    wrap.appendChild(state.body);
    drawSteps(1); drawUpload();
  }
  function drawSteps(n) {
    U.clear(state.stepsEl);
    ['Unggah PDF', 'Kata sandi', 'Unduh hasil'].forEach(function (t, i) {
      state.stepsEl.appendChild(h('div', { class: 'step' + (i + 1 <= n ? ' on' : '') }, h('b', null, String(i + 1)), t));
    });
  }

  function drawUpload() {
    drawSteps(1); U.clear(state.body);
    var input = h('input', { type: 'file', accept: 'application/pdf,.pdf', style: { display: 'none' } });
    var dz = h('div', { class: 'dz' },
      h('div', { class: 'serif', style: { fontSize: '19px', marginBottom: '6px' } }, 'Tarik PDF ke sini'),
      h('div', { class: 'hint', style: { marginBottom: '14px' } }, 'atau pilih berkas dari perangkat (maks. 15 MB)'),
      h('button', { class: 'btn btn-primary', onclick: function () { input.click(); } }, 'Pilih PDF'), input);
    ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
    dz.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });
    input.addEventListener('change', function () { if (input.files[0]) handleFile(input.files[0]); });
    state.body.appendChild(h('div', { class: 'card' }, dz,
      h('div', { class: 'row', style: { marginTop: '14px', justifyContent: 'center' } },
        h('span', { class: 'hint' }, 'Belum punya PDF? Coba contoh fiktif:'),
        h('button', { class: 'btn btn-ghost sm', onclick: function () { useSample(true); } }, 'Contoh dengan tanggal lahir'),
        h('button', { class: 'btn btn-ghost sm', onclick: function () { useSample(false); } }, 'Contoh tanpa tanggal'))));
  }

  async function useSample(withDate) {
    try { var b = await PK.sampleLab(withDate); await loaded(withDate ? 'contoh-hasil-lab.pdf' : 'contoh-hasil-lab-tanpa-tanggal.pdf', b); }
    catch (e) { U.toast('Gagal membuat contoh: ' + e.message, 'err'); }
  }
  async function handleFile(file) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') { U.toast('Berkas harus berformat PDF.', 'err'); return; }
    if (file.size > 15 * 1048576) { U.toast('Ukuran berkas melebihi 15 MB.', 'err'); return; }
    try { await loaded(file.name, new Uint8Array(await file.arrayBuffer())); } catch (e) { U.toast(e.message, 'err'); }
  }
  async function loaded(name, bytes) {
    U.clear(state.body); state.body.appendChild(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Membaca dokumen...'));
    var info;
    try { info = await extractText(bytes); } catch (e) { drawUpload(); throw e; }
    state.name = name; state.bytes = bytes; state.pages = info.pages; state.det = detectDate(info.text); state.manual = !state.det;
    API.track('pdflocker', 'unggah pdf');
    drawPassword();
  }

  function drawPassword() {
    drawSteps(2); U.clear(state.body);
    var det = state.det, card = h('div', { class: 'card' });
    card.appendChild(h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '12px' } },
      h('div', null, h('b', null, state.name), h('div', { class: 'hint' }, state.pages + ' halaman · ' + U.fmtSize(state.bytes.length))),
      h('button', { class: 'btn btn-ghost sm', onclick: drawUpload }, 'Ganti berkas')));
    var pwInput = h('input', { type: 'text', id: 'pw', placeholder: 'Minimal 4 karakter', maxlength: '32', autocomplete: 'off' });
    if (!state.manual && det) {
      var tgl = det.d + ' ' + U.BULAN_PANJANG[det.m - 1] + ' ' + det.y;
      card.appendChild(h('div', { class: 'pw-box' },
        h('div', null,
          h('div', { class: 'hint', style: { marginTop: 0 } }, 'Tanggal terdeteksi' + (det.labeled ? ' (dekat label "lahir")' : (det.count > 1 ? ' (tanggal pertama dari ' + det.count + ' tanggal)' : ''))),
          h('div', { style: { fontWeight: '600', fontSize: '16px', margin: '2px 0 6px' } }, tgl),
          h('div', { class: 'hint', style: { marginTop: 0 } }, 'Kata sandi (format HHBBTTTT)')),
        h('div', { class: 'pw-val' }, det.password)));
      card.appendChild(h('div', { class: 'hint', style: { margin: '8px 0 14px' } }, 'Cuplikan: "' + det.context + '"'));
      card.appendChild(h('div', { class: 'row' },
        h('button', { class: 'btn btn-sage', onclick: function () { doLock(det.password, 'otomatis dari tanggal'); } }, 'Kunci PDF dengan kata sandi ini'),
        h('button', { class: 'btn btn-ghost', onclick: function () { state.manual = true; drawPassword(); } }, 'Pakai kata sandi lain')));
    } else {
      card.appendChild(h('div', { class: 'banner', style: { marginBottom: '14px' } }, det ? 'Masukkan kata sandi sendiri.' : 'Dokumen ini tidak memuat tanggal yang dapat dibaca, jadi kata sandi tidak dapat dibuat otomatis. Silakan masukkan kata sandi.'));
      card.appendChild(h('div', { class: 'field' }, h('label', { class: 'f', for: 'pw' }, 'Kata sandi'), pwInput,
        h('div', { class: 'hint' }, '4-32 karakter, huruf, angka, atau simbol tanpa spasi. Catat kata sandinya: tanpa itu PDF tidak dapat dibuka.')));
      var row = h('div', { class: 'row' }, h('button', { class: 'btn btn-sage', onclick: function () {
        var v = pwInput.value;
        if (!/^[\x21-\x7E]{4,32}$/.test(v)) { U.toast('Kata sandi harus 4-32 karakter tanpa spasi.', 'err'); return; }
        doLock(v, 'dimasukkan manual');
      } }, 'Kunci PDF'));
      if (det) row.appendChild(h('button', { class: 'btn btn-ghost', onclick: function () { state.manual = false; drawPassword(); } }, 'Kembali ke kata sandi otomatis'));
      card.appendChild(row);
    }
    state.body.appendChild(card);
  }

  async function doLock(password, source) {
    U.clear(state.body); state.body.appendChild(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Mengunci PDF dan menambahkan watermark...'));
    try {
      var out = await lockPdf(state.bytes, password), ok = await verify(out, password);
      state.out = out; API.track('pdflocker', 'kunci pdf');
      drawDone(password, source, ok);
    } catch (e) {
      console.error(e); U.toast('Gagal mengunci PDF: ' + (e.message || e), 'err'); drawPassword();
    }
  }

  function drawDone(password, source, verified) {
    drawSteps(3); U.clear(state.body);
    var shown = false, val = h('div', { class: 'pw-val' }, '••••••••');
    var base = state.name.replace(/\.pdf$/i, ''), fname = base + '_locked.pdf';
    state.body.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row', style: { gap: '10px', marginBottom: '12px' } }, h('span', { class: 'chip ok' }, 'Berhasil'), h('b', null, fname)),
      h('div', { class: 'kv', style: { marginBottom: '14px' } },
        h('dt', null, 'Ukuran'), h('dd', null, U.fmtSize(state.out.length)),
        h('dt', null, 'Pengaman'), h('dd', null, 'Enkripsi AES, salin dan ubah dibatasi'),
        h('dt', null, 'Watermark'), h('dd', null, 'Ditambahkan pada setiap halaman'),
        h('dt', null, 'Verifikasi'), h('dd', null, verified ? 'Terkunci tanpa kata sandi, terbuka dengan kata sandi ✓' : 'Tidak dapat diverifikasi otomatis, silakan uji manual')),
      h('div', { class: 'pw-box' }, h('div', null, h('div', { class: 'hint', style: { marginTop: 0 } }, 'Kata sandi (' + source + ')'), val),
        h('div', { class: 'row' },
          h('button', { class: 'btn btn-ghost sm', onclick: function (ev) { shown = !shown; val.textContent = shown ? password : '••••••••'; ev.target.textContent = shown ? 'Sembunyikan' : 'Tampilkan'; } }, 'Tampilkan'),
          h('button', { class: 'btn btn-ghost sm', onclick: function () { (navigator.clipboard ? navigator.clipboard.writeText(password) : Promise.reject()).then(function () { U.toast('Kata sandi disalin.', 'ok'); }, function () { U.toast('Tidak dapat menyalin otomatis.', 'err'); }); } }, 'Salin'))),
      h('div', { class: 'row', style: { marginTop: '16px' } },
        h('button', { class: 'btn btn-primary', onclick: function () { U.download(new Blob([state.out], { type: 'application/pdf' }), fname); } }, 'Unduh PDF terkunci'),
        h('button', { class: 'btn btn-ghost', onclick: drawUpload }, 'Kunci PDF lain'))));
  }

  return { mount: mount, unmount: function () {}, _detectDate: detectDate };
})();
