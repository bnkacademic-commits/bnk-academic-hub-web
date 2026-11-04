/* ชุมนุม (1.99) — หน้า club.html · แยกไฟล์จาก api.js (หน้าอื่นไม่ต้องโหลด)
 * ครู: ข้อมูลชุมนุม (แบบเสนอ) · นักเรียน · เช็คชื่อ/แก้ย้อนหลัง · รูปกิจกรรม 4 รูป · สรุปและส่งเล่ม
 * แอดมิน: ทุกชุมนุม · นักเรียนกับชุมนุม · ตั้งค่า (วันชุมนุมทั้งโรงเรียน · ประเภทงานที่ส่งเล่ม · ผู้ลงนาม · ข้อความในเล่ม) */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('club'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('cbBody'), tabsEl = document.getElementById('cbTabs');
  var B = null, D = null, st = { tab: '', clubId: '', sel: '', stu: null, filt: { g: '', room: '', q: '', mode: 'none' }, add: { g: '', room: '', q: '', pick: {} } };
  var STATUS = ['มา', 'สาย', 'ลาป่วย', 'ลากิจ', 'ขาด'], CODE = { 'มา': '✓', 'สาย': 'ส', 'ลาป่วย': 'ป', 'ลากิจ': 'ล', 'ขาด': 'ข' };
  var SCOLOR = { 'มา': '#10b981', 'สาย': '#f59e0b', 'ลาป่วย': '#3b82f6', 'ลากิจ': '#6366f1', 'ขาด': '#f43f5e' };
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], DW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var INFO = [['rationale', 'หลักการและเหตุผล', 1], ['objectives', 'วัตถุประสงค์', 1], ['method', 'วิธีดำเนินการ', 1], ['duration', 'ระยะเวลาดำเนินการ', 0], ['place', 'สถานที่ / พื้นที่ดำเนินการ', 0], ['budget', 'งบประมาณ', 0]];
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function room(r) { var m = /m(\d+)_(\d+)/.exec(r || ''); return m ? 'ม.' + m[1] + '/' + m[2] : (r || '-'); }
  function dP(ds) { var p = String(ds || '').split('-'); return p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]) : null; }
  function thD(ds, y) { var d = dP(ds); return d ? d.getDate() + ' ' + MS[d.getMonth()] + (y ? ' ' + (d.getFullYear() + 543) : '') : '-'; }
  function thDW(ds) { var d = dP(ds); return d ? DW[d.getDay()] + ' ' + thD(ds, true) : '-'; }
  function err(m) { return '<div class="cb-err"><i class="fa-solid fa-circle-exclamation"></i> ' + esc(m) + '</div>'; }
  function modal(title, html, actions) {
    var mb = document.getElementById('cbModalBody'), ma = document.getElementById('cbModalActions'); mb.onclick = null; mb.oninput = null; mb.onchange = null; ma.onclick = null;
    document.getElementById('cbModalTitle').innerHTML = title; mb.innerHTML = html;
    ma.innerHTML = (actions || '') + '<button type="button" class="btn btn-ghost btn-close" data-cb-close>ปิด</button>';
    showModalEl(document.getElementById('cbModal'));
  }
  function closeModal() { hideModalEl(document.getElementById('cbModal')); }
  document.getElementById('cbModal').addEventListener('click', function (e) { if (e.target.closest('[data-cb-close]')) closeModal(); });
  function setBody(h) { var y = window.scrollY; body.innerHTML = h; window.scrollTo(0, y); }

  // ---------- โหลด ----------
  async function boot(keep) {
    try { B = await apiCall('clubBoot', st.term ? { term: st.term } : {}); } catch (e) { body.innerHTML = err(e.message); return; }
    if (!B.sqlReady) { tabsEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err('ยังใช้หน้านี้ไม่ได้ — ผู้ดูแลระบบต้องรัน SQL ชุดที่สามสิบห้าก่อน (ดู README)') + '</div>'; return; }
    if (!st.clubId || !keep) st.clubId = B.myClubId || (B.viewer && st.clubId) || '';
    D = null;
    if (st.clubId) { try { D = await apiCall('clubDetail', { id: st.clubId }); } catch (e) { st.clubId = ''; D = null; } }
    renderTabs(keep);
  }
  async function reloadClub() { D = await apiCall('clubDetail', { id: st.clubId }); }
  function tabList() {
    var t = [];
    if (D) t.push(['info', 'fa-circle-info', 'ข้อมูลชุมนุม'], ['stu', 'fa-users', 'นักเรียน (' + activeMembers().length + ')'], ['check', 'fa-clipboard-check', 'เช็คชื่อ'], ['photo', 'fa-camera', 'รูปกิจกรรม (' + D.club.photos.length + '/4)'], ['sum', 'fa-file-pdf', 'สรุปและส่งเล่ม']);
    else if (B.term && !B.isPast) t.push(['info', 'fa-plus', B.myClubId ? 'ข้อมูลชุมนุม' : 'สร้างชุมนุม']);
    if (B.viewer) t.push(['all', 'fa-layer-group', 'ทุกชุมนุม'], ['who', 'fa-user-check', 'นักเรียนกับชุมนุม']);
    if (B.manager && !B.isPast) t.push(['cfg', 'fa-gear', 'ตั้งค่าชุมนุม']);
    if (B.superAdmin) t.push(['mgr', 'fa-user-shield', 'ผู้ดูแลงานชุมนุม']); // 2.00.4
    return t;
  }
  function renderTabs(keep) {
    var t = tabList();
    if (!keep || !t.some(function (x) { return x[0] === st.tab; })) { var h = (location.hash || '').replace('#', ''); st.tab = t.some(function (x) { return x[0] === h; }) ? h : (t[0] ? t[0][0] : ''); }
    tabsEl.innerHTML = termPickHtml() + (D && B.viewer && D.club.id !== B.myClubId ? '<span class="cb-viewing"><i class="fa-solid fa-eye"></i> ' + esc(D.club.name) + ' <button type="button" class="btn btn-ghost btn-sm" data-cb-leave>กลับ</button></span>' : '') +
      t.map(function (x) { return '<button type="button" role="tab" data-cb-tab="' + x[0] + '" class="' + (x[0] === st.tab ? 'on' : '') + '"><i class="fa-solid ' + x[1] + '" aria-hidden="true"></i> ' + x[2] + '</button>'; }).join('');
    show();
  }
  tabsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cb-tab]'); if (b) { st.tab = b.getAttribute('data-cb-tab'); try { history.replaceState(null, '', '#' + st.tab); } catch (x) { /* ข้าม */ } renderTabs(true); return; }
    if (e.target.closest('[data-cb-leave]')) { st.clubId = B.myClubId || ''; boot(false); }
  });
  // 2.00.4: เลือกภาคเรียน / ปีการศึกษา (ดูชุมนุมที่เคยเปิด) — ภาคเรียนที่ผ่านมา = ดูได้อย่างเดียว (ยกเว้นแอดมินจัดการ)
  function termPickHtml() {
    var L = (B.terms || []).slice(), curK = B.curTerm ? B.curTerm.year + '_' + B.curTerm.semester : '', selK = B.term ? B.term.year + '_' + B.term.semester : '';
    if (selK && !L.some(function (x) { return x.key === selK; })) L.unshift({ key: selK, year: B.term.year, semester: B.term.semester });
    if (L.length < 2) return '';
    return '<label class="cb-term"><i class="fa-solid fa-calendar"></i> <select id="cbTerm" aria-label="ภาคเรียน">' + L.map(function (x) { return '<option value="' + x.key + '"' + (x.key === selK ? ' selected' : '') + '>ภาคเรียนที่ ' + x.semester + '/' + x.year + (x.key === curK ? ' (ปัจจุบัน)' : '') + '</option>'; }).join('') + '</select></label>';
  }
  tabsEl.addEventListener('change', function (e) { if (e.target.id !== 'cbTerm') return; var k = e.target.value, curK = B.curTerm ? B.curTerm.year + '_' + B.curTerm.semester : ''; st.term = k === curK ? '' : k; st.clubId = ''; st.stu = null; cfgDraft = null; boot(false); });
  function show() {
    if (!B.term && !D) { body.innerHTML = '<div class="card cb-empty"><i class="fa-solid fa-sun"></i><p>ช่วงนี้ไม่ใช่ภาคเรียนปกติ (ภาคฤดูร้อน)</p></div>'; return; }
    var f = { info: renderInfo, stu: renderStu, check: renderCheck, photo: renderPhoto, sum: renderSum, all: renderAll, who: renderWho, cfg: renderCfg, mgr: renderMgr }[st.tab];
    if (f) Promise.resolve(f()).catch(function (e) { body.innerHTML = err(e.message); });
  }
  function headHtml() {
    if (!D) return '';
    var c = D.club, rv = D.review;
    var stTag = D.locked ? '<span class="cb-tag ok"><i class="fa-solid fa-lock"></i> เล่มผ่านการตรวจแล้ว (ล็อก)</span>' : rv && rv.state === 'fix' ? '<span class="cb-tag no">ส่งกลับแก้ไข</span>' : rv && rv.uploaded ? '<span class="cb-tag wt">ส่งเล่มแล้ว · รอตรวจ</span>' : '<span class="cb-tag gr">ยังไม่ส่งเล่ม</span>';
    var done = sessionsCounted().length;
    return '<div class="card cb-head"><div><h2>' + esc(c.name) + '</h2><div class="cb-mut">ภาคเรียนที่ ' + esc(c.semester) + '/' + esc(c.year) + ' · นักเรียน ' + activeMembers().length + ' คน · เช็คแล้ว ' + done + '/' + countable().length + ' ครั้ง</div>' +
      '<div class="cb-chips">' + c.teachers.map(function (t) { return '<span class="cb-chip' + (t.id === c.ownerId ? ' own' : '') + '"><i class="fa-solid fa-user-tie"></i> ' + esc(t.name) + (t.id === c.ownerId ? ' (ครูหลัก)' : '') + '</span>'; }).join('') + '</div></div>' + stTag + '</div>' +
      (D.past && D.ro && !D.locked ? '<div class="cb-info"><i class="fa-solid fa-eye"></i> ภาคเรียนที่ผ่านมาแล้ว — ดูได้อย่างเดียว</div>' : '') + (!D.past && D.ro && !D.locked ? '<div class="cb-info"><i class="fa-solid fa-eye"></i> ดูได้อย่างเดียว (สิทธิ์ดูผล)</div>' : '') +
      (D.locked ? '<div class="cb-info"><i class="fa-solid fa-lock"></i> เล่มรายงานผ่านการตรวจแล้ว — ข้อมูลชุมนุมถูกล็อก แก้ไขไม่ได้</div>' : '');
  }
  function activeMembers() { return D ? D.members.filter(function (m) { return !m.removedAt; }) : []; }
  function countable() { return (B.sessions || []).filter(function (s) { return !s.off; }); }
  function checkOf(date) { return D ? D.checks.filter(function (c) { return c.date === date; })[0] || null : null; }
  function sessionsCounted() { return countable().filter(function (s) { return !!checkOf(s.date); }); }

  // ---------- แท็บ: ข้อมูลชุมนุม (สร้าง / แก้ไข) ----------
  var pickT = null;
  function renderInfo() {
    var c = D ? D.club : { name: '', teacherIds: [B.me.id], ownerId: B.me.id, info: {} }, ro = D && D.ro;
    if (!pickT || pickT.club !== (D ? D.club.id : '')) pickT = { club: D ? D.club.id : '', ids: c.teacherIds.slice() };
    var nm = {}; B.teachers.forEach(function (t) { nm[t.id] = t.name; });
    var h = headHtml() + '<div class="card"><h3>' + (D ? 'ข้อมูลชุมนุม (แบบเสนอกิจกรรมชุมนุม)' : 'สร้างชุมนุม — ภาคเรียนที่ ' + esc(B.term.semester) + '/' + esc(B.term.year)) + '</h3>' +
      (!D ? '<p class="cb-mut">ครู 1 คน (ครูหลักหรือครูร่วม) มีได้ 1 ชุมนุมต่อภาคเรียน · รายละเอียดด้านล่างจะไปอยู่ใน "แบบเสนอกิจกรรมชุมนุม" ของเล่มรายงาน</p>' : '') +
      '<div class="cb-g2"><div><div class="field"><label>ชื่อชุมนุม *</label><input id="cbName" maxlength="120" value="' + esc(c.name) + '"' + (ro ? ' disabled' : '') + ' placeholder="เช่น นักอ่านตัวน้อย" /></div>' +
      '<div class="field"><label>ครูของชุมนุม (ครูหลัก + ครูร่วม)</label><div class="cb-chips" id="cbTeachers">' + pickT.ids.map(function (id) { return '<span class="cb-chip' + (id === c.ownerId ? ' own' : '') + '">' + esc(nm[id] || '-') + (id === c.ownerId ? ' (ครูหลัก)' : (ro ? '' : ' <button type="button" class="cb-x" data-t-del="' + esc(id) + '" aria-label="เอาออก"><i class="fa-solid fa-xmark"></i></button>')) + '</span>'; }).join('') +
      (ro ? '' : '<button type="button" class="btn btn-secondary btn-sm" data-t-add><i class="fa-solid fa-user-plus"></i> เพิ่มครูร่วม</button>') + '</div><p class="cb-mut">ครูที่มีชุมนุมแล้วในภาคเรียนนี้จะเลือกไม่ได้</p></div>' +
      INFO.slice(0, 1).map(infoField).join('') + '</div><div>' + INFO.slice(1, 3).map(infoField).join('') + '<div class="cb-g3">' + INFO.slice(3).map(infoField).join('') + '</div></div></div>' +
      (ro ? '' : '<div class="cb-actions">' + (!D ? '<button type="button" class="btn btn-secondary" data-copy-prev><i class="fa-solid fa-copy"></i> คัดลอกจากภาคเรียนก่อน</button>' : (D.club.ownerId === B.me.id || B.manager ? '<button type="button" class="btn btn-danger btn-sm" data-club-del><i class="fa-solid fa-trash"></i> ลบชุมนุม</button>' : '')) +
        '<span class="cb-sp"></span><button type="button" class="btn btn-success" data-club-save><i class="fa-solid fa-check"></i> ' + (D ? 'บันทึก' : 'สร้างชุมนุม') + '</button></div>') + '</div>';
    function infoField(f) { return '<div class="field"><label>' + f[1] + '</label>' + (f[2] ? '<textarea rows="4" data-info="' + f[0] + '"' + (ro ? ' disabled' : '') + '>' + esc(c.info[f[0]] || '') + '</textarea>' : '<input data-info="' + f[0] + '" value="' + esc(c.info[f[0]] || '') + '"' + (ro ? ' disabled' : '') + ' />') + '</div>'; }
    setBody(h);
  }
  function infoVals() { var o = {}; body.querySelectorAll('[data-info]').forEach(function (x) { o[x.getAttribute('data-info')] = x.value; }); return o; }
  function openTeacherPicker() {
    var mineClub = D ? D.club.id : '';
    var list = B.teachers.filter(function (t) { return pickT.ids.indexOf(t.id) === -1; });
    modal('เพิ่มครูร่วม', '<input type="search" id="cbTq" placeholder="ค้นหาชื่อครู" class="cb-search" /><div class="cb-pick" id="cbTl">' + list.map(function (t) {
      var busy = t.busy && (!D || t.busy !== D.club.name);
      return '<label class="cb-prow' + (busy ? ' dis' : '') + '" data-name="' + esc(t.name) + '"><input type="checkbox" value="' + esc(t.id) + '"' + (busy ? ' disabled' : '') + ' /> ' + esc(t.name) + (busy ? ' <span class="cb-tag gr">มีชุมนุม: ' + esc(t.busy) + '</span>' : '') + '</label>';
    }).join('') + '</div>', '<button type="button" class="btn btn-success" data-t-ok><i class="fa-solid fa-check"></i> เพิ่ม</button>');
    var mb = document.getElementById('cbModalBody');
    mb.oninput = function (e) { if (e.target.id === 'cbTq') { var q = e.target.value.trim(); mb.querySelectorAll('.cb-prow').forEach(function (r) { r.hidden = q && r.getAttribute('data-name').indexOf(q) === -1; }); } };
    document.getElementById('cbModalActions').onclick = function (e) { if (!e.target.closest('[data-t-ok]')) return; mb.querySelectorAll('input[type=checkbox]:checked').forEach(function (x) { if (pickT.ids.indexOf(x.value) === -1) pickT.ids.push(x.value); }); closeModal(); var keep = infoVals(), nmv = document.getElementById('cbName').value; renderInfo(); document.getElementById('cbName').value = nmv; body.querySelectorAll('[data-info]').forEach(function (x) { x.value = keep[x.getAttribute('data-info')] || ''; }); };
    void mineClub;
  }

  // ---------- แท็บ: นักเรียน ----------
  function renderStu() {
    var ro = D.ro, act = activeMembers(), gone = D.members.filter(function (m) { return m.removedAt; });
    var h = headHtml() + '<div class="card"><div class="cb-toolbar"><h3 style="margin:0">นักเรียนในชุมนุม (' + act.length + ' คน)</h3><span class="cb-sp"></span>' + (ro ? '' : '<button type="button" class="btn btn-primary btn-sm" data-stu-add><i class="fa-solid fa-user-plus"></i> เพิ่มนักเรียน</button>') + '</div>' +
      '<div class="cb-tbl-wrap"><table class="cb-tbl"><thead><tr><th>#</th><th>เลขประจำตัว</th><th>ชื่อ – สกุล</th><th>ห้อง</th><th></th></tr></thead><tbody>' +
      act.map(function (m, i) { return '<tr><td>' + (i + 1) + '</td><td>' + esc(m.code || '-') + '</td><td>' + esc(m.name) + '</td><td>' + room(m.roomId) + '</td><td class="r">' + (ro ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-stu-del="' + esc(m.id) + '" title="เอาออกจากชุมนุม"><i class="fa-solid fa-user-minus"></i></button>') + '</td></tr>'; }).join('') +
      (act.length ? '' : '<tr><td colspan="5" class="cb-mut">ยังไม่มีนักเรียน — กด "เพิ่มนักเรียน"</td></tr>') + '</tbody></table></div>' +
      (gone.length ? '<p class="cb-mut" style="margin-top:8px"><i class="fa-solid fa-clock-rotate-left"></i> ออกจากชุมนุมแล้ว: ' + gone.map(function (m) { return esc(m.name) + ' (' + thD(String(m.removedAt).slice(0, 10)) + ')'; }).join(' · ') + '</p>' : '') + '</div>';
    setBody(h);
  }
  async function openAddStudents() {
    var stop = lazyLoad();
    var r; try { r = await apiCall('clubStudents', { clubId: D.club.id }); } catch (e) { stop(); showToast(e.message, true); return; } stop();
    var map = r.map || {}, mine = {}; activeMembers().forEach(function (m) { mine[m.id] = 1; });
    var all = r.students.filter(function (s) { return !mine[s.id]; });
    var a = st.add; a.pick = {};
    var grades = {}; all.forEach(function (s) { var g = (/^m(\d)_/.exec(s.roomId) || [])[1]; if (g) grades[g] = 1; });
    function rooms() { var o = {}; all.forEach(function (s) { if (!a.g || s.roomId.indexOf('m' + a.g + '_') === 0) o[s.roomId] = 1; }); return Object.keys(o).sort(function (x, y) { return x.localeCompare(y, undefined, { numeric: true }); }); }
    function list() {
      return all.filter(function (s) { return (!a.g || s.roomId.indexOf('m' + a.g + '_') === 0) && (!a.room || s.roomId === a.room) && (!a.q || (s.name + ' ' + s.code).indexOf(a.q) !== -1); });
    }
    function draw() {
      var L = list();
      document.getElementById('cbAddList').innerHTML = L.slice(0, 400).map(function (s) {
        var other = (map[s.id] || [])[0];
        return '<label class="cb-prow' + (other ? ' warn' : '') + '"><input type="checkbox" value="' + esc(s.id) + '"' + (a.pick[s.id] ? ' checked' : '') + ' /> <span class="cb-pn">' + esc(s.name) + '</span> <span class="cb-mut">' + room(s.roomId) + (s.code && s.code !== '00000' ? ' · ' + esc(s.code) : '') + '</span>' + (other ? ' <span class="cb-tag wt">อยู่ชุมนุม ' + esc(other.name) + '</span>' : '') + '</label>';
      }).join('') + (L.length > 400 ? '<p class="cb-mut">แสดง 400 คนแรก — กรองห้องหรือค้นหาเพิ่ม</p>' : '') + (L.length ? '' : '<p class="cb-mut">ไม่พบนักเรียน</p>');
      document.getElementById('cbAddN').textContent = Object.keys(a.pick).length;
    }
    modal('เพิ่มนักเรียนเข้าชุมนุม', '<div class="cb-toolbar"><select id="cbAg"><option value="">ทุกระดับชั้น</option>' + Object.keys(grades).sort().map(function (g) { return '<option value="' + g + '"' + (a.g === g ? ' selected' : '') + '>ม.' + g + '</option>'; }).join('') + '</select><select id="cbAr"></select><input type="search" id="cbAq" class="cb-search" placeholder="ค้นหาชื่อ / เลขประจำตัว" value="' + esc(a.q) + '" /><button type="button" class="btn btn-secondary btn-sm" data-add-all><i class="fa-solid fa-check-double"></i> เลือกทั้งหมดที่แสดง</button></div>' +
      '<div class="cb-pick tall" id="cbAddList"></div><p class="cb-mut">เลือกแล้ว <b id="cbAddN">0</b> คน · นักเรียนที่อยู่ชุมนุมอื่นแล้ว ' + (D.manager ? 'แอดมินย้ายมาได้ (ระบบจะเอาออกจากชุมนุมเดิม)' : 'ใส่ไม่ได้ — ติดต่อแอดมินงานชุมนุม') + '</p>',
      '<button type="button" class="btn btn-success" data-add-ok><i class="fa-solid fa-user-plus"></i> เพิ่มนักเรียน</button>');
    function fillRooms() { document.getElementById('cbAr').innerHTML = '<option value="">ทุกห้อง</option>' + rooms().map(function (x) { return '<option value="' + x + '"' + (a.room === x ? ' selected' : '') + '>' + room(x) + '</option>'; }).join(''); }
    fillRooms(); draw();
    var mb = document.getElementById('cbModalBody');
    mb.onchange = function (e) {
      if (e.target.id === 'cbAg') { a.g = e.target.value; a.room = ''; fillRooms(); draw(); }
      else if (e.target.id === 'cbAr') { a.room = e.target.value; draw(); }
      else if (e.target.type === 'checkbox') { if (e.target.checked) a.pick[e.target.value] = 1; else delete a.pick[e.target.value]; document.getElementById('cbAddN').textContent = Object.keys(a.pick).length; }
    };
    mb.oninput = function (e) { if (e.target.id === 'cbAq') { a.q = e.target.value.trim(); draw(); } };
    mb.onclick = function (e) { if (e.target.closest('[data-add-all]')) { list().forEach(function (s) { if (!(map[s.id] || []).length || D.manager) a.pick[s.id] = 1; }); draw(); } };
    document.getElementById('cbModalActions').onclick = async function (e) {
      if (!e.target.closest('[data-add-ok]')) return;
      var ids = Object.keys(a.pick); if (!ids.length) { showToast('ยังไม่ได้เลือกนักเรียน', true); return; }
      var res = await withProgress('กำลังเพิ่มนักเรียน', function () { return apiCall('clubMembersAdd', { clubId: D.club.id, studentIds: ids }); }, { successLabel: 'เพิ่มนักเรียนแล้ว' });
      if (!res.ok) return;
      if (res.data.conflicts && res.data.conflicts.length) {
        var txt = res.data.conflicts.map(function (c) { return c.name + ' (' + room(c.roomId) + ') อยู่ชุมนุม ' + c.club; }).join('\n');
        if (!res.data.canMove) { showToast('มีนักเรียนอยู่ชุมนุมอื่นแล้ว ' + res.data.conflicts.length + ' คน — ติดต่อแอดมินงานชุมนุม', true); return; }
        if (!(await askConfirm('นักเรียนต่อไปนี้อยู่ชุมนุมอื่นแล้ว ย้ายมาชุมนุมนี้?\n' + txt, 'ย้ายนักเรียน'))) return;
        var r2 = await withProgress('กำลังย้ายนักเรียน', function () { return apiCall('clubMembersAdd', { clubId: D.club.id, studentIds: ids, move: true }); }, { successLabel: 'ย้ายและเพิ่มนักเรียนแล้ว' });
        if (!r2.ok) return;
      }
      closeModal(); await reloadClub(); renderTabs(true);
    };
  }

  // ---------- แท็บ: เช็คชื่อ (ย้อนหลัง/แก้ไข · มีประวัติ) ----------
  function memOn(date) { return D.members.filter(function (m) { return !m.removedAt || String(m.removedAt).slice(0, 10) > date || (checkOf(date) && checkOf(date).data[m.id]); }); }
  function renderCheck() {
    var ss = B.sessions || [];
    if (!ss.length) { setBody(headHtml() + '<div class="card cb-empty"><i class="fa-solid fa-calendar-xmark"></i><p>แอดมินยังไม่ได้กำหนดวันชุมนุมของภาคเรียนนี้</p></div>'); return; }
    if (!st.sel || !ss.some(function (s) { return s.date === st.sel; })) { var cand = ss.filter(function (s) { return !s.off && s.date <= B.today && !checkOf(s.date); })[0] || ss.filter(function (s) { return s.date <= B.today; }).slice(-1)[0] || ss[0]; st.sel = cand.date; }
    var s = ss.filter(function (x) { return x.date === st.sel; })[0], ck = checkOf(s.date), ro = D.ro || s.off || s.date > B.today;
    var chips = '<div class="cb-sess">' + ss.map(function (x) {
      var c = checkOf(x.date), cls = x.off ? 'off' : c ? 'ok' : x.date > B.today ? 'fut' : 'no';
      return '<button type="button" class="cb-sc ' + cls + (x.date === st.sel ? ' sel' : '') + '" data-sess="' + x.date + '"><b>ครั้งที่ ' + x.no + '</b><span>' + thD(x.date) + (x.off ? ' · หยุด' : c ? ' ✓' : '') + '</span></button>';
    }).join('') + '</div>';
    var mem = memOn(s.date), data = ck ? ck.data : {};
    var logs = D.logs.filter(function (l) { return l.date === s.date; });
    var h = headHtml() + '<div class="card">' + chips +
      '<div class="cb-ckhead"><div><h3 style="margin:0">ครั้งที่ ' + s.no + ' · ' + thDW(s.date) + '</h3><div class="cb-mut">' + (s.off ? 'วันหยุด — ไม่นับในการเข้าร่วม' : s.date > B.today ? 'ยังไม่ถึงวันชุมนุม' : ck ? 'เช็คแล้ว · แก้ไขได้' : 'ยังไม่เช็ค · บันทึกย้อนหลังได้') + ' · 1 ครั้ง = 1 ชั่วโมง</div></div>' +
      (logs.length ? '<div class="cb-log"><i class="fa-solid fa-clock-rotate-left"></i> ' + logs.slice(0, 3).map(function (l) { return esc(l.by || (l.via === 'att' ? 'เว็บเช็คชื่อ' : '-')) + ' · ' + ({ create: 'เช็คชื่อ', edit: 'แก้ไข', late: 'บันทึกย้อนหลัง' }[l.kind] || l.kind) + (l.via === 'att' ? ' (เว็บเช็คชื่อ)' : '') + ' · ' + esc(formatDateTimeThai(l.at)); }).join('<br>') + '</div>' : '') + '</div>';
    if (s.off || s.date > B.today) { setBody(h + '</div>'); return; }
    h += '<div class="field"><label>กิจกรรมที่ทำวันนี้ * <span class="cb-mut">(ลง "แบบบันทึกการจัดกิจกรรมชุมนุม" ในเล่ม)</span></label><textarea id="cbAct" rows="2" maxlength="600"' + (ro ? ' disabled' : '') + '>' + esc(ck ? ck.activity : '') + '</textarea></div>' +
      '<div class="cb-toolbar">' + (ro ? '' : '<button type="button" class="btn btn-secondary btn-sm" data-all-present><i class="fa-solid fa-check-double"></i> มาทั้งหมด</button>') + '<input type="search" id="cbCq" class="cb-search" placeholder="ค้นหาชื่อ" /><span class="cb-sp"></span><span class="cb-mut" id="cbCount"></span></div>' +
      '<div class="cb-tbl-wrap"><table class="cb-tbl"><thead><tr><th>#</th><th>ชื่อ – สกุล</th><th>ห้อง</th><th>สถานะ</th></tr></thead><tbody id="cbCk">' +
      mem.map(function (m, i) { return '<tr data-sid="' + esc(m.id) + '" data-name="' + esc(m.name) + '"><td>' + (i + 1) + '</td><td>' + esc(m.name) + (m.removedAt ? ' <span class="cb-tag gr">ออกแล้ว</span>' : '') + '</td><td>' + room(m.roomId) + '</td><td><div class="cb-st">' + STATUS.map(function (x) { return '<button type="button" data-st="' + x + '" class="' + (data[m.id] === x ? 'on' : '') + '" style="--c:' + SCOLOR[x] + '"' + (ro ? ' disabled' : '') + '>' + x + '</button>'; }).join('') + '</div></td></tr>'; }).join('') +
      (mem.length ? '' : '<tr><td colspan="4" class="cb-mut">ยังไม่มีนักเรียนในชุมนุม</td></tr>') + '</tbody></table></div>' +
      (ro ? '' : '<div class="cb-actions"><span class="cb-sp"></span><button type="button" class="btn btn-success" data-ck-save><i class="fa-solid fa-check"></i> บันทึกการเช็คชื่อ</button></div>') + '</div>';
    setBody(h); countCk();
  }
  function countCk() { var el = document.getElementById('cbCount'); if (!el) return; var n = { 'มา': 0, 'สาย': 0, 'ลาป่วย': 0, 'ลากิจ': 0, 'ขาด': 0 }, empty = 0; body.querySelectorAll('#cbCk tr[data-sid]').forEach(function (tr) { var on = tr.querySelector('button.on'); if (on) n[on.getAttribute('data-st')]++; else empty++; }); el.textContent = 'มา ' + n['มา'] + ' · สาย ' + n['สาย'] + ' · ลา ' + (n['ลาป่วย'] + n['ลากิจ']) + ' · ขาด ' + n['ขาด'] + (empty ? ' · ยังไม่เลือก ' + empty : ''); }

  // ---------- แท็บ: รูปกิจกรรม ----------
  function renderPhoto() {
    var ro = D.ro, ph = {}; D.club.photos.forEach(function (p) { ph[p.idx] = p; });
    var h = headHtml() + '<div class="card"><h3>รูปภาพหลักฐานการดำเนินกิจกรรม <span class="cb-mut">(4 รูป ใน 1 ภาคเรียน · ใช้ในเล่มรายงาน)</span></h3><div class="cb-photos">' + [0, 1, 2, 3].map(function (i) {
      var p = ph[i];
      if (!p) return '<div class="cb-ph empty">' + (ro ? '<span>ไม่มีรูป</span>' : '<button type="button" class="cb-phadd" data-ph-add="' + i + '"><i class="fa-solid fa-camera"></i><b>เพิ่มรูปที่ ' + (i + 1) + '</b><span>ถ่าย / เลือกจากเครื่อง</span></button>') + '</div>';
      return '<div class="cb-ph"><div class="cb-phimg"><img src="' + esc(p.src) + '" alt="รูปกิจกรรม ' + (i + 1) + '" referrerpolicy="no-referrer" loading="lazy" />' + (ro ? '' : '<button type="button" class="cb-phx" data-ph-del="' + i + '" aria-label="ลบรูป"><i class="fa-solid fa-xmark"></i></button>') + '</div>' +
        '<div class="field"><label>บันทึกการทำกิจกรรม</label><input data-ph-cap="' + i + '" maxlength="200" value="' + esc(p.caption) + '"' + (ro ? ' disabled' : '') + ' placeholder="เช่น นักเรียนแลกเปลี่ยนความคิดเห็นเรื่องที่อ่าน" /></div>' +
        '<div class="cb-inl"><div class="field" style="flex:1"><label>วัน/เดือน/ปี</label><input type="date" data-ph-date="' + i + '" value="' + esc(p.date) + '"' + (ro ? ' disabled' : '') + ' /></div>' + (ro ? '' : '<button type="button" class="btn btn-secondary btn-sm" data-ph-meta="' + i + '"><i class="fa-solid fa-check"></i> บันทึก</button>') + '</div></div>';
    }).join('') + '</div><p class="cb-mut">ระบบย่อรูปให้อัตโนมัติ · รูปเก็บใน Google Drive ของโรงเรียน (โฟลเดอร์ชุมนุม)</p></div>';
    setBody(h);
  }
  function shrinkImage(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () { var max = 1400, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { b ? res(new File([b], 'photo.jpg', { type: 'image/jpeg' })) : rej(new Error('ย่อรูปไม่ได้')); }, 'image/jpeg', 0.82); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('เปิดรูปนี้ไม่ได้')); };
      img.src = url;
    });
  }
  document.getElementById('cbPhotoFile').addEventListener('change', async function () {
    var file = this.files && this.files[0], idx = +this.__idx; this.value = ''; if (!file) return;
    var r = await withProgress('กำลังอัปโหลดรูป', async function (p) {
      var jf = await shrinkImage(file);
      var prep = await apiCall('clubPhotoPrepare', { clubId: D.club.id, idx: idx, fileName: 'photo.jpg', mimeType: 'image/jpeg', fileSize: jf.size, direct: 1, origin: location.origin });
      var res = await sendPreparedFileProgress(prep, jf, p, 10, 92, 'กำลังอัปโหลดรูป', { filename: prep.uploadFileName, mimeType: 'image/jpeg' });
      return apiCall('clubPhotoFinalize', { clubId: D.club.id, idx: idx, pid: prep.pid, fileId: res.fileId, fileUrl: res.url, directUrl: res.directUrl, fileName: prep.uploadFileName, via: res.via, fallbackReason: res.fallbackReason || '' });
    }, { successLabel: 'เพิ่มรูปแล้ว', upload: true });
    if (r.ok) { await reloadClub(); renderTabs(true); }
  });

  // ---------- แท็บ: สรุปและส่งเล่ม ----------
  function statsOf(m) {
    var o = { 'มา': 0, 'สาย': 0, 'ลาป่วย': 0, 'ลากิจ': 0, 'ขาด': 0, rec: 0 };
    sessionsCounted().forEach(function (s) { var v = checkOf(s.date).data[m.id]; if (v && o[v] !== undefined) { o[v]++; o.rec++; } });
    o.hours = o['มา'] + o['สาย']; o.pct = o.rec ? Math.round(o.hours / o.rec * 100) : null; return o;
  }
  var sumRes = null;
  function renderSum() {
    var ro = D.ro, act = activeMembers(), cfgOk = !!B.categoryId;
    if (!sumRes || sumRes.club !== D.club.id) sumRes = { club: D.club.id, r: Object.assign({}, D.club.results) };
    var R = sumRes.r, nPass = 0, nFail = 0; act.forEach(function (m) { if (R[m.id] === 'pass') nPass++; else if (R[m.id] === 'fail') nFail++; });
    var ready = [['แบบเสนอกิจกรรม', !!(D.club.info.rationale && D.club.info.objectives)], ['เช็คชื่อครบทุกครั้ง (' + sessionsCounted().length + '/' + countable().filter(function (s) { return s.date <= B.today; }).length + ')', countable().filter(function (s) { return s.date <= B.today; }).every(function (s) { return !!checkOf(s.date); })], ['รูปกิจกรรม 4 รูป (' + D.club.photos.length + '/4)', D.club.photos.length >= 4], ['เลือกผลครบ (' + (nPass + nFail) + '/' + act.length + ' คน)', act.length > 0 && nPass + nFail === act.length], ['บันทึกสรุป (ปัญหาที่พบ / การแก้ไข)', !!(D.club.summary.problems && D.club.summary.fixes)]];
    var rv = D.review;
    var h = headHtml() + '<div class="cb-g2 wide"><div class="card"><div class="cb-toolbar"><h3 style="margin:0">สถิติการเข้าร่วมรายคน</h3><span class="cb-sp"></span>' + (ro ? '' : '<button type="button" class="btn btn-secondary btn-sm" data-res-auto title="เลือกผ่านให้คนที่เข้าร่วม 80% ขึ้นไป (แก้ทีละคนได้)"><i class="fa-solid fa-wand-magic-sparkles"></i> เลือกตามสถิติ 80%</button>') + '</div>' +
      '<div class="cb-tbl-wrap"><table class="cb-tbl"><thead><tr><th>ชื่อ – สกุล</th><th>มา</th><th>สาย</th><th>ลา</th><th>ขาด</th><th>ชั่วโมง</th><th>เข้าร่วม</th><th>ผล (ครูเลือก)</th></tr></thead><tbody>' +
      act.map(function (m) { var s = statsOf(m), c = s.pct == null ? '#94a3b8' : s.pct >= 80 ? '#16a34a' : '#dc2626'; return '<tr><td>' + esc(m.name) + ' <span class="cb-mut">' + room(m.roomId) + '</span></td><td>' + s['มา'] + '</td><td>' + s['สาย'] + '</td><td>' + (s['ลาป่วย'] + s['ลากิจ']) + '</td><td>' + s['ขาด'] + '</td><td>' + s.hours + '</td><td class="nw"><span class="cb-bar"><i style="width:' + (s.pct || 0) * 0.7 + 'px;background:' + c + '"></i></span> <b style="color:' + c + '">' + (s.pct == null ? '-' : s.pct + '%') + '</b></td><td><div class="cb-st sm"><button type="button" data-res="pass" data-sid="' + esc(m.id) + '" class="' + (R[m.id] === 'pass' ? 'on' : '') + '" style="--c:#16a34a"' + (ro ? ' disabled' : '') + '>ผ่าน</button><button type="button" data-res="fail" data-sid="' + esc(m.id) + '" class="' + (R[m.id] === 'fail' ? 'on' : '') + '" style="--c:#dc2626"' + (ro ? ' disabled' : '') + '>ไม่ผ่าน</button></div></td></tr>'; }).join('') +
      '</tbody></table></div><p class="cb-mut">สถิติเป็นข้อมูลประกอบ ครูพิจารณาผลเอง · ผ่าน ' + nPass + ' · ไม่ผ่าน ' + nFail + ' · ยังไม่เลือก ' + (act.length - nPass - nFail) + ' · วันหยุดไม่นับ</p></div>' +
      '<div><div class="card"><h3>บันทึกสรุป</h3><div class="field"><label>ปัญหาที่พบ</label><textarea id="cbProb" rows="4"' + (ro ? ' disabled' : '') + '>' + esc(D.club.summary.problems || '') + '</textarea></div><div class="field"><label>การแก้ไข</label><textarea id="cbFix" rows="4"' + (ro ? ' disabled' : '') + '>' + esc(D.club.summary.fixes || '') + '</textarea></div>' +
      (ro ? '' : '<div class="cb-actions"><span class="cb-sp"></span><button type="button" class="btn btn-success btn-sm" data-sum-save><i class="fa-solid fa-check"></i> บันทึกผลและสรุป</button></div>') + '</div>' +
      '<div class="card"><h3>ความพร้อมของเล่ม</h3><ul class="cb-ready">' + ready.map(function (x) { return '<li class="' + (x[1] ? 'ok' : '') + '"><i class="fa-solid ' + (x[1] ? 'fa-circle-check' : 'fa-circle') + '"></i> ' + x[0] + '</li>'; }).join('') + '</ul>' +
      (rv ? '<div class="cb-info"><b>เล่มที่ส่งล่าสุด:</b> ' + esc(formatDateTimeThai(rv.at)) + ' · ' + (rv.state === 'ok' ? 'ผ่านการตรวจ' : rv.state === 'fix' ? 'ส่งกลับแก้ไข' + (rv.note ? ': ' + esc(rv.note) : '') : 'รอตรวจ') + (rv.url ? ' · <a href="' + esc(rv.url) + '" target="_blank" rel="noopener">เปิดไฟล์</a>' : '') + '</div>' : '') +
      '<div class="cb-actions"><button type="button" class="btn btn-secondary" data-book="preview"><i class="fa-solid fa-eye"></i> ดูตัวอย่างเล่ม</button><span class="cb-sp"></span>' + (ro ? '' : '<button type="button" class="btn btn-success" data-book="send"' + (cfgOk ? '' : ' disabled title="แอดมินยังไม่ได้เลือกประเภทงานที่ส่งเล่ม"') + '><i class="fa-solid fa-paper-plane"></i> ' + (rv && rv.state === 'fix' ? 'สร้างเล่มใหม่และส่งแก้' : rv ? 'สร้างเล่มใหม่และส่งอีกครั้ง' : 'สร้างเล่มและส่งตรวจ') + '</button>') + '</div>' +
      (cfgOk ? '<p class="cb-mut">ส่งเข้าระบบตรวจผลงาน (ผ่าน / ส่งกลับแก้ไข) · ผ่านแล้วข้อมูลชุมนุมจะถูกล็อก</p>' : '<p class="cb-mut">แอดมินยังไม่ได้เลือกประเภทงานที่ใช้ส่งเล่ม (แท็บ "ตั้งค่าชุมนุม")</p>') + '<p class="cb-mut">สร้างเล่มบนคอมพิวเตอร์จะเร็วกว่า</p></div></div></div>';
    setBody(h);
  }

  // ---------- เล่มรายงาน (PDF) ----------
  async function toDataUrl(url) { try { var b = await (await fetch(url, { mode: 'cors' })).blob(); return await new Promise(function (r) { var fr = new FileReader(); fr.onload = function () { r(fr.result); }; fr.onerror = function () { r(''); }; fr.readAsDataURL(b); }); } catch (e) { return ''; } }
  // 2.00.6: เล่มรายงานแบบใหม่ — ปกเล่ม · หัว/ท้ายกระดาษ · หัวข้อมีแถบสี · ตารางสลับสี · รูป 4:3 ตัดให้พอดี (ไม่บีบ)
  var BK = { name: '', term: '' };
  function pg(inner, n, tot, school, cover) {
    if (cover) return '<div class="bk-page cover">' + inner + '</div>';
    return '<div class="bk-page"><div class="bk-hd"><span>' + esc(school || '') + '</span><span>ชุมนุม' + esc(BK.name) + '</span></div>' + inner + '<div class="bk-ft"><span>' + esc(BK.term) + '</span><span>หน้า ' + n + ' / ' + tot + '</span></div></div>';
  }
  function paraHtml(t) { return String(t || '').split(/\n/).map(function (l) { return l.trim() ? '<p>' + esc(l) + '</p>' : '<p class="sp"></p>'; }).join(''); }
  function secH(title, sub) { return '<div class="bk-sec"><h2>' + title + '</h2>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>'; }
  function sigHtml(list) { return '<div class="bk-sig">' + list.map(function (x) { return '<div><div class="ln"></div>(' + esc(x[0]) + ')<br><span>' + esc(x[1]) + '</span></div>'; }).join('') + '</div>'; }
  // รูปตัดกลางให้ได้อัตราส่วนพอดีกรอบ (html2canvas ไม่รองรับ object-fit — เดิมรูปถูกบีบ)
  function cropCover(src, W, H) {
    return new Promise(function (res) {
      if (!src) { res(''); return; }
      var im = new Image();
      im.onload = function () { var iw = im.naturalWidth, ih = im.naturalHeight, r = W / H, sw = iw, sh = iw / r; if (sh > ih) { sh = ih; sw = ih * r; } var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); x.drawImage(im, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, W, H); try { res(c.toDataURL('image/jpeg', 0.88)); } catch (e) { res(src); } };
      im.onerror = function () { res(''); }; im.src = src;
    });
  }
  async function buildBook(p) {
    var c = D.club, stg = await getSiteSettings().catch(function () { return {}; }) || {}, school = stg.schoolName || 'โรงเรียน';
    p && p.setLabel && p.setLabel('กำลังเตรียมข้อมูล...');
    var logo = stg.logoDataUrl ? (String(stg.logoDataUrl).indexOf('data:') === 0 ? stg.logoDataUrl : await toDataUrl(stg.logoDataUrl)) : '';
    var photos = [];
    for (var i = 0; i < c.photos.length; i++) { var src = ''; try { src = (await apiCall('clubPhotoData', { clubId: c.id, idx: c.photos[i].idx })).dataUrl; } catch (e) { src = ''; } photos.push({ src: await cropCover(src, 1200, 900), cap: c.photos[i].caption, date: c.photos[i].date }); }
    var act = activeMembers(), R = c.results, nPass = act.filter(function (m) { return R[m.id] === 'pass'; }).length, nFail = act.filter(function (m) { return R[m.id] === 'fail'; }).length;
    var tnames = c.teachers.map(function (t) { return t.name; }), sess = sessionsCounted();
    var parts = [], term = 'ภาคเรียนที่ ' + c.semester + ' ปีการศึกษา ' + c.year, logoH = logo ? '<img class="bk-logo" src="' + logo + '" alt="" />' : '';
    BK = { name: c.name, term: term };
    var rv = D.review, totHrs = 0, totRec = 0;
    act.forEach(function (m) { var s = statsOf(m); totHrs += s.hours; totRec += s.rec; });
    var avg = totRec ? Math.round(totHrs / totRec * 100) : null;
    // 0. ปก
    parts.push({ cover: true, html: '<div class="cv-top">' + logoH + '<div class="cv-school">' + esc(school) + '</div></div><div class="cv-mid"><div class="cv-kicker">รายงานการจัดกิจกรรมชุมนุม</div><div class="cv-name">' + esc(c.name) + '</div><div class="cv-term">' + term + '</div></div>' +
      '<div class="cv-box"><div><span>ครูที่ปรึกษากิจกรรมชุมนุม</span>' + tnames.map(function (n) { return '<b>' + esc(n) + '</b>'; }).join('') + '</div><div class="cv-stats"><div><b>' + act.length + '</b><span>นักเรียน</span></div><div><b>' + sess.length + '</b><span>ครั้งที่จัด</span></div><div><b>' + (avg == null ? '-' : avg + '%') + '</b><span>เข้าร่วมเฉลี่ย</span></div></div></div>' });
    // 1. แบบบันทึกผลการเรียน
    parts.push('<div class="bk-c">' + logoH + '<h1>แบบบันทึกผลการเรียนกิจกรรมชุมนุม</h1><div class="bk-sub">' + term + '</div></div>' +
      '<table class="bk-kv"><tr><th>กิจกรรมชุมนุม</th><td>' + esc(c.name) + '</td></tr><tr><th>ครูที่ปรึกษากิจกรรมชุมนุม</th><td>' + esc(tnames.join(' · ')) + '</td></tr></table>' +
      '<div class="bk-h3">การอนุมัติผลการเรียนกิจกรรม</div><div class="bk-stat"><div><span>นักเรียนทั้งหมด</span><b>' + act.length + '</b></div><div class="g"><span>ผ่าน (ผ)</span><b>' + nPass + '</b></div><div class="r"><span>ไม่ผ่าน (มผ.)</span><b>' + nFail + '</b></div></div>' +
      '<div class="bk-h3">การส่งและตรวจในระบบ</div><table class="bk-t"><tr><th>ขั้นตอน</th><th>ผล</th><th>วันที่</th></tr><tr><td class="l">ส่งรายงาน</td><td>' + (rv ? 'ส่งแล้ว' : 'ส่งพร้อมเล่มนี้') + '</td><td>' + thD(String(rv ? rv.at : new Date().toISOString()).slice(0, 10), true) + '</td></tr><tr><td class="l">ตรวจรายงาน</td><td>' + (rv && rv.state === 'ok' ? 'ผ่าน' : 'รอตรวจ') + '</td><td>-</td></tr></table>' +
      sigHtml(tnames.map(function (n) { return [n, 'ครูที่ปรึกษากิจกรรมชุมนุม']; }).concat((B.signers || []).map(function (x) { return [x.name, x.title]; }))));
    // 2-4. ข้อความคงที่
    [['ขั้นตอนการจัดทำและส่งเล่มเอกสาร', B.texts.steps], ['กิจกรรมชุมนุม', B.texts.aims], ['เกณฑ์การตัดสินและแนวทางการแก้ไข', B.texts.criteria]].forEach(function (x) { parts.push(secH(x[0]) + '<div class="bk-txt">' + paraHtml(x[1]) + '</div>'); });
    // 5. แบบเสนอกิจกรรมชุมนุม
    parts.push(secH('แบบเสนอกิจกรรมชุมนุม', term) + '<table class="bk-kv"><tr><th>ชื่อกิจกรรมชุมนุม</th><td>' + esc(c.name) + '</td></tr></table>' +
      INFO.filter(function (f) { return f[2]; }).map(function (f) { return '<div class="bk-fld"><div class="lb">' + f[1] + '</div><div class="bk-txt">' + paraHtml(c.info[f[0]] || '-') + '</div></div>'; }).join('') +
      '<div class="bk-g3">' + INFO.filter(function (f) { return !f[2]; }).map(function (f) { return '<div class="bk-fld"><div class="lb">' + f[1] + '</div><div class="bk-txt">' + paraHtml(c.info[f[0]] || '-') + '</div></div>'; }).join('') + '</div>');
    // 6. รายชื่อนักเรียน (+ผล)
    for (var a = 0; a < Math.max(1, act.length); a += 28) parts.push(secH('รายชื่อนักเรียน', 'กิจกรรมชุมนุม' + esc(c.name) + ' · ' + act.length + ' คน') + '<table class="bk-t z"><tr><th style="width:44px">ที่</th><th style="width:110px">เลขประจำตัว</th><th>ชื่อ – สกุล</th><th style="width:60px">ชั้น</th><th style="width:60px">ห้อง</th><th style="width:70px">ผล</th></tr>' + act.slice(a, a + 28).map(function (m, i) { var rr = /m(\d+)_(\d+)/.exec(m.roomId) || []; return '<tr><td>' + (a + i + 1) + '</td><td>' + esc(m.code && m.code !== '00000' ? m.code : '-') + '</td><td class="l">' + esc(m.name) + '</td><td>ม.' + (rr[1] || '') + '</td><td>' + (rr[2] || '') + '</td><td>' + (R[m.id] === 'pass' ? '<b class="gr">ผ</b>' : R[m.id] === 'fail' ? '<b class="red">มผ.</b>' : '') + '</td></tr>'; }).join('') + '</table>');
    // 7. แบบเช็คเวลา
    var cols = sess.slice(0, 24);
    for (var b = 0; b < Math.max(1, act.length); b += 24) parts.push(secH('แบบเช็คเวลาการเข้าร่วมกิจกรรมชุมนุม', 'กิจกรรมชุมนุม' + esc(c.name) + ' · 1 ครั้ง = 1 ชั่วโมง') + '<table class="bk-t sm z"><tr><th rowspan="2" style="width:28px">ที่</th><th rowspan="2">ชื่อ – สกุล</th><th rowspan="2" style="width:36px">ห้อง</th><th colspan="' + Math.max(1, cols.length) + '">ครั้งที่ / วันที่</th><th rowspan="2" style="width:38px">รวม<br>ชม.</th></tr><tr>' + (cols.map(function (s) { var dd = dP(s.date); return '<th class="v">' + s.no + '<br><small>' + dd.getDate() + '/' + (dd.getMonth() + 1) + '</small></th>'; }).join('') || '<th>-</th>') + '</tr>' +
      act.slice(b, b + 24).map(function (m, i) { var tot = 0; return '<tr><td>' + (b + i + 1) + '</td><td class="l">' + esc(m.name) + '</td><td>' + room(m.roomId).replace('ม.', '') + '</td>' + (cols.map(function (s) { var v = checkOf(s.date).data[m.id] || ''; if (v === 'มา' || v === 'สาย') tot++; return '<td class="' + (v === 'ขาด' ? 'red' : v === 'มา' ? 'gr' : v ? 'am' : '') + '">' + (CODE[v] || '') + '</td>'; }).join('') || '<td></td>') + '<td><b>' + tot + '</b></td></tr>'; }).join('') + '</table><div class="bk-legend"><span class="gr">✓ มา</span><span class="am">ส สาย (นับเป็นมา)</span><span class="am">ป ลาป่วย</span><span class="am">ล ลากิจ</span><span class="red">ข ขาด</span><span>วันหยุดไม่นับ</span></div>');
    // 8. แบบบันทึกการจัดกิจกรรม
    for (var d = 0; d < Math.max(1, sess.length); d += 10) parts.push(secH('แบบบันทึกการจัดกิจกรรมชุมนุม', 'กิจกรรมชุมนุม' + esc(c.name)) + '<table class="bk-t z"><tr><th style="width:100px">ครั้งที่ / วันที่</th><th>รายการสอน / การทำกิจกรรม</th><th style="width:160px">ครูผู้สอน</th></tr>' + sess.slice(d, d + 10).map(function (s) { return '<tr><td><b>' + s.no + '</b><br><small>' + thD(s.date, true) + '</small></td><td class="l tall">' + esc(checkOf(s.date).activity) + '</td><td class="sm">' + esc(tnames.join(', ')) + '</td></tr>'; }).join('') + '</table>');
    // 9. บันทึกสรุป
    parts.push(secH('บันทึกสรุป', 'การดำเนินการแก้ไขปัญหาและข้อเสนอแนะ') + '<div class="bk-fld"><div class="lb">ปัญหาที่พบ</div><div class="bk-txt box">' + paraHtml(c.summary.problems || '-') + '</div></div><div class="bk-fld"><div class="lb">การแก้ไข</div><div class="bk-txt box">' + paraHtml(c.summary.fixes || '-') + '</div></div>' + sigHtml(tnames.map(function (n) { return [n, 'ครูที่ปรึกษากิจกรรมชุมนุม']; })));
    // 10. รูป (2 รูปต่อหน้า · 4:3 ตัดให้พอดีกรอบ)
    for (var e2 = 0; e2 < photos.length; e2 += 2) parts.push(secH('รูปภาพการจัดกิจกรรมชุมนุม', 'กิจกรรมชุมนุม' + esc(c.name)) + photos.slice(e2, e2 + 2).map(function (x, k) { return '<div class="bk-ph"><div class="im">' + (x.src ? '<img src="' + x.src + '" alt="" />' : '<div class="bk-noph">ไม่มีรูป</div>') + '</div><div class="cap"><span class="no">รูปที่ ' + (e2 + k + 1) + '</span><div><b>บันทึกการทำกิจกรรม</b> ' + esc(x.cap || '-') + '</div><div class="dt"><i>วัน/เดือน/ปี</i> ' + (x.date ? thD(x.date, true) : '-') + '</div></div></div>'; }).join(''));
    return { parts: parts, school: school, name: c.name };
  }
  var BOOK_CSS = '.bk-page{position:relative;width:794px;height:1123px;box-sizing:border-box;padding:66px 62px 58px;background:#fff;color:#0f172a;font-family:Sarabun,"Noto Sans Thai",sans-serif;font-size:15px;line-height:1.65;overflow:hidden}' +
    '.bk-page *{box-sizing:border-box}.bk-hd{position:absolute;top:24px;left:62px;right:62px;display:flex;justify-content:space-between;font-size:11.5px;color:#64748b;border-bottom:2px solid #4338ca;padding-bottom:5px}.bk-ft{position:absolute;bottom:20px;left:62px;right:62px;display:flex;justify-content:space-between;font-size:11.5px;color:#64748b;border-top:1px solid #e2e8f0;padding-top:5px}' +
    '.bk-c{text-align:center}.bk-c h1{font-size:22px;margin:8px 0 0;color:#1e1b4b}.bk-sub{color:#475569;font-size:14.5px;margin-bottom:14px}.bk-logo{height:92px;display:block;margin:0 auto 6px}' +
    '.bk-sec{border-left:6px solid #4338ca;padding:2px 0 4px 12px;margin:2px 0 16px}.bk-sec h2{font-size:20px;margin:0;color:#1e1b4b;line-height:1.4}.bk-sec .sub{font-size:13px;color:#64748b}' +
    '.bk-h3{font-weight:700;color:#3730a3;font-size:15.5px;margin:16px 0 6px}' +
    '.bk-page table,.bk-page th,.bk-page td{border-radius:0!important;box-shadow:none!important;overflow:visible!important}.bk-page th,.bk-page td{background-clip:padding-box}' +
    '.bk-t{border-collapse:separate;border-spacing:0;width:100%;margin:4px 0;border-bottom:1px solid #94a3b8;border-left:1px solid #94a3b8}.bk-t th,.bk-t td{border:0;border-right:1px solid #94a3b8;border-top:1px solid #94a3b8;padding:4px 6px;text-align:center;font-size:13.5px;vertical-align:middle}.bk-t th{background:#e0e7ff;color:#1e1b4b;font-weight:700}.bk-t.z tr:nth-child(even) td{background:#f8fafc}.bk-t td.l{text-align:left}.bk-t td.tall{height:62px;text-align:left}.bk-t td.sm{font-size:11.5px}' +
    '.bk-t.sm th,.bk-t.sm td{font-size:11px;padding:3px 2px}.bk-t th.v{font-size:10.5px;line-height:1.2;padding:2px 1px;min-width:22px}.bk-t th.v small{font-size:9px;font-weight:400}.red{color:#dc2626;font-weight:700}.gr{color:#15803d;font-weight:700}.am{color:#b45309;font-weight:700}' +
    '.bk-kv{border-collapse:separate;border-spacing:0;width:100%;margin:6px 0 4px;border-bottom:1px solid #c7d2fe;border-left:1px solid #c7d2fe}.bk-kv th{width:200px;text-align:left;background:#eef2ff;color:#3730a3;padding:6px 10px;border:0;border-right:1px solid #c7d2fe;border-top:1px solid #c7d2fe;font-size:14px}.bk-kv td{padding:6px 10px;border:0;border-right:1px solid #c7d2fe;border-top:1px solid #c7d2fe;font-size:14.5px;font-weight:700}' +
    '.bk-stat{display:flex;gap:12px}.bk-stat div{flex:1;border:1px solid #c7d2fe;background:#f5f7ff;border-radius:10px;padding:8px 10px;text-align:center}.bk-stat span{display:block;font-size:13px;color:#475569}.bk-stat b{font-size:28px;color:#1e1b4b;line-height:1.3}.bk-stat .g{background:#f0fdf4;border-color:#bbf7d0}.bk-stat .g b{color:#15803d}.bk-stat .r{background:#fef2f2;border-color:#fecaca}.bk-stat .r b{color:#dc2626}' +
    '.bk-sig{display:grid;grid-template-columns:1fr 1fr;gap:30px 40px;margin-top:34px;text-align:center;font-size:14px}.bk-sig .ln{border-bottom:1px dotted #0f172a;height:26px;margin:0 18px 6px}.bk-sig span{color:#475569;font-size:13px}' +
    '.bk-txt p{margin:0 0 3px}.bk-txt p.sp{height:8px}.bk-txt.box{border:1px solid #e2e8f0;background:#f8fafc;border-radius:8px;padding:8px 12px;min-height:110px}' +
    '.bk-fld{margin:0 0 12px}.bk-fld .lb{font-weight:700;color:#3730a3;font-size:15px;border-bottom:1px solid #e0e7ff;margin-bottom:4px;padding-bottom:2px}.bk-g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}' +
    '.bk-legend{display:flex;flex-wrap:wrap;gap:14px;font-size:11.5px;margin-top:6px;color:#475569}' +
    '.bk-ph{border:1px solid #cbd5e1;border-radius:10px;padding:10px;margin:0 auto 14px;width:540px}.bk-ph .im{width:518px;height:389px;background:#f1f5f9;border-radius:6px;overflow:hidden}.bk-ph img{width:518px;height:389px;display:block}.bk-ph .cap{font-size:13.5px;margin-top:6px;line-height:1.5}.bk-ph .no{float:right;background:#4338ca;color:#fff;border-radius:99px;padding:0 9px;font-size:12px;font-weight:700}.bk-ph .dt{color:#475569}.bk-ph .dt i{font-style:normal;font-weight:700;color:#0f172a}.bk-noph{height:389px;display:flex;align-items:center;justify-content:center;color:#94a3b8}' +
    '.bk-page.cover{padding:0;display:flex;flex-direction:column;background:linear-gradient(180deg,#fff 0,#fff 58%,#eef2ff 58%,#eef2ff 100%)}.bk-page.cover:before{content:"";position:absolute;left:0;top:0;bottom:0;width:18px;background:#4338ca}' +
    '.cv-top{text-align:center;padding:96px 70px 0}.cv-top .bk-logo{height:128px}.cv-school{font-size:20px;font-weight:700;color:#334155;margin-top:8px}.cv-mid{text-align:center;padding:70px 70px 0}.cv-kicker{display:inline-block;background:#4338ca;color:#fff;font-weight:700;font-size:17px;border-radius:99px;padding:4px 22px}.cv-name{font-size:44px;font-weight:800;color:#1e1b4b;line-height:1.3;margin:22px 0 6px}.cv-term{font-size:18px;color:#475569}' +
    '.cv-box{margin:auto 80px 110px;background:#fff;border:1px solid #c7d2fe;border-radius:16px;padding:20px 26px;display:flex;justify-content:space-between;gap:20px;align-items:center}.cv-box > div:first-child span{display:block;font-size:13px;color:#64748b}.cv-box > div:first-child b{display:block;font-size:16.5px;color:#0f172a}.cv-stats{display:flex;gap:18px;text-align:center}.cv-stats b{display:block;font-size:26px;color:#4338ca;line-height:1.2}.cv-stats span{font-size:12px;color:#64748b}';
  async function renderBookPdf(p) {
    await loadScriptOnce('assets/html2canvas.min.js'); await loadScriptOnce('assets/jspdf.umd.min.js');
    var bk = await buildBook(p);
    var box = document.createElement('div'); box.style.cssText = 'position:fixed;left:-20000px;top:0;width:794px;z-index:-1';
    box.innerHTML = '<style>' + BOOK_CSS + '</style>' + bk.parts.map(function (x, i) { return x && x.cover ? pg(x.html, 0, 0, '', true) : pg(x, i + 1, bk.parts.length, bk.school); }).join('');
    document.body.appendChild(box);
    try {
      if (document.fonts && document.fonts.ready) await document.fonts.ready; await new Promise(function (r) { setTimeout(r, 300); });
      var pdf = new jspdf.jsPDF('p', 'pt', 'a4'), els = box.querySelectorAll('.bk-page');
      for (var i = 0; i < els.length; i++) {
        p && p.setLabel && p.setLabel('กำลังสร้างหน้าที่ ' + (i + 1) + ' จาก ' + els.length + '...');
        p && p.setProgress && p.setProgress(10 + i / els.length * 60);
        var cv = await html2canvas(els[i], { scale: 1.6, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: 794 });
        if (i > 0) pdf.addPage(); pdf.addImage(cv.toDataURL('image/jpeg', 0.85), 'JPEG', 0, 0, 595.28, 841.89);
      }
      return { pdf: pdf, name: ('รายงานกิจกรรมชุมนุม ' + bk.name + ' ' + D.club.semester + '-' + D.club.year).replace(/[\\/:*?"<>|]+/g, ' ') + '.pdf', pages: els.length };
    } finally { box.remove(); }
  }
  async function bookPreview() {
    var r = await withProgress('กำลังสร้างตัวอย่างเล่ม', async function (p) { var b = await renderBookPdf(p); b.pdf.save(b.name); return b; }, { successLabel: 'ดาวน์โหลดตัวอย่างเล่มแล้ว' });
    void r;
  }
  async function bookSend() {
    if (!(await askConfirm('สร้างเล่มรายงานแล้วส่งเข้าระบบตรวจ?\nผู้ตรวจ: หัวหน้า/เจ้าหน้าที่วิชาการ และผู้รับผิดชอบงานชุมนุม', 'ส่งเล่มรายงาน'))) return;
    var rv = D.review;
    var r = await withProgress('กำลังสร้างและส่งเล่มรายงาน', async function (p) {
      var b = await renderBookPdf(p), blob = b.pdf.output('blob'), file = new File([blob], b.name, { type: 'application/pdf' });
      p.setLabel && p.setLabel('กำลังส่งไฟล์...');
      var prep = await apiCall('teacherUploadPrepare', { fileName: file.name, mimeType: 'application/pdf', fileSize: file.size, academicYear: D.club.year, semester: D.club.semester, categoryId: B.categoryId, title: file.name, customFieldValues: {}, replacesId: rv && rv.state === 'fix' ? rv.id : '', direct: 1, origin: location.origin });
      var res = await sendPreparedFileProgress(prep, file, p, 72, 96, 'กำลังอัปโหลดเล่มรายงาน', { filename: prep.uploadFileName || file.name, mimeType: 'application/pdf' });
      await apiCall('teacherUploadFinalize', { submissionId: prep.submissionId, fileId: res.fileId, fileUrl: res.url, directUrl: res.directUrl, fileName: prep.uploadFileName || file.name, mimeType: 'application/pdf', via: res.via, fallbackReason: res.fallbackReason || '' });
      return apiCall('clubSubmitted', { clubId: D.club.id, submissionId: prep.submissionId });
    }, { successLabel: 'ส่งเล่มรายงานแล้ว — รอตรวจ', upload: true });
    if (r.ok) { await reloadClub(); renderTabs(true); }
  }

  // ---------- แอดมิน: ทุกชุมนุม ----------
  async function renderAll() {
    var stop = lazyLoad(); var r; try { r = await apiCall('clubAll', st.term ? { term: st.term } : {}); } finally { stop(); }
    var rows = r.clubs || [];
    var tag = function (rv) { return rv && rv.state === 'ok' ? '<span class="cb-tag ok">ผ่าน</span>' : rv && rv.state === 'fix' ? '<span class="cb-tag no">ส่งกลับแก้ไข</span>' : rv && rv.uploaded ? '<span class="cb-tag wt">รอตรวจ</span>' : '<span class="cb-tag gr">ยังไม่ส่ง</span>'; };
    setBody('<div class="card"><div class="cb-toolbar"><h3 style="margin:0">ชุมนุมทั้งหมด (' + rows.length + ') · ภาคเรียนที่ ' + esc(B.term ? B.term.semester + '/' + B.term.year : '-') + '</h3><span class="cb-sp"></span>' + (B.manager && !B.isPast ? '<button type="button" class="btn btn-primary btn-sm" data-new-for><i class="fa-solid fa-plus"></i> สร้างชุมนุมให้ครู</button>' : '') + '</div><div class="cb-tbl-wrap"><table class="cb-tbl"><thead><tr><th>ชุมนุม</th><th>ครู</th><th>นักเรียน</th><th>เช็คแล้ว</th><th>รูป</th><th>เล่มรายงาน</th><th></th></tr></thead><tbody>' +
      rows.map(function (c) { return '<tr><td><b>' + esc(c.name) + '</b></td><td>' + esc(c.teachers.join(', ')) + '</td><td>' + c.members + '</td><td>' + c.checks + '/' + countable().length + '</td><td>' + c.photos + '/4</td><td>' + tag(c.review) + '</td><td class="r"><button type="button" class="btn btn-secondary btn-sm" data-open-club="' + esc(c.id) + '"><i class="fa-solid fa-arrow-right"></i> เปิด</button></td></tr>'; }).join('') +
      (rows.length ? '' : '<tr><td colspan="7" class="cb-mut">ยังไม่มีชุมนุมในภาคเรียนนี้</td></tr>') + '</tbody></table></div></div>');
  }
  // ---------- แอดมิน: นักเรียนกับชุมนุม ----------
  async function renderWho() {
    if (!st.stu) { var stop = lazyLoad(); try { st.stu = await apiCall('clubStudents', st.term ? { term: st.term } : {}); } finally { stop(); } }
    var r = st.stu, map = r.map || {}, f = st.filt, all = r.students || [];
    var none = all.filter(function (s) { return !(map[s.id] || []).length; }), dup = all.filter(function (s) { return (map[s.id] || []).length > 1; });
    var grades = {}; all.forEach(function (s) { var g = (/^m(\d)_/.exec(s.roomId) || [])[1]; if (g) grades[g] = 1; });
    var roomsL = {}; all.forEach(function (s) { if (!f.g || s.roomId.indexOf('m' + f.g + '_') === 0) roomsL[s.roomId] = 1; });
    var base = f.mode === 'none' ? none : f.mode === 'dup' ? dup : all;
    var L = base.filter(function (s) { return (!f.g || s.roomId.indexOf('m' + f.g + '_') === 0) && (!f.room || s.roomId === f.room) && (!f.q || (s.name + ' ' + s.code).indexOf(f.q) !== -1); });
    setBody('<div class="cb-kp"><div><span>นักเรียนทั้งหมด</span><b>' + all.length + '</b></div><div><span>มีชุมนุมแล้ว</span><b class="g">' + (all.length - none.length) + '</b></div><div><span>ยังไม่มีชุมนุม</span><b class="r">' + none.length + '</b></div><div><span>อยู่ 2 ชุมนุม (ซ้ำ)</span><b>' + dup.length + '</b></div></div>' +
      '<div class="card"><div class="cb-toolbar">' + [['none', 'ยังไม่มีชุมนุม (' + none.length + ')'], ['all', 'ทั้งหมด'], ['dup', 'ซ้ำ (' + dup.length + ')']].map(function (x) { return '<button type="button" class="cb-seg' + (f.mode === x[0] ? ' on' : '') + '" data-wmode="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
      '<span class="cb-sp"></span><select data-wg><option value="">ทุกระดับชั้น</option>' + Object.keys(grades).sort().map(function (g) { return '<option value="' + g + '"' + (f.g === g ? ' selected' : '') + '>ม.' + g + '</option>'; }).join('') + '</select><select data-wr><option value="">ทุกห้อง</option>' + Object.keys(roomsL).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).map(function (x) { return '<option value="' + x + '"' + (f.room === x ? ' selected' : '') + '>' + room(x) + '</option>'; }).join('') + '</select>' +
      '<input type="search" data-wq class="cb-search" placeholder="ค้นหาชื่อ / เลขประจำตัว" value="' + esc(f.q) + '" /><button type="button" class="btn btn-secondary btn-sm" data-wx><i class="fa-solid fa-file-excel"></i> Excel</button><button type="button" class="btn btn-ghost btn-sm" data-wre title="โหลดใหม่"><i class="fa-solid fa-rotate-right"></i></button></div>' +
      '<div class="cb-tbl-wrap"><table class="cb-tbl"><thead><tr><th>เลขประจำตัว</th><th>ชื่อ – สกุล</th><th>ห้อง</th><th>ชุมนุม</th></tr></thead><tbody>' +
      L.slice(0, 600).map(function (s) { var cs = map[s.id] || []; return '<tr><td>' + esc(s.code && s.code !== '00000' ? s.code : '-') + '</td><td>' + esc(s.name) + '</td><td>' + room(s.roomId) + '</td><td>' + (cs.length ? cs.map(function (c) { return '<span class="cb-tag ' + (cs.length > 1 ? 'wt' : 'ok') + '">' + esc(c.name) + '</span>'; }).join(' ') : '<span class="cb-tag no">ยังไม่มีชุมนุม</span>') + '</td></tr>'; }).join('') +
      (L.length ? '' : '<tr><td colspan="4" class="cb-mut">ไม่มีรายการ</td></tr>') + '</tbody></table>' + (L.length > 600 ? '<p class="cb-mut">แสดง 600 คนแรก — กรองเพิ่มเพื่อดูส่วนที่เหลือ</p>' : '') + '</div></div>');
    st.__whoList = L;
  }
  // ---------- แอดมิน: ตั้งค่า ----------
  var cfgDraft = null;
  async function renderCfg() {
    if (!cfgDraft) {
      var cats = []; try { cats = (await apiCall('adminListWorkCategories', {})) || []; } catch (e) { cats = []; }
      cfgDraft = { dates: (B.sessions || []).map(function (s) { return s.date; }), off: (B.sessions || []).filter(function (s) { return s.off; }).map(function (s) { return s.date; }), openTime: B.openTime || '12:00', categoryId: B.categoryId || '', signers: (B.signers || []).slice(), texts: Object.assign({}, B.texts), managers: (B.managers || []).slice(), cats: Array.isArray(cats) ? cats : (cats.categories || []) };
    }
    var c = cfgDraft, nm = {}; B.teachers.forEach(function (t) { nm[t.id] = t.name; });
    setBody('<div class="card"><h3><i class="fa-solid fa-calendar-days"></i> วันชุมนุมของทั้งโรงเรียน · ภาคเรียนที่ ' + esc(B.term ? B.term.semester + '/' + B.term.year : '-') + '</h3>' +
      '<div class="cb-inl wrap"><div class="field"><label>เริ่มวันที่</label><input type="date" id="cgStart" /></div><div class="field"><label>จำนวนครั้ง</label><input type="number" id="cgCount" min="1" max="40" value="15" style="width:90px" /></div><div class="field"><label>ทุกวัน</label><select id="cgDow">' + [[1, 'จันทร์'], [2, 'อังคาร'], [3, 'พุธ'], [4, 'พฤหัสบดี'], [5, 'ศุกร์']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === 2 ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></div><button type="button" class="btn btn-secondary" data-cg-gen><i class="fa-solid fa-wand-magic-sparkles"></i> สร้างวัน</button>' +
      '<div class="field"><label>เพิ่มวันเอง</label><input type="date" id="cgAdd" /></div><button type="button" class="btn btn-secondary" data-cg-add><i class="fa-solid fa-plus"></i> เพิ่ม</button><div class="field"><label>เว็บเช็คชื่อเปิดให้เช็คตั้งแต่</label><input type="time" id="cgOpen" value="' + esc(c.openTime) + '" /></div></div>' +
      '<div class="cb-dates">' + c.dates.map(function (d, i) { var off = c.off.indexOf(d) !== -1; return '<span class="cb-date' + (off ? ' off' : '') + '"><b>ครั้งที่ ' + (i + 1) + '</b> ' + thDW(d) + ' <button type="button" class="cb-x" data-cg-off="' + d + '" title="' + (off ? 'ยกเลิกวันหยุด' : 'ตั้งเป็นวันหยุด (ไม่นับ)') + '"><i class="fa-solid ' + (off ? 'fa-rotate-left' : 'fa-ban') + '"></i></button><button type="button" class="cb-x" data-cg-del="' + d + '" title="ลบวันนี้"><i class="fa-solid fa-xmark"></i></button></span>'; }).join('') + (c.dates.length ? '' : '<span class="cb-mut">ยังไม่มีวันชุมนุม — กด "สร้างวัน"</span>') + '</div>' +
      '<p class="cb-mut">วันหยุดทั้งวันในปฏิทินโรงเรียนจะเป็น "หยุด" ให้อัตโนมัติ (ไม่นับใน % การมา) · กด <i class="fa-solid fa-ban"></i> เพื่อตั้งหยุดเอง · เว็บเช็คชื่อแสดงปุ่มชุมนุมเฉพาะวันชุมนุม ตั้งแต่เวลาที่ตั้ง ถึง 23:59 น.</p></div>' +
      '<div class="card"><h3><i class="fa-solid fa-paper-plane"></i> ส่งเล่มรายงาน</h3><div class="field"><label>ประเภทงานที่ใช้รับเล่มรายงานชุมนุม</label><select id="cgCat"><option value="">— ยังไม่เลือก —</option>' + c.cats.filter(function (x) { return !x.noSubmission && !x.no_submission && !x.survey; }).map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === c.categoryId ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></div><p class="cb-mut">แนะนำ: สร้างประเภทงาน "รายงานกิจกรรมชุมนุม" (ไม่มีหัวข้อบังคับกรอก) แล้วตั้งผู้รับผิดชอบตรวจ = หัวหน้า/เจ้าหน้าที่วิชาการ และผู้รับผิดชอบงานชุมนุม</p>' +
      '<h4>ผู้ลงนามในหน้าแรกของเล่ม (ต่อจากครูที่ปรึกษาชุมนุม)</h4><div id="cgSigners">' + c.signers.map(function (s, i) { return '<div class="cb-inl"><input data-sg-t="' + i + '" value="' + esc(s.title) + '" placeholder="ตำแหน่ง เช่น หัวหน้างานกิจกรรมชุมนุม" style="flex:1" /><input data-sg-n="' + i + '" value="' + esc(s.name) + '" placeholder="ชื่อ – สกุล" style="flex:1" /><button type="button" class="cb-x" data-sg-del="' + i + '"><i class="fa-solid fa-xmark"></i></button></div>'; }).join('') + '</div><button type="button" class="btn btn-secondary btn-sm" data-sg-add><i class="fa-solid fa-plus"></i> เพิ่มผู้ลงนาม</button></div>' +
      '<div class="card"><h3><i class="fa-solid fa-align-left"></i> ข้อความคงที่ในเล่ม (ใช้กับทุกชุมนุม)</h3>' + [['steps', 'ขั้นตอนการจัดทำและส่งเล่มเอกสาร'], ['aims', 'กิจกรรมชุมนุม (มุ่งเน้นให้ผู้เรียน)'], ['criteria', 'เกณฑ์การตัดสินและแนวทางการแก้ไข']].map(function (x) { return '<div class="field"><label>' + x[1] + '</label><textarea rows="6" data-tx="' + x[0] + '">' + esc(c.texts[x[0]] || '') + '</textarea></div>'; }).join('') + '</div>' +
      '<div class="cb-actions"><span class="cb-sp"></span><button type="button" class="btn btn-success" data-cg-save><i class="fa-solid fa-check"></i> บันทึกการตั้งค่า</button></div>');
  }
  function cfgSync() { var c = cfgDraft; if (!c) return; var o = document.getElementById('cgOpen'); if (o) c.openTime = o.value || '12:00'; var cat = document.getElementById('cgCat'); if (cat) c.categoryId = cat.value; body.querySelectorAll('[data-sg-t]').forEach(function (x) { c.signers[+x.getAttribute('data-sg-t')].title = x.value; }); body.querySelectorAll('[data-sg-n]').forEach(function (x) { c.signers[+x.getAttribute('data-sg-n')].name = x.value; }); body.querySelectorAll('[data-tx]').forEach(function (x) { c.texts[x.getAttribute('data-tx')] = x.value; }); }

  // ---------- 2.00.4: ผู้ดูแลงานชุมนุม (Super Admin เลือกจากรายชื่อในระบบ · จัดการ / ดูผล) ----------
  var mgrDraft = null;
  function renderMgr() {
    if (!mgrDraft) mgrDraft = (B.managers || []).map(function (m) { return { id: m.id, manage: !!m.manage, view: !!m.view }; });
    var nm = {}; (B.people || []).forEach(function (u) { nm[u.id] = u.name; });
    setBody('<div class="card"><h3><i class="fa-solid fa-user-shield"></i> ผู้ดูแลงานชุมนุม</h3><p class="cb-mut">ผู้ดูแลระบบสูงสุดเป็นแอดมินงานชุมนุมเสมอ · คนอื่นต้องเพิ่มชื่อที่นี่ (แอดมินระบบ / เจ้าหน้าที่ไม่ได้สิทธิ์อัตโนมัติ)</p>' +
      '<div class="cb-tbl-wrap"><table class="cb-tbl"><thead><tr><th>ชื่อ</th><th>จัดการ</th><th>ดูผล</th><th></th></tr></thead><tbody>' + mgrDraft.map(function (m, i) {
        return '<tr><td>' + esc(nm[m.id] || m.id) + '</td><td><input type="checkbox" data-mg-m="' + i + '"' + (m.manage ? ' checked' : '') + ' aria-label="จัดการ" /></td><td><input type="checkbox" data-mg-v="' + i + '"' + (m.view || m.manage ? ' checked' : '') + (m.manage ? ' disabled' : '') + ' aria-label="ดูผล" /></td><td class="r"><button type="button" class="cb-x" data-mg-rm="' + i + '" aria-label="เอาออก"><i class="fa-solid fa-xmark"></i></button></td></tr>';
      }).join('') + (mgrDraft.length ? '' : '<tr><td colspan="4" class="cb-mut">ยังไม่มี — เลือกชื่อด้านล่าง</td></tr>') + '</tbody></table></div>' +
      '<div class="cb-inl" style="margin-top:10px"><select id="cbMgAdd" class="cb-search"><option value="">+ เพิ่มคนจากรายชื่อในระบบ</option>' + (B.people || []).filter(function (u) { return !mgrDraft.some(function (m) { return m.id === u.id; }); }).map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(u.name) + '</option>'; }).join('') + '</select></div>' +
      '<p class="cb-mut"><b>จัดการ</b> = ดู/แก้ทุกชุมนุม · ย้ายนักเรียน · ตั้งวันชุมนุม ผู้ลงนาม ข้อความในเล่ม · แก้ภาคเรียนที่ผ่านมาได้ — <b>ดูผล</b> = ดูทุกชุมนุมและนักเรียนกับชุมนุมได้อย่างเดียว</p>' +
      '<div class="cb-actions"><span class="cb-sp"></span><button type="button" class="btn btn-success" data-mg-save><i class="fa-solid fa-check"></i> บันทึก</button></div></div>');
  }
  body.addEventListener('change', function (e) {
    var t;
    if (e.target.id === 'cbMgAdd' && e.target.value) { mgrDraft.push({ id: e.target.value, manage: false, view: true }); renderMgr(); return; }
    if ((t = e.target.closest('[data-mg-m]'))) { var m = mgrDraft[+t.getAttribute('data-mg-m')]; m.manage = t.checked; if (m.manage) m.view = true; renderMgr(); return; }
    if ((t = e.target.closest('[data-mg-v]'))) { mgrDraft[+t.getAttribute('data-mg-v')].view = t.checked; }
  });
  body.addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-mg-rm]'))) { mgrDraft.splice(+t.getAttribute('data-mg-rm'), 1); renderMgr(); return; }
    if (e.target.closest('[data-mg-save]')) {
      var list = mgrDraft.filter(function (m) { return m.manage || m.view; });
      var r = await withProgress('กำลังบันทึกผู้ดูแลงานชุมนุม', function () { return apiCall('clubCfgSave', { managers: list }); }, { successLabel: 'บันทึกแล้ว' });
      if (r.ok) { mgrDraft = null; await boot(true); }
    }
  });

  // ---------- คลิกทั้งหมด ----------
  function lazyLoad() { var t = setTimeout(function () { body.innerHTML = '<div class="loading">กำลังโหลด...</div>'; }, 300); return function () { clearTimeout(t); }; }
  body.addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-t-add]'))) { openTeacherPicker(); return; }
    if ((t = e.target.closest('[data-t-del]'))) { var id = t.getAttribute('data-t-del'), keep = infoVals(), nmv = document.getElementById('cbName').value; pickT.ids = pickT.ids.filter(function (x) { return x !== id; }); renderInfo(); document.getElementById('cbName').value = nmv; body.querySelectorAll('[data-info]').forEach(function (x) { x.value = keep[x.getAttribute('data-info')] || ''; }); return; }
    if (e.target.closest('[data-club-save]')) {
      var name = document.getElementById('cbName').value.trim(); if (!name) { showToast('กรุณาตั้งชื่อชุมนุม', true); return; }
      var r = await withProgress(D ? 'กำลังบันทึกข้อมูลชุมนุม' : 'กำลังสร้างชุมนุม', function () { return apiCall('clubSave', { id: D ? D.club.id : '', name: name, teacherIds: pickT.ids, info: infoVals(), ownerId: st.newFor || '' }); }, { successLabel: D ? 'บันทึกแล้ว' : 'สร้างชุมนุมแล้ว' });
      if (r.ok) { st.clubId = r.data.id; st.newFor = ''; pickT = null; await boot(true); if (!D) return; st.tab = 'stu'; renderTabs(true); }
      return;
    }
    if (e.target.closest('[data-copy-prev]')) {
      var prev = []; try { prev = await apiCall('clubPrevious', {}); } catch (x) { showToast(x.message, true); return; }
      if (!prev.length) { showToast('ไม่พบชุมนุมของคุณในภาคเรียนก่อน', true); return; }
      modal('คัดลอกจากภาคเรียนก่อน', prev.map(function (p, i) { return '<button type="button" class="cb-prow btn-like" data-prev="' + i + '"><b>' + esc(p.name) + '</b> <span class="cb-mut">ภาคเรียนที่ ' + esc(p.semester) + '/' + esc(p.year) + '</span></button>'; }).join('') + '<p class="cb-mut">คัดลอกชื่อชุมนุม ครู และแบบเสนอ (ไม่คัดลอกนักเรียนและการเช็คชื่อ)</p>');
      document.getElementById('cbModalBody').onclick = function (ev) { var b = ev.target.closest('[data-prev]'); if (!b) return; var p = prev[+b.getAttribute('data-prev')]; closeModal(); pickT = { club: '', ids: p.teacherIds.filter(function (x) { return B.teachers.some(function (tt) { return tt.id === x && (!tt.busy || x === B.me.id); }); }) }; if (pickT.ids.indexOf(B.me.id) === -1) pickT.ids.unshift(B.me.id); renderInfo(); document.getElementById('cbName').value = p.name; body.querySelectorAll('[data-info]').forEach(function (x) { x.value = p.info[x.getAttribute('data-info')] || ''; }); };
      return;
    }
    if (e.target.closest('[data-club-del]')) {
      if (!(await askConfirm('ลบชุมนุม "' + D.club.name + '"?\nนักเรียน การเช็คชื่อ รูป และประวัติของชุมนุมนี้จะถูกลบทั้งหมด', 'ลบชุมนุม'))) return;
      var rd = await withProgress('กำลังลบชุมนุม', function () { return apiCall('clubDelete', { id: D.club.id }); }, { successLabel: 'ลบชุมนุมแล้ว' });
      if (rd.ok) { st.clubId = ''; await boot(false); }
      return;
    }
    if (e.target.closest('[data-stu-add]')) { openAddStudents(); return; }
    if ((t = e.target.closest('[data-stu-del]'))) {
      var sid = t.getAttribute('data-stu-del'), m = D.members.filter(function (x) { return x.id === sid; })[0];
      if (!(await askConfirm('เอา ' + (m ? m.name : '') + ' ออกจากชุมนุม?\n(ประวัติการเช็คชื่อเดิมยังอยู่)', 'เอาออกจากชุมนุม'))) return;
      try { await apiCall('clubMemberRemove', { clubId: D.club.id, studentId: sid }); await reloadClub(); renderTabs(true); } catch (x) { showToast(x.message, true); }
      return;
    }
    if ((t = e.target.closest('[data-sess]'))) { st.sel = t.getAttribute('data-sess'); renderCheck(); return; }
    if ((t = e.target.closest('[data-st]'))) { t.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === t); }); countCk(); return; }
    if (e.target.closest('[data-all-present]')) { body.querySelectorAll('#cbCk tr[data-sid]').forEach(function (tr) { if (tr.hidden) return; var on = tr.querySelector('button.on'); if (!on) tr.querySelector('[data-st="มา"]').classList.add('on'); }); countCk(); return; }
    if (e.target.closest('[data-ck-save]')) {
      var data = {}, empty = 0; body.querySelectorAll('#cbCk tr[data-sid]').forEach(function (tr) { var on = tr.querySelector('button.on'); if (on) data[tr.getAttribute('data-sid')] = on.getAttribute('data-st'); else empty++; });
      var act = document.getElementById('cbAct').value.trim(); if (!act) { showToast('กรุณากรอก "กิจกรรมที่ทำวันนี้"', true); document.getElementById('cbAct').focus(); return; }
      if (empty && !(await askConfirm('ยังไม่ได้เลือกสถานะ ' + empty + ' คน — บันทึกเท่าที่เลือกไว้?', 'บันทึกการเช็คชื่อ'))) return;
      var date = st.sel, rc = await withProgress('กำลังบันทึกการเช็คชื่อ', function () { return apiCall('clubCheckSave', { clubId: D.club.id, date: date, data: data, activity: act }); }, { successLabel: 'บันทึกการเช็คชื่อแล้ว' });
      if (rc.ok) { await reloadClub(); renderTabs(true); }
      return;
    }
    if ((t = e.target.closest('[data-ph-add]'))) { var f = document.getElementById('cbPhotoFile'); f.__idx = t.getAttribute('data-ph-add'); f.click(); return; }
    if ((t = e.target.closest('[data-ph-del]'))) { if (!(await askConfirm('ลบรูปนี้?', 'ลบรูป'))) return; try { await apiCall('clubPhotoDelete', { clubId: D.club.id, idx: +t.getAttribute('data-ph-del') }); await reloadClub(); renderTabs(true); } catch (x) { showToast(x.message, true); } return; }
    if ((t = e.target.closest('[data-ph-meta]'))) { var i2 = t.getAttribute('data-ph-meta'); try { await apiCall('clubPhotoMeta', { clubId: D.club.id, idx: +i2, caption: body.querySelector('[data-ph-cap="' + i2 + '"]').value, date: body.querySelector('[data-ph-date="' + i2 + '"]').value }); showToast('บันทึกแล้ว'); await reloadClub(); } catch (x) { showToast(x.message, true); } return; }
    if ((t = e.target.closest('[data-res]'))) { sumRes.r[t.getAttribute('data-sid')] = t.getAttribute('data-res'); t.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === t); }); return; }
    if (e.target.closest('[data-res-auto]')) { activeMembers().forEach(function (m) { var s = statsOf(m); if (s.pct != null) sumRes.r[m.id] = s.pct >= 80 ? 'pass' : 'fail'; }); var keepP = document.getElementById('cbProb').value, keepF = document.getElementById('cbFix').value; renderSum(); document.getElementById('cbProb').value = keepP; document.getElementById('cbFix').value = keepF; showToast('เลือกตามสถิติแล้ว — ตรวจ/แก้ทีละคนได้ แล้วกด "บันทึกผลและสรุป"'); return; }
    if (e.target.closest('[data-sum-save]')) { var rs = await withProgress('กำลังบันทึก', function () { return apiCall('clubSummarySave', { clubId: D.club.id, summary: { problems: document.getElementById('cbProb').value, fixes: document.getElementById('cbFix').value }, results: sumRes.r }); }, { successLabel: 'บันทึกผลและสรุปแล้ว' }); if (rs.ok) { await reloadClub(); sumRes = null; renderTabs(true); } return; }
    if ((t = e.target.closest('[data-book]'))) { if (t.getAttribute('data-book') === 'preview') bookPreview(); else bookSend(); return; }
    if ((t = e.target.closest('[data-open-club]'))) { st.clubId = t.getAttribute('data-open-club'); try { D = await apiCall('clubDetail', { id: st.clubId }); } catch (x) { showToast(x.message, true); return; } st.tab = 'info'; pickT = null; sumRes = null; renderTabs(true); return; }
    if (e.target.closest('[data-new-for]')) {
      modal('สร้างชุมนุมให้ครู', '<p class="cb-mut">เลือกครูหลักของชุมนุม (ครูที่มีชุมนุมแล้วเลือกไม่ได้)</p><select id="cbNewFor" class="cb-search"><option value="">— เลือกครู —</option>' + B.teachers.filter(function (x) { return !x.busy; }).map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.name) + '</option>'; }).join('') + '</select>', '<button type="button" class="btn btn-success" data-nf-ok>ต่อไป</button>');
      document.getElementById('cbModalActions').onclick = function (ev) { if (!ev.target.closest('[data-nf-ok]')) return; var v = document.getElementById('cbNewFor').value; if (!v) { showToast('เลือกครูก่อน', true); return; } closeModal(); st.newFor = v; D = null; st.clubId = ''; pickT = { club: '', ids: [v] }; st.tab = 'info'; tabsEl.innerHTML = '<span class="cb-viewing"><i class="fa-solid fa-plus"></i> สร้างชุมนุมให้ ' + esc((B.teachers.filter(function (x) { return x.id === v; })[0] || {}).name) + ' <button type="button" class="btn btn-ghost btn-sm" data-cb-leave>ยกเลิก</button></span>'; var mm = B.me; B.me = { id: v, name: '' }; renderInfo(); B.me = mm; };
      return;
    }
    if ((t = e.target.closest('[data-wmode]'))) { st.filt.mode = t.getAttribute('data-wmode'); renderWho(); return; }
    if (e.target.closest('[data-wre]')) { st.stu = null; renderWho(); return; }
    if (e.target.closest('[data-wx]')) { var L = st.__whoList || []; if (!L.length) { showToast('ไม่มีรายการ', true); return; } var map = st.stu.map || {}; downloadBlob(buildXlsx('นักเรียนกับชุมนุม', ['เลขประจำตัว', 'ชื่อ – สกุล', 'ห้อง', 'ชุมนุม'], L.map(function (s) { return [s.code && s.code !== '00000' ? s.code : '', s.name, room(s.roomId), (map[s.id] || []).map(function (c) { return c.name; }).join(', ') || 'ยังไม่มีชุมนุม']; })), 'นักเรียนกับชุมนุม.xlsx'); return; }
    // ตั้งค่า
    if (e.target.closest('[data-cg-gen]')) { cfgSync(); var s0 = document.getElementById('cgStart').value, n = Math.max(1, Math.min(40, +document.getElementById('cgCount').value || 15)), dow = +document.getElementById('cgDow').value; if (!s0) { showToast('เลือกวันเริ่มก่อน', true); return; } var d0 = dP(s0); while (d0.getDay() !== dow) d0.setDate(d0.getDate() + 1); var out = []; for (var k = 0; k < n; k++) { var dd = new Date(d0); dd.setDate(d0.getDate() + k * 7); out.push(dd.getFullYear() + '-' + ('0' + (dd.getMonth() + 1)).slice(-2) + '-' + ('0' + dd.getDate()).slice(-2)); } cfgDraft.dates = out; cfgDraft.off = cfgDraft.off.filter(function (x) { return out.indexOf(x) !== -1; }); renderCfg(); return; }
    if (e.target.closest('[data-cg-add]')) { cfgSync(); var v2 = document.getElementById('cgAdd').value; if (v2 && cfgDraft.dates.indexOf(v2) === -1) { cfgDraft.dates.push(v2); cfgDraft.dates.sort(); } renderCfg(); return; }
    if ((t = e.target.closest('[data-cg-del]'))) { cfgSync(); var dv = t.getAttribute('data-cg-del'); cfgDraft.dates = cfgDraft.dates.filter(function (x) { return x !== dv; }); cfgDraft.off = cfgDraft.off.filter(function (x) { return x !== dv; }); renderCfg(); return; }
    if ((t = e.target.closest('[data-cg-off]'))) { cfgSync(); var ov = t.getAttribute('data-cg-off'), oi = cfgDraft.off.indexOf(ov); if (oi === -1) cfgDraft.off.push(ov); else cfgDraft.off.splice(oi, 1); renderCfg(); return; }
    if (e.target.closest('[data-sg-add]')) { cfgSync(); cfgDraft.signers.push({ title: '', name: '' }); renderCfg(); return; }
    if ((t = e.target.closest('[data-sg-del]'))) { cfgSync(); cfgDraft.signers.splice(+t.getAttribute('data-sg-del'), 1); renderCfg(); return; }
    if (e.target.closest('[data-cg-save]')) {
      cfgSync(); var c = cfgDraft, payload = { dates: c.dates, off: c.off, openTime: c.openTime, categoryId: c.categoryId, signers: c.signers, texts: c.texts };
      var rg = await withProgress('กำลังบันทึกการตั้งค่าชุมนุม', function () { return apiCall('clubCfgSave', payload); }, { successLabel: 'บันทึกการตั้งค่าแล้ว' });
      if (rg.ok) { cfgDraft = null; await boot(true); }
      return;
    }
  });
  body.addEventListener('change', function (e) {
    if (e.target.matches('[data-wg]')) { st.filt.g = e.target.value; st.filt.room = ''; renderWho(); }
    else if (e.target.matches('[data-wr]')) { st.filt.room = e.target.value; renderWho(); }
  });
  body.addEventListener('input', function (e) {
    if (e.target.matches('[data-wq]')) { st.filt.q = e.target.value.trim(); var pos = e.target.selectionStart; renderWho(); var n = body.querySelector('[data-wq]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch (x) { /* ข้าม */ } }
    else if (e.target.id === 'cbCq') { var q = e.target.value.trim(); body.querySelectorAll('#cbCk tr[data-sid]').forEach(function (tr) { tr.hidden = q && tr.getAttribute('data-name').indexOf(q) === -1; }); }
  });
  boot(false);
})();
