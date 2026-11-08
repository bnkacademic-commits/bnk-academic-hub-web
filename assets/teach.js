/* วิชาที่สอน (1.99) — หน้า teach.html · แยกไฟล์จาก api.js
 * สรุปการเช็คชื่อรายวิชา (ตั้งแต่ต้นภาคเรียนถึงวันนี้) · คาบที่ยังไม่เช็ค = บันทึกย้อนหลัง · คาบที่เช็คแล้ว = แก้ไขได้ (มีประวัติ)
 * ข้อมูลอยู่ที่เว็บเช็คชื่อ — อ่าน/เขียนผ่าน Worker ↔ Worker · เว็บเช็คชื่อตรวจสิทธิ์ซ้ำอีกชั้น */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('teach'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('cbBody'), tabsEl = document.getElementById('cbTabs');
  var B = null, S = null, st = { sub: '', forUser: '', view: location.hash === '#miss' ? 'miss' : 'slots', page: location.hash === '#leave' ? 'leave' : location.hash === '#week' ? 'week' : location.hash === '#interns' ? 'interns' : 'teach', wk: '' };
  // 2.02.0: แท็บ "นักศึกษาฝึกสอน" (ครูพี่เลี้ยง) — แสดงเมื่อมีนักศึกษาในความดูแล
  var MENT = null;
  function mountInterns() { tabsEl.innerHTML = pageTabs(); body.innerHTML = '<div id="itRoot"></div>'; if (window.mountMentorInterns) window.mountMentorInterns(document.getElementById('itRoot')); }
  if (session.role !== 'intern') apiCall('internMine', {}).then(function (r) { if (r && r.interns && r.interns.length) { MENT = r; if (st.page === 'interns') mountInterns(); else if (st.page === 'leave' || !B) tabsEl.innerHTML = pageTabs(); else renderTabs(); } else if (st.page === 'interns') { st.page = 'teach'; boot(); } }, function () { if (st.page === 'interns') { st.page = 'teach'; boot(); } });
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
    if (st.page === 'week') { renderTabs(); renderWeek(); return; }
    renderCards();
    await loadSub();
  }
  // 2.00.5: แท็บแจ้งไปราชการ / ลา — ซ่อนถ้าไม่มีสิทธิ์ (ไม่ได้เปิดให้ครูแจ้งเอง และไม่ใช่ผู้ดูแล)
  function leaveOk() { return !!((B && B.leaveTab) || (L && (L.manage || L.view || L.selfReport || L.isSuper))); }
  // 2.01.0: แท็บ "ตารางสอนรายสัปดาห์" (แบบหน้าเช็คชื่อ) — แสดงเมื่อมีวิชาที่สอน
  function pageTabs() { var tabs = [['teach', 'fa-book-open', 'วิชาที่สอน']]; if (!B || (B.subjects && B.subjects.length)) tabs.push(['week', 'fa-table-cells', 'ตารางสอนรายสัปดาห์']); if (MENT && MENT.interns.length) tabs.push(['interns', 'fa-user-graduate', 'นักศึกษาฝึกสอน (' + MENT.interns.length + ')']); if (leaveOk()) tabs.push(['leave', 'fa-user-clock', 'แจ้งไปราชการ / ลา']); if (tabs.length < 2) return ''; return '<span class="tc-pages">' + tabs.map(function (x) { return '<button type="button" class="cb-seg' + (st.page === x[0] ? ' on' : '') + '" data-tc-page="' + x[0] + '"><i class="fa-solid ' + x[1] + '"></i> ' + x[2] + '</button>'; }).join('') + '</span>'; }
  function renderTabs() {
    if (st.page === 'leave') { tabsEl.innerHTML = pageTabs(); return; }
    if (st.page === 'week') { tabsEl.innerHTML = pageTabs() + (B && B.admin && B.teachers && B.teachers.length ? ' <span class="cb-mut">ของ ' + esc(B.teacherName || '') + '</span>' : ''); return; }
    var h = pageTabs() + (B.admin && B.teachers && B.teachers.length ? '<label class="cb-mut" for="tcFor">ดูวิชาของ</label> <select id="tcFor" class="cb-search">' + (B.isSuper ? '<option value="">— เลือกครู —</option>' : '') + B.teachers.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === B.forUser ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select>' : '');
    if (B.isSuper && B.term) h += ' <button type="button" class="btn btn-secondary btn-sm" data-tc-win><i class="fa-solid fa-calendar-days"></i> ตั้งช่วงวันที่เช็คย้อนหลัง</button>';
    tabsEl.innerHTML = h;
  }
  tabsEl.addEventListener('change', function (e) { if (e.target.id === 'tcFor') { st.forUser = e.target.value; st.sub = ''; boot(); } });
  tabsEl.addEventListener('click', function (e) {
    if (e.target.closest('[data-tc-win]')) { openWindowCfg(); return; }
    var pg = e.target.closest('[data-tc-page]'); if (!pg || pg.getAttribute('data-tc-page') === st.page) return;
    st.page = pg.getAttribute('data-tc-page'); try { history.replaceState(null, '', st.page === 'leave' ? '#leave' : st.page === 'week' ? '#week' : st.page === 'interns' ? '#interns' : location.pathname + location.search); } catch (x) { /* ข้าม */ }
    if (st.page === 'interns') { mountInterns(); return; }
    if (st.page === 'leave') { tabsEl.innerHTML = pageTabs(); renderLeave(); }
    else if (st.page === 'week') { if (B && B.linked && B.term) { renderTabs(); renderWeek(); } else { body.innerHTML = ''; boot(); } }
    else if (B && B.linked && B.term && B.subjects.length) { body.innerHTML = ''; layout(); renderTabs(); renderCards(); loadSub(); } // 2.00.5: วาดจากข้อมูลเดิม ไม่โหลดใหม่ (ไม่กระพริบ)
    else { body.innerHTML = ''; boot(); }
  });
  // ---------- สถานะของแต่ละวิชา (การ์ด) ----------
  function statusOf(sj) {
    var keys = {}; ((B.checked || {})[sj.id] || []).forEach(function (k) { keys[k] = 1; });
    var allowed = null; if (sj.substituteOnly) { allowed = {}; (B.subs || []).forEach(function (x) { if (x.subjectId === sj.id) allowed[x.date + '|' + x.period] = 1; }); }
    var O = buildOccs(sj, function (k) { return keys[k] ? 1 : null; }, B.holidays, B.blocks, B.window.from, lastDay(B.window, B.today), allowed, B.leaves);
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
  // ---------- 2.01.0: ตารางสอนรายสัปดาห์ (จันทร์–ศุกร์ × คาบ) — ข้อมูลจาก teachBoot ไม่โหลดเพิ่ม ----------
  var WK_ORDER = [-2, 0, 1, 2, 3, 4, 5, 6, 7, 8], WK_ST = { ok: ['#ecfdf5', '#10b981', 'เช็คแล้ว'], no: ['#fef2f2', '#ef4444', 'ยังไม่เช็ค'], off: ['#f8fafc', '#cbd5e1', 'หยุดเรียน'], act: ['#f0f9ff', '#7dd3fc', 'กิจกรรม'], leave: ['#f1f5f9', '#94a3b8', 'ไปราชการ / ลา'], future: ['#ffffff', '#cbd5e1', 'ยังไม่ถึง'] };
  function mondayOf(ds) { var d = dP(ds), dw = d.getDay() || 7; d.setDate(d.getDate() - (dw - 1)); return ymd(d); }
  function addD(ds, n) { var d = dP(ds); d.setDate(d.getDate() + n); return ymd(d); }
  function renderWeek() {
    var today = B.today || ymd(new Date()), from = (B.window && B.window.from) || today, minMon = mondayOf(from), maxMon = mondayOf(today);
    if (!st.wk) st.wk = maxMon; if (st.wk < minMon) st.wk = minMon; if (st.wk > maxMon) st.wk = maxMon;
    var mon = st.wk, fri = addD(mon, 4), days = [0, 1, 2, 3, 4].map(function (i) { return addD(mon, i); }), grid = {}, used = {};
    B.subjects.forEach(function (sj) {
      var keys = {}; ((B.checked || {})[sj.id] || []).forEach(function (k) { keys[k] = 1; });
      var allowed = null; if (sj.substituteOnly) { allowed = {}; (B.subs || []).forEach(function (x) { if (x.subjectId === sj.id) allowed[x.date + '|' + x.period] = 1; }); }
      buildOccs(sj, function (k) { return keys[k] ? 1 : null; }, B.holidays, B.blocks, mon < from ? from : mon, fri, allowed, B.leaves).forEach(function (o) {
        var stt = o.rec ? 'ok' : o.leave ? 'leave' : o.off ? 'off' : o.act ? 'act' : (o.date > today ? 'future' : 'no');
        var k = o.period + '|' + o.date; (grid[k] = grid[k] || []).push({ sj: sj, o: o, st: stt }); used[o.period] = 1;
      });
    });
    var holOf = function (ds) { var h = holIn(B.holidays, ds); return h && (!h.type || h.type === 'holiday') && (!h.duration || h.duration === 'full') ? (h.label || 'วันหยุด') : ''; };
    var per = WK_ORDER.filter(function (p) { return used[p]; });
    var ok = 0, need = 0; Object.keys(grid).forEach(function (k) { grid[k].forEach(function (x) { if (x.st === 'ok') { ok++; need++; } else if (x.st === 'no') need++; }); });
    var pct = need ? Math.round(ok / need * 100) : null, pc = pct == null ? '#64748b' : pct >= 90 ? '#16a34a' : pct >= 75 ? '#d97706' : '#dc2626';
    var h = '<div class="card"><div class="tc-wk-top"><div><h3 style="margin:0">ตารางสอนของ' + (B.forUser && B.admin && B.teacherName ? ' ' + esc(B.teacherName) : 'ฉัน') + '</h3><div class="cb-mut">' + esc('ภาคเรียนที่ ' + B.term.term + '/' + B.term.year) + ' · กดช่องเพื่อเช็คชื่อ / แก้ไข</div></div>' +
      '<div class="tc-wk-nav"><button type="button" class="btn btn-ghost btn-sm" data-wk="-1"' + (mon <= minMon ? ' disabled' : '') + ' aria-label="สัปดาห์ก่อน"><i class="fa-solid fa-chevron-left"></i></button><b>' + thDate(mon).replace(/ \d{4}$/, '') + ' – ' + thDate(fri) + '</b><button type="button" class="btn btn-ghost btn-sm" data-wk="1"' + (mon >= maxMon ? ' disabled' : '') + ' aria-label="สัปดาห์ถัดไป"><i class="fa-solid fa-chevron-right"></i></button>' +
      '<span class="tc-wk-pct" style="color:' + pc + '">' + (pct == null ? '-' : pct + '%') + ' <small class="cb-mut">(' + ok + '/' + need + ' คาบ)</small></span></div></div>';
    if (!per.length) h += '<div class="cb-empty" style="padding:30px"><i class="fa-solid fa-mug-hot"></i><p>สัปดาห์นี้ไม่มีคาบสอน</p></div>';
    else h += '<div class="cb-tbl-wrap"><table class="tc-wk"><thead><tr><th>คาบ</th>' + days.map(function (ds) { var off = holOf(ds); return '<th>' + thD(ds) + (off ? '<div class="tc-wk-off">' + esc(off) + '</div>' : '') + '</th>'; }).join('') + '</tr></thead><tbody>' +
      per.map(function (p) { return '<tr><th>' + plabel(p) + '<small>' + (TIMES[String(p)] || '') + '</small></th>' + days.map(function (ds) { var L = grid[p + '|' + ds] || []; if (!L.length) return '<td class="tc-wk-e"></td>'; return '<td>' + L.map(function (x) { var C = WK_ST[x.st]; return '<button type="button" class="tc-wk-c" style="background:' + C[0] + ';border-color:' + C[1] + '" data-wk-open="' + esc(x.sj.id) + '|' + x.o.date + '|' + x.o.period + '"' + (x.st === 'future' ? ' disabled' : '') + '><i style="background:' + C[1] + '"></i><div style="min-width:0"><b>' + esc(x.sj.room || '') + ' ' + esc(x.sj.name) + '</b><span>' + esc(x.st === 'off' || x.st === 'act' ? (x.o.label || C[2]) : x.st === 'leave' ? (x.o.label || C[2]) + ' (ไม่นับ)' : C[2]) + '</span></div></button>'; }).join('') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
      (per.length ? wkMobile(days, per, grid, holOf, today) : '') +
      '<div class="tc-lg" style="margin-top:8px">' + ['ok', 'no', 'off', 'act', 'leave'].map(function (k) { return '<span><i style="background:' + WK_ST[k][1] + '"></i>' + WK_ST[k][2] + '</span>'; }).join('') + '</div>';
    body.innerHTML = h + '</div>';
  }
  // 2.02.0: มือถือ — เลือกวัน แล้วเห็นคาบของวันนั้นเรียงลงมา (แทนตารางกว้าง · ตารางยังอยู่บนจอใหญ่)
  function wkMobile(days, per, grid, holOf, today) {
    var di = st.wkDay; if (di == null || di < 0 || di > 4) { di = days.indexOf(today); if (di < 0) di = 0; }
    st.wkDay = di; var ds = days[di], off = holOf(ds);
    var h = '<div class="tc-wkm"><div class="tc-wkm-days">' + days.map(function (d, i) { var n = 0; per.forEach(function (p) { n += (grid[p + '|' + d] || []).length; });
      return '<button type="button" class="' + (i === di ? 'on' : '') + (d === today ? ' td' : '') + '" data-wkd="' + i + '" aria-pressed="' + (i === di) + '">' + ['จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.'][i] + '<b>' + Number(d.slice(8)) + '</b><small>' + (n ? n + ' คาบ' : '-') + '</small></button>'; }).join('') + '</div>';
    if (off) h += '<div class="tc-wkm-off"><i class="fa-solid fa-umbrella-beach"></i> ' + esc(off) + '</div>';
    var rows = per.map(function (p) { var L = grid[p + '|' + ds] || []; return { p: p, L: L }; });
    if (!rows.some(function (r) { return r.L.length; })) return h + '<div class="cb-empty" style="padding:22px"><i class="fa-solid fa-mug-hot"></i><p>วันนี้ไม่มีคาบสอน</p></div></div>';
    rows.forEach(function (r) {
      h += '<div class="tc-wkm-r"><div class="tc-wkm-t"><b>' + plabel(r.p) + '</b>' + esc(TIMES[String(r.p)] || '') + '</div><div class="tc-wkm-l">' +
        (r.L.length ? r.L.map(function (x) { var C = WK_ST[x.st]; return '<button type="button" class="tc-wkm-c" style="border-left-color:' + C[1] + '" data-wk-open="' + esc(x.sj.id) + '|' + x.o.date + '|' + x.o.period + '"' + (x.st === 'future' ? ' disabled' : '') + '><b>' + esc((x.sj.code ? x.sj.code + ' ' : '') + x.sj.name) + '</b><span>' + esc(x.sj.room || '') + ' · <i style="background:' + C[1] + '"></i>' + esc(x.st === 'off' || x.st === 'act' ? (x.o.label || C[2]) : x.st === 'leave' ? (x.o.label || C[2]) + ' (ไม่นับ)' : C[2]) + '</span></button>'; }).join('') : '<div class="tc-wkm-e">ว่าง</div>') + '</div></div>';
    });
    return h + '</div>';
  }
  body.addEventListener('click', function (e) {
    if (st.page !== 'week') return;
    var dd = e.target.closest('[data-wkd]'); if (dd) { st.wkDay = Number(dd.getAttribute('data-wkd')); renderWeek(); return; }
    var b = e.target.closest('[data-wk]'); if (b) { st.wk = addD(st.wk, Number(b.getAttribute('data-wk')) * 7); st.wkDay = null; renderWeek(); return; }
    var c = e.target.closest('[data-wk-open]'); if (!c) return;
    var a = c.getAttribute('data-wk-open').split('|'); deep = { sub: a[0], date: a[1], period: a[2] }; st.sub = a[0]; st.page = 'teach';
    try { history.replaceState(null, '', location.pathname + location.search); } catch (x) { /* ข้าม */ }
    body.innerHTML = ''; layout(); renderTabs(); renderCards(); loadSub();
  }, true);
  function holIn(list, ds) { return (list || []).filter(function (h) { return h.date === ds; })[0] || null; }
  function blockIn(list, sj, ds, p) {
    var g = (/^m(\d)_/.exec(sj.roomId) || [])[1] || '', lab = plabel(p);
    return (list || []).filter(function (b) { if (b.date !== ds) return false; if (b.kind === 'holiday') return true; var ok = (!b.grades || !b.grades.length) && (!b.rooms || !b.rooms.length) || (b.grades || []).indexOf(g) !== -1 || (b.rooms || []).indexOf(sj.roomId) !== -1; return ok && (!b.periods || b.periods.indexOf(lab) !== -1 || b.periods.indexOf(String(p)) !== -1); })[0] || null;
  }
  function leaveOf(L, ds, p) { return (L || []).filter(function (l) { return l.date === ds && (!l.periods || !l.periods.length || l.periods.indexOf(Number(p)) !== -1); })[0] || null; }
  function buildOccs(sj, recOf, hols, blocks, from, to, allowed, leaves) {
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
        var lv = !off && !rec ? leaveOf(leaves, ds, sc.period) : null; // 2.00.4: แจ้งไปราชการ / ลา = ไม่นับ
        if (lv) { out.push({ date: ds, period: sc.period, rec: null, off: true, act: false, leave: true, label: lv.label }); return; }
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
    var W = S.window || { from: S.termStart }, list = buildOccs(S.subject, function (k) { return rows[k] || null; }, S.holidays, S.blocks, W.from, lastDay(W, S.today), allowed, S.leaves);
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
      var stH = o.off ? '<span class="cb-tag gr">' + (o.leave ? '<i class="fa-solid fa-user-clock"></i> ครู' : '') + esc(o.label) + ' (ไม่นับ)</span>' : r ? '<span class="cb-tag ok">เช็คแล้ว</span>' + (last ? ' <span class="cb-tag wt">' + (last.kind === 'late' ? 'บันทึกย้อนหลัง' : 'แก้ไข') + '</span>' : '') : o.act ? '<span class="cb-tag gr">' + esc(o.label) + '</span>' : '<span class="cb-tag no">ยังไม่เช็ค</span>';
      return '<tr><td class="nw"><b>' + thD(o.date) + '</b></td><td>' + plabel(o.period) + ' <span class="cb-mut">' + (TIMES[String(o.period)] || '') + '</span></td><td>' + stH + '</td><td>' + (r ? pres + ' / ' + n : '-') + '</td><td class="cb-mut">' + (r ? esc(last ? last.by : r.substituteTeacher || r.checkedBy || 'เว็บเช็คชื่อ') : '') + '</td><td class="r">' + (o.off ? '' : '<button type="button" class="btn btn-' + (r ? 'secondary' : 'primary') + ' btn-sm" data-occ="' + o.date + '|' + o.period + '"><i class="fa-solid fa-' + (r ? 'pen' : 'plus') + '"></i> ' + (r ? 'แก้ไข' : 'บันทึกย้อนหลัง') + '</button>') + '</td></tr>';
    }).join('') + (L.length ? '' : '<tr><td colspan="6" class="cb-mut">ไม่มีรายการ</td></tr>') + '</tbody></table></div>';
  }
  // 2.00.4: สรุปรายคน — สีเดียวกับเว็บเช็คชื่อ · หลอดสัดส่วนรวม 100% (มา / สาย / ลา / ขาด / โดด) + แจกแจง %
  var SUMK = [['มา', '#10b981'], ['สาย', '#f59e0b'], ['ลา', '#3b82f6'], ['ขาด', '#f43f5e'], ['โดดเรียน', '#9333ea']];
  function pct100(v) { // ปัดเศษให้รวมได้ 100 พอดี (เศษมากได้ก่อน)
    var n = v.reduce(function (a, b) { return a + b; }, 0); if (!n) return v.map(function () { return 0; });
    var raw = v.map(function (x) { return x * 100 / n; }), fl = raw.map(Math.floor), left = 100 - fl.reduce(function (a, b) { return a + b; }, 0);
    raw.map(function (x, i) { return { i: i, f: x - fl[i] }; }).sort(function (a, b) { return b.f - a.f; }).slice(0, left).forEach(function (x) { fl[x.i]++; });
    return fl;
  }
  function stuTable() {
    var O = occs().filter(function (o) { return o.rec; });
    return '<div class="tc-lg">' + SUMK.map(function (k) { return '<span><i style="background:' + k[1] + '"></i>' + (k[0] === 'ลา' ? 'ลา (ป่วย + กิจ)' : k[0] === 'โดดเรียน' ? 'โดด' : k[0]) + '</span>'; }).join('') + '<span class="cb-mut">· นับจากคาบที่เช็คแล้ว ' + O.length + ' คาบ · ตัวเลขท้ายหลอด = เข้าเรียน (มา + สาย)</span></div>' +
      '<div class="cb-tbl-wrap"><table class="cb-tbl tc-sum"><thead><tr><th>เลขที่</th><th>ชื่อ – สกุล</th><th>มา</th><th>สาย</th><th>ลา</th><th>ขาด</th><th>โดด</th><th>สัดส่วน · เข้าเรียน</th></tr></thead><tbody>' + (S.students || []).map(function (s) {
      var c = { 'มา': 0, 'สาย': 0, 'ลา': 0, 'ขาด': 0, 'โดดเรียน': 0, n: 0 };
      O.forEach(function (o) { var v = o.rec.records[s.id]; if (!v) return; c.n++; if (v === 'มา' || v === 'ร่วมกิจกรรม') c['มา']++; else if (v === 'ลาป่วย' || v === 'ลากิจ') c['ลา']++; else if (c[v] !== undefined) c[v]++; });
      var vals = SUMK.map(function (k) { return c[k[0]]; }), pc = pct100(vals), p = c.n ? Math.round((c['มา'] + c['สาย']) / c.n * 100) : null, col = p == null ? '#94a3b8' : p >= 80 ? '#16a34a' : '#dc2626';
      return '<tr><td>' + esc(s.number) + '</td><td>' + esc(s.name) + '</td>' + vals.map(function (x, i) { return '<td><span class="tc-n' + (x ? '' : ' z') + '"' + (x ? ' style="--k:' + SUMK[i][1] + '"' : '') + '>' + x + '</span></td>'; }).join('') +
        '<td class="nw">' + (c.n ? '<div class="tc-bw"><span class="tc-bar">' + vals.map(function (x, i) { return x ? '<i style="width:' + (x / c.n * 100) + '%;background:' + SUMK[i][1] + '"></i>' : ''; }).join('') + '</span><b style="color:' + col + '">' + p + '%</b></div>' +
        '<div class="tc-pb">' + pc.map(function (x, i) { return '<span' + (vals[i] ? ' style="color:' + SUMK[i][1] + '"' : ' class="z"') + '>' + x + '%</span>'; }).join('<em>/</em>') + '</div>' : '<span class="cb-mut">-</span>') + '</td></tr>';
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
  // ---------- 2.00.4: แจ้งครูไปราชการ / ลา (มีผลทันที · คาบในวันนั้นไม่นับเป็นค้างเช็คชื่อ) ----------
  var L = null, LV = { items: null, q: '', sel: [], kind: 'official', allDay: true, periods: [], ev: null, evBusy: false, mgr: null };
  var PLIST = [-2, 0, 1, 2, 3, 4, 5, 6, 7, 8];
  async function leaveClick(e) {
    var t;
    if ((t = e.target.closest('[data-lv-kind]'))) { lvKeep(); LV.kind = t.getAttribute('data-lv-kind'); renderLeave(); return; }
    if ((t = e.target.closest('[data-lv-all]'))) { lvKeep(); LV.allDay = t.getAttribute('data-lv-all') === '1'; renderLeave(); return; }
    if ((t = e.target.closest('[data-lv-unsel]'))) { lvKeep(); LV.sel = LV.sel.filter(function (x) { return x !== t.getAttribute('data-lv-unsel'); }); renderLeave(); return; }
    if (e.target.closest('[data-lv-ev]')) { document.getElementById('lvEvIn').click(); return; }
    if (e.target.closest('[data-lv-evrm]')) { lvKeep(); LV.ev = null; renderLeave(); return; }
    if ((t = e.target.closest('[data-lm-rm]'))) { lvKeep(); LV.mgr.splice(+t.getAttribute('data-lm-rm'), 1); renderLeave(); return; }
    if ((t = e.target.closest('[data-lv-del]'))) {
      if (!(await askConfirm('ลบรายการแจ้งนี้?', 'ลบรายการ'))) return;
      var rd = await withProgress('กำลังลบ', function () { return apiCall('leaveDelete', { id: t.getAttribute('data-lv-del') }); }, { successLabel: 'ลบแล้ว' });
      if (rd.ok) { LV.items = null; cache = {}; renderLeave(); }
      return;
    }
    if (e.target.closest('[data-lv-save]')) {
      lvKeep();
      if (L.manage && !LV.sel.length) { showToast('กรุณาเลือกครู', true); return; }
      if (!LV.from) { showToast('กรุณาเลือกวันที่', true); return; }
      if (!LV.allDay && !LV.periods.length) { showToast('กรุณาเลือกคาบ หรือเลือก "ทั้งวัน"', true); return; }
      if (LV.evBusy) { showToast('กรุณารอให้อัปโหลดหลักฐานเสร็จก่อน', true); return; }
      var pl = { userIds: L.manage ? LV.sel : [L.me.id], kind: LV.kind, from: LV.from, to: LV.to || LV.from, periods: LV.allDay ? [] : LV.periods, note: LV.note || '', evidenceId: LV.ev ? LV.ev.id : '' };
      var r = await withProgress('กำลังบันทึกการแจ้ง', function () { return apiCall('leaveSave', pl); }, { successLabel: 'บันทึกการแจ้งแล้ว' });
      if (r.ok) { LV.items = null; LV.sel = []; LV.note = ''; LV.ev = null; LV.to = ''; cache = {}; renderLeave(); }
      return;
    }
    if (e.target.closest('[data-lm-save]')) {
      var c = { selfReport: document.getElementById('lvSelf').checked, evidence: document.getElementById('lvEvOn').checked }; // 2.02.4: ผู้ดูแลการแจ้งตั้งในหน้าตั้งค่า
      var rs = await withProgress('กำลังบันทึกการตั้งค่า', function () { return apiCall('leaveCfgSave', c); }, { successLabel: 'บันทึกการตั้งค่าแล้ว' });
      if (rs.ok) { L = null; LV.mgr = null; LV.items = null; renderLeave(); }
    }
  }
  async function renderLeave() {
    if (!L) { var t = slowLoading(body, 'กำลังโหลด...'); try { L = await apiCall('leaveBoot', {}); } catch (e) { clearTimeout(t); body.innerHTML = err(e.message); return; } clearTimeout(t); }
    tabsEl.innerHTML = pageTabs();
    if (!leaveOk()) { st.page = 'teach'; try { history.replaceState(null, '', location.pathname + location.search); } catch (x) { /* ข้าม */ } body.innerHTML = ''; boot(); return; }
    if (!L.sqlReady) { body.innerHTML = '<div class="card">' + err('ยังใช้ส่วนนี้ไม่ได้ — ผู้ดูแลระบบต้องรัน SQL ชุดที่สามสิบเจ็ดก่อน (ดู README)') + '</div>'; return; }
    if (!L.term) { body.innerHTML = '<div class="card cb-empty"><i class="fa-solid fa-sun"></i><p>ช่วงนี้ไม่ใช่ภาคเรียนปกติ</p></div>'; return; }
    if (!LV.items) { try { LV.items = (await apiCall('leaveList', {})).items || []; } catch (e) { body.innerHTML = err(e.message); return; } }
    var canAdd = L.manage || L.selfReport, h = '';
    h += '<div class="card"><h3><i class="fa-solid fa-user-clock"></i> แจ้งครูไปราชการ / ลา · ภาคเรียนที่ ' + esc(L.term.term) + '/' + esc(L.term.year) + '</h3><p class="cb-mut">มีผลทันที · คาบในวันที่แจ้งจะเป็น "ไปราชการ / ลา (ไม่นับ)" ในหน้าวิชาที่สอน · ไม่เตือน "ยังไม่ได้เช็คชื่อ" · รายงานรายสัปดาห์ของเว็บเช็คชื่อแสดงเป็นสีเทา · แจ้งได้ตั้งแต่ ' + thDate(L.from) + (L.to ? ' ถึง ' + thDate(L.to) : '') + '</p>';
    if (!canAdd) h += '<div class="cb-info"><i class="fa-solid fa-circle-info"></i> ตอนนี้ครูยังแจ้งเองไม่ได้ — แจ้งผู้ดูแลการแจ้งลา / ไปราชการ (ด้านล่างคือรายการของคุณ)</div>';
    else {
      h += '<div class="tc-lf">';
      if (L.manage) {
        var ppl = (L.people || []).filter(function (u) { return !LV.q || u.name.indexOf(LV.q) !== -1; });
        h += '<div class="field"><label>ครู <span class="cb-mut">(เลือกได้หลายคน · เลือกแล้ว ' + LV.sel.length + ' คน)</span></label><div class="cb-chips">' + LV.sel.map(function (id) { var u = (L.people || []).filter(function (x) { return x.id === id; })[0]; return '<span class="cb-chip">' + esc(u ? u.name : id) + ' <button type="button" class="cb-x" data-lv-unsel="' + esc(id) + '" aria-label="เอาออก"><i class="fa-solid fa-xmark"></i></button></span>'; }).join('') + '</div>' +
          '<input type="search" class="cb-search" id="lvQ" placeholder="ค้นหาชื่อครู" value="' + esc(LV.q) + '" /><div class="cb-pick tc-lp">' + ppl.slice(0, 200).map(function (u) { return '<label class="cb-prow"><input type="checkbox" data-lv-pick="' + esc(u.id) + '"' + (LV.sel.indexOf(u.id) !== -1 ? ' checked' : '') + ' /> ' + esc(u.name) + '</label>'; }).join('') + '</div></div>';
      } else h += '<div class="field"><label>ครู</label><div><b>' + esc(L.me.name) + '</b> (แจ้งของตัวเอง)</div></div>';
      h += '<div class="field"><label>ประเภท</label><div class="cb-seg-row">' + Object.keys(L.kinds).map(function (k) { return '<button type="button" class="cb-seg' + (LV.kind === k ? ' on' : '') + '" data-lv-kind="' + k + '">' + esc(L.kinds[k]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field-row"><div class="field"><label for="lvFrom">ตั้งแต่วันที่</label><input type="date" id="lvFrom" min="' + esc(L.from) + '"' + (L.to ? ' max="' + esc(L.to) + '"' : '') + ' value="' + esc(LV.from || L.today || '') + '" /></div><div class="field"><label for="lvTo">ถึงวันที่</label><input type="date" id="lvTo" min="' + esc(L.from) + '"' + (L.to ? ' max="' + esc(L.to) + '"' : '') + ' value="' + esc(LV.to || '') + '" /></div></div>' +
        '<div class="field"><label>คาบ</label><div class="cb-seg-row"><button type="button" class="cb-seg' + (LV.allDay ? ' on' : '') + '" data-lv-all="1">ทั้งวัน</button><button type="button" class="cb-seg' + (LV.allDay ? '' : ' on') + '" data-lv-all="0">เฉพาะบางคาบ</button></div>' +
        (LV.allDay ? '' : '<div class="tc-lper">' + PLIST.map(function (p) { return '<label><input type="checkbox" data-lv-p="' + p + '"' + (LV.periods.indexOf(p) !== -1 ? ' checked' : '') + ' /> คาบ ' + plabel(p) + '</label>'; }).join('') + '</div>') + '</div>' +
        '<div class="field"><label for="lvNote">หมายเหตุ (ไม่บังคับ)</label><input type="text" id="lvNote" maxlength="300" placeholder="เช่น อบรมที่ สพม. · ครูที่สอนแทน" value="' + esc(LV.note || '') + '" /></div>' +
        (L.evidence ? '<div class="field"><label>หลักฐาน (ไม่บังคับ)</label><div class="cb-inl">' + (LV.ev ? '<a href="' + esc(LV.ev.url) + '" target="_blank" rel="noopener">' + esc(LV.ev.name) + '</a> <button type="button" class="cb-x" data-lv-evrm aria-label="เอาออก"><i class="fa-solid fa-xmark"></i></button>' : LV.evBusy ? '<span class="cb-mut"><i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปโหลด…</span>' : '<button type="button" class="btn btn-secondary btn-sm" data-lv-ev><i class="fa-solid fa-upload"></i> แนบไฟล์</button>') + '<input type="file" id="lvEvIn" hidden /></div></div>' : '') +
        '<div class="cb-actions"><span class="cb-sp"></span><button type="button" class="btn btn-success" data-lv-save><i class="fa-solid fa-check"></i> บันทึกการแจ้ง</button></div></div>';
    }
    h += '</div><div class="card"><div class="cb-toolbar"><h3 style="margin:0">รายการที่แจ้ง' + (L.manage || L.view ? ' (ทุกคน)' : ' (ของฉัน)') + ' · ' + LV.items.length + ' รายการ</h3></div><div class="cb-tbl-wrap"><table class="cb-tbl"><thead><tr><th>วันที่</th>' + (L.manage || L.view ? '<th>ครู</th>' : '') + '<th>ประเภท</th><th>คาบ</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>' +
      LV.items.map(function (x) { return '<tr><td class="nw"><b>' + thD(x.date) + '</b></td>' + (L.manage || L.view ? '<td>' + esc(x.name) + '</td>' : '') + '<td><span class="cb-tag ' + (x.kind === 'official' ? 'wt' : 'gr') + '">' + esc(x.kindLabel) + '</span></td><td>' + (x.periods.length ? x.periods.map(plabel).join(', ') : 'ทั้งวัน') + '</td><td>' + esc(x.note) + (x.evidence ? ' <a href="' + esc(x.evidence.url) + '" target="_blank" rel="noopener"><i class="fa-solid fa-paperclip"></i> ' + esc(x.evidence.name) + '</a>' : '') + '</td><td class="r">' + (x.canDelete ? '<button type="button" class="btn btn-ghost btn-sm" data-lv-del="' + esc(x.id) + '"><i class="fa-solid fa-trash"></i> ลบ</button>' : '') + '</td></tr>'; }).join('') +
      (LV.items.length ? '' : '<tr><td colspan="6" class="cb-mut">ยังไม่มีรายการในภาคเรียนนี้</td></tr>') + '</tbody></table></div></div>';
    if (L.isSuper) {
      if (!LV.mgr) LV.mgr = (L.managers || []).map(function (m) { return { id: m.id, manage: !!m.manage, view: !!m.view }; });
      var nm = {}; (L.people || []).forEach(function (u) { nm[u.id] = u.name; });
      h += '<div class="card"><h3><i class="fa-solid fa-user-shield"></i> ตั้งค่าการแจ้ง (ผู้ดูแลระบบสูงสุด)</h3>' +
        '<label class="evk-chk"><input type="checkbox" id="lvSelf"' + (L.selfReport ? ' checked' : '') + ' /><span><b>ให้ครูแจ้งของตัวเองได้</b><small>ปิด = เฉพาะผู้ดูแลการแจ้ง (สิทธิ์จัดการ) แจ้งแทน</small></span></label>' +
        '<label class="evk-chk"><input type="checkbox" id="lvEvOn"' + (L.evidence ? ' checked' : '') + ' /><span><b>แนบหลักฐานได้</b><small>เช่น หนังสือราชการ / ใบลา (ไม่บังคับ · เก็บใน Google Drive)</small></span></label>' +
        '<p class="cb-mut"><i class="fa-solid fa-user-shield"></i> ผู้ดูแลการแจ้ง (จัดการ / ดูผล) ตั้งได้ที่ <a href="settings.html#managers">ตั้งค่าระบบ › จัดการผู้ดูแล</a></p>' + // 2.02.4 ย้ายไปตั้งค่า
        '<div class="cb-actions"><span class="cb-sp"></span><button type="button" class="btn btn-success" data-lm-save><i class="fa-solid fa-check"></i> บันทึกการตั้งค่า</button></div></div>';
    }
    var y = window.scrollY; body.innerHTML = h; window.scrollTo(0, y);
  }
  function lvKeep() { var f = document.getElementById('lvFrom'), t = document.getElementById('lvTo'), n = document.getElementById('lvNote'); if (f) LV.from = f.value; if (t) LV.to = t.value; if (n) LV.note = n.value; }
  body.addEventListener('input', debounce(function (e) { if (e.target.id === 'lvQ') { lvKeep(); LV.q = e.target.value.trim(); var pos = e.target.selectionStart; renderLeave().then(function () { var q = document.getElementById('lvQ'); if (q) { q.focus(); try { q.setSelectionRange(pos, pos); } catch (x) { /* ข้าม */ } } }); } }, 220)); // 2.01.0
  body.addEventListener('change', async function (e) {
    var t = e.target;
    if (t.matches('[data-lv-pick]')) { lvKeep(); var id = t.getAttribute('data-lv-pick'), i = LV.sel.indexOf(id); if (t.checked && i === -1) LV.sel.push(id); else if (!t.checked && i !== -1) LV.sel.splice(i, 1); renderLeave(); return; }
    if (t.matches('[data-lv-p]')) { var p = Number(t.getAttribute('data-lv-p')), j = LV.periods.indexOf(p); if (t.checked && j === -1) LV.periods.push(p); else if (!t.checked && j !== -1) LV.periods.splice(j, 1); return; }
    if (t.id === 'lmAdd' && t.value) { lvKeep(); LV.mgr.push({ id: t.value, manage: false, view: true }); renderLeave(); return; }
    if (t.matches('[data-lm-m]')) { var m = LV.mgr[+t.getAttribute('data-lm-m')]; m.manage = t.checked; if (m.manage) m.view = true; lvKeep(); renderLeave(); return; }
    if (t.matches('[data-lm-v]')) { LV.mgr[+t.getAttribute('data-lm-v')].view = t.checked; return; }
    if (t.id === 'lvEvIn') {
      var f = t.files && t.files[0]; t.value = ''; if (!f) return; lvKeep(); LV.evBusy = true; renderLeave();
      try {
        var prep = await apiCall('leaveUploadPrepare', { fileName: f.name, mimeType: f.type, fileSize: f.size, direct: 1, origin: location.origin });
        var res = await sendPreparedFile(prep, f, { filename: prep.uploadFileName || f.name, mimeType: f.type });
        LV.ev = await apiCall('leaveUploadFinalize', { evidenceId: prep.evidenceId, fileId: res.fileId, fileUrl: res.url, directUrl: res.directUrl, fileName: prep.uploadFileName || f.name, mimeType: f.type, via: res.via, fallbackReason: res.fallbackReason || '' });
      } catch (x) { showToast('อัปโหลดไม่สำเร็จ: ' + x.message, true); }
      LV.evBusy = false; renderLeave();
    }
  });
  body.addEventListener('click', function (e) {
    var t;
    if (st.page === 'leave') { leaveClick(e); return; }
    if (st.page === 'interns') return;
    if ((t = e.target.closest('[data-sub]'))) { if (st.sub === t.getAttribute('data-sub')) return; st.sub = t.getAttribute('data-sub'); _occ = null; loadSub(); return; }
    if ((t = e.target.closest('[data-view]'))) { st.view = t.getAttribute('data-view'); render(); return; }
    if ((t = e.target.closest('[data-occ]'))) { var k = t.getAttribute('data-occ').split('|'), o = occs().filter(function (x) { return x.date === k[0] && String(x.period) === k[1]; })[0]; if (o) openOcc(o); }
  });
  if (st.page === 'leave') { tabsEl.innerHTML = pageTabs(); renderLeave(); } else if (st.page === 'interns') tabsEl.innerHTML = pageTabs(); else boot(); // 'week' วาดใน boot() · 'interns' รอผล internMine
})();
