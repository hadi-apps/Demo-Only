/* Mode lokal: core + adapter localStorage. Dihasilkan otomatis. */
/* ============================================================
   DemoCore: logika backend demo (dipakai Apps Script & mode lokal)
   Tidak ada kredensial di sini. Penyimpanan lewat env.db / env.cache.
   ============================================================ */
var DemoCore = (function () {
  'use strict';

  var WM = 'Aplikasi Demo - Properti Pribadi Deiky Catur Hadi';
  var LEVELS = ['Atasan Langsung', 'Manager HRGA & IT', 'Direktur'];
  var QUOTA = 12;
  var SESSION_TTL = 6 * 3600;
  var TES_DURASI = 600;
  var RETENSI_HARI = 7;
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  var SCHEMA = {
    Users:     ['username', 'salt', 'hash', 'role', 'nama', 'jabatan'],
    Presensi:  ['id', 'device', 'user', 'nama', 'tipe', 'ts', 'tsText', 'lat', 'lon', 'acc', 'hash', 'seed'],
    Cuti:      ['id', 'device', 'user', 'nama', 'jenis', 'mulai', 'selesai', 'hari', 'keperluan', 'status', 'level', 'riwayat', 'diajukan', 'diajukanText', 'seed'],
    HasilTes:  ['id', 'device', 'ts', 'total', 'soft', 'admin', 'band', 'durasi'],
    Aktivitas: ['id', 'ts', 'tsText', 'device', 'user', 'app', 'event']
  };

  /* ---------- bank soal (CONTOH / DUMMY) ---------- */
  var SOAL_SOFT = [
    { id: 'S1', aspek: 'Komunikasi', q: 'Informasi dari rekan Anda berbeda dengan arahan atasan. Apa yang Anda lakukan?',
      o: [['Mengikuti informasi rekan agar pekerjaan cepat selesai', 1], ['Mengonfirmasi ke atasan, lalu menyampaikan hasilnya kepada rekan tersebut', 3], ['Menunggu sampai ada yang menyadari perbedaannya', 0], ['Membahasnya di grup agar semua anggota ikut menilai', 1]] },
    { id: 'S2', aspek: 'Kerja Sama', q: 'Tugas tim terlambat karena satu anggota kewalahan. Bagaimana sikap Anda?',
      o: [['Menawarkan bantuan dan membahas pembagian ulang tugas bersama ketua tim', 3], ['Fokus pada bagian saya sendiri', 1], ['Melaporkan anggota tersebut sebagai penyebab keterlambatan', 0], ['Mengambil alih seluruh tugasnya tanpa memberi tahu siapa pun', 2]] },
    { id: 'S3', aspek: 'Integritas', q: 'Anda menemukan kesalahan input pada laporan yang telah dikirim, dan belum ada yang menyadarinya.',
      o: [['Segera melaporkan dan memperbaikinya beserta catatan perbaikan', 3], ['Memperbaiki diam-diam tanpa memberi tahu', 1], ['Menunggu hingga ada yang menegur', 0], ['Menyalahkan sistem yang digunakan', 0]] },
    { id: 'S4', aspek: 'Manajemen Waktu', q: 'Dua tugas penting memiliki tenggat pada hari yang sama, sedangkan atasan sedang tidak di tempat.',
      o: [['Menyusun prioritas berdasarkan dampak dan tenggat, lalu menginformasikannya kepada atasan', 3], ['Mengerjakan yang paling mudah terlebih dahulu', 1], ['Menunda keduanya hingga atasan kembali', 0], ['Meminta perpanjangan waktu untuk keduanya', 1]] },
    { id: 'S5', aspek: 'Pemecahan Masalah', q: 'Sistem kerja mengalami kendala yang sama setiap minggu.',
      o: [['Mencatat pola kejadiannya, menelusuri penyebab, lalu mengusulkan perbaikan permanen', 3], ['Memperbaikinya secara darurat setiap kali muncul', 1], ['Melaporkan ke bagian IT tanpa data pendukung', 1], ['Menganggapnya hal biasa', 0]] },
    { id: 'S6', aspek: 'Adaptabilitas', q: 'Prosedur kerja diubah secara mendadak oleh perusahaan.',
      o: [['Mempelajari alasan perubahan dan meminta pendampingan singkat bila perlu', 3], ['Tetap menggunakan cara lama', 0], ['Mengikuti perubahan tanpa bertanya', 2], ['Mengeluhkannya kepada rekan kerja', 0]] },
    { id: 'S7', aspek: 'Inisiatif', q: 'Anda melihat proses kerja tim dapat dibuat lebih efisien.',
      o: [['Mencoba dalam skala kecil, lalu mempresentasikan hasilnya kepada tim', 3], ['Langsung mengubah proses tanpa memberi tahu', 0], ['Menyimpan ide tersebut untuk diri sendiri', 1], ['Menunggu sampai diminta memberi masukan', 1]] },
    { id: 'S8', aspek: 'Pengelolaan Konflik', q: 'Dua rekan berselisih sehingga mengganggu pekerjaan tim.',
      o: [['Mempertemukan keduanya dan mengarahkan pembicaraan pada fakta dan tujuan bersama', 3], ['Mengabaikannya', 0], ['Berpihak kepada rekan yang lebih akrab', 0], ['Melaporkan ke atasan tanpa mencoba membantu terlebih dahulu', 1]] }
  ];
  var SOAL_ADMIN = [
    { id: 'A1', q: 'Arsip dinamis yang masih sering digunakan dalam kegiatan sehari-hari disebut arsip ...',
      o: [['Aktif', 1], ['Inaktif', 0], ['Statis', 0], ['Vital', 0]] },
    { id: 'A2', q: 'Daftar pihak lain yang menerima salinan surat dicantumkan pada bagian ...',
      o: [['Kepala surat', 0], ['Isi surat', 0], ['Tembusan', 1], ['Penutup', 0]] },
    { id: 'A3', q: 'Fungsi utama notulen rapat adalah ...',
      o: [['Menghitung biaya rapat', 0], ['Mencatat pembahasan dan keputusan rapat', 1], ['Menentukan peserta rapat berikutnya', 0], ['Mengganti undangan rapat', 0]] },
    { id: 'A4', q: 'Dari 80 lembar formulir, 25% tidak terpakai. Berapa lembar formulir yang terpakai?',
      o: [['20', 0], ['55', 0], ['60', 1], ['65', 0]] },
    { id: 'A5', q: 'Sebuah laporan 15 halaman perlu difotokopi 12 rangkap. Berapa total lembar yang dibutuhkan?',
      o: [['150', 0], ['165', 0], ['180', 1], ['195', 0]] }
  ];

  /* ---------- util ---------- */
  function ok(data) { return { ok: true, data: data }; }
  function fail(msg, code) { var e = new Error(msg); e.isUser = true; e.code = code || 'bad_request'; throw e; }

  function utf8(s) {
    var out = [];
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 128) out.push(c);
      else if (c < 2048) out.push(192 | (c >> 6), 128 | (c & 63));
      else if (c >= 0xd800 && c < 0xdc00) {
        var c2 = s.charCodeAt(++i);
        c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff);
        out.push(240 | (c >> 18), 128 | ((c >> 12) & 63), 128 | ((c >> 6) & 63), 128 | (c & 63));
      } else out.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return out;
  }
  var K256 = null, H256 = null;
  function initSha() {
    K256 = []; H256 = [];
    var primes = [], n = 2;
    while (primes.length < 64) {
      var isP = true;
      for (var i = 0; i < primes.length; i++) { if (n % primes[i] === 0) { isP = false; break; } }
      if (isP) primes.push(n);
      n++;
    }
    for (var j = 0; j < 64; j++) {
      var cb = Math.pow(primes[j], 1 / 3);
      K256.push(Math.floor((cb - Math.floor(cb)) * 4294967296) | 0);
      if (j < 8) { var sq = Math.sqrt(primes[j]); H256.push(Math.floor((sq - Math.floor(sq)) * 4294967296) | 0); }
    }
  }
  function sha256(msg) {
    if (!K256) initSha();
    function rotr(n, x) { return (x >>> n) | (x << (32 - n)); }
    var H = H256.slice(), bytes = utf8(String(msg)), l = bytes.length;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor((l * 8) / 4294967296), lo = (l * 8) >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    for (var i = 0; i < bytes.length; i += 64) {
      var w = new Array(64), t;
      for (t = 0; t < 16; t++) w[t] = (bytes[i + 4 * t] << 24) | (bytes[i + 4 * t + 1] << 16) | (bytes[i + 4 * t + 2] << 8) | bytes[i + 4 * t + 3];
      for (t = 16; t < 64; t++) {
        var s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3);
        var s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10);
        w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (t = 0; t < 64; t++) {
        var S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e), ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K256[t] + w[t]) | 0;
        var S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a), mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }
    var out = '';
    for (var k = 0; k < 8; k++) out += ('00000000' + (H[k] >>> 0).toString(16)).slice(-8);
    return out;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function wib(ms) {
    var d = new Date(ms + 7 * 3600 * 1000);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds(), dow: d.getUTCDay() };
  }
  function fmtWib(ms) {
    var w = wib(ms);
    return pad2(w.d) + ' ' + BULAN[w.m - 1] + ' ' + w.y + ' ' + pad2(w.hh) + ':' + pad2(w.mm) + ':' + pad2(w.ss) + ' WIB';
  }
  function ymd(ms) { var w = wib(ms); return w.y + '-' + pad2(w.m) + '-' + pad2(w.d); }
  function parseYmd(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var t = Date.UTC(+m[1], +m[2] - 1, +m[3]), d = new Date(t);
    if (d.getUTCFullYear() !== +m[1] || d.getUTCMonth() !== +m[2] - 1 || d.getUTCDate() !== +m[3]) return null;
    return t;
  }
  function workdays(a, b) {
    var n = 0;
    for (var t = a; t <= b; t += 86400000) { var dw = new Date(t).getUTCDay(); if (dw !== 0 && dw !== 6) n++; }
    return n;
  }
  function addDays(ms, n) { return ms + n * 86400000; }

  function cleanText(s, max) {
    s = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    if (s.length > max) s = s.slice(0, max);
    if (/^[=+\-@]/.test(s)) s = ' ' + s;
    return s;
  }
  function cleanDev(d) { d = String(d || ''); return /^[A-Za-z0-9]{8,40}$/.test(d) ? d : fail('ID perangkat tidak valid.'); }
  function num(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
  function rid(env, prefix) { return (prefix || '') + env.uuid().replace(/-/g, '').slice(0, 8).toUpperCase(); }
  function shuffle(arr, env) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(env.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------- pemetaan baris ---------- */
  function cutiOut(r) {
    var rw = []; try { rw = JSON.parse(r.riwayat || '[]'); } catch (e) { rw = []; }
    return { id: r.id, user: r.user, nama: r.nama, jenis: r.jenis, mulai: r.mulai, selesai: r.selesai, hari: num(r.hari), keperluan: r.keperluan,
             status: r.status, level: num(r.level), riwayat: rw, diajukan: num(r.diajukan), diajukanText: r.diajukanText, seed: String(r.seed) === '1', device: r.device };
  }
  function presOut(r) {
    return { id: r.id, nama: r.nama, tipe: r.tipe, ts: num(r.ts), tsText: r.tsText, lat: num(r.lat), lon: num(r.lon), acc: num(r.acc), hash: r.hash, seed: String(r.seed) === '1', device: r.device };
  }
  function isPending(st) { return String(st).indexOf('Menunggu') === 0; }

  /* ---------- autentikasi ---------- */
  function ensureUsers(env, list) {
    var have = env.db.all('Users');
    for (var i = 0; i < list.length; i++) {
      var u = list[i], exist = false;
      for (var j = 0; j < have.length; j++) if (have[j].username === u.username) exist = true;
      if (exist) continue;
      var salt = env.uuid().replace(/-/g, '').slice(0, 12);
      env.db.add('Users', { username: u.username, salt: salt, hash: sha256(salt + u.password), role: u.role, nama: u.nama, jabatan: u.jabatan });
    }
  }
  function findUser(env, username) {
    var rows = env.db.all('Users');
    for (var i = 0; i < rows.length; i++) if (String(rows[i].username).toLowerCase() === username) return rows[i];
    return null;
  }
  function login(req, env) {
    var u = String(req.username || '').trim().toLowerCase(), pw = String(req.password || '');
    var dev = cleanDev(req.deviceId);
    var key = 'fail:' + u + ':' + dev, fails = num(env.cache.get(key));
    if (fails >= 5) fail('Terlalu banyak percobaan. Coba lagi dalam 10 menit.', 'locked');
    var row = findUser(env, u);
    if (!row || sha256(String(row.salt) + pw) !== String(row.hash)) {
      env.cache.put(key, String(fails + 1), 600);
      fail('Username atau password salah.', 'auth');
    }
    env.cache.remove(key);
    var token = env.uuid().replace(/-/g, '') + env.uuid().replace(/-/g, '');
    env.cache.put('sess:' + token, JSON.stringify({ u: row.username, dev: dev }), SESSION_TTL);
    track(env, dev, row.username, 'hub', 'login');
    return ok({ token: token, user: { username: row.username, nama: row.nama, jabatan: row.jabatan, role: row.role } });
  }
  function auth(req, env) {
    var raw = env.cache.get('sess:' + String(req.token || ''));
    if (!raw) fail('Sesi berakhir. Silakan masuk kembali.', 'session');
    var s = JSON.parse(raw), row = findUser(env, String(s.u).toLowerCase());
    if (!row) fail('Akun tidak ditemukan.', 'session');
    return { username: row.username, nama: row.nama, jabatan: row.jabatan, role: row.role, dev: s.dev };
  }
  function needAdmin(u) { if (u.role !== 'admin') fail('Khusus admin.', 'forbidden'); }

  function track(env, dev, user, app, event) {
    env.db.add('Aktivitas', { id: rid(env, 'L'), ts: env.now(), tsText: fmtWib(env.now()), device: dev, user: user, app: cleanText(app, 20), event: cleanText(event, 30) });
  }

  /* ---------- Tes Tulis ---------- */
  function tesStart(req, env, u) {
    var qs = [], order = [];
    function pack(list, section) {
      for (var i = 0; i < list.length; i++) {
        var q = list[i], opts = shuffle(q.o.map(function (o, idx) { return { id: 'o' + idx, t: o[0] }; }), env);
        qs.push({ id: q.id, section: section, text: q.q, options: opts });
        order.push({ id: q.id, section: section });
      }
    }
    pack(SOAL_SOFT, 'Soft Skill');
    pack(SOAL_ADMIN, 'Administrasi Umum');
    var sid = env.uuid().replace(/-/g, '').slice(0, 16);
    env.cache.put('tes:' + sid, JSON.stringify({ u: u.username, dev: u.dev, t0: env.now() }), 7200);
    track(env, u.dev, u.username, 'tes', 'mulai');
    return ok({ sid: sid, durasi: TES_DURASI, soal: qs });
  }
  function band(total) { return total >= 80 ? 'Sangat Baik' : total >= 65 ? 'Baik' : total >= 50 ? 'Cukup' : 'Perlu Pengembangan'; }
  function tesSubmit(req, env, u) {
    var raw = env.cache.get('tes:' + String(req.sid || ''));
    if (!raw) fail('Sesi tes tidak ditemukan atau sudah selesai.', 'session');
    var ses = JSON.parse(raw);
    if (ses.u !== u.username || ses.dev !== u.dev) fail('Sesi tes tidak sesuai.', 'forbidden');
    env.cache.remove('tes:' + String(req.sid));
    var ans = req.answers || {}, aspects = [], softPts = 0, admin = [], adminOk = 0, i;
    function optIdx(v) { var m = /^o(\d)$/.exec(String(v || '')); return m ? +m[1] : -1; }
    for (i = 0; i < SOAL_SOFT.length; i++) {
      var s = SOAL_SOFT[i], ix = optIdx(ans[s.id]), pts = (ix >= 0 && s.o[ix]) ? s.o[ix][1] : 0;
      softPts += pts; aspects.push({ name: s.aspek, score: pts, max: 3 });
    }
    for (i = 0; i < SOAL_ADMIN.length; i++) {
      var a = SOAL_ADMIN[i], jx = optIdx(ans[a.id]), good = (jx >= 0 && a.o[jx] && a.o[jx][1] === 1), key = '';
      for (var k = 0; k < a.o.length; k++) if (a.o[k][1] === 1) key = a.o[k][0];
      if (good) adminOk++;
      admin.push({ no: i + 1, q: a.q, benar: good, jawaban: (jx >= 0 && a.o[jx]) ? a.o[jx][0] : '(tidak dijawab)', kunci: key });
    }
    var softPct = Math.round((softPts / (SOAL_SOFT.length * 3)) * 100), adminPct = Math.round((adminOk / SOAL_ADMIN.length) * 100);
    var total = Math.round(0.6 * softPct + 0.4 * adminPct), dur = Math.max(1, Math.round((env.now() - ses.t0) / 1000));
    env.db.add('HasilTes', { id: rid(env, 'T'), device: u.dev, ts: env.now(), total: total, soft: softPct, admin: adminPct, band: band(total), durasi: dur });
    track(env, u.dev, u.username, 'tes', 'selesai');
    return ok({ total: total, soft: softPct, admin: adminPct, band: band(total), aspects: aspects, adminDetail: admin, adminBenar: adminOk, adminTotal: SOAL_ADMIN.length,
                durasi: dur, waktu: fmtWib(env.now()), bobot: '60% Soft Skill, 40% Administrasi Umum' });
  }

  /* ---------- HRIS ---------- */
  function seedDevice(env, u) {
    var has = false, i, p = env.db.all('Presensi'), c = env.db.all('Cuti');
    for (i = 0; i < p.length; i++) if (p[i].device === u.dev) has = true;
    for (i = 0; i < c.length; i++) if (c[i].device === u.dev) has = true;
    if (has) return;
    var now = env.now(), d, shown = 0;
    for (d = 1; d <= 6 && shown < 2; d++) {
      var day = addDays(now, -d), dw = wib(day).dow;
      if (dw === 0 || dw === 6) continue;
      var w = wib(day), base = Date.UTC(w.y, w.m - 1, w.d, 8, 0, 0) - 7 * 3600 * 1000;
      var m1 = base + 55 * 60000 + shown * 3 * 60000, m2 = base + 9 * 3600 * 1000 + 8 * 60000;
      env.db.add('Presensi', { id: rid(env, 'P'), device: u.dev, user: u.username, nama: u.nama, tipe: 'Masuk', ts: m1, tsText: fmtWib(m1), lat: -7.2575, lon: 112.7521, acc: 14, hash: '(contoh)', seed: '1' });
      env.db.add('Presensi', { id: rid(env, 'P'), device: u.dev, user: u.username, nama: u.nama, tipe: 'Pulang', ts: m2, tsText: fmtWib(m2), lat: -7.2575, lon: 112.7521, acc: 11, hash: '(contoh)', seed: '1' });
      shown++;
    }
    var m0 = addDays(now, -9), s0 = parseYmd(ymd(addDays(now, -5))), e0 = s0;
    var rw = [];
    for (i = 0; i < LEVELS.length; i++) rw.push({ level: i + 1, label: LEVELS[i], oleh: 'Contoh (sistem)', keputusan: 'Disetujui', catatan: '', ts: m0 + (i + 1) * 3600000, tsText: fmtWib(m0 + (i + 1) * 3600000) });
    env.db.add('Cuti', { id: rid(env, 'CT-'), device: u.dev, user: u.username, nama: u.nama, jenis: 'Cuti Tahunan', mulai: ymd(s0), selesai: ymd(e0), hari: workdays(s0, e0) || 1,
      keperluan: 'Contoh data: keperluan keluarga', status: 'Disetujui', level: 3, riwayat: JSON.stringify(rw), diajukan: m0, diajukanText: fmtWib(m0), seed: '1' });
  }
  function quotaOf(env, u) {
    var rows = env.db.all('Cuti'), used = 0;
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.device === u.dev && r.jenis === 'Cuti Tahunan' && (r.status === 'Disetujui' || isPending(r.status))) used += num(r.hari);
    }
    return { total: QUOTA, terpakai: used, sisa: Math.max(0, QUOTA - used) };
  }
  function ownRows(env, table, u) {
    var rows = env.db.all(table), out = [];
    for (var i = 0; i < rows.length; i++) if (rows[i].device === u.dev) out.push(rows[i]);
    return out;
  }
  function hrisMe(req, env, u) {
    seedDevice(env, u);
    track(env, u.dev, u.username, 'hris', 'buka');
    var pres = ownRows(env, 'Presensi', u).map(presOut).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 30);
    var cuti = ownRows(env, 'Cuti', u).map(cutiOut).sort(function (a, b) { return b.diajukan - a.diajukan; });
    return ok({ now: env.now(), quota: quotaOf(env, u), presensi: pres, cuti: cuti, levels: LEVELS });
  }
  function hrisPresensi(req, env, u) {
    var tipe = req.tipe === 'Pulang' ? 'Pulang' : req.tipe === 'Masuk' ? 'Masuk' : fail('Jenis presensi tidak valid.');
    var lat = Number(req.lat), lon = Number(req.lon), acc = Number(req.acc);
    if (!isFinite(lat) || !isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) fail('Koordinat lokasi tidak valid.');
    var hash = String(req.hash || '');
    if (!/^[0-9a-f]{64}$/.test(hash)) fail('Hash foto tidak valid.');
    var mine = ownRows(env, 'Presensi', u);
    if (mine.length >= 60) fail('Batas data demo tercapai. Data lama dihapus otomatis setiap 7 hari.', 'limit');
    var now = env.now();
    var row = { id: rid(env, 'P'), device: u.dev, user: u.username, nama: u.nama, tipe: tipe, ts: now, tsText: fmtWib(now), lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6, acc: Math.round(isFinite(acc) ? acc : 0), hash: hash, seed: '0' };
    env.db.add('Presensi', row);
    track(env, u.dev, u.username, 'hris', 'presensi ' + tipe.toLowerCase());
    return ok(presOut(row));
  }
  function hrisCutiSubmit(req, env, u) {
    var jenis = { 'Cuti Tahunan': 1, 'Cuti Penting': 1, 'Izin': 1 };
    if (!jenis[req.jenis]) fail('Jenis cuti tidak valid.');
    var a = parseYmd(req.mulai), b = parseYmd(req.selesai);
    if (a === null || b === null) fail('Tanggal tidak valid.');
    var today = parseYmd(ymd(env.now()));
    if (a < today) fail('Tanggal mulai tidak boleh sebelum hari ini.');
    if (b < a) fail('Tanggal selesai tidak boleh sebelum tanggal mulai.');
    if ((b - a) / 86400000 > 30) fail('Rentang maksimal 30 hari.');
    var hari = workdays(a, b);
    if (hari < 1) fail('Rentang tanggal hanya berisi akhir pekan.');
    var ket = cleanText(req.keperluan, 200);
    if (ket.length < 5) fail('Keperluan minimal 5 karakter.');
    var mine = ownRows(env, 'Cuti', u), pend = 0, i;
    for (i = 0; i < mine.length; i++) if (isPending(mine[i].status)) pend++;
    if (pend >= 5) fail('Masih ada 5 pengajuan yang menunggu persetujuan.', 'limit');
    if (mine.length >= 25) fail('Batas data demo tercapai. Data lama dihapus otomatis setiap 7 hari.', 'limit');
    if (req.jenis === 'Cuti Tahunan' && hari > quotaOf(env, u).sisa) fail('Sisa cuti tahunan tidak mencukupi.');
    var now = env.now();
    var row = { id: rid(env, 'CT-'), device: u.dev, user: u.username, nama: u.nama, jenis: req.jenis, mulai: ymd(a), selesai: ymd(b), hari: hari, keperluan: ket,
      status: 'Menunggu ' + LEVELS[0], level: 1, riwayat: '[]', diajukan: now, diajukanText: fmtWib(now), seed: '0' };
    env.db.add('Cuti', row);
    track(env, u.dev, u.username, 'hris', 'ajukan cuti');
    return ok(cutiOut(row));
  }
  function hrisCutiList(req, env, u) {
    var rows = env.db.all('Cuti'), out = [], i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (u.role === 'admin') { if (String(r.seed) === '1') continue; if (req.pending && !isPending(r.status)) continue; }
      else if (r.device !== u.dev) continue;
      out.push(cutiOut(r));
    }
    out.sort(function (a, b) { return b.diajukan - a.diajukan; });
    return ok({ cuti: out, quota: u.role === 'admin' ? null : quotaOf(env, u), now: env.now() });
  }
  function hrisCutiDecide(req, env, u) {
    needAdmin(u);
    var rows = env.db.all('Cuti'), row = null;
    for (var i = 0; i < rows.length; i++) if (rows[i].id === req.id) row = rows[i];
    if (!row) fail('Pengajuan tidak ditemukan.', 'notfound');
    if (!isPending(row.status)) fail('Pengajuan ini sudah diputuskan.');
    var dec = req.decision === 'setuju' ? 'Disetujui' : req.decision === 'tolak' ? 'Ditolak' : fail('Keputusan tidak valid.');
    var lv = num(row.level), rw = []; try { rw = JSON.parse(row.riwayat || '[]'); } catch (e) { rw = []; }
    var now = env.now();
    rw.push({ level: lv, label: LEVELS[lv - 1], oleh: u.nama, keputusan: dec, catatan: cleanText(req.catatan, 120), ts: now, tsText: fmtWib(now) });
    var status, nlv = lv;
    if (dec === 'Ditolak') status = 'Ditolak';
    else if (lv < LEVELS.length) { nlv = lv + 1; status = 'Menunggu ' + LEVELS[lv]; }
    else status = 'Disetujui';
    env.db.set('Cuti', row.id, { status: status, level: nlv, riwayat: JSON.stringify(rw) });
    track(env, u.dev, u.username, 'hris', 'putuskan cuti');
    row.status = status; row.level = nlv; row.riwayat = JSON.stringify(rw);
    return ok(cutiOut(row));
  }
  function hrisPresensiAll(req, env, u) {
    needAdmin(u);
    var rows = env.db.all('Presensi').filter(function (r) { return String(r.seed) !== '1'; }).map(presOut);
    rows.sort(function (a, b) { return b.ts - a.ts; });
    return ok({ presensi: rows.slice(0, 100) });
  }
  function adminAktivitas(req, env, u) {
    needAdmin(u);
    var rows = env.db.all('Aktivitas'), per = {}, dev = {}, i;
    for (i = 0; i < rows.length; i++) {
      var r = rows[i];
      if (r.user === 'admin') continue;
      var key = r.app + ' · ' + r.event; per[key] = (per[key] || 0) + 1; dev[r.device] = 1;
    }
    var list = rows.filter(function (r) { return r.user !== 'admin'; }).map(function (r) { return { ts: num(r.ts), tsText: r.tsText, device: String(r.device).slice(0, 6), app: r.app, event: r.event }; });
    list.sort(function (a, b) { return b.ts - a.ts; });
    var hasil = env.db.all('HasilTes').length;
    return ok({ ringkas: per, perangkat: Object.keys(dev).length, tesSelesai: hasil, terbaru: list.slice(0, 40) });
  }

  /* ---------- pembersihan ---------- */
  function purge(env) {
    var cut = env.now() - RETENSI_HARI * 86400000;
    ['Presensi', 'Cuti', 'HasilTes', 'Aktivitas'].forEach(function (t) {
      env.db.purge(t, function (r) { return num(r.ts !== undefined && r.ts !== '' ? r.ts : r.diajukan) < cut; });
    });
  }

  /* ---------- router ---------- */
  function handle(req, env) {
    try {
      var a = req && req.action;
      if (a === 'time') return ok({ ts: env.now(), text: fmtWib(env.now()) });
      if (a === 'login') return login(req, env);
      var u = auth(req, env);
      switch (a) {
        case 'logout': env.cache.remove('sess:' + String(req.token)); return ok({});
        case 'track': track(env, u.dev, u.username, req.app, req.event); return ok({});
        case 'tes.start': return tesStart(req, env, u);
        case 'tes.submit': return tesSubmit(req, env, u);
        case 'hris.me': return hrisMe(req, env, u);
        case 'hris.presensi': return hrisPresensi(req, env, u);
        case 'hris.cuti.submit': return hrisCutiSubmit(req, env, u);
        case 'hris.cuti.list': return hrisCutiList(req, env, u);
        case 'hris.cuti.decide': return hrisCutiDecide(req, env, u);
        case 'hris.presensi.all': return hrisPresensiAll(req, env, u);
        case 'admin.aktivitas': return adminAktivitas(req, env, u);
        default: return { ok: false, error: 'Aksi tidak dikenal.', code: 'bad_request' };
      }
    } catch (e) {
      if (e && e.isUser) return { ok: false, error: e.message, code: e.code };
      return { ok: false, error: 'Terjadi kesalahan pada server.', code: 'server', detail: String((e && e.message) || e) };
    }
  }

  return { handle: handle, ensureUsers: ensureUsers, purge: purge, sha256: sha256, SCHEMA: SCHEMA, WM: WM, LEVELS: LEVELS, QUOTA: QUOTA,
           counts: { soft: SOAL_SOFT.length, admin: SOAL_ADMIN.length } };
})();

