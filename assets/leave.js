/* แจ้งลา / ไปราชการ (2.16.0) — หน้า leave.html
 * แท็บ: การลาของฉัน · รออนุมัติ · รายการทั้งหมด · ข้อความสรุป · ตั้งค่า
 * - ครูแจ้งเอง (เมื่อผู้ดูแลเปิด) → รออนุมัติ · ผู้ดูแลแจ้งแทน = อนุมัติทันที
 * - ไปราชการแนบคำสั่ง · ลาอื่นแนบใบลา (ลงชื่อแล้ว) · ลาป่วยส่งใบลาทีหลังได้ตามกำหนด
 * - พิมพ์ใบลา = แบบฟอร์มของโรงเรียน เติมชื่อ ตำแหน่ง วันที่ ครั้งสุดท้าย สถิติการลา ให้
 * ประหยัด: โหลดเมื่อเปิดแท็บ · จำผลไว้ในหน้า · เปลี่ยนเฉพาะส่วนที่แก้ (ไม่วาดทั้งหน้าใหม่) */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('leave'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('lvBody'), tabsEl = document.getElementById('lvTabs');
  var modal = document.getElementById('lvModal'), fileIn = document.getElementById('lvFileIn');
  var B = null, st = { tab: 'mine', range: 'month', from: '', to: '', fType: '', fStatus: '', sumDate: '', sumMode: 'all' };
  var D = { mine: null, stats: null, pending: null, all: null, sum: null };
  var F = null; // ฟอร์มแจ้งลาที่เปิดอยู่
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var ML = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var DW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'], DL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  var ST = { pending: ['p', 'fa-hourglass-half', 'รออนุมัติ'], approved: ['a', 'fa-check', 'อนุมัติแล้ว'], rejected: ['r', 'fa-xmark', 'ไม่อนุมัติ'] };
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function ic(n) { return '<i class="fa-solid ' + n + '" aria-hidden="true"></i>'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dP(s) { var p = String(s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function thD(s, y) { var d = dP(s); return DW[d.getDay()] + ' ' + d.getDate() + ' ' + MS[d.getMonth()] + (y === false ? '' : ' ' + (d.getFullYear() + 543)); }
  function thRange(a, b) { if (!b || a === b) return thD(a); var x = dP(a), y = dP(b); return x.getFullYear() === y.getFullYear() ? thD(a, false) + ' – ' + thD(b) : thD(a) + ' – ' + thD(b); }
  function thTime(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.getDate() + ' ' + MS[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function plabel(p) { return Number(p) === -2 ? 'A' : Number(p) === 0 ? 'B' : String(p); }
  function perTxt(a) { return a && a.length ? 'คาบ ' + a.map(plabel).join(', ') : 'ทั้งวัน'; }
  function err(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function put(el, html) { if (!el) return; el.classList.remove('rt-busy'); if (el._h === html) return; el.innerHTML = html; el._h = html; }
  function canM() { return B && B.manage; }
  function canV() { return B && (B.manage || B.view); }
  function typeOf(k) { return (B.types || []).filter(function (t) { return t.key === k; })[0] || null; }
  function docName(k) { return k === 'order' ? 'คำสั่งไปราชการ' : 'ใบลา'; }
  function stPill(s) { var x = ST[s] || ST.pending; return '<span class="lv-st ' + x[0] + '">' + ic(x[1]) + ' ' + x[2] + '</span>'; }
  function wkTag(x) { return x && x.wk ? '<span class="lv-wk" title="ลาคร่อมวันเสาร์-อาทิตย์' + (B.wkCount ? ' (นับเสาร์-อาทิตย์รวมในวันลา)' : ' (ไม่นับเสาร์-อาทิตย์)') + '">' + ic('fa-calendar-week') + ' คร่อมเสาร์-อาทิตย์</span>' : ''; }
  function moreChips(x) { return (x.docs.more || []).map(function (f, i) { return fileChip(f, 'ไฟล์เพิ่ม ' + (i + 1)); }).join(''); }
  function fileChip(f, label) { if (!f) return ''; var pdf = /\.pdf$/i.test(f.name || ''); return '<a class="lv-file" href="' + esc(f.url) + '" target="_blank" rel="noopener" title="' + esc(f.name) + '" data-fp="' + esc(f.url) + '" data-fp-name="' + esc(f.name || '') + '">' + ic(pdf ? 'fa-file-pdf' : 'fa-image') + ' ' + esc(label || f.name) + '</a>'; }
  function workdays(a, b) { if (!a || !b || b < a) return 0; var n = 0, d = dP(a), e = dP(b); for (var i = 0; d <= e && i < 400; i++) { if (d.getDay() % 6) n++; d.setDate(d.getDate() + 1); } return n; }

  // ---------- โหลด ----------
  async function boot() {
    try { B = await apiCall('lvBoot', {}); } catch (e) { tabsEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    st.sumDate = B.today;
    var h = (location.hash || '').slice(1);
    if (h === 'pending' && canV()) st.tab = 'pending';
    renderTabs(); show();
    if (h === 'new') { try { history.replaceState(null, '', location.pathname); } catch (x) { /* ข้าม */ } if (canM()) openBulk(); else openForm(); } // 2.18.0: ผู้ดูแล = ลงหลายรายการ
  }
  function tabList() {
    var t = [['mine', 'fa-user', 'การลาของฉัน']];
    if (canV()) t.push(['pending', 'fa-hourglass-half', 'รออนุมัติ'], ['all', 'fa-list', 'รายการทั้งหมด'], ['summary', 'fa-message', 'ข้อความสรุป']);
    if (canM()) t.push(['settings', 'fa-sliders', 'ตั้งค่า']);
    return t;
  }
  function renderTabs() {
    var t = tabList(); if (t.length < 2) { tabsEl.innerHTML = ''; tabsEl.hidden = true; return; }
    tabsEl.hidden = false;
    put(tabsEl, t.map(function (x) { return '<button type="button" class="tab-btn' + (x[0] === st.tab ? ' active' : '') + '" data-lv-tab="' + x[0] + '" role="tab">' + ic(x[1] + ' ui-icon') + ' ' + x[2] + (x[0] === 'pending' && B.pendingN ? '<span class="lv-cnt">' + B.pendingN + '</span>' : '') + '</button>'; }).join(''));
  }
  function show() {
    renderTabs();
    if (st.tab === 'mine') return showMine();
    if (st.tab === 'pending') return showPending();
    if (st.tab === 'all') return showAll();
    if (st.tab === 'summary') return showSummary();
    if (st.tab === 'settings') return showSettings();
  }
  // 2.34.0: กันกระพริบ — มีเนื้อหาอยู่แล้ว = จางลงระหว่างโหลด (ไม่ล้างหน้า / ไม่เด้งขึ้นบน)
  function loading() { if (body.children.length && !body.querySelector(':scope > .loading')) { body.classList.add('rt-busy'); return; } if (!body.querySelector('.loading')) { body.innerHTML = '<div class="loading">กำลังโหลด...</div>'; body._h = ''; } }

  // ---------- การลาของฉัน ----------
  async function showMine() {
    if (!D.mine) { loading(); try { var r = await apiCall('lvReqList', { scope: 'mine' }); D.mine = r.items || []; D.stats = r.stats || {}; } catch (e) { body.classList.remove('rt-busy'); body.innerHTML = err(e.message); body._h = ''; return; } }
    if (st.tab !== 'mine') return;
    var rd = B.round, s = D.stats || {}, canAdd = canM() || B.selfReport;
    var rows = [['sick', 'ลาป่วย'], ['personal', 'ลากิจส่วนตัว'], ['maternity', 'ลาคลอดบุตร'], ['other', 'ลาอื่น ๆ'], ['none', 'ไปราชการ']].filter(function (x) { return s[x[0]] && (s[x[0]][0] || s[x[0]][1] || x[0] === 'sick' || x[0] === 'personal'); });
    var h = '';
    if (!B.enabled) h += '<div class="lv-pill-off">' + ic('fa-flask') + ' ช่วงทดสอบ — ครูทั่วไปยังไม่เห็นหน้านี้ (เปิดได้ที่ ตั้งค่าระบบ › จัดการผู้ดูแล)</div>';
    h += '<div class="lv-grid" style="margin-bottom:14px">' +
      '<div class="card cc-card"><h3>' + ic('fa-chart-simple ui-icon') + ' สถิติการลาของฉัน <small class="mut" style="font-weight:500">' + roundTxt(rd) + '</small></h3><div class="cc-il">' +
      rows.map(function (x) { return '<div><span>' + x[1] + '</span><small>' + (s[x[0]][0] || 0) + ' ครั้ง</small><b>' + (s[x[0]][1] || 0) + ' วัน</b></div>'; }).join('') + '</div><p class="hint" style="margin-bottom:0">นับเฉพาะที่อนุมัติแล้ว (รวมยอดยกมาที่ผู้ดูแลบันทึกไว้)</p></div>' +
      '<div class="card cc-card" style="display:flex;flex-direction:column;justify-content:center;gap:10px">' +
      (canM() ? '<button type="button" class="btn btn-primary lv-big" data-lv-new="other">' + ic('fa-table-list') + ' ลงการลา / ไปราชการ (ให้ครู)</button>' : '') + (canAdd ? '<button type="button" class="btn ' + (canM() ? 'btn-secondary' : 'btn-primary lv-big') + '" data-lv-new>' + ic('fa-plus') + ' แจ้งลา / ไปราชการ' + (canM() ? ' (ของฉัน)' : '') + '</button><p class="hint" style="margin:0">' + (canM() ? 'คุณเป็นผู้ดูแล — รายการที่แจ้งอนุมัติทันที' : 'ผู้ดูแลต้องอนุมัติก่อน · ระหว่างรออนุมัติ คาบสอนยังนับตามปกติ') + '</p>'
        : '<p style="margin:0">' + ic('fa-circle-info') + ' ตอนนี้ยังไม่เปิดให้ครูแจ้งลาเอง — แจ้งผู้ดูแลการแจ้งลา / ไปราชการ</p>') + '</div></div>';
    h += '<div class="card cc-card"><h3>' + ic('fa-clock-rotate-left ui-icon') + ' รายการของฉัน</h3>' + (D.mine.length ? '<div class="lv-list">' + D.mine.map(function (x) { return itemHtml(x, 'mine'); }).join('') + '</div>' : '<div class="lv-empty">' + ic('fa-mug-hot') + 'ยังไม่มีรายการ</div>') + '</div>';
    put(body, h);
  }
  function roundTxt(rd) { if (!rd) return ''; var y = +rd.from.slice(0, 4) + 543; return rd.half === 1 ? '1 ต.ค. ' + y + ' – 31 มี.ค. ' + (y + 1) : '1 เม.ย. ' + y + ' – 30 ก.ย. ' + y; }
  function docLine(x) {
    var h = fileChip(x.docs.order, 'คำสั่ง') + fileChip(x.docs.leave, 'ใบลา') + moreChips(x);
    if (x.docMissing) {
      var late = x.docDue && x.docDue < B.today;
      h += '<span class="lv-file miss' + (late ? ' late' : '') + '">' + ic('fa-triangle-exclamation') + ' ยังไม่ส่ง' + docName(x.need) + (x.docDue ? (late ? ' · เลยกำหนด ' + thD(x.docDue, false) : ' · ส่งภายใน ' + thD(x.docDue, false)) : '') + '</span>';
    }
    return h ? '<div class="lv-files">' + h + '</div>' : '';
  }
  function itemHtml(x, mode) {
    var who = mode === 'mine' ? '' : '<b>' + esc(x.name) + '</b>';
    var h = '<div class="lv-it" data-id="' + esc(x.id) + '"><div class="lv-main"><div class="lv-hd">' + who + '<span class="lv-k">' + esc(x.typeLabel) + '</span>' + (mode === 'mine' ? '<b>' + thRange(x.from, x.to) + '</b>' : '') + '<span class="mut">' + (mode === 'mine' ? '' : thRange(x.from, x.to) + ' ') + '· ' + x.days + ' วัน · ' + perTxt(x.periods) + '</span>' + wkTag(x) + '</div>' +
      '<div class="lv-sub">' + (x.note ? 'เนื่องจาก ' + esc(x.note) + ' · ' : '') + 'แจ้งเมื่อ ' + thTime(x.createdAt) + (x.byOther ? ' · แจ้งแทนโดย ' + esc(x.byOther) : '') + (x.status !== 'pending' && x.decidedBy && !x.byOther ? ' · ' + (x.status === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ') + 'โดย ' + esc(x.decidedBy) : '') + '</div>' +
      (x.status === 'rejected' && x.reason ? '<div class="lv-sub" style="color:#b91c1c">เหตุผล: ' + esc(x.reason) + '</div>' : '') + docLine(x) + '</div><div class="lv-acts">' + stPill(x.status);
    var mine = x.userId === B.me.id;
    if (mode === 'pending' && x.status === 'pending' && canM()) h += '<button type="button" class="btn btn-success btn-sm" data-lv-ok="' + esc(x.id) + '">' + ic('fa-check') + ' อนุมัติ</button><button type="button" class="btn btn-sm lv-btn-no" data-lv-no="' + esc(x.id) + '">' + ic('fa-xmark') + ' ไม่อนุมัติ</button>';
    if (x.slot !== 'none' && x.status !== 'rejected') h += '<button type="button" class="btn btn-secondary btn-sm" data-lv-print="' + esc(x.id) + '">' + ic('fa-print') + ' พิมพ์ใบลา</button>';
    if ((mine || canM()) && x.status !== 'rejected') {
      var need = x.need || 'leave', has = x.docs[need];
      if (x.docMissing || !has) h += '<button type="button" class="btn btn-success btn-sm" data-lv-doc="' + esc(x.id) + '" data-slot="' + need + '">' + ic('fa-upload') + ' อัปโหลด' + docName(need) + '</button>';
    }
    if (mode === 'pending' && x.status === 'approved' && x.docMissing && canM()) h += '<button type="button" class="btn btn-ghost btn-sm" data-lv-remind="' + esc(x.id) + '">' + ic('fa-bell') + ' เตือน</button>';
    if ((mine && x.status === 'pending') || canM()) h += '<button type="button" class="btn btn-ghost btn-sm" data-lv-cancel="' + esc(x.id) + '">' + ic('fa-trash-can') + ' ' + (x.status === 'pending' && mine ? 'ยกเลิกคำขอ' : 'ลบรายการ') + '</button>';
    return h + '</div></div>';
  }

  // ---------- รออนุมัติ ----------
  async function showPending() {
    if (!D.pending) { loading(); try { D.pending = (await apiCall('lvReqList', { scope: 'pending' })).items || []; } catch (e) { body.classList.remove('rt-busy'); body.innerHTML = err(e.message); body._h = ''; return; } }
    if (st.tab !== 'pending') return;
    var p = D.pending.filter(function (x) { return x.status === 'pending'; }), m = D.pending.filter(function (x) { return x.status === 'approved' && x.docMissing; });
    B.pendingN = p.length; renderTabs();
    var h = '<div class="card cc-card"><h3>' + ic('fa-hourglass-half ui-icon') + ' รออนุมัติ <span class="lv-st p">' + p.length + ' รายการ</span></h3><p class="hint" style="margin-top:-4px">กดชื่อไฟล์เพื่อเปิดดูหลักฐาน · อนุมัติแล้วคาบสอนวันนั้นเป็น "ลา / ไปราชการ (ไม่นับ)" และส่งไปเว็บเช็คชื่อทันที' + (canM() ? '' : ' · คุณมีสิทธิ์ดูผลอย่างเดียว') + '</p>' +
      (p.length ? '<div class="lv-list">' + p.map(function (x) { return itemHtml(x, 'pending'); }).join('') + '</div>' : '<div class="lv-empty">' + ic('fa-circle-check') + 'ไม่มีคำขอรออนุมัติ</div>') + '</div>';
    h += '<div class="card cc-card lv-sec"><h3>' + ic('fa-file-circle-exclamation ui-icon') + ' อนุมัติแล้วแต่ยังไม่ส่ง' + docName('leave') + ' <span class="lv-st w">' + m.length + ' รายการ</span></h3>' +
      (m.length ? '<div class="lv-list">' + m.map(function (x) { return itemHtml(x, 'pending'); }).join('') + '</div><p class="hint">เลยกำหนดส่ง = กระดิ่งเตือนครูวันละครั้งอัตโนมัติ · กด "เตือน" เพื่อเตือนทันที</p>' : '<div class="lv-empty">' + ic('fa-circle-check') + 'ส่งครบทุกรายการ</div>') + '</div>';
    put(body, h);
  }

  // ---------- รายการทั้งหมด ----------
  function rangeOf() {
    var t = B.today, d = dP(t);
    if (st.range === 'today') return [t, t];
    if (st.range === 'week') { var m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); var e = new Date(m); e.setDate(m.getDate() + 6); return [ymd(m), ymd(e)]; }
    if (st.range === 'month') { var e2 = new Date(d.getFullYear(), d.getMonth() + 1, 0); return [t.slice(0, 8) + '01', ymd(e2)]; }
    if (st.range === 'round') return [B.round.from, B.round.to];
    return [st.from || t, st.to || st.from || t];
  }
  async function showAll(force) {
    var r = rangeOf(), key = r.join('|');
    if (!D.all || D.all.key !== key || force) { loading(); try { D.all = { key: key, items: (await apiCall('lvReqList', { scope: 'all', from: r[0], to: r[1] })).items || [] }; } catch (e) { body.classList.remove('rt-busy'); body.innerHTML = err(e.message); body._h = ''; return; } }
    if (st.tab !== 'all') return;
    var types = {}; D.all.items.forEach(function (x) { types[x.typeLabel] = 1; });
    var h = '<div class="cc-flt"><div class="cc-seg">' + [['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['round', 'รอบครึ่งปีนี้'], ['custom', 'กำหนดเอง']].map(function (x) { return '<button type="button" data-lv-rg="' + x[0] + '"' + (st.range === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>' +
      (st.range === 'custom' ? '<input type="date" id="lvAf" value="' + esc(r[0]) + '" style="max-width:160px"><span>ถึง</span><input type="date" id="lvAt" value="' + esc(r[1]) + '" style="max-width:160px">' : '') +
      '<select id="lvFt" style="max-width:170px"><option value="">ทุกประเภท</option>' + Object.keys(types).map(function (k) { return '<option' + (st.fType === k ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select>' +
      '<select id="lvFs" style="max-width:170px"><option value="">ทุกสถานะ</option>' + [['pending', 'รออนุมัติ'], ['approved', 'อนุมัติแล้ว'], ['rejected', 'ไม่อนุมัติ'], ['miss', 'ยังไม่ส่งหลักฐาน']].map(function (x) { return '<option value="' + x[0] + '"' + (st.fStatus === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
      '<span class="cc-sp"></span>' + (canM() ? '<button type="button" class="btn btn-primary btn-sm" data-lv-new="other">' + ic('fa-table-list') + ' ลงการลา / ไปราชการ</button>' : '') + '<button type="button" class="btn btn-secondary btn-sm" data-lv-xlsx>' + ic('fa-file-excel') + ' Excel</button></div>';
    var list = allFiltered();
    h += '<div class="card cc-card"><p class="hint" style="margin-top:0">' + thRange(r[0], r[1]) + ' · ' + list.length + ' รายการ · ' + list.reduce(function (a, x) { return a + (x.status === 'approved' ? x.days : 0); }, 0) + ' วันลา (อนุมัติแล้ว)</p>' +
      (list.length ? '<div class="cc-tw" style="overflow-x:auto"><table class="cc-t lv-at"><thead><tr><th>วันที่</th><th>ครู</th><th>ประเภท</th><th>วัน</th><th>หลักฐาน</th><th>สถานะ</th><th>ผู้อนุมัติ</th><th></th></tr></thead><tbody>' + list.map(function (x) {
        var dc = fileChip(x.docs.order, 'คำสั่ง') + fileChip(x.docs.leave, 'ใบลา') + moreChips(x) + (x.docMissing ? '<span class="lv-file miss' + (x.docDue && x.docDue < B.today ? ' late' : '') + '" title="' + (x.docDue ? 'กำหนดส่ง ' + esc(thD(x.docDue)) : '') + '">' + ic('fa-triangle-exclamation') + ' ยังไม่ส่ง' + (x.docDue ? ' (' + thD(x.docDue, false) + ')' : '') + '</span>' : '');
        return '<tr><td>' + thRange(x.from, x.to) + '</td><td>' + esc(x.name) + '</td><td>' + esc(x.typeLabel) + (x.note ? '<div class="lv-note">' + esc(x.note) + '</div>' : '') + '</td><td>' + x.days + (x.wk ? '<div>' + wkTag(x) + '</div>' : '') + '</td><td>' + (dc ? '<div class="lv-files" style="margin:0">' + dc + '</div>' : '-') + '</td><td>' + stPill(x.status) + '</td><td>' + esc(x.byOther ? 'แจ้งแทน · ' + x.byOther : (x.decidedBy || '-')) + '</td><td>' +
          (x.slot !== 'none' && x.status !== 'rejected' ? '<button type="button" class="btn btn-ghost btn-sm" data-lv-print="' + esc(x.id) + '" title="พิมพ์ใบลา">' + ic('fa-print') + '</button>' : '') +
          (canM() ? '<button type="button" class="btn btn-ghost btn-sm" data-lv-cancel="' + esc(x.id) + '" title="ลบรายการ">' + ic('fa-trash-can') + '</button>' : '') + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<div class="lv-empty">' + ic('fa-mug-hot') + 'ไม่มีรายการในช่วงนี้</div>') + '</div>';
    put(body, h);
  }
  function allFiltered() {
    return (D.all ? D.all.items : []).filter(function (x) {
      if (st.fType && x.typeLabel !== st.fType) return false;
      if (st.fStatus === 'miss') return x.docMissing && x.status !== 'rejected';
      return !st.fStatus || x.status === st.fStatus;
    });
  }
  function exportXlsx() {
    var r = rangeOf(), list = allFiltered();
    var rows = list.map(function (x) { return [x.from, x.to, x.name, x.typeLabel, x.days, perTxt(x.periods), x.note, (ST[x.status] || [])[2] || x.status, x.byOther ? 'แจ้งแทนโดย ' + x.byOther : x.decidedBy, x.docs.order ? x.docs.order.url : '', x.docs.leave ? x.docs.leave.url : (x.docMissing ? 'ยังไม่ส่ง' : ''), x.wk ? 'ลาคร่อมเสาร์-อาทิตย์' + (B.wkCount ? ' (นับเสาร์-อาทิตย์)' : '') : '']; });
    var blob = buildXlsx('การลา', ['ตั้งแต่', 'ถึง', 'ครู', 'ประเภท', 'วันลา', 'คาบ', 'เนื่องจาก', 'สถานะ', 'ผู้อนุมัติ', 'คำสั่ง', 'ใบลา', 'หมายเหตุ'], rows, [12, 12, 28, 16, 9, 12, 28, 12, 24, 30, 30, 26], 'รายการแจ้งลา / ไปราชการ ' + thRange(r[0], r[1]));
    downloadBlob(blob, 'การลา-' + r[0] + '_' + r[1] + '.xlsx');
  }

  // ---------- ข้อความสรุป ----------
  async function showSummary(force) {
    if (!D.sum || D.sum.date !== st.sumDate || force) { loading(); try { D.sum = await apiCall('lvSummary', { date: st.sumDate }); } catch (e) { body.classList.remove('rt-busy'); body.innerHTML = err(e.message); body._h = ''; return; } }
    if (st.tab !== 'summary') return;
    var h = '<div class="cc-flt"><input type="date" id="lvSd" value="' + esc(st.sumDate) + '" style="max-width:170px"><div class="cc-seg"><button type="button" data-lv-sd="-1">' + ic('fa-chevron-left') + ' วันก่อน</button><button type="button" data-lv-sd="0">วันนี้</button><button type="button" data-lv-sd="1">วันถัดไป ' + ic('fa-chevron-right') + '</button></div><span class="cc-sp"></span><span class="hint" style="margin:0">นับเฉพาะที่อนุมัติแล้ว · ' + D.sum.items.length + ' ราย</span></div>';
    h += '<div class="lv-grid"><div class="card cc-card"><h3>' + ic('fa-message ui-icon') + ' แบบรวมทั้งหมด</h3><textarea class="lv-out" id="lvSumA">' + esc(sumText(false)) + '</textarea><div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button type="button" class="btn btn-primary" data-lv-copy="lvSumA">' + ic('fa-copy') + ' คัดลอก</button><span class="hint" style="margin:0;align-self:center">แก้ข้อความก่อนคัดลอกได้</span></div></div>' +
      '<div class="card cc-card"><h3>' + ic('fa-layer-group ui-icon') + ' แบบแยกประเภท</h3><textarea class="lv-out" id="lvSumB">' + esc(sumText(true)) + '</textarea><div style="display:flex;gap:8px;margin-top:10px"><button type="button" class="btn btn-primary" data-lv-copy="lvSumB">' + ic('fa-copy') + ' คัดลอก</button></div></div></div>' +
      (canM() ? '<p class="hint">แก้รูปแบบข้อความได้ที่แท็บ ตั้งค่า › รูปแบบข้อความสรุป</p>' : '');
    put(body, h);
  }
  function shortType(s) { return String(s || '').replace(/\s*ส่วนตัว$/, ''); }
  function fillT(t, o) { return String(t || '').replace(/\{(วัน|วันที่|จำนวน|ลำดับ|ชื่อ|ชื่อเต็ม|ประเภท)\}/g, function (m, k) { return o[k] == null ? '' : o[k]; }); }
  function sumText(group) {
    var S = D.sum, tp = S.tpl || B.tpl, d = dP(S.date), items = S.items || [];
    var base = { 'วัน': DL[d.getDay()], 'วันที่': d.getDate() + ' ' + ML[d.getMonth()] + ' ' + (d.getFullYear() + 543), 'จำนวน': items.length };
    var out = [fillT(tp.head, base)];
    if (!items.length) { out.push('(ไม่มีผู้ลา)'); return out.join('\n'); }
    if (!group) items.forEach(function (x, i) { out.push(fillT(tp.line, { 'ลำดับ': i + 1, 'ชื่อ': x.first, 'ชื่อเต็ม': x.name, 'ประเภท': shortType(x.type) })); });
    else {
      var g = {}, order = []; items.forEach(function (x) { var k = shortType(x.type); if (!g[k]) { g[k] = []; order.push(k); } g[k].push(x); });
      var rank = (S.types || []).map(function (t) { return shortType(t.label); }); order.sort(function (a, b) { var ia = rank.indexOf(a), ib = rank.indexOf(b); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      order.forEach(function (k) { out.push(fillT(tp.group, { 'ประเภท': k, 'จำนวน': g[k].length })); g[k].forEach(function (x, i) { out.push(fillT(tp.gline, { 'ลำดับ': i + 1, 'ชื่อ': x.first, 'ชื่อเต็ม': x.name, 'ประเภท': k })); }); });
    }
    return out.join('\n');
  }

  // ---------- ตั้งค่า ----------
  var SET = null;
  function showSettings() {
    if (!SET) SET = { types: JSON.parse(JSON.stringify(B.types)), carry: JSON.parse(JSON.stringify(B.carry || {})), last: JSON.parse(JSON.stringify(B.last || {})) };
    var slotOpt = function (v) { return Object.keys(B.slots).map(function (k) { return '<option value="' + k + '"' + (v === k ? ' selected' : '') + '>' + esc(B.slots[k]) + '</option>'; }).join(''); };
    var sw = function (attr, on, dis) { return '<input type="checkbox" class="sup-ck" ' + attr + (on ? ' checked' : '') + (dis ? ' disabled' : '') + '>'; };
    var nm = {}; (B.people || []).forEach(function (u) { nm[u.id] = u.name; });
    var rk = B.round.key;
    var h = '<div class="lv-grid">' +
      '<div class="card cc-card"><h3>' + ic('fa-toggle-on ui-icon') + ' การแจ้งลา</h3><label class="lv-sw">' + sw('id="lvSelf"', B.selfReport) + '<b>ให้ครูแจ้งลาเอง</b> <span class="mut">(ปุ่ม "แจ้งลา / ไปราชการ" ที่หน้าแรก · ผู้ดูแลอนุมัติ)</span></label>' +
      '<label class="lv-sw">' + sw('id="lvWk"', B.wkCount) + '<b>ลาคร่อมเสาร์-อาทิตย์ นับเสาร์-อาทิตย์</b> <span class="mut">(ปิด = ลา ศ. 13 + จ. 16 นับ 2 วัน · เปิด = นับ 4 วัน · มีหมายเหตุ "ลาคร่อมเสาร์-อาทิตย์" ทั้งสองแบบ)</span></label>' +
      '<div class="cc-row"><button type="button" class="btn btn-secondary btn-sm" data-lv-merge>' + ic('fa-object-group') + ' รวมรายการลาที่ลงแยกวันไว้</button><span class="hint" style="margin:0">ดูรายการก่อนยืนยัน · รายการใหม่ระบบรวมให้เองตอนบันทึก</span></div>' +
      '<div class="cc-row"><span class="cc-lb">ลาป่วย ส่งใบลาภายใน</span><input type="number" class="cc-num" id="lvSick" min="0" max="30" value="' + esc(B.sickDays) + '"><span>วันทำการ หลังวันลาวันสุดท้าย</span></div><p class="hint">ใช้กับประเภทที่ติ๊ก "ส่งทีหลังได้" · เลยกำหนด = กระดิ่งเตือนครูวันละครั้ง และขึ้นในแท็บรออนุมัติ</p>' +
      '<h3 style="margin-top:14px">' + ic('fa-signature ui-icon') + ' ผู้ลงนามในใบลา</h3>' + [['hr', 'hrTitle', 'ผู้ตรวจสอบสถิติ'], ['deputy', 'deputyTitle', 'ผู้บังคับบัญชา 1'], ['director', 'directorTitle', 'ผู้บังคับบัญชา 2']].map(function (x) {
        return '<div class="lv-row" style="margin-bottom:8px"><div><label class="lv-note">' + x[2] + ' (ชื่อ)</label><input type="text" data-sg="' + x[0] + '" value="' + esc(B.sign[x[0]]) + '"></div><div><label class="lv-note">ตำแหน่ง</label><input type="text" data-sg="' + x[1] + '" value="' + esc(B.sign[x[1]]) + '"></div></div>';
      }).join('') + '<p class="hint" style="margin-bottom:0">เว้นว่าง = ใช้ค่าเริ่มต้น</p></div>' +
      '<div class="card cc-card"><h3>' + ic('fa-message ui-icon') + ' รูปแบบข้อความสรุป</h3><label class="lv-note">หัวข้อความ</label><textarea class="lv-out" style="min-height:90px" data-tp="head">' + esc(B.tpl.head) + '</textarea>' +
      '<label class="lv-note">แบบรวม · แต่ละบรรทัด</label><input type="text" data-tp="line" value="' + esc(B.tpl.line) + '">' +
      '<div class="lv-row" style="margin-top:8px"><div><label class="lv-note">แบบแยก · หัวกลุ่ม</label><input type="text" data-tp="group" value="' + esc(B.tpl.group) + '"></div><div><label class="lv-note">แบบแยก · แต่ละบรรทัด</label><input type="text" data-tp="gline" value="' + esc(B.tpl.gline) + '"></div></div>' +
      '<p class="hint">คำที่ระบบเติมให้: {วัน} {วันที่} {จำนวน} {ลำดับ} {ชื่อ} (ชื่อต้น ไม่มีคำนำหน้า) {ชื่อเต็ม} {ประเภท} · เว้นว่าง = ค่าเริ่มต้น</p></div></div>';
    h += '<div class="card cc-card lv-sec"><h3>' + ic('fa-list-check ui-icon') + ' ประเภทการลา</h3><div style="overflow-x:auto"><table class="lv-tt"><thead><tr><th>ชื่อประเภท</th><th>หลักฐาน</th><th style="text-align:center">บังคับแนบ</th><th style="text-align:center">ส่งทีหลังได้</th><th>ช่องในใบลา</th><th></th></tr></thead><tbody id="lvTypes">' + typesRows(slotOpt, sw) + '</tbody></table></div>' +
      '<button type="button" class="btn btn-secondary btn-sm" style="margin-top:10px" data-lv-tadd>' + ic('fa-plus') + ' เพิ่มประเภท</button><p class="hint">ประเภทเริ่มต้น (ไปราชการ ลาป่วย ลากิจส่วนตัว อื่น ๆ) ลบไม่ได้ แต่เปลี่ยนชื่อ/หลักฐานได้ · "อื่น ๆ" ครูพิมพ์ชื่อการลาเอง · ไปราชการ: ปิด "บังคับแนบ" = แนบคำสั่งหรือไม่ก็ได้</p></div>';
    h += '<div class="card cc-card lv-sec"><h3>' + ic('fa-scale-balanced ui-icon') + ' ยอดยกมา <small class="mut" style="font-weight:500">สถิติการลาก่อนเริ่มใช้ระบบ · รอบ ' + roundTxt(B.round) + '</small></h3><p class="hint" style="margin-top:-4px">ใช้เติมช่อง "ลามาแล้ว" ในตารางสถิติของใบลา · ใส่เฉพาะครูที่ลาไปแล้วในรอบนี้ก่อนเริ่มใช้ระบบ (ครั้ง / วัน)</p><div style="overflow-x:auto"><table class="lv-tt"><thead><tr><th>ครู</th><th>ป่วย</th><th>กิจส่วนตัว</th><th>คลอดบุตร</th><th>อื่น ๆ</th><th></th></tr></thead><tbody id="lvCarry">' +
      Object.keys(SET.carry).filter(function (u) { return SET.carry[u].round === rk; }).map(function (u) { var c = SET.carry[u]; return '<tr data-cu="' + esc(u) + '"><td>' + esc(nm[u] || 'ไม่พบชื่อ') + '</td>' + ['sick', 'personal', 'maternity', 'other'].map(function (k) { var v = c[k] || [0, 0]; return '<td style="white-space:nowrap"><input type="number" class="cc-num" min="0" data-ck="' + k + '0" value="' + (v[0] || 0) + '"> / <input type="number" class="cc-num" min="0" data-ck="' + k + '1" value="' + (v[1] || 0) + '"></td>'; }).join('') + '<td><button type="button" class="modal-close-x" style="position:static" data-lv-crm="' + esc(u) + '" aria-label="เอาออก">✕</button></td></tr>'; }).join('') +
      '</tbody></table></div><select data-lv-cadd style="max-width:320px;margin-top:8px"><option value="">+ เพิ่มครู</option>' + (B.people || []).filter(function (u) { return !(SET.carry[u.id] && SET.carry[u.id].round === rk); }).map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(u.name) + '</option>'; }).join('') + '</select></div>';
    h += '<div class="card cc-card lv-sec"><h3>' + ic('fa-clock-rotate-left ui-icon') + ' การลาครั้งสุดท้าย <small class="mut" style="font-weight:500">กรณีเพิ่งเริ่มใช้ระบบ</small></h3><p class="hint" style="margin-top:-4px">ใบลาเติมช่อง "ครั้งสุดท้าย" จากการลาที่อนุมัติในระบบให้เอง · ถ้ายังไม่มีในระบบ ใช้ค่าที่กรอกตรงนี้แทน</p><div style="overflow-x:auto"><table class="lv-tt"><thead><tr><th>ครู</th><th>ประเภท</th><th>ตั้งแต่</th><th>ถึง</th><th>วัน</th><th></th></tr></thead><tbody id="lvLast">' +
      Object.keys(SET.last).map(function (u) { var c = SET.last[u]; return '<tr data-lu="' + esc(u) + '"><td>' + esc(nm[u] || 'ไม่พบชื่อ') + '</td><td><select data-lk="slot">' + ['sick', 'personal', 'maternity', 'other'].map(function (k) { return '<option value="' + k + '"' + (c.slot === k ? ' selected' : '') + '>' + B.slots[k] + '</option>'; }).join('') + '</select></td><td><input type="date" data-lk="from" value="' + esc(c.from) + '"></td><td><input type="date" data-lk="to" value="' + esc(c.to) + '"></td><td><input type="number" class="cc-num" min="0" data-lk="days" value="' + (c.days || 0) + '"></td><td><button type="button" class="modal-close-x" style="position:static" data-lv-lrm="' + esc(u) + '" aria-label="เอาออก">✕</button></td></tr>'; }).join('') +
      '</tbody></table></div><select data-lv-ladd style="max-width:320px;margin-top:8px"><option value="">+ เพิ่มครู</option>' + (B.people || []).filter(function (u) { return !SET.last[u.id]; }).map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(u.name) + '</option>'; }).join('') + '</select>' +
      '<div class="cc-actions" style="margin-top:14px"><button type="button" class="btn btn-success" data-lv-save>' + ic('fa-check') + ' บันทึกการตั้งค่า</button></div></div>';
    put(body, h);
  }
  function typesRows(slotOpt, sw) {
    return SET.types.map(function (t, i) {
      return '<tr data-ti="' + i + '"><td><input type="text" data-tk="label" value="' + esc(t.label) + '">' + (t.custom ? '<div class="lv-note">ครูพิมพ์ชื่อการลาเอง</div>' : '') + '</td><td><select data-tk="doc"><option value="leave"' + (t.doc === 'leave' ? ' selected' : '') + '>ใบลา</option><option value="order"' + (t.doc === 'order' ? ' selected' : '') + '>คำสั่งไปราชการ</option></select></td>' +
        '<td style="text-align:center">' + sw('data-tk="req"', t.req) + '</td><td style="text-align:center">' + sw('data-tk="later"', t.later) + '</td><td><select data-tk="slot">' + slotOpt(t.slot) + '</select></td><td>' + (t.fixed ? '<span class="lv-note">ค่าเริ่มต้น</span>' : '<button type="button" class="modal-close-x" style="position:static" data-lv-trm="' + i + '" aria-label="ลบประเภท">✕</button>') + '</td></tr>';
    }).join('');
  }
  function readSettings() {
    body.querySelectorAll('[data-ti]').forEach(function (tr) { var t = SET.types[+tr.getAttribute('data-ti')]; if (!t) return; tr.querySelectorAll('[data-tk]').forEach(function (el) { var k = el.getAttribute('data-tk'); t[k] = el.type === 'checkbox' ? el.checked : el.value; }); });
    body.querySelectorAll('[data-cu]').forEach(function (tr) { var c = SET.carry[tr.getAttribute('data-cu')]; tr.querySelectorAll('[data-ck]').forEach(function (el) { var k = el.getAttribute('data-ck'), s = k.slice(0, -1), j = +k.slice(-1); c[s] = c[s] || [0, 0]; c[s][j] = Math.max(0, +el.value || 0); }); });
    body.querySelectorAll('[data-lu]').forEach(function (tr) { var c = SET.last[tr.getAttribute('data-lu')]; tr.querySelectorAll('[data-lk]').forEach(function (el) { var k = el.getAttribute('data-lk'); c[k] = k === 'days' ? Math.max(0, +el.value || 0) : el.value; }); });
  }
  async function mergeOld() {
    var r = await withProgress('กำลังหารายการที่ติดกัน', function () { return apiCall('lvMergeScan', {}); }, { successLabel: 'ตรวจแล้ว' });
    if (!r.ok) return;
    var g = r.data.groups || [];
    if (!g.length) { showToast('ไม่มีรายการที่ต้องรวม'); return; }
    var m = document.createElement('div'); m.className = 'modal-backdrop'; m.hidden = true;
    m.innerHTML = '<div class="modal-box" style="text-align:left;max-width:640px"><button type="button" class="modal-close-x" data-x aria-label="ปิด">✕</button><h3>' + ic('fa-object-group') + ' รวมรายการลาที่ติดกัน (' + r.data.total + ' กลุ่ม)</h3>' +
      '<p class="hint" style="margin-top:0">ครูคนเดียว · ประเภทเดียวกัน · ลาทั้งวัน · ระหว่างกันมีแต่เสาร์-อาทิตย์/วันหยุด → รวมเป็นรายการเดียว (สถิตินับ 1 ครั้ง) · ไฟล์ใบลาเก็บไว้ครบ</p><div class="lv-mg">' +
      g.map(function (x) { return '<div><b>' + esc(x.name) + '</b> · ' + esc(x.typeLabel) + (x.status === 'pending' ? ' <span class="lv-st p">รออนุมัติ</span>' : '') + '<div class="mut">' + x.parts.map(function (y) { return thRange(y.from, y.to); }).join(' + ') + ' → <b>' + thRange(x.from, x.to) + '</b> (' + x.days + ' วันทำการ)</div></div>'; }).join('') +
      (r.data.total > g.length ? '<p class="hint">…และอีก ' + (r.data.total - g.length) + ' กลุ่ม</p>' : '') + '</div>' +
      '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-x>ยกเลิก</button><button type="button" class="btn btn-success" data-ok>' + ic('fa-check') + ' รวม ' + r.data.total + ' กลุ่ม</button></div></div>';
    document.body.appendChild(m); showModalEl(m);
    var close = function () { hideModalEl(m); setTimeout(function () { m.remove(); }, 300); };
    m.addEventListener('click', async function (e) {
      if (e.target.closest('[data-x]')) { close(); return; }
      if (!e.target.closest('[data-ok]')) return;
      close();
      var ra = await withProgress('กำลังรวมรายการ', async function (pg) { var left = 1, done = 0, guard = 0; while (left > 0 && guard++ < 60) { var x = await apiCall('lvMergeScan', { apply: 1 }); done += x.done || 0; left = x.left || 0; if (pg && pg.setProgress) pg.setProgress(Math.min(99, Math.round(done / (done + left || 1) * 100)), 'รวมแล้ว ' + done + ' กลุ่ม'); if (!x.done) break; } return done; }, { successLabel: 'รวมรายการแล้ว' });
      if (ra.ok) { D.mine = null; D.all = null; D.pending = null; D.sum = null; showToast('รวมแล้ว ' + ra.data + ' กลุ่ม'); }
    });
  }
  async function saveSettings() {
    readSettings();
    if (SET.types.some(function (t) { return !String(t.label).trim(); })) { showToast('กรุณาใส่ชื่อประเภทการลาให้ครบ', true); return; }
    var lastBad = Object.keys(SET.last).filter(function (u) { return !SET.last[u].from; });
    if (lastBad.length) { showToast('การลาครั้งสุดท้าย: กรุณาใส่วันที่ "ตั้งแต่" ให้ครบ', true); return; }
    var sign = {}, tpl = {}; body.querySelectorAll('[data-sg]').forEach(function (el) { sign[el.getAttribute('data-sg')] = el.value; }); body.querySelectorAll('[data-tp]').forEach(function (el) { tpl[el.getAttribute('data-tp')] = el.value; });
    var p = { selfReport: document.getElementById('lvSelf').checked, wkCount: document.getElementById('lvWk').checked, sickDays: +document.getElementById('lvSick').value || 0, types: SET.types, sign: sign, tpl: tpl, carry: SET.carry, last: SET.last };
    var r = await withProgress('กำลังบันทึกการตั้งค่า', function () { return apiCall('lvCfgSave', p); }, { successLabel: 'บันทึกการตั้งค่าแล้ว' });
    if (!r.ok) return;
    var d = r.data; B.selfReport = d.selfReport; B.types = d.types; B.sickDays = d.sickDays; B.sign = d.sign; B.tpl = d.tpl; B.carry = d.carry; B.last = d.last; B.wkCount = d.wkCount;
    SET = null; D.mine = null; D.all = null; D.pending = null; D.sum = null; D.mine = null; body._h = ''; showSettings();
  }

  // ---------- ฟอร์มแจ้งลา ----------
  function openForm(forOther) {
    F = { userId: forOther ? '' : B.me.id, typeKey: '', otherLabel: '', from: B.today, to: B.today, allDay: true, periods: [], note: '', phone: B.phone || '', docs: { leave: null, order: null }, busy: false, forOther: !!forOther };
    document.getElementById('lvModalTitle').innerHTML = ic('fa-plane-departure') + ' ' + (forOther ? 'แจ้งลาแทนครู' : 'แจ้งลา / ไปราชการ');
    document.getElementById('lvModalActs').innerHTML = '<button type="button" class="btn btn-ghost" data-lv-close>ยกเลิก</button><button type="button" class="btn btn-success" data-lv-send>' + ic('fa-paper-plane') + ' ' + (canM() ? 'บันทึก (อนุมัติทันที)' : 'ส่งคำขอลา') + '</button>';
    renderForm(); showModalEl(modal);
  }
  function formRead() {
    if (!F) return; var g = function (id) { var e = document.getElementById(id); return e ? e.value : null; };
    var v;
    if ((v = g('lvFu')) !== null) F.userId = v;
    if ((v = g('lvFo')) !== null) F.otherLabel = v;
    if ((v = g('lvFf')) !== null) F.from = v;
    if ((v = g('lvFt2')) !== null) F.to = v;
    if ((v = g('lvFn')) !== null) F.note = v;
    if ((v = g('lvFp')) !== null) F.phone = v;
  }
  function renderForm() {
    var t = typeOf(F.typeKey), h = '<div class="lv-f">';
    if (F.forOther) h += '<div id="lvFuTp"></div>'; // 2.28.0: ตัวเลือกครูแบบหน้าแจ้งลา (เดิมกล่องเลือก)
    h += '<label class="lb">ประเภท</label><div class="lv-types">' + B.types.map(function (x) { return '<button type="button" data-ft="' + esc(x.key) + '"' + (F.typeKey === x.key ? ' class="on"' : '') + '>' + esc(x.label) + '</button>'; }).join('') + '</div>';
    if (t && t.custom) h += '<label class="lb" for="lvFo">ชื่อการลา <span class="lv-req">*</span></label><input type="text" id="lvFo" maxlength="40" placeholder="เช่น ลาอุปสมบท · ลาไปช่วยเหลือภริยาคลอดบุตร" value="' + esc(F.otherLabel) + '">';
    h += '<div class="lv-row"><div><label class="lb" for="lvFf">ตั้งแต่วันที่</label><input type="date" id="lvFf" value="' + esc(F.from) + '"></div><div><label class="lb" for="lvFt2">ถึงวันที่</label><input type="date" id="lvFt2" value="' + esc(F.to) + '"></div></div>' +
      '<p class="lv-note" id="lvFdays" style="margin:6px 0 0"></p>' +
      '<label class="lb">ช่วงเวลา</label><div class="lv-types"><button type="button" data-fa="1"' + (F.allDay ? ' class="on"' : '') + '>ทั้งวัน</button><button type="button" data-fa="0"' + (F.allDay ? '' : ' class="on"') + '>เฉพาะบางคาบ</button></div>' +
      (F.allDay ? '' : '<div class="lv-types sm" style="margin-top:8px">' + B.periods.map(function (p) { return '<button type="button" data-fp="' + p + '"' + (F.periods.indexOf(p) !== -1 ? ' class="on"' : '') + '>' + plabel(p) + '</button>'; }).join('') + '</div><p class="lv-note" style="margin:4px 0 0">A = เข้าแถว · B = โฮมรูม</p>') +
      '<label class="lb" for="lvFn">เนื่องจาก / รายละเอียด</label><input type="text" id="lvFn" maxlength="300" placeholder="' + (t && t.doc === 'order' ? 'เช่น อบรม... ที่ สพม.บึงกาฬ' : 'เช่น มีไข้ ไปพบแพทย์') + '" value="' + esc(F.note) + '">';
    if (!t || t.slot !== 'none') h += '<label class="lb" for="lvFp">เบอร์โทรระหว่างลา</label><input type="tel" id="lvFp" maxlength="40" value="' + esc(F.phone) + '"><p class="lv-note" style="margin:4px 0 0">ระบบจำไว้ใช้ครั้งต่อไป · พิมพ์ลงในใบลา</p>';
    if (t) {
      var need = t.doc, f = F.docs[need], later = t.req && t.later, req = t.req && !t.later && !F.forOther;
      h += '<label class="lb">' + (need === 'order' ? 'คำสั่งไปราชการ' : 'ใบลา (ลงชื่อแล้ว)') + ' ' + (req ? '<span class="lv-req">* บังคับ</span>' : later ? '<span class="lv-opt">(ส่งทีหลังได้)</span>' : '<span class="lv-opt">(ถ้ามี)</span>') + '</label>' +
        '<div class="lv-drop' + (f ? ' ok' : '') + '">' + ic(f ? 'fa-circle-check' : 'fa-file-arrow-up') + '<div class="lv-dt">' + (f ? '<b>' + esc(f.name) + '</b><div class="lv-note">อัปโหลดแล้ว · กดเปลี่ยนไฟล์ได้</div>' : 'ถ่ายรูป / เลือกไฟล์ (รูปหรือ PDF)' + (later ? '<div class="lv-note">' + esc(t.label) + ': ส่งทีหลังได้ภายใน ' + B.sickDays + ' วันทำการหลังวันลาวันสุดท้าย · ระบบเตือนทางกระดิ่ง</div>' : '')) + '</div>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-fdoc="' + need + '">' + ic('fa-upload') + ' ' + (f ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์') + '</button>' + (need === 'leave' && t.slot !== 'none' ? '<button type="button" class="btn btn-secondary btn-sm" data-fprint>' + ic('fa-print') + ' พิมพ์ใบลา</button>' : '') + '</div>';
      if (need === 'leave' && t.slot !== 'none') h += '<p class="lv-note">' + ic('fa-circle-info') + ' กด "พิมพ์ใบลา" = ระบบเติมข้อมูลในแบบฟอร์มของโรงเรียนให้ (ชื่อ ตำแหน่ง วันที่ ครั้งสุดท้าย สถิติการลา) → พิมพ์ ลงชื่อ แล้วถ่ายรูปแนบ</p>';
    } else h += '<p class="lv-note" style="margin-top:12px">' + ic('fa-hand-pointer') + ' เลือกประเภทก่อน</p>';
    h += '</div>';
    document.getElementById('lvModalBody').innerHTML = h; paintDays();
    if (F.forOther) { var fu = createTeacherPicker(document.getElementById('lvFuTp'), { label: 'ครู', single: true, users: (B.people || []).map(function (u) { return { id: u.id, name: u.name }; }), onChange: function (Lu) { F.userId = Lu.length ? Lu[0].id : ''; } }); if (F.userId) fu.set([F.userId]); }
  }
  function paintDays() {
    var e = document.getElementById('lvFdays'); if (!e) return; var n = workdays(F.from, F.to || F.from);
    e.innerHTML = F.to && F.to < F.from ? '<span style="color:#b91c1c">วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม</span>' : ic('fa-calendar-check') + ' ประมาณ <b>' + n + ' วันทำการ</b> (ไม่นับเสาร์-อาทิตย์ · ระบบหักวันหยุดในปฏิทินโรงเรียนให้อีกครั้งตอนบันทึก · ติดกับรายการเดิมประเภทเดียวกัน = รวมเป็นรายการเดียวให้เอง)';
  }
  async function sendForm() {
    formRead(); if (F.busy) { showToast('กรุณารอให้อัปโหลดไฟล์เสร็จก่อน', true); return; }
    var t = typeOf(F.typeKey);
    if (F.forOther && !F.userId) { showToast('กรุณาเลือกครู', true); return; }
    if (!t) { showToast('กรุณาเลือกประเภท', true); return; }
    if (t.custom && !F.otherLabel.trim()) { showToast('กรุณาพิมพ์ชื่อการลา', true); return; }
    if (!F.from || (F.to && F.to < F.from)) { showToast('เลือกช่วงวันที่ให้ถูกต้อง', true); return; }
    if (!F.allDay && !F.periods.length) { showToast('กรุณาเลือกคาบ หรือเลือก "ทั้งวัน"', true); return; }
    if (t.req && !t.later && !F.forOther && !F.docs[t.doc]) { showToast('กรุณาแนบ' + (t.doc === 'order' ? 'คำสั่งไปราชการ' : 'ใบลา (ลงชื่อแล้ว)'), true); return; }
    var p = { typeKey: t.key, otherLabel: F.otherLabel, from: F.from, to: F.to || F.from, periods: F.allDay ? [] : F.periods, note: F.note, phone: F.phone, leaveDoc: F.docs.leave ? F.docs.leave.id : '', orderDoc: F.docs.order ? F.docs.order.id : '', autoApprove: canM() };
    if (F.forOther) p.userId = F.userId;
    hideModalEl(modal);
    var r = await withProgress('กำลังบันทึก', function () { return apiCall('lvReqSave', p); }, { successLabel: canM() ? 'บันทึกแล้ว (อนุมัติแล้ว)' : 'ส่งคำขอแล้ว — รอผู้ดูแลอนุมัติ' });
    if (!r.ok) { showModalEl(modal); return; }
    if (r.data && r.data.merged) showToast('รวมกับรายการเดิมแล้ว — ' + thRange(r.data.merged.from, r.data.merged.to));
    F = null; D.mine = null; D.pending = null; D.all = null; D.sum = null; body._h = ''; show();
  }
  // อัปโหลดไฟล์ (ใบลา / คำสั่ง) — ใช้ร่วมกันทั้งในฟอร์มและการส่งทีหลัง
  var upTarget = null;
  async function uploadFile(f) {
    var prep = await apiCall('leaveUploadPrepare', { flow: 'req', fileName: f.name, mimeType: f.type, fileSize: f.size, direct: 1, origin: location.origin });
    var res = await sendPreparedFile(prep, f, { filename: prep.uploadFileName || f.name, mimeType: f.type });
    return apiCall('leaveUploadFinalize', { evidenceId: prep.evidenceId, fileId: res.fileId, fileUrl: res.url, directUrl: res.directUrl, fileName: prep.uploadFileName || f.name, mimeType: f.type, via: res.via, fallbackReason: res.fallbackReason || '' });
  }
  fileIn.addEventListener('change', async function () {
    var f = fileIn.files && fileIn.files[0]; fileIn.value = ''; if (!f || !upTarget) return;
    if (!/^image\/|pdf$/.test(f.type)) { showToast('แนบได้เฉพาะรูปภาพหรือ PDF', true); return; }
    var tg = upTarget; upTarget = null;
    if (tg.bulk) { gRead(); G.busy = true; hideModalEl(modal); var rb = await withProgress('กำลังอัปโหลดไฟล์', function () { return uploadFile(f); }, { upload: true, successLabel: 'อัปโหลดแล้ว' }); G.busy = false; if (rb.ok) G.doc = rb.data; gRender(); showModalEl(modal); return; }
    if (tg.form) {
      formRead(); F.busy = true; hideModalEl(modal);
      var r = await withProgress('กำลังอัปโหลด' + docName(tg.slot), function () { return uploadFile(f); }, { upload: true, successLabel: 'อัปโหลดแล้ว' });
      F.busy = false; if (r.ok) F.docs[tg.slot] = r.data; renderForm(); showModalEl(modal);
    } else {
      var r2 = await withProgress('กำลังอัปโหลด' + docName(tg.slot), async function () { var up = await uploadFile(f); return apiCall('lvReqDoc', { id: tg.id, slot: tg.slot, evidenceId: up.id }); }, { upload: true, successLabel: 'ส่ง' + docName(tg.slot) + 'แล้ว' });
      if (r2.ok) { D.mine = null; D.pending = null; D.all = null; body._h = ''; show(); }
    }
  });

  // ---------- พิมพ์ใบลา (แบบฟอร์มของโรงเรียน) ----------
  async function printForm(payload) {
    var w = window.open('', '_blank'); if (!w) { showToast('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาตป๊อปอัปแล้วลองอีกครั้ง', true); return; }
    w.document.write('<p style="font-family:sans-serif;padding:20px">กำลังเตรียมใบลา...</p>');
    try { var d = await apiCall('lvForm', payload), logo = await logoData(), u = URL.createObjectURL(new Blob([formHtml(d, logo)], { type: 'text/html;charset=utf-8' })); w.location.href = u; lvPrep(w, u); }
    catch (e) { w.close(); showToast(e.message, true); }
  }
  // 2.34.3: รอหน้าต่างใบลาโหลดเสร็จ → ย่อให้พอดี 1 หน้า · ผูกปุ่มพิมพ์ / ปิด · สั่งพิมพ์
  function lvPrep(w, u) {
    var tries = 0;
    (function wait() {
      var doc = null; try { if (w.location.href === u && w.document.readyState === 'complete') doc = w.document; } catch (e) { doc = null; }
      if (!doc) { if (++tries < 100 && !w.closed) setTimeout(wait, 100); return; }
      var fit = function () { var pg = doc.querySelector('.pg'), el = doc.getElementById('lvIn'); if (!pg || !el) return; el.style.zoom = ''; var cs = w.getComputedStyle(pg), av = pg.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom), h = el.scrollHeight; if (h > av) el.style.zoom = String(Math.floor(av / h * 1000) / 1000); };
      doc.addEventListener('click', function (e) { if (e.target.closest('[data-lv-print]')) w.print(); else if (e.target.closest('[data-lv-close]')) w.close(); });
      (doc.fonts ? doc.fonts.ready : Promise.resolve()).then(function () { fit(); setTimeout(function () { w.print(); }, 300); });
    })();
  }
  // โลโก้ฝังในหน้า (หน้าต่างใหม่ที่เขียนด้วยสคริปต์โหลดรูปจากลิงก์ได้ไม่แน่นอน) · ฟอนต์ Sarabun จากเว็บเอง
  var LOGO = null;
  async function logoData() {
    if (LOGO) return LOGO;
    try { var bl = await (await fetch('assets/school-logo.png?v=2.16.0')).blob(); LOGO = await new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { res(''); }; r.readAsDataURL(bl); }); } catch (e) { LOGO = ''; }
    return LOGO;
  }
  function formHtml(d, logo) {
    var fu = function (n) { return new URL('assets/fonts/' + n, location.href).href; };
    var f = function (v, cls, min) { return '<span class="f' + (cls ? ' ' + cls : '') + '"' + (min ? ' style="min-width:' + min + 'mm"' : '') + '>' + (v == null || v === '' ? '&nbsp;' : esc(v)) + '</span>'; };
    var dd = function (s) { var x = dP(s); return [x.getDate(), ML[x.getMonth()], x.getFullYear() + 543]; };
    var ck = function (on) { return '(<span class="ck">' + (on ? '✓' : '&nbsp;') + '</span>)'; };
    var w = dd(d.writtenOn), a = dd(d.from), b = dd(d.to), slot = d.slot, lst = d.last, la = lst ? dd(lst.from) : null, lb = lst ? dd(lst.to) : null;
    var kindTxt = { sick: 'ป่วย', personal: 'กิจส่วนตัว', maternity: 'คลอดบุตร' }[slot] || d.typeLabel.replace(/^ลา/, '');
    var otherTxt = slot === 'other' ? d.typeLabel.replace(/^ลา/, '') : '';
    var y1 = +d.round.from.slice(0, 4) + 543, half = d.round.half;
    var cell = function (v) { return v && (v[0] || v[1]) ? v[0] + ' / ' + v[1] : ''; };
    var row = function (k, label) { var pv = d.stats[k] || [0, 0], now = slot === k ? [1, d.days] : [0, 0], tot = [pv[0] + now[0], pv[1] + now[1]]; return '<tr><td>' + label + '</td><td class="v">' + cell(pv) + '</td><td class="v">' + cell(now) + '</td><td class="v">' + cell(tot) + '</td></tr>'; };
    var S = d.sign || {}, posLine = (d.position || '') + (d.level ? ' ' + d.level : '');
    return '<!doctype html><html lang="th"><head><meta charset="UTF-8"><title>ใบลา ' + esc(d.name) + ' ' + esc(d.from) + '</title><style>' +
      '@font-face{font-family:LvSarabun;font-weight:400;src:url(' + fu('sarabun-thai-400-normal.woff2') + ') format("woff2");unicode-range:U+0E01-0E5B,U+200C-200D,U+25CC}' +
      '@font-face{font-family:LvSarabun;font-weight:400;src:url(' + fu('sarabun-latin-400-normal.woff2') + ') format("woff2")}' +
      '@font-face{font-family:LvSarabun;font-weight:600 700;src:url(' + fu('sarabun-thai-600-normal.woff2') + ') format("woff2");unicode-range:U+0E01-0E5B,U+200C-200D,U+25CC}' +
      '@font-face{font-family:LvSarabun;font-weight:600 700;src:url(' + fu('sarabun-latin-600-normal.woff2') + ') format("woff2")}' +
      '@page{size:A4;margin:0}body{margin:0;background:#e5e7eb;font-family:LvSarabun,"TH Sarabun New",sans-serif;color:#111}' +
      '.pg{width:210mm;height:297mm;overflow:hidden;margin:10px auto;background:#fff;padding:9mm 12mm 6mm 18mm;box-sizing:border-box;font-size:13.6px;line-height:1.95}' +
      '.logo{display:block;margin:0 auto 3mm;width:24mm}.r{text-align:right}.ind{padding-left:24mm}' +
      '.f{display:inline-block;border-bottom:1px dotted #555;min-width:11mm;text-align:center;font-weight:600;padding:0 2mm;line-height:1.4}.f.l{text-align:left}' +
      '.ck{display:inline-block;width:6mm;text-align:center;font-weight:700}.kinds{display:grid;grid-template-columns:18mm 1fr}' +
      '.bot{display:grid;grid-template-columns:1fr 78mm;gap:8mm;margin-top:5mm;align-items:start}' +
      'table{border-collapse:collapse;width:100%;font-size:14px}td,th{border:1px solid #222;padding:1px 4px;text-align:center;font-weight:500;line-height:1.55}th{font-weight:700}td:first-child{text-align:left}td.v{font-weight:600}' +
      '.box{border:1.5px solid #222;padding:3mm 4mm;text-align:center;font-size:14px;line-height:1.8}.dots{border-bottom:1px dotted #555;height:6mm;margin:0 4mm}.sig{text-align:center}' +
      '.bar{position:sticky;top:0;text-align:center;padding:8px;background:#1e293b}.bar button{font:inherit;font-size:16px;padding:6px 18px;border-radius:8px;border:0;cursor:pointer;margin:0 4px}' +
      '@media print{body{background:#fff}.pg{margin:0}.bar{display:none}}</style></head><body>' +
      '<div class="bar"><button type="button" data-lv-print style="background:#16a34a;color:#fff">พิมพ์ / บันทึกเป็น PDF</button><button type="button" data-lv-close style="background:#dc2626;color:#fff">ปิด</button></div>' +
      '<div class="pg"><div class="in" id="lvIn">' + (logo ? '<img class="logo" src="' + logo + '" alt="">' : '') +
      '<div class="r">เขียนที่ ' + f('โรงเรียนบุ่งคล้านคร', '', 40) + '</div>' +
      '<div class="r">วันที่ ' + f(w[0]) + ' เดือน ' + f(w[1], '', 26) + ' พ.ศ. ' + f(w[2]) + '</div>' +
      '<div>เรื่อง &nbsp;ขอลา' + f(kindTxt, 'l', 50) + '</div><div>เรียน &nbsp;ผู้อำนวยการโรงเรียนบุ่งคล้านคร</div>' +
      '<div class="ind">ข้าพเจ้า ' + f(d.name, 'l', 56) + ' ตำแหน่ง ' + f(d.position, '', 16) + ' ระดับ ' + f(d.level, '', 20) + '</div>' +
      '<div>โรงเรียนบุ่งคล้านคร อำเภอบุ่งคล้า จังหวัดบึงกาฬ สังกัดสำนักงานเขตพื้นที่การศึกษามัธยมศึกษาบึงกาฬ กระทรวงศึกษาธิการ</div>' +
      '<div class="kinds"><div style="padding-top:12mm">ขอลา</div><div style="padding-left:16mm">' +
      '<div>' + ck(slot === 'sick') + ' ป่วย</div><div>' + ck(slot === 'personal') + ' กิจส่วนตัว &nbsp;&nbsp; เนื่องจาก ' + f(slot === 'personal' ? d.note : '', 'l', 95) + '</div>' +
      '<div>' + ck(slot === 'maternity') + ' คลอดบุตร</div><div>' + ck(slot === 'other') + ' อื่นๆ ' + f(otherTxt ? otherTxt + (d.note ? ' เนื่องจาก ' + d.note : '') : '', 'l', 110) + '</div></div></div>' +
      '<div style="padding-left:5mm">ตั้งแต่วันที่ ' + f(a[0]) + ' เดือน ' + f(a[1], '', 20) + ' พ.ศ. ' + f(a[2]) + ' ถึงวันที่ ' + f(b[0]) + ' เดือน ' + f(b[1], '', 20) + ' พ.ศ. ' + f(b[2]) + '</div>' +
      (d.wk ? '<div style="padding-left:5mm;font-size:12px;line-height:1.4;margin:-1mm 0 1mm">หมายเหตุ: ลาคร่อมวันเสาร์-อาทิตย์ · ' + (d.wkCount ? 'นับวันเสาร์-อาทิตย์รวมในวันลา' : 'ไม่นับวันเสาร์-อาทิตย์') + '</div>' : '') +
      '<div>มีกำหนด ' + f(d.days) + ' วัน &nbsp;ทั้งนี้ข้าพเจ้าได้ลา ' + ck(lst && lst.slot === 'sick') + ' ป่วย ' + ck(lst && lst.slot === 'personal') + ' กิจส่วนตัว ' + ck(lst && lst.slot === 'maternity') + ' คลอดบุตร ' + ck(lst && lst.slot === 'other') + ' อื่นๆ' + f(lst && lst.slot === 'other' ? String(lst.label || '').replace(/^ลา/, '') : '', '', 12) + ' ครั้งสุดท้าย</div>' +
      '<div>ตั้งแต่วันที่ ' + f(la && la[0]) + ' เดือน ' + f(la && la[1], '', 20) + ' พ.ศ. ' + f(la && la[2]) + ' ถึงวันที่ ' + f(lb && lb[0]) + ' เดือน ' + f(lb && lb[1], '', 20) + ' พ.ศ. ' + f(lb && lb[2]) + ' มี</div>' +
      '<div>กำหนด ' + f(lst ? lst.days : '') + ' วัน &nbsp;ในระหว่างลาจะติดต่อข้าพเจ้าได้ที่ ' + f(d.phone, 'l', 70) + '</div>' +
      '<div style="margin-top:4mm;padding-left:110mm">ขอแสดงความนับถือ</div><div style="padding-left:85mm;margin-top:5mm">ลงชื่อ' + f('', '', 60) + '</div>' +
      '<div style="padding-left:92mm">(' + f(d.name, '', 56) + ')</div><div style="padding-left:85mm">ตำแหน่ง' + f(posLine, '', 56) + '</div>' +
      '<div class="bot"><div><div>สถิติการลา ' + ck(half === 1) + ' 1 ต.ค. ' + f(half === 1 ? y1 : '', '', 14) + ' - 31 มี.ค. ' + f(half === 1 ? y1 + 1 : '', '', 14) + '</div>' +
      '<div style="padding-left:21mm">' + ck(half === 2) + ' 1 เม.ย. ' + f(half === 2 ? y1 : '', '', 14) + ' - 30 ก.ย. ' + f(half === 2 ? y1 : '', '', 14) + '</div>' +
      '<table><tr><th>ประเภทการลา</th><th>ลามาแล้ว<br>ครั้ง / วัน</th><th>ลาครั้งนี้<br>ครั้ง / วัน</th><th>รวมเป็น<br>ครั้ง / วัน</th></tr>' + row('sick', 'ป่วย') + row('personal', 'กิจส่วนตัว') + row('maternity', 'คลอดบุตร') + row('other', 'อื่นๆ' + (otherTxt ? ' ' + esc(otherTxt) : '.................')) + '</table>' +
      '<div class="sig" style="margin-top:6mm">ลงชื่อ.............................................</div><div class="sig">(' + esc(S.hr || '') + ')</div><div class="sig">' + esc(S.hrTitle || '') + '</div><div class="sig">วันที่.............../.............../...............</div></div>' +
      '<div class="box"><b>ความเห็นผู้บังคับบัญชา</b><div class="dots"></div><div class="dots"></div><div style="height:12mm"></div>(' + esc(S.deputy || '') + ')<br>' + esc(S.deputyTitle || '') +
      '<div style="height:5mm"></div><b>ความเห็นผู้บังคับบัญชา</b><div class="dots"></div><div class="dots"></div><div style="height:14mm"></div>(' + esc(S.director || '') + ')<br>' + esc(S.directorTitle || '') + '</div></div></div></div>' +
      '</body></html>'; // 2.34.3: ไม่มีสคริปต์ในเอกสาร (CSP) — ย่อให้พอดี / ปุ่ม / สั่งพิมพ์ ทำจากหน้าหลัก (lvPrep)
  }


  // ---------- 2.18.0: ผู้ดูแลลงการลา / ไปราชการหลายรายการ — แท็บ "หลายแถว" (ค่าเริ่มต้น) · "เลือกหลายคน" ----------
  var G = null, AM = [-2, 0, 1, 2, 3, 4], PM = [5, 6, 7, 8];
  function gRow(src) { return Object.assign({ userId: '', typeKey: (B.types[1] || B.types[0]).key, from: B.today, to: B.today, per: 'all', perTxt: '', note: '', err: '' }, src || {}); }
  function openBulk() {
    G = { tab: 'rows', rows: [gRow()], m: { sel: [], q: '', typeKey: B.types[0].key, otherLabel: '', from: B.today, to: B.today, allDay: true, periods: [], note: '' }, doc: null, busy: false };
    document.getElementById('lvModalTitle').innerHTML = ic('fa-plane-departure') + ' ลงการลา / ไปราชการ';
    modal.querySelector('.modal-box').style.maxWidth = '1180px';
    gActs(); gRender(); showModalEl(modal);
  }
  function gPeople() { var L = (B.people || []).slice(); if (!L.some(function (u) { return u.id === B.me.id; })) L.unshift({ id: B.me.id, name: B.me.name }); return L; }
  function gName(id) { var u = gPeople().filter(function (x) { return x.id === id; })[0]; return u ? u.name : ''; }
  function gActs() { var n = G.tab === 'rows' ? G.rows.length : G.m.sel.length; document.getElementById('lvModalActs').innerHTML = '<button type="button" class="btn btn-ghost" data-lv-close>ยกเลิก</button><button type="button" class="btn btn-success" data-g-save>' + ic('fa-check') + ' บันทึก ' + n + (G.tab === 'rows' ? ' รายการ' : ' คน') + '</button>'; }
  function parsePer(t) { var o = []; String(t || '').replace(/\s/g, '').split(',').forEach(function (x) { var m = /^([ab]|\d)(?:-([ab]|\d))?$/i.exec(x); if (!m) return; var v = function (c) { c = c.toUpperCase(); return c === 'A' ? -2 : c === 'B' ? 0 : +c; }, a = v(m[1]), b = m[2] ? v(m[2]) : a; B.periods.forEach(function (p) { if (p >= Math.min(a, b) && p <= Math.max(a, b) && o.indexOf(p) === -1) o.push(p); }); }); return o.sort(function (x, y) { return x - y; }); }
  function rowPeriods(r) { return r.per === 'am' ? AM : r.per === 'pm' ? PM : r.per === 'custom' ? parsePer(r.perTxt) : []; }
  function gRead() {
    if (!G) return;
    if (G.tab === 'rows') modal.querySelectorAll('[data-gr]').forEach(function (tr) { var r = G.rows[+tr.getAttribute('data-gr')]; if (!r) return; tr.querySelectorAll('[data-gk]').forEach(function (el) { r[el.getAttribute('data-gk')] = el.value; }); });
    else { var g = function (id) { var e = document.getElementById(id); return e ? e.value : null; }, v; if ((v = g('gmQ')) !== null) G.m.q = v; if ((v = g('gmO')) !== null) G.m.otherLabel = v; if ((v = g('gmF')) !== null) G.m.from = v; if ((v = g('gmT')) !== null) G.m.to = v; if ((v = g('gmN')) !== null) G.m.note = v; }
  }
  function gRender() {
    var h = '<div class="cc-seg" style="margin-bottom:12px"><button type="button" data-g-tab="rows"' + (G.tab === 'rows' ? ' class="on"' : '') + '>' + ic('fa-table-list') + ' หลายแถว (คนละประเภทได้)</button><button type="button" data-g-tab="multi"' + (G.tab === 'multi' ? ' class="on"' : '') + '>' + ic('fa-users') + ' เลือกหลายคน (ประเภทเดียวกัน)</button></div>';
    h += G.tab === 'rows' ? gRowsHtml() : gMultiHtml();
    h += '<p class="lv-note" style="margin-top:10px">' + ic('fa-circle-info') + ' บันทึกแล้วเป็น "อนุมัติแล้ว" ทันที · ไม่ต้องแนบหลักฐาน · แยกเป็นรายการของแต่ละคน (แก้ / ลบทีละคนได้) · หน้าวิชาที่สอนและเว็บเช็คชื่อไม่นับคาบเหล่านั้น</p>';
    document.getElementById('lvModalBody').innerHTML = h; gActs();
    gPickers(); // 2.28.0
  }
  function gPickers() {
    var P = gPeople().map(function (u) { return { id: u.id, name: u.name }; }), body = document.getElementById('lvModalBody');
    body.querySelectorAll('[data-rtp]').forEach(function (el) {
      var i = +el.getAttribute('data-rtp'), r = G.rows[i]; if (!r) return;
      var hid = el.parentNode.querySelector('[data-gk="userId"]');
      var tp = createTeacherPicker(el, { single: true, placeholder: 'พิมพ์ชื่อครู', users: P, onChange: function (Lu) { r.userId = Lu.length ? Lu[0].id : ''; if (hid) hid.value = r.userId; } });
      if (r.userId) tp.set([r.userId]);
    });
    var gm = document.getElementById('gmTp');
    if (gm) { var tpm = createTeacherPicker(gm, { label: 'ครู', users: P, onChange: function (Lu) { G.m.sel = Lu.map(function (u) { return u.id; }); } }); tpm.set(G.m.sel); }
  }
  function gRowsHtml() {
    var P = gPeople(), T = B.types;
    return '<p class="lv-note" style="margin-top:0">แต่ละแถว = ครู 1 คน · คาบ "ระบุเอง" พิมพ์ เช่น 1-4 หรือ A,B,5-6</p><div style="overflow-x:auto"><table class="lv-tt" style="table-layout:fixed;min-width:920px"><colgroup><col style="width:23%"><col style="width:15%"><col style="width:13%"><col style="width:13%"><col style="width:14%"><col style="width:18%"><col style="width:4%"></colgroup><thead><tr><th>ครู</th><th>ประเภท</th><th>ตั้งแต่</th><th>ถึง</th><th>คาบ</th><th>รายละเอียด</th><th></th></tr></thead><tbody>' +
      G.rows.map(function (r, i) {
        var t = typeOf(r.typeKey) || {};
        return '<tr data-gr="' + i + '"><td><div class="lv-rtp" data-rtp="' + i + '"></div><input type="hidden" data-gk="userId" value="' + esc(r.userId) + '">' + (r.err ? '<div class="lv-req" style="margin-top:3px">' + esc(r.err) + '</div>' : '') + '</td>' +
          '<td><select data-gk="typeKey" style="width:100%">' + T.map(function (x) { return '<option value="' + esc(x.key) + '"' + (r.typeKey === x.key ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('') + '</select></td>' +
          '<td><input type="date" data-gk="from" value="' + esc(r.from) + '" style="width:100%"></td><td><input type="date" data-gk="to" value="' + esc(r.to) + '" style="width:100%"></td>' +
          '<td><select data-gk="per" style="width:100%"><option value="all"' + (r.per === 'all' ? ' selected' : '') + '>ทั้งวัน</option><option value="am"' + (r.per === 'am' ? ' selected' : '') + '>เช้า (A–4)</option><option value="pm"' + (r.per === 'pm' ? ' selected' : '') + '>บ่าย (5–8)</option><option value="custom"' + (r.per === 'custom' ? ' selected' : '') + '>ระบุเอง</option></select>' + (r.per === 'custom' ? '<input type="text" data-gk="perTxt" value="' + esc(r.perTxt) + '" placeholder="เช่น 1-4" style="width:100%;margin-top:4px">' : '') + '</td>' +
          '<td><input type="text" data-gk="note" maxlength="300" value="' + esc(r.note) + '" placeholder="' + (t.custom ? 'ชื่อการลา *' : 'รายละเอียด') + '" style="width:100%"></td>' +
          '<td><button type="button" class="modal-close-x" style="position:static" data-g-rm="' + i + '" aria-label="ลบแถว">✕</button></td></tr>';
      }).join('') + '</tbody></table></div><div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="btn btn-secondary btn-sm" data-g-add>' + ic('fa-plus') + ' เพิ่มแถว</button><button type="button" class="btn btn-ghost btn-sm" data-g-copy>' + ic('fa-copy') + ' คัดลอกแถวล่าสุด</button></div>';
  }
  function gMultiHtml() {
    var m = G.m, t = typeOf(m.typeKey) || {}, q = m.q.trim();
    var hits = q ? gPeople().filter(function (u) { return u.name.indexOf(q) !== -1 && m.sel.indexOf(u.id) === -1; }).slice(0, 8) : [];
    return '<div class="lv-f"><div id="gmTp"></div>' + // 2.28.0: ตัวเลือกครูกลาง
      '<label class="lb">ประเภท (ใช้กับทุกคนที่เลือก)</label><div class="lv-types">' + B.types.map(function (x) { return '<button type="button" data-gm-t="' + esc(x.key) + '"' + (m.typeKey === x.key ? ' class="on"' : '') + '>' + esc(x.label) + '</button>'; }).join('') + '</div>' +
      (t.custom ? '<label class="lb" for="gmO">ชื่อการลา <span class="lv-req">*</span></label><input type="text" id="gmO" maxlength="40" value="' + esc(m.otherLabel) + '">' : '') +
      '<div class="lv-row"><div><label class="lb" for="gmF">ตั้งแต่วันที่</label><input type="date" id="gmF" value="' + esc(m.from) + '"></div><div><label class="lb" for="gmT">ถึงวันที่</label><input type="date" id="gmT" value="' + esc(m.to) + '"></div></div>' +
      '<label class="lb">ช่วงเวลา</label><div class="lv-types"><button type="button" data-gm-all="1"' + (m.allDay ? ' class="on"' : '') + '>ทั้งวัน</button><button type="button" data-gm-all="0"' + (m.allDay ? '' : ' class="on"') + '>เฉพาะบางคาบ</button></div>' +
      (m.allDay ? '' : '<div class="lv-types sm" style="margin-top:8px">' + B.periods.map(function (p) { return '<button type="button" data-gm-p="' + p + '"' + (m.periods.indexOf(p) !== -1 ? ' class="on"' : '') + '>' + plabel(p) + '</button>'; }).join('') + '</div>') +
      '<label class="lb" for="gmN">รายละเอียด</label><input type="text" id="gmN" maxlength="300" value="' + esc(m.note) + '" placeholder="เช่น อบรม... ที่ สพม.บึงกาฬ">' +
      '<label class="lb">คำสั่ง / หลักฐาน <span class="lv-opt">(ไม่บังคับ · ใช้ไฟล์เดียวกันทุกคน)</span></label><div class="lv-drop' + (G.doc ? ' ok' : '') + '">' + ic(G.doc ? 'fa-circle-check' : 'fa-file-arrow-up') + '<div class="lv-dt">' + (G.doc ? '<b>' + esc(G.doc.name) + '</b>' : 'รูปหรือ PDF') + '</div><button type="button" class="btn btn-secondary btn-sm" data-g-doc>' + ic('fa-upload') + ' ' + (G.doc ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์') + '</button>' + (G.doc ? '<button type="button" class="btn btn-ghost btn-sm" data-g-docrm>เอาออก</button>' : '') + '</div></div>';
  }
  function gHitsHtml(hits, q) { return q ? '<div class="lv-pickl">' + (hits.length ? hits.map(function (u) { return '<div><span>' + esc(u.name) + '</span><button type="button" class="btn btn-secondary btn-sm" data-gm-add="' + esc(u.id) + '">เพิ่ม</button></div>'; }).join('') : '<div><span class="mut">ไม่พบชื่อ</span></div>') + '</div>' : ''; }
  function gSelHtml() { return G.m.sel.map(function (id) { return '<span class="lv-chip">' + esc(gName(id)) + '<button type="button" data-gm-rm="' + esc(id) + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button></span>'; }).join(''); }
  async function gSave() {
    gRead(); if (G.busy) { showToast('กรุณารอให้อัปโหลดไฟล์เสร็จก่อน', true); return; }
    var rows, pl = {};
    if (G.tab === 'rows') {
      var bad = '';
      rows = G.rows.map(function (r, i) { var t = typeOf(r.typeKey) || {}, per = rowPeriods(r); if (!r.userId) bad = bad || 'แถวที่ ' + (i + 1) + ': ยังไม่ได้เลือกครู'; else if (!r.from || (r.to && r.to < r.from)) bad = bad || 'แถวที่ ' + (i + 1) + ': วันที่ไม่ถูกต้อง'; else if (r.per === 'custom' && !per.length) bad = bad || 'แถวที่ ' + (i + 1) + ': ระบุคาบไม่ถูกต้อง (เช่น 1-4)'; else if (t.custom && !r.note.trim()) bad = bad || 'แถวที่ ' + (i + 1) + ': กรุณาพิมพ์ชื่อการลาในช่องรายละเอียด';
        return { userId: r.userId, typeKey: r.typeKey, otherLabel: t.custom ? r.note.slice(0, 40) : '', from: r.from, to: r.to || r.from, periods: per, note: t.custom ? '' : r.note }; });
      if (bad) { showToast(bad, true); return; }
    } else {
      var m = G.m, t = typeOf(m.typeKey) || {};
      if (!m.sel.length) { showToast('กรุณาเลือกครูอย่างน้อย 1 คน', true); return; }
      if (t.custom && !m.otherLabel.trim()) { showToast('กรุณาพิมพ์ชื่อการลา', true); return; }
      if (!m.from || (m.to && m.to < m.from)) { showToast('เลือกช่วงวันที่ให้ถูกต้อง', true); return; }
      if (!m.allDay && !m.periods.length) { showToast('กรุณาเลือกคาบ หรือเลือก "ทั้งวัน"', true); return; }
      rows = m.sel.map(function (id) { return { userId: id, typeKey: m.typeKey, otherLabel: m.otherLabel, from: m.from, to: m.to || m.from, periods: m.allDay ? [] : m.periods, note: m.note }; });
      if (G.doc) pl[t.doc === 'order' ? 'orderDoc' : 'leaveDoc'] = G.doc.id;
    }
    pl.rows = rows; hideModalEl(modal);
    var r = await withProgress('กำลังบันทึก ' + rows.length + ' รายการ', function () { return apiCall('lvBulkSave', pl); }, { successLabel: 'บันทึกแล้ว' });
    if (!r.ok) { showModalEl(modal); return; }
    var errs = r.data.errors || [];
    D.mine = null; D.pending = null; D.all = null; D.sum = null; body._h = '';
    if (!errs.length) { G = null; modal.querySelector('.modal-box').style.maxWidth = ''; show(); showToast('บันทึกแล้ว ' + r.data.saved + ' รายการ'); return; }
    // เก็บเฉพาะแถวที่ไม่สำเร็จไว้ให้แก้
    if (G.tab === 'rows') { var keep = []; errs.forEach(function (x) { var row = G.rows[x.i]; if (row) { row.err = x.error; keep.push(row); } }); G.rows = keep; }
    else { G.m.sel = errs.map(function (x) { return rows[x.i].userId; }); showToast(errs.map(function (x) { return gName(rows[x.i].userId) + ': ' + x.error; }).join(' · '), true); }
    show(); gRender(); showModalEl(modal);
    if (G.tab === 'rows') showToast('บันทึกแล้ว ' + r.data.saved + ' รายการ · ไม่สำเร็จ ' + errs.length + ' รายการ (ดูข้อความในแถว)', true);
  }
  // ---------- เหตุการณ์ ----------
  function findItem(id) { var all = [].concat(D.mine || [], D.pending || [], D.all ? D.all.items : []); return all.filter(function (x) { return x.id === id; })[0] || null; }
  document.addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-lv-tab]'))) { st.tab = t.getAttribute('data-lv-tab'); show(); return; }
    if (e.target.closest('[data-lv-close]')) { hideModalEl(modal); F = null; G = null; modal.querySelector('.modal-box').style.maxWidth = ''; return; }
    if ((t = e.target.closest('[data-lv-new]'))) { if (t.getAttribute('data-lv-new') === 'other') openBulk(); else openForm(false); return; }
    if (G && modal.contains(e.target)) {
      if ((t = e.target.closest('[data-g-tab]'))) { gRead(); G.tab = t.getAttribute('data-g-tab'); gRender(); return; }
      if (e.target.closest('[data-g-add]')) { gRead(); G.rows.push(gRow()); gRender(); return; }
      if (e.target.closest('[data-g-copy]')) { gRead(); var lr = G.rows[G.rows.length - 1]; G.rows.push(gRow(lr ? { typeKey: lr.typeKey, from: lr.from, to: lr.to, per: lr.per, perTxt: lr.perTxt, note: lr.note } : null)); gRender(); return; }
      if ((t = e.target.closest('[data-g-rm]'))) { gRead(); G.rows.splice(+t.getAttribute('data-g-rm'), 1); if (!G.rows.length) G.rows.push(gRow()); gRender(); return; }
      if ((t = e.target.closest('[data-gm-add]'))) { gRead(); G.m.sel.push(t.getAttribute('data-gm-add')); G.m.q = ''; gRender(); var q = document.getElementById('gmQ'); if (q) q.focus(); return; }
      if ((t = e.target.closest('[data-gm-rm]'))) { gRead(); var id = t.getAttribute('data-gm-rm'); G.m.sel = G.m.sel.filter(function (x) { return x !== id; }); gRender(); return; }
      if ((t = e.target.closest('[data-gm-t]'))) { gRead(); G.m.typeKey = t.getAttribute('data-gm-t'); gRender(); return; }
      if ((t = e.target.closest('[data-gm-all]'))) { gRead(); G.m.allDay = t.getAttribute('data-gm-all') === '1'; gRender(); return; }
      if ((t = e.target.closest('[data-gm-p]'))) { var pp = +t.getAttribute('data-gm-p'), ii = G.m.periods.indexOf(pp); if (ii === -1) G.m.periods.push(pp); else G.m.periods.splice(ii, 1); t.classList.toggle('on', ii === -1); return; }
      if (e.target.closest('[data-g-doc]')) { upTarget = { bulk: true }; fileIn.click(); return; }
      if (e.target.closest('[data-g-docrm]')) { gRead(); G.doc = null; gRender(); return; }
      if (e.target.closest('[data-g-save]')) { gSave(); return; }
      return;
    }
    if (F && modal.contains(e.target)) {
      if ((t = e.target.closest('[data-ft]'))) { formRead(); F.typeKey = t.getAttribute('data-ft'); renderForm(); return; }
      if ((t = e.target.closest('[data-fa]'))) { formRead(); F.allDay = t.getAttribute('data-fa') === '1'; renderForm(); return; }
      if ((t = e.target.closest('[data-fp]'))) { var p = +t.getAttribute('data-fp'), i = F.periods.indexOf(p); if (i === -1) F.periods.push(p); else F.periods.splice(i, 1); F.periods.sort(function (a, b) { return a - b; }); t.classList.toggle('on', i === -1); return; }
      if ((t = e.target.closest('[data-fdoc]'))) { upTarget = { form: true, slot: t.getAttribute('data-fdoc') }; fileIn.click(); return; }
      if (e.target.closest('[data-fprint]')) { formRead(); var ty = typeOf(F.typeKey); if (!F.from) { showToast('เลือกวันที่ก่อน', true); return; } if (F.forOther && !F.userId) { showToast('กรุณาเลือกครู', true); return; } printForm({ typeKey: F.typeKey, otherLabel: ty && ty.custom ? F.otherLabel : '', from: F.from, to: F.to || F.from, note: F.note, phone: F.phone, userId: F.forOther ? F.userId : '' }); return; }
      if (e.target.closest('[data-lv-send]')) { sendForm(); return; }
      return;
    }
    if ((t = e.target.closest('[data-lv-print]'))) { printForm({ id: t.getAttribute('data-lv-print') }); return; }
    if ((t = e.target.closest('[data-lv-doc]'))) { upTarget = { id: t.getAttribute('data-lv-doc'), slot: t.getAttribute('data-slot') }; fileIn.click(); return; }
    if ((t = e.target.closest('[data-lv-ok]'))) {
      var x = findItem(t.getAttribute('data-lv-ok')); if (!x) return;
      var miss = x.docMissing ? '<br>ยังไม่ได้แนบ' + docName(x.need) + (x.docDue ? ' (ครูส่งได้ถึง ' + thD(x.docDue) + ')' : '') : '';
      if (!(await askConfirm('อนุมัติ <b>' + esc(x.typeLabel) + '</b> ของ ' + esc(x.name) + '<br>' + thRange(x.from, x.to) + ' · ' + x.days + ' วัน' + miss, 'อนุมัติการลา'))) return;
      var r = await withProgress('กำลังอนุมัติ', function () { return apiCall('lvReqDecide', { id: x.id, approve: true }); }, { successLabel: 'อนุมัติแล้ว' });
      if (r.ok) { D.pending = null; D.all = null; D.sum = null; D.mine = null; body._h = ''; show(); }
      return;
    }
    if ((t = e.target.closest('[data-lv-no]'))) { rejectAsk(findItem(t.getAttribute('data-lv-no'))); return; }
    if ((t = e.target.closest('[data-lv-remind]'))) {
      var rr = await withProgress('กำลังส่งการเตือน', function () { return apiCall('lvRemind', { id: t.getAttribute('data-lv-remind') }); }, { successLabel: 'เตือนทางกระดิ่งแล้ว' }); void rr; return;
    }
    if ((t = e.target.closest('[data-lv-cancel]'))) {
      var y = findItem(t.getAttribute('data-lv-cancel')); if (!y) return;
      var mineP = y.userId === B.me.id && y.status === 'pending';
      if (!(await askConfirm((mineP ? 'ยกเลิกคำขอ' : 'ลบรายการ') + ' <b>' + esc(y.typeLabel) + '</b>' + (y.userId !== B.me.id ? ' ของ ' + esc(y.name) : '') + '<br>' + thRange(y.from, y.to) + (y.status === 'approved' ? '<br>คาบสอนวันนั้นจะกลับมานับตามปกติ' : ''), mineP ? 'ยกเลิกคำขอ' : 'ลบรายการ'))) return;
      var rc = await withProgress('กำลังลบ', function () { return apiCall('lvReqCancel', { id: y.id }); }, { successLabel: 'ลบแล้ว' });
      if (rc.ok) { D.mine = null; D.pending = null; D.all = null; D.sum = null; body._h = ''; show(); }
      return;
    }
    if ((t = e.target.closest('[data-lv-rg]'))) { st.range = t.getAttribute('data-lv-rg'); if (st.range === 'custom' && !st.from) { var r0 = rangeOf(); st.from = r0[0]; st.to = r0[1]; } showAll(); return; }
    if (e.target.closest('[data-lv-xlsx]')) { exportXlsx(); return; }
    if ((t = e.target.closest('[data-lv-sd]'))) { var k = +t.getAttribute('data-lv-sd'), d = k ? dP(st.sumDate) : dP(B.today); if (k) d.setDate(d.getDate() + k); while (k && d.getDay() % 6 === 0) d.setDate(d.getDate() + k); st.sumDate = ymd(d); showSummary(); return; }
    if ((t = e.target.closest('[data-lv-copy]'))) { var ta = document.getElementById(t.getAttribute('data-lv-copy')); try { await navigator.clipboard.writeText(ta.value); showToast('คัดลอกแล้ว'); } catch (x2) { ta.select(); document.execCommand('copy'); showToast('คัดลอกแล้ว'); } return; }
    // ตั้งค่า
    if (e.target.closest('[data-lv-tadd]')) { readSettings(); SET.types.push({ key: '', label: '', doc: 'leave', req: true, later: false, slot: 'other', fixed: false }); body._h = ''; showSettings(); var ins = body.querySelectorAll('#lvTypes input[data-tk="label"]'); if (ins.length) ins[ins.length - 1].focus(); return; }
    if ((t = e.target.closest('[data-lv-trm]'))) { readSettings(); SET.types.splice(+t.getAttribute('data-lv-trm'), 1); body._h = ''; showSettings(); return; }
    if ((t = e.target.closest('[data-lv-crm]'))) { readSettings(); delete SET.carry[t.getAttribute('data-lv-crm')]; body._h = ''; showSettings(); return; }
    if ((t = e.target.closest('[data-lv-lrm]'))) { readSettings(); delete SET.last[t.getAttribute('data-lv-lrm')]; body._h = ''; showSettings(); return; }
    if (e.target.closest('[data-lv-save]')) { saveSettings(); return; }
    if (e.target.closest('[data-lv-merge]')) { mergeOld(); return; } // 2.22.3
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (G && modal.contains(t)) { if (t.matches('[data-gk="per"],[data-gk="typeKey"]')) { gRead(); gRender(); } else if (t.matches('[data-gk="from"]')) { gRead(); var gi = +t.closest('[data-gr]').getAttribute('data-gr'), gr = G.rows[gi]; if (gr && (!gr.to || gr.to < gr.from)) { gr.to = gr.from; var te2 = t.closest('tr').querySelector('[data-gk="to"]'); if (te2) te2.value = gr.to; } } else if (t.id === 'gmF') { gRead(); if (!G.m.to || G.m.to < G.m.from) { G.m.to = G.m.from; var tt = document.getElementById('gmT'); if (tt) tt.value = G.m.to; } } return; }
    if (F && modal.contains(t)) { formRead(); if (t.id === 'lvFf' && (!F.to || F.to < F.from)) { F.to = F.from; var te = document.getElementById('lvFt2'); if (te) te.value = F.to; } paintDays(); return; }
    if (t.id === 'lvFt') { st.fType = t.value; showAll(); return; }
    if (t.id === 'lvFs') { st.fStatus = t.value; showAll(); return; }
    if (t.id === 'lvAf' || t.id === 'lvAt') { st.from = document.getElementById('lvAf').value; st.to = document.getElementById('lvAt').value; if (st.from && st.to && st.to >= st.from) showAll(); return; }
    if (t.id === 'lvSd') { if (t.value) { st.sumDate = t.value; showSummary(); } return; }
    if (t.matches('[data-lv-cadd]') && t.value) { readSettings(); SET.carry[t.value] = { round: B.round.key, sick: [0, 0], personal: [0, 0], maternity: [0, 0], other: [0, 0] }; body._h = ''; showSettings(); return; }
    if (t.matches('[data-lv-ladd]') && t.value) { readSettings(); SET.last[t.value] = { slot: 'sick', label: '', from: '', to: '', days: 1 }; body._h = ''; showSettings(); return; }
  });
  function rejectAsk(x) {
    if (!x) return;
    var m = document.createElement('div'); m.className = 'modal-backdrop'; m.hidden = true;
    m.innerHTML = '<div class="modal-box" style="text-align:left"><button type="button" class="modal-close-x" data-rj-x aria-label="ปิด">✕</button><h3>' + ic('fa-xmark') + ' ไม่อนุมัติ</h3><p>' + esc(x.name) + ' · ' + esc(x.typeLabel) + ' · ' + thRange(x.from, x.to) + '</p><label class="lv-note" for="lvRj">เหตุผล (ครูจะเห็นข้อความนี้)</label><input type="text" id="lvRj" maxlength="300" style="width:100%;box-sizing:border-box"><div class="modal-actions"><button type="button" class="btn btn-ghost" data-rj-x>ยกเลิก</button><button type="button" class="btn btn-danger" data-rj-ok>' + ic('fa-xmark') + ' ไม่อนุมัติ</button></div></div>';
    document.body.appendChild(m); showModalEl(m); setTimeout(function () { var i = document.getElementById('lvRj'); if (i) i.focus(); }, 50);
    m.addEventListener('click', async function (e) {
      if (e.target.closest('[data-rj-x]')) { hideModalEl(m); setTimeout(function () { m.remove(); }, 300); return; }
      if (!e.target.closest('[data-rj-ok]')) return;
      var why = document.getElementById('lvRj').value.trim(); if (!why) { showToast('กรุณาใส่เหตุผล', true); return; }
      hideModalEl(m); setTimeout(function () { m.remove(); }, 300);
      var r = await withProgress('กำลังบันทึก', function () { return apiCall('lvReqDecide', { id: x.id, approve: false, reason: why }); }, { successLabel: 'บันทึกแล้ว (แจ้งครูทางกระดิ่ง)' });
      if (r.ok) { D.pending = null; D.all = null; D.mine = null; body._h = ''; show(); }
    });
  }
  window.addEventListener('hashchange', function () { if (location.hash === '#new' && B) { try { history.replaceState(null, '', location.pathname); } catch (x) { /* ข้าม */ } openForm(); } });
  document.addEventListener('input', debounce(function (e) {
    if (!G || e.target.id !== 'gmQ') return; G.m.q = e.target.value; var q = G.m.q.trim();
    var hits = q ? gPeople().filter(function (u) { return u.name.indexOf(q) !== -1 && G.m.sel.indexOf(u.id) === -1; }).slice(0, 8) : [];
    var el = document.getElementById('gmHits'); if (el) el.innerHTML = gHitsHtml(hits, q); // วาดเฉพาะรายการค้นหา (ช่องพิมพ์ไม่หลุดโฟกัส)
  }, 150));
  boot();
})();
