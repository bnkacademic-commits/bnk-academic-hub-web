/* CareReport — รายงานพฤติกรรมนักเรียนรายบุคคล (PDF · A4) สำหรับแนบบันทึกข้อความ / ทัณฑ์บน
 * ใช้ไฟล์เดียวกันทั้ง BNK Care Center (หน้าครู) และเว็บส่งงาน (หน้ากิจการนักเรียน) — 1.05.0 / 2.08.0
 * CareReport.open({ data, school, load, getPhoto, fileName })
 *   data     = ผลจากคำสั่ง student { student{name,room,no,code,advisors}, score, level, late, hist[], period, startPoints, good, fair }
 *   load     = async () => ({ h2c: html2canvas, jsPDF })            (โหลดไลบรารีเมื่อกดสร้างเท่านั้น)
 *   getPhoto = async (eventId, pid) => 'data:image/...'            (ดึงรูปหลักฐานทีละรูป)
 * สร้างในเครื่องทั้งหมด · แบ่งหน้าตามความสูงจริงของแถว (แถวไม่ขาดกลางหน้า) · ภาคผนวกรูปหน้าละ 4 รูป */
(function () {
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var W = 794, H = 1123, PAD = 52; // A4 ที่ 96 dpi
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function thD(s, short) { var p = String(s || '').split('-'); if (p.length < 3) return s || ''; var y = +p[0] + 543; return (+p[2]) + ' ' + MS[+p[1] - 1] + ' ' + (short ? String(y).slice(2) : y); }
  function sgn(n) { return n > 0 ? '+' + n : String(n); }
  function lvTxt(l, s) { return Number(s) < 0 ? 'ติดลบ' : l === 'good' ? 'ดี' : l === 'fair' ? 'พอใช้' : 'ต้องปรับปรุง'; }
  function lvCol(l, s) { return Number(s) < 0 ? '#b91c1c' : l === 'good' ? '#15803d' : l === 'fair' ? '#a16207' : '#c2410c'; }
  var CSS = '.crp-m{position:fixed;inset:0;z-index:99999;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit}' +
    '.crp-b{background:#fff;color:#0f172a;border-radius:16px;width:100%;max-width:400px;padding:18px;box-shadow:0 12px 40px rgba(0,0,0,.25);font-size:15px}' +
    '.crp-b h3{margin:0 0 4px;font-size:18px}.crp-b .s{color:#64748b;font-size:13px;margin-bottom:10px}' +
    '.crp-b label{display:flex;gap:8px;align-items:center;margin:8px 0}.crp-b select,.crp-b input[type=date]{font:inherit;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#0f172a}' +
    '.crp-b .r{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:4px 0 0 26px}.crp-b .bt{display:flex;gap:8px;justify-content:flex-end;margin-top:14px}' +
    '.crp-b button{font:inherit;border:0;border-radius:10px;padding:9px 14px;font-weight:700;cursor:pointer}.crp-b .go{background:#dc2626;color:#fff}.crp-b .cc{background:#f1f5f9;color:#0f172a}' +
    '.crp-b .pg{color:#334155;font-weight:600;margin-top:10px;min-height:20px}.crp-b button:disabled{opacity:.5}' +
    '.crp-p{position:fixed;left:-20000px;top:0;width:' + W + 'px;height:' + H + 'px;background:#fff;color:#0f172a;box-sizing:border-box;padding:' + PAD + 'px ' + PAD + 'px 40px;font-size:13.5px;line-height:1.45;overflow:hidden}' +
    '.crp-p *{box-sizing:border-box}.crp-att{position:absolute;top:22px;right:' + PAD + 'px;font-size:11.5px;border:1px solid #64748b;border-radius:4px;padding:1px 8px;color:#334155}' +
    '.crp-t{text-align:center;font-weight:800;font-size:19px;margin-top:4px}.crp-st{text-align:center;font-size:13.5px;color:#334155;margin-bottom:12px}' +
    '.crp-inf{display:grid;grid-template-columns:1.2fr 1fr;gap:3px 18px;border:1px solid #94a3b8;border-radius:6px;padding:8px 12px;margin-bottom:10px}' +
    '.crp-sm{display:grid;grid-template-columns:repeat(5,1fr);border:1px solid #94a3b8;border-radius:6px;margin-bottom:10px;text-align:center}.crp-sm div{padding:5px 4px;border-left:1px solid #cbd5e1}.crp-sm div:first-child{border-left:0}.crp-sm small{display:block;color:#475569;font-size:11.5px}.crp-sm b{font-size:17px}' +
    '.crp-tb{width:100%;border-collapse:collapse;font-size:12.5px}.crp-tb th,.crp-tb td{border:1px solid #94a3b8;padding:4px 6px;text-align:left;vertical-align:top}.crp-tb th{background:#eef2f6;font-weight:700}' +
    '.crp-tb td.n{text-align:center;width:30px}.crp-tb td.d{width:78px;white-space:nowrap}.crp-tb td.p{width:52px;text-align:center;font-weight:700}.crp-tb td.b{width:150px}.crp-rf{font-weight:700;color:#1d4ed8}' +
    '.crp-sig{display:grid;grid-template-columns:1fr 1fr;gap:26px 30px;margin-top:26px;text-align:center;font-size:13px}.crp-sig span{display:block;margin-bottom:3px}' +
    '.crp-ft{position:absolute;left:' + PAD + 'px;right:' + PAD + 'px;bottom:16px;display:flex;justify-content:space-between;font-size:10.5px;color:#64748b}' +
    '.crp-ev{display:grid;grid-template-columns:1fr 1fr;gap:14px 16px;margin-top:10px}.crp-ev .im{height:400px;border:1px solid #cbd5e1;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#f8fafc}.crp-ev img{max-width:100%;max-height:100%;object-fit:contain}.crp-ev small{display:block;margin-top:4px;font-size:12px;color:#1e293b}';
  function css() { if (document.getElementById('crpCss')) return; var st = document.createElement('style'); st.id = 'crpCss'; st.textContent = CSS; document.head.appendChild(st); }

  function open(o) {
    css();
    var d = o.data, todayIso = new Date().toISOString().slice(0, 10), dates = d.hist.map(function (h) { return h.date; }).sort();
    var hasPh = d.hist.some(function (h) { return h.photos && h.photos.length; });
    var m = document.createElement('div'); m.className = 'crp-m';
    m.innerHTML = '<div class="crp-b" role="dialog" aria-modal="true"><h3>📄 รายงานพฤติกรรมรายบุคคล (PDF)</h3><div class="s">' + esc(d.student.name) + ' · ' + esc(d.student.room) + ' เลขที่ ' + esc(d.student.no) + '</div>' +
      '<label><input type="radio" name="crpR" value="p" checked> ช่วง: ' + esc(d.period || 'รอบคะแนนปัจจุบัน') + '</label>' +
      '<label><input type="radio" name="crpR" value="c"> กำหนดวันที่</label><div class="r"><input type="date" id="crpF" value="' + (dates[0] || todayIso) + '"> – <input type="date" id="crpT" value="' + (dates[dates.length - 1] || todayIso) + '"></div>' +
      '<label>รายการ <select id="crpK"><option value="all">ทั้งหมด</option><option value="minus">เฉพาะที่หักคะแนน</option><option value="nolate">ไม่รวมมาสาย</option></select></label>' +
      '<label><input type="checkbox" id="crpP"' + (hasPh ? ' checked' : ' disabled') + '> แนบรูปหลักฐาน (ภาคผนวก)' + (hasPh ? '' : ' — ไม่มีรูป') + '</label>' +
      '<label><input type="checkbox" id="crpS" checked> ช่องลงชื่อ</label>' +
      '<div class="pg" id="crpPg"></div><div class="bt"><button type="button" class="cc" id="crpX">ปิด</button><button type="button" class="go" id="crpGo">สร้าง PDF</button></div></div>';
    document.body.appendChild(m);
    var close = function () { m.remove(); };
    m.addEventListener('click', function (e) { if (e.target === m || e.target.id === 'crpX') close(); });
    m.querySelector('#crpGo').addEventListener('click', async function () {
      var go = this, pg = m.querySelector('#crpPg');
      var opt = { custom: m.querySelector('[name=crpR]:checked').value === 'c', from: m.querySelector('#crpF').value, to: m.querySelector('#crpT').value, kind: m.querySelector('#crpK').value, photos: m.querySelector('#crpP').checked, sign: m.querySelector('#crpS').checked };
      if (opt.custom && (!opt.from || !opt.to || opt.from > opt.to)) { pg.textContent = 'ช่วงวันที่ไม่ถูกต้อง'; return; }
      go.disabled = true; m.querySelector('#crpX').disabled = true;
      try { var pdf = await build(o, opt, function (t) { pg.textContent = t; }); pdf.save(o.fileName || 'รายงานพฤติกรรม.pdf'); close(); if (o.done) o.done(); }
      catch (e) { pg.textContent = 'สร้างไม่สำเร็จ: ' + (e && e.message || e); go.disabled = false; m.querySelector('#crpX').disabled = false; }
    });
  }

  async function build(o, opt, prog) {
    var d = o.data, st = d.student, start = d.startPoints || 100;
    prog('กำลังเตรียม…');
    var L = await o.load();
    var rows = d.hist.filter(function (h) {
      if (opt.custom && (h.date < opt.from || h.date > opt.to)) return false;
      if (opt.kind === 'minus' && !(h.delta < 0)) return false;
      if (opt.kind === 'nolate' && h.kind === 'late') return false;
      return true;
    }).slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)) || (a.at || 0) - (b.at || 0); }); // เก่า → ใหม่ (อ่านแบบเอกสาร)
    var mn = 0, pl = 0, lateN = 0; rows.forEach(function (h) { if (h.delta < 0) mn += h.delta; else pl += h.delta; if (h.kind === 'late') lateN++; });
    // รูปหลักฐาน
    var ev = [], seq = 0;
    if (opt.photos) rows.forEach(function (h, i) { (h.photos || []).forEach(function (pid) { seq++; ev.push({ no: seq, row: i + 1, h: h, pid: pid }); }); h._ref = null; });
    rows.forEach(function (h, i) { var mine = ev.filter(function (x) { return x.row === i + 1; }); h._ref = mine.length ? mine[0].no + (mine.length > 1 ? '–' + mine[mine.length - 1].no : '') : ''; });
    for (var k = 0; k < ev.length; k++) { prog('กำลังโหลดรูปหลักฐาน ' + (k + 1) + '/' + ev.length + '…'); try { ev[k].src = await o.getPhoto(ev[k].h.id, ev[k].pid); } catch (e) { ev[k].src = ''; ev[k].err = e && e.message || 'โหลดรูปไม่สำเร็จ'; } }
    // หน้า
    var now = new Date(), stamp = 'ออกเอกสารเมื่อ ' + now.getDate() + ' ' + MS[now.getMonth()] + ' ' + (now.getFullYear() + 543) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' น.';
    var font = getComputedStyle(document.body).fontFamily, pages = [];
    function page() { var p = document.createElement('div'); p.className = 'crp-p'; p.style.fontFamily = font; p.innerHTML = '<span class="crp-att">เอกสารแนบ</span><div class="crp-c"></div><div class="crp-ft"><span>' + esc(stamp) + ' · BNK Care Center</span><span class="crp-pn"></span></div>'; document.body.appendChild(p); pages.push(p); return p.querySelector('.crp-c'); }
    function over(c) { var p = c.parentNode; return c.offsetTop + c.scrollHeight > H - 44; }
    var rangeTxt = opt.custom ? 'ช่วงวันที่ ' + thD(opt.from) + ' – ' + thD(opt.to) : (d.period || '');
    var adv = (st.advisors || []).join(', ');
    var c = page();
    c.innerHTML = '<div class="crp-t">แบบรายงานพฤติกรรมนักเรียนรายบุคคล</div><div class="crp-st">งานกิจการนักเรียน ' + esc(o.school || 'โรงเรียนบุ่งคล้านคร') + ' · ' + esc(rangeTxt) + '</div>' +
      '<div class="crp-inf"><span><b>ชื่อ-สกุล</b> ' + esc(st.name) + '</span><span><b>ชั้น</b> ' + esc(st.room) + ' <b>เลขที่</b> ' + esc(st.no) + '</span><span><b>รหัสนักเรียน</b> ' + esc(st.code || '-') + '</span><span><b>ครูที่ปรึกษา</b> ' + esc(adv || '-') + '</span></div>' +
      '<div class="crp-sm"><div><small>คะแนนเริ่มต้น</small><b>' + start + '</b></div><div><small>หัก' + (opt.custom || opt.kind !== 'all' ? ' (ในรายงาน)' : '') + '</small><b style="color:#b91c1c">' + mn + '</b></div><div><small>เพิ่ม' + (opt.custom || opt.kind !== 'all' ? ' (ในรายงาน)' : '') + '</small><b style="color:#1d4ed8">' + sgn(pl) + '</b></div><div><small>คะแนนปัจจุบัน</small><b>' + d.score + '</b></div><div><small>ระดับ</small><b style="color:' + lvCol(d.level, d.score) + ';font-size:14px">' + lvTxt(d.level, d.score) + '</b></div></div>';
    var thead = '<thead><tr><th style="text-align:center">#</th><th>วันที่</th><th>รายการ / หมายเหตุ</th><th style="text-align:center">คะแนน</th><th>ผู้บันทึก</th></tr></thead>';
    function table(cc) { var t = document.createElement('table'); t.className = 'crp-tb'; t.innerHTML = thead + '<tbody></tbody>'; cc.appendChild(t); return t.tBodies[0]; }
    var tb = table(c);
    if (!rows.length) tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#64748b">ไม่มีรายการในช่วงที่เลือก</td></tr>';
    rows.forEach(function (h, i) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td class="n">' + (i + 1) + '</td><td class="d">' + thD(h.date, true) + (h.kind === 'late' && h.time ? '<br><small>' + esc(h.time) + ' น.</small>' : '') + '</td><td>' + (h.kind === 'late' ? 'มาสาย' + (h.reason ? ' — ' + esc(h.reason) : '') : esc(h.item) + (h.note ? ' — ' + esc(h.note) : '')) + (h._ref ? ' <span class="crp-rf">[ภาคผนวก รูปที่ ' + h._ref + ']</span>' : '') + '</td><td class="p" style="color:' + (h.delta < 0 ? '#b91c1c' : '#1d4ed8') + '">' + sgn(h.delta) + '</td><td class="b">' + esc(h.by || '-') + '</td>';
      tb.appendChild(tr);
      if (over(c)) { tr.remove(); c = page(); c.innerHTML = '<div style="font-weight:700;margin-bottom:6px">' + esc(st.name) + ' · ' + esc(st.room) + ' เลขที่ ' + esc(st.no) + ' (ต่อ)</div>'; tb = table(c); tb.appendChild(tr); }
    });
    var tot = document.createElement('div'); tot.style.cssText = 'margin-top:6px;font-size:12.5px;color:#334155';
    tot.textContent = 'รวม ' + rows.length + ' รายการ' + (lateN ? ' (มาสาย ' + lateN + ' ครั้ง)' : '') + ' · หัก ' + mn + ' · เพิ่ม ' + sgn(pl) + ' คะแนน';
    c.appendChild(tot); if (over(c)) { tot.remove(); c = page(); c.appendChild(tot); }
    if (opt.sign) {
      var sg = document.createElement('div'); sg.className = 'crp-sig';
      var line = function (role, name) { return '<div><span>ลงชื่อ ........................................ ' + role + '</span>( ' + (name ? esc(name) : '........................................') + ' )</div>'; };
      sg.innerHTML = line('นักเรียน', st.name) + line('ผู้ปกครอง') + line('ครูที่ปรึกษา', (st.advisors || [])[0]) + line('ครูกิจการนักเรียน');
      c.appendChild(sg); if (over(c)) { sg.remove(); c = page(); c.appendChild(sg); }
    }
    // ภาคผนวก — หน้าละ 4 รูป
    for (var a = 0; a < ev.length; a += 4) {
      c = page();
      c.innerHTML = '<div style="font-weight:800;font-size:16px">ภาคผนวก — รูปหลักฐานประกอบ' + (a ? ' (ต่อ)' : '') + '</div><div style="color:#334155">' + esc(st.name) + ' · ' + esc(st.room) + ' เลขที่ ' + esc(st.no) + '</div>' +
        '<div class="crp-ev">' + ev.slice(a, a + 4).map(function (x) { var h = x.h; return '<div><div class="im">' + (x.src ? '<img src="' + x.src + '" alt="">' : '<span style="color:#94a3b8">' + esc(x.err || 'ไม่มีรูป') + '</span>') + '</div><small><b>รูปที่ ' + x.no + '</b> · รายการที่ ' + x.row + ' · ' + esc(h.item || 'มาสาย') + ' · ' + thD(h.date) + '</small></div>'; }).join('') + '</div>';
    }
    pages.forEach(function (p, i) { p.querySelector('.crp-pn').textContent = 'หน้า ' + (i + 1) + '/' + pages.length; });
    // ถ่ายภาพทีละหน้า → PDF
    await Promise.all([].slice.call(document.querySelectorAll('.crp-p img')).map(function (im) { return im.complete ? 0 : new Promise(function (r) { im.onload = im.onerror = r; }); }));
    if (document.fonts && document.fonts.ready) { try { await document.fonts.ready; } catch (e) { /* ข้าม */ } }
    var pdf = new L.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    try {
      for (var i = 0; i < pages.length; i++) {
        prog('กำลังสร้างหน้า ' + (i + 1) + '/' + pages.length + '…');
        var cv = await L.h2c(pages[i], { scale: 2, backgroundColor: '#ffffff', logging: false, width: W, height: H, windowWidth: W });
        if (i) pdf.addPage();
        pdf.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);
      }
    } finally { pages.forEach(function (p) { p.remove(); }); }
    return pdf;
  }
  window.CareReport = { open: open };
})();
