/* Aktivitas demo (khusus admin) */
var Admin = (function () {
  var h = U.h;
  function mount(root) {
    var wrap = h('div', { class: 'page' }); root.appendChild(wrap);
    wrap.appendChild(h('div', { class: 'crumb' }, h('a', { href: '#/hub' }, '← Semua aplikasi')));
    wrap.appendChild(h('div', { class: 'eyebrow' }, h('i'), 'Panel Admin'));
    wrap.appendChild(h('h1', null, 'Aktivitas Demo'));
    wrap.appendChild(h('p', { class: 'lead' }, 'Ringkasan pemakaian demo oleh pengunjung (tanpa data pribadi). Data dihapus otomatis setelah 7 hari.'));
    var box = h('div', null, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Memuat...')); wrap.appendChild(box);
    API.call('admin.aktivitas').then(function (d) {
      U.clear(box);
      var keys = Object.keys(d.ringkas).sort();
      box.appendChild(h('div', { class: 'grid3' },
        h('div', { class: 'card' }, h('div', { class: 'hint', style: { marginTop: 0 } }, 'Perangkat unik'), h('div', { class: 'score-big' }, String(d.perangkat))),
        h('div', { class: 'card', style: { marginTop: 0 } }, h('div', { class: 'hint', style: { marginTop: 0 } }, 'Tes diselesaikan'), h('div', { class: 'score-big' }, String(d.tesSelesai))),
        h('div', { class: 'card', style: { marginTop: 0 } }, h('div', { class: 'hint', style: { marginTop: 0 } }, 'Jenis aktivitas'),
          keys.length ? keys.map(function (k) { return h('div', { class: 'list-item' }, h('span', null, k), h('b', null, String(d.ringkas[k]))); }) : h('div', { class: 'empty' }, 'Belum ada.'))));
      box.appendChild(h('div', { class: 'card' }, h('h3', { style: { marginBottom: '8px' } }, 'Aktivitas Terbaru'),
        d.terbaru.length ? h('div', { class: 'scroll-x' }, h('table', { class: 't' }, h('thead', null, h('tr', null, ['Waktu', 'Perangkat', 'Aplikasi', 'Aktivitas'].map(function (x) { return h('th', null, x); }))),
          h('tbody', null, d.terbaru.map(function (r) { return h('tr', null, h('td', null, r.tsText), h('td', { class: 'mono' }, r.device), h('td', null, r.app), h('td', null, r.event)); }))))
          : h('div', { class: 'empty' }, 'Belum ada aktivitas.')));
    }).catch(function (e) { U.clear(box); box.appendChild(h('div', { class: 'banner' }, e.message)); });
  }
  return { mount: mount, unmount: function () {} };
})();
