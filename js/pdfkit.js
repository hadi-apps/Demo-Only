/* Pembantu PDF (pdf-lib): watermark miring + penulis dokumen sederhana */
var PK = (function () {
  var L = PDFLib, rgb = L.rgb, degrees = L.degrees;
  var SLATE = rgb(0.184, 0.259, 0.329), INK = rgb(0.145, 0.188, 0.231), MUT = rgb(0.373, 0.42, 0.463), SAGE = rgb(0.36, 0.54, 0.467), LINE = rgb(0.84, 0.82, 0.78);

  function safe(s) { return String(s == null ? '' : s).replace(/[^\x20-\x7E\xA0-\xFF]/g, '?'); }

  /* watermark miring ke kanan-atas (kiri-bawah → kanan-atas) di setiap halaman.
     Posisi dihitung pada bidang yang diputar 30°: u = sepanjang teks, v = tegak lurus teks. */
  function watermark(doc, font) {
    var text = safe(U.WM_TEXT), A = 30 * Math.PI / 180, ca = Math.cos(A), sa = Math.sin(A);
    doc.getPages().forEach(function (page) {
      var w = page.getWidth(), hgt = page.getHeight(), size = Math.max(11, Math.min(20, Math.min(w, hgt) / 34));
      var tw = font.widthOfTextAtSize(text, size), gapU = tw + size * 3, gapV = size * 6.5, diag = Math.sqrt(w * w + hgt * hgt), row = 0;
      for (var v = -diag; v < diag; v += gapV, row++) {
        for (var u = -diag - (row % 2) * gapU / 2; u < diag; u += gapU) {
          var x = u * ca - v * sa, y = u * sa + v * ca;
          var x2 = x + tw * ca, y2 = y + tw * sa;                       /* ujung teks */
          if (Math.max(x, x2) < -20 || Math.min(x, x2) > w + 20 || Math.max(y, y2) < -20 || Math.min(y, y2) > hgt + 20) continue;
          page.drawText(text, { x: x, y: y, size: size, font: font, color: SLATE, opacity: 0.16, rotate: degrees(30) });
        }
      }
    });
  }

  /* penulis dokumen sederhana (A4 potret) */
  function Writer(doc, fonts) {
    this.doc = doc; this.f = fonts; this.m = 50; this.W = 595.28; this.H = 841.89;
    this.newPage();
  }
  Writer.prototype.newPage = function () { this.page = this.doc.addPage([this.W, this.H]); this.y = this.H - 56; };
  Writer.prototype.ensure = function (n) { if (this.y - n < 60) this.newPage(); };
  Writer.prototype.text = function (str, o) {
    o = o || {};
    var size = o.size || 10.5, font = o.bold ? this.f.bold : this.f.reg, maxW = (o.maxW || (this.W - this.m * 2)), x = o.x == null ? this.m : o.x;
    var lines = this.wrap(safe(str), font, size, maxW), lh = size * 1.35, self = this;
    lines.forEach(function (ln) {
      self.ensure(lh);
      self.page.drawText(ln, { x: o.center ? (self.W - font.widthOfTextAtSize(ln, size)) / 2 : x, y: self.y - size, size: size, font: font, color: o.color || INK });
      self.y -= lh;
    });
    this.y -= (o.gap == null ? 3 : o.gap);
    return lines.length;
  };
  Writer.prototype.wrap = function (str, font, size, maxW) {
    var out = [];
    String(str).split('\n').forEach(function (para) {
      var words = para.split(/\s+/), cur = '';
      words.forEach(function (w) {
        var t = cur ? cur + ' ' + w : w;
        if (font.widthOfTextAtSize(t, size) <= maxW) cur = t;
        else { if (cur) out.push(cur); cur = w; }
      });
      out.push(cur);
    });
    return out;
  };
  Writer.prototype.rule = function (gap) { this.ensure(10); this.page.drawLine({ start: { x: this.m, y: this.y }, end: { x: this.W - this.m, y: this.y }, thickness: 0.6, color: LINE }); this.y -= (gap == null ? 10 : gap); };
  Writer.prototype.kv = function (k, v, o) {
    o = o || {}; var kw = o.kw || 120, size = 10.5;
    var lines = this.wrap(safe(v), this.f.reg, size, this.W - this.m * 2 - kw), lh = size * 1.4, self = this;
    this.ensure(lh * lines.length);
    this.page.drawText(safe(k), { x: this.m, y: this.y - size, size: size, font: this.f.reg, color: MUT });
    lines.forEach(function (ln, i) { self.page.drawText(ln, { x: self.m + kw, y: self.y - size - i * lh, size: size, font: self.f.bold, color: INK }); });
    this.y -= lh * lines.length + 3;
  };
  Writer.prototype.bar = function (label, val, max, color) {
    this.ensure(18);
    var x0 = this.m + 150, w = 260, y = this.y - 12;
    this.page.drawText(safe(label), { x: this.m, y: y, size: 10, font: this.f.reg, color: INK });
    this.page.drawRectangle({ x: x0, y: y - 2, width: w, height: 8, color: rgb(0.91, 0.9, 0.85) });
    this.page.drawRectangle({ x: x0, y: y - 2, width: Math.max(0.01, w * (val / max)), height: 8, color: color || rgb(0.243, 0.361, 0.463) });
    this.page.drawText(String(val) + '/' + String(max), { x: x0 + w + 10, y: y, size: 10, font: this.f.bold, color: INK });
    this.y -= 18;
  };

  async function newDoc() {
    var doc = await L.PDFDocument.create();
    var fonts = { reg: await doc.embedFont(L.StandardFonts.Helvetica), bold: await doc.embedFont(L.StandardFonts.HelveticaBold), serif: await doc.embedFont(L.StandardFonts.TimesRomanBold) };
    return { doc: doc, fonts: fonts };
  }
  function footerAll(doc, font, note) {
    var pages = doc.getPages();
    pages.forEach(function (p, i) {
      p.drawText(safe(note + '   |   Halaman ' + (i + 1) + ' dari ' + pages.length), { x: 50, y: 28, size: 8, font: font, color: MUT });
    });
  }

  /* contoh PDF hasil laboratorium (data FIKTIF) */
  async function sampleLab(withDate) {
    var d = await newDoc(), w = new Writer(d.doc, d.fonts);
    w.text('LAPORAN HASIL PEMERIKSAAN LABORATORIUM', { size: 15, bold: true, gap: 2 });
    w.text('CONTOH DOKUMEN FIKTIF UNTUK DEMO', { size: 9, color: MUT, gap: 8 }); w.rule();
    w.kv('Nama Pasien', 'Pasien Contoh'); w.kv('No. Laboratorium', 'LAB-DEMO-0001');
    if (withDate) { w.kv('Tanggal Lahir', '14 Agustus 1990'); w.kv('Tanggal Pemeriksaan', '09 November 2026'); }
    else { w.kv('Jenis Kelamin', 'Laki-laki'); w.kv('Usia', '36 Tahun'); }
    w.kv('Dokter Pengirim', 'dr. Contoh'); w.rule(14);
    w.text('Hematologi Rutin', { bold: true, size: 12, gap: 6 });
    [['Hemoglobin', '14.2', 'g/dL', '13.0 - 17.0'], ['Leukosit', '7.100', '/uL', '4.000 - 10.000'], ['Trombosit', '265.000', '/uL', '150.000 - 450.000'], ['Hematokrit', '43', '%', '40 - 50']].forEach(function (r) {
      w.ensure(16);
      w.page.drawText(r[0], { x: 50, y: w.y - 10, size: 10.5, font: d.fonts.reg, color: INK });
      w.page.drawText(r[1], { x: 230, y: w.y - 10, size: 10.5, font: d.fonts.bold, color: INK });
      w.page.drawText(r[2], { x: 290, y: w.y - 10, size: 10.5, font: d.fonts.reg, color: MUT });
      w.page.drawText('Rujukan: ' + r[3], { x: 360, y: w.y - 10, size: 10, font: d.fonts.reg, color: MUT });
      w.y -= 18;
    });
    w.y -= 10; w.rule();
    w.text('Catatan: dokumen ini dibuat otomatis sebagai contoh. Seluruh data adalah fiktif.', { size: 9, color: MUT });
    var bytes = await d.doc.save();
    return new Uint8Array(bytes);
  }

  return { watermark: watermark, Writer: Writer, newDoc: newDoc, footerAll: footerAll, safe: safe, sampleLab: sampleLab,
           colors: { SLATE: SLATE, INK: INK, MUT: MUT, SAGE: SAGE } };
})();
