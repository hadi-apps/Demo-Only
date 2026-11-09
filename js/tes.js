/* Tes Tulis Daring: soft skill + administrasi umum, skor di server, laporan PDF */
var Tes = (function () {
  var h = U.h, st = {}, timerId = null;

  function mount(root) {
    st = { root: root, name: '', data: null, idx: 0, ans: {}, result: null };
    var wrap = h('div', { class: 'page' }); root.appendChild(wrap); st.wrap = wrap;
    intro();
  }
  function unmount() { if (timerId) clearInterval(timerId); timerId = null; }

  function head(sub) {
    U.clear(st.wrap);
    st.wrap.appendChild(h('div', { class: 'crumb' }, h('a', { href: '#/hub' }, '← Semua aplikasi')));
    st.wrap.appendChild(h('div', { class: 'eyebrow' }, h('i'), 'Human Resources'));
    st.wrap.appendChild(h('h1', null, 'Tes Tulis Daring'));
    if (sub) st.wrap.appendChild(h('p', { class: 'lead' }, sub));
  }

  function intro() {
    unmount();
    head('Tes seleksi dan evaluasi karyawan. Versi demo ini hanya memuat sebagian kecil bank soal: soft skill dan administrasi umum.');
    var nameIn = h('input', { type: 'text', placeholder: 'Contoh: Nama Anda', maxlength: '40', value: st.name });
    st.wrap.appendChild(h('div', { class: 'banner' }, 'Soal pada demo ini adalah contoh buatan, bukan bank soal asli. Skor dihitung di server, dan Anda dapat mengunduh laporan hasilnya dalam bentuk PDF.'));
    st.wrap.appendChild(h('div', { class: 'card' },
      h('div', { class: 'grid2' },
        h('div', null, h('div', { class: 'kv' },
          h('dt', null, 'Jumlah soal'), h('dd', null, '13 soal'),
          h('dt', null, 'Soft skill'), h('dd', null, '8 soal situasional'),
          h('dt', null, 'Administrasi umum'), h('dd', null, '5 soal pilihan ganda'),
          h('dt', null, 'Waktu'), h('dd', null, '10 menit'),
          h('dt', null, 'Bobot nilai'), h('dd', null, '60% soft skill, 40% administrasi umum'))),
        h('div', null, h('div', { class: 'field' }, h('label', { class: 'f' }, 'Nama peserta (untuk laporan PDF)'), nameIn,
          h('div', { class: 'hint' }, 'Nama hanya dipakai pada laporan di perangkat Anda dan tidak disimpan di server.')),
          h('button', { class: 'btn btn-primary', id: 'startBtn', onclick: function (ev) {
            st.name = nameIn.value.trim() || 'Peserta Demo'; start(ev.target);
          } }, 'Mulai Tes')))));
  }

  function start(btn) {
    U.busy(btn, true, 'Menyiapkan soal...');
    API.call('tes.start').then(function (d) {
      st.data = d; st.idx = 0; st.ans = {}; st.left = d.durasi; st.t0 = Date.now(); API.syncTime(); drawQuestion();
      timerId = setInterval(tick, 1000);
    }).catch(function (e) { U.busy(btn, false); U.toast(e.message, 'err'); });
  }
  function tick() {
    var left = Math.max(0, st.data.durasi - Math.round((Date.now() - st.t0) / 1000));
    st.left = left;
    var el = document.getElementById('timer');
    if (el) { el.textContent = Math.floor(left / 60) + ':' + ('0' + (left % 60)).slice(-2); el.className = 'timer' + (left < 60 ? ' low' : ''); }
    if (left <= 0) { unmount(); U.toast('Waktu habis. Jawaban dikirim otomatis.', 'ok'); submit(true); }
  }

  function drawQuestion() {
    var d = st.data, q = d.soal[st.idx], total = d.soal.length;
    U.clear(st.wrap);
    st.wrap.appendChild(h('div', { class: 'crumb' }, h('a', { href: '#/hub' }, '← Keluar dari tes')));
    var done = Object.keys(st.ans).length;
    st.wrap.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row', style: { justifyContent: 'space-between', marginBottom: '10px' } },
        h('span', { class: 'chip neutral' }, q.section),
        h('span', null, 'Sisa waktu ', h('span', { id: 'timer', class: 'timer' }, Math.floor(st.left / 60) + ':' + ('0' + (st.left % 60)).slice(-2)))),
      h('div', { class: 'progress' }, h('i', { style: { width: Math.round(done / total * 100) + '%' } })),
      h('div', { class: 'hint' }, 'Soal ' + (st.idx + 1) + ' dari ' + total + ' · terjawab ' + done),
      h('div', { class: 'q-text' }, q.text),
      q.options.map(function (o, i) {
        return h('button', { class: 'opt' + (st.ans[q.id] === o.id ? ' sel' : ''), onclick: function () { st.ans[q.id] = o.id; drawQuestion(); } },
          h('span', { class: 'k' }, 'ABCD'[i]), h('span', null, o.t));
      }),
      h('div', { class: 'row', style: { justifyContent: 'space-between', marginTop: '14px' } },
        h('button', { class: 'btn btn-ghost', disabled: st.idx === 0, onclick: function () { st.idx--; drawQuestion(); } }, '← Sebelumnya'),
        st.idx < total - 1
          ? h('button', { class: 'btn btn-primary', onclick: function () { st.idx++; drawQuestion(); } }, 'Berikutnya →')
          : h('button', { class: 'btn btn-sage', onclick: function () {
              var miss = total - Object.keys(st.ans).length;
              if (miss > 0 && !confirm(miss + ' soal belum dijawab. Kirim sekarang?')) return;
              submit(false);
            } }, 'Kirim Jawaban'))));
  }

  function submit(auto) {
    unmount();
    U.clear(st.wrap); st.wrap.appendChild(h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Menghitung nilai...'));
    API.call('tes.submit', { sid: st.data.sid, answers: st.ans }).then(function (r) { st.result = r; drawResult(); })
      .catch(function (e) { U.toast(e.message, 'err'); intro(); });
  }

  function drawResult() {
    var r = st.result;
    head('Hasil tes Anda. Laporan lengkap dapat diunduh sebagai PDF.');
    st.wrap.appendChild(h('div', { class: 'card' },
      h('div', { class: 'row', style: { gap: '26px', alignItems: 'flex-end' } },
        h('div', null, h('div', { class: 'hint', style: { marginTop: 0 } }, 'Nilai akhir'), h('div', { class: 'score-big' }, String(r.total))),
        h('div', null, h('span', { class: 'chip ' + (r.total >= 65 ? 'ok' : r.total >= 50 ? 'wait' : 'bad'), style: { fontSize: '14px' } }, r.band),
          h('div', { class: 'hint' }, 'Soft skill ' + r.soft + ' · Administrasi umum ' + r.admin + ' · Waktu ' + Math.floor(r.durasi / 60) + ' mnt ' + (r.durasi % 60) + ' dtk'))),
      h('div', { style: { marginTop: '18px' } }, h('b', null, 'Profil soft skill'),
        r.aspects.map(function (a) { return h('div', { class: 'bar' }, h('span', null, a.name), h('div', { class: 't' }, h('i', { style: { width: Math.round(a.score / a.max * 100) + '%' } })), h('b', null, a.score + '/' + a.max)); })),
      h('div', { style: { marginTop: '16px' } }, h('b', null, 'Administrasi umum: ' + r.adminBenar + ' dari ' + r.adminTotal + ' benar'),
        r.adminDetail.map(function (a) {
          return h('div', { class: 'list-item' }, h('span', null, a.no + '. ' + a.q), h('span', { class: 'chip ' + (a.benar ? 'ok' : 'bad') }, a.benar ? 'Benar' : 'Salah'));
        })),
      h('div', { class: 'row', style: { marginTop: '18px' } },
        h('button', { class: 'btn btn-primary', onclick: function (ev) { downloadReport(ev.target); } }, 'Unduh Laporan (PDF)'),
        h('button', { class: 'btn btn-ghost', onclick: intro }, 'Ulangi Tes'))));
  }

  async function downloadReport(btn) {
    U.busy(btn, true, 'Menyusun PDF...');
    try {
      var r = st.result, d = await PK.newDoc(), w = new PK.Writer(d.doc, d.fonts);
      w.text('LAPORAN HASIL TES TULIS DARING', { size: 16, bold: true, gap: 2 });
      w.text('Versi demo. Soal dan data adalah contoh/fiktif.', { size: 9, color: PK.colors.MUT, gap: 8 }); w.rule();
      w.kv('Nama peserta', st.name); w.kv('Waktu selesai', r.waktu); w.kv('Durasi pengerjaan', Math.floor(r.durasi / 60) + ' menit ' + (r.durasi % 60) + ' detik'); w.kv('Bobot nilai', r.bobot); w.rule(12);
      w.text('NILAI AKHIR: ' + r.total + ' / 100   (' + r.band + ')', { size: 14, bold: true, gap: 4 });
      w.text('Soft skill: ' + r.soft + '   |   Administrasi umum: ' + r.admin, { size: 10.5, color: PK.colors.MUT, gap: 10 });
      w.text('Profil Soft Skill', { size: 12, bold: true, gap: 6 });
      r.aspects.forEach(function (a) { w.bar(a.name, a.score, a.max); });
      w.y -= 8; w.rule(12);
      w.text('Administrasi Umum: ' + r.adminBenar + ' dari ' + r.adminTotal + ' soal benar', { size: 12, bold: true, gap: 6 });
      r.adminDetail.forEach(function (a) {
        w.text(a.no + '. ' + a.q, { size: 10, gap: 1 });
        w.text((a.benar ? 'Benar' : 'Salah') + ' | Jawaban Anda: ' + a.jawaban + (a.benar ? '' : ' | Kunci: ' + a.kunci), { size: 9.5, color: a.benar ? PK.colors.SAGE : rgb(0.6, 0.29, 0.29), gap: 7, x: w.m + 10, maxW: w.W - w.m * 2 - 10 });
      });
      w.y -= 6;
      w.text('Interpretasi nilai: 80 ke atas Sangat Baik, 65-79 Baik, 50-64 Cukup, di bawah 50 Perlu Pengembangan. Hasil ini hanya contoh dan bukan dasar keputusan seleksi.', { size: 9, color: PK.colors.MUT });
      PK.footerAll(d.doc, d.fonts.reg, 'Laporan Tes Tulis Daring (Demo)');
      PK.watermark(d.doc, d.fonts.bold);
      var bytes = await d.doc.save();
      U.download(new Blob([bytes], { type: 'application/pdf' }), 'Laporan-Tes-Demo.pdf');
      API.track('tes', 'unduh laporan');
    } catch (e) { console.error(e); U.toast('Gagal membuat PDF: ' + e.message, 'err'); }
    U.busy(btn, false);
  }
  var rgb = PDFLib.rgb;

  return { mount: mount, unmount: unmount };
})();
