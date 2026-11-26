/* ขอเวลาเรียน (2.17.0) — หน้า reqtime.html
 * ครูเลือกนักเรียน (จากห้อง / ค้นชื่อทั้งโรงเรียน) · วัน · คาบ · เหตุผล → ผู้ดูแล (รอง ผอ.) อนุมัติ
 * อนุมัติแล้ว: เว็บเช็คชื่อเลือก "ร่วมกิจกรรม" ให้ · คาบที่เช็คว่าขาดไปแล้ว (ตั้งแต่วันที่ยื่นขอ) เปลี่ยนให้ ยกเว้นขาดคาบก่อนหน้าหลายคาบ
 * แท็บ: คำขอของฉัน · รออนุมัติ · รายการทั้งหมด · ตั้งค่า */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('reqtime'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('lvBody'), tabsEl = document.getElementById('lvTabs');
  var modal = document.getElementById('lvModal'), fileIn = document.getElementById('lvFileIn');
  var B = null, st = { tab: 'mine', range: 'month', from: '', to: '' }, D = { mine: null, pending: null, all: null }, CACHE = { all: {}, appr: {} }; // 2.34.0: จำผลแต่ละช่วงเวลา (กดกลับช่วงเดิม = ขึ้นทันที)
  var F = null, STU = null, EXC = {}; // ฟอร์ม · รายชื่อนักเรียนทั้งโรงเรียน · นักเรียนที่เอาออกตอนอนุมัติ {reqId: {sid:1}}
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], DW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var ST = { pending: ['p', 'fa-hourglass-half', 'รออนุมัติ'], approved: ['a', 'fa-check', 'อนุมัติแล้ว'], rejected: ['r', 'fa-xmark', 'ไม่อนุมัติ'], suspended: ['r', 'fa-ban', 'ระงับ'], review: ['p', 'fa-magnifying-glass', 'รอผู้ดูแลตรวจ'] }; // 2.34.0
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function ic(n) { return '<i class="fa-solid ' + n + '" aria-hidden="true"></i>'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dP(s) { var p = String(s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function thD(s, y) { var d = dP(s); return DW[d.getDay()] + ' ' + d.getDate() + ' ' + MS[d.getMonth()] + (y === false ? '' : ' ' + (d.getFullYear() + 543)); }
  function thRange(a, b) { if (!b || a === b) return thD(a); return dP(a).getFullYear() === dP(b).getFullYear() ? thD(a, false) + ' – ' + thD(b) : thD(a) + ' – ' + thD(b); }
  function thTime(iso) { if (!iso) return ''; var d = new Date(iso); return isNaN(d) ? '' : d.getDate() + ' ' + MS[d.getMonth()] + ' ' + (d.getFullYear() + 543) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function plabel(p) { return Number(p) === -2 ? 'A' : Number(p) === 0 ? 'B' : String(p); }
  function perTxt(a) { return a && a.length ? 'คาบ ' + a.map(plabel).join(', ') : 'ทั้งวัน'; }
  function err(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function put(el, html) { if (!el) return; el.classList.remove('rt-busy'); if (el._h === html) return; el.innerHTML = html; el._h = html; }
  function stPill(s, x0) { var x = ST[s] || ST.pending; if (s === 'approved' && x0 && x0.src === 'self') x = ['a', 'fa-check', 'มีผลแล้ว']; return '<span class="lv-st ' + x[0] + '">' + ic(x[1]) + ' ' + x[2] + '</span>'; }
  function isSelfMode() { return B && B.mode === 'self'; }
  function docChip(d, icon) { if (!d) return ''; return '<a class="lv-file" href="' + esc(d.url) + '" target="_blank" rel="noopener" data-fp="' + esc(d.url) + '" data-fp-name="' + esc(d.name || '') + '" title="กดเพื่อดูไฟล์">' + ic(icon || (/\.pdf$/i.test(d.name || '') ? 'fa-file-pdf' : 'fa-image')) + ' ' + esc(d.name) + '</a>'; } // 2.34.0: ป็อปอัปพรีวิว
  function canV() { return B && (B.manage || B.view); }
  function roomsTxt(rs) { return (rs || []).map(function (r) { return r.room + ' ' + r.n; }).join(' · '); }
  function workdays(a, b) { if (!a || !b || b < a) return 0; var n = 0, d = dP(a), e = dP(b); for (var i = 0; d <= e && i < 400; i++) { if (d.getDay() % 6) n++; d.setDate(d.getDate() + 1); } return n; }
  function reload() { D = { mine: null, pending: null, all: null, appr: null, memo: null }; CACHE = { all: {}, appr: {} }; body._h = ''; show(); }

  async function boot() {
    try { B = await apiCall('rtBoot', {}); } catch (e) { tabsEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    if (!B.canAsk) st.tab = canV() ? 'pending' : B.seeAll ? 'all' : 'approved';
    var sh = document.getElementById('rtSubHd'); if (sh && isSelfMode()) sh.textContent = 'ครูรายงานขอเวลาเรียนพร้อมแนบหนังสือที่ผู้บริหารลงนามแล้ว · มีผลทันที · เว็บเช็คชื่อเลือก "ร่วมกิจกรรม" ให้อัตโนมัติ · ผู้ดูแลตรวจ / ระงับได้'; // 2.34.0
    if ((location.hash || '') === '#pending' && canV()) st.tab = 'pending';
    show();
    var hs = location.hash || '', mm;
    if (hs === '#new' && B.canAsk) { try { history.replaceState(null, '', location.pathname); } catch (x) { /* ข้าม */ } openForm(); }
    else if ((mm = /^#memo=(.+)$/.exec(hs)) && B.canAsk) { try { history.replaceState(null, '', location.pathname); } catch (x) { /* ข้าม */ } openFromMemo(decodeURIComponent(mm[1])); } // 2.33.0: จากใบบันทึกข้อความ
    else if ((mm = /^#rt=(.+)$/.exec(hs))) { try { history.replaceState(null, '', location.pathname); } catch (x) { /* ข้าม */ } viewList(decodeURIComponent(mm[1])); } // 2.33.0: จากป้ายในหน้าเช็คชื่อ
  }
  function tabList() {
    var t = [];
    if (B.canAsk) t.push(['mine', 'fa-user', (B.isAdmin && !B.enabled) || B.selfPath ? 'รายการที่ฉันลง' : 'คำขอของฉัน']);
    if (canV()) t.push(['pending', 'fa-hourglass-half', isSelfMode() ? 'รออนุมัติ / รอตรวจ' : 'รออนุมัติ'], ['all', 'fa-list', 'รายการทั้งหมด']);
    else if (B.seeAll) t.push(['all', 'fa-list', 'รายการทั้งหมด']); // 2.34.0: โหมดรายงานเอง — ครูทุกคนเห็น
    else if (B.observe) t.push(['approved', 'fa-person-running', 'รายการที่อนุมัติแล้ว']); // 2.33.0: ครูดูอย่างเดียว
    if ((B.isAdmin || B.manage) && B.memoOn) t.push(['memo', 'fa-file-lines', 'ใบจากบันทึกข้อความ']); // 2.33.0
    if (B.manage) t.push(['settings', 'fa-sliders', 'ตั้งค่า']);
    return t;
  }
  function renderTabs() {
    var t = tabList(); tabsEl.hidden = !t.length; if (!t.length) { tabsEl.innerHTML = ''; return; }
    put(tabsEl, t.map(function (x) { return '<button type="button" class="tab-btn' + (x[0] === st.tab ? ' active' : '') + '" data-rt-tab="' + x[0] + '" role="tab">' + ic(x[1] + ' ui-icon') + ' ' + x[2] + (x[0] === 'pending' && B.pendingN ? '<span class="lv-cnt">' + B.pendingN + '</span>' : '') + '</button>'; }).join(''));
  }
  function show() { renderTabs(); ({ mine: showMine, pending: showPending, all: showAll, approved: showApproved, memo: showMemo, settings: showSettings })[st.tab](); }
  // 2.34.0: กันกระพริบ — มีเนื้อหาอยู่แล้ว = คงไว้แค่จางลง (ไม่ล้างหน้า ไม่เด้งขึ้นบน) · หน้าว่างจริงจึงขึ้น "กำลังโหลด"
  function loading() { if (body.children.length && !body.querySelector(':scope > .loading')) { body.classList.add('rt-busy'); return; } if (!body.querySelector('.loading')) { body.innerHTML = '<div class="loading">กำลังโหลด...</div>'; body._h = ''; } }
  async function load(k, p) { try { return (await apiCall('rtList', p)).items || []; } catch (e) { body.classList.remove('rt-busy'); body.innerHTML = err(e.message); body._h = ''; return null; } void k; }
  var RULE = function () { if (isSelfMode() && !B.isAdmin) return '<div class="rt-rule">• พิมพ์ใบขอเวลาเรียน ให้ผู้บริหารลงนามให้ครบก่อน แล้วถ่ายรูป / สแกนแนบมา (บังคับ)<br>• บันทึกแล้วมีผลทันที: หน้าเช็คชื่อเลือก "ร่วมกิจกรรม" ให้ · ครูประจำวิชาแก้ได้<br>• คาบที่เช็คแล้วว่า "ขาด" ตั้งแต่วันที่ลงข้อมูล = เปลี่ยนเป็นร่วมกิจกรรมให้ (ยกเว้นวันนั้นขาดคาบอื่นก่อนหน้าตั้งแต่ ' + B.skipAbsent + ' คาบ)<br>• ลงย้อนได้ถึงวันจันทร์ของสัปดาห์ที่ลง · แก้ไข / ลบได้เฉพาะของตัวเอง<br>• ผู้ดูแลได้รับแจ้งทุกรายการ และระงับได้พร้อมเหตุผล</div>';
    return '<div class="rt-rule">• ขอล่วงหน้าได้ และขอย้อนได้ถึงวันจันทร์ของสัปดาห์ที่ยื่นขอ<br>• อนุมัติแล้ว คาบที่ยังไม่เช็ค = หน้าเช็คชื่อเลือก "ร่วมกิจกรรม" ให้ · ครูประจำวิชาแก้ได้<br>• คาบที่เช็คแล้วว่า "ขาด" ตั้งแต่วันที่ยื่นขอ = เปลี่ยนเป็นร่วมกิจกรรมให้ (ยกเว้นวันนั้นขาดคาบอื่นก่อนหน้าตั้งแต่ ' + B.skipAbsent + ' คาบ)<br>• วันก่อนวันที่ยื่นขอ = ไม่แก้การเช็คชื่อที่ทำไปแล้ว</div>'; };

  // ---------- คำขอของฉัน ----------
  async function showMine() {
    if (!D.mine) { loading(); var r = await load('mine', { scope: 'mine' }); if (!r) return; D.mine = r; }
    if (st.tab !== 'mine') return;
    var h = '<div class="lv-grid" style="margin-bottom:14px"><div class="card cc-card" style="display:flex;flex-direction:column;justify-content:center;gap:10px"><button type="button" class="btn btn-primary lv-big" data-rt-new>' + ic('fa-plus') + ' ' + (B.isAdmin ? 'ลงข้อมูลขอเวลาเรียน' : B.selfPath ? 'รายงานขอเวลาเรียน (แนบหนังสือ)' : 'ขอเวลาเรียนให้นักเรียน') + '</button><p class="hint" style="margin:0">' + (B.isAdmin ? 'ผู้ดูแลระบบลงเอง = อนุมัติทันที · เว็บเช็คชื่อเลือก "ร่วมกิจกรรม" ให้นักเรียน' : B.selfPath ? 'ใช้เมื่อผู้บริหารลงนามในหนังสือขอเวลาเรียนแล้ว · บันทึกแล้วมีผลกับการเช็คชื่อทันที' : 'ครูทุกคนขอได้ · ผู้ดูแลอนุมัติ · ระหว่างรออนุมัติยังไม่มีผลกับการเช็คชื่อ') + '</p>' + (B.isAdmin && !B.enabled ? '<p class="lv-pill-off" style="margin:0">' + ic('fa-lock') + ' ปิดให้ครูขอเอง — ลงข้อมูลได้เฉพาะผู้ดูแลระบบ (เปิดได้ที่ ตั้งค่าระบบ › จัดการผู้ดูแล)</p>' : '') + '</div>' +
      '<div class="card cc-card"><h3>' + ic('fa-circle-info ui-icon') + ' หลักการ</h3>' + RULE() + '</div></div>';
    h += '<div class="card cc-card"><h3>' + ic('fa-clock-rotate-left ui-icon') + ' ' + ((B.isAdmin && !B.enabled) || B.selfPath ? 'รายการที่ฉันลง' : 'คำขอของฉัน') + '</h3>' + (D.mine.length ? '<div class="lv-list">' + D.mine.map(function (x) { return item(x, 'mine'); }).join('') + '</div>' : '<div class="lv-empty">' + ic('fa-mug-hot') + 'ยังไม่มีคำขอ</div>') + '</div>';
    put(body, h);
  }
  function resultLine(x) {
    var r = x.result; if (!r) return '';
    var h = r.changed ? '<span class="lv-file rt-ok-chip">' + ic('fa-check') + ' เปลี่ยน "ขาด" เป็นร่วมกิจกรรม ' + r.changed + ' คาบ</span>' : '';
    if (r.skipped && r.skipped.length) h += '<span class="lv-file miss" title="' + esc(r.skipped.map(function (k) { return k.name + ' ' + thD(k.date, false) + ' คาบ ' + plabel(k.period); }).join('\n')) + '">ไม่เปลี่ยน ' + r.skipped.length + ' คาบ: ' + esc(r.skipped.slice(0, 2).map(function (k) { return k.name + ' (' + thD(k.date, false) + ' ขาดก่อนหน้า ' + k.before + ' คาบ)'; }).join(', ')) + (r.skipped.length > 2 ? ' …' : '') + ' · ครูประจำวิชาตรวจเอง</span>';
    if (r.excluded) h += '<span class="lv-file">ไม่อนุมัติ ' + r.excluded + ' คน</span>';
    return h;
  }
  function item(x, mode) {
    var past = x.from < x.filedOn;
    var h = '<div class="lv-it" data-id="' + esc(x.id) + '"' + (mode === 'pending' ? ' style="flex-direction:column"' : '') + '><div class="lv-main" style="width:100%"><div class="lv-hd">' + (mode === 'mine' ? '' : '<b>' + esc(x.byName) + '</b>') + '<span class="lv-k rt-k">ร่วมกิจกรรม</span>' + (x.src === 'self' ? '<span class="rt-tag">รายงานเอง</span>' : '') + '<b>' + esc(x.title) + '</b></div>' +
      '<div class="lv-sub"><b style="color:var(--text)">' + thRange(x.from, x.to) + ' · ' + perTxt(x.periods) + '</b> · ' + x.days + ' วัน · นักเรียน ' + x.n + ' คน (' + esc(roomsTxt(x.rooms)) + ')' + (x.teacherName ? ' · ครูผู้ควบคุม ' + esc(x.teacherName) : '') + (x.apprName ? '' : ' · บันทึกเมื่อ ' + thTime(x.createdAt) + (x.decidedBy ? ' · ' + (x.status === 'approved' ? (x.byName === x.decidedBy ? 'บันทึก' : 'อนุมัติ') : 'ไม่อนุมัติ') + 'โดย ' + esc(x.decidedBy) : '')) + apprLine(x) + '</div>' +
      (x.note ? '<div class="lv-sub rt-note">' + ic('fa-align-left') + ' ' + esc(x.note) + '</div>' : '') + // 2.34.0
      (x.status === 'rejected' && x.reason ? '<div class="lv-sub" style="color:#b91c1c">เหตุผล: ' + esc(x.reason) + '</div>' : '') +
      ((x.status === 'suspended' || x.status === 'review') && x.suspReason ? '<div class="rt-susp">' + ic('fa-ban') + ' <b>ระงับ' + (x.suspBy ? 'โดย ' + esc(x.suspBy) : '') + (x.suspAt ? ' · ' + thTime(x.suspAt) : '') + '</b><br>เหตุผล: ' + esc(x.suspReason) + (x.status === 'review' ? '<br><i>แก้ไขแล้ว — รอผู้ดูแลตรวจ</i>' : x.by === B.me.id ? '<br><i>แก้ไขรายการแล้วกดบันทึก ผู้ดูแลจะตรวจอีกครั้ง</i>' : '') + '</div>' : '') +
      '<div class="lv-files">' + docChip(x.doc) + (past ? '<span class="lv-file" style="border-style:dashed">ขอย้อน ' + thRange(x.from, prevDay(x.filedOn)) + ' (ก่อนวันที่ยื่น) · การเช็คชื่อวันนั้นไม่ถูกแก้</span>' : '') + resultLine(x) + '</div>';
    if (mode === 'pending' && x.students && x.status === 'pending') {
      var ex = EXC[x.id] || {}, rows = x.students.map(function (s) { return '<tr' + (ex[s.id] ? ' class="off"' : '') + '><td style="width:32px"><input type="checkbox" data-rt-ex="' + esc(x.id) + '" data-sid="' + esc(s.id) + '"' + (ex[s.id] ? '' : ' checked') + ' aria-label="อนุมัติ ' + esc(s.name) + '"></td><td>' + esc(s.name) + '</td><td>' + esc(s.room) + '</td><td>' + esc(s.code || '') + '</td></tr>'; });
      var open = !!(EXC[x.id] && EXC[x.id].__open), lim = open ? rows.length : 8;
      h += '<div style="overflow-x:auto;margin-top:10px"><table class="rt-tb"><thead><tr><th></th><th>นักเรียน</th><th>ห้อง</th><th>เลขประจำตัว</th></tr></thead><tbody>' + rows.slice(0, lim).join('') + (rows.length > lim ? '<tr><td colspan="4" class="rt-more"><button type="button" class="btn btn-ghost btn-sm" data-rt-more="' + esc(x.id) + '">แสดงทั้งหมด ' + rows.length + ' คน</button></td></tr>' : '') + '</tbody></table></div>';
    }
    h += '</div><div class="lv-acts"' + (mode === 'pending' ? ' style="justify-content:flex-end"' : '') + '>' + stPill(x.status, x);
    var mine = x.by === B.me.id, selfMine = mine && x.src === 'self' && x.status !== 'rejected' && x.status !== 'pending'; // 2.34.0
    if (mode === 'pending' && x.status === 'pending' && B.manage) { var n = x.n - Object.keys(EXC[x.id] || {}).filter(function (k) { return k !== '__open'; }).length; h += '<button type="button" class="btn btn-success btn-sm" data-rt-ok="' + esc(x.id) + '">' + ic('fa-check') + ' อนุมัติ ' + n + ' คน</button><button type="button" class="btn btn-sm lv-btn-no" data-rt-no="' + esc(x.id) + '">' + ic('fa-xmark') + ' ไม่อนุมัติ</button>'; }
    if (B.manage && x.src === 'self' && (x.status === 'approved' || x.status === 'review')) h += '<button type="button" class="btn btn-sm lv-btn-no" data-rt-susp="' + esc(x.id) + '">' + ic('fa-ban') + ' ระงับ</button>'; // 2.34.0
    if (B.manage && (x.status === 'suspended' || x.status === 'review')) h += '<button type="button" class="btn btn-success btn-sm" data-rt-unsusp="' + esc(x.id) + '">' + ic('fa-rotate-left') + ' ยกเลิกการระงับ</button>';
    if (mode !== 'pending' || x.status !== 'pending') h += '<button type="button" class="btn btn-ghost btn-sm" data-rt-view="' + esc(x.id) + '">' + ic('fa-users') + ' ดูรายชื่อ</button>';
    if (x.hist && x.hist.length) h += '<button type="button" class="btn btn-ghost btn-sm" data-rt-hist="' + esc(x.id) + '">' + ic('fa-clock-rotate-left') + ' ประวัติ</button>';
    if (mode !== 'view' && (B.isAdmin || B.manage)) h += '<button type="button" class="btn btn-ghost btn-sm" data-rt-meta="' + esc(x.id) + '">' + ic('fa-signature') + ' ข้อมูลตามหนังสือ</button>'; // 2.33.0
    if (mode === 'view') return h + '</div></div>';
    if ((mine && x.status === 'pending') || (selfMine && isSelfMode())) h += '<button type="button" class="btn btn-ghost btn-sm" data-rt-edit="' + esc(x.id) + '">' + ic('fa-pen') + ' แก้ไข</button>';
    if ((mine && x.status === 'pending') || selfMine || (B.manage && mode !== 'pending')) h += '<button type="button" class="btn btn-ghost btn-sm" data-rt-cancel="' + esc(x.id) + '">' + ic('fa-trash-can') + ' ' + (mine && x.status === 'pending' ? 'ยกเลิกคำขอ' : 'ลบรายการ') + '</button>';
    return h + '</div></div>';
  }
  // 2.33.0: ผู้อนุมัติตามหนังสือ · เลขที่ / ลงวันที่ · ผู้บันทึก
  function apprLine(x) {
    if (!x.apprName) return '';
    var sub = [x.docNo ? 'หนังสือที่ ' + x.docNo : '', x.docDate ? 'ลงวันที่ ' + thD(x.docDate) : '', x.decidedBy ? 'บันทึกโดย ' + x.decidedBy : '', 'เมื่อ ' + thTime(x.createdAt)].filter(Boolean).join(' · ');
    return ' · <b style="color:var(--text)">' + ic('fa-signature') + ' อนุมัติโดย ' + esc(x.apprName) + (x.apprPos ? ' ' + esc(x.apprPos) : '') + '</b> <span class="rt-tag">ตามหนังสือ</span><div class="rt-sub">' + esc(sub) + '</div>';
  }
  function prevDay(s) { var d = dP(s); d.setDate(d.getDate() - 1); return ymd(d); }

  // ---------- รออนุมัติ ----------
  async function showPending() {
    if (!D.pending) { loading(); var r = await load('pending', { scope: 'pending' }); if (!r) return; D.pending = r; }
    if (st.tab !== 'pending') return;
    B.pendingN = D.pending.length; renderTabs();
    put(body, '<div class="card cc-card"><h3>' + ic('fa-hourglass-half ui-icon') + ' ' + (isSelfMode() ? 'รออนุมัติ / รอตรวจ' : 'รออนุมัติ') + ' <span class="lv-st p">' + D.pending.length + ' รายการ</span></h3><p class="hint" style="margin-top:-4px">' + (B.manage ? 'เอาติ๊กออก = ไม่อนุมัติเฉพาะคนนั้น · อนุมัติแล้วส่งไปเว็บเช็คชื่อทันที และครูผู้ขอได้กระดิ่ง' + (isSelfMode() ? ' · "รอผู้ดูแลตรวจ" = รายการที่ถูกระงับแล้วครูแก้ไขมา — ตรวจหลักฐานแล้วกด "ยกเลิกการระงับ" หรือ "ระงับ" ต่อ' : '') : 'คุณมีสิทธิ์ดูผลอย่างเดียว') + '</p>' +
      (D.pending.length ? '<div class="lv-list">' + D.pending.map(function (x) { return item(x, 'pending'); }).join('') + '</div>' : '<div class="lv-empty">' + ic('fa-circle-check') + 'ไม่มีคำขอรออนุมัติ</div>') + '</div>');
  }

  // ---------- รายการทั้งหมด ----------
  function rangeOf() {
    var t = B.today, d = dP(t);
    if (st.range === 'week') { var m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); var e = new Date(m); e.setDate(m.getDate() + 6); return [ymd(m), ymd(e)]; }
    if (st.range === 'month') return [t.slice(0, 8) + '01', ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
    if (st.range === 'all') return ['', ''];
    return [st.from || t, st.to || st.from || t];
  }
  async function showAll() {
    var r = rangeOf(), key = r.join('|');
    if ((!D.all || D.all.key !== key) && CACHE.all[key]) D.all = { key: key, items: CACHE.all[key] };
    if (!D.all || D.all.key !== key) { loading(); var it = await load('all', { scope: 'all', from: r[0], to: r[1] }); if (!it) return; CACHE.all[key] = it; D.all = { key: key, items: it }; }
    if (st.tab !== 'all' || D.all.key !== rangeOf().join('|')) return;
    var L = D.all.items;
    var h = '<div class="cc-flt"><div class="cc-seg">' + [['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['all', 'ทั้งหมด'], ['custom', 'กำหนดเอง']].map(function (x) { return '<button type="button" data-rt-rg="' + x[0] + '"' + (st.range === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>' +
      (st.range === 'custom' ? '<input type="date" id="rtAf" value="' + esc(r[0]) + '" style="max-width:160px"><span>ถึง</span><input type="date" id="rtAt" value="' + esc(r[1]) + '" style="max-width:160px">' : '') +
      '<span class="cc-sp"></span>' + (canV() ? '<button type="button" class="btn btn-secondary btn-sm" data-rt-xlsx>' + ic('fa-file-excel') + ' Excel</button>' : '') + '</div>';
    if (!canV()) h = '<p class="hint" style="margin:0 0 10px">' + ic('fa-eye') + ' รายการขอเวลาเรียนทั้งโรงเรียน — ดูหลักฐาน / ตรวจสอบได้ · แก้ไขได้เฉพาะของตัวเอง</p>' + h;
    h += '<div class="card cc-card">' + (L.length ? '<div class="lv-list">' + L.map(function (x) { return item(x, canV() ? 'all' : x.by === B.me.id ? 'mine' : 'view'); }).join('') + '</div>' : '<div class="lv-empty">' + ic('fa-mug-hot') + 'ไม่มีรายการในช่วงนี้</div>') + '</div>';
    put(body, h);
  }
  // ---------- 2.33.0: รายการที่อนุมัติแล้ว (ครูดูอย่างเดียว) ----------
  async function showApproved() {
    var r = rangeOf(), key = r.join('|') + '|' + (st.q || '');
    if ((!D.appr || D.appr.key !== key) && CACHE.appr[key]) D.appr = { key: key, items: CACHE.appr[key] };
    if (!D.appr || D.appr.key !== key) { loading(); var it = await load('approved', { scope: 'approved', from: r[0], to: r[1], q: st.q || '' }); if (!it) return; CACHE.appr[key] = it; D.appr = { key: key, items: it }; }
    if (st.tab !== 'approved' || D.appr.key !== rangeOf().join('|') + '|' + (st.q || '')) return;
    var L = D.appr.items;
    var h = '<p class="hint" style="margin:0 0 10px">' + ic('fa-eye') + ' ดูอย่างเดียว — คำขอเวลาเรียนที่อนุมัติแล้วทั้งโรงเรียน ใช้ตรวจสอบหลักฐาน / ตอนสอนแทน</p>' +
      '<div class="cc-flt"><div class="cc-seg">' + [['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['all', 'ทั้งหมด'], ['custom', 'กำหนดเอง']].map(function (x) { return '<button type="button" data-rt-rg="' + x[0] + '"' + (st.range === x[0] ? ' class="on"' : '') + '>' + x[1] + '</button>'; }).join('') + '</div>' +
      (st.range === 'custom' ? '<input type="date" id="rtAf" value="' + esc(r[0]) + '" style="max-width:160px"><span>ถึง</span><input type="date" id="rtAt" value="' + esc(r[1]) + '" style="max-width:160px">' : '') +
      '<span class="cc-sp"></span><input type="search" id="rtSq" placeholder="ค้นชื่อนักเรียน / ห้อง / กิจกรรม" value="' + esc(st.q || '') + '" style="max-width:280px;flex:1 1 200px" autocomplete="off"></div>';
    h += '<div class="card cc-card">' + (L.length ? '<div class="lv-list">' + L.map(function (x) { return item(x, 'view'); }).join('') + '</div>' : '<div class="lv-empty">' + ic('fa-mug-hot') + (st.q ? 'ไม่พบรายการที่ตรงกับ "' + esc(st.q) + '"' : 'ไม่มีรายการในช่วงนี้') + '</div>') + '</div>';
    put(body, h);
    var qi = document.getElementById('rtSq'); if (qi && st.qFocus) { qi.focus(); qi.selectionStart = qi.selectionEnd = qi.value.length; st.qFocus = false; }
  }
  // ---------- 2.33.0: ใบขอเวลาเรียนที่ครูทำในหน้าบันทึกข้อความ ----------
  async function showMemo() {
    if (!D.memo) { loading(); try { D.memo = (await apiCall('memoRtList', {})).items || []; } catch (e) { body.innerHTML = err(e.message); body._h = ''; return; } }
    if (st.tab !== 'memo') return;
    var L = D.memo;
    put(body, '<div class="card cc-card"><h3>' + ic('fa-file-lines ui-icon') + ' ใบขอเวลาเรียนจากหน้าบันทึกข้อความ</h3><p class="hint" style="margin-top:-4px">ครูกรอกใบขอเวลาเรียนในหน้าบันทึกข้อความแล้วกดบันทึก — เซ็นครบแล้วกด "ลงขอเวลาเรียน" ได้เลย (นักเรียน วันที่ คาบ เติมให้)</p>' +
      (L.length ? '<div class="lv-list">' + L.map(function (x) {
        return '<div class="lv-it"><div class="lv-main"><div class="lv-hd"><b>' + esc(x.owner) + '</b><b>' + esc(x.title) + '</b></div><div class="lv-sub">' + (x.from ? thRange(x.from, x.to) + ' · ' : '') + 'นักเรียน ' + x.n + ' คน · บันทึกเมื่อ ' + thTime(x.updatedAt) + '</div></div><div class="lv-acts">' +
          (x.rtId ? '<span class="lv-st a">' + ic('fa-check') + ' ลงแล้ว</span>' : '<button type="button" class="btn btn-success btn-sm" data-rt-frommemo="' + esc(x.id) + '">' + ic('fa-person-running') + ' ลงขอเวลาเรียน</button>') + '</div></div>';
      }).join('') + '</div>' : '<div class="lv-empty">' + ic('fa-mug-hot') + 'ยังไม่มีใบขอเวลาเรียนจากหน้าบันทึกข้อความ (150 วันล่าสุด)</div>') + '</div>');
  }
  async function openFromMemo(id) {
    var d; try { d = (await apiCall('memoGet', { id: id })).item; } catch (e) { showToast(e.message, true); return; }
    var data = d.data || {}, rt = data.rt || {}, stu = (data.students || []).map(function (s) { return { id: s.id, name: s.name, roomId: s.roomId, room: s.room, code: s.code || '' }; });
    openForm({ id: '', title: rt.title || d.title, from: rt.from || B.today, to: rt.to || rt.from || B.today, periods: rt.periods || [], students: stu, doc: null, teacherId: d.ownerId || '', memoId: d.id, docNo: data.docNo || '', docDate: data.docDate || '', ownerName: d.ownerName, fromMemo: true });
  }
  // ---------- 2.33.0: ข้อมูลตามหนังสือ (แก้ย้อนหลัง) ----------
  function apprPickHtml(v) {
    var L = B.approvers || [], cur = v.apprName || '', inList = L.some(function (a) { return a.name === cur; }), custom = !!cur && !inList;
    return '<div class="rt-appr"><div class="rt-appr-h">' + ic('fa-signature') + ' ข้อมูลตามหนังสือ</div>' +
      '<label class="lb" for="rtAp">ผู้อนุมัติ (ตามหนังสือ) <span class="lv-req">*</span></label><select id="rtAp">' + L.map(function (a, i) { return '<option value="' + i + '"' + (a.name === cur || (!cur && i === 0) ? ' selected' : '') + '>' + esc(a.name + (a.pos ? ' — ' + a.pos : '')) + '</option>'; }).join('') + '<option value="custom"' + (custom || !L.length ? ' selected' : '') + '>พิมพ์ชื่อเอง...</option></select>' +
      '<div class="lv-row" id="rtApC"' + (custom || !L.length ? '' : ' hidden') + '><div><input type="text" id="rtApN" placeholder="ชื่อ-สกุล" value="' + esc(custom ? cur : '') + '"></div><div><input type="text" id="rtApP" placeholder="ตำแหน่ง" value="' + esc(custom ? v.apprPos || '' : '') + '"></div></div>' +
      '<div class="lv-row"><div><label class="lb" for="rtDn">เลขที่หนังสือ <span class="lv-opt">(ไม่บังคับ)</span></label><input type="text" id="rtDn" maxlength="60" value="' + esc(v.docNo || '') + '"></div><div><label class="lb" for="rtDd">ลงวันที่ <span class="lv-opt">(ไม่บังคับ)</span></label><input type="date" id="rtDd" value="' + esc(v.docDate || '') + '"></div></div>' +
      '<p class="lv-note" style="margin:6px 0 0">ครูเห็น "อนุมัติโดย" เป็นชื่อนี้ · ชื่อคุณเก็บไว้เป็น "บันทึกโดย"</p></div>';
  }
  function apprRead(root) {
    var q = function (id) { return root.querySelector('#' + id); }, sel = q('rtAp'); if (!sel) return null;
    var o = { docNo: (q('rtDn') || {}).value || '', docDate: (q('rtDd') || {}).value || '' };
    if (sel.value === 'custom') { o.apprName = (q('rtApN').value || '').trim(); o.apprPos = (q('rtApP').value || '').trim(); }
    else { var a = (B.approvers || [])[+sel.value] || {}; o.apprName = a.name || ''; o.apprPos = a.pos || ''; }
    return o;
  }
  function metaAsk(x) {
    var m = document.createElement('div'); m.className = 'modal-backdrop'; m.hidden = true;
    m.innerHTML = '<div class="modal-box" style="text-align:left;max-width:520px"><button type="button" class="modal-close-x" data-x aria-label="ปิด">✕</button><h3>' + ic('fa-signature') + ' ข้อมูลตามหนังสือ</h3><p class="lv-note">' + esc(x.title) + ' · ' + thRange(x.from, x.to) + '</p>' + apprPickHtml(x) +
      '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-x>ยกเลิก</button><button type="button" class="btn btn-success" data-ok>' + ic('fa-check') + ' บันทึก' + (x.status === 'approved' ? ' และส่งให้เว็บเช็คชื่อ' : '') + '</button></div></div>';
    document.body.appendChild(m); showModalEl(m);
    var close = function () { hideModalEl(m); setTimeout(function () { m.remove(); }, 300); };
    m.addEventListener('change', function (e) { if (e.target.id === 'rtAp') m.querySelector('#rtApC').hidden = e.target.value !== 'custom'; });
    m.addEventListener('click', async function (e) {
      if (e.target.closest('[data-x]')) { close(); return; }
      if (!e.target.closest('[data-ok]')) return;
      var v = apprRead(m); if (!v.apprName) { showToast('กรุณาเลือกผู้อนุมัติ (ตามหนังสือ)', true); return; }
      close();
      var r = await withProgress('กำลังบันทึก', function () { return apiCall('rtMeta', Object.assign({ id: x.id }, v)); }, { successLabel: x.status === 'approved' ? 'บันทึกแล้ว — ส่งให้เว็บเช็คชื่อแล้ว' : 'บันทึกแล้ว' });
      if (r.ok) reload();
    });
  }
  async function exportXlsx() {
    var L = D.all ? D.all.items : [], rows = [];
    var r = await withProgress('กำลังเตรียมไฟล์', async function () {
      for (var i = 0; i < L.length; i++) { var d = (await apiCall('rtDetail', { id: L[i].id })).item; (d.students || []).forEach(function (s) { rows.push([d.from, d.to, perTxt(d.periods), d.title, s.name, s.room, s.code || '', d.byName, (ST[d.status] || [])[2] || d.status, d.apprName || d.decidedBy]); }); }
      return true;
    }, { successLabel: 'พร้อมดาวน์โหลด' });
    if (!r.ok) return;
    downloadBlob(buildXlsx('ขอเวลาเรียน', ['ตั้งแต่', 'ถึง', 'คาบ', 'กิจกรรม', 'นักเรียน', 'ห้อง', 'เลขประจำตัว', 'ครูผู้ขอ', 'สถานะ', 'ผู้อนุมัติ'], rows, [12, 12, 14, 34, 28, 8, 12, 24, 12, 24], 'รายการขอเวลาเรียน'), 'ขอเวลาเรียน-' + B.today + '.xlsx');
  }

  // ---------- ตั้งค่า ----------
  function showSettings() {
    put(body, '<div class="lv-grid"><div class="card cc-card"><h3>' + ic('fa-sliders ui-icon') + ' การเปลี่ยนสถานะ "ขาด"</h3><div class="cc-row"><span class="cc-lb">ไม่เปลี่ยนให้ ถ้าวันนั้นขาดคาบก่อนหน้า (ที่ไม่ได้ขอ) ตั้งแต่</span><input type="number" class="cc-num" id="rtSkip" min="1" max="9" value="' + B.skipAbsent + '"><span>คาบ</span></div><p class="hint">ใช้ตอนอนุมัติ: นักเรียนที่ถูกเช็คว่า "ขาด" ในคาบที่ขอ จะเปลี่ยนเป็น "ร่วมกิจกรรม" ให้ เว้นแต่วันนั้นขาดคาบอื่นที่อยู่ก่อนหน้าตามจำนวนนี้ (น่าจะไม่ได้มาโรงเรียน) — ครูประจำวิชาตรวจเอง</p><div class="cc-actions"><button type="button" class="btn btn-success" data-rt-save>' + ic('fa-check') + ' บันทึก</button></div></div>' +
      '<div class="card cc-card"><h3>' + ic('fa-id-badge ui-icon') + ' ป้ายในหน้าเช็คชื่อ</h3><label class="lv-sw"><input type="checkbox" class="sup-ck" id="rtShowT"' + (B.showTeacher ? ' checked' : '') + '><b>แสดงชื่อครูผู้ควบคุม / ครูผู้ขอ</b></label><p class="hint">ปิด = ป้ายใต้ชื่อนักเรียนแสดงเฉพาะชื่อกิจกรรม · มีผลกับรายการที่อนุมัติหลังจากนี้</p>' +
        '<label class="lv-sw" style="margin-top:10px"><input type="checkbox" class="sup-ck" id="rtTView"' + (B.teacherView ? ' checked' : '') + '><b>ให้ครูทุกคนดูรายการที่อนุมัติแล้ว</b></label><p class="hint">ดูอย่างเดียว (ทั้งโรงเรียน) — ไว้ตรวจหลักฐาน / ตอนสอนแทน · กดแล้วมีผลทันที</p>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-rt-resync>' + ic('fa-rotate') + ' ส่งข้อมูลให้เว็บเช็คชื่ออีกครั้ง</button><p class="hint">ส่งชื่อผู้อนุมัติ / หนังสือ / วันที่ของรายการที่อนุมัติแล้ว (ย้อนหลัง 200 วัน) ให้ป็อปอัปในเว็บเช็คชื่อ — ไม่แตะการเช็คชื่อ</p></div>' +
      '<div class="card cc-card"><h3>' + ic('fa-user-shield ui-icon') + ' ผู้อนุมัติ</h3><p class="hint" style="margin-top:0">เพิ่ม / ลบผู้ดูแล (ผู้อนุมัติ) ได้ที่ ตั้งค่าระบบ › จัดการผู้ดูแล › ผู้ดูแลการขอเวลาเรียน (เฉพาะผู้ดูแลระบบ)</p>' + RULE() + '</div></div>');
  }

  // ---------- ฟอร์มขอเวลาเรียน ----------
  async function openForm(edit) {
    F = { id: edit ? edit.id : '', title: edit ? edit.title : '', from: edit ? edit.from : B.today, to: edit ? edit.to : B.today, periods: edit ? edit.periods.slice() : [], allDay: edit ? !edit.periods.length : false, sel: {}, order: [], room: '', q: '', doc: edit && edit.doc ? edit.doc : null, keepDoc: !!(edit && edit.doc), busy: false };
    if (edit && edit.students) edit.students.forEach(function (s) { F.sel[s.id] = s; F.order.push(s.id); });
    F.teacherId = edit ? edit.teacherId || '' : '';
    F.memoId = edit && edit.memoId && edit.fromMemo ? edit.memoId : ''; F.ownerName = edit ? edit.ownerName || '' : ''; F.editPending = !!(edit && edit.id); // 2.33.0
    F.appr = { apprName: '', apprPos: '', docNo: edit && edit.fromMemo ? edit.docNo || '' : '', docDate: edit && edit.fromMemo ? edit.docDate || '' : '' };
    F.note = edit ? edit.note || '' : ''; // 2.34.0
    F.self = edit && edit.id ? edit.src === 'self' : !!B.selfPath; F.status = edit && edit.id ? edit.status : '';
    if (F.self && edit && edit.id) F.appr = { apprName: edit.apprName || '', apprPos: edit.apprPos || '', docNo: edit.docNo || '', docDate: edit.docDate || '' };
    document.getElementById('lvModalTitle').innerHTML = ic('fa-person-running') + ' ' + (edit && edit.id ? (F.self ? 'แก้ไขรายงานขอเวลาเรียน' : 'แก้ไขคำขอเวลาเรียน') : B.isAdmin ? 'ลงข้อมูลขอเวลาเรียน' : F.self ? 'รายงานขอเวลาเรียน (แนบหนังสือที่ลงนามแล้ว)' : 'ขอเวลาเรียนให้นักเรียน');
    var sendTxt = edit && edit.id ? (F.self && (F.status === 'suspended' || F.status === 'review') ? 'บันทึกการแก้ไข (ส่งให้ผู้ดูแลตรวจ)' : 'บันทึกการแก้ไข') : B.isAdmin ? 'บันทึก (อนุมัติทันที)' : F.self ? 'บันทึก (มีผลทันที)' : 'ส่งขออนุมัติ';
    document.getElementById('lvModalActs').innerHTML = '<button type="button" class="btn btn-ghost" data-rt-close>ยกเลิก</button><button type="button" class="btn btn-success" data-rt-send>' + ic(B.isAdmin || F.self ? 'fa-check' : 'fa-paper-plane') + ' ' + sendTxt + '</button>';
    renderForm(); showModalEl(modal);
    if (!STU) {
      try { STU = (await apiCall('rtStudents', {})).students || []; } catch (e) { STU = null; var pk = document.getElementById('rtPick'); if (pk) pk.innerHTML = err(e.message); return; }
      if (F) { var rs = document.getElementById('rtRoom'); if (rs) rs.innerHTML = roomOpts(); paintPick(); }
    }
  }
  function rooms() { var o = {}; (STU || []).forEach(function (s) { o[s.roomId] = s.room; }); return Object.keys(o).sort(function (a, b) { var x = /m(\d+)_(\d+)/.exec(a) || [0, 0, 0], y = /m(\d+)_(\d+)/.exec(b) || [0, 0, 0]; return x[1] - y[1] || x[2] - y[2]; }).map(function (k) { return [k, o[k]]; }); }
  function roomOpts() { return '<option value="">ทุกห้อง</option>' + rooms().map(function (r) { return '<option value="' + esc(r[0]) + '"' + (F.room === r[0] ? ' selected' : '') + '>' + esc(r[1]) + '</option>'; }).join(''); }
  function formRead() { if (!F) return; var ap = apprRead(modal); if (ap) F.appr = ap; var g = function (id) { var e = document.getElementById(id); return e ? e.value : null; }, v; if ((v = g('rtT')) !== null) F.title = v; if ((v = g('rtF')) !== null) F.from = v; if ((v = g('rtTo')) !== null) F.to = v; if ((v = g('rtTc')) !== null) F.teacherId = v; if ((v = g('rtNt')) !== null) F.note = v; }
  function renderForm() {
    var ws = B.weekStart;
    var h = '<div class="lv-f"><label class="lb" for="rtT">กิจกรรม / เหตุผล <span class="lv-req">*</span></label><input type="text" id="rtT" maxlength="200" placeholder="เช่น ซ้อมแข่งฟุตซอล รายการกีฬานักเรียน สพม.บึงกาฬ" value="' + esc(F.title) + '">' +
      (B.isAdmin ? '<label class="lb" for="rtTc">ครูผู้ควบคุม <span class="lv-opt">(ไม่บังคับ' + (B.showTeacher ? ' · แสดงในป้ายหน้าเช็คชื่อ' : ' · ตอนนี้ตั้งไม่แสดงในหน้าเช็คชื่อ') + ')</span></label><select id="rtTc"><option value="">— ไม่ระบุ —</option>' + (B.people || []).map(function (u) { return '<option value="' + esc(u.id) + '"' + (F.teacherId === u.id ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join('') + '</select>' : '') +
      '<label class="lb" for="rtNt">รายละเอียด ' + (F.self ? '<span class="lv-req">*</span>' : '<span class="lv-opt">(ไม่บังคับ)</span>') + '</label><textarea id="rtNt" rows="2" maxlength="500" placeholder="เช่น ซ้อมวอลเลย์บอลหญิง เพื่อแข่งกีฬานักเรียน สพม.บึงกาฬ ที่โรงเรียนบึงกาฬ">' + esc(F.note || '') + '</textarea>' + // 2.34.0
      (F.self || ((B.isAdmin || B.manage) && !F.editPending) ? apprPickHtml(F.appr) : '') +
      (F.self && (F.status === 'suspended' || F.status === 'review') ? '<p class="lv-note" style="margin:8px 0 0;color:#b45309">' + ic('fa-ban') + ' รายการนี้ถูกระงับ — บันทึกการแก้ไขแล้วจะขึ้นเป็น "รอผู้ดูแลตรวจ" และยังไม่มีผลจนกว่าผู้ดูแลจะยกเลิกการระงับ</p>' : '') +
      (F.memoId ? '<p class="lv-note" style="margin:8px 0 0">' + ic('fa-file-lines') + ' จากใบบันทึกข้อความของ ' + esc(F.ownerName || '') + ' — ตรวจรายชื่อ / วัน / คาบ ให้ตรงกับที่ผู้บริหารอนุมัติ</p>' : '') +
      '<div class="lv-row"><div><label class="lb" for="rtF">ตั้งแต่วันที่</label><input type="date" id="rtF" min="' + esc(ws) + '" value="' + esc(F.from) + '"></div><div><label class="lb" for="rtTo">ถึงวันที่</label><input type="date" id="rtTo" min="' + esc(ws) + '" value="' + esc(F.to) + '"></div></div>' +
      '<p class="lv-note" id="rtDays" style="margin:6px 0 0"></p>' +
      '<label class="lb">คาบ</label><div class="lv-types sm"><button type="button" data-rt-all' + (F.allDay ? ' class="on"' : '') + '>ทั้งวัน</button>' + B.periods.map(function (p) { return '<button type="button" data-rt-p="' + p + '"' + (!F.allDay && F.periods.indexOf(p) !== -1 ? ' class="on"' : '') + '>' + plabel(p) + '</button>'; }).join('') + '</div><p class="lv-note" style="margin:4px 0 0">A = เข้าแถว · B = โฮมรูม</p>' +
      '<label class="lb">นักเรียน <span class="mut" style="font-weight:500" id="rtCnt"></span></label>' +
      '<div class="lv-row"><div style="flex:0 0 150px;min-width:130px"><select id="rtRoom" aria-label="ห้อง">' + roomOpts() + '</select></div><div><input type="search" id="rtQ" placeholder="พิมพ์ชื่อ หรือเลขประจำตัว" value="' + esc(F.q) + '" autocomplete="off"></div></div>' +
      '<div class="rt-pick" id="rtPick"></div><div id="rtSel"></div>' +
      (F.self ? '<label class="lb">หนังสือขอเวลาเรียนที่ผู้บริหารลงนามแล้ว <span class="lv-req">*</span></label>' : '<label class="lb">หนังสือเชิญ / คำสั่ง <span class="lv-opt">(ถ้ามี)</span></label>') + '<div id="rtDoc"></div></div>';
    document.getElementById('lvModalBody').innerHTML = h; paintDays(); paintPick(); paintSel(); paintDoc();
  }
  function paintDays() {
    var e = document.getElementById('rtDays'); if (!e) return; var n = workdays(F.from, F.to || F.from);
    if (F.to && F.to < F.from) { e.innerHTML = '<span style="color:#b91c1c">วันที่สิ้นสุดต้องไม่ก่อนวันเริ่ม</span>'; return; }
    e.innerHTML = ic('fa-calendar-check') + ' ประมาณ <b>' + n + ' วันเรียน</b> (ไม่นับเสาร์-อาทิตย์ · หักวันหยุดในปฏิทินให้ตอนบันทึก)' + (F.from < B.today ? ' · <b style="color:#b45309">เริ่มก่อนวันนี้</b> — วันก่อนวันที่ยื่นขอ การเช็คชื่อที่ทำไปแล้วจะไม่ถูกแก้ · ขอย้อนได้ถึง ' + thD(B.weekStart) : '');
  }
  function paintPick() {
    var el = document.getElementById('rtPick'); if (!el) return;
    if (!STU) { el.innerHTML = '<div><span class="mut">' + ic('fa-spinner fa-spin') + ' กำลังโหลดรายชื่อนักเรียน...</span></div>'; return; }
    var q = F.q.trim().toLowerCase();
    if (!F.room && !q) { el.innerHTML = '<div><span class="mut">เลือกห้อง หรือพิมพ์ชื่อ / เลขประจำตัวเพื่อค้นหา</span></div>'; return; }
    var L = STU.filter(function (s) { return (!F.room || s.roomId === F.room) && (!q || (s.name + ' ' + s.code).toLowerCase().indexOf(q) !== -1); });
    var h = '';
    if (F.room && !q) { var left = L.filter(function (s) { return !F.sel[s.id]; }).length; h += '<div data-rt-hdr><i class="fa-solid fa-users" style="color:var(--primary)"></i><span>ทั้งห้อง ' + esc((L[0] || {}).room || '') + ' (' + L.length + ' คน)</span>' + (left ? '<button type="button" class="btn btn-secondary btn-sm" data-rt-addroom>เพิ่มทั้งห้อง</button>' : '<span class="rt-ok">เลือกครบแล้ว</span>') + '</div>'; }
    h += L.slice(0, 60).map(pickRow).join('');
    if (L.length > 60) h += '<div><span class="mut">แสดง 60 จาก ' + L.length + ' คน — พิมพ์เพิ่มเพื่อค้นให้แคบลง</span></div>';
    if (!L.length) h += '<div><span class="mut">ไม่พบนักเรียน</span></div>';
    el.innerHTML = h;
  }
  function pickRow(s) { var on = !!F.sel[s.id]; return '<div data-psid="' + esc(s.id) + '"' + (on ? ' class="on"' : '') + '>' + ic(on ? 'fa-circle-check' : 'fa-user') + '<span>' + esc(s.name) + ' <small>' + esc(s.room) + (s.code ? ' · ' + esc(s.code) : '') + '</small></span>' + (on ? '<button type="button" class="btn btn-ghost btn-sm" data-rt-rm="' + esc(s.id) + '">เอาออก</button>' : '<button type="button" class="btn btn-secondary btn-sm" data-rt-add="' + esc(s.id) + '">เพิ่ม</button>') + '</div>'; }
  // 2.34.0: เพิ่ม / เอาออกทีละคน = เปลี่ยนเฉพาะแถวนั้น (ไม่วาดทั้งรายการ — กันกระพริบ / เลื่อนหาย)
  function patchPick(ids) {
    var el = document.getElementById('rtPick'); if (!el || !STU) return;
    var hd = el.querySelector('[data-rt-hdr]'); if (hd) { paintPick(); return; } // ทั้งห้อง: ตัวนับ "เพิ่มทั้งห้อง" ต้องคำนวณใหม่ — วาดทั้งรายการ (scroll ยังอยู่)
    ids.forEach(function (id) { var row = el.querySelector('[data-psid="' + id + '"]'), s = STU.filter(function (x) { return x.id === id; })[0]; if (row && s) row.outerHTML = pickRow(s); });
  }
  function paintSel() {
    var el = document.getElementById('rtSel'); if (!el) return;
    var by = {}; F.order.forEach(function (id) { var s = F.sel[id]; if (s) (by[s.room] = by[s.room] || []).push(s); });
    var ks = Object.keys(by).sort(function (a, b) { return a.localeCompare(b, 'th', { numeric: true }); });
    el.innerHTML = ks.map(function (k) { return '<div class="rt-room">' + esc(k) + ' · ' + by[k].length + ' คน <button type="button" data-rt-rmroom="' + esc(k) + '">เอาออกทั้งห้อง</button></div><div class="rt-stu">' + by[k].map(function (s) { return '<span class="rt-chip">' + esc(s.name) + '<button type="button" data-rt-rm="' + esc(s.id) + '" aria-label="เอา ' + esc(s.name) + ' ออก">' + ic('fa-xmark') + '</button></span>'; }).join('') + '</div>'; }).join('');
    var c = document.getElementById('rtCnt'); if (c) c.textContent = '(เลือกแล้ว ' + Object.keys(F.sel).length + ' คน)';
  }
  function paintDoc() {
    var el = document.getElementById('rtDoc'); if (!el) return; var f = F.doc;
    el.innerHTML = '<div class="lv-drop' + (f ? ' ok' : '') + '">' + ic(f ? 'fa-circle-check' : 'fa-file-arrow-up') + '<div class="lv-dt">' + (f ? '<b>' + esc(f.name) + '</b><div class="lv-note">อัปโหลดแล้ว</div>' : F.self ? 'ถ่ายรูป หรือสแกนเป็น PDF (บังคับ)' : 'รูปหรือ PDF (ไม่บังคับ)') + '</div><button type="button" class="btn btn-secondary btn-sm" data-rt-doc>' + ic('fa-upload') + ' ' + (f ? 'เปลี่ยนไฟล์' : 'เลือกไฟล์') + '</button>' + (f ? '<button type="button" class="btn btn-ghost btn-sm" data-rt-docrm>เอาออก</button>' : '') + '</div>';
  }
  function addStu(s) { if (!F.sel[s.id]) { F.sel[s.id] = { id: s.id, name: s.name, roomId: s.roomId, room: s.room, code: s.code }; F.order.push(s.id); } }
  function rmStu(id) { delete F.sel[id]; F.order = F.order.filter(function (x) { return x !== id; }); }
  async function sendForm() {
    formRead(); if (F.busy) { showToast('กรุณารอให้อัปโหลดไฟล์เสร็จก่อน', true); return; }
    if (!F.title.trim()) { showToast('กรุณาใส่กิจกรรม / เหตุผล', true); return; }
    if (!F.from || (F.to && F.to < F.from)) { showToast('เลือกช่วงวันที่ให้ถูกต้อง', true); return; }
    if (F.from < B.weekStart) { showToast('ขอย้อนหลังได้ถึงวันจันทร์ของสัปดาห์นี้ (' + thD(B.weekStart) + ')', true); return; }
    if (!F.allDay && !F.periods.length) { showToast('กรุณาเลือกคาบ หรือเลือก "ทั้งวัน"', true); return; }
    var stu = F.order.map(function (id) { return F.sel[id]; }).filter(Boolean);
    if (!stu.length) { showToast('กรุณาเลือกนักเรียนอย่างน้อย 1 คน', true); return; }
    if ((F.self || ((B.isAdmin || B.manage) && !F.id)) && !(F.appr && F.appr.apprName)) { showToast('กรุณาเลือกผู้อนุมัติ (ตามหนังสือ)', true); return; }
    if (F.self && !(F.note || '').trim()) { showToast('กรุณาใส่รายละเอียด (ซ้อมอะไร / แข่งรายการอะไร)', true); return; } // 2.34.0
    if (F.self && !F.doc) { showToast('กรุณาแนบหนังสือที่ผู้บริหารลงนามแล้ว (รูปถ่าย / สแกน PDF)', true); return; }
    var p = { id: F.id, note: F.note || '', memoId: F.memoId || '', apprName: F.appr ? F.appr.apprName : '', apprPos: F.appr ? F.appr.apprPos : '', docNo: F.appr ? F.appr.docNo : '', docDate: F.appr ? F.appr.docDate : '', teacherId: F.teacherId || '', title: F.title, from: F.from, to: F.to || F.from, periods: F.allDay ? [] : F.periods, students: stu, doc: F.doc && F.doc.id && !F.keepDoc ? { id: F.doc.id } : null, keepDoc: F.keepDoc };
    hideModalEl(modal);
    var r = await withProgress(B.isAdmin || F.self ? 'กำลังบันทึกและส่งไปเว็บเช็คชื่อ' : 'กำลังส่งคำขอ', function () { return apiCall('rtSave', p); }, { successLabel: F.id ? (F.self && (F.status === 'suspended' || F.status === 'review') ? 'บันทึกแล้ว — รอผู้ดูแลตรวจ' : 'บันทึกการแก้ไขแล้ว') : B.isAdmin ? 'บันทึกแล้ว (อนุมัติแล้ว)' : F.self ? 'บันทึกแล้ว — มีผลกับหน้าเช็คชื่อแล้ว' : 'ส่งคำขอแล้ว — รอผู้ดูแลอนุมัติ' });
    if (!r.ok && (B.isAdmin || F.self) && !F.id && /เว็บเช็คชื่อ/.test((r.error && r.error.message) || '')) { F = null; reload(); return; } // บันทึกแล้วแต่ส่งไปเว็บเช็คชื่อไม่สำเร็จ = อยู่ในรออนุมัติ
    if (!r.ok) { showModalEl(modal); return; }
    F = null; reload();
  }
  fileIn.addEventListener('change', async function () {
    var f = fileIn.files && fileIn.files[0]; fileIn.value = ''; if (!f || !F) return;
    if (!/^image\/|pdf$/.test(f.type)) { showToast('แนบได้เฉพาะรูปภาพหรือ PDF', true); return; }
    formRead(); F.busy = true; hideModalEl(modal);
    var r = await withProgress('กำลังอัปโหลดไฟล์', async function () {
      var prep = await apiCall('rtUploadPrepare', { fileName: f.name, mimeType: f.type, fileSize: f.size, direct: 1, origin: location.origin });
      var res = await sendPreparedFile(prep, f, { filename: prep.uploadFileName || f.name, mimeType: f.type });
      return apiCall('leaveUploadFinalize', { evidenceId: prep.evidenceId, fileId: res.fileId, fileUrl: res.url, directUrl: res.directUrl, fileName: prep.uploadFileName || f.name, mimeType: f.type, via: res.via, fallbackReason: res.fallbackReason || '' });
    }, { upload: true, successLabel: 'อัปโหลดแล้ว' });
    F.busy = false; if (r.ok) { F.doc = r.data; F.keepDoc = false; } renderForm(); showModalEl(modal);
  });
  function find(id) { return [].concat(D.mine || [], D.pending || [], D.all ? D.all.items : [], D.appr ? D.appr.items : []).filter(function (x) { return x.id === id; })[0] || null; }
  async function viewList(id) {
    var d; try { d = (await apiCall('rtDetail', { id: id })).item; } catch (e) { showToast(e.message, true); return; }
    var m = document.createElement('div'); m.className = 'modal-backdrop'; m.hidden = true;
    m.innerHTML = '<div class="modal-box" style="text-align:left;max-width:560px"><button type="button" class="modal-close-x" data-x aria-label="ปิด">✕</button><h3>' + ic('fa-users') + ' ' + esc(d.title) + '</h3><p class="lv-note">' + thRange(d.from, d.to) + ' · ' + perTxt(d.periods) + ' · ' + d.n + ' คน' + (d.teacherName ? ' · ครูผู้ควบคุม ' + esc(d.teacherName) : '') + '</p>' + (d.apprName ? '<p class="lv-note" style="margin-top:-6px">' + ic('fa-signature') + ' อนุมัติโดย ' + esc(d.apprName) + (d.apprPos ? ' ' + esc(d.apprPos) : '') + ' (ตามหนังสือ)' + (d.docNo ? ' · หนังสือที่ ' + esc(d.docNo) : '') + '</p>' : '') + (d.note ? '<p class="lv-note" style="margin-top:-6px">' + ic('fa-align-left') + ' ' + esc(d.note) + '</p>' : '') + (d.doc ? '<p style="margin:0 0 8px">' + docChip(d.doc, 'fa-file-lines') + '</p>' : '') + '<div style="max-height:55vh;overflow:auto"><table class="rt-tb"><thead><tr><th>#</th><th>นักเรียน</th><th>ห้อง</th></tr></thead><tbody>' + (d.students || []).map(function (s, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(s.name) + '</td><td>' + esc(s.room) + '</td></tr>'; }).join('') + '</tbody></table></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-x>ปิด</button></div></div>';
    document.body.appendChild(m); showModalEl(m);
    m.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) { hideModalEl(m); setTimeout(function () { m.remove(); }, 300); } });
  }
  // 2.34.0: ระงับ (ใส่เหตุผล) · ประวัติรายการ
  function suspendAsk(x) {
    var m = document.createElement('div'); m.className = 'modal-backdrop'; m.hidden = true;
    m.innerHTML = '<div class="modal-box" style="text-align:left"><button type="button" class="modal-close-x" data-x aria-label="ปิด">✕</button><h3>' + ic('fa-ban') + ' ระงับรายการ</h3><p>' + esc(x.byName) + ' · ' + esc(x.title) + '</p><p class="lv-note">สิทธิ์ "ร่วมกิจกรรม" ในหน้าเช็คชื่อหยุดทันที · คาบที่ระบบเปลี่ยนจาก "ขาด" เป็นร่วมกิจกรรมให้ จะกลับเป็น "ขาด" (คาบที่ครูประจำวิชาบันทึกเองไม่เปลี่ยน) · ครูได้กระดิ่งพร้อมเหตุผล</p><label class="lv-note" for="rtSr">เหตุผล (ครูเจ้าของรายการจะเห็น)</label><input type="text" id="rtSr" maxlength="300" style="width:100%;box-sizing:border-box"><div class="modal-actions"><button type="button" class="btn btn-ghost" data-x>ยกเลิก</button><button type="button" class="btn btn-danger" data-ok>' + ic('fa-ban') + ' ระงับ</button></div></div>';
    document.body.appendChild(m); showModalEl(m); setTimeout(function () { var i = document.getElementById('rtSr'); if (i) i.focus(); }, 50);
    m.addEventListener('click', async function (e) {
      if (e.target.closest('[data-x]')) { hideModalEl(m); setTimeout(function () { m.remove(); }, 300); return; }
      if (!e.target.closest('[data-ok]')) return;
      var why = document.getElementById('rtSr').value.trim(); if (!why) { showToast('กรุณาใส่เหตุผล', true); return; }
      hideModalEl(m); setTimeout(function () { m.remove(); }, 300);
      var r = await withProgress('กำลังระงับ', function () { return apiCall('rtSuspend', { id: x.id, reason: why }); }, { successLabel: 'ระงับแล้ว (แจ้งครูทางกระดิ่ง)' });
      if (r.ok) reload();
    });
  }
  function histShow(x) {
    var m = document.createElement('div'); m.className = 'modal-backdrop'; m.hidden = true; var H = { create: 'ลงข้อมูล', edit: 'แก้ไข', suspend: 'ระงับ', unsuspend: 'ยกเลิกการระงับ', review: 'แก้ไขหลังถูกระงับ (รอตรวจ)' };
    m.innerHTML = '<div class="modal-box" style="text-align:left;max-width:520px"><button type="button" class="modal-close-x" data-x aria-label="ปิด">✕</button><h3>' + ic('fa-clock-rotate-left') + ' ประวัติรายการ</h3><p class="lv-note">' + esc(x.title) + '</p><div class="rt-hist">' + (x.hist || []).slice().reverse().map(function (h) { return '<div><b>' + esc(H[h.a] || h.a) + '</b> · ' + esc(h.by || '-') + ' · ' + thTime(h.at) + (h.t ? '<div class="lv-note">' + esc(h.t) + '</div>' : '') + '</div>'; }).join('') + '</div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-x>ปิด</button></div></div>';
    document.body.appendChild(m); showModalEl(m);
    m.addEventListener('click', function (e) { if (e.target.closest('[data-x]')) { hideModalEl(m); setTimeout(function () { m.remove(); }, 300); } });
  }
  function rejectAsk(x) {
    var m = document.createElement('div'); m.className = 'modal-backdrop'; m.hidden = true;
    m.innerHTML = '<div class="modal-box" style="text-align:left"><button type="button" class="modal-close-x" data-x aria-label="ปิด">✕</button><h3>' + ic('fa-xmark') + ' ไม่อนุมัติ</h3><p>' + esc(x.byName) + ' · ' + esc(x.title) + '</p><label class="lv-note" for="rtRj">เหตุผล (ครูผู้ขอจะเห็นข้อความนี้)</label><input type="text" id="rtRj" maxlength="300" style="width:100%;box-sizing:border-box"><div class="modal-actions"><button type="button" class="btn btn-ghost" data-x>ยกเลิก</button><button type="button" class="btn btn-danger" data-ok>' + ic('fa-xmark') + ' ไม่อนุมัติ</button></div></div>';
    document.body.appendChild(m); showModalEl(m); setTimeout(function () { var i = document.getElementById('rtRj'); if (i) i.focus(); }, 50);
    m.addEventListener('click', async function (e) {
      if (e.target.closest('[data-x]')) { hideModalEl(m); setTimeout(function () { m.remove(); }, 300); return; }
      if (!e.target.closest('[data-ok]')) return;
      var why = document.getElementById('rtRj').value.trim(); if (!why) { showToast('กรุณาใส่เหตุผล', true); return; }
      hideModalEl(m); setTimeout(function () { m.remove(); }, 300);
      var r = await withProgress('กำลังบันทึก', function () { return apiCall('rtDecide', { id: x.id, approve: false, reason: why }); }, { successLabel: 'บันทึกแล้ว (แจ้งครูผู้ขอทางกระดิ่ง)' });
      if (r.ok) reload();
    });
  }

  // ---------- เหตุการณ์ ----------
  document.addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-rt-tab]'))) { st.tab = t.getAttribute('data-rt-tab'); show(); return; }
    if (e.target.closest('[data-rt-close]') || (e.target.closest('#lvModal .modal-close-x'))) { hideModalEl(modal); F = null; return; }
    if (e.target.closest('[data-rt-new]')) { openForm(); return; }
    if (F && modal.contains(e.target)) {
      if (e.target.closest('[data-rt-all]')) { F.allDay = !F.allDay; if (F.allDay) F.periods = []; modal.querySelectorAll('[data-rt-p]').forEach(function (b) { b.classList.remove('on'); }); e.target.closest('[data-rt-all]').classList.toggle('on', F.allDay); return; }
      if ((t = e.target.closest('[data-rt-p]'))) { var p = +t.getAttribute('data-rt-p'), i = F.periods.indexOf(p); if (i === -1) F.periods.push(p); else F.periods.splice(i, 1); F.periods.sort(function (a, b) { return a - b; }); F.allDay = false; t.classList.toggle('on', i === -1); var ab = modal.querySelector('[data-rt-all]'); if (ab) ab.classList.remove('on'); return; }
      if ((t = e.target.closest('[data-rt-add]'))) { var s = STU.filter(function (x) { return x.id === t.getAttribute('data-rt-add'); })[0]; if (s) addStu(s); patchPick([t.getAttribute('data-rt-add')]); paintSel(); return; }
      if (e.target.closest('[data-rt-addroom]')) { STU.filter(function (x) { return x.roomId === F.room; }).forEach(addStu); paintPick(); paintSel(); return; }
      if ((t = e.target.closest('[data-rt-rm]'))) { rmStu(t.getAttribute('data-rt-rm')); patchPick([t.getAttribute('data-rt-rm')]); paintSel(); return; }
      if ((t = e.target.closest('[data-rt-rmroom]'))) { var rn = t.getAttribute('data-rt-rmroom'); F.order.slice().forEach(function (id) { if (F.sel[id] && F.sel[id].room === rn) rmStu(id); }); paintPick(); paintSel(); return; }
      if (e.target.closest('[data-rt-doc]')) { fileIn.click(); return; }
      if (e.target.closest('[data-rt-docrm]')) { F.doc = null; F.keepDoc = false; paintDoc(); return; }
      if (e.target.closest('[data-rt-send]')) { sendForm(); return; }
      return;
    }
    if ((t = e.target.closest('[data-rt-more]'))) { var id0 = t.getAttribute('data-rt-more'); (EXC[id0] = EXC[id0] || {}).__open = 1; body._h = ''; showPending(); return; }
    if ((t = e.target.closest('[data-rt-view]'))) { viewList(t.getAttribute('data-rt-view')); return; }
    if ((t = e.target.closest('[data-rt-meta]'))) { var xm = find(t.getAttribute('data-rt-meta')); if (xm) metaAsk(xm); return; } // 2.33.0
    if ((t = e.target.closest('[data-rt-frommemo]'))) { openFromMemo(t.getAttribute('data-rt-frommemo')); return; }
    if (e.target.closest('[data-rt-resync]')) { if (!(await askConfirm('ส่งข้อมูลรายการที่อนุมัติแล้ว (ย้อนหลัง 200 วัน) ให้เว็บเช็คชื่ออีกครั้ง?<br>ไม่แตะการเช็คชื่อที่ทำไปแล้ว', 'ส่งข้อมูลให้เว็บเช็คชื่อ'))) return; var rr = await withProgress('กำลังส่งข้อมูล', function () { return apiCall('rtResync', {}); }, { successLabel: 'ส่งแล้ว' }); if (rr.ok) showToast('ส่งแล้ว ' + rr.data.n + ' รายการ'); return; }
    if ((t = e.target.closest('[data-rt-edit]'))) { var dd; try { dd = (await apiCall('rtDetail', { id: t.getAttribute('data-rt-edit') })).item; } catch (x2) { showToast(x2.message, true); return; } openForm(dd); return; }
    if ((t = e.target.closest('[data-rt-ok]'))) {
      var x = find(t.getAttribute('data-rt-ok')); if (!x) return;
      var ex = Object.keys(EXC[x.id] || {}).filter(function (k) { return k !== '__open'; });
      if (!(await askConfirm('อนุมัติ <b>' + esc(x.title) + '</b><br>' + thRange(x.from, x.to) + ' · ' + perTxt(x.periods) + '<br>นักเรียน ' + (x.n - ex.length) + ' คน' + (ex.length ? ' (ไม่อนุมัติ ' + ex.length + ' คน)' : '') + '<br>หน้าเช็คชื่อจะเลือก "ร่วมกิจกรรม" ให้ · คาบที่เช็คว่าขาดไปแล้วตั้งแต่วันที่ยื่นขอจะเปลี่ยนให้', 'อนุมัติขอเวลาเรียน'))) return;
      var r = await withProgress('กำลังอนุมัติและส่งไปเว็บเช็คชื่อ', function () { return apiCall('rtDecide', { id: x.id, approve: true, exclude: ex }); }, { successLabel: 'อนุมัติแล้ว' });
      if (r.ok) { delete EXC[x.id]; reload(); }
      return;
    }
    if ((t = e.target.closest('[data-rt-no]'))) { var y = find(t.getAttribute('data-rt-no')); if (y) rejectAsk(y); return; }
    if ((t = e.target.closest('[data-rt-susp]'))) { var ys = find(t.getAttribute('data-rt-susp')); if (ys) suspendAsk(ys); return; } // 2.34.0
    if ((t = e.target.closest('[data-rt-hist]'))) { var yh = find(t.getAttribute('data-rt-hist')); if (yh) histShow(yh); return; }
    if ((t = e.target.closest('[data-rt-unsusp]'))) {
      var yu = find(t.getAttribute('data-rt-unsusp')); if (!yu) return;
      if (!(await askConfirm('ยกเลิกการระงับ <b>' + esc(yu.title) + '</b>?<br>รายการกลับมามีผล — หน้าเช็คชื่อเลือก "ร่วมกิจกรรม" ให้อีกครั้ง · ครูได้กระดิ่ง', 'ยกเลิกการระงับ'))) return;
      var ru = await withProgress('กำลังบันทึกและส่งไปเว็บเช็คชื่อ', function () { return apiCall('rtUnsuspend', { id: yu.id }); }, { successLabel: 'ยกเลิกการระงับแล้ว' });
      if (ru.ok) reload(); return;
    }
    if ((t = e.target.closest('[data-rt-cancel]'))) {
      var z = find(t.getAttribute('data-rt-cancel')); if (!z) return; var mineP = z.by === B.me.id && z.status === 'pending' && z.src !== 'self';
      if (!(await askConfirm((mineP ? 'ยกเลิกคำขอ' : 'ลบรายการ') + ' <b>' + esc(z.title) + '</b>' + (z.status === 'approved' ? '<br>คาบที่ระบบเปลี่ยนเป็น "ร่วมกิจกรรม" ให้ จะกลับเป็น "ขาด" (เฉพาะที่ครูยังไม่ได้แก้)' : ''), mineP ? 'ยกเลิกคำขอ' : 'ลบรายการ'))) return;
      var rc = await withProgress('กำลังลบ', function () { return apiCall('rtCancel', { id: z.id }); }, { successLabel: 'ลบแล้ว' });
      if (rc.ok) reload();
      return;
    }
    if ((t = e.target.closest('[data-rt-rg]'))) { st.range = t.getAttribute('data-rt-rg'); if (st.range === 'custom' && !st.from) { st.from = B.today.slice(0, 8) + '01'; st.to = B.today; } if (st.tab === 'approved') showApproved(); else showAll(); return; }
    if (e.target.closest('[data-rt-xlsx]')) { exportXlsx(); return; }
    if (e.target.closest('[data-rt-save]')) {
      var rs = await withProgress('กำลังบันทึก', function () { return apiCall('rtCfgSave', { skipAbsent: +document.getElementById('rtSkip').value || 2, showTeacher: document.getElementById('rtShowT').checked }); }, { successLabel: 'บันทึกแล้ว' });
      if (rs.ok) { B.skipAbsent = rs.data.skipAbsent; B.showTeacher = rs.data.showTeacher; body._h = ''; showSettings(); }
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (F && modal.contains(t)) {
      if (t.id === 'rtRoom') { F.room = t.value; paintPick(); return; }
      if (t.id === 'rtAp') { var cc = modal.querySelector('#rtApC'); if (cc) cc.hidden = t.value !== 'custom'; formRead(); return; } // 2.33.0
      formRead(); if (t.id === 'rtF' && (!F.to || F.to < F.from)) { F.to = F.from; var te = document.getElementById('rtTo'); if (te) te.value = F.to; } paintDays(); return;
    }
    if (t.matches('[data-rt-ex]')) { var id = t.getAttribute('data-rt-ex'), sid = t.getAttribute('data-sid'), ex = (EXC[id] = EXC[id] || {}); if (t.checked) delete ex[sid]; else ex[sid] = 1; var tr = t.closest('tr'); if (tr) tr.classList.toggle('off', !t.checked); var x = find(id), btn = body.querySelector('[data-rt-ok="' + id + '"]'); if (x && btn) btn.innerHTML = ic('fa-check') + ' อนุมัติ ' + (x.n - Object.keys(ex).filter(function (k) { return k !== '__open'; }).length) + ' คน'; body._h = ''; return; } // เปลี่ยนเฉพาะแถวนั้น (ไม่วาดใหม่ทั้งหน้า)
    if (t.id === 'rtAf' || t.id === 'rtAt') { st.from = document.getElementById('rtAf').value; st.to = document.getElementById('rtAt').value; if (st.from && st.to && st.to >= st.from) { if (st.tab === 'approved') showApproved(); else showAll(); } }
    if (t.id === 'rtTView') { var on = t.checked; withProgress('กำลังบันทึก', function () { return apiCall('rtCfgSave', { teacherView: on }); }, { successLabel: on ? 'เปิดให้ครูดูแล้ว' : 'ปิดแล้ว' }).then(function (r) { if (r.ok) B.teacherView = r.data.teacherView; else t.checked = !on; }); }
  });
  document.addEventListener('input', debounce(function (e) { if (F && e.target.id === 'rtQ') { F.q = e.target.value; paintPick(); } if (e.target.id === 'rtSq') { st.q = e.target.value.trim(); st.qFocus = true; showApproved(); } }, 350));
  boot();
})();
