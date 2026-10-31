// assets/homeroom.js — 1.90 สมุดโฮมรูมรายเดือน (งานตามห้อง) สร้าง PDF ในเบราว์เซอร์จากบันทึกโฮมรูมของเว็บเช็คชื่อ BNKSA
// ข้อมูล: apiCall('hrMonthData', {roomId, month}) · รูป: hrPhoto (Worker ส่งต่อจากเว็บเช็คชื่อ) · สร้างภาพหน้า A4 ด้วย html2canvas แล้วรวมเป็น PDF ด้วย jsPDF
// (ตัวอักษรไทยเป็นภาพ — แสดงถูกทุกเครื่อง) · ท้ายสรุปมีบรรทัดลงชื่อว่างสำหรับครูที่ปรึกษา (เผื่อพิมพ์เซ็น)
var HR_TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
var HR_TH_MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
var HR_DAYS = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];
var HR_KIND = { held: ['จัดกิจกรรม', '#047857', '#d1fae5'], not: ['ไม่ได้จัด', '#be123c', '#ffe4e6'], override: ['สอนวิชาอื่นแทน', '#92400e', '#fef3c7'], holiday: ['วันหยุด', '#475569', '#f1f5f9'], none: ['ยังไม่บันทึก', '#b45309', '#ffedd5'] };
function hrMonthLabel(month) { var p = String(month || '').split('-'); return p.length === 2 ? HR_TH_MONTHS[Number(p[1]) - 1] + ' ' + (Number(p[0]) + 543) : month; }
function hrDateLabel(ymd, dow) { var p = String(ymd).split('-'); return 'วัน' + (HR_DAYS[dow] || '') + 'ที่ ' + Number(p[2]) + ' ' + HR_TH_MS[Number(p[1]) - 1] + ' ' + (Number(p[0]) + 543); }
function hrCount(model, k) { return model.rows.filter(function (r) { return r.kind === k; }).length; }
// สรุปตัวเลขสำหรับป็อปอัปก่อนส่ง
function hrModelStats(model) {
  return { days: model.rows.length - hrCount(model, 'holiday'), held: hrCount(model, 'held'), not: hrCount(model, 'not'), override: hrCount(model, 'override'), none: hrCount(model, 'none'), holiday: hrCount(model, 'holiday'),
    photos: model.rows.reduce(function (n, r) { return n + (r.log && r.log.held ? (r.log.photos || []).length : 0); }, 0) };
}
async function hrFetchPhoto(roomId, id) {
  try {
    var res = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'hrPhoto', token: getToken(), payload: { roomId: roomId, id: id } }) });
    var j = await res.json();
    if (j && j.status === 'success' && j.base64) return 'data:' + (j.mime || 'image/jpeg') + ';base64,' + j.base64;
  } catch (e) { /* ข้าม — ใส่กรอบ "โหลดรูปไม่สำเร็จ" แทน */ }
  return null;
}
// สร้าง PDF คืน Blob · opts.onProgress(pct, text) · opts.schoolName
async function hrBuildBookletPdf(model, opts) {
  opts = opts || {};
  var prog = opts.onProgress || function () {};
  await loadScriptOnce('assets/html2canvas.min.js'); await loadScriptOnce('assets/jspdf.umd.min.js');
  var esc = escapeHtml, st = hrModelStats(model);
  // รูปของวันที่จัดกิจกรรม (วันละ 1 รูปแรก)
  var jobs = []; model.rows.forEach(function (r) { if (r.log && r.log.held && r.log.photos && r.log.photos[0]) jobs.push(r); });
  var photo = {};
  for (var i = 0; i < jobs.length; i++) { prog(Math.round(i / Math.max(1, jobs.length) * 40), 'กำลังโหลดรูปกิจกรรม ' + (i + 1) + '/' + jobs.length); photo[jobs[i].date] = await hrCropCover(await hrFetchPhoto(model.roomId, jobs[i].log.photos[0].id)); } // 1.97.3: ตัดกลางภาพ 4:3 (html2canvas ไม่รองรับ object-fit)
  var head = '<div style="text-align:center; border-bottom:2px solid #334155; padding-bottom:12px; margin-bottom:14px;">' +
    '<div style="font-size:13px; color:#64748b; font-weight:600;">' + esc(opts.schoolName || model.school || '') + '</div>' +
    '<div style="font-size:24px; font-weight:800; line-height:1.7;">สมุดบันทึกกิจกรรมโฮมรูม</div>' +
    '<div style="display:inline-block; font-size:16px; font-weight:700; background:#ede9fe; color:#5b21b6; border:1px solid #c4b5fd; border-radius:999px; padding:3px 16px; line-height:1.7;">ห้อง ' + esc(model.roomName) + ' · ' + esc(hrMonthLabel(model.month)) + ' · ภาคเรียนที่ ' + esc(model.term) + '/' + esc(model.year) + '</div></div>';
  var tile = function (n, t, c, bg) { return '<div style="border:1px solid #e2e8f0; background:' + bg + '; border-radius:12px; padding:8px; text-align:center;"><div style="font-size:22px; font-weight:800; color:' + c + ';">' + n + '</div><div style="font-size:11px; font-weight:700; color:' + c + ';">' + t + '</div></div>'; };
  var tiles = '<div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-bottom:10px;">' + tile(st.days, 'คาบโฮมรูมตามตาราง', '#334155', '#fff') + tile(st.held, 'จัดกิจกรรม', '#047857', '#ecfdf5') + tile(st.not, 'ไม่ได้จัด', '#be123c', '#fff1f2') + tile(st.override, 'สอนวิชาอื่นแทน', '#92400e', '#fffbeb') + tile(st.none, 'ยังไม่บันทึก', '#b45309', '#fff7ed') + '</div>' +
    '<div style="font-size:13px; font-weight:700; margin-bottom:10px;">จัดกิจกรรม ' + st.held + ' ครั้ง จากคาบโฮมรูม ' + st.days + ' คาบในเดือนนี้' + (st.override ? ' (มีคาบที่สอนวิชาอื่นแทน ' + st.override + ' คาบ)' : '') + '</div>';
  var td = 'border:1px solid #64748b; padding:5px 7px; vertical-align:top;';
  var rowHtml = function (r) {
    var k = HR_KIND[r.kind] || HR_KIND.none, txt = r.text;
    if (r.log) txt = r.log.held ? (r.log.activity + (r.log.note ? ' — ' + r.log.note : '')) : ('เหตุผล: ' + (r.log.reason || '-'));
    return '<tr><td style="' + td + ' font-weight:700; white-space:nowrap;">' + esc(hrDateLabel(r.date, r.dow)) + '</td><td style="' + td + ' text-align:center; font-weight:700; color:' + k[1] + ';">' + k[0] + '</td><td style="' + td + '">' + esc(txt || '') + '</td></tr>';
  };
  var sign = '<div style="display:flex; justify-content:space-around; gap:20px; margin-top:28px; font-size:14px;">' + (model.advisors.length ? model.advisors : ['']).map(function (n, i, arr) {
    return '<div style="text-align:center; min-width:220px;"><div>ลงชื่อ ......................................................</div><div style="margin-top:6px;">(' + (n ? esc(n) : '......................................................') + ')</div><div style="margin-top:4px; color:#475569;">ครูที่ปรึกษา' + (arr.length > 1 ? 'คนที่ ' + (i + 1) : '') + '</div></div>';
  }).join('') + '</div>';
  var PER = 16, pages = [], sumPages = Math.max(1, Math.ceil(model.rows.length / PER));
  for (var p = 0; p < sumPages; p++) {
    var chunk = model.rows.slice(p * PER, (p + 1) * PER);
    var tbl = '<table style="width:100%; border-collapse:collapse; font-size:12px; table-layout:fixed;"><thead><tr style="background:#f1f5f9;"><th style="' + td + ' width:30%; text-align:left;">วัน</th><th style="' + td + ' width:15%;">สถานะ</th><th style="' + td + ' text-align:left;">กิจกรรม / บันทึก</th></tr></thead><tbody>' +
      (chunk.map(rowHtml).join('') || '<tr><td colspan="3" style="' + td + ' text-align:center; color:#94a3b8;">ไม่มีคาบโฮมรูมในเดือนนี้</td></tr>') + '</tbody></table>';
    pages.push('<div>' + head + (p === 0 ? tiles : '') + tbl + '</div>' + (p === sumPages - 1 ? sign : '') + (sumPages > 1 ? '<div style="position:absolute; right:40px; bottom:24px; font-size:11px; color:#94a3b8;">หน้าสรุป ' + (p + 1) + '/' + sumPages + '</div>' : ''));
  }
  // หน้ารายละเอียด: หน้าละ 3 วัน (เฉพาะวันที่มีบันทึก)
  var logged = model.rows.filter(function (r) { return r.log; });
  for (var q = 0; q < logged.length; q += 3) {
    var blocks = logged.slice(q, q + 3).map(function (r) {
      var lg = r.log, k = HR_KIND[r.kind] || HR_KIND.none, u = photo[r.date];
      var t = lg.recordedAt ? new Date(lg.recordedAt) : null;
      var f = function (a, b) { return '<div style="color:#64748b; font-weight:700;">' + a + '</div><div style="line-height:1.6;">' + b + '</div>'; };
      var c = r.counts;
      var info = '<div style="display:grid; grid-template-columns:78px 1fr; gap:4px 10px; font-size:12.5px;">' +
        (lg.held ? f('กิจกรรม', '<b>' + esc(lg.activity) + '</b>') + f('บันทึก', esc(lg.note || '-')) : f('เหตุผล', esc(lg.reason || '-'))) +
        f('นักเรียน', c ? 'มา ' + c.present + ' · สาย ' + c.late + ' · ลา ' + c.leave + ' · ขาด ' + c.absent : 'ไม่มีข้อมูลเช็คชื่อ') +
        f('บันทึกโดย', esc(lg.recordedBy || '-') + (t && !isNaN(t) ? ' · ' + String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0') + ' น.' : '')) + '</div>';
      var pic = lg.held ? (u ? '<div style="width:300px; height:225px; border-radius:10px; overflow:hidden; background:#e2e8f0; flex-shrink:0;"><img src="' + u + '" style="width:100%; height:100%; object-fit:cover; display:block;"></div>'
        : '<div style="width:300px; height:225px; border-radius:10px; background:#f1f5f9; color:#94a3b8; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; flex-shrink:0;">' + ((lg.photos || []).length ? 'โหลดรูปไม่สำเร็จ' : 'ไม่มีรูป') + '</div>') : '';
      return '<div style="border:1px solid #cbd5e1; border-radius:12px; padding:12px; margin-bottom:12px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><div style="font-size:15px; font-weight:800;">' + esc(hrDateLabel(r.date, r.dow)) + '</div><div style="font-size:12px; font-weight:800; padding:3px 12px; border-radius:999px; background:' + k[2] + '; color:' + k[1] + ';">' + k[0] + '</div></div><div style="display:flex; gap:14px; align-items:flex-start;"><div style="flex:1; min-width:0;">' + info + '</div>' + pic + '</div></div>';
    }).join('');
    pages.push('<div><div style="font-size:12px; color:#64748b; font-weight:600; border-bottom:2px solid #334155; padding-bottom:8px; margin-bottom:12px;">สมุดบันทึกกิจกรรมโฮมรูม · ห้อง ' + esc(model.roomName) + ' · ' + esc(hrMonthLabel(model.month)) + '</div>' + blocks + '</div>');
  }
  var box = document.createElement('div');
  box.style.cssText = 'position:fixed; left:-10000px; top:0; z-index:-1;';
  box.innerHTML = pages.map(function (h) { return '<div class="hr-a4" style="position:relative; width:794px; height:1123px; box-sizing:border-box; padding:40px 44px; background:#fff; color:#0f172a; font-family:\'Noto Sans Thai\', sans-serif; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden;">' + h + '</div>'; }).join('');
  document.body.appendChild(box);
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    await new Promise(function (r) { setTimeout(r, 300); });
    var pdf = new jspdf.jsPDF('p', 'pt', 'a4'), els = box.querySelectorAll('.hr-a4');
    for (var n = 0; n < els.length; n++) {
      prog(40 + Math.round(n / els.length * 58), 'กำลังสร้างหน้า ' + (n + 1) + '/' + els.length);
      var canvas = await html2canvas(els[n], { scale: 1.6, backgroundColor: '#ffffff', useCORS: true, logging: false });
      if (n > 0) pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.82), 'JPEG', 0, 0, 595.28, 841.89);
    }
    prog(100, 'สร้างไฟล์แล้ว');
    return pdf.output('blob');
  } finally { box.remove(); }
}

// 1.97.3: ตัดกลางภาพให้เป็นอัตราส่วน 4:3 ก่อนวางใน PDF — html2canvas ไม่รองรับ object-fit:cover จึงบีบ/ยืดรูป (รูปต้นฉบับใน Drive ไม่ถูกแก้)
function hrCropCover(url) {
  if (!url) return Promise.resolve(url);
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, r = 4 / 3;
      if (!iw || !ih) { resolve(url); return; }
      var sw = iw, sh = Math.round(iw / r); if (sh > ih) { sh = ih; sw = Math.round(ih * r); }
      var W = Math.min(1200, sw), H = Math.round(W / r), c = document.createElement('canvas'); c.width = W; c.height = H;
      var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, Math.round((iw - sw) / 2), Math.round((ih - sh) / 2), sw, sh, 0, 0, W, H);
      try { resolve(c.toDataURL('image/jpeg', 0.88)); } catch (e) { resolve(url); }
    };
    img.onerror = function () { resolve(url); };
    img.src = url;
  });
}