/* ============================================================
   Adapter mode lokal (browser, localStorage): dipakai bila API_URL kosong.
   Hanya untuk uji coba; tidak berbagi data antarperangkat.
   ============================================================ */
(function () {
  var LS = window.localStorage, P = 'demo_local_';
  function jget(k, d) { try { var v = LS.getItem(P + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jset(k, v) { try { LS.setItem(P + k, JSON.stringify(v)); } catch (e) {} }
  var USERS = [{ username: 'akundemo', password: 'akundemo', role: 'user', nama: 'Akun Demo', jabatan: 'Staf Demo' }];
  if (window.DEMO_LOCAL_EXTRA_USERS) USERS = USERS.concat(window.DEMO_LOCAL_EXTRA_USERS);
  var KEY = { Users: 'username' };
  var env = {
    db: {
      all: function (t) { return jget('db_' + t, []); },
      add: function (t, o) { var a = jget('db_' + t, []); a.push(o); jset('db_' + t, a); },
      set: function (t, id, patch) {
        var a = jget('db_' + t, []), k = KEY[t] || 'id';
        for (var i = 0; i < a.length; i++) if (String(a[i][k]) === String(id)) { for (var p in patch) a[i][p] = patch[p]; }
        jset('db_' + t, a);
      },
      purge: function (t, pred) { jset('db_' + t, jget('db_' + t, []).filter(function (r) { return !pred(r); })); }
    },
    cache: {
      get: function (k) { var o = jget('c_' + k, null); if (!o) return null; if (o.e < Date.now()) { LS.removeItem(P + 'c_' + k); return null; } return o.v; },
      put: function (k, v, ttl) { jset('c_' + k, { v: v, e: Date.now() + ttl * 1000 }); },
      remove: function (k) { LS.removeItem(P + 'c_' + k); }
    },
    now: function () { return Date.now(); },
    uuid: function () {
      if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
    },
    random: function () { return Math.random(); }
  };
  DemoCore.ensureUsers(env, USERS);
  window.DemoLocal = {
    call: function (req) {
      return new Promise(function (res) { setTimeout(function () { res(DemoCore.handle(JSON.parse(JSON.stringify(req)), env)); }, 60); });
    }
  };
})();
