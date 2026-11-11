/* แนะแนว (2.09.0) — หน้า guidance.html · ผลการศึกษาต่อของนักเรียน ม.6
 * แท็บ: ผลการศึกษาต่อ (รายชื่อกดย่อ/ขยาย) · รอตรวจ/แก้ไข (ผู้ดูแล) · สรุป · ตั้งค่า (ผู้ดูแล: เปิด/ปิดฟอร์ม · ปรับรวมชื่อ · QR)
 * สิทธิ์: m = จัดการ · v = ดูผลทุกห้อง (ผู้บริหารอัตโนมัติ) · a = ครูที่ปรึกษา ม.6 (ห้องตัวเอง — เปิด/ปิดได้ในตั้งค่า) */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('guide'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('gdBody'), tabsEl = document.getElementById('gdTabs'), modal = document.getElementById('gdModal');
  var B = null, st = { tab: 'list', year: '', q: '', room: '', fs: '', open: {}, names: 'uni', nm: null, pick: {} };
  var ST = { study: 'ศึกษาต่อ', wait: 'รอผล', work: 'ไม่ศึกษาต่อ / ทำงาน', other: 'อื่น ๆ' };
  var RD = { '1': 'รอบ 1 Portfolio', '2': 'รอบ 2 Quota', '3': 'รอบ 3 Admission', '4': 'รอบ 4 Direct', other: 'รับตรง/อื่น ๆ' };
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function ic(n) { return '<i class="fa-solid ' + n + '" aria-hidden="true"></i>'; }
  function err(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function thD(iso) { if (!iso) return ''; var d = new Date(iso); if (isNaN(d)) { var p = String(iso).split('-'); return p.length === 3 ? (+p[2]) + ' ' + MS[+p[1] - 1] + ' ' + (+p[0] + 543) : iso; } return d.getDate() + ' ' + MS[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
  function M() { return B && B.role === 'm'; }
  function norm(s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); }
  function closeModal() { hideModalEl(modal); }
  modal.addEventListener('click', function (e) { if (e.target.closest('[data-gd-close]')) closeModal(); });
  function openModal(title, html, actions) { document.getElementById('gdModalTitle').textContent = title; document.getElementById('gdModalBody').innerHTML = html; document.getElementById('gdModalActions').innerHTML = actions || ''; showModalEl(modal); }

  async function boot() {
    try { B = await apiCall('guideBoot', st.year ? { year: st.year } : {}); } catch (e) { tabsEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    st.year = B.year; renderTabs();
  }
  function pending() { return B.list.filter(function (x) { return x.review === 'pending'; }); }
  function renderTabs() {
    var t = [['list', 'fa-list', 'ผลการศึกษาต่อ']];
    if (M()) { var n = pending().length; t.push(['review', 'fa-clipboard-check', 'รอตรวจ / แก้ไข' + (n ? ' <span class="gd-badge">' + n + '</span>' : '')]); }
    t.push(['sum', 'fa-chart-column', 'สรุป']);
    if (M()) t.push(['cfg', 'fa-gear', 'ตั้งค่า']);
    if (!t.some(function (x) { return x[0] === st.tab; })) st.tab = 'list';
    tabsEl.innerHTML = '<div class="gd-tools"><label><i class="fa-solid fa-calendar"></i> ปีการศึกษา <select id="gdYear">' + B.years.map(function (y) { return '<option value="' + y + '"' + (y === B.year ? ' selected' : '') + '>' + y + (y === B.curYear ? ' (ปัจจุบัน)' : '') + '</option>'; }).join('') + '</select></label>' + (B.role === 'a' ? '<span class="gd-mut">ครูที่ปรึกษา — เห็นเฉพาะห้องของตัวเอง</span>' : B.role === 'v' ? '<span class="gd-mut">ดูได้อย่างเดียว</span>' : '') + '</div>' +
      t.map(function (x) { return '<button type="button" role="tab" data-gd-tab="' + x[0] + '" class="' + (x[0] === st.tab ? 'on' : '') + '">' + ic(x[1]) + ' ' + x[2] + '</button>'; }).join('');
    show();
  }
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-gd-tab]'); if (b) { st.tab = b.getAttribute('data-gd-tab'); renderTabs(); } });
  tabsEl.addEventListener('change', function (e) { if (e.target.id === 'gdYear') { st.year = e.target.value; st.open = {}; boot(); } });
  function show() { ({ list: renderList, review: renderReview, sum: renderSum, cfg: renderCfg })[st.tab](); }

  // ---------- ตัวช่วยแสดงผล ----------
  function conf(x) { return (x.entries || []).filter(function (e) { return e.confirmed; })[0] || null; }
  function lineOf(x) {
    if (!x.status) return '<span class="gd-red">ยังไม่รายงาน</span>';
    if (x.status === 'study') { var c = conf(x), n = x.entries.length; return 'ติด ' + n + ' แห่ง · ' + (c ? 'ยืนยันสิทธิ์: ' + esc(c.university) : '<span class="gd-amb">ยังไม่ยืนยันสิทธิ์</span>'); }
    return esc(ST[x.status] || x.status) + (x.statusNote ? ' — ' + esc(x.statusNote) : '');
  }
  function revTag(x) { return x.review === 'ok' ? '<span class="gd-tag ok">ผ่านแล้ว</span>' : x.review === 'pending' ? '<span class="gd-tag wait">รอตรวจ</span>' : x.review === 'back' ? '<span class="gd-tag back">ส่งกลับแก้</span>' : ''; }
  function av(x, big) { return x.photo ? '<img class="gd-av' + (big ? ' big' : '') + '" src="' + esc(x.photo.src) + '" alt="" loading="lazy" referrerpolicy="no-referrer" data-gd-zoom="' + esc(x.photo.src.replace('sz=w400', 'sz=w1200')) + '">' : '<span class="gd-av' + (big ? ' big' : '') + ' none">' + ic('fa-user') + '</span>'; }
  function entHtml(e) { return '<div class="gd-ent">' + (e.confirmed ? '<span class="gd-tag cf">' + ic('fa-check') + ' ยืนยันสิทธิ์</span>' : '<span class="gd-tag">ติด</span>') + '<span><b>' + esc(e.major || '-') + '</b><small>' + [e.faculty, e.university, RD[e.round] || ''].filter(Boolean).map(esc).join(' · ') + '</small></span></div>'; }
  function detail(x) {
    return '<div class="gd-ab">' + (x.photo ? '<div class="gd-ph">' + av(x, true) + '</div>' : '') + '<div class="gd-abm">' + (x.status === 'study' || (x.entries || []).length ? (x.entries.length ? x.entries.map(entHtml).join('') : '<p class="gd-mut">ยังไม่มีข้อมูลที่สอบติด</p>') : '<p>' + lineOf(x) + '</p>') +
      (x.review === 'back' && x.reviewNote ? '<p class="gd-backnote">' + ic('fa-rotate-left') + ' ส่งกลับ: ' + esc(x.reviewNote) + '</p>' : '') +
      '<p class="gd-mut gd-meta">' + (x.consent ? 'ยินยอมเผยแพร่ ✓' : 'ไม่ยินยอมเผยแพร่') + (x.submittedAt ? ' · ส่งเมื่อ ' + thD(x.submittedAt) : '') + (x.reviewedBy ? ' · ตรวจโดย ' + esc(x.reviewedBy) : '') + '</p>' +
      (M() ? '<div class="gd-acts">' + (x.review !== 'ok' && x.status ? '<button type="button" class="btn btn-success btn-sm" data-gd-ok="' + esc(x.id) + '">' + ic('fa-check') + ' ผ่าน</button>' : '') + '<button type="button" class="btn btn-secondary btn-sm" data-gd-edit="' + esc(x.studentId) + '">' + ic('fa-pen') + ' แก้ไข</button>' + (x.status ? '<button type="button" class="btn btn-ghost btn-sm gd-red" data-gd-back="' + esc(x.id) + '">' + ic('fa-rotate-left') + ' ส่งกลับให้แก้</button>' : '') + (x.photo ? '<button type="button" class="btn btn-ghost btn-sm" data-gd-delph="' + esc(x.id) + '">' + ic('fa-image') + ' ลบรูป</button>' : '') + '</div>' : '') + '</div></div>';
  }
  function rooms() { var s = {}; B.list.forEach(function (x) { s[x.roomId] = x.room; }); return Object.keys(s).sort(function (a, b) { return (+a.split('_')[1] || 0) - (+b.split('_')[1] || 0); }).map(function (k) { return [k, s[k]]; }); }
  function filtered() {
    var q = norm(st.q);
    return B.list.filter(function (x) {
      if (st.room && x.roomId !== st.room) return false;
      if (st.fs === 'none' && x.status) return false;
      if (st.fs && st.fs !== 'none' && st.fs !== 'consent' && st.fs !== 'pending' && st.fs !== 'back' && x.status !== st.fs) return false;
      if (st.fs === 'consent' && !x.consent) return false;
      if ((st.fs === 'pending' || st.fs === 'back') && x.review !== st.fs) return false;
      if (q && norm(x.name).indexOf(q) === -1 && !(x.entries || []).some(function (e) { return norm(e.university + e.faculty + e.major).indexOf(q) !== -1; })) return false;
      return true;
    });
  }
  function kpis() {
    var L = B.list, rep = L.filter(function (x) { return x.status; }), cf = L.filter(function (x) { return x.status === 'study' && conf(x); }), wait = L.filter(function (x) { return x.status === 'wait'; });
    var pct = L.length ? Math.round(rep.length / L.length * 100) : 0;
    return '<div class="gd-kp">' + [['นักเรียน ม.6', L.length, ''], ['รายงานแล้ว', rep.length + ' <small>' + pct + '%</small>', '#15803d', wait.length ? 'รวมรอผล ' + wait.length + ' คน' : ''], ['ศึกษาต่อ (ยืนยันสิทธิ์)', cf.length, '#4338ca'], ['ยังไม่รายงาน', L.length - rep.length, L.length - rep.length ? '#b91c1c' : '']]
      .map(function (k) { return '<div><small>' + k[0] + '</small><b' + (k[2] ? ' style="color:' + k[2] + '"' : '') + '>' + k[1] + '</b>' + (k[3] ? '<em>' + k[3] + '</em>' : '') + '</div>'; }).join('') + '</div>';
  }

  // ---------- แท็บ: ผลการศึกษาต่อ ----------
  function renderList() {
    if (!B.list.length) { body.innerHTML = '<div class="card gd-empty">' + ic('fa-user-graduate') + '<p>' + (B.linked ? 'ไม่พบรายชื่อนักเรียน ม.6 ของปีการศึกษา ' + esc(B.year) : 'ยังไม่ได้เชื่อมเว็บเช็คชื่อ — ดึงรายชื่อนักเรียนไม่ได้') + '</p></div>'; return; }
    body.innerHTML = '<div class="card">' + kpis() + '<div class="gd-flt"><input type="search" id="gdQ" placeholder="ค้นหาชื่อ / มหาวิทยาลัย / คณะ / สาขา" value="' + esc(st.q) + '">' +
      '<select id="gdRoom"><option value="">ทุกห้อง</option>' + rooms().map(function (r) { return '<option value="' + esc(r[0]) + '"' + (st.room === r[0] ? ' selected' : '') + '>' + esc(r[1]) + '</option>'; }).join('') + '</select>' +
      '<select id="gdFs">' + [['', 'ทุกสถานะ'], ['none', 'ยังไม่รายงาน'], ['study', 'ศึกษาต่อ'], ['wait', 'รอผล'], ['work', 'ไม่ศึกษาต่อ / ทำงาน'], ['other', 'อื่น ๆ'], ['pending', 'รอตรวจ'], ['back', 'ส่งกลับแก้'], ['consent', 'ยินยอมเผยแพร่']].map(function (o) { return '<option value="' + o[0] + '"' + (st.fs === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-gd-xls>' + ic('fa-file-excel') + ' Excel</button></div><div id="gdList"></div></div>';
    paintList();
  }
  function paintList() {
    var L = filtered(), box = document.getElementById('gdList'); if (!box) return;
    box.innerHTML = '<p class="gd-mut" style="margin:4px 0 8px">' + L.length + ' คน</p>' + (L.length ? L.map(function (x) {
      var o = !!st.open[x.id];
      return '<div class="gd-acc' + (o ? ' open' : '') + '"><button type="button" class="gd-ah" data-gd-acc="' + esc(x.id) + '" aria-expanded="' + o + '">' + av(x) + '<span class="gd-an"><b>' + esc(x.name) + '</b> <small>' + esc(x.room) + ' เลขที่ ' + esc(x.no) + '</small><em>' + lineOf(x) + '</em></span>' + revTag(x) + '<i class="fa-solid fa-chevron-' + (o ? 'up' : 'down') + ' gd-chev"></i></button>' + (o ? detail(x) : '') + '</div>';
    }).join('') : '<p class="gd-mut" style="text-align:center;padding:14px">ไม่พบรายการ</p>');
  }
  body.addEventListener('input', function (e) { if (e.target.id === 'gdQ') { st.q = e.target.value; paintList(); } });
  body.addEventListener('change', function (e) { if (e.target.id === 'gdRoom') { st.room = e.target.value; paintList(); } else if (e.target.id === 'gdFs') { st.fs = e.target.value; paintList(); } });

  // ---------- แท็บ: รอตรวจ ----------
  function renderReview() {
    var P = pending().sort(function (a, b) { return String(a.submittedAt).localeCompare(String(b.submittedAt)); }), Bk = B.list.filter(function (x) { return x.review === 'back'; });
    body.innerHTML = '<div class="card"><h3 class="gd-h">' + ic('fa-inbox') + ' รอตรวจ ' + P.length + ' คน</h3><p class="gd-mut">รายการใหม่/ที่นักเรียนแก้ไข เรียงตามเวลาส่ง · ' + (B.cfg && B.cfg.review ? 'คำแนะนำชื่อมหาวิทยาลัย/คณะ/สาขาใช้เฉพาะรายการที่ผ่านแล้ว' : 'ตั้งค่าไว้ไม่ต้องรอตรวจ — รายการใหม่ผ่านอัตโนมัติ') + '</p>' +
      (P.length ? P.map(function (x) { return '<div class="gd-rv">' + av(x) + '<div class="gd-rvm"><b>' + esc(x.name) + '</b> <small class="gd-mut">' + esc(x.room) + ' เลขที่ ' + esc(x.no) + ' · ส่ง ' + thD(x.submittedAt) + '</small>' + (x.status === 'study' ? x.entries.map(entHtml).join('') : '<p>' + lineOf(x) + '</p>') + '<p class="gd-mut gd-meta">' + (x.consent ? 'ยินยอมเผยแพร่ ✓' : 'ไม่ยินยอมเผยแพร่') + (x.photo ? '' : ' · ยังไม่มีรูป') + '</p></div><div class="gd-rva"><button type="button" class="btn btn-success btn-sm" data-gd-ok="' + esc(x.id) + '">' + ic('fa-check') + ' ผ่าน</button><button type="button" class="btn btn-secondary btn-sm" data-gd-edit="' + esc(x.studentId) + '">' + ic('fa-pen') + ' แก้</button><button type="button" class="btn btn-ghost btn-sm gd-red" data-gd-back="' + esc(x.id) + '">' + ic('fa-rotate-left') + ' ส่งกลับ</button></div></div>'; }).join('') : '<p class="gd-mut" style="text-align:center;padding:16px">ไม่มีรายการรอตรวจ 👍</p>') +
      (Bk.length ? '<h3 class="gd-h" style="margin-top:18px">' + ic('fa-rotate-left') + ' ส่งกลับให้แก้ — รอนักเรียนแก้ ' + Bk.length + ' คน</h3>' + Bk.map(function (x) { return '<div class="gd-rv">' + av(x) + '<div class="gd-rvm"><b>' + esc(x.name) + '</b> <small class="gd-mut">' + esc(x.room) + '</small><p class="gd-backnote">' + esc(x.reviewNote) + '</p></div></div>'; }).join('') : '') + '</div>';
  }

  // ---------- แท็บ: สรุป ----------
  function renderSum() {
    var L = B.list, byRoom = {}, rd = {}, uni = {}, fac = {};
    L.forEach(function (x) {
      var r = byRoom[x.roomId] = byRoom[x.roomId] || { room: x.room, n: 0, rep: 0, study: 0, wait: 0, work: 0 }; r.n++; if (x.status) r.rep++; if (x.status === 'study') r.study++; if (x.status === 'wait') r.wait++; if (x.status === 'work' || x.status === 'other') r.work++;
      var c = x.status === 'study' && conf(x); if (c) { rd[c.round || '-'] = (rd[c.round || '-'] || 0) + 1; uni[c.university] = (uni[c.university] || 0) + 1; if (c.faculty) fac[c.faculty] = (fac[c.faculty] || 0) + 1; }
    });
    var top = function (o, n) { return Object.keys(o).sort(function (a, b) { return o[b] - o[a] || a.localeCompare(b, 'th'); }).slice(0, n).map(function (k) { return [k, o[k]]; }); };
    var bar = function (list) { var mx = Math.max.apply(null, [1].concat(list.map(function (x) { return x[1]; }))); return list.length ? list.map(function (x) { return '<div class="gd-bar"><span>' + esc(x[0]) + '</span><i><b style="width:' + (x[1] / mx * 100) + '%"></b></i><em>' + x[1] + '</em></div>'; }).join('') : '<p class="gd-mut">ยังไม่มีข้อมูล</p>'; };
    var R = Object.keys(byRoom).sort(function (a, b) { return (+a.split('_')[1] || 0) - (+b.split('_')[1] || 0); }).map(function (k) { return byRoom[k]; });
    body.innerHTML = '<div class="card">' + kpis() + '<div class="gd-sum2"><div><h3 class="gd-h">' + ic('fa-door-open') + ' ความคืบหน้ารายห้อง</h3><table class="gd-t"><thead><tr><th>ห้อง</th><th>รายงานแล้ว</th><th>ศึกษาต่อ</th><th>รอผล</th><th>ไม่ศึกษาต่อ/อื่น ๆ</th></tr></thead><tbody>' +
      R.map(function (r) { var p = r.n ? Math.round(r.rep / r.n * 100) : 0; return '<tr><td><b>' + esc(r.room) + '</b></td><td><span class="gd-prog"><i style="width:' + p + '%"></i></span> ' + r.rep + '/' + r.n + ' <small>(' + p + '%)</small></td><td>' + r.study + '</td><td>' + r.wait + '</td><td>' + r.work + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<div><h3 class="gd-h">' + ic('fa-flag-checkered') + ' รอบที่ยืนยันสิทธิ์</h3>' + bar(['1', '2', '3', '4', 'other', '-'].filter(function (k) { return rd[k]; }).map(function (k) { return [RD[k] || 'ไม่ระบุรอบ', rd[k]]; })) +
      '<h3 class="gd-h" style="margin-top:16px">' + ic('fa-building-columns') + ' มหาวิทยาลัยที่เลือกเรียน (10 อันดับ)</h3>' + bar(top(uni, 10)) +
      '<h3 class="gd-h" style="margin-top:16px">' + ic('fa-book') + ' คณะที่เลือกเรียน (10 อันดับ)</h3>' + bar(top(fac, 10)) + '</div></div>' +
      '<p class="gd-mut" style="margin-top:12px">นับจากที่ "ยืนยันสิทธิ์" เท่านั้น (นักเรียน 1 คน = 1 แห่ง) · <a href="#" data-gd-xls>' + ic('fa-file-excel') + ' ส่งออก Excel ทุกรายการ</a></p></div>';
  }
  function exportXls() {
    var rows = [];
    B.list.forEach(function (x) {
      var base = [x.room, +x.no || x.no, x.name, ST[x.status] || 'ยังไม่รายงาน'];
      var tail = [x.consent ? 'ยินยอม' : '', x.review === 'ok' ? 'ผ่าน' : x.review === 'pending' ? 'รอตรวจ' : x.review === 'back' ? 'ส่งกลับ' : ''];
      if (x.entries && x.entries.length) x.entries.forEach(function (e) { rows.push(base.concat([e.university, e.faculty, e.major, RD[e.round] || '', e.confirmed ? '✓' : '', x.statusNote || ''], tail)); });
      else rows.push(base.concat(['', '', '', '', '', x.statusNote || ''], tail));
    });
    downloadBlob(buildXlsx('ผลการศึกษาต่อ', ['ห้อง', 'เลขที่', 'ชื่อ – สกุล', 'สถานะ', 'มหาวิทยาลัย/สถาบัน', 'คณะ', 'สาขาวิชา', 'รอบ', 'ยืนยันสิทธิ์', 'หมายเหตุ', 'เผยแพร่', 'การตรวจ'], rows, [8, 7, 30, 16, 30, 26, 26, 18, 10, 20, 9, 9], 'ผลการศึกษาต่อ ม.6 ปีการศึกษา ' + B.year), 'ผลการศึกษาต่อ_ม6_' + B.year + '.xlsx');
  }

  // ---------- แท็บ: ตั้งค่า ----------
  function formUrl() { return location.href.replace(/[^/]*$/, '') + 'guidance-form.html'; }
  function renderCfg() {
    var c = B.cfg || {}, sw = function (k, label, hint) { return '<label class="gd-sw"><span><b>' + label + '</b>' + (hint ? '<small>' + hint + '</small>' : '') + '</span><input type="checkbox" data-gd-cfg="' + k + '"' + (c[k] ? ' checked' : '') + '></label>'; };
    body.innerHTML = '<div class="gd-cfg"><div class="card"><h3 class="gd-h">' + ic('fa-sliders') + ' ฟอร์มนักเรียน</h3>' +
      sw('open', 'เปิดรับข้อมูลจากนักเรียน', 'ปิด = นักเรียนเปิดลิงก์แล้วเห็นข้อความ "ปิดรับข้อมูล"') +
      '<div class="gd-dates"><span>ช่วงเปิด (ไม่บังคับ)</span><input type="date" id="gdFrom" value="' + esc(c.from || '') + '"> – <input type="date" id="gdTo" value="' + esc(c.to || '') + '"><button type="button" class="btn btn-secondary btn-sm" data-gd-dates>บันทึกช่วงเปิด</button></div>' +
      sw('verifyCode', 'ยืนยันด้วยรหัสนักเรียน', 'นักเรียนต้องกรอกรหัสนักเรียนให้ตรงกับเว็บเช็คชื่อก่อนกรอกข้อมูล') +
      sw('review', 'ข้อมูลใหม่ต้องรอตรวจ', 'ปิด = ผ่านอัตโนมัติ (คำแนะนำชื่อจะใช้ข้อมูลทันที)') +
      sw('advisors', 'ครูที่ปรึกษา ม.6 เห็นห้องตัวเอง', 'ครูที่ปรึกษาเห็นเมนูแนะแนวและดูรายงานเฉพาะห้องของตัวเอง (ดูอย่างเดียว)') +
      '<div class="gd-link"><b>ลิงก์หน้านักเรียน</b><small>' + esc(formUrl()) + '</small><div><button type="button" class="btn btn-secondary btn-sm" data-gd-copy>' + ic('fa-copy') + ' คัดลอก</button> <button type="button" class="btn btn-secondary btn-sm" data-gd-qr>' + ic('fa-qrcode') + ' QR</button></div><div id="gdQr" hidden></div></div></div>' +
      '<div class="card"><h3 class="gd-h">' + ic('fa-spell-check') + ' ปรับชื่อมหาวิทยาลัย / คณะ / สาขา</h3><p class="gd-mut">รายชื่อเรียนรู้จากที่นักเรียนกรอก — ติ๊กชื่อที่เป็นที่เดียวกันแล้ว "รวม" · ซ่อน = ไม่ขึ้นเป็นคำแนะนำ (ข้อมูลเดิมยังอยู่)</p>' +
      '<div class="gd-seg">' + [['uni', 'มหาวิทยาลัย'], ['fac', 'คณะ'], ['maj', 'สาขาวิชา']].map(function (x) { return '<button type="button" data-gd-nf="' + x[0] + '" class="' + (st.names === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div><div id="gdNames"><div class="loading">กำลังโหลด...</div></div></div></div>';
    loadNames();
  }
  async function loadNames() {
    var box = document.getElementById('gdNames'); if (!box) return;
    try { st.nm = (await apiCall('guideNames', { field: st.names })).names; } catch (e) { box.innerHTML = err(e.message); return; }
    st.pick = {}; paintNames();
  }
  function simKey(s) { return norm(s).replace(/^(มหาวิทยาลัย|ม\.|มหาลัย|คณะ|สาขาวิชา|สาขา)/, '').replace(/[.\-()]/g, ''); }
  function paintNames() {
    var box = document.getElementById('gdNames'); if (!box) return;
    var L = st.nm || [], groups = {}; L.forEach(function (x) { var k = simKey(x.name); (groups[k] = groups[k] || []).push(x.name); });
    var sim = Object.keys(groups).filter(function (k) { return groups[k].length > 1; });
    var n = Object.keys(st.pick).length;
    box.innerHTML = (sim.length ? '<div class="gd-sim">' + ic('fa-wand-magic-sparkles') + ' ชื่อที่ดูเหมือนซ้ำ: ' + sim.map(function (k) { return '<button type="button" class="btn btn-ghost btn-sm" data-gd-simp="' + esc(JSON.stringify(groups[k])) + '">' + esc(groups[k].join(' / ')) + '</button>'; }).join(' ') + '</div>' : '') +
      '<div class="gd-nbar"><span>' + (n ? 'เลือก ' + n + ' ชื่อ' : 'ติ๊กชื่อเพื่อรวม') + '</span><button type="button" class="btn btn-primary btn-sm" data-gd-merge' + (n < 1 ? ' disabled' : '') + '>' + ic('fa-object-group') + ' รวม / เปลี่ยนชื่อ</button></div>' +
      (L.length ? '<div class="gd-nl">' + L.map(function (x) { return '<label class="gd-nr' + (x.hidden ? ' hid' : '') + '"><input type="checkbox" data-gd-pick="' + esc(x.name) + '"' + (st.pick[x.name] ? ' checked' : '') + '><span>' + esc(x.name) + '</span><small>' + x.count + '</small><button type="button" class="btn btn-ghost btn-sm" data-gd-hide="' + esc(x.name) + '" data-h="' + (x.hidden ? 0 : 1) + '">' + (x.hidden ? 'เลิกซ่อน' : 'ซ่อน') + '</button></label>'; }).join('') + '</div>' : '<p class="gd-mut" style="text-align:center;padding:12px">ยังไม่มีชื่อ — จะขึ้นเมื่อนักเรียนเริ่มกรอก</p>');
  }
  async function cfgSave(data, msg) { try { await apiCall('guideCfgSave', data); Object.assign(B.cfg, data); showToast(msg || 'บันทึกแล้ว'); return true; } catch (e) { showToast(e.message, true); return false; } }
  body.addEventListener('change', async function (e) {
    var k = e.target.getAttribute('data-gd-cfg'); if (k) { var o = {}; o[k] = e.target.checked; if (!(await cfgSave(o))) e.target.checked = !e.target.checked; return; }
    var pk = e.target.getAttribute('data-gd-pick'); if (pk) { if (e.target.checked) st.pick[pk] = 1; else delete st.pick[pk]; var nb = body.querySelector('.gd-nbar span'), mb = body.querySelector('[data-gd-merge]'), n = Object.keys(st.pick).length; if (nb) nb.textContent = n ? 'เลือก ' + n + ' ชื่อ' : 'ติ๊กชื่อเพื่อรวม'; if (mb) mb.disabled = n < 1; }
  });

  // ---------- แก้ไขข้อมูลนักเรียน (ผู้ดูแล) ----------
  var ED = null;
  function editRow(e, i) {
    return '<div class="gd-er" data-er="' + i + '"><div class="gd-er3"><input data-ef="university" placeholder="มหาวิทยาลัย/สถาบัน" value="' + esc(e.university) + '"><input data-ef="faculty" placeholder="คณะ" value="' + esc(e.faculty) + '"><input data-ef="major" placeholder="สาขาวิชา" value="' + esc(e.major) + '"></div>' +
      '<div class="gd-er2"><select data-ef="round"><option value="">— รอบ —</option>' + Object.keys(RD).map(function (k) { return '<option value="' + k + '"' + (e.round === k ? ' selected' : '') + '>' + RD[k] + '</option>'; }).join('') + '</select><label><input type="radio" name="gdCf" data-ef="confirmed"' + (e.confirmed ? ' checked' : '') + '> ยืนยันสิทธิ์</label><button type="button" class="btn btn-ghost btn-sm gd-red" data-er-del="' + i + '">' + ic('fa-trash') + '</button></div></div>';
  }
  function editHtml() {
    return '<div class="gd-ed"><label>สถานะ <select id="edSt">' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (ED.status === k ? ' selected' : '') + '>' + ST[k] + '</option>'; }).join('') + '</select></label>' +
      '<label>หมายเหตุ <input id="edNote" maxlength="200" value="' + esc(ED.statusNote || '') + '" placeholder="เช่น ทำงานที่… / รอผลรอบ 3"></label>' +
      '<div class="gd-h" style="margin-top:8px">ที่สอบติด</div><div id="edEnts">' + ED.entries.map(editRow).join('') + '</div><button type="button" class="btn btn-ghost btn-sm" data-er-add>' + ic('fa-plus') + ' เพิ่มที่ที่สอบติด</button>' +
      '<label class="gd-ck"><input type="checkbox" id="edCon"' + (ED.consent ? ' checked' : '') + '> ยินยอมให้โรงเรียนเผยแพร่ชื่อและรูป</label></div>';
  }
  function edSync() {
    var box = document.getElementById('edEnts'); if (!box) return;
    ED.status = document.getElementById('edSt').value; ED.statusNote = document.getElementById('edNote').value; ED.consent = document.getElementById('edCon').checked;
    ED.entries = [].map.call(box.querySelectorAll('[data-er]'), function (row) { var g = function (f) { return row.querySelector('[data-ef="' + f + '"]'); }; return { university: g('university').value.trim(), faculty: g('faculty').value.trim(), major: g('major').value.trim(), round: g('round').value, confirmed: g('confirmed').checked }; });
  }
  function openEdit(sid) {
    var x = B.list.filter(function (r) { return r.studentId === sid; })[0]; if (!x) return;
    ED = { studentId: sid, status: x.status || 'study', statusNote: x.statusNote || '', consent: !!x.consent, entries: (x.entries || []).map(function (e) { return Object.assign({}, e); }) };
    if (!ED.entries.length && ED.status === 'study') ED.entries.push({ university: '', faculty: '', major: '', round: '', confirmed: false });
    openModal('แก้ไข: ' + x.name + ' (' + x.room + ')', editHtml(), '<button type="button" class="btn btn-secondary" data-gd-close>ยกเลิก</button><button type="button" class="btn btn-success" data-ed-save>' + ic('fa-check') + ' บันทึก (ผ่านการตรวจ)</button>');
  }
  document.getElementById('gdModalBody').addEventListener('click', function (e) {
    if (e.target.closest('[data-er-add]')) { edSync(); ED.entries.push({ university: '', faculty: '', major: '', round: '', confirmed: false }); document.getElementById('gdModalBody').innerHTML = editHtml(); return; }
    var d = e.target.closest('[data-er-del]'); if (d) { edSync(); ED.entries.splice(+d.getAttribute('data-er-del'), 1); document.getElementById('gdModalBody').innerHTML = editHtml(); }
  });
  document.getElementById('gdModalActions').addEventListener('click', async function (e) {
    if (e.target.closest('[data-ed-save]')) {
      edSync();
      var r = await withProgress('กำลังบันทึก', function () { return apiCall('guideEdit', { year: B.year, studentId: ED.studentId, status: ED.status, statusNote: ED.statusNote, consent: ED.consent, entries: ED.entries.filter(function (x) { return x.university; }) }); }, { successLabel: 'บันทึกแล้ว' });
      if (r.ok) { closeModal(); st.open[B.year + '_' + ED.studentId] = 1; await boot(); }
      return;
    }
    if (e.target.closest('[data-bk-send]')) {
      var note = document.getElementById('bkNote').value.trim(); if (!note) { showToast('กรุณาระบุเหตุผล', true); return; }
      var id = e.target.closest('[data-bk-send]').getAttribute('data-bk-send');
      var r2 = await withProgress('กำลังบันทึก', function () { return apiCall('guideReview', { id: id, op: 'back', note: note }); }, { successLabel: 'ส่งกลับแล้ว' });
      if (r2.ok) { closeModal(); await boot(); }
    }
  });
  document.getElementById('gdModalBody').addEventListener('click', function (e) { var c = e.target.closest('[data-bk-pre]'); if (c) { var t = document.getElementById('bkNote'); t.value = (t.value ? t.value + ' ' : '') + c.textContent; } });

  // ---------- คลิกทั่วไป ----------
  body.addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-gd-zoom]'))) { e.stopPropagation(); var z = document.createElement('div'); z.className = 'gd-zoom'; z.innerHTML = '<img src="' + esc(t.getAttribute('data-gd-zoom')) + '" alt="" referrerpolicy="no-referrer"><button type="button" aria-label="ปิด">✕</button>'; z.addEventListener('click', function () { z.remove(); }); document.body.appendChild(z); return; }
    if ((t = e.target.closest('[data-gd-acc]'))) { var id = t.getAttribute('data-gd-acc'); if (st.open[id]) delete st.open[id]; else st.open[id] = 1; paintList(); return; }
    if (e.target.closest('[data-gd-xls]')) { e.preventDefault(); exportXls(); return; }
    if ((t = e.target.closest('[data-gd-ok]'))) { var r = await withProgress('กำลังบันทึก', function () { return apiCall('guideReview', { id: t.getAttribute('data-gd-ok'), op: 'ok' }); }, { successLabel: 'ผ่านแล้ว' }); if (r.ok) await boot(); return; }
    if ((t = e.target.closest('[data-gd-back]'))) { openModal('ส่งกลับให้นักเรียนแก้', '<p class="gd-mut">นักเรียนจะเห็นเหตุผลนี้เมื่อเปิดฟอร์ม แล้วแก้ส่งใหม่ได้</p><div class="gd-pre">' + ['รูปไม่ชัด / ไม่ใช่รูปนักเรียน', 'ชื่อมหาวิทยาลัยไม่ถูกต้อง', 'ชื่อคณะ/สาขาไม่ถูกต้อง', 'ยังไม่ได้เลือกที่ยืนยันสิทธิ์', 'ข้อมูลไม่ครบ'].map(function (x) { return '<button type="button" class="btn btn-ghost btn-sm" data-bk-pre>' + x + '</button>'; }).join('') + '</div><textarea id="bkNote" rows="3" maxlength="300" style="width:100%" placeholder="เหตุผล"></textarea>', '<button type="button" class="btn btn-secondary" data-gd-close>ยกเลิก</button><button type="button" class="btn btn-danger" data-bk-send="' + esc(t.getAttribute('data-gd-back')) + '">' + ic('fa-rotate-left') + ' ส่งกลับ</button>'); return; }
    if ((t = e.target.closest('[data-gd-edit]'))) { openEdit(t.getAttribute('data-gd-edit')); return; }
    if ((t = e.target.closest('[data-gd-delph]'))) { if (!confirm('ลบรูปนักเรียนคนนี้? (นักเรียนส่งรูปใหม่ได้)')) return; var r3 = await withProgress('กำลังลบรูป', function () { return apiCall('guidePhotoRemove', { id: t.getAttribute('data-gd-delph') }); }, { successLabel: 'ลบรูปแล้ว' }); if (r3.ok) await boot(); return; }
    if (e.target.closest('[data-gd-dates]')) { await cfgSave({ from: document.getElementById('gdFrom').value, to: document.getElementById('gdTo').value }, 'บันทึกช่วงเปิดแล้ว'); return; }
    if (e.target.closest('[data-gd-copy]')) { try { await navigator.clipboard.writeText(formUrl()); showToast('คัดลอกลิงก์แล้ว'); } catch (x) { showToast(formUrl()); } return; }
    if (e.target.closest('[data-gd-qr]')) { var q = document.getElementById('gdQr'); q.hidden = !q.hidden; q.innerHTML = ''; if (!q.hidden) { try { qrLogo(q, formUrl(), 200); } catch (x) { q.textContent = 'สร้าง QR ไม่ได้'; } } return; }
    if ((t = e.target.closest('[data-gd-nf]'))) { st.names = t.getAttribute('data-gd-nf'); body.querySelectorAll('[data-gd-nf]').forEach(function (b) { b.classList.toggle('on', b === t); }); document.getElementById('gdNames').innerHTML = '<div class="loading">กำลังโหลด...</div>'; loadNames(); return; }
    if ((t = e.target.closest('[data-gd-simp]'))) { st.pick = {}; JSON.parse(t.getAttribute('data-gd-simp')).forEach(function (n) { st.pick[n] = 1; }); paintNames(); return; }
    if ((t = e.target.closest('[data-gd-hide]'))) { e.preventDefault(); try { await apiCall('guideNamesSave', { field: st.names, op: t.getAttribute('data-h') === '1' ? 'hide' : 'unhide', name: t.getAttribute('data-gd-hide') }); } catch (x) { showToast(x.message, true); return; } loadNames(); return; }
    if (e.target.closest('[data-gd-merge]')) {
      var names = Object.keys(st.pick); if (!names.length) return;
      var cnt = {}; (st.nm || []).forEach(function (x) { cnt[x.name] = x.count; }); names.sort(function (a, b) { return (cnt[b] || 0) - (cnt[a] || 0); });
      openModal(names.length > 1 ? 'รวมชื่อ ' + names.length + ' ชื่อ' : 'เปลี่ยนชื่อ', '<p class="gd-mut">ชื่อที่เลือก: ' + names.map(esc).join(' · ') + '</p><label>ให้เหลือชื่อ <input id="mgTo" style="width:100%" maxlength="150" value="' + esc(names[0]) + '"></label><p class="gd-mut">ทุกรายการที่ใช้ชื่อที่เลือกจะเปลี่ยนเป็นชื่อนี้ (ทุกปีการศึกษา)</p>', '<button type="button" class="btn btn-secondary" data-gd-close>ยกเลิก</button><button type="button" class="btn btn-primary" data-mg-go>' + ic('fa-check') + ' ยืนยัน</button>');
      document.querySelector('[data-mg-go]').onclick = async function () {
        var to = document.getElementById('mgTo').value.trim(); if (!to) return;
        var r4 = await withProgress('กำลังรวมชื่อ', function () { return apiCall('guideNamesSave', { field: st.names, op: 'merge', from: names, to: to }); }, { successLabel: 'รวมชื่อแล้ว' });
        if (r4.ok) { closeModal(); loadNames(); B = await apiCall('guideBoot', { year: st.year }); }
      };
    }
  });
  boot();
})();
