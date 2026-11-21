/* CCDoc — เอกสารรายงาน A4 ของหน้ากิจการนักเรียน (2.25.0)
 * สร้างหน้ากระดาษจริงทีละแผ่น (กว้าง 794 px = A4) นอกจอ แล้วแปลงเป็น PDF / รูป — ไม่ถ่ายภาพหน้าจอทั้งหน้าแบบเดิม
 * (แบบเดิมรูปยาวเกินขีดจำกัดของเบราว์เซอร์บนมือถือ จึงส่งออกไม่ได้) · แต่ละแผ่นขนาดเท่ากันเสมอ ใช้ได้ทั้งคอมและมือถือ
 *
 * CCDoc.pdf(doc, fileName, load) / CCDoc.png(doc, fileBase, load)
 *   doc  = { title, sub, first: html (เนื้อหาหน้าแรก — สรุป/กราฟ), table: { head: html ก่อนตาราง, title, note, cols: [{ t, w, al }], rows: [[html, ...]], group: [ชื่อกลุ่มของแต่ละแถว], foot: [แถวรวม] } }
 *   load = async () => ({ h2c: html2canvas, jsPDF })
 * ตารางแบ่งหน้าเองตามความสูงจริงของแถว (แถวไม่ขาดกลางหน้า) · หัวตารางซ้ำทุกหน้า · เลขหน้าท้ายกระดาษ
 * ชิ้นส่วนสำเร็จรูป: CCDoc.stats([[ป้าย, ค่า, สี, ข้อความเล็ก]]) · CCDoc.vbars([[ป้าย, ค่า]], สี) · CCDoc.hbars([[ป้าย, ค่า, สี]]) · CCDoc.box(หัวข้อ, html) */
