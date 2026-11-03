/* วิชาที่สอน (1.99) — หน้า teach.html · แยกไฟล์จาก api.js
 * สรุปการเช็คชื่อรายวิชา (ตั้งแต่ต้นภาคเรียนถึงวันนี้) · คาบที่ยังไม่เช็ค = บันทึกย้อนหลัง · คาบที่เช็คแล้ว = แก้ไขได้ (มีประวัติ)
 * ข้อมูลอยู่ที่เว็บเช็คชื่อ — อ่าน/เขียนผ่าน Worker ↔ Worker · เว็บเช็คชื่อตรวจสิทธิ์ซ้ำอีกชั้น */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('teach'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('cbBody'), tabsEl = document.getElementById('cbTabs');
  var B = null, S = null, st = { sub: '', forUser: '', view: location.hash === '#miss' ? 'miss' : 'slots' };
  var STATUS = ['มา', 'สาย', 'ลาป่วย', 'ลากิจ', 'ขาด', 'โดดเรียน'], SCOLOR = { 'มา': '#10b981', 'ร่วมกิจกรรม': '#06b6d4', 'สาย': '#f59e0b', 'ลาป่วย': '#3b82f6', 'ลากิจ': '#6366f1', 'ขาด': '#f43f5e', 'โดดเรียน': '#9333ea' };
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], DW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var TIMES = { '-2': '07.30', '0': '08.00', '1': '08.30', '2': '09.20', '3': '10.20', '4': '11.10', '5': '13.00', '6': '13.50', '7': '14.40', '8': '15.30' };
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function plabel(p) { return Number(p) === -2 ? 'A' : Number(p) === 0 ? 'B' : String(p); }
  function dP(ds) { var p = String(ds || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function thD(ds) { var d = dP(ds); return DW[d.getDay()] + ' ' + d.getDate() + ' ' + MS[d.getMonth()]; }
  function err(m) { return '<div class="cb-err"><i class="fa-solid fa-circle-exclamation"></i> ' + esc(m) + '</div>'; }
  function modal(title, html, actions) { var mb = document.getElementById('cbModalBody'), ma = document.getElementById('cbModalActions'); mb.onclick = null; ma.onclick = null; document.getElementById('cbModalTitle').innerHTML = title; mb.innerHTML = html; ma.innerHTML = (actions || '') + '<button type="button" class="btn btn-ghost btn-close" data-cb-close>ปิด</button>'; showModalEl(document.getElementById('cbModal')); }
  function closeModal() { hideModalEl(document.getElementById('cbModal')); }
  document.getElementById('cbModal').addEventListener('click', function (e) { if (e.target.closest('[data-cb-close]')) closeModal(); });
  var qs = new URLSearchParams(location.search), deep = qs.get('subject') ? { sub: qs.get('subject'), date: qs.get('date') || '', period: qs.get('period') } : null;

  async function boot() {
    var t = setTimeout(function () { body.innerHTML = '<div class="loading">กำลังโหลดวิชาจากเว็บเช็คชื่อ...</div>'; }, 300);
    try { B = await apiCall('teachBoot', st.forUser ? { forUser: st.forUser } : {}); } catch (e) { clearTimeout(t); body.innerHTML = err(e.message); return; } clearTimeout(t);
    tabsEl.innerHTML = B.admin && B.teachers && B.teachers.length ? '<label class="cb-mut" for="tcFor">ดูวิชาของ</label> <select id="tcFor" class="cb-search">' + B.teachers.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === B.forUser ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' : '';
    if (!B.linked) { body.innerHTML = '<div class="card cb-empty"><i class="fa-solid fa-link-slash"></i><p>' + esc(B.reason || 'บัญชีนี้ยังไม่ได้ผูกกับรายชื่อครูในเว็บเช็คชื่อ — ติดต่อผู้ดูแลเว็บเช็คชื่อ') + '</p></div>'; return; }
    if (!B.subjects.length) { body.innerHTML = '<div class="card cb-empty"><i class="fa-solid fa-book"></i><p>ไม่พบวิชาที่สอนในภาคเรียนนี้</p></div>'; return; }
    if (deep && B.subjects.some(function (s) { return s.id === deep.sub; })) st.sub = deep.sub;
    if (!st.sub || !B.subjects.some(function (s) { return s.id === st.sub; })) st.sub = B.subjects[0].id;
    await loadSub();
  }
  tabsEl.addEventListener('change', function (e) { if (e.target.id === 'tcFor') { st.forUser = e.target.value; st.sub = ''; boot(); } });
  async function loadSub() {
    renderSubs('<div class="loading">กำลังโหลดการเช็คชื่อ...</div>');
    try { S = await apiCall('teachSubject', Object.assign({ subjectId: st.sub }, st.forUser ? { forUser: st.forUser } : {})); } catch (e) { renderSubs(err(e.message)); return; }
    render();
    if (deep && deep.sub === st.sub && deep.date) { var o = occs().filter(function (x) { return x.date === deep.date && String(x.period) === String(deep.period); })[0]; deep = null; if (o) openOcc(o); }
  }
  function renderSubs(inner) {
    body.innerHTML = '<div class="card"><h3>วิชาที่สอน · ภาคเรียนที่ ' + esc(B.term.term) + '/' + esc(B.term.year) + (B.teacherName ? ' · ' + esc(B.teacherName) : '') + '</h3><div class="tc-subs">' + B.subjects.map(function (s) {
      return '<button type="button" class="tc-sub' + (s.id === st.sub ? ' on' : '') + '" data-sub="' + esc(s.id) + '"><b>' + esc((s.code ? s.code + ' ' : '') + s.name) + '</b><small>' + esc(s.room) + (s.system ? ' · คาบระบบ (ครูที่ปรึกษา)' : '') + (s.substituteOnly ? ' · สอนแทน' : '') + ' · ' + s.schedules.length + ' คาบ/สัปดาห์</small></button>';
    }).join('') + '</div></div>' + (inner || '');
  }
  // ---------- คาบตั้งแต่ต้นภาคเรียนถึงวันนี้ ----------
  function holOf(ds) { return (S.holidays || []).filter(function (h) { return h.date === ds; })[0] || null; }
  function blockOf(ds, p) {
    var g = (/^m(\d)_/.exec(S.subject.roomId) || [])[1] || '', lab = plabel(p);
    return (S.blocks || []).filter(function (b) { if (b.date !== ds) return false; if (b.kind === 'holiday') return true; var ok = (!b.grades || !b.grades.length) && (!b.rooms || !b.rooms.length) || (b.grades || []).indexOf(g) !== -1 || (b.rooms || []).indexOf(S.subject.roomId) !== -1; return ok && (!b.periods || b.periods.indexOf(lab) !== -1 || b.periods.indexOf(String(p)) !== -1); })[0] || null;
  }
  var _occ = null;
  function occs() {
    if (_occ && _occ.s === S) return _occ.list;
    var rows = {}; (S.rows || []).forEach(function (r) { rows[r.date + '|' + r.period] = r; });
    var subOnly = B.subjects.filter(function (x) { return x.id === S.subject.id; })[0], onlySubs = subOnly && subOnly.substituteOnly;
    var allowed = {}; (B.subs || []).forEach(function (x) { if (x.subjectId === S.subject.id) allowed[x.date + '|' + x.period] = 1; });
    var out = [], d = dP(S.termStart), end = dP(S.today);
    for (var i = 0; d <= end && i < 200; i++, d.setDate(d.getDate() + 1)) {
      var ds = ymd(d), h = holOf(ds), dow = d.getDay() || 7;
      var eff = h && h.type === 'makeup' && h.useDayOfWeek ? +h.useDayOfWeek : dow;
      if (dow >= 6 && !(h && h.type === 'makeup')) continue;
      var fullOff = h && (!h.type || h.type === 'holiday') && (!h.duration || h.duration === 'full');
      S.subject.schedules.forEach(function (sc) {
        if (sc.day !== eff) return;
        var key = ds + '|' + sc.period, rec = rows[key] || null, b = blockOf(ds, sc.period);
        var half = h && (!h.type || h.type === 'holiday') ? h.duration : '';
        var off = fullOff || (b && b.kind === 'holiday') || (half === 'morning' && sc.period <= 4) || (half === 'afternoon' && sc.period >= 5);
        var act = !off && b && b.kind !== 'holiday';
        if (onlySubs && !allowed[key]) return;
        out.push({ date: ds, period: sc.period, rec: rec, off: off && !rec, act: act, label: off ? ((h && h.label) || (b && b.title) || 'วันหยุด') : act ? (b.title || 'กิจกรรม') : '' });
      });
    }
    out.sort(function (a, b) { return b.date.localeCompare(a.date) || a.period - b.period; });
    _occ = { s: S, list: out }; return out;
  }
  function render() {
    var O = occs(), need = O.filter(function (o) { return !o.off && !o.act; }), done = need.filter(function (o) { return o.rec; }), miss = need.filter(function (o) { return !o.rec; });
    var edited = O.filter(function (o) { return o.rec && o.rec.editLog && o.rec.editLog.length; }).length;
    var pct = need.length ? Math.round(done.length / need.length * 100) : null;
    var h = '<div class="cb-kp"><div><span>คาบที่ต้องเช็ค (ถึงวันนี้)</span><b>' + need.length + '</b></div><div><span>เช็คแล้ว</span><b class="g">' + done.length + '</b></div><div><span>ยังไม่เช็ค</span><b class="r">' + miss.length + '</b></div><div><span>ภาพรวม</span><b>' + (pct == null ? '-' : pct + '%') + '</b></div></div>' +
      '<div class="card"><div class="cb-toolbar"><h3 style="margin:0">' + esc((S.subject.code ? S.subject.code + ' ' : '') + S.subject.name) + ' · ' + esc(S.subject.room) + '</h3><span class="cb-sp"></span>' + [['slots', 'รายคาบ'], ['miss', 'ยังไม่เช็ค (' + miss.length + ')'], ['stu', 'สรุปรายคน']].map(function (x) { return '<button type="button" class="cb-seg' + (st.view === x[0] ? ' on' : '') + '" data-view="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<p class="cb-mut">แตะคาบเพื่อบันทึก/แก้ไข · ทุกการแก้จากหน้านี้มีประวัติ (ใคร เมื่อไร) · ' + edited + ' คาบมีการแก้/บันทึกย้อนหลัง</p>';
    if (st.view === 'stu') h += stuTable(); else h += occTable(st.view === 'miss' ? miss : O);
    renderSubs(h + '</div>');
  }
  function occTable(L) {
    return '<div class="cb-tbl-wrap"><table class="cb-tbl"><thead><tr><th>วันที่</th><th>คาบ</th><th>สถานะ</th><th>มา / ทั้งหมด</th><th>บันทึกโดย</th><th></th></tr></thead><tbody>' + L.map(function (o) {
      var r = o.rec, n = r ? Object.keys(r.records || {}).length : 0, pres = r ? Object.values(r.records || {}).filter(function (v) { return v === 'มา' || v === 'สาย' || v === 'ร่วมกิจกรรม'; }).length : 0;
      var last = r && r.editLog && r.editLog.length ? r.editLog[r.editLog.length - 1] : null;
      var stH = o.off ? '<span class="cb-tag gr">' + esc(o.label) + ' (ไม่นับ)</span>' : r ? '<span class="cb-tag ok">เช็คแล้ว</span>' + (last ? ' <span class="cb-tag wt">' + (last.kind === 'late' ? 'บันทึกย้อนหลัง' : 'แก้ไข') + '</span>' : '') : o.act ? '<span class="cb-tag gr">' + esc(o.label) + '</span>' : '<span class="cb-tag no">ยังไม่เช็ค</span>';
      return '<tr><td class="nw"><b>' + thD(o.date) + '</b></td><td>' + plabel(o.period) + ' <span class="cb-mut">' + (TIMES[String(o.period)] || '') + '</span></td><td>' + stH + '</td><td>' + (r ? pres + ' / ' + n : '-') + '</td><td class="cb-mut">' + (r ? esc(last ? last.by : r.substituteTeacher || r.checkedBy || 'เว็บเช็คชื่อ') : '') + '</td><td class="r">' + (o.off ? '' : '<button type="button" class="btn btn-' + (r ? 'secondary' : 'primary') + ' btn-sm" data-occ="' + o.date + '|' + o.period + '"><i class="fa-solid fa-' + (r ? 'pen' : 'plus') + '"></i> ' + (r ? 'แก้ไข' : 'บันทึกย้อนหลัง') + '</button>') + '</td></tr>';
    }).join('') + (L.length ? '' : '<tr><td colspan="6" class="cb-mut">ไม่มีรายการ</td></tr>') + '</tbody></table></div>';
  }
  function stuTable() {
    var O = occs().filter(function (o) { return o.rec; });
    return '<div class="cb-tbl-wrap"><table class="cb-tbl"><thead><tr><th>เลขที่</th><th>ชื่อ – สกุล</th><th>มา</th><th>สาย</th><th>ลา</th><th>ขาด</th><th>โดด</th><th>เข้าเรียน</th></tr></thead><tbody>' + (S.students || []).map(function (s) {
      var c = { 'มา': 0, 'สาย': 0, 'ลา': 0, 'ขาด': 0, 'โดดเรียน': 0, n: 0 };
      O.forEach(function (o) { var v = o.rec.records[s.id]; if (!v) return; c.n++; if (v === 'มา' || v === 'ร่วมกิจกรรม') c['มา']++; else if (v === 'ลาป่วย' || v === 'ลากิจ') c['ลา']++; else if (c[v] !== undefined) c[v]++; });
      var p = c.n ? Math.round((c['มา'] + c['สาย']) / c.n * 100) : null, col = p == null ? '#94a3b8' : p >= 80 ? '#16a34a' : '#dc2626';
      return '<tr><td>' + esc(s.number) + '</td><td>' + esc(s.name) + '</td><td>' + c['มา'] + '</td><td>' + c['สาย'] + '</td><td>' + c['ลา'] + '</td><td>' + c['ขาด'] + '</td><td>' + c['โดดเรียน'] + '</td><td class="nw"><span class="cb-bar"><i style="width:' + (p || 0) * 0.7 + 'px;background:' + col + '"></i></span> <b style="color:' + col + '">' + (p == null ? '-' : p + '%') + '</b></td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function openOcc(o) {
    var r = o.rec, recs = r ? r.records || {} : {}, list = STATUS.slice(); if (o.act) list.unshift('ร่วมกิจกรรม');
    var hist = r && r.editLog && r.editLog.length ? '<div class="cb-log" style="margin-bottom:8px"><i class="fa-solid fa-clock-rotate-left"></i> ' + r.editLog.slice().reverse().slice(0, 5).map(function (l) { return esc(l.by || '-') + ' · ' + (l.kind === 'late' ? 'บันทึกย้อนหลัง' : 'แก้ไข') + (l.via === 'att-admin' ? ' (Super Admin เว็บเช็คชื่อ)' : '') + ' · ' + esc(formatDateTimeThai(l.at)); }).join('<br>') + '</div>' : '';
    modal((r ? 'แก้ไขการเช็คชื่อ' : 'บันทึกย้อนหลัง') + ' · ' + thD(o.date) + ' คาบ ' + plabel(o.period),
      '<p class="cb-mut" style="margin-top:-4px">' + esc((S.subject.code ? S.subject.code + ' ' : '') + S.subject.name + ' · ' + S.subject.room) + (r ? ' · เช็คครั้งแรกโดย ' + esc(r.substituteTeacher || r.checkedBy || 'เว็บเช็คชื่อ') : '') + '</p>' + hist +
      '<div class="cb-toolbar"><button type="button" class="btn btn-secondary btn-sm" data-allp><i class="fa-solid fa-check-double"></i> มาทั้งหมด</button><span class="cb-mut" id="tcCnt"></span></div><div class="cb-pick tall"><table class="cb-tbl"><tbody id="tcRows">' +
      (S.students || []).map(function (s) { return '<tr data-sid="' + esc(s.id) + '"><td>' + esc(s.number) + '</td><td>' + esc(s.name) + '</td><td><div class="cb-st">' + list.map(function (x) { return '<button type="button" data-st="' + x + '" class="' + (recs[s.id] === x ? 'on' : '') + '" style="--c:' + SCOLOR[x] + '">' + x + '</button>'; }).join('') + '</div></td></tr>'; }).join('') + '</tbody></table></div>',
      '<button type="button" class="btn btn-success" data-tc-save><i class="fa-solid fa-check"></i> บันทึก</button>');
    var mb = document.getElementById('cbModalBody');
    function cnt() { var n = 0, e = 0; mb.querySelectorAll('#tcRows tr').forEach(function (tr) { if (tr.querySelector('button.on')) n++; else e++; }); document.getElementById('tcCnt').textContent = 'เลือกแล้ว ' + n + (e ? ' · ยังไม่เลือก ' + e : ''); }
    cnt();
    mb.onclick = function (e) { var t = e.target.closest('[data-st]'); if (t) { t.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === t); }); cnt(); return; } if (e.target.closest('[data-allp]')) { mb.querySelectorAll('#tcRows tr').forEach(function (tr) { if (!tr.querySelector('button.on')) tr.querySelector('[data-st="' + (o.act ? 'ร่วมกิจกรรม' : 'มา') + '"]').classList.add('on'); }); cnt(); } };
    document.getElementById('cbModalActions').onclick = async function (e) {
      if (!e.target.closest('[data-tc-save]')) return;
      var records = {}, empty = 0; mb.querySelectorAll('#tcRows tr').forEach(function (tr) { var on = tr.querySelector('button.on'); if (on) records[tr.getAttribute('data-sid')] = on.getAttribute('data-st'); else empty++; });
      if (!Object.keys(records).length) { showToast('ยังไม่ได้เช็คชื่อนักเรียน', true); return; }
      if (empty && !(await askConfirm('ยังไม่ได้เลือกสถานะ ' + empty + ' คน — บันทึกเท่าที่เลือกไว้?', 'บันทึกการเช็คชื่อ'))) return;
      var res = await withProgress('กำลังบันทึกการเช็คชื่อ', function () { return apiCall('teachSave', Object.assign({ subjectId: S.subject.id, date: o.date, period: o.period, records: records }, st.forUser ? { forUser: st.forUser } : {})); }, { successLabel: r ? 'แก้ไขแล้ว (บันทึกประวัติ)' : 'บันทึกย้อนหลังแล้ว (บันทึกประวัติ)' });
      if (res.ok) { closeModal(); _occ = null; await loadSub(); }
    };
  }
  body.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-sub]'))) { st.sub = t.getAttribute('data-sub'); _occ = null; loadSub(); return; }
    if ((t = e.target.closest('[data-view]'))) { st.view = t.getAttribute('data-view'); render(); return; }
    if ((t = e.target.closest('[data-occ]'))) { var k = t.getAttribute('data-occ').split('|'), o = occs().filter(function (x) { return x.date === k[0] && String(x.period) === k[1]; })[0]; if (o) openOcc(o); }
  });
  boot();
})();
