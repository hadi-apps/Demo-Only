/* Lapisan API: Apps Script (produksi) atau mode lokal (uji) */
var API = (function () {
  var token = null, user = null, listeners = [];
  try { token = sessionStorage.getItem('demo_token'); user = JSON.parse(sessionStorage.getItem('demo_user') || 'null'); } catch (e) {}

  function remote() { return !!(window.DEMO_CONFIG && DEMO_CONFIG.API_URL); }

  function call(action, payload) {
    var req = Object.assign({ action: action, token: token, deviceId: U.deviceId() }, payload || {});
    var p;
    if (!remote()) p = DemoLocal.call(req);
    else {
      var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 30000);
      p = fetch(DEMO_CONFIG.API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(req), signal: ctl.signal })
        .then(function (r) { clearTimeout(to); return r.json(); })
        .catch(function () { clearTimeout(to); throw new Error('Tidak dapat terhubung ke server demo. Periksa koneksi internet lalu coba lagi.'); });
    }
    return p.then(function (res) {
      if (!res.ok) {
        var e = new Error(res.error || 'Terjadi kesalahan.'); e.code = res.code;
        if (res.code === 'session') { setSession(null, null); listeners.forEach(function (f) { f(); }); }
        throw e;
      }
      return res.data;
    });
  }
  function setSession(t, u) {
    token = t; user = u;
    try { if (t) { sessionStorage.setItem('demo_token', t); sessionStorage.setItem('demo_user', JSON.stringify(u)); } else { sessionStorage.removeItem('demo_token'); sessionStorage.removeItem('demo_user'); } } catch (e) {}
  }
  function syncTime() { return call('time').then(function (d) { U.setServerTime(d.ts); }).catch(function () {}); }
  function track(app, event) { if (token) call('track', { app: app, event: event }).catch(function () {}); }

  return { call: call, setSession: setSession, syncTime: syncTime, track: track, remote: remote,
           get user() { return user; }, get token() { return token; }, onSessionLost: function (f) { listeners.push(f); } };
})();
