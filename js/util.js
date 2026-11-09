/* Utilitas umum */
var U = (function () {
  var WM_TEXT = 'Aplikasi Demo - Properti Pribadi Deiky Catur Hadi';
  var BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var BULAN_PANJANG = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  function h(tag, attrs) {
    var el = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') { for (var s in v) { if (s.indexOf('--') === 0) el.style.setProperty(s, v[s]); else el.style[s] = v[s]; } }
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

  function toast(msg, type) {
    var box = document.getElementById('toasts');
    var t = h('div', { class: 'toast ' + (type || '') }, msg);
    box.appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(function () { t.remove(); }, 300); }, 3800);
  }

  function deviceId() {
    try {
      var d = localStorage.getItem('demo_dev');
      if (d && /^[A-Za-z0-9]{8,40}$/.test(d)) return d;
      var a = new Uint8Array(10); crypto.getRandomValues(a);
      d = Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      localStorage.setItem('demo_dev', d); return d;
    } catch (e) { return 'tmp' + Math.random().toString(36).slice(2, 14); }
  }

  /* waktu server */
  var offset = 0;
  function nowServer() { return Date.now() + offset; }
  function setServerTime(ts) { offset = ts - Date.now(); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function wib(ms) { var d = new Date(ms + 7 * 3600e3); return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), ss: d.getUTCSeconds(), dow: d.getUTCDay() }; }
  function fmtWib(ms) { var w = wib(ms); return pad2(w.d) + ' ' + BULAN[w.m - 1] + ' ' + w.y + ' ' + pad2(w.hh) + ':' + pad2(w.mm) + ':' + pad2(w.ss) + ' WIB'; }
  function ymd(ms) { var w = wib(ms); return w.y + '-' + pad2(w.m) + '-' + pad2(w.d); }
  function fmtTanggal(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? (+m[3]) + ' ' + BULAN_PANJANG[+m[2] - 1] + ' ' + m[1] : (s || ''); }
  function workdays(a, b) {
    var pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a || ''), pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b || '');
    if (!pa || !pb) return 0;
    var s = Date.UTC(+pa[1], +pa[2] - 1, +pa[3]), e = Date.UTC(+pb[1], +pb[2] - 1, +pb[3]), n = 0;
    for (var t = s; t <= e; t += 86400000) { var dw = new Date(t).getUTCDay(); if (dw !== 0 && dw !== 6) n++; }
    return n;
  }

  /* watermark layar: miring dari kiri-bawah ke kanan-atas */
  function mountWatermark() {
    var mobile = window.innerWidth < 720;
    var fs = mobile ? 12 : 15, w = Math.round(fs * 28), hh = Math.round(fs * 14);
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + hh + '">' +
      '<text x="' + w / 2 + '" y="' + hh / 2 + '" text-anchor="middle" dominant-baseline="middle" transform="rotate(-30 ' + w / 2 + ' ' + hh / 2 + ')" ' +
      'font-family="Inter,Arial,sans-serif" font-weight="600" font-size="' + fs + '" fill="#2F4254" fill-opacity="0.17">' + WM_TEXT + '</text></svg>';
    var el = document.getElementById('wm');
    el.style.backgroundImage = 'url("data:image/svg+xml;utf8,' + encodeURIComponent(svg) + '")';
    el.style.backgroundSize = w + 'px ' + hh + 'px';
  }

  function download(blob, name) {
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function toHex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sha256Hex(data) {
    if (window.crypto && crypto.subtle) return crypto.subtle.digest('SHA-256', data).then(toHex);
    return Promise.resolve(DemoCore.sha256(String.fromCharCode.apply(null, new Uint8Array(data).slice(0, 4096))));
  }
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function icon(path, size) {
    return h('span', { html: '<svg viewBox="0 0 24 24" width="' + (size || 22) + '" height="' + (size || 22) + '" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>' });
  }
  function busy(btn, on, label) {
    if (on) { btn.dataset.l = btn.textContent; btn.disabled = true; btn.textContent = label || 'Memproses...'; }
    else { btn.disabled = false; if (btn.dataset.l) btn.textContent = btn.dataset.l; }
  }

  return { h: h, clear: clear, toast: toast, deviceId: deviceId, nowServer: nowServer, setServerTime: setServerTime, fmtWib: fmtWib, ymd: ymd, wib: wib,
           fmtTanggal: fmtTanggal, workdays: workdays, mountWatermark: mountWatermark, download: download, sha256Hex: sha256Hex, fmtSize: fmtSize,
           icon: icon, busy: busy, WM_TEXT: WM_TEXT, BULAN_PANJANG: BULAN_PANJANG };
})();
