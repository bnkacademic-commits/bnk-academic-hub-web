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

  var cache = {}, loadTok = 0, PAL = ['#2563eb', '#059669', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626', '#4f46e5', '#0d9488'];
  function thDate(ds) { var d = dP(ds); return d.getDate() + ' ' + MS[d.getMonth()] + ' ' + (d.getFullYear() + 543); }
  function lastDay(W, today) { return W.to && W.to < today ? W.to : today; }
  // 2.00.3: เนื้อหาเดิมคงไว้ระหว่างโหลด (ไม่กระพริบ) · "กำลังโหลด" ขึ้นเมื่อเกิน 300 ms
  function slowLoading(el, msg) { return setTimeout(function () { el.innerHTML = '<div class="loading">' + msg + '</div>'; }, 300); }
  function layout() { if (!document.getElementById('tcCards')) body.innerHTML = '<div id="tcCards"></div><div id="tcMain"></div>'; }
  async function boot() {
    layout();
    var main = document.getElementById('tcMain'), tok = ++loadTok, t = slowLoading(main, 'กำลังโหลดวิชาจากเว็บเช็คชื่อ...');
    var nb; try { nb = await apiCall('teachBoot', st.forUser ? { forUser: st.forUser } : {}); } catch (e) { clearTimeout(t); main.innerHTML = err(e.message); return; } clearTimeout(t);
    if (tok !== loadTok) return;
    B = nb; cache = {};
    renderTabs();
    var cards = document.getElementById('tcCards');
    if (!B.linked || !B.term) { cards.innerHTML = ''; main.innerHTML = '<div class="card cb-empty"><i class="fa-solid fa-link-slash"></i><p>' + esc(B.reason || 'บัญชีนี้ยังไม่ได้ผูกกับรายชื่อครูในเว็บเช็คชื่อ — ติดต่อผู้ดูแลเว็บเช็คชื่อ') + '</p></div>'; return; }
    if (!B.subjects.length) { renderCards(); main.innerHTML = '<div class="card cb-empty"><i class="fa-solid fa-book"></i><p>ไม่พบวิชาที่สอนในภาคเรียนนี้</p></div>'; return; }
    if (deep && B.subjects.some(function (s) { return s.id === deep.sub; })) st.sub = deep.sub;
    if (!st.sub || !B.subjects.some(function (s) { return s.id === st.sub; })) st.sub = B.subjects[0].id;
    renderCards();
    await loadSub();
  }
  function renderTabs() {
    var h = B.admin && B.teachers && B.teachers.length ? '<label class="cb-mut" for="tcFor">ดูวิชาของ</label> <select id="tcFor" class="cb-search">' + (B.isSuper ? '<option value="">— เลือกครู —</option>' : '') + B.teachers.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === B.forUser ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' : '';
    if (B.isSuper && B.term) h += ' <button type="button" class="btn btn-secondary btn-sm" data-tc-win><i class="fa-solid fa-calendar-days"></i> ตั้งช่วงวันที่เช็คย้อนหลัง</button>';
    tabsEl.innerHTML = h;
  }
  tabsEl.addEventListener('change', function (e) { if (e.target.id === 'tcFor') { st.forUser = e.target.value; st.sub = ''; boot(); } });
  tabsEl.addEventListener('click', function (e) { if (e.target.closest('[data-tc-win]')) openWindowCfg(); });
  // ---------- สถานะของแต่ละวิชา (การ์ด) ----------
  function statusOf(sj) {
    var keys = {}; ((B.checked || {})[sj.id] || []).forEach(function (k) { keys[k] = 1; });
    var allowed = null; if (sj.substituteOnly) { allowed = {}; (B.subs || []).forEach(function (x) { if (x.subjectId === sj.id) allowed[x.date + '|' + x.period] = 1; }); }
    var O = buildOccs(sj, function (k) { return keys[k] ? 1 : null; }, B.holidays, B.blocks, B.window.from, lastDay(B.window, B.today), allowed);
    var need = O.filter(function (o) { return !o.off && !o.act; }), miss = need.filter(function (o) { return !o.rec; }).length;
    return need.length ? (miss ? { c: 'wait', t: 'ค้าง ' + miss } : { c: 'ok', t: 'ครบ' }) : { c: 'off', t: 'ยังไม่ถึง' };
  }
  var SYS_IC = { 'เข้าแถว': 'flag', 'โฮมรูม': 'house-user', 'เขตพื้นที่': 'map-location-dot' };
  function renderCards() {
    var el = document.getElementById('tcCards'); if (!el) return;
    var sys = B.subjects.filter(function (s) { return s.system; }), reg = B.subjects.filter(function (s) { return !s.system; });
    var groups = [], gmap = {};
    reg.forEach(function (s) { var k = (s.code || '') + '|' + s.name; if (!gmap[k]) { gmap[k] = { code: s.code, name: s.name, list: [] }; groups.push(gmap[k]); } gmap[k].list.push(s); });
    var W = B.window, h = '<div class="card tc-card"><h3>วิชาที่สอน · ภาคเรียนที่ ' + esc(B.term.term) + '/' + esc(B.term.year) + (B.teacherName ? ' · ' + esc(B.teacherName) : '') + '</h3>' +
      '<p class="cb-mut tc-win"><i class="fa-solid fa-calendar-check"></i> เช็คย้อนหลังได้ ' + thDate(W.from) + ' – ' + (W.to ? thDate(W.to) : 'วันนี้') + (W.set ? '' : ' (ยังไม่ได้ตั้งช่วงวันที่ · ใช้วันเริ่มภาคเรียนของระบบ)') + ' · กดวิชา/ห้องเพื่อดูและบันทึก</p>';
    if (sys.length) {
      var rooms = {}; sys.forEach(function (s) { rooms[s.room] = 1; });
      h += '<div class="tc-sec"><i class="fa-solid fa-user-group"></i> คาบระบบ · ครูที่ปรึกษา ' + esc(Object.keys(rooms).join(', ')) + '</div><div class="tc-sys">' + sys.map(function (s) {
        var x = statusOf(s), photo = (s.system === 'homeroom' && B.features.homeroom) || (s.system === 'zone' && B.features.zone);
        return '<button type="button" class="tc-sc' + (s.id === st.sub ? ' on' : '') + '" data-sub="' + esc(s.id) + '"><span class="ic"><i class="fa-solid fa-' + (SYS_IC[s.name] || 'clipboard-check') + '"></i></span><span class="tx"><b>' + esc(s.name) + (Object.keys(rooms).length > 1 ? ' ' + esc(s.room) : '') + '</b><small>' + s.schedules.length + ' คาบ/สัปดาห์' + (photo ? ' · ต้องมีรูป' : '') + '</small></span><span class="tc-st ' + x.c + '">' + x.t + '</span></button>';
      }).join('') + '</div>';
    }
    if (groups.length) {
      h += '<div class="tc-sec"><i class="fa-solid fa-book-open"></i> รายวิชาที่สอน <small>· ' + groups.length + ' วิชา ' + reg.length + ' ห้อง</small></div><div class="tc-subj">' + groups.map(function (g, i) {
        var per = g.list.map(function (s) { return s.schedules.length; }), same = per.every(function (n) { return n === per[0]; });
        return '<div class="tc-sj" style="--c:' + PAL[i % PAL.length] + '"><div class="hd"><span class="code' + (g.code ? '' : ' none') + '">' + esc(g.code || 'ไม่มีรหัส') + '</span><div class="nm">' + esc(g.name) + '</div></div>' +
          '<div class="meta">' + (same ? per[0] + ' คาบ/สัปดาห์' + (g.list.length > 1 ? 'ต่อห้อง' : '') : 'จำนวนคาบต่างกันตามห้อง') + '</div><div class="rooms">' + g.list.map(function (s) {
            var x = statusOf(s);
            return '<button type="button" class="tc-rm' + (s.id === st.sub ? ' on' : '') + '" data-sub="' + esc(s.id) + '">' + esc(s.room) + (s.substituteOnly ? ' <small>สอนแทน</small>' : '') + ' <span class="tc-st ' + x.c + '">' + x.t + '</span></button>';
          }).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    el.innerHTML = h + '</div>';
  }
  async function loadSub() {
    var main = document.getElementById('tcMain'), id = st.sub, tok = ++loadTok;
    document.querySelectorAll('#tcCards [data-sub]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-sub') === id); });
    if (cache[id]) { S = cache[id]; _occ = null; render(); return; }
    var t = slowLoading(main, 'กำลังโหลดการเช็คชื่อ...');
    var ns; try { ns = await apiCall('teachSubject', Object.assign({ subjectId: id }, st.forUser ? { forUser: st.forUser } : {})); } catch (e) { clearTimeout(t); if (tok === loadTok) main.innerHTML = err(e.message); return; }
    clearTimeout(t);
    cache[id] = ns; if (tok !== loadTok) return;
    S = ns; _occ = null; render();
    if (deep && deep.sub === st.sub && deep.date) { var o = occs().filter(function (x) { return x.date === deep.date && String(x.period) === String(deep.period); })[0]; deep = null; if (o) openOcc(o); }
  }
  // ---------- 2.00.3: Super Admin ตั้งช่วงวันที่เช็คย้อนหลัง ----------
  function openWindowCfg() {
    var W = B.window;
    modal('<i class="fa-solid fa-calendar-days"></i> ช่วงวันที่เช็คย้อนหลังได้ · ภาคเรียนที่ ' + esc(B.term.term) + '/' + esc(B.term.year),
      '<p class="cb-mut">ครูบันทึก/แก้การเช็คชื่อย้อนหลังในหน้า "วิชาที่สอน" ได้เฉพาะวันในช่วงนี้ (วันหยุดในปฏิทินไม่นับ) · ไม่ใส่วันปิดเรียน = ถึงวันนี้ · ตั้งภาคเรียนละครั้ง</p>' +
      '<div class="field-row"><div class="field"><label for="tcWFrom">วันเปิดเรียน</label><input type="date" id="tcWFrom" value="' + esc(W.set ? W.from : '') + '" /></div><div class="field"><label for="tcWTo">วันปิดเรียน (ไม่บังคับ)</label><input type="date" id="tcWTo" value="' + esc(W.to || '') + '" /></div></div>' +
      (W.set ? '' : '<p class="cb-mut">ตอนนี้ใช้วันเริ่มภาคเรียนของระบบ (' + thDate(W.from) + ')</p>'),
      (W.set ? '<button type="button" class="btn btn-secondary" data-w-reset>ใช้ค่าเริ่มต้น</button>' : '') + '<button type="button" class="btn btn-success" data-w-save><i class="fa-solid fa-check"></i> บันทึก</button>');
    document.getElementById('cbModalActions').onclick = async function (e) {
      var reset = !!e.target.closest('[data-w-reset]'); if (!reset && !e.target.closest('[data-w-save]')) return;
      var from = reset ? '' : document.getElementById('tcWFrom').value, to = reset ? '' : document.getElementById('tcWTo').value;
      if (!reset && !from) { showToast('กรุณาเลือกวันเปิดเรียน', true); return; }
      var r = await withProgress('กำลังบันทึก', function () { return apiCall('teachCfgSave', { from: from, to: to }); }, { successLabel: 'บันทึกช่วงวันที่แล้ว' });
      if (r.ok) { closeModal(); boot(); }
    };
  }
  // ---------- คาบในช่วงที่เช็คย้อนหลังได้ ----------
  function holIn(list, ds) { return (list || []).filter(function (h) { return h.date === ds; })[0] || null; }
  function blockIn(list, sj, ds, p) {
    var g = (/^m(\d)_/.exec(sj.roomId) || [])[1] || '', lab = plabel(p);
    return (list || []).filter(function (b) { if (b.date !== ds) return false; if (b.kind === 'holiday') return true; var ok = (!b.grades || !b.grades.length) && (!b.rooms || !b.rooms.length) || (b.grades || []).indexOf(g) !== -1 || (b.rooms || []).indexOf(sj.roomId) !== -1; return ok && (!b.periods || b.periods.indexOf(lab) !== -1 || b.periods.indexOf(String(p)) !== -1); })[0] || null;
  }
  function buildOccs(sj, recOf, hols, blocks, from, to, allowed) {
    var out = [], d = dP(from), end = dP(to);
    for (var i = 0; d <= end && i < 400; i++, d.setDate(d.getDate() + 1)) {
      var ds = ymd(d), h = holIn(hols, ds), dow = d.getDay() || 7;
      var eff = h && h.type === 'makeup' && h.useDayOfWeek ? +h.useDayOfWeek : dow;
      if (dow >= 6 && !(h && h.type === 'makeup')) continue;
      var fullOff = h && (!h.type || h.type === 'holiday') && (!h.duration || h.duration === 'full');
      sj.schedules.forEach(function (sc) {
        if (sc.day !== eff) return;
        var key = ds + '|' + sc.period, rec = recOf(key), b = blockIn(blocks, sj, ds, sc.period);
        var half = h && (!h.type || h.type === 'holiday') ? h.duration : '';
        var off = fullOff || (b && b.kind === 'holiday') || (half === 'morning' && sc.period <= 4) || (half === 'afternoon' && sc.period >= 5);
        var act = !off && b && b.kind !== 'holiday';
        if (allowed && !allowed[key]) return;
        out.push({ date: ds, period: sc.period, rec: rec, off: off && !rec, act: act, label: off ? ((h && h.label) || (b && b.title) || 'วันหยุด') : act ? (b.title || 'กิจกรรม') : '' });
      });
    }
    out.sort(function (a, b) { return b.date.localeCompare(a.date) || a.period - b.period; });
    return out;
  }
  var _occ = null;
  function occs() {
    if (_occ && _occ.s === S) return _occ.list;
    var rows = {}; (S.rows || []).forEach(function (r) { rows[r.date + '|' + r.period] = r; });
    var subOnly = B.subjects.filter(function (x) { return x.id === S.subject.id; })[0], allowed = null;
    if (subOnly && subOnly.substituteOnly) { allowed = {}; (B.subs || []).forEach(function (x) { if (x.subjectId === S.subject.id) allowed[x.date + '|' + x.period] = 1; }); }
    var W = S.window || { from: S.termStart }, list = buildOccs(S.subject, function (k) { return rows[k] || null; }, S.holidays, S.blocks, W.from, lastDay(W, S.today), allowed);
    _occ = { s: S, list: list }; return list;
  }
  function render() {
    var O = occs(), need = O.filter(function (o) { return !o.off && !o.act; }), done = need.filter(function (o) { return o.rec; }), miss = need.filter(function (o) { return !o.rec; });
    var edited = O.filter(function (o) { return o.rec && o.rec.editLog && o.rec.editLog.length; }).length;
    var pct = need.length ? Math.round(done.length / need.length * 100) : null;
    var h = '<div class="cb-kp"><div><span>คาบที่ต้องเช็ค (ในช่วงที่ตั้ง)</span><b>' + need.length + '</b></div><div><span>เช็คแล้ว</span><b class="g">' + done.length + '</b></div><div><span>ยังไม่เช็ค</span><b class="r">' + miss.length + '</b></div><div><span>ภาพรวม</span><b>' + (pct == null ? '-' : pct + '%') + '</b></div></div>' +
      '<div class="card"><div class="cb-toolbar"><h3 style="margin:0">' + esc((S.subject.code ? S.subject.code + ' ' : '') + S.subject.name) + ' · ' + esc(S.subject.room) + '</h3><span class="cb-sp"></span>' + [['slots', 'รายคาบ'], ['miss', 'ยังไม่เช็ค (' + miss.length + ')'], ['stu', 'สรุปรายคน']].map(function (x) { return '<button type="button" class="cb-seg' + (st.view === x[0] ? ' on' : '') + '" data-view="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<p class="cb-mut">แตะคาบเพื่อบันทึก/แก้ไข · ทุกการแก้จากหน้านี้มีประวัติ (ใคร เมื่อไร) · ' + edited + ' คาบมีการแก้/บันทึกย้อนหลัง</p>';
    if (st.view === 'stu') h += stuTable(); else h += occTable(st.view === 'miss' ? miss : O);
    document.getElementById('tcMain').innerHTML = h + '</div>';
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
  // ---------- 2.00.3: รูปที่ต้องมี (โฮมรูม-จัดกิจกรรม / เขตพื้นที่ / สอนแทน) ----------
  function resizeImg(file) {
    return new Promise(function (resolve, reject) {
      var rd = new FileReader(); rd.onerror = function () { reject(new Error('read')); };
      rd.onload = function () { var img = new Image(); img.onerror = function () { reject(new Error('img')); }; img.onload = function () { var k = Math.min(1, 1280 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', 0.82)); }; img.src = String(rd.result); };
      rd.readAsDataURL(file);
    });
  }
  function photoBox(label, oldId) {
    return '<div class="tc-ph" data-ph><div class="tc-ph-l"><i class="fa-solid fa-camera"></i> ' + label + ' <span class="req">* 1 รูป</span></div><div class="tc-ph-b" data-ph-b>' +
      (oldId ? '<span class="cb-mut" data-ph-old>มีรูปเดิมแล้ว</span> <button type="button" class="btn btn-secondary btn-sm" data-ph-view="' + esc(oldId) + '"><i class="fa-solid fa-eye"></i> ดูรูปเดิม</button> ' : '<span class="cb-mut" data-ph-old>ยังไม่มีรูป</span> ') +
      '<button type="button" class="btn btn-primary btn-sm" data-ph-pick><i class="fa-solid fa-image"></i> ' + (oldId ? 'เปลี่ยนรูป' : 'เลือกรูป') + '</button><input type="file" accept="image/*" hidden data-ph-in /></div><div class="tc-ph-prev" data-ph-prev></div></div>';
  }
  function recSectionHtml(o, r) {
    var h = '', k = S.recKind, lg = k ? (S.logs || []).filter(function (l) { return l.date === o.date; })[0] || null : null;
    if (k === 'homeroom') {
      var held = lg ? lg.held : null;
      h += '<div class="tc-rec" data-rec="homeroom"><div class="tc-rec-h"><i class="fa-solid fa-house-user"></i> บันทึกกิจกรรมโฮมรูม' + (lg && lg.recordedBy ? ' <span class="cb-mut">· ล่าสุดโดย ' + esc(lg.recordedBy) + '</span>' : '') + '</div>' +
        '<div class="cb-seg-row"><button type="button" class="cb-seg' + (held === true ? ' on' : '') + '" data-held="1">จัดกิจกรรม</button><button type="button" class="cb-seg' + (held === false ? ' on' : '') + '" data-held="0">ไม่ได้จัด</button></div>' +
        '<div data-hr-yes' + (held === true ? '' : ' hidden') + '><div class="field"><label>ชื่อกิจกรรม</label><input type="text" maxlength="200" data-hr-act value="' + esc(lg ? lg.activity : '') + '" /></div><div class="field"><label>รายละเอียด (ไม่บังคับ)</label><input type="text" maxlength="500" data-hr-note value="' + esc(lg ? lg.note : '') + '" /></div>' + photoBox('รูปกิจกรรม', lg && lg.photos && lg.photos[0] ? lg.photos[0].id : '') + '</div>' +
        '<div data-hr-no' + (held === false ? '' : ' hidden') + '><div class="field"><label>เหตุผลที่ไม่ได้จัด</label><input type="text" maxlength="300" data-hr-reason value="' + esc(lg ? lg.reason : '') + '" /></div></div></div>';
    } else if (k === 'zone') {
      h += '<div class="tc-rec" data-rec="zone"><div class="tc-rec-h"><i class="fa-solid fa-map-location-dot"></i> รายงานเขตพื้นที่</div><div class="field"><label>สภาพเขตพื้นที่</label><input type="text" maxlength="300" data-zone-cond value="' + esc(lg ? lg.condition : '') + '" /></div>' + photoBox('รูปเขตพื้นที่', lg && lg.photos && lg.photos[0] ? lg.photos[0].id : '') + '</div>';
    }
    if (r && r.substituteTeacher && S.features && S.features.substitute) h += '<div class="tc-rec" data-rec="substitute"><div class="tc-rec-h"><i class="fa-solid fa-user-clock"></i> สอนแทนโดย ' + esc(r.substituteTeacher) + '</div>' + photoBox('รูปการสอนแทน', r.subPhoto ? r.subPhoto.id : '') + '</div>';
    return h;
  }
  function openOcc(o) {
    var r = o.rec, recs = r ? r.records || {} : {}, list = STATUS.slice(); if (o.act) list.unshift('ร่วมกิจกรรม');
    var hist = r && r.editLog && r.editLog.length ? '<div class="cb-log" style="margin-bottom:8px"><i class="fa-solid fa-clock-rotate-left"></i> ' + r.editLog.slice().reverse().slice(0, 5).map(function (l) { return esc(l.by || '-') + ' · ' + (l.kind === 'late' ? 'บันทึกย้อนหลัง' : 'แก้ไข') + (l.via === 'att-admin' ? ' (Super Admin เว็บเช็คชื่อ)' : '') + ' · ' + esc(formatDateTimeThai(l.at)); }).join('<br>') + '</div>' : '';
    var lg = S.recKind ? (S.logs || []).filter(function (l) { return l.date === o.date; })[0] || null : null;
    var ph = {}; // รูปใหม่ของแต่ละส่วน (data URL)
    modal((r ? 'แก้ไขการเช็คชื่อ' : 'บันทึกย้อนหลัง') + ' · ' + thD(o.date) + ' คาบ ' + plabel(o.period),
      '<p class="cb-mut" style="margin-top:-4px">' + esc((S.subject.code ? S.subject.code + ' ' : '') + S.subject.name + ' · ' + S.subject.room) + (r ? ' · เช็คครั้งแรกโดย ' + esc(r.substituteTeacher || r.checkedBy || 'เว็บเช็คชื่อ') : '') + '</p>' + hist +
      '<div class="cb-toolbar"><button type="button" class="btn btn-secondary btn-sm" data-allp><i class="fa-solid fa-check-double"></i> มาทั้งหมด</button><span class="cb-mut" id="tcCnt"></span></div><div class="cb-pick tall"><table class="cb-tbl"><tbody id="tcRows">' +
      (S.students || []).map(function (s) { return '<tr data-sid="' + esc(s.id) + '"><td>' + esc(s.number) + '</td><td>' + esc(s.name) + '</td><td><div class="cb-st">' + list.map(function (x) { return '<button type="button" data-st="' + x + '" class="' + (recs[s.id] === x ? 'on' : '') + '" style="--c:' + SCOLOR[x] + '">' + x + '</button>'; }).join('') + '</div></td></tr>'; }).join('') + '</tbody></table></div>' + recSectionHtml(o, r),
      '<button type="button" class="btn btn-success" data-tc-save><i class="fa-solid fa-check"></i> บันทึก</button>');
    var mb = document.getElementById('cbModalBody'), held = lg ? lg.held : null;
    function cnt() { var n = 0, e = 0; mb.querySelectorAll('#tcRows tr').forEach(function (tr) { if (tr.querySelector('button.on')) n++; else e++; }); document.getElementById('tcCnt').textContent = 'เลือกแล้ว ' + n + (e ? ' · ยังไม่เลือก ' + e : ''); }
    cnt();
    mb.onclick = async function (e) {
      var t = e.target.closest('[data-st]'); if (t) { t.parentNode.querySelectorAll('button').forEach(function (b) { b.classList.toggle('on', b === t); }); cnt(); return; }
      if (e.target.closest('[data-allp]')) { mb.querySelectorAll('#tcRows tr').forEach(function (tr) { if (!tr.querySelector('button.on')) tr.querySelector('[data-st="' + (o.act ? 'ร่วมกิจกรรม' : 'มา') + '"]').classList.add('on'); }); cnt(); return; }
      if ((t = e.target.closest('[data-held]'))) { held = t.getAttribute('data-held') === '1'; mb.querySelectorAll('[data-held]').forEach(function (b) { b.classList.toggle('on', b === t); }); mb.querySelector('[data-hr-yes]').hidden = !held; mb.querySelector('[data-hr-no]').hidden = held; return; }
      if ((t = e.target.closest('[data-ph-pick]'))) { t.parentNode.querySelector('[data-ph-in]').click(); return; }
      if ((t = e.target.closest('[data-ph-rm]'))) { var bx = t.closest('[data-ph]'); delete ph[bx.closest('[data-rec]').getAttribute('data-rec')]; bx.querySelector('[data-ph-prev]').innerHTML = ''; return; }
      if ((t = e.target.closest('[data-ph-view]'))) {
        var pv = t.closest('[data-ph]').querySelector('[data-ph-prev]'); pv.innerHTML = '<span class="cb-mut"><i class="fa-solid fa-spinner fa-spin"></i> กำลังโหลดรูปเดิม…</span>';
        try { var img = await apiCall('teachPhoto', Object.assign({ subjectId: S.subject.id, id: t.getAttribute('data-ph-view') }, st.forUser ? { forUser: st.forUser } : {})); pv.innerHTML = '<a href="' + img.image + '" target="_blank" rel="noopener"><img src="' + img.image + '" alt="รูปเดิม" /></a>'; }
        catch (er) { pv.innerHTML = err(er.message); }
      }
    };
    mb.onchange = async function (e) {
      var inp = e.target.closest('[data-ph-in]'); if (!inp) return;
      var f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
      if (!/^image\//.test(f.type)) { showToast('แนบได้เฉพาะไฟล์รูปภาพ', true); return; }
      var bx = inp.closest('[data-ph]'), key = bx.closest('[data-rec]').getAttribute('data-rec');
      try { ph[key] = await resizeImg(f); } catch (er) { showToast('อ่านไฟล์รูปนี้ไม่ได้ ลองไฟล์อื่น', true); return; }
      bx.querySelector('[data-ph-prev]').innerHTML = '<div class="tc-ph-new"><img src="' + ph[key] + '" alt="รูปใหม่" /><button type="button" class="tc-ph-x" data-ph-rm aria-label="เอารูปออก"><i class="fa-solid fa-xmark"></i></button><small>รูปใหม่ (แทนรูปเดิมเมื่อบันทึก)</small></div>';
    };
    function hasOld(key) { var b = mb.querySelector('[data-rec="' + key + '"] [data-ph-view]'); return !!b; }
    function recErr() {
      var k = S.recKind;
      if (k === 'homeroom') {
        if (held !== true && held !== false) return 'กรุณาเลือกว่า "จัดกิจกรรม" หรือ "ไม่ได้จัด"';
        if (held && !mb.querySelector('[data-hr-act]').value.trim()) return 'กรุณาพิมพ์ชื่อกิจกรรมโฮมรูมที่จัด';
        if (held && !ph.homeroom && !hasOld('homeroom')) return 'กรุณาแนบรูปกิจกรรม 1 รูปก่อนบันทึก';
        if (!held && !mb.querySelector('[data-hr-reason]').value.trim()) return 'กรุณาพิมพ์เหตุผลที่ไม่ได้จัดกิจกรรมโฮมรูม';
      } else if (k === 'zone') {
        if (!mb.querySelector('[data-zone-cond]').value.trim()) return 'กรุณาระบุสภาพเขตพื้นที่';
        if (!ph.zone && !hasOld('zone')) return 'กรุณาแนบรูปรายงานเขตพื้นที่ 1 รูปก่อนบันทึก';
      }
      if (mb.querySelector('[data-rec="substitute"]') && !ph.substitute && !hasOld('substitute')) return 'กรุณาแนบรูปการสอนแทน 1 รูปก่อนบันทึก';
      return '';
    }
    document.getElementById('cbModalActions').onclick = async function (e) {
      if (!e.target.closest('[data-tc-save]')) return;
      var records = {}, empty = 0; mb.querySelectorAll('#tcRows tr').forEach(function (tr) { var on = tr.querySelector('button.on'); if (on) records[tr.getAttribute('data-sid')] = on.getAttribute('data-st'); else empty++; });
      if (!Object.keys(records).length) { showToast('ยังไม่ได้เช็คชื่อนักเรียน', true); return; }
      var re = recErr(); if (re) { showToast(re, true); var sec = mb.querySelector('.tc-rec'); if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
      if (empty && !(await askConfirm('ยังไม่ได้เลือกสถานะ ' + empty + ' คน — บันทึกเท่าที่เลือกไว้?', 'บันทึกการเช็คชื่อ'))) return;
      var pl = Object.assign({ subjectId: S.subject.id, date: o.date, period: o.period, records: records }, st.forUser ? { forUser: st.forUser } : {});
      if (S.recKind === 'homeroom') pl.hr = { held: held, activity: held ? mb.querySelector('[data-hr-act]').value.trim() : '', note: held ? mb.querySelector('[data-hr-note]').value.trim() : '', reason: held ? '' : mb.querySelector('[data-hr-reason]').value.trim(), photo: held && ph.homeroom ? ph.homeroom.split(',')[1] : '' };
      else if (S.recKind === 'zone') pl.hr = { condition: mb.querySelector('[data-zone-cond]').value.trim(), photo: ph.zone ? ph.zone.split(',')[1] : '' };
      if (ph.substitute) pl.subPhoto = ph.substitute.split(',')[1];
      var res = await withProgress(ph.homeroom || ph.zone || ph.substitute ? 'กำลังส่งรูปและบันทึกการเช็คชื่อ' : 'กำลังบันทึกการเช็คชื่อ', function () { return apiCall('teachSave', pl); }, { successLabel: r ? 'แก้ไขแล้ว (บันทึกประวัติ)' : 'บันทึกย้อนหลังแล้ว (บันทึกประวัติ)' });
      if (res.ok) {
        closeModal(); delete cache[S.subject.id]; _occ = null;
        var ck = (B.checked[S.subject.id] = B.checked[S.subject.id] || []), key = o.date + '|' + o.period; if (ck.indexOf(key) === -1) ck.push(key);
        renderCards(); await loadSub();
      }
    };
  }
  body.addEventListener('click', function (e) {
    var t;
    if ((t = e.target.closest('[data-sub]'))) { if (st.sub === t.getAttribute('data-sub')) return; st.sub = t.getAttribute('data-sub'); _occ = null; loadSub(); return; }
    if ((t = e.target.closest('[data-view]'))) { st.view = t.getAttribute('data-view'); render(); return; }
    if ((t = e.target.closest('[data-occ]'))) { var k = t.getAttribute('data-occ').split('|'), o = occs().filter(function (x) { return x.date === k[0] && String(x.period) === k[1]; })[0]; if (o) openOcc(o); }
  });
  boot();
})();