(function () {
  var W = 794, H = 1123, PAD = 44, MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  var CSS = '.ccd-p{position:fixed;left:-20000px;top:0;width:' + W + 'px;height:' + H + 'px;background:#fff;color:#0f172a;box-sizing:border-box;padding:' + PAD + 'px ' + PAD + 'px 44px;font-size:13px;line-height:1.45;overflow:hidden}' +
    '.ccd-p *{box-sizing:border-box}' +
    '.ccd-hd{border-bottom:3px solid #c8102e;padding-bottom:8px;margin-bottom:14px}.ccd-hd b{display:block;font-size:20px;font-weight:800}.ccd-hd span{font-size:12.5px;color:#475569}' +
    '.ccd-hd.s{border-bottom-width:2px;padding-bottom:5px;margin-bottom:10px}.ccd-hd.s b{font-size:14.5px}' +
    '.ccd-c{position:absolute;left:' + PAD + 'px;right:' + PAD + 'px;bottom:44px}' +
    '.ccd-ft{position:absolute;left:' + PAD + 'px;right:' + PAD + 'px;bottom:16px;display:flex;justify-content:space-between;font-size:10.5px;color:#64748b}' +
    '.ccd-st{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px}.ccd-st div{border:1px solid #cbd5e1;border-radius:8px;padding:7px 10px}.ccd-st div>span{display:block;font-size:11.5px;color:#475569}.ccd-st b{display:block;font-size:22px;font-weight:800;line-height:1.25}.ccd-st div>small{display:block;font-size:10.5px;color:#64748b}' +
    '.ccd-bx{border:1px solid #cbd5e1;border-radius:8px;padding:9px 12px;margin-bottom:10px;break-inside:avoid}.ccd-bx h4{margin:0 0 8px;font-size:13.5px;font-weight:800}.ccd-2{display:grid;grid-template-columns:1fr 1fr;gap:10px}.ccd-2 .ccd-bx{margin-bottom:0}' +
    '.ccd-vb{display:flex;align-items:flex-end;gap:3px;height:132px;padding-top:16px}.ccd-vb div{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:10px;color:#475569;white-space:nowrap}.ccd-vb i{display:block;width:72%;max-width:34px;border-radius:3px 3px 0 0}.ccd-vb em{font-style:normal;font-weight:700;color:#0f172a;font-size:10.5px}.ccd-vb span{margin-top:2px}' +
    '.ccd-hb div{display:grid;grid-template-columns:170px 1fr 40px;gap:8px;align-items:center;margin:3px 0;font-size:12px}.ccd-hb span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ccd-hb i{display:block;height:10px;border-radius:5px}.ccd-hb b{text-align:right}' +
    '.ccd-hb.n div{grid-template-columns:60px 1fr 40px}' +
    '.ccd-tb{width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed}.ccd-tb th,.ccd-tb td{border:1px solid #94a3b8;padding:4px 6px;text-align:left;vertical-align:top;overflow-wrap:anywhere}.ccd-tb th{background:#eef2f6;font-weight:700;line-height:1.3;font-size:11.5px;overflow-wrap:normal;padding:4px 4px}' +
    '.ccd-tb td.c,.ccd-tb th.c{text-align:center}.ccd-tb td.r,.ccd-tb th.r{text-align:right}.ccd-tb tr.f td{background:#eef2f6;font-weight:800}.ccd-tb tr.g td{background:#f8fafc;font-weight:800;color:#c8102e}.ccd-tb small{color:#64748b}' +
    '.ccd-note{font-size:11.5px;color:#475569;margin:0 0 8px}.ccd-tt{font-weight:800;font-size:14.5px;margin-bottom:4px}.ccd-tt small{font-weight:600;color:#64748b;font-size:12px}' +
    '.ccd-bd{display:inline-block;border-radius:99px;padding:0 8px;font-size:11px;font-weight:700;line-height:1.7}.ccd-bd.g{background:#dcfce7;color:#15803d}.ccd-bd.y{background:#fef3c7;color:#b45309}.ccd-bd.r{background:#fee2e2;color:#b91c1c}.ccd-bd.n{background:#f1f5f9;color:#475569}';
  function css() { if (document.getElementById('ccdCss')) return; var s = document.createElement('style'); s.id = 'ccdCss'; s.textContent = CSS; document.head.appendChild(s); }
  function stamp() { var d = new Date(); return 'ออกเอกสารเมื่อ ' + d.getDate() + ' ' + MS[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ' น.'; }

  // ---------- ชิ้นส่วนสำเร็จรูป ----------
  function stats(list) { return '<div class="ccd-st">' + list.map(function (x) { return '<div><span>' + x[0] + '</span><b' + (x[2] ? ' style="color:' + x[2] + '"' : '') + '>' + x[1] + '</b>' + (x[3] ? '<small>' + x[3] + '</small>' : '') + '</div>'; }).join('') + '</div>'; }
  function vbars(list, color) {
    if (!list.length) return '<p class="ccd-note">ไม่มีข้อมูล</p>';
    var mx = Math.max.apply(null, [1].concat(list.map(function (x) { return x[1]; }))), many = list.length > 16;
    return '<div class="ccd-vb">' + list.map(function (x) { return '<div><em>' + (x[1] || '') + '</em><i style="height:' + Math.max(2, Math.round(x[1] / mx * 96)) + 'px;background:' + (color || '#c8102e') + '"></i><span' + (many ? ' style="font-size:8.5px"' : '') + '>' + esc(x[0]) + '</span></div>'; }).join('') + '</div>';
  }
  function hbars(list, narrow) {
    if (!list.length) return '<p class="ccd-note">ไม่มีข้อมูล</p>';
    var mx = Math.max.apply(null, [1].concat(list.map(function (x) { return x[1]; })));
    return '<div class="ccd-hb' + (narrow ? ' n' : '') + '">' + list.map(function (x) { return '<div><span' + (x[3] ? ' style="color:#64748b"' : '') + '>' + esc(x[0]) + '</span><i style="width:' + Math.max(2, Math.round(x[1] / mx * 100)) + '%;background:' + (x[2] || '#c8102e') + '"></i><b>' + x[1] + '</b></div>'; }).join('') + '</div>';
  }
  function box(title, html) { return '<div class="ccd-bx"><h4>' + title + '</h4>' + html + '</div>'; }

  // ---------- สร้างหน้า ----------
  function page(doc, first, font) {
    var p = document.createElement('div'); p.className = 'ccd-p'; p.style.fontFamily = font;
    p.innerHTML = '<div class="ccd-hd' + (first ? '' : ' s') + '"><b>' + esc(doc.title) + (first ? '' : ' (ต่อ)') + '</b><span>' + esc(doc.sub) + '</span></div><div class="ccd-in"></div>' +
      '<div class="ccd-ft"><span>' + esc(doc.stampTxt) + ' · ' + esc(doc.footer || 'เว็บส่งงาน › กิจการนักเรียน') + '</span><span class="ccd-pn"></span></div>';
    document.body.appendChild(p); return p;
  }
  function over(p) { var inn = p.querySelector('.ccd-in'); return inn.getBoundingClientRect().bottom > p.getBoundingClientRect().top + H - 44; }
  function layout(doc) {
    css(); doc.stampTxt = stamp();
    var font = getComputedStyle(document.body).fontFamily, pages = [], p, inn;
    if (doc.first) {
      p = page(doc, true, font); p.querySelector('.ccd-in').innerHTML = doc.first; pages.push(p);
      var tr; while (over(p) && (tr = p.querySelector('tr.ccd-trim:last-of-type'))) tr.remove(); // หน้าแรกล้น = ตัดแถวท้ายของตารางที่ตัดได้
    }
    // 2.27.0: หลายตาราง (doc.sections) — แต่ละตารางขึ้นหน้าใหม่เสมอ (ตารางแรกอยู่หน้าแรกได้ถ้าไม่มี first) · ตารางเดียวใช้ doc.table ได้เหมือนเดิม
    var secs = doc.sections || (doc.table ? [doc.table] : []);
    secs.forEach(function (T) {
      var head = '<colgroup>' + T.cols.map(function (c) { return '<col' + (c.w ? ' style="width:' + c.w + '"' : '') + '>'; }).join('') + '</colgroup><thead><tr>' + T.cols.map(function (c) { return '<th class="' + (c.al || '') + '">' + c.t + '</th>'; }).join('') + '</tr></thead>';
      var newPage = function (firstTable) {
        p = page(doc, !pages.length, font); pages.push(p); inn = p.querySelector('.ccd-in');
        inn.innerHTML = (firstTable && T.head ? T.head : '') + (T.title ? '<div class="ccd-tt">' + T.title + (firstTable ? '' : ' <small>(ต่อ)</small>') + '</div>' : '') + (firstTable && T.note ? '<p class="ccd-note">' + T.note + '</p>' : '') + '<table class="ccd-tb">' + head + '<tbody></tbody></table>';
        return inn.querySelector('tbody');
      };
      var tb = newPage(true), lastG = null, tr;
      if (!T.rows.length) tb.innerHTML = '<tr><td colspan="' + T.cols.length + '" class="c" style="color:#64748b">' + (T.empty || 'ไม่มีรายการ') + '</td></tr>';
      T.rows.forEach(function (r, i) {
        var g = T.group ? T.group[i] : null, add = [];
        if (g != null && g !== lastG) { var gr = document.createElement('tr'); gr.className = 'g'; gr.innerHTML = '<td colspan="' + T.cols.length + '">' + esc(g) + '</td>'; add.push(gr); }
        tr = document.createElement('tr'); tr.innerHTML = r.map(function (v, j) { return '<td class="' + (T.cols[j].al || '') + '">' + v + '</td>'; }).join(''); add.push(tr);
        add.forEach(function (x) { tb.appendChild(x); });
        if (over(p)) { // แถวล้นหน้า = ย้ายทั้งแถวไปหน้าใหม่ (ไม่มีแถวหาย / ขาดครึ่ง)
          add.forEach(function (x) { x.remove(); });
          tb = newPage(false);
          if (g != null) { var g2 = document.createElement('tr'); g2.className = 'g'; g2.innerHTML = '<td colspan="' + T.cols.length + '">' + esc(g) + (g === lastG ? ' (ต่อ)' : '') + '</td>'; tb.appendChild(g2); }
          tb.appendChild(tr);
        }
        lastG = g;
      });
      if (T.foot) { // แถวรวมท้ายตาราง
        var ft = document.createElement('tr'); ft.className = 'f'; ft.innerHTML = T.foot.map(function (v, j) { return '<td class="' + (T.cols[j].al || '') + '">' + v + '</td>'; }).join(''); tb.appendChild(ft);
        if (over(p)) { ft.remove(); tb = newPage(false); tb.appendChild(ft); }
      }
    });
    pages.forEach(function (x, i) { x.querySelector('.ccd-pn').textContent = 'หน้า ' + (i + 1) + '/' + pages.length; });
    return pages;
  }
  async function shots(doc, load, prog) {
    var L = await load(), pages = layout(doc), out = [];
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      for (var i = 0; i < pages.length; i++) { if (prog) prog(i + 1, pages.length); out.push(await L.h2c(pages[i], { scale: 2, backgroundColor: '#ffffff', logging: false, width: W, height: H, windowWidth: W })); }
    } finally { pages.forEach(function (x) { x.remove(); }); }
    return { canvases: out, jsPDF: L.jsPDF };
  }
  async function pdf(doc, fileName, load, prog) {
    var r = await shots(doc, load, prog), P = new r.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    r.canvases.forEach(function (c, i) { if (i) P.addPage(); P.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297); });
    P.save(fileName); return true;
  }
  // รูป: 1 หน้า = 1 ไฟล์ · หลายหน้า = มือถือแชร์ทุกไฟล์ทีเดียว (ถ้าเครื่องรองรับ) ไม่งั้นดาวน์โหลดทีละไฟล์
  async function png(doc, base, load, prog) {
    var r = await shots(doc, load, prog), n = r.canvases.length, files = [];
    for (var i = 0; i < n; i++) {
      var b = await new Promise(function (ok) { r.canvases[i].toBlob(ok, 'image/png'); });
      files.push({ blob: b, name: base + (n > 1 ? '_หน้า' + (i + 1) : '') + '.png' });
    }
    var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (touch && navigator.canShare) {
      try { var fs = files.map(function (f) { return new File([f.blob], f.name, { type: 'image/png' }); }); if (navigator.canShare({ files: fs })) { await navigator.share({ files: fs, title: doc.title }); return 'shared'; } }
      catch (e) { if (e && e.name === 'AbortError') return 'shared'; }
    }
    for (var k = 0; k < files.length; k++) { downloadBlob(files[k].blob, files[k].name); if (k < files.length - 1) await new Promise(function (ok) { setTimeout(ok, 350); }); }
    return true;
  }
  window.CCDoc = { pdf: pdf, png: png, stats: stats, vbars: vbars, hbars: hbars, box: box, esc: esc, layout: layout };
})();
