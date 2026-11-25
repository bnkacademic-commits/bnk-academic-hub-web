/* 2.33.0: หน้า "บันทึกข้อความ" (memo.html)
 * แท็บ: เขียน · บันทึกข้อความของฉัน · แม่แบบ (Super Admin / แอดมินระบบ / เจ้าหน้าที่กลุ่มบริหารงาน) · ตั้งค่า (Super Admin)
 * แม่แบบ "รายงานการส่งงาน" = ของเดิม (แนบผลงานที่ส่งแล้ว + QR) · แม่แบบอื่นวาดด้วย MT (assets/memotpl.js) */
(function () {
  var session = requireLogin();
  if (!session) return;
  if (session.role === 'intern') { location.replace(homePageFor(session)); return; }
  mountChrome('memo'); if (typeof mountFooter === 'function') mountFooter();

  var B = null, ST = {}, ME = {}, TAB = 'write', BLANK = false;
  var cur = null;           // แม่แบบที่เลือก { id, kind: 'report'|'reqtime'|'custom', name, dept, def }
  var docId = '', docTitle = '';
  var F = { values: {}, students: [], rows: [], docNo: '', docDate: '', dept: '', periods: [], allDay: true };
  var STU = null, pickRoom = '', pickQ = '';
  var paper = document.getElementById('memoPaper'), outer = document.getElementById('mmPaperOuter');
  function $(id) { return document.getElementById(id); }
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function ic(n) { return '<i class="fas ' + n + '" aria-hidden="true"></i>'; }
  function todayYmd() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function gl(d) { return d ? (typeof groupLabel === 'function' ? groupLabel(d) : 'กลุ่มบริหารงาน' + d) : 'ใช้ได้ทุกกลุ่มบริหารงาน'; }
  function plabel(p) { return Number(p) === -2 ? 'A' : Number(p) === 0 ? 'B' : String(p); }
  var PERIODS = [-2, 0, 1, 2, 3, 4, 5, 6, 7, 8];

  // ---------- ย่อกระดาษให้พอดีจอ (มือถือ) ----------
  function fitPaper() { paper.style.zoom = ''; var avail = outer.clientWidth - 16, w = paper.offsetWidth; if (w > 0 && avail > 0 && avail < w) paper.style.zoom = String(Math.max(0.3, avail / w)); }
  window.addEventListener('resize', fitPaper);
  window.addEventListener('beforeprint', function () { paper.style.zoom = ''; });
  window.addEventListener('afterprint', function () { if (BLANK) { BLANK = false; renderPaper(); } fitPaper(); });

  // =====================================================================
  // แม่แบบ "รายงานการส่งงาน" (ของเดิม 1.25–1.28)
  // =====================================================================
  var RP = { subs: [], checked: {}, subjects: [], depts: [], subjectTouched: false, bodyTouched: false, ready: false };
  var CUSTOM_SUBJECT_VALUE = '__custom__';
  function rpTpl() { var sel = $('memoSubjectSelect'); if (!sel || sel.value === CUSTOM_SUBJECT_VALUE || !sel.value) return null; return RP.subjects.filter(function (m) { return m.id === sel.value; })[0] || null; }
  function rpDept() { var t = rpTpl(); if (t) return t.department || ''; var d = $('memoDeptSelect'); return d ? d.value : ''; }
  (function fillYearOptions() { var beYear = new Date().getFullYear() + 543, sel = $('memoYear'); for (var y = beYear + 2; y >= beYear - 3; y--) { var o = document.createElement('option'); o.value = y; o.textContent = 'ปีการศึกษา ' + y; if (y === beYear) o.selected = true; sel.appendChild(o); } })();
  function rpSelected() {
    var year = $('memoYear').value, sem = $('memoSemester').value;
    var items = RP.subs.filter(function (s) { return String(s.academicYear) === String(year) && s.semester === sem; });
    var t = rpTpl(); if (t) items = items.filter(function (s) { return t.categoryIds.indexOf(s.categoryId) !== -1; });
    return items;
  }
  function rpChecked() { return rpSelected().filter(function (s) { return RP.checked[s.id] !== false; }); }
  function termLabelOf(sem) { return sem === 'summer' ? 'ภาคฤดูร้อน' : 'ภาคเรียนที่ ' + sem; }
  function rpDefault() {
    var termText = termLabelOf($('memoSemester').value) + ' ปีการศึกษา ' + $('memoYear').value, t = rpTpl();
    if (t) return { subject: t.subject, body: t.defaultBody || ('ข้าพเจ้าได้จัดทำและส่งผลงาน/เอกสารตามหัวเรื่องนี้ ประจำ' + termText + ' เรียบร้อยแล้ว จำนวน {N} รายการ ดังรายละเอียดที่แนบมาพร้อมนี้ จึงเรียนมาเพื่อโปรดทราบและพิจารณา') };
    return { subject: 'รายงานการส่งผลงาน/เอกสารการปฏิบัติงาน ประจำ' + termText, body: 'ข้าพเจ้าได้จัดทำและส่งผลงาน/เอกสารตามที่ได้รับมอบหมาย ประจำ' + termText + ' เรียบร้อยแล้ว จำนวน {N} รายการ ดังรายละเอียดที่แนบมาพร้อมนี้ จึงเรียนมาเพื่อโปรดทราบและพิจารณา' };
  }
  function rpBodyWithCount() { return rpDefault().body.replace('{N}', String(rpChecked().length)); }
  function rpRenderItems() {
    var wrap = $('memoItemsList'), items = rpSelected();
    if (!items.length) { wrap.innerHTML = '<div class="empty-state">ยังไม่มีผลงานที่ส่งแล้วในภาคเรียนนี้</div>'; renderPaper(); return; }
    wrap.innerHTML = '<div>' + items.map(function (s) {
      return '<label class="event-list-item" style="cursor:pointer;"><input type="checkbox" class="memo-item-check" data-id="' + esc(s.id) + '" ' + (RP.checked[s.id] !== false ? 'checked' : '') + ' style="width:auto; flex-shrink:0; margin-right:10px;" />' +
        '<div style="flex:1 1 220px; min-width:220px;"><div class="sub-item-title">' + esc(s.title || s.fileName) + '</div><div class="sub-item-meta">' + esc(s.categoryName) + ' · ส่งเมื่อ ' + formatDateThai(s.uploadedAt) + '</div></div></label>';
    }).join('') + '</div>';
    wrap.querySelectorAll('.memo-item-check').forEach(function (chk) { chk.addEventListener('change', function () { RP.checked[chk.getAttribute('data-id')] = chk.checked; renderPaper(); }); });
    renderPaper();
  }
  async function rpInit() {
    if (RP.ready) return; RP.ready = true;
    $('memoDate').value = todayYmd();
    try { RP.subs = await apiCall('teacherListMine', {}); } catch (err) { $('memoItemsList').innerHTML = '<div class="error-box">' + esc(err.message) + '</div>'; }
    var term = await currentAcademicTerm(); $('memoYear').value = term.year; $('memoSemester').value = term.semester;
    RP.depts = ST.departments || [];
    try { RP.subjects = await apiCall('hubListMemoSubjects', {}); } catch (err) { RP.subjects = []; }
    var sel = $('memoSubjectSelect');
    sel.innerHTML = RP.subjects.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.subject) + ' (' + esc(gl(m.department)) + ')</option>'; }).join('') + '<option value="' + CUSTOM_SUBJECT_VALUE + '">พิมพ์เอง (ระบุหัวเรื่องเอง)</option>';
    sel.value = RP.subjects.length ? RP.subjects[0].id : CUSTOM_SUBJECT_VALUE;
    $('memoCustomDeptWrap').hidden = sel.value !== CUSTOM_SUBJECT_VALUE;
    $('memoDeptSelect').innerHTML = RP.depts.length ? RP.depts.map(function (d) { return '<option value="' + esc(d) + '">' + esc(gl(d)) + '</option>'; }).join('') : '<option value="">— ยังไม่มีกลุ่มบริหารงานในระบบ —</option>';
    var d = rpDefault(); $('memoSubject').value = d.subject; $('memoBody').value = d.body.replace('{N}', String(rpSelected().length));
    $('memoTo').value = ST.schoolName ? ('ผู้อำนวยการ' + ST.schoolName) : 'ผู้อำนวยการโรงเรียน';
  }
  $('memoSubject').addEventListener('input', function () { RP.subjectTouched = true; renderPaperD(); });
  $('memoBody').addEventListener('input', function () { RP.bodyTouched = true; renderPaperD(); });
  ['memoTo', 'memoNumber', 'memoDate'].forEach(function (id) { $(id).addEventListener('input', function () { renderPaperD(); }); });
  ['memoYear', 'memoSemester'].forEach(function (id) { $(id).addEventListener('change', function () { if (!RP.subjectTouched) $('memoSubject').value = rpDefault().subject; if (!RP.bodyTouched) $('memoBody').value = rpBodyWithCount(); rpRenderItems(); }); });
  $('memoSubjectSelect').addEventListener('change', function () { $('memoCustomDeptWrap').hidden = this.value !== CUSTOM_SUBJECT_VALUE; RP.subjectTouched = RP.bodyTouched = false; $('memoSubject').value = rpDefault().subject; $('memoBody').value = rpBodyWithCount(); rpRenderItems(); });
  $('memoDeptSelect').addEventListener('change', function () { renderPaper(); });
  function rpPaper() {
    var items = rpChecked(), number = $('memoNumber').value.trim(), dateVal = $('memoDate').value;
    var dateThai = dateVal ? MT.thD(dateVal) : MT.thD(todayYmd());
    var subject = $('memoSubject').value.trim(), toWhom = $('memoTo').value.trim(), body = $('memoBody').value.trim();
    var schoolLine = [ST.schoolName, ST.schoolDistrict, ST.schoolProvince].filter(Boolean).join(' ');
    var qrUrl = location.origin + location.pathname.replace(/memo\.html$/, '') + 'view.html?u=' + encodeURIComponent(ME.username || '');
    var dept = rpDept(), ds = (ST.departmentSigners && ST.departmentSigners[dept]) || {};
    var headPos = ds.headPosition || (dept ? 'หัวหน้า' + gl(dept) : 'หัวหน้ากลุ่มบริหารงานที่เกี่ยวข้อง'), depPos = ds.deputyPosition || (dept ? 'รองผู้อำนวยการ' + gl(dept) : 'รองผู้อำนวยการกลุ่มบริหารงานที่เกี่ยวข้อง');
    var DOT = '.................................................', SP = '<span class="memo-dotted">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>';
    var rows = items.map(function (s, i) { return '<tr><td class="memo-no">' + (i + 1) + '</td><td>' + esc(s.title || s.fileName) + '</td><td>' + esc(s.categoryName) + '</td><td>' + formatDateThai(s.uploadedAt) + '</td></tr>'; }).join('');
    var h = '<div class="memo-head"><img src="assets/garuda-emblem.png" alt="" /><h1>บันทึกข้อความ</h1></div>';
    h += '<div class="memo-line"><b>ส่วนราชการ</b>&nbsp;&nbsp;' + esc(schoolLine || DOT) + '</div>';
    h += '<div class="memo-row"><div><b>ที่</b>&nbsp;&nbsp;' + (number ? esc(number) : '<span class="memo-dotted" style="min-width:150px">&nbsp;</span>') + '</div><div><b>วันที่</b>&nbsp;&nbsp;' + esc(dateThai) + '</div></div>';
    h += '<div class="memo-line memo-subj"><b>เรื่อง</b>&nbsp;&nbsp;' + esc(subject) + '</div><div class="memo-line"><b>เรียน</b>&nbsp;&nbsp;' + esc(toWhom) + '</div>';
    h += '<div class="memo-line memo-indent">ด้วยข้าพเจ้า ' + esc(ME.name) + ' ตำแหน่ง ' + (ME.position ? esc(ME.position) : '<span class="memo-dotted">&nbsp;</span>') + ' กลุ่มสาระการเรียนรู้' + (ME.subjectGroup ? esc(ME.subjectGroup) : '<span class="memo-dotted">&nbsp;</span>') + '</div>';
    h += '<div class="memo-line memo-indent">' + esc(body) + '</div>';
    h += items.length ? '<table class="memo-table"><thead><tr><th>ที่</th><th>ชื่อผลงาน/เอกสาร</th><th>ประเภทงาน</th><th>วันที่ส่ง</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p style="margin:10px 0;">(ยังไม่ได้เลือกรายการที่จะแนบ)</p>';
    if (items.length) h += '<div class="memo-qr-box"><div id="memoQrBox"></div><div class="memo-qr-caption">สแกนเพื่อดูผลงานทั้งหมดของ ' + esc(ME.name) + ' ทางออนไลน์</div></div>';
    h += '<div class="memo-sign-block"><div class="memo-sign-line">ลงชื่อ' + DOT + '</div><div class="memo-sign-line">(' + esc(ME.name) + ')</div><div class="memo-sign-line">ตำแหน่ง ' + esc(ME.position || DOT) + '</div></div>';
    function appr(title, line, name, pos) { return '<div class="memo-approval"><div class="memo-approval-title">' + esc(title) + '</div><div class="memo-checkbox-line">' + line + SP + '</div><div class="memo-sign-block"><div class="memo-sign-line">ลงชื่อ' + DOT + '</div><div class="memo-sign-line">(' + esc(name || DOT) + ')</div><div class="memo-sign-line">ตำแหน่ง ' + esc(pos) + '</div></div></div>'; }
    h += appr('ความคิดเห็นของ' + headPos, '(&nbsp;&nbsp;&nbsp;) เห็นควรรายงานต่อ &nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;&nbsp;) เห็นควรให้แก้ไขเพิ่มเติม เนื่องจาก', ds.headName, headPos);
    h += appr('ความคิดเห็นของ' + depPos, '(&nbsp;&nbsp;&nbsp;) เห็นควรอนุมัติ &nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;&nbsp;) เห็นควรไม่อนุมัติ เนื่องจาก', ds.deputyName, depPos);
    h += appr('ความคิดเห็นของผู้อำนวยการโรงเรียน', '(&nbsp;&nbsp;&nbsp;) อนุมัติ &nbsp;&nbsp;&nbsp;(&nbsp;&nbsp;&nbsp;) ไม่อนุมัติ เนื่องจาก', ST.memoDirectorName, ST.memoDirectorPosition || 'ผู้อำนวยการโรงเรียน');
    paper.innerHTML = h;
    if (items.length && window.QRCode) { var qb = $('memoQrBox'); if (qb) new QRCode(qb, { text: qrUrl, width: 96, height: 96 }); }
  }
  function rpData() {
    var un = {}; Object.keys(RP.checked).forEach(function (k) { if (RP.checked[k] === false) un[k] = 1; });
    return { year: $('memoYear').value, semester: $('memoSemester').value, subj: $('memoSubjectSelect').value, dept: $('memoDeptSelect').value, number: $('memoNumber').value, date: $('memoDate').value, subject: $('memoSubject').value, to: $('memoTo').value, body: $('memoBody').value, unchecked: Object.keys(un) };
  }
  function rpLoad(d) {
    $('memoYear').value = d.year || $('memoYear').value; $('memoSemester').value = d.semester || $('memoSemester').value;
    if (d.subj && $('memoSubjectSelect').querySelector('option[value="' + CSS.escape(d.subj) + '"]')) $('memoSubjectSelect').value = d.subj;
    $('memoCustomDeptWrap').hidden = $('memoSubjectSelect').value !== CUSTOM_SUBJECT_VALUE; if (d.dept) $('memoDeptSelect').value = d.dept;
    $('memoNumber').value = d.number || ''; $('memoDate').value = d.date || todayYmd(); $('memoSubject').value = d.subject || ''; $('memoTo').value = d.to || ''; $('memoBody').value = d.body || '';
    RP.subjectTouched = RP.bodyTouched = true; RP.checked = {}; (d.unchecked || []).forEach(function (k) { RP.checked[k] = false; });
    rpRenderItems();
  }

  // =====================================================================
  // แม่แบบที่ฝ่ายสร้าง
  // =====================================================================
  function ctxOf(blank) {
    return { me: ME, settings: ST, schoolName: ST.schoolName || '', values: F.values, students: F.students, rows: F.rows, docNo: F.docNo, docDate: F.docDate,
      dept: cur && cur.def.deptPick ? F.dept : (cur ? cur.dept : ''), today: todayYmd(), blank: !!blank };
  }
  function linkOf() { return cur && cur.def && cur.def.link && cur.def.link.type === 'reqtime' ? cur.def.link : null; }
  function fieldInput(f) {
    var v = F.values[f.name], id = 'mf_' + encodeURIComponent(f.name).replace(/%/g, '_'), lab = '<label for="' + id + '">' + esc(f.name) + '</label>';
    if (f.type === 'range') { v = v || {}; return '<div class="field-row"><div class="field"><label for="' + id + '">' + esc(f.name) + ' ตั้งแต่</label><input type="date" id="' + id + '" data-fr="' + esc(f.name) + '" data-k="from" value="' + esc(v.from || '') + '"></div><div class="field"><label for="' + id + 'b">ถึง</label><input type="date" id="' + id + 'b" data-fr="' + esc(f.name) + '" data-k="to" value="' + esc(v.to || '') + '"></div></div>'; }
    if (f.type === 'long') return '<div class="field">' + lab + '<textarea id="' + id + '" rows="6" data-f="' + esc(f.name) + '" placeholder="ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่">' + esc(v || '') + '</textarea></div>';
    if (f.type === 'select') return '<div class="field">' + lab + '<select id="' + id + '" data-f="' + esc(f.name) + '"><option value="">— เลือก —</option>' + f.opts.map(function (o) { return '<option' + (o === v ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('') + '</select></div>';
    var type = f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text';
    return '<div class="field">' + lab + '<input type="' + type + '" id="' + id + '" data-f="' + esc(f.name) + '" value="' + esc(v || '') + '"' + (f.type === 'time' ? ' placeholder="เช่น 10.20 น."' : '') + '></div>';
  }
  function renderForm() {
    var def = cur.def, flds = MT.fields(def), lk = linkOf(), h = '';
    h += '<div class="card"><div class="section-title">' + ic('fa-hashtag ui-icon') + ' ข้อมูลหนังสือ</div><div class="field-row"><div class="field"><label for="mfNo">ที่ (เลขที่หนังสือ — ถ้ามี)</label><input id="mfNo" value="' + esc(F.docNo) + '" placeholder="เว้นว่าง = เส้นจุดไว้เขียนมือ"></div><div class="field"><label for="mfDate">วันที่</label><input type="date" id="mfDate" value="' + esc(F.docDate) + '"></div></div>' +
      (def.deptPick ? '<div class="field"><label for="mfDept">กลุ่มบริหารงานที่จะส่งถึง (ชื่อผู้ลงความเห็นท้ายใบ)</label><select id="mfDept"><option value="">— ไม่ระบุ —</option>' + (ST.departments || []).map(function (d) { return '<option value="' + esc(d) + '"' + (F.dept === d ? ' selected' : '') + '>' + esc(gl(d)) + '</option>'; }).join('') + '</select></div>' : '') + '</div>';
    if (flds.length) h += '<div class="card"><div class="section-title">' + ic('fa-pen-to-square ui-icon') + ' ข้อมูลที่ต้องกรอก</div><p class="hint" style="margin-top:-8px">ชื่อ ตำแหน่ง กลุ่มสาระ' + (def.table.type === 'students' ? ' และจำนวนนักเรียน' : '') + ' ระบบเติมให้เอง</p>' + flds.map(fieldInput).join('') + '</div>';
    if (def.table.type === 'students') h += '<div class="card"><div class="section-title">' + ic('fa-users ui-icon') + ' นักเรียน <span class="hint" style="font-weight:500;margin-left:6px" id="mfStuN"></span></div><p class="hint" style="margin-top:-8px">เลือกจากรายชื่อในระบบ · ชั้นเติมให้เอง · เกิน ' + (def.table.rows * 2) + ' คน = ต่อหน้าถัดไป</p>' +
      '<div class="field-row"><div class="field" style="flex:0 0 170px"><select id="mfRoom" aria-label="ห้อง"><option value="">ทุกห้อง</option></select></div><div class="field"><input type="search" id="mfQ" placeholder="พิมพ์ชื่อ หรือเลขประจำตัว" autocomplete="off"></div></div><div class="mm-pick" id="mfPick"></div><div class="mm-chips" id="mfSel" style="margin-top:10px"></div></div>';
    if (def.table.type === 'custom') h += '<div class="card"><div class="section-title">' + ic('fa-table ui-icon') + ' ตาราง</div><div style="overflow-x:auto"><table class="mm-grid" id="mfGrid"></table></div><button type="button" class="btn btn-ghost btn-sm" id="mfAddRow" style="margin-top:8px">' + ic('fa-plus') + ' เพิ่มแถว</button></div>';
    if (lk) h += '<div class="card"><div class="section-title">' + ic('fa-person-running ui-icon') + ' คาบที่ขอเวลาเรียน <span class="hint" style="font-weight:500;margin-left:6px">ใช้ส่งให้เว็บเช็คชื่อ — ไม่พิมพ์ในใบ</span></div><div class="mm-pers" id="mfPer"></div><p class="hint" style="margin:6px 0 0">A = เข้าแถว · B = โฮมรูม · วันที่ใช้ "' + esc(lk.dateField) + '"</p></div>';
    $('tfWrap').innerHTML = h;
    if (def.table.type === 'students') { paintRooms(); paintPick(); paintSel(); loadStudents(); }
    if (def.table.type === 'custom') paintGrid();
    if (lk) paintPer();
  }
  function paintPer() { var el = $('mfPer'); if (!el) return; el.innerHTML = '<button type="button" data-per="all"' + (F.allDay ? ' class="on"' : '') + '>ทั้งวัน</button>' + PERIODS.map(function (p) { return '<button type="button" data-per="' + p + '"' + (!F.allDay && F.periods.indexOf(p) !== -1 ? ' class="on"' : '') + '>' + plabel(p) + '</button>'; }).join(''); }
  function paintGrid() {
    var el = $('mfGrid'); if (!el) return; var cols = cur.def.table.cols, n = Math.max(cur.def.table.rows, F.rows.length);
    while (F.rows.length < n) F.rows.push(cols.map(function () { return ''; }));
    el.innerHTML = '<thead><tr><th>ที่</th>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' + F.rows.map(function (r, i) { return '<tr><td class="no">' + (i + 1) + '</td>' + cols.map(function (c, j) { return '<td><input data-gr="' + i + '" data-gc="' + j + '" value="' + esc(r[j] || '') + '" aria-label="' + esc(c) + ' แถว ' + (i + 1) + '"></td>'; }).join('') + '</tr>'; }).join('') + '</tbody>';
  }
  async function loadStudents() {
    if (STU) return;
    try { STU = (await apiCall('memoStudents', {})).students || []; } catch (e) { STU = []; var pk = $('mfPick'); if (pk) pk.innerHTML = '<div><span class="hint">' + esc(e.message) + '</span></div>'; return; }
    paintRooms(); paintPick();
  }
  function paintRooms() {
    var el = $('mfRoom'); if (!el || !STU) return; var o = {}; STU.forEach(function (s) { o[s.roomId] = s.room; });
    var ks = Object.keys(o).sort(function (a, b) { var x = /m(\d+)_(\d+)/.exec(a) || [0, 0, 0], y = /m(\d+)_(\d+)/.exec(b) || [0, 0, 0]; return x[1] - y[1] || x[2] - y[2]; });
    el.innerHTML = '<option value="">ทุกห้อง</option>' + ks.map(function (k) { return '<option value="' + esc(k) + '"' + (pickRoom === k ? ' selected' : '') + '>' + esc(o[k]) + '</option>'; }).join('');
  }
  function inSel(id) { return F.students.some(function (s) { return s.id === id; }); }
  function paintPick() {
    var el = $('mfPick'); if (!el) return;
    if (!STU) { el.innerHTML = '<div><span class="hint">' + ic('fa-spinner fa-spin') + ' กำลังโหลดรายชื่อนักเรียน...</span></div>'; return; }
    var q = pickQ.trim().toLowerCase();
    if (!pickRoom && !q) { el.innerHTML = '<div><span class="hint">เลือกห้อง หรือพิมพ์ชื่อ / เลขประจำตัวเพื่อค้นหา</span></div>'; return; }
    var L = STU.filter(function (s) { return (!pickRoom || s.roomId === pickRoom) && (!q || (s.name + ' ' + (s.code || '')).toLowerCase().indexOf(q) !== -1); });
    var h = '';
    if (pickRoom && !q && L.length) h += '<div>' + ic('fa-users') + '<span>ทั้งห้อง ' + esc(L[0].room) + ' (' + L.length + ' คน)</span><button type="button" class="btn btn-secondary btn-sm" data-addroom>เพิ่มทั้งห้อง</button></div>';
    h += L.slice(0, 60).map(function (s) { var on = inSel(s.id); return '<div>' + ic(on ? 'fa-circle-check' : 'fa-user') + '<span>' + esc(s.name) + ' <small>' + esc(s.room) + (s.code ? ' · ' + esc(s.code) : '') + '</small></span>' + (on ? '<button type="button" class="btn btn-ghost btn-sm" data-rm="' + esc(s.id) + '">เอาออก</button>' : '<button type="button" class="btn btn-secondary btn-sm" data-add="' + esc(s.id) + '">เพิ่ม</button>') + '</div>'; }).join('');
    if (L.length > 60) h += '<div><span class="hint">แสดง 60 จาก ' + L.length + ' คน — พิมพ์เพิ่มเพื่อค้นให้แคบลง</span></div>';
    if (!L.length) h += '<div><span class="hint">ไม่พบนักเรียน</span></div>';
    el.innerHTML = h;
  }
  function paintSel() {
    var el = $('mfSel'); if (!el) return;
    el.innerHTML = F.students.map(function (s, i) { return '<span class="mm-chip">' + (i + 1) + '. ' + esc(s.name) + ' · ' + esc(s.room || '') + '<button type="button" data-rm="' + esc(s.id) + '" aria-label="เอา ' + esc(s.name) + ' ออก">' + ic('fa-xmark') + '</button></span>'; }).join('') || '<span class="hint">ยังไม่ได้เลือกนักเรียน</span>';
    var n = $('mfStuN'); if (n) n.textContent = '(เลือกแล้ว ' + F.students.length + ' คน)';
  }
  function addStu(s) { if (!inSel(s.id)) F.students.push({ id: s.id, name: s.name, room: s.room, roomId: s.roomId, code: s.code || '' }); }

  // ---------- วาดกระดาษ ----------
  function renderPaper() {
    if (TAB === 'tpls' && TE) { paper.innerHTML = MT.render(TE.def, Object.assign(ctxOf(TE.blank), { dept: TE.department, values: TE.blank ? {} : TE.sample, students: TE.blank ? [] : SAMPLE_STU, rows: [] })); fitPaper(); return; }
    if (!cur) { paper.innerHTML = '<div style="padding:40px;text-align:center">เลือกแม่แบบด้านบน</div>'; return; }
    if (cur.kind === 'report') rpPaper(); else paper.innerHTML = MT.render(cur.def, ctxOf(BLANK));
    fitPaper();
  }
  var renderPaperD = debounce(renderPaper, 150);

  // ---------- เลือกแม่แบบ ----------
  function tplList() { var L = []; if (B.hub) L.push({ id: 'report', kind: 'report', name: 'รายงานการส่งงาน (แนบผลงานที่ส่งแล้ว)', dept: '' }); B.tpls.forEach(function (t) { L.push({ id: t.id, kind: t.def.link ? 'reqtime' : 'custom', name: t.name, dept: t.department, def: t.def }); }); return L; }
  function paintTplSelect() {
    var L = tplList(), by = {}, order = [];
    L.forEach(function (t) { var k = t.kind === 'report' ? '__r' : t.dept || ''; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(t); });
    $('mmTpl').innerHTML = order.map(function (k) { return '<optgroup label="' + esc(k === '__r' ? 'ส่งงาน' : gl(k)) + '">' + by[k].map(function (t) { return '<option value="' + esc(t.id) + '">' + esc(t.name) + '</option>'; }).join('') + '</optgroup>'; }).join('') || '<option value="">— ยังไม่มีแม่แบบ —</option>';
  }
  async function selectTpl(id, keep) {
    var t = tplList().filter(function (x) { return x.id === id; })[0];
    if (!t) { cur = null; $('rpWrap').hidden = true; $('tfWrap').hidden = true; renderPaper(); return; }
    cur = { id: t.id, kind: t.kind, name: t.name, dept: t.dept, def: t.def ? JSON.parse(JSON.stringify(t.def)) : null };
    $('mmTpl').value = t.id;
    if (!keep) { docId = ''; docTitle = ''; F = { values: {}, students: [], rows: [], docNo: '', docDate: todayYmd(), dept: t.dept || '', periods: [], allDay: true }; }
    paintEditing();
    $('rpWrap').hidden = t.kind !== 'report'; $('tfWrap').hidden = t.kind === 'report';
    $('mmBlank').disabled = t.kind === 'report';
    $('mmToRt').hidden = !(B.rtAdmin && t.kind === 'reqtime');
    $('mmTplHint').textContent = t.kind === 'report' ? 'ดึงรายการผลงานที่ส่งแล้วมาทำตาราง + QR ไปหน้าผลงาน' : (t.kind === 'reqtime' ? 'ใบนี้ใช้ลงเป็น "ขอเวลาเรียน" ได้ — ผู้ดูแลกดลงจากใบนี้ได้เลย ไม่ต้องพิมพ์รายชื่อซ้ำ' : '');
    if (t.kind === 'report') { await rpInit(); if (!keep) rpRenderItems(); } else renderForm();
    renderPaper();
  }
  function paintEditing() {
    var e = $('mmEditing'); e.hidden = !docId;
    if (docId) e.innerHTML = ic('fa-pen') + ' กำลังแก้ฉบับที่บันทึกไว้: <b>' + esc(docTitle) + '</b><span style="flex:1"></span><button type="button" class="btn btn-ghost btn-sm" data-mm-new>' + ic('fa-plus') + ' เขียนฉบับใหม่</button>';
  }
  $('mmTpl').addEventListener('change', function () { selectTpl(this.value); });

  // ---------- บันทึก / พิมพ์ ----------
  function collect() {
    if (!cur) return null;
    if (cur.kind === 'report') { var d = rpData(); return { kind: 'report', title: d.subject || 'รายงานการส่งงาน', data: d }; }
    var lk = linkOf(), data = { values: F.values, students: F.students, rows: F.rows, docNo: F.docNo, docDate: F.docDate, dept: F.dept, tpl: cur.def, tplDept: cur.dept };
    if (lk) { var r = F.values[lk.dateField] || {}; data.rt = { from: r.from || '', to: r.to || r.from || '', periods: F.allDay ? [] : F.periods.slice(), title: String(F.values[lk.titleField] || '').trim() }; data.periods = F.periods; data.allDay = F.allDay; }
    return { kind: cur.kind, title: MT.subjectText(cur.def, ctxOf(false)) || cur.name, data: data };
  }
  async function save(quiet) {
    var c = collect(); if (!c) return null;
    var r = await withProgress('กำลังบันทึก', function () { return apiCall('memoSave', { id: docId, tplId: cur.id, tplName: cur.name, kind: c.kind, title: c.title, data: c.data }); }, { successLabel: quiet ? 'บันทึกแล้ว' : 'บันทึกแล้ว — ดูได้ที่ "บันทึกข้อความของฉัน"' });
    if (!r.ok) return null;
    docId = r.data.id; docTitle = c.title; B.nDocs += 0; MINE = null; paintEditing(); paintTabs();
    return docId;
  }
  $('mmSave').addEventListener('click', function () { save(); });
  $('mmPrint').addEventListener('click', function () { BLANK = false; renderPaper(); paper.style.zoom = ''; window.print(); });
  $('mmBlank').addEventListener('click', function () { if (!cur || cur.kind === 'report') return; BLANK = true; renderPaper(); paper.style.zoom = ''; window.print(); });
  $('mmNew').addEventListener('click', function () { if (cur) selectTpl(cur.id); });
  $('mmToRt').addEventListener('click', async function () {
    var lk = linkOf(); if (!lk) return; var r = F.values[lk.dateField] || {};
    if (!r.from) { showToast('กรุณาใส่ "' + lk.dateField + '" ก่อน', true); return; }
    if (!F.students.length) { showToast('กรุณาเลือกนักเรียนก่อน', true); return; }
    var id = await save(true); if (id) location.href = 'reqtime.html#memo=' + encodeURIComponent(id);
  });

  // ---------- ช่องกรอก (ฟอร์มของแม่แบบ) ----------
  var tf = $('tfWrap');
  tf.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches('[data-f]')) F.values[t.getAttribute('data-f')] = t.value;
    else if (t.matches('[data-fr]')) { var k = t.getAttribute('data-fr'), o = F.values[k] = Object.assign({}, F.values[k] || {}); o[t.getAttribute('data-k')] = t.value; if (t.getAttribute('data-k') === 'from' && (!o.to || o.to < o.from)) { o.to = t.value; var b = tf.querySelector('[data-fr="' + CSS.escape(k) + '"][data-k="to"]'); if (b) b.value = t.value; } }
    else if (t.id === 'mfNo') F.docNo = t.value; else if (t.id === 'mfDate') F.docDate = t.value; else if (t.id === 'mfDept') F.dept = t.value;
    else if (t.matches('[data-gr]')) F.rows[+t.getAttribute('data-gr')][+t.getAttribute('data-gc')] = t.value;
    else if (t.id === 'mfQ') { pickQ = t.value; paintPickD(); return; }
    renderPaperD();
  });
  var paintPickD = debounce(paintPick, 180);
  tf.addEventListener('change', function (e) { var t = e.target; if (t.id === 'mfRoom') { pickRoom = t.value; paintPick(); } else if (t.id === 'mfDept' || t.matches('select[data-f]')) { if (t.id === 'mfDept') F.dept = t.value; else F.values[t.getAttribute('data-f')] = t.value; renderPaper(); } });
  tf.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-add]'))) { var s = STU.filter(function (x) { return x.id === t.getAttribute('data-add'); })[0]; if (s) addStu(s); paintPick(); paintSel(); renderPaperD(); return; }
    if (e.target.closest('[data-addroom]')) { STU.filter(function (x) { return x.roomId === pickRoom; }).forEach(addStu); paintPick(); paintSel(); renderPaperD(); return; }
    if ((t = e.target.closest('[data-rm]'))) { var id = t.getAttribute('data-rm'); F.students = F.students.filter(function (x) { return x.id !== id; }); paintPick(); paintSel(); renderPaperD(); return; }
    if (e.target.closest('#mfAddRow')) { F.rows.push(cur.def.table.cols.map(function () { return ''; })); paintGrid(); renderPaperD(); return; }
    if ((t = e.target.closest('[data-per]'))) { var v = t.getAttribute('data-per'); if (v === 'all') { F.allDay = true; F.periods = []; } else { var p = +v, i = F.periods.indexOf(p); if (i === -1) F.periods.push(p); else F.periods.splice(i, 1); F.periods.sort(function (a, b) { return a - b; }); F.allDay = !F.periods.length; } paintPer(); }
  });
  document.addEventListener('click', function (e) { if (e.target.closest('[data-mm-new]') && cur) selectTpl(cur.id); });

  // =====================================================================
  // แท็บ
  // =====================================================================
  function tabs() { var t = [['write', 'fa-pen-to-square', 'เขียน'], ['mine', 'fa-folder-open', 'บันทึกข้อความของฉัน']]; if (B.manageTpl) t.push(['tpls', 'fa-layer-group', 'แม่แบบ']); if (B.superAdmin) t.push(['set', 'fa-sliders', 'ตั้งค่า']); return t; }
  function paintTabs() { $('mmTabs').innerHTML = tabs().map(function (x) { return '<button type="button" class="tab-btn' + (TAB === x[0] ? ' active' : '') + '" data-mm-tab="' + x[0] + '" role="tab">' + ic(x[1]) + ' ' + x[2] + '</button>'; }).join(''); }
  function showTab(t) {
    TAB = t; paintTabs();
    $('mmWrite').hidden = t !== 'write'; $('mmMine').hidden = t !== 'mine'; $('mmTpls').hidden = t !== 'tpls'; $('mmSet').hidden = t !== 'set';
    outer.hidden = !(t === 'write' || (t === 'tpls' && TE));
    if (t === 'mine') showMine(); if (t === 'tpls') showTpls(); if (t === 'set') showSet();
    if (!outer.hidden) renderPaper();
  }
  $('mmTabs').addEventListener('click', function (e) { var b = e.target.closest('[data-mm-tab]'); if (b) showTab(b.getAttribute('data-mm-tab')); });

  // ---------- บันทึกข้อความของฉัน ----------
  var MINE = null;
  async function showMine() {
    var el = $('mmMineList');
    if (!MINE) { el.innerHTML = '<div class="loading">กำลังโหลด</div>'; try { MINE = (await apiCall('memoList', {})).items || []; } catch (e) { el.innerHTML = '<div class="error-box">' + esc(e.message) + '</div>'; return; } }
    el.innerHTML = MINE.length ? '<div class="mm-list">' + MINE.map(function (x) {
      return '<div class="mm-it"><div class="m"><div class="t">' + esc(x.title) + '</div><div class="s">' + esc(x.tplName) + ' · แก้ล่าสุด ' + formatDateThai(x.updatedAt) + '</div>' + (x.rtId ? '<span class="mm-badge c">' + ic('fa-person-running') + ' ลงขอเวลาเรียนแล้ว</span>' : '') + '</div>' +
        '<div class="a"><button type="button" class="btn btn-secondary btn-sm" data-open="' + esc(x.id) + '">' + ic('fa-pen') + ' เปิด / แก้</button><button type="button" class="btn btn-ghost btn-sm" data-del="' + esc(x.id) + '">' + ic('fa-trash-can') + ' ลบ</button></div></div>';
    }).join('') + '</div>' : '<div class="empty-state">ยังไม่มีบันทึกข้อความที่บันทึกไว้ — เขียนแล้วกด "บันทึก" จะเก็บไว้ที่นี่</div>';
  }
  $('mmMine').addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-open]'))) { await openDoc(t.getAttribute('data-open')); return; }
    if ((t = e.target.closest('[data-del]'))) {
      var x = (MINE || []).filter(function (d) { return d.id === t.getAttribute('data-del'); })[0]; if (!x) return;
      if (!(await askConfirm('ลบ "' + esc(x.title) + '"?<br>ลบแล้วเรียกคืนไม่ได้' + (x.rtId ? '<br>(รายการขอเวลาเรียนที่ลงไว้แล้วไม่ถูกลบ)' : ''), 'ลบบันทึกข้อความ'))) return;
      var r = await withProgress('กำลังลบ', function () { return apiCall('memoDelete', { id: x.id }); }, { successLabel: 'ลบแล้ว' });
      if (r.ok) { if (docId === x.id) { docId = ''; paintEditing(); } MINE = null; showMine(); }
    }
  });
  async function openDoc(id) {
    var d; try { d = (await apiCall('memoGet', { id: id })).item; } catch (e) { showToast(e.message, true); return; }
    var data = d.data || {};
    showTab('write');
    if (d.kind === 'report') { if (!B.hub) { showToast('บัญชีนี้ไม่มีแม่แบบรายงานการส่งงาน', true); return; } await selectTpl('report', true); docId = d.id; docTitle = d.title; paintEditing(); rpLoad(data); return; }
    var t = tplList().filter(function (x) { return x.id === d.tplId; })[0];
    cur = { id: d.tplId, kind: d.kind, name: d.tplName, dept: data.tplDept || (t ? t.dept : ''), def: data.tpl || (t ? t.def : null) };
    if (!cur.def) { showToast('ไม่พบแม่แบบของฉบับนี้', true); return; }
    if ($('mmTpl').querySelector('option[value="' + CSS.escape(d.tplId) + '"]')) $('mmTpl').value = d.tplId;
    F = { values: data.values || {}, students: data.students || [], rows: data.rows || [], docNo: data.docNo || '', docDate: data.docDate || todayYmd(), dept: data.dept || '', periods: data.periods || [], allDay: data.allDay !== false };
    docId = d.id; docTitle = d.title; paintEditing();
    $('rpWrap').hidden = true; $('tfWrap').hidden = false; $('mmBlank').disabled = false; $('mmToRt').hidden = !(B.rtAdmin && cur.kind === 'reqtime');
    $('mmTplHint').textContent = t ? '' : 'แม่แบบนี้ถูกลบไปแล้ว — ใช้แบบที่เก็บไว้ในฉบับนี้';
    renderForm(); renderPaper();
  }

  // ---------- แม่แบบ (ผู้ดูแล) ----------
  var TE = null; // แม่แบบที่กำลังแก้ { id, name, department, sort, def, blank, sample }
  var SAMPLE_STU = [{ name: 'ด.ญ.ตัวอย่าง ใจดี', room: 'ม.2/2' }, { name: 'นายตัวอย่าง รักเรียน', room: 'ม.5/1' }];
  function canEditTpl(t) { return B.allDepts || (t.department && t.department === B.myDept); }
  function showTpls() {
    var el = $('mmTpls');
    if (TE) { paintEditor(); return; }
    var by = {}, order = [];
    B.tpls.forEach(function (t) { var k = t.department || ''; if (!by[k]) { by[k] = []; order.push(k); } by[k].push(t); });
    el.innerHTML = '<div class="card"><div class="mm-bar"><div class="section-title" style="margin:0;border:0">' + ic('fa-layer-group ui-icon') + ' แม่แบบบันทึกข้อความ</div><span class="sp"></span><button type="button" class="btn btn-primary" data-te-new>' + ic('fa-plus') + ' สร้างแม่แบบ</button></div>' +
      '<p class="hint">' + (B.allDepts ? 'จัดการได้ทุกกลุ่มบริหารงาน' : 'จัดการได้เฉพาะแม่แบบของ' + esc(gl(B.myDept))) + ' · ฉบับที่ครูบันทึกไว้แล้วไม่เปลี่ยนตามเมื่อแก้แม่แบบ</p>' +
      (order.length ? order.map(function (k) { return '<div class="mm-grp">' + esc(gl(k)) + '</div><div class="mm-list">' + by[k].map(function (t) {
        var tags = (t.def.link ? '<span class="mm-badge c">' + ic('fa-person-running') + ' ขอเวลาเรียน</span> ' : '') + (t.def.table.type === 'students' ? '<span class="mm-badge g">ตารางรายชื่อนักเรียน</span> ' : t.def.table.type === 'custom' ? '<span class="mm-badge g">ตาราง</span> ' : '');
        return '<div class="mm-it"><div class="m"><div class="t">' + esc(t.name) + '</div><div class="s">' + esc(t.def.subject) + '</div>' + tags + '</div><div class="a">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-te-copy="' + esc(t.id) + '">' + ic('fa-copy') + ' คัดลอก</button>' +
          (canEditTpl(t) ? '<button type="button" class="btn btn-secondary btn-sm" data-te-edit="' + esc(t.id) + '">' + ic('fa-pen') + ' แก้ไข</button><button type="button" class="btn btn-ghost btn-sm" data-te-del="' + esc(t.id) + '">' + ic('fa-trash-can') + ' ลบ</button>' : '') + '</div></div>';
      }).join('') + '</div>'; }).join('') : '<div class="empty-state">ยังไม่มีแม่แบบ</div>') + '</div>';
  }
  var BLANK_DEF = { subject: 'ขออนุญาต[เรื่อง]', to: 'ผู้อำนวยการ{โรงเรียน}', body: 'ด้วยข้าพเจ้า {ชื่อ} ตำแหน่ง {ตำแหน่ง} กลุ่มสาระการเรียนรู้{กลุ่มสาระ} มีความประสงค์จะ[รายละเอียด] ในวันที่ [วันที่:วันที่]', table: { type: 'none', rows: 10, cols: [] }, closing: 'จึงเรียนมาเพื่อโปรดทราบและพิจารณาอนุญาต', signAs: '', chain: { head: true, deputy: true, director: true }, deptPick: false, link: null };
  function openEditor(t, copy) {
    TE = { id: t && !copy ? t.id : '', name: t ? (copy ? t.name + ' (สำเนา)' : t.name) : '', department: t ? (copy && !B.allDepts ? B.myDept : t.department) : (B.allDepts ? '' : B.myDept), sort: t ? t.sort : 50, def: JSON.parse(JSON.stringify(t ? t.def : BLANK_DEF)), blank: true, sample: {} };
    if (!TE.def.table.cols) TE.def.table.cols = [];
    outer.hidden = false; paintEditor(); renderPaper();
  }
  function rangeFields(def) { return MT.fields(def).filter(function (f) { return f.type === 'range'; }).map(function (f) { return f.name; }); }
  function textFields(def) { return MT.fields(def).filter(function (f) { return f.type === 'text'; }).map(function (f) { return f.name; }); }
  function paintEditor() {
    var d = TE.def, depts = B.allDepts ? [''].concat(ST.departments || []) : [B.myDept];
    var tok = function (x, sys) { return '<code' + (sys ? ' class="s"' : '') + ' data-tok="' + esc(x) + '" title="กดเพื่อใส่ตรงเคอร์เซอร์">' + esc(x) + '</code>'; };
    var rf = rangeFields(d), tx = textFields(d);
    $('mmTpls').innerHTML = '<div class="card"><div class="mm-bar"><div class="section-title" style="margin:0;border:0">' + ic('fa-pen-ruler ui-icon') + ' ' + (TE.id ? 'แก้ไขแม่แบบ' : 'สร้างแม่แบบ') + '</div><span class="sp"></span><button type="button" class="btn btn-ghost" data-te-cancel>ยกเลิก</button><button type="button" class="btn btn-success" data-te-save>' + ic('fa-check') + ' บันทึกแม่แบบ</button></div>' +
      '<div class="field-row"><div class="field"><label for="teName">ชื่อแม่แบบ <span class="lv-req">*</span></label><input id="teName" maxlength="150" value="' + esc(TE.name) + '" placeholder="เช่น ขออนุญาตไปราชการ"></div>' +
      '<div class="field" style="flex:0 0 240px"><label for="teDept">กลุ่มบริหารงาน</label><select id="teDept">' + depts.map(function (x) { return '<option value="' + esc(x) + '"' + (TE.department === x ? ' selected' : '') + '>' + esc(gl(x)) + '</option>'; }).join('') + '</select></div>' +
      '<div class="field" style="flex:0 0 90px"><label for="teSort">ลำดับ</label><input id="teSort" type="number" min="0" max="999" value="' + esc(TE.sort) + '"></div></div>' +
      '<div class="mm-help"><b>ระบบเติมให้:</b> ' + MT.SYS.map(function (k) { return tok('{' + k + '}', 1); }).join(' ') +
        '<br><b>ช่องให้ผู้เขียนกรอก:</b> ' + [tok('[ชื่อช่อง]'), tok('[ชื่อช่อง:วันที่]'), tok('[ชื่อช่อง:ช่วงวันที่]'), tok('[ชื่อช่อง:เวลา]'), tok('[ชื่อช่อง:ตัวเลข]'), tok('[ชื่อช่อง:ข้อความยาว]'), tok('[ชื่อช่อง:ตัวเลือก=ไปราชการ|อบรม]')].join(' ') +
        '<br>เปลี่ยน "ชื่อช่อง" เป็นชื่อที่ต้องการ · ชื่อช่องซ้ำกัน = กรอกครั้งเดียว ขึ้นทุกที่ · กดแล้วใส่ตรงเคอร์เซอร์ในช่องล่าสุดที่กดเลือก</div>' +
      '<div class="field" style="margin-top:12px"><label for="teSubj">เรื่อง <span class="lv-req">*</span></label><input id="teSubj" data-te="subject" value="' + esc(d.subject) + '"></div>' +
      '<div class="field"><label for="teTo">เรียน</label><input id="teTo" data-te="to" value="' + esc(d.to) + '"></div>' +
      '<div class="field"><label for="teBody">เนื้อหา <span class="lv-opt">(ขึ้นบรรทัดใหม่ = ย่อหน้าใหม่)</span></label><textarea id="teBody" data-te="body" rows="7">' + esc(d.body) + '</textarea></div>' +
      '<div class="field-row"><div class="field" style="flex:0 0 220px"><label for="teTbl">ตาราง</label><select id="teTbl"><option value="none"' + (d.table.type === 'none' ? ' selected' : '') + '>ไม่มีตาราง</option><option value="students"' + (d.table.type === 'students' ? ' selected' : '') + '>รายชื่อนักเรียน (2 ฝั่ง)</option><option value="custom"' + (d.table.type === 'custom' ? ' selected' : '') + '>ตารางกำหนดเอง</option></select></div>' +
        (d.table.type !== 'none' ? '<div class="field" style="flex:0 0 140px"><label for="teRows">' + (d.table.type === 'students' ? 'แถวต่อฝั่ง' : 'จำนวนแถว') + '</label><input id="teRows" type="number" min="1" max="25" value="' + esc(d.table.rows) + '"></div>' : '') +
        (d.table.type === 'custom' ? '<div class="field"><label for="teCols">หัวคอลัมน์ <span class="lv-opt">(คั่นด้วย , · ไม่ต้องใส่ "ที่")</span></label><input id="teCols" value="' + esc(d.table.cols.join(', ')) + '" placeholder="เช่น รายการ, จำนวน, หมายเหตุ"></div>' : '') + '</div>' +
      '<div class="field"><label for="teClose">ข้อความปิดท้าย</label><input id="teClose" data-te="closing" value="' + esc(d.closing) + '"></div>' +
      '<div class="field"><label for="teSign">ลงชื่อในฐานะ <span class="lv-opt">(เว้นว่าง = แสดงบรรทัด "ตำแหน่ง ..." ของผู้เขียน)</span></label><input id="teSign" value="' + esc(d.signAs) + '" placeholder="เช่น ครูผู้ควบคุมการฝึกซ้อม"></div>' +
      '<label class="lb" style="font-weight:700;display:block;margin:6px 0">ช่องความเห็นท้ายใบ</label><div class="mm-checks"><label><input type="checkbox" id="teCh1"' + (d.chain.head ? ' checked' : '') + '> หัวหน้ากลุ่มบริหารงาน</label><label><input type="checkbox" id="teCh2"' + (d.chain.deputy ? ' checked' : '') + '> รองผู้อำนวยการ</label><label><input type="checkbox" id="teCh3"' + (d.chain.director ? ' checked' : '') + '> ผู้อำนวยการ</label><label><input type="checkbox" id="tePick"' + (d.deptPick ? ' checked' : '') + '> ให้ผู้เขียนเลือกกลุ่มบริหารงานเอง</label></div>' +
      '<p class="hint" style="margin:4px 0 12px">ชื่อผู้ลงความเห็นดึงจาก ตั้งค่า › ข้อมูลกลุ่มบริหารงาน ของกลุ่ม' + (d.deptPick ? 'ที่ผู้เขียนเลือก' : 'นี้') + ' · ผู้อำนวยการดึงจากข้อมูลหัวกระดาษ</p>' +
      (d.table.type === 'students' ? '<div class="mm-help"><label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" id="teLink" style="width:auto"' + (d.link ? ' checked' : '') + '> ' + ic('fa-person-running') + ' ใช้ลงเป็น "ขอเวลาเรียน" ได้</label>' +
        (d.link ? '<div class="field-row" style="margin-top:8px"><div class="field"><label for="teLD">วันที่ขอ (ช่องแบบช่วงวันที่)</label><select id="teLD">' + (rf.length ? rf.map(function (x) { return '<option' + (d.link.dateField === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') : '<option value="">— ยังไม่มีช่อง :ช่วงวันที่ —</option>') + '</select></div><div class="field"><label for="teLT">ชื่อกิจกรรม (ช่องข้อความ)</label><select id="teLT"><option value="">— ใช้ "เรื่อง" —</option>' + tx.map(function (x) { return '<option' + (d.link.titleField === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></div></div><p class="hint" style="margin:0">ผู้เขียนเลือกคาบที่ขอเพิ่ม (ไม่พิมพ์ในใบ) · ผู้ดูแลกด "ลงเป็นขอเวลาเรียน" จากใบนั้นได้เลย</p>' : '') + '</div>' : '') +
      '<div class="mm-bar" style="margin-top:14px"><span class="hint">ตัวอย่างด้านล่าง:</span><div class="mm-pers"><button type="button" data-te-view="1"' + (TE.blank ? ' class="on"' : '') + '>ใบเปล่า</button><button type="button" data-te-view="0"' + (!TE.blank ? ' class="on"' : '') + '>ใส่ข้อมูลตัวอย่าง</button></div></div></div>';
  }
  var LAST_TE = null;
  function teRead() {
    var d = TE.def, g = function (id) { var e = $(id); return e ? e.value : null; }, v;
    if ((v = g('teName')) !== null) TE.name = v; if ((v = g('teDept')) !== null) TE.department = v; if ((v = g('teSort')) !== null) TE.sort = +v || 0;
    if ((v = g('teSubj')) !== null) d.subject = v; if ((v = g('teTo')) !== null) d.to = v; if ((v = g('teBody')) !== null) d.body = v; if ((v = g('teClose')) !== null) d.closing = v; if ((v = g('teSign')) !== null) d.signAs = v;
    if ((v = g('teRows')) !== null) d.table.rows = Math.max(1, Math.min(25, +v || 10)); if ((v = g('teCols')) !== null) d.table.cols = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 6);
    ['teCh1', 'teCh2', 'teCh3'].forEach(function (id, i) { var e = $(id); if (e) d.chain[['head', 'deputy', 'director'][i]] = e.checked; });
    var pk = $('tePick'); if (pk) d.deptPick = pk.checked;
    if (d.link) { if ((v = g('teLD')) !== null) d.link.dateField = v; if ((v = g('teLT')) !== null) d.link.titleField = v; }
    TE.sample = sampleValues(d);
  }
  function sampleValues(d) { var o = {}; MT.fields(d).forEach(function (f) { o[f.name] = f.type === 'date' ? todayYmd() : f.type === 'range' ? { from: todayYmd(), to: todayYmd() } : f.type === 'number' ? '1' : f.type === 'time' ? '08.30 น.' : f.type === 'select' ? (f.opts[0] || '') : f.type === 'long' ? 'ข้อความย่อหน้าที่ 1\nข้อความย่อหน้าที่ 2' : f.name; }); return o; }
  var teRenderD = debounce(function () { teRead(); renderPaper(); }, 200);
  $('mmTpls').addEventListener('focusin', function (e) { if (e.target.matches('[data-te]')) LAST_TE = e.target; });
  $('mmTpls').addEventListener('input', function (e) { if (TE) teRenderD(); });
  $('mmTpls').addEventListener('change', function (e) {
    if (!TE) return; var t = e.target; teRead();
    if (t.id === 'teTbl') { TE.def.table.type = t.value; if (t.value !== 'students') TE.def.link = null; if (t.value === 'custom' && !TE.def.table.cols.length) TE.def.table.cols = ['รายการ', 'หมายเหตุ']; paintEditor(); }
    else if (t.id === 'teLink') { TE.def.link = t.checked ? { type: 'reqtime', dateField: rangeFields(TE.def)[0] || '', titleField: '' } : null; paintEditor(); }
    else if (t.id === 'tePick') paintEditor();
    renderPaper();
  });
  $('mmTpls').addEventListener('click', async function (e) {
    var t;
    if (e.target.closest('[data-te-new]')) { openEditor(null); return; }
    if ((t = e.target.closest('[data-te-edit]'))) { openEditor(B.tpls.filter(function (x) { return x.id === t.getAttribute('data-te-edit'); })[0]); return; }
    if ((t = e.target.closest('[data-te-copy]'))) { openEditor(B.tpls.filter(function (x) { return x.id === t.getAttribute('data-te-copy'); })[0], true); return; }
    if ((t = e.target.closest('[data-te-del]'))) {
      var x = B.tpls.filter(function (y) { return y.id === t.getAttribute('data-te-del'); })[0]; if (!x) return;
      if (!(await askConfirm('ลบแม่แบบ "' + esc(x.name) + '"?<br>ฉบับที่ครูบันทึกไว้แล้วยังเปิด / พิมพ์ได้', 'ลบแม่แบบ'))) return;
      var r = await withProgress('กำลังลบ', function () { return apiCall('memoTplDelete', { id: x.id }); }, { successLabel: 'ลบแล้ว' });
      if (r.ok) { B.tpls = B.tpls.filter(function (y) { return y.id !== x.id; }); paintTplSelect(); showTpls(); }
      return;
    }
    if ((t = e.target.closest('[data-tok]'))) {
      var el = LAST_TE || $('teBody'), tok = t.getAttribute('data-tok'), a = el.selectionStart || el.value.length, b2 = el.selectionEnd || a;
      el.value = el.value.slice(0, a) + tok + el.value.slice(b2); el.focus(); el.selectionStart = el.selectionEnd = a + tok.length; teRead(); renderPaper(); return;
    }
    if ((t = e.target.closest('[data-te-view]'))) { teRead(); TE.blank = t.getAttribute('data-te-view') === '1'; paintEditor(); renderPaper(); return; }
    if (e.target.closest('[data-te-cancel]')) { TE = null; outer.hidden = true; showTpls(); return; }
    if (e.target.closest('[data-te-save]')) {
      teRead();
      if (!TE.name.trim()) { showToast('กรุณาตั้งชื่อแม่แบบ', true); return; }
      if (!TE.def.subject.trim()) { showToast('กรุณาใส่ "เรื่อง"', true); return; }
      if (TE.def.link && !TE.def.link.dateField) { showToast('แม่แบบขอเวลาเรียนต้องมีช่องแบบ [ชื่อช่อง:ช่วงวันที่] สำหรับวันที่ขอ', true); return; }
      var r2 = await withProgress('กำลังบันทึกแม่แบบ', function () { return apiCall('memoTplSave', { id: TE.id, name: TE.name, department: TE.department, sort: TE.sort, def: TE.def }); }, { successLabel: 'บันทึกแม่แบบแล้ว' });
      if (!r2.ok) return;
      var it = r2.data.item, i = -1; B.tpls.forEach(function (y, k) { if (y.id === it.id) i = k; });
      if (i === -1) B.tpls.push(it); else B.tpls[i] = it;
      B.tpls.sort(function (p, q) { return p.sort - q.sort || p.name.localeCompare(q.name, 'th'); });
      TE = null; outer.hidden = true; paintTplSelect(); if (cur) $('mmTpl').value = cur.id; showTpls();
    }
  });

  // ---------- ตั้งค่าการเปิดใช้งาน (Super Admin) ----------
  var PEOPLE = null, SET = null, pq = '';
  async function showSet() {
    var el = $('mmSet');
    if (!SET) SET = { mode: B.mode, access: JSON.parse(JSON.stringify(B.access || { sys: true, exec: false, depts: [], users: [] })) };
    if (!PEOPLE) { el.innerHTML = '<div class="card"><div class="loading">กำลังโหลด</div></div>'; try { PEOPLE = (await apiCall('memoPeople', {})).people || []; } catch (e) { el.innerHTML = '<div class="card"><div class="error-box">' + esc(e.message) + '</div></div>'; return; } }
    paintSet();
  }
  function paintSet() {
    var a = SET.access, nm = {}; PEOPLE.forEach(function (p) { nm[p.id] = p; });
    var M = [['off', 'ปิด', 'ซ่อนเมนูทุกบัญชี (Super Admin ยังเข้าได้)'], ['some', 'เฉพาะผู้ที่เลือก', 'เตรียม / ตรวจแม่แบบก่อนเปิดให้ทุกคน'], ['all', 'ครูทุกคน', 'ครู เจ้าหน้าที่ และผู้บริหารทุกคน']];
    var q = pq.trim().toLowerCase(), cand = q ? PEOPLE.filter(function (p) { return a.users.indexOf(p.id) === -1 && (p.name + ' ' + p.kind).toLowerCase().indexOf(q) !== -1; }).slice(0, 30) : [];
    $('mmSet').innerHTML = '<div class="card"><div class="section-title">' + ic('fa-toggle-on ui-icon') + ' การเปิดใช้งานบันทึกข้อความ</div>' +
      '<div class="mm-mode">' + M.map(function (m) { return '<label class="' + (SET.mode === m[0] ? 'on' : '') + '"><input type="radio" name="mmMode" value="' + m[0] + '"' + (SET.mode === m[0] ? ' checked' : '') + '><span><b>' + m[1] + '</b><small>' + m[2] + '</small></span></label>'; }).join('') + '</div>' +
      (SET.mode === 'some' ? '<div class="mm-grp">เปิดให้</div><div class="mm-checks"><label><input type="checkbox" id="acSys"' + (a.sys ? ' checked' : '') + '> แอดมินระบบ</label><label><input type="checkbox" id="acExec"' + (a.exec ? ' checked' : '') + '> ผู้บริหาร</label></div>' +
        '<div class="mm-grp">เจ้าหน้าที่กลุ่มบริหารงาน</div><div class="mm-checks">' + ((ST.departments || []).map(function (d) { return '<label><input type="checkbox" data-acd="' + esc(d) + '"' + (a.depts.indexOf(d) !== -1 ? ' checked' : '') + '> ' + esc(gl(d)) + '</label>'; }).join('') || '<span class="hint">ยังไม่มีกลุ่มบริหารงานในระบบ</span>') + '</div>' +
        '<div class="mm-grp">รายบุคคล (' + a.users.length + ' คน)</div><div class="mm-chips">' + a.users.map(function (id) { var p = nm[id] || { name: '(บัญชีที่ถูกลบ)', kind: '' }; return '<span class="mm-chip">' + esc(p.name) + ' <small>' + esc(p.kind) + '</small><button type="button" data-acu-rm="' + esc(id) + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button></span>'; }).join('') + '</div>' +
        '<input type="search" id="acQ" placeholder="พิมพ์ชื่อเพื่อเพิ่มรายบุคคล" value="' + esc(pq) + '" style="margin-top:8px" autocomplete="off">' +
        (q ? '<div class="mm-pick">' + (cand.map(function (p) { return '<div><span>' + esc(p.name) + ' <small>' + esc(p.kind) + '</small></span><button type="button" class="btn btn-secondary btn-sm" data-acu-add="' + esc(p.id) + '">เพิ่ม</button></div>'; }).join('') || '<div><span class="hint">ไม่พบ</span></div>') + '</div>' : '') : '') +
      '<div class="mm-bar" style="margin-top:14px"><span class="sp"></span><button type="button" class="btn btn-success" data-ac-save>' + ic('fa-check') + ' บันทึกการตั้งค่า</button></div>' +
      '<p class="hint" style="margin:8px 0 0">บันทึกแล้ว บัญชีอื่นเห็น / ไม่เห็นเมนูหลังเปิดหน้าใหม่ (ไม่เกิน 1–2 นาที) · Super Admin เข้าได้เสมอ</p></div>';
    var qi = $('acQ'); if (qi && pq) { qi.focus(); qi.selectionStart = qi.selectionEnd = qi.value.length; }
  }
  $('mmSet').addEventListener('change', function (e) {
    var t = e.target, a = SET.access;
    if (t.name === 'mmMode') { SET.mode = t.value; paintSet(); return; }
    if (t.id === 'acSys') a.sys = t.checked; else if (t.id === 'acExec') a.exec = t.checked;
    else if (t.matches('[data-acd]')) { var d = t.getAttribute('data-acd'); a.depts = a.depts.filter(function (x) { return x !== d; }); if (t.checked) a.depts.push(d); }
  });
  $('mmSet').addEventListener('input', debounce(function (e) { if (e.target.id === 'acQ') { pq = e.target.value; paintSet(); } }, 250));
  $('mmSet').addEventListener('click', async function (e) {
    var t, a = SET.access;
    if ((t = e.target.closest('[data-acu-add]'))) { a.users.push(t.getAttribute('data-acu-add')); pq = ''; paintSet(); return; }
    if ((t = e.target.closest('[data-acu-rm]'))) { var id = t.getAttribute('data-acu-rm'); a.users = a.users.filter(function (x) { return x !== id; }); paintSet(); return; }
    if (e.target.closest('[data-ac-save]')) {
      var L = { off: 'ปิด', some: 'เฉพาะผู้ที่เลือก', all: 'ครูทุกคน' };
      if (!(await askConfirm('ตั้งการเปิดใช้บันทึกข้อความเป็น <b>' + L[SET.mode] + '</b>?', 'ยืนยันการตั้งค่า'))) return;
      var r = await withProgress('กำลังบันทึก', function () { return apiCall('memoAccessSave', { mode: SET.mode, access: SET.access }); }, { successLabel: 'บันทึกการตั้งค่าแล้ว' });
      if (r.ok) { B.mode = r.data.mode; B.access = r.data.access; if (typeof resetSettingsCache === 'function') resetSettingsCache(); }
    }
  });

  // =====================================================================
  async function boot() {
    var fresh = await refreshSessionUser();
    if (!fresh || !fresh.memo) { location.replace(homePageFor(fresh || session)); return; }
    ME = fresh;
    try { B = await apiCall('memoBoot', {}); } catch (e) { $('mmWrite').hidden = false; $('mmWrite').innerHTML = '<div class="card"><div class="error-box">' + esc(e.message) + '</div></div>'; outer.hidden = true; return; }
    ST = await getSiteSettings();
    ME = Object.assign({}, fresh, { position: B.me.position || fresh.position, subjectGroup: B.me.subjectGroup || fresh.subjectGroup });
    paintTplSelect();
    var h = (location.hash || '').replace('#', '');
    if (h === 'set' && B.superAdmin) { showTab('set'); }
    else if (h === 'mine') showTab('mine');
    else if (h === 'tpls' && B.manageTpl) showTab('tpls');
    else showTab('write');
    var first = tplList()[0]; if (first) await selectTpl(first.id); else renderPaper();
  }
  boot();
})();
