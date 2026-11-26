/* จัดตารางเรียน (2.20.0) — หน้า timetable.html
 * ฉบับร่างหลายฉบับ (เก็บใน D1) · แท็บ: ห้องเรียน · โครงคาบ · ภาระงานสอน · เงื่อนไข / กันเวลา · จัดตาราง · ประกาศใช้
 * จัดอัตโนมัติบนเบราว์เซอร์ (วางทีละคาบตามความยาก + ซ่อมด้วยการย้ายคาบที่ชน) · ไม่ใช้ CPU ของ Worker
 * ปิดระบบอยู่ = ประกาศใช้ไม่ได้ (ฉบับร่างเท่านั้น) */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('timetable'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('ttBody'), tabsEl = document.getElementById('ttTabs'), draftEl = document.getElementById('ttDraft'), offEl = document.getElementById('ttOff');
  var B = null, D = null, META = null, dirty = false, st = { tab: 'grid', room: '', view: 'room', teacher: '', comp: '1', sel: null, loadRoom: '' };
  var DAYS = [1, 2, 3, 4, 5], DN = ['', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'], DS = ['', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.'], PER = [1, 2, 3, 4, 5, 6, 7, 8];
  var TIMES = { 1: '08.30', 2: '09.20', 3: '10.20', 4: '11.10', 5: '13.00', 6: '13.50', 7: '14.40', 8: '15.30' };
  var PAL = ['#bfdbfe', '#bbf7d0', '#fecdd3', '#ddd6fe', '#fed7aa', '#fef08a', '#fbcfe8', '#a5f3fc', '#e9d5ff', '#c7d2fe', '#d9f99d', '#fde68a'];
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function ic(n) { return '<i class="fa-solid ' + n + '" aria-hidden="true"></i>'; }
  function err(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function roomName(r) { var m = /m(\d)_(\d+)/.exec(r || ''); return m ? 'ม.' + m[1] + '/' + m[2] : r; }
  function rooms() { var o = []; for (var g = 1; g <= 6; g++) for (var i = 1; i <= (+D.grades['m' + g] || 0); i++) o.push('m' + g + '_' + i); return o; }
  function setDirty(v) { dirty = v; paintDraftBar(); }
  if (window.BackNav) BackNav.dirty(function () { return dirty; }, 'ฉบับร่างยังไม่ได้บันทึก ออกจากหน้านี้เลยไหม?');
  window.addEventListener('beforeunload', function (e) { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

  // ---------- ข้อมูลตั้งต้น ----------
  function defaults(t) {
    return { v: 2, term: t ? t.term : '1', year: t ? t.year : '', grades: { m1: 4, m2: 4, m3: 4, m4: 3, m5: 3, m6: 3 },
      fixed: [{ k: 'club', n: 'ชุมนุม', d: 2, p: 7, hard: true }, { k: 'dev', n: 'กิจกรรมพัฒนาผู้เรียน', d: 3, p: 7, hard: true }, { k: 'moral', n: 'กิจกรรมคุณธรรมจริยธรรม', d: 4, p: 7, hard: false }, { k: 'social', n: 'กิจกรรมเพื่อสังคม', d: 5, p: 7, hard: false }],
      hr: { p: 8, allow: [1, 4] }, light: [], courses: [], extra: [], dummy: [], bnames: {}, blocks: [], pmDay: {},
      comp: { n: 2, home: {} }, rules: { noSameDay: true, maxDay: 5, maxRun: 3, noLunch: true, calcAm: true, amCap: 65, amMin: 35, coFree: false }, place: {}, lock: {} };
  }
  function nextTerm(t) { if (!t) return { term: '1', year: '' }; return t.term === '1' ? { term: '2', year: t.year } : { term: '1', year: String(+t.year + 1) }; }
  // ---------- ครู ----------
  var PMAP = {};
  function tName(k) { if (!k) return ''; if (k.indexOf('x:') === 0) return k.slice(2); var p = PMAP[k]; return p ? p.name : '(ไม่พบบัญชี)'; }
  function tGroup(k) { var p = PMAP[k]; return p ? p.group || '' : ''; }
  function teachersAll() { var o = B.people.filter(function (p) { return !p.exec; }).map(function (p) { return { k: p.id, n: p.name, g: p.group }; }); D.extra.forEach(function (n) { o.push({ k: 'x:' + n, n: n + ' (ไม่มีบัญชี)', g: '' }); }); return o; }
  function cGroup(c) { return c.group || tGroup(rt(c)[0]) || 'ไม่ระบุ'; }
  function lightKey(c) { return (c.code || '') + '|' + c.name; }
  function isLight(c) { return D.light.indexOf(lightKey(c)) !== -1; }
  // 2.22.0: วิชากิจกรรม (ชุมนุม / พัฒนาผู้เรียน / คุณธรรม / เพื่อสังคม / โฮมรูม) = ตัวคาบพิเศษเอง
  //   c.fx = 'club'|'dev'|'moral'|'social'|'hr' → ไม่เข้าตัวจัด · ไม่นับชน · ไม่ใช้ครูของวิชานี้ตรวจชน · ตามคาบพิเศษเมื่อย้ายที่โครงคาบ · ยังส่งไปเว็บเช็คชื่อ
  var FXK = [['club', /ชุมนุม/], ['moral', /คุณธรรม|จริยธรรม/], ['social', /เพื่อสังคม|สาธารณประโยชน์|จิตอาสา/], ['hr', /โฮมรูม|homeroom/i], ['dev', /พัฒนาผู้เรียน|ลูกเสือ|เนตรนารี|ยุวกาชาด|ผู้บำเพ็ญประโยชน์|นักศึกษาวิชาทหาร/]];
  var FXN = { club: 'ชุมนุม', dev: 'กิจกรรมพัฒนาผู้เรียน', moral: 'กิจกรรมคุณธรรม', social: 'กิจกรรมเพื่อสังคม', hr: 'โฮมรูม (คาบ 8)' };
  function fxGuess(name) { for (var i = 0; i < FXK.length; i++) if (FXK[i][1].test(name || '')) return FXK[i][0]; return ''; }
  function lightGuess(name) { return /แนะแนว|ทุจริต/.test(name || ''); }
  function regular() { return D.courses.filter(function (c) { return !c.fx; }); }
  // 2.22.2: ครูสมมติ (กลุ่ม "ระบบ/อื่นๆ" ในเว็บเช็คชื่อ เช่น ซ่อมเสริมครูที่ปรึกษา) — ไม่ตรวจชนฝั่งครู · ห้องยังตรวจชน · วิชาที่มีแต่ครูสมมติ = วิชาเติมตาราง (จัดหลังสุด)
  function isDummy(k) { return (D.dummy || []).indexOf(k) !== -1; }
  function rt(c) { return c.t.filter(function (k) { return !isDummy(k); }); }
  function isFiller(c) { return c.t.length > 0 && !rt(c).length; }
  // ฉบับร่างเดิม (v1): เชื่อมวิชากิจกรรม · ติ๊กวิชาเบา · คาบ 8 เปลี่ยนความหมายจาก "วันที่ล็อก" เป็น "วันที่ให้ลงวิชาเบาได้"
  function migrate(d) {
    if (!d.hr) d.hr = { p: 8, allow: [1, 4] };
    if (!d.hr.allow) { d.hr.allow = (d.hr.lock || [1, 4]).slice(); delete d.hr.lock; }
    if ((d.v || 1) >= 2) return d;
    d.courses.forEach(function (c) {
      if (c.fx === undefined) c.fx = fxGuess(c.name);
      if (c.fx && c.fx !== 'hr') { delete d.place[c.id]; c.split.forEach(function (x, i) { delete d.lock[c.id + '#' + i]; }); }
      if (!c.fx && lightGuess(c.name) && d.light.indexOf(lightKey(c)) === -1) d.light.push(lightKey(c));
    });
    d.v = 2; return d;
  }

  // ---------- เริ่ม ----------
  async function boot() {
    try { B = await apiCall('ttBoot', {}); } catch (e) { tabsEl.innerHTML = ''; draftEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    B.people.forEach(function (p) { PMAP[p.id] = p; });
    offEl.innerHTML = B.enabled ? '' : '<div class="sb-off">' + ic('fa-eye-slash') + ' ระบบจัดตารางเรียนปิดอยู่ — เห็นเฉพาะผู้ดูแลระบบ · ทำฉบับร่างได้ทุกอย่าง · ยังประกาศใช้ (ส่งไปเว็บเช็คชื่อ) ไม่ได้</div>';
    if (B.drafts.length) await openDraft(B.drafts[0].id); else { paintDraftBar(); renderEmpty(); }
  }
  async function openDraft(id) {
    body.innerHTML = '<div class="loading">กำลังโหลดฉบับร่าง...</div>';
    try { var r = await apiCall('ttGet', { id: id }); META = { id: r.id, name: r.name, base: r.updatedAt, publishedAt: r.publishedAt }; D = Object.assign(defaults(), { v: 1 }, r.data || {}); D.hr = r.data && r.data.hr ? r.data.hr : defaults().hr; migrate(D); D.rules = Object.assign(defaults().rules, D.rules || {}); }
    catch (e) { body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    if (!rooms().length) D.grades = defaults().grades;
    st.room = st.room && rooms().indexOf(st.room) !== -1 ? st.room : rooms()[0]; st.loadRoom = st.room; st.sel = null;
    setDirty(false); show();
  }
  function renderEmpty() {
    tabsEl.innerHTML = '';
    body.innerHTML = '<div class="card sb-empty" style="padding:30px">' + ic('fa-table-cells-large') + '<p style="margin-bottom:14px">ยังไม่มีฉบับร่าง</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button type="button" class="btn btn-primary" data-tt-new="import">' + ic('fa-file-import') + ' สร้างจากตารางปัจจุบัน (เว็บเช็คชื่อ)</button><button type="button" class="btn btn-secondary" data-tt-new="blank">' + ic('fa-plus') + ' สร้างฉบับร่างว่าง</button></div></div>';
  }
  function paintDraftBar() {
    if (!B) return;
    var opts = B.drafts.map(function (d) { return '<option value="' + esc(d.id) + '"' + (META && d.id === META.id ? ' selected' : '') + '>' + esc(d.name) + (d.term ? ' · ' + esc(d.term + '/' + d.year) : '') + (d.publishedAt ? ' (ประกาศแล้ว)' : '') + '</option>'; }).join('');
    draftEl.innerHTML = '<div class="card tt-dbar">' + ic('fa-file-pen tt-dic') + (META ? '<select id="ttPick" class="sb-in" aria-label="ฉบับร่าง">' + opts + '</select>' + (D ? '<span class="sb-chip gr">ภาคเรียนที่ ' + esc(D.term + '/' + (D.year || '-')) + '</span>' : '') + (dirty ? '<span class="sb-chip wt">' + ic('fa-pen') + ' ยังไม่บันทึก</span>' : '<span class="sb-chip ok">' + ic('fa-check') + ' บันทึกแล้ว</span>') : '<b>ฉบับร่างตารางเรียน</b>') +
      '<span class="sb-sp"></span>' + (META ? '<button type="button" class="btn btn-ghost btn-sm" data-tt-ren>' + ic('fa-i-cursor') + ' เปลี่ยนชื่อ</button><button type="button" class="btn btn-ghost btn-sm" data-tt-dup>' + ic('fa-copy') + ' บันทึกเป็นฉบับใหม่</button><button type="button" class="btn btn-ghost btn-sm" data-tt-del>' + ic('fa-trash') + ' ลบ</button>' : '') +
      '<button type="button" class="btn btn-secondary btn-sm" data-tt-newmenu>' + ic('fa-plus') + ' ฉบับใหม่</button>' + (META ? '<button type="button" class="btn btn-success btn-sm" data-tt-save' + (dirty ? '' : ' disabled') + '>' + ic('fa-floppy-disk') + ' บันทึก</button>' : '') + '</div>';
  }
  function tabList() { return [['rooms', 'fa-door-open', 'ห้องเรียน (' + rooms().length + ')'], ['frame', 'fa-clock', 'โครงคาบ'], ['load', 'fa-list-check', 'ภาระงานสอน'], ['rule', 'fa-ban', 'เงื่อนไข / กันเวลา'], ['grid', 'fa-table-cells', 'จัดตาราง'], ['pub', 'fa-paper-plane', 'ประกาศใช้']]; }
  function show() {
    paintDraftBar();
    tabsEl.innerHTML = tabList().map(function (x) { return '<button type="button" class="tab-btn' + (x[0] === st.tab ? ' active' : '') + '" data-tt-tab="' + x[0] + '" role="tab">' + ic(x[1] + ' ui-icon') + ' ' + x[2] + '</button>'; }).join('');
    ({ rooms: showRooms, frame: showFrame, load: showLoad, rule: showRule, grid: showGrid, pub: showPub })[st.tab]();
  }

  // ---------- นำเข้าจากเว็บเช็คชื่อ ----------
  function splitFromSched(list) {
    var byDay = {}; list.forEach(function (x) { if (x.period >= 1 && x.period <= 8) (byDay[x.day] = byDay[x.day] || []).push(x.period); });
    var segs = [];
    Object.keys(byDay).forEach(function (d) { var ps = byDay[d].sort(function (a, b) { return a - b; }); for (var i = 0; i < ps.length; i++) { if (i + 1 < ps.length && ps[i + 1] === ps[i] + 1) { segs.push({ d: +d, p: ps[i], len: 2 }); i++; } else segs.push({ d: +d, p: ps[i], len: 1 }); } });
    segs.sort(function (a, b) { return b.len - a.len || a.d - b.d; });
    return segs;
  }
  function fromImport(j, t) {
    var d = defaults(t), byName = {};
    (j.teachers || []).forEach(function (x) { if (x.hubId && PMAP[x.hubId]) { byName[x.name] = x.hubId; d.bnames[x.hubId] = x.name; } });
    var sysN = {}; (j.teachers || []).forEach(function (x) { if (x.sys) sysN[x.name] = 1; }); // 2.22.2: เว็บเช็คชื่อบอกกลุ่ม "ระบบ/อื่นๆ" มาให้
    function key(n) { n = String(n || '').trim(); if (!n) return ''; if (byName[n]) return byName[n]; if (d.extra.indexOf(n) === -1) d.extra.push(n); return 'x:' + n; }
    var rc = j.roomCounts || {}; if (Object.keys(rc).length) ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'].forEach(function (g) { d.grades[g] = +rc[g] || 0; });
    (j.subjects || []).forEach(function (s) {
      var segs = splitFromSched(s.schedules || []), n = segs.reduce(function (a, x) { return a + x.len; }, 0);
      var c = { id: uid(), src: s.id, room: s.roomId, code: s.code, name: s.name, n: n || 1, split: segs.length ? segs.map(function (x) { return x.len; }) : [1], t: [key(s.teacher), key(s.teacher2)].filter(Boolean), comp: '', calc: false, group: '', cr: s.credits };
      c.fx = fxGuess(s.name);
      c.calc = !c.fx && cGroup(c) === 'คณิตศาสตร์';
      if (!c.fx && /คอมพิวเตอร์|วิทยาการคำนวณ|computer/i.test(s.name)) c.comp = 'any';
      if (!c.fx && lightGuess(s.name) && d.light.indexOf(lightKey(c)) === -1) d.light.push(lightKey(c));
      d.courses.push(c);
      if (segs.length && (!c.fx || c.fx === 'hr')) d.place[c.id] = segs.map(function (x) { return { d: x.d, p: x.p, len: x.len }; });
    });
    Object.keys(sysN).forEach(function (n) { var k = byName[n] || 'x:' + n; if (d.courses.some(function (c) { return c.t.indexOf(k) !== -1; }) && d.dummy.indexOf(k) === -1) d.dummy.push(k); });
    return d;
  }
  async function newDraft(kind) {
    if (dirty && !(await askConfirm('ฉบับร่างนี้ยังไม่ได้บันทึก — สร้างฉบับใหม่เลยไหม?', 'สร้างฉบับใหม่'))) return;
    var nt = nextTerm(B.term), d;
    if (kind === 'import') {
      var r = await withProgress('กำลังดึงตารางปัจจุบันจากเว็บเช็คชื่อ', function () { return apiCall('ttImport', {}); }, { successLabel: 'ดึงข้อมูลแล้ว' });
      if (!r.ok) return;
      d = fromImport(r.data, nt);
    } else d = defaults(nt);
    var name = 'ตารางเรียน ' + nt.term + '/' + (nt.year || '') + (kind === 'import' ? ' (ตั้งต้นจากตารางเดิม)' : '');
    D = d; META = null; dirty = true;
    await saveDraft(false, name);
    st.room = rooms()[0]; st.loadRoom = st.room; st.tab = kind === 'import' ? 'grid' : 'load'; show();
  }
  async function saveDraft(asNew, name) {
    var ev = evaluate();
    var p = { id: asNew || !META ? '' : META.id, base: asNew || !META ? '' : META.base, name: name || (META ? META.name : 'ฉบับร่าง'), term: D.term, year: D.year, data: D, score: ev.score, stat: { courses: D.courses.length, unplaced: ev.unplaced, conflicts: ev.conflicts } };
    var r = await withProgress('กำลังบันทึกฉบับร่าง', function () { return apiCall('ttSave', p); }, { successLabel: 'บันทึกแล้ว' });
    if (!r.ok) return false;
    META = { id: r.data.id, name: p.name, base: r.data.updatedAt, publishedAt: asNew || !META ? '' : META.publishedAt }; B.drafts = r.data.drafts; setDirty(false); return true;
  }

  // ---------- แท็บ ห้องเรียน ----------
  function showRooms() {
    var h = '<div class="card"><h3 style="margin-top:0">' + ic('fa-door-open ui-icon') + ' จำนวนห้องเรียน</h3><p class="cb-mut" style="margin-top:-4px">ตั้งที่นี่แทนเว็บเช็คชื่อ — มีผลกับเว็บเช็คชื่อเมื่อประกาศใช้ตาราง · โรงเรียนเรียนประจำห้อง (ไม่เดินเรียน)</p><div class="tt-grades">';
    for (var g = 1; g <= 6; g++) h += '<label><span>ม.' + g + '</span><input type="number" class="sb-num" min="0" max="20" data-grade="m' + g + '" value="' + (+D.grades['m' + g] || 0) + '" /> ห้อง</label>';
    h += '</div><p style="margin:12px 0 0"><b>รวม ' + rooms().length + ' ห้อง</b> · ' + rooms().map(roomName).join(' · ') + '</p></div>';
    body.innerHTML = h;
  }
  // ---------- แท็บ โครงคาบ ----------
  function dSel(attr, v) { return '<select class="sb-in" ' + attr + '>' + DAYS.map(function (d) { return '<option value="' + d + '"' + (d === v ? ' selected' : '') + '>' + DN[d] + '</option>'; }).join('') + '</select>'; }
  function pSel(attr, v) { return '<select class="sb-in" ' + attr + '>' + PER.map(function (p) { return '<option value="' + p + '"' + (p === v ? ' selected' : '') + '>คาบ ' + p + '</option>'; }).join('') + '</select>'; }
  function showFrame() {
    var uniq = {}, list = [], fxn = {}; D.courses.forEach(function (c) { if (c.fx) { fxn[c.fx] = (fxn[c.fx] || 0) + 1; return; } var k = lightKey(c); if (!uniq[k]) { uniq[k] = 1; list.push(c); } }); list.sort(function (a, b) { return (a.code || '').localeCompare(b.code || ''); });
    var h = '<div class="sb-2col"><div class="card"><h3 style="margin-top:0">' + ic('fa-clock ui-icon') + ' คาบเรียน</h3><p class="cb-mut" style="margin-top:-4px">จันทร์–ศุกร์ · คาบ 1–8 · พักกลางวันหลังคาบ 4 · คาบเช้า = 1–4 · คาบ A / B (เข้าแถว / โฮมรูมเช้า) เป็นคาบระบบ ไม่อยู่ในการจัด</p>' +
      '<table class="sb-tb tt-ptimes"><tbody>' + PER.map(function (p) { return '<tr><td>คาบ ' + p + '</td><td>' + TIMES[p] + ' น.</td><td class="cb-mut">' + (p <= 4 ? 'เช้า' : 'บ่าย') + '</td></tr>'; }).join('') + '</tbody></table>' +
      '<h3>' + ic('fa-thumbtack ui-icon') + ' คาบพิเศษ (ทุกห้องพร้อมกัน)</h3>' + D.fixed.map(function (f, i) { return '<div class="tt-fx"><b>' + esc(f.n) + '</b>' + dSel('data-fx-d="' + i + '"', f.d) + pSel('data-fx-p="' + i + '"', f.p) + '<label class="tt-ck"><input type="checkbox" data-fx-h="' + i + '"' + (f.hard ? ' checked' : '') + ' /> ห้ามวิชาอื่นลงชน</label>' + (fxn[f.k] ? '<span class="sb-chip gr" title="วิชากิจกรรมที่เชื่อมกับคาบนี้ — ย้ายคาบแล้ววิชาย้ายตาม">' + ic('fa-link') + ' ' + fxn[f.k] + ' ห้อง</span>' : '') + '</div>'; }).join('') +
      '<p class="cb-mut" style="font-size:.84rem">ไม่ติ๊ก "ห้ามชน" = ระบบลงวิชาอื่นได้เมื่อจัดไม่ลงจริง ๆ (แสดงสีเทา · หักคะแนนเล็กน้อย) · วิชากิจกรรมในแท็บภาระงานสอน (คอลัมน์ "คาบพิเศษ") คือตัวคาบนี้เอง ไม่นับว่าชน</p></div>' +
      '<div class="card"><h3 style="margin-top:0">' + ic('fa-house-user ui-icon') + ' คาบ 8 โฮมรูม</h3><p class="cb-mut" style="margin-top:-4px">คาบ 8 ทุกวันเป็นโฮมรูม · วิชาปกติไม่ลงคาบ 8 · วันที่ติ๊ก = ลงวิชาเบาได้ (ระบบลงวิชาเบาในช่องนี้ก่อน) · วันที่ไม่ติ๊ก = โฮมรูมอย่างเดียว</p><b style="display:block;margin-bottom:6px;color:var(--text)">วันที่ให้ลงวิชาเบาในคาบ 8 ได้</b><div class="tt-days">' + DAYS.map(function (d) { return '<label class="tt-ck"><input type="checkbox" data-hr-allow="' + d + '"' + (D.hr.allow.indexOf(d) !== -1 ? ' checked' : '') + ' /> ' + DN[d] + '</label>'; }).join('') + '</div>' +
      '<h3>' + ic('fa-feather ui-icon') + ' วิชาเบา (ลงคาบ 8 ได้)</h3><p class="cb-mut" style="margin-top:-4px">เช่น แนะแนว ต้านทุจริต (ติ๊กให้อัตโนมัติตอนนำเข้า)</p><div class="tt-light">' + (list.length ? list.map(function (c) { var k = lightKey(c); return '<label class="tt-ck"><input type="checkbox" data-light="' + esc(k) + '"' + (D.light.indexOf(k) !== -1 ? ' checked' : '') + ' /> ' + esc((c.code ? c.code + ' ' : '') + c.name) + '</label>'; }).join('') : '<span class="cb-mut">ยังไม่มีวิชา (เพิ่มที่แท็บภาระงานสอน)</span>') + '</div></div></div>';
    body.innerHTML = h;
  }
  // ---------- แท็บ ภาระงานสอน ----------
  function tSel(attr, v, allowEmpty) { return '<select class="sb-in tt-tsel" ' + attr + '>' + (allowEmpty ? '<option value="">—</option>' : '<option value="">— เลือกครู —</option>') + teachersAll().map(function (t) { return '<option value="' + esc(t.k) + '"' + (t.k === v ? ' selected' : '') + '>' + esc(t.n) + '</option>'; }).join('') + '</select>'; }
  function splitTxt(a) { return a.join('+'); }
  function defSplit(n) { n = +n || 1; if (n === 3) return [2, 1]; var o = []; for (var i = 0; i < n; i++) o.push(1); return o; }
  function showLoad() {
    var R = rooms(); if (R.indexOf(st.loadRoom) === -1) st.loadRoom = R[0];
    var cs = D.courses.filter(function (c) { return c.room === st.loadRoom; });
    var h = '<div class="card"><div class="sb-bar"><h3 style="margin:0">' + ic('fa-list-check ui-icon') + ' ภาระงานสอน</h3><select id="ttLoadRoom" class="sb-in">' + R.map(function (r) { var n = D.courses.filter(function (c) { return c.room === r; }).reduce(function (a, c) { return a + (+c.n || 0); }, 0); return '<option value="' + r + '"' + (r === st.loadRoom ? ' selected' : '') + '>' + roomName(r) + ' (' + n + ' คาบ)</option>'; }).join('') + '</select><span class="sb-sp"></span>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-tt-copyroom>' + ic('fa-copy') + ' คัดลอกไปห้องอื่นในระดับเดียวกัน</button><button type="button" class="btn btn-secondary btn-sm" data-tt-addc>' + ic('fa-plus') + ' เพิ่มวิชา</button></div>' +
      '<div class="sb-tw"><table class="sb-tb tt-load"><thead><tr><th>รหัส</th><th>ชื่อวิชา</th><th class="c">คาบ/สัปดาห์</th><th>แบ่งคาบ</th><th>ครูผู้สอน</th><th>ครูร่วม</th><th>ห้องคอม</th><th class="c">คำนวณ</th><th>คาบพิเศษ</th><th></th></tr></thead><tbody>' +
      cs.map(function (c) {
        var bad = c.split.reduce(function (a, x) { return a + x; }, 0) !== +c.n;
        return '<tr data-c="' + c.id + '"' + (c.fx ? ' class="tt-fxrow"' : '') + '><td><input class="sb-in tt-code" data-f="code" value="' + esc(c.code) + '" maxlength="20" /></td><td><input class="sb-in tt-nm" data-f="name" value="' + esc(c.name) + '" maxlength="80" /></td><td class="c"><input type="number" class="sb-num" data-f="n" min="1" max="10" value="' + c.n + '" /></td>' +
          '<td><input class="sb-in tt-sp' + (bad ? ' bad' : '') + '" data-f="split" value="' + splitTxt(c.split) + '" title="เช่น 2+1 = คาบคู่ 1 + คาบเดี่ยว 1" /></td><td>' + tSel('data-f="t0"', c.t[0] || '') + '</td><td>' + tSel('data-f="t1"', c.t[1] || '', true) + '</td>' +
          '<td><select class="sb-in" data-f="comp"><option value="">ไม่ใช้</option><option value="any"' + (c.comp === 'any' ? ' selected' : '') + '>ห้องคอม (ห้องหลักของครู)</option>' + [1, 2, 3].slice(0, D.comp.n).map(function (i) { return '<option value="' + i + '"' + (c.comp === String(i) ? ' selected' : '') + '>ห้องคอม ' + i + '</option>'; }).join('') + '</select></td>' +
          '<td class="c"><input type="checkbox" data-f="calc"' + (c.calc ? ' checked' : '') + ' title="วิชาคำนวณ (ควรอยู่ช่วงเช้า)" /></td><td><select class="sb-in" data-f="fx" title="วิชากิจกรรม = ตัวคาบพิเศษเอง (ไม่จัด · ไม่นับชน)"><option value="">ไม่ใช่</option>' + Object.keys(FXN).map(function (k) { return '<option value="' + k + '"' + (c.fx === k ? ' selected' : '') + '>' + FXN[k] + '</option>'; }).join('') + '</select></td><td><button type="button" class="sb-x" data-tt-rmc="' + c.id + '" aria-label="ลบวิชา">' + ic('fa-trash') + '</button></td></tr>';
      }).join('') + (cs.length ? '' : '<tr><td colspan="10" class="cb-mut">ยังไม่มีวิชาในห้องนี้</td></tr>') + '</tbody></table></div>' +
      '<p class="cb-mut sb-leg">คาบพิเศษ = วิชากิจกรรม (ชุมนุม / พัฒนาผู้เรียน / คุณธรรม / เพื่อสังคม / โฮมรูม) ลงที่คาบพิเศษให้เอง ไม่นับว่าชน · แบ่งคาบ: 2+1 = คาบคู่ 1 ครั้ง + คาบเดี่ยว 1 ครั้ง (ไม่อยู่วันเดียวกัน) · สอนร่วมกับครูต่างชาติแบบแยกคาบ = สร้างวิชาเดิม 2 แถว ครูคนละคน · ครูร่วม = สอนพร้อมกันในคาบเดียวกัน</p></div>' +
      '<div class="sb-2col" style="margin-top:16px"><div class="card"><h3 style="margin-top:0">' + ic('fa-user-plus ui-icon') + ' ผู้สอนที่ไม่มีบัญชี</h3><p class="cb-mut" style="margin-top:-4px">เช่น ครูต่างชาติ — ใช้ในตารางได้โดยไม่ต้องสร้างบัญชี (สร้างบัญชีแล้วค่อยเปลี่ยนเป็นชื่อบัญชีในแถววิชา) · ติ๊ก "ครูสมมติ" = ครูกลุ่มระบบ/อื่นๆ ไม่ตรวจชน ใส่หลายห้องพร้อมกันได้ (นำเข้าจากเว็บเช็คชื่อติ๊กให้เอง)</p><div class="sb-chips">' + (D.extra.map(function (n) { var dm = isDummy('x:' + n); return '<span class="sb-chip ' + (dm ? 'wt' : 'gr') + '">' + esc(n) + ' <label class="tt-dm" title="ครูสมมติ = ไม่ตรวจชนฝั่งครู ใส่หลายห้องพร้อมกันได้ (เช่น ซ่อมเสริมครูที่ปรึกษา)"><input type="checkbox" data-tt-dummy="' + esc(n) + '"' + (dm ? ' checked' : '') + ' /> ครูสมมติ</label> <button type="button" class="sb-x" data-tt-rmx="' + esc(n) + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button></span>'; }).join('') || '<span class="cb-mut">ยังไม่มี</span>') + '<input id="ttXn" class="sb-in" placeholder="ชื่อ เช่น Mr. John Smith" maxlength="80" /><button type="button" class="btn btn-secondary btn-sm" data-tt-addx>' + ic('fa-plus') + ' เพิ่ม</button></div></div>' +
      '<div class="card"><h3 style="margin-top:0">' + ic('fa-chart-simple ui-icon') + ' คาบสอนต่อสัปดาห์ (ทุกห้อง)</h3>' + loadSummary() + '</div></div>';
    body.innerHTML = h;
  }
  function loadSummary() {
    var m = {}; regular().forEach(function (c) { rt(c).forEach(function (k) { if (k) m[k] = (m[k] || 0) + (+c.n || 0); }); });
    var L = Object.keys(m).map(function (k) { return { k: k, n: m[k] }; }).sort(function (a, b) { return b.n - a.n; });
    if (!L.length) return '<p class="cb-mut">ยังไม่มีข้อมูล</p>';
    var mx = L[0].n;
    return '<div class="tt-ls">' + L.map(function (x) { return '<div><span>' + esc(tName(x.k)) + '</span><div class="sb-barc"><i style="width:' + (x.n / mx * 100) + '%"></i></div><b>' + x.n + '</b></div>'; }).join('') + '</div>';
  }
  function courseOf(id) { return D.courses.filter(function (c) { return c.id === id; })[0] || null; }
  function onLoadInput(t) {
    var tr = t.closest('tr[data-c]'); if (!tr) return; var c = courseOf(tr.getAttribute('data-c')); if (!c) return; var f = t.getAttribute('data-f'), v = t.type === 'checkbox' ? t.checked : t.value;
    if (f === 'code' || f === 'name') c[f] = String(v).trim();
    else if (f === 'n') { c.n = Math.max(1, Math.min(10, +v || 1)); c.split = defSplit(c.n); delete D.place[c.id]; tr.querySelector('[data-f="split"]').value = splitTxt(c.split); }
    else if (f === 'split') { var a = String(v).split(/[+,\s]+/).map(Number).filter(function (x) { return x === 1 || x === 2; }); if (a.length) { c.split = a.sort(function (x, y) { return y - x; }); delete D.place[c.id]; } t.classList.toggle('bad', c.split.reduce(function (s, x) { return s + x; }, 0) !== +c.n); }
    else if (f === 't0') { c.t[0] = v; c.t = c.t.filter(Boolean); }
    else if (f === 't1') { c.t = [c.t[0] || '', v].filter(Boolean); }
    else if (f === 'comp') c.comp = v;
    else if (f === 'calc') c.calc = !!v;
    else if (f === 'fx') { c.fx = v; if (v && v !== 'hr') delete D.place[c.id]; c.split.forEach(function (x, i) { delete D.lock[c.id + '#' + i]; }); tr.classList.toggle('tt-fxrow', !!v); }
    setDirty(true);
  }
  // ---------- แท็บ เงื่อนไข ----------
  function showRule() {
    var R = D.rules;
    function sw(k, on) { return '<label class="switch"><input type="checkbox" data-rule="' + k + '"' + (on ? ' checked' : '') + ' /><span class="slider"></span></label>'; }
    function row(t, s, r) { return '<div class="sb-row"><div><b>' + t + '</b><small>' + s + '</small></div><div class="r">' + r + '</div></div>'; }
    var compTeachers = {}; D.courses.forEach(function (c) { if (c.comp) c.t.forEach(function (k) { if (k) compTeachers[k] = 1; }); });
    var h = '<div class="sb-2col"><div class="card"><h3 style="margin-top:0">' + ic('fa-sliders ui-icon') + ' กฎทั่วไป</h3>' +
      row('วิชาเดียวกันไม่ลงวันเดียวกันซ้ำ', 'เช่น 2+1 = คาบคู่กับคาบเดี่ยวคนละวัน', sw('noSameDay', R.noSameDay)) +
      row('ครูสอนไม่เกิน', 'ต่อวัน (ข้อบังคับ)', '<input type="number" class="sb-num" min="1" max="8" data-rule="maxDay" value="' + R.maxDay + '" /> คาบ/วัน') +
      row('สอนติดกันไม่เกิน', 'ต่อเนื่อง (ควร)', '<input type="number" class="sb-num" min="1" max="8" data-rule="maxRun" value="' + R.maxRun + '" /> คาบ') +
      row('คาบคู่ห้ามคร่อมพักกลางวัน', 'คาบ 4 ต่อคาบ 5', sw('noLunch', R.noLunch)) +
      row('วิชาคำนวณควรอยู่ช่วงเช้า', 'ติ๊ก "คำนวณ" ที่แถววิชา (ค่าเริ่มต้น = กลุ่มสาระคณิตศาสตร์)', sw('calcAm', R.calcAm)) +
      row('คาบเช้าของแต่ละกลุ่มสาระไม่เกิน', 'กันกลุ่มสาระใดได้แต่คาบเช้า (ควร)', '<input type="number" class="sb-num" min="30" max="100" data-rule="amCap" value="' + R.amCap + '" /> %') +
      row('ครูทุกคนมีคาบเช้าอย่างน้อย', 'ใช้ในคะแนนความเท่าเทียม', '<input type="number" class="sb-num" min="0" max="80" data-rule="amMin" value="' + R.amMin + '" /> %') +
      row('ครูไทยว่างคาบที่ครูต่างชาติสอนคนเดียว', 'วิชาเดียวกันห้องเดียวกัน — ครูไทยดูแลแทนได้ถ้าครูต่างชาติลา (ควร)', sw('coFree', R.coFree)) +
      '<h3>' + ic('fa-computer ui-icon') + ' ห้องคอมพิวเตอร์</h3>' + row('จำนวนห้องคอม', 'ใช้ได้ทีละห้องเรียนต่อคาบ', '<input type="number" class="sb-num" min="1" max="3" id="ttCompN" value="' + D.comp.n + '" /> ห้อง') +
      (Object.keys(compTeachers).length ? Object.keys(compTeachers).map(function (k) { return row(esc(tName(k)), 'ห้องหลัก (วิชาที่ตั้ง "ห้องคอม (ห้องหลักของครู)")', '<select class="sb-in" data-comp-home="' + esc(k) + '">' + [1, 2, 3].slice(0, D.comp.n).map(function (i) { return '<option value="' + i + '"' + (String(D.comp.home[k] || 1) === String(i) ? ' selected' : '') + '>ห้องคอม ' + i + '</option>'; }).join('') + '</select>'); }).join('') : '<p class="cb-mut">ยังไม่มีวิชาที่ใช้ห้องคอม (ตั้งที่แท็บภาระงานสอน)</p>') +
      '</div><div class="card"><h3 style="margin-top:0">' + ic('fa-user-clock ui-icon') + ' กันเวลารายคน / กลุ่มสาระ</h3><p class="cb-mut" style="margin-top:-4px">ช่วงที่ห้ามลงคาบสอน เช่น ประชุมคณะผู้บริหารทุกบ่ายวันจันทร์ · ไปธนาคารบ่าย 1 วัน (ระบบเลือกวันให้) · PLC ของกลุ่มสาระ</p>' +
      (D.blocks.length ? D.blocks.map(function (b, i) { return '<div class="tt-blk"><div><b>' + esc(b.who.indexOf('g:') === 0 ? 'กลุ่มสาระ' + b.who.slice(2) : tName(b.who)) + '</b><small>' + (b.pm ? 'บ่าย 1 วัน/สัปดาห์ · ระบบเลือก: ' + (D.pmDay[b.who] ? 'บ่าย' + DN[D.pmDay[b.who]] : 'ยังไม่จัด') : DN[b.d] + ' ' + (b.ps.length === 4 && b.ps[0] === 5 ? 'บ่าย' : b.ps.length === 4 && b.ps[0] === 1 ? 'เช้า' : 'คาบ ' + b.ps.join(', '))) + (b.note ? ' · ' + esc(b.note) : '') + '</small></div><button type="button" class="sb-x" data-tt-rmb="' + i + '" aria-label="ลบ">' + ic('fa-trash') + '</button></div>'; }).join('') : '<p class="cb-mut">ยังไม่มี</p>') +
      '<div class="tt-addb"><select id="bWho" class="sb-in"><option value="">— ครู / กลุ่มสาระ —</option>' + teachersAll().map(function (t) { return '<option value="' + esc(t.k) + '">' + esc(t.n) + '</option>'; }).join('') + groupsAll().map(function (g) { return '<option value="g:' + esc(g) + '">กลุ่มสาระ' + esc(g) + '</option>'; }).join('') + '</select>' +
      '<select id="bType" class="sb-in"><option value="pm">ทั้งบ่าย</option><option value="am">ทั้งเช้า</option><option value="day">ทั้งวัน</option><option value="p">ระบุคาบ</option><option value="pm1">บ่าย 1 วัน/สัปดาห์ (ระบบเลือกวัน)</option></select>' + dSel('id="bDay"', 1) + '<input id="bPs" class="sb-in" placeholder="คาบ เช่น 7,8" style="width:110px" hidden /><input id="bNote" class="sb-in" placeholder="เหตุผล (ไม่บังคับ)" maxlength="80" /><button type="button" class="btn btn-secondary btn-sm" data-tt-addb>' + ic('fa-plus') + ' เพิ่ม</button></div></div></div>';
    body.innerHTML = h;
  }
  function groupsAll() { var g = {}; B.people.forEach(function (p) { if (p.group) g[p.group] = 1; }); return Object.keys(g).sort(); }

  // ---------- ตัวจัดตาราง ----------
  function segsOf(c) { var o = []; c.split.forEach(function (len, i) { o.push({ c: c, i: i, len: len, key: c.id + '#' + i }); }); return o; }
  function compRooms() { var o = []; for (var i = 1; i <= D.comp.n; i++) o.push(String(i)); return o; }
  function compWant(c) { if (!c.comp) return null; if (c.comp === 'any') return String(D.comp.home[c.t[0]] || 1); return c.comp; }
  function blockedFor(tk, d, p) {
    var g = tGroup(tk);
    return D.blocks.some(function (b) { if (b.who !== tk && !(g && b.who === 'g:' + g)) return false; if (b.pm) return D.pmDay[b.who] === d && p >= 5; return b.d === d && b.ps.indexOf(p) !== -1; });
  }
  function fixedAt(d, p) { return D.fixed.filter(function (f) { return f.d === d && f.p === p; })[0] || null; }
  function hrAt(d, p) { return p === D.hr.p; }
  function pickPmDays() {
    var used = {}; D.blocks.filter(function (b) { return b.pm; }).forEach(function (b, i) {
      if (D.pmDay[b.who]) return;
      var best = 0, bc = 1e9; DAYS.forEach(function (d) { var c = (used[d] || 0) * 10 + D.blocks.filter(function (x) { return !x.pm && x.who === b.who && x.d === d; }).length * 100 + ((i + d) % 5); if (c < bc) { bc = c; best = d; } });
      D.pmDay[b.who] = best; used[best] = (used[best] || 0) + 1;
    });
  }
  // สถานะตาราง (occupancy) จาก D.place
  function build() {
    var S = { R: {}, T: {}, C: {}, segAt: {} };
    regular().forEach(function (c) { var pl = D.place[c.id] || []; pl.forEach(function (x, i) { if (x && i < c.split.length) put(S, c, i, x.d, x.p); }); });
    return S;
  }
  function cells(c, i, d, p) { var len = c.split[i], o = []; for (var k = 0; k < len; k++) o.push(p + k); return o; }
  function put(S, c, i, d, p) {
    var cw = compWant(c);
    cells(c, i, d, p).forEach(function (q) {
      var rk = c.room + '|' + d + '|' + q; (S.R[rk] = S.R[rk] || []).push(c.id + '#' + i);
      rt(c).forEach(function (k) { var tk = k + '|' + d + '|' + q; (S.T[tk] = S.T[tk] || []).push(c.id + '#' + i); });
      if (cw) { var ck = cw + '|' + d + '|' + q; (S.C[ck] = S.C[ck] || []).push(c.id + '#' + i); }
    });
  }
  function take(S, c, i, d, p) {
    var key = c.id + '#' + i, cw = compWant(c), rm = function (m, k) { if (!m[k]) return; m[k] = m[k].filter(function (x) { return x !== key; }); if (!m[k].length) delete m[k]; };
    cells(c, i, d, p).forEach(function (q) { rm(S.R, c.room + '|' + d + '|' + q); rt(c).forEach(function (k) { rm(S.T, k + '|' + d + '|' + q); }); if (cw) rm(S.C, cw + '|' + d + '|' + q); });
  }
  // ตรวจช่อง: ข้อห้ามแข็ง (คืน null = วางไม่ได้) · ไม่สนใจคาบที่ชนกับวิชาอื่น (ส่ง blockers กลับ)
  function hardOk(c, i, d, p) {
    var len = c.split[i], R = D.rules;
    if (p + len - 1 > 8) return false;
    if (len === 2 && R.noLunch && p === 4) return false;
    for (var k = 0; k < len; k++) {
      var q = p + k, f = fixedAt(d, q);
      if (f && f.hard) return false;
      if (hrAt(d, q) && (D.hr.allow.indexOf(d) === -1 || !isLight(c))) return false; // คาบ 8 = เฉพาะวิชาเบา ในวันที่เปิดให้
      for (var j = 0; j < c.t.length; j++) if (blockedFor(c.t[j], d, q)) return false;
    }
    if (R.noSameDay) { var pl = D.place[c.id] || []; for (var m = 0; m < pl.length; m++) if (m !== i && pl[m] && pl[m].d === d) return false; }
    return true;
  }
  function blockersAt(S, c, i, d, p) {
    var out = {}, key = c.id + '#' + i, cw = compWant(c);
    cells(c, i, d, p).forEach(function (q) {
      (S.R[c.room + '|' + d + '|' + q] || []).forEach(function (x) { if (x !== key) out[x] = 1; });
      rt(c).forEach(function (k) { (S.T[k + '|' + d + '|' + q] || []).forEach(function (x) { if (x !== key) out[x] = 1; }); });
      if (cw) (S.C[cw + '|' + d + '|' + q] || []).forEach(function (x) { if (x !== key) out[x] = 1; });
    });
    return Object.keys(out);
  }
  function dayLoad(S, tk, d) { var n = 0; PER.forEach(function (q) { if (S.T[tk + '|' + d + '|' + q]) n++; }); return n; }
  function softCost(S, c, i, d, p, AM) {
    var len = c.split[i], cost = 0, R = D.rules, ga = AM ? AM[cGroup(c)] : null, full = !!(ga && ga.total && ga.am / ga.total * 100 >= R.amCap); // กลุ่มสาระได้คาบเช้าเต็มเพดานแล้ว = ไม่ดันวิชาคำนวณไปเช้าอีก
    for (var k = 0; k < len; k++) { var q = p + k, f = fixedAt(d, q); if (f) cost += 25; if (hrAt(d, q)) cost -= 3; /* วิชาเบาลงคาบ 8 ก่อน */ if (R.calcAm && c.calc && q >= 5 && !full) cost += 4; if (q === 5) cost += 0.5; }
    rt(c).forEach(function (tk) {
      var ld = dayLoad(S, tk, d); if (ld + len > R.maxDay) cost += 1000;
      // ติดกันเกิน
      var run = len, q = p - 1; while (q >= 1 && S.T[tk + '|' + d + '|' + q]) { run++; q--; } q = p + len; while (q <= 8 && S.T[tk + '|' + d + '|' + q]) { run++; q++; }
      if (run > R.maxRun) cost += 8;
      // ช่องว่าง (ห่างจากคาบอื่นของวันนั้น)
      if (ld) { var near = 9; PER.forEach(function (x) { if (S.T[tk + '|' + d + '|' + x]) near = Math.min(near, Math.abs(x - p), Math.abs(x - (p + len - 1))); }); if (near > 1) cost += (near - 1) * 0.6; }
    });
    if (AM && p <= 4) { var g = cGroup(c), a = AM[g]; if (a && a.total && (a.am + len) / a.total * 100 > R.amCap) cost += 7; }
    if (R.coFree && c.t.length === 1 && rt(c).length === 1 && c.t[0].indexOf('x:') === 0) { // ครูต่างชาติสอนคนเดียว → ครูไทยของวิชาเดียวกันห้องเดียวกันควรว่าง
      D.courses.forEach(function (o) { if (o.id !== c.id && o.room === c.room && o.code === c.code && o.name === c.name) rt(o).forEach(function (tk) { for (var k = 0; k < len; k++) if (S.T[tk + '|' + d + '|' + (p + k)]) cost += 5; }); });
    }
    var pl = D.place[c.id] || []; pl.forEach(function (x, m) { if (m !== i && x && Math.abs(x.d - d) === 1) cost += 0.8; }); // กระจายวัน
    return cost;
  }
  function onSoft(c, i, d, p) { for (var k = 0; k < c.split[i]; k++) { var f = fixedAt(d, p + k); if (f && !f.hard) return f; } return null; }
  function amInit() { var AM = {}; regular().forEach(function (c) { if (isFiller(c)) return; var g = cGroup(c), a = AM[g] || (AM[g] = { am: 0, total: 0 }); a.total += +c.n || 0; (D.place[c.id] || []).forEach(function (x, i) { if (x) for (var k = 0; k < c.split[i]; k++) if (x.p + k <= 4) a.am++; }); }); return AM; }
  function amAdd(AM, c, i, p, s) { var a = isFiller(c) ? null : AM[cGroup(c)]; if (a) for (var k = 0; k < c.split[i]; k++) if (p + k <= 4) a.am += s; }
  function solve(mode) {
    pickPmDays();
    var all = []; regular().forEach(function (c) { if (!(D.place[c.id] && D.place[c.id].length === c.split.length)) D.place[c.id] = (D.place[c.id] || []).slice(0, c.split.length); segsOf(c).forEach(function (s) { all.push(s); }); });
    if (mode === 'all') all.forEach(function (s) { if (!D.lock[s.key]) D.place[s.c.id][s.i] = null; });
    // ช่องเดิมที่ผิดข้อห้ามแข็ง = ถอดออก
    all.forEach(function (s) { var x = D.place[s.c.id][s.i]; if (x && !D.lock[s.key] && !hardOk(s.c, s.i, x.d, x.p)) D.place[s.c.id][s.i] = null; });
    var S = build(), AM = amInit();
    // ถอดตัวที่ชนกัน (ไม่ล็อก) ออกก่อน
    all.forEach(function (s) { var x = D.place[s.c.id][s.i]; if (x && !D.lock[s.key] && blockersAt(S, s.c, s.i, x.d, x.p).length) { take(S, s.c, s.i, x.d, x.p); amAdd(AM, s.c, s.i, x.p, -1); D.place[s.c.id][s.i] = null; } });
    var tLoad = {}; regular().forEach(function (c) { rt(c).forEach(function (k) { tLoad[k] = (tLoad[k] || 0) + (+c.n || 0); }); });
    var diff = function (s) { var c = s.c, b = isFiller(c) ? -300 : 0; rt(c).forEach(function (k) { b += tLoad[k] || 0; if (D.blocks.some(function (x) { return x.who === k; })) b += 10; }); return (s.len === 2 ? 100 : 0) + (c.comp ? 60 : 0) + (isLight(c) ? -20 : 0) + b + Math.random() * 3; };
    var queue = all.filter(function (s) { return !D.place[s.c.id][s.i]; }).sort(function (a, b) { return diff(b) - diff(a); });
    var slots = []; DAYS.forEach(function (d) { PER.forEach(function (p) { slots.push([d, p]); }); });
    function place(s, d, p) { D.place[s.c.id][s.i] = { d: d, p: p, len: s.len }; put(S, s.c, s.i, d, p); amAdd(AM, s.c, s.i, p, 1); }
    function unplace(key) { var a = key.split('#'), c = courseOf(a[0]), i = +a[1], x = D.place[c.id][i]; if (!x) return null; take(S, c, i, x.d, x.p); amAdd(AM, c, i, x.p, -1); D.place[c.id][i] = null; return { c: c, i: i, len: c.split[i], key: key }; }
    // รอบแรก: วางช่องที่ดีที่สุดที่ไม่ชน
    var left = [];
    queue.forEach(function (s) {
      var best = null, bc = 1e9;
      slots.forEach(function (sl) { if (!hardOk(s.c, s.i, sl[0], sl[1]) || blockersAt(S, s.c, s.i, sl[0], sl[1]).length) return; var cc = softCost(S, s.c, s.i, sl[0], sl[1], AM) + Math.random() * 0.5; if (cc < bc) { bc = cc; best = sl; } });
      if (best && bc < 1000) place(s, best[0], best[1]); else left.push(s);
    });
    // ซ่อม: ย้ายคาบที่ขวางออกแล้ววางใหม่ (จำกัดเวลา)
    var t0 = Date.now(), tabu = {}, it = 0, bestLeft = left.length, snap = left.length ? clone(D.place) : null;
    while (left.length && Date.now() - t0 < 4000 && it < 60000) {
      it++;
      var s = left.splice(Math.floor(Math.random() * left.length), 1)[0], cands = [];
      slots.forEach(function (sl) {
        if (!hardOk(s.c, s.i, sl[0], sl[1])) return;
        var bl = blockersAt(S, s.c, s.i, sl[0], sl[1]);
        if (bl.some(function (k) { return D.lock[k] || tabu[k + '@' + sl[0] + sl[1]] > it; })) return;
        cands.push({ sl: sl, bl: bl, cost: bl.length * 50 + softCost(S, s.c, s.i, sl[0], sl[1], AM) + Math.random() * 6 });
      });
      if (!cands.length) { left.push(s); continue; }
      cands.sort(function (a, b) { return a.cost - b.cost; });
      var ch = cands[Math.random() < 0.8 ? 0 : Math.floor(Math.random() * Math.min(4, cands.length))];
      ch.bl.forEach(function (k) { var u = unplace(k); if (u) { left.push(u); tabu[k + '@' + ch.sl[0] + ch.sl[1]] = it + 30; } });
      place(s, ch.sl[0], ch.sl[1]);
      if (left.length < bestLeft) { bestLeft = left.length; snap = left.length ? clone(D.place) : null; }
    }
    if (left.length && snap && bestLeft < left.length) D.place = snap;
    return { iterations: it, ms: Date.now() - t0 };
  }
  // ---------- ประเมิน ----------
  function evaluate() {
    var S = build(), out = { unplaced: 0, conflicts: 0, fixedUsed: 0, p8: 0, calcPm: 0, runs: 0, gaps: 0, sameDay: 0, dept: {}, tAm: {}, conflictList: [] };
    regular().forEach(function (c) {
      var pl = D.place[c.id] || [], g = cGroup(c), a = isFiller(c) ? { am: 0, total: 0 } : out.dept[g] || (out.dept[g] = { am: 0, total: 0 }); // วิชาเติมตาราง (ครูสมมติ) ไม่นับคาบเช้าของกลุ่มสาระ
      c.split.forEach(function (len, i) {
        var x = pl[i]; a.total += len; rt(c).forEach(function (k) { var t = out.tAm[k] || (out.tAm[k] = { am: 0, total: 0 }); t.total += len; if (x) for (var q = 0; q < len; q++) if (x.p + q <= 4) t.am++; });
        if (!x) { out.unplaced++; return; }
        for (var q = 0; q < len; q++) { var pp = x.p + q; if (pp <= 4) a.am++; if (fixedAt(x.d, pp)) out.fixedUsed++; if (hrAt(x.d, pp)) out.p8++; if (c.calc && pp >= 5) out.calcPm++; }
        pl.forEach(function (y, m) { if (m > i && y && y.d === x.d) out.sameDay++; });
        if (!hardOk(c, i, x.d, x.p) && !(D.rules.noSameDay && pl.some(function (y, m) { return m !== i && y && y.d === x.d; }))) { out.conflicts++; out.conflictList.push(c.id + '#' + i); }
      });
    });
    var seen = {}; Object.keys(S.R).concat(Object.keys(S.T), Object.keys(S.C)).forEach(function (k) { var m = S.R[k] || S.T[k] || S.C[k]; if (m && m.length > 1) m.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.conflicts++; out.conflictList.push(x); } }); });
    var tks = {}; regular().forEach(function (c) { rt(c).forEach(function (k) { tks[k] = 1; }); });
    Object.keys(tks).forEach(function (tk) { DAYS.forEach(function (d) { var ps = PER.filter(function (p) { return S.T[tk + '|' + d + '|' + p]; }); if (ps.length > 1) { for (var i = 1; i < ps.length; i++) { var gap = ps[i] - ps[i - 1] - 1; if (gap > 0 && !(ps[i - 1] <= 4 && ps[i] >= 5 && gap === ps[i] - 5 + 4 - ps[i - 1])) out.gaps += gap; } } var run = 0; PER.forEach(function (p) { if (S.T[tk + '|' + d + '|' + p]) { run++; if (run > D.rules.maxRun) out.runs++; } else run = 0; }); }); });
    var over = 0; Object.keys(out.dept).forEach(function (g) { var x = out.dept[g]; if (x.total && x.am / x.total * 100 > D.rules.amCap) over++; });
    var low = 0; Object.keys(out.tAm).forEach(function (k) { var x = out.tAm[k]; if (x.total >= 4 && x.am / x.total * 100 < D.rules.amMin) low++; });
    out.deptOver = over; out.tLow = low;
    out.score = Math.max(0, Math.round(100 - out.unplaced * 3 - out.conflicts * 5 - out.fixedUsed * 0.5 - out.calcPm * 0.3 - out.runs * 0.5 - out.gaps * 0.15 - over * 2 - low * 0.5));
    return out;
  }
  // ---------- แท็บ จัดตาราง ----------
  var COLORS = {};
  function colorOf(c) { var k = c.code + '|' + c.name; if (!COLORS[k]) COLORS[k] = PAL[Object.keys(COLORS).length % PAL.length]; return COLORS[k]; }
  function showGrid() {
    var R = rooms(); if (R.indexOf(st.room) === -1) st.room = R[0];
    var ev = evaluate(), tl = teachersAll().filter(function (t) { return regular().some(function (c) { return rt(c).indexOf(t.k) !== -1; }); });
    if (st.view === 'teacher' && !st.teacher && tl.length) st.teacher = tl[0].k;
    var h = '<div class="tt-gwrap"><div class="card tt-gmain"><div class="sb-bar"><span class="cb-mut">ดูตาม:</span>' + [['room', 'ห้อง'], ['teacher', 'ครู'], ['comp', 'ห้องคอม']].map(function (x) { return '<button type="button" class="tt-seg' + (st.view === x[0] ? ' on' : '') + '" data-tt-view="' + x[0] + '">' + x[1] + '</button>'; }).join('') +
      (st.view === 'room' ? '<select id="ttRoom" class="sb-in">' + R.map(function (r) { return '<option value="' + r + '"' + (r === st.room ? ' selected' : '') + '>' + roomName(r) + '</option>'; }).join('') + '</select>' : st.view === 'teacher' ? '<select id="ttTeach" class="sb-in">' + tl.map(function (t) { return '<option value="' + esc(t.k) + '"' + (t.k === st.teacher ? ' selected' : '') + '>' + esc(t.n) + '</option>'; }).join('') + '</select>' : '<select id="ttComp" class="sb-in">' + compRooms().map(function (i) { return '<option value="' + i + '"' + (i === st.comp ? ' selected' : '') + '>ห้องคอม ' + i + '</option>'; }).join('') + '</select>') +
      '<span class="sb-sp"></span><button type="button" class="btn btn-ghost btn-sm" data-tt-auto="fill" title="วางเฉพาะคาบที่ยังไม่ลง">' + ic('fa-puzzle-piece') + ' จัดที่เหลือ</button><button type="button" class="btn sb-vi btn-sm" data-tt-auto="all">' + ic('fa-wand-magic-sparkles') + ' จัดอัตโนมัติ</button></div>' +
      gridHtml(ev) + selBar() + '<p class="cb-mut sb-leg">ลายทาง = คาบพิเศษ · แตะวิชาเพื่อเลือก แล้วแตะช่องที่ต้องการย้าย (ช่องเขียว = ย้ายได้ · ส้ม = ได้แต่หักคะแนน · ช่องที่มีวิชาอื่น = สลับกัน) · ' + ic('fa-lock') + ' = ล็อก (จัดอัตโนมัติไม่ย้าย) · กรอบแดง = ชน/ผิดเงื่อนไข (แตะเพื่อดูเหตุผล) · กรอบเทาประ = ลงทับคาบกิจกรรมที่ตั้งให้ชนได้</p></div>' +
      '<div class="tt-side">' + sidePool() + conflictCard(ev) + scoreCard(ev) + '</div></div>';
    body.innerHTML = h;
  }
  function segAtCell(S, d, p) {
    var keys = st.view === 'room' ? S.R[st.room + '|' + d + '|' + p] : st.view === 'teacher' ? S.T[st.teacher + '|' + d + '|' + p] : S.C[st.comp + '|' + d + '|' + p];
    return keys || [];
  }
  function moveHints() {
    if (!st.sel) return null;
    var a = st.sel.split('#'), c = courseOf(a[0]), i = +a[1]; if (!c) return null;
    var S = build(), H = {}, cur = (D.place[c.id] || [])[i];
    DAYS.forEach(function (d) { PER.forEach(function (p) {
      if (!hardOk(c, i, d, p)) return;
      var bl = blockersAt(S, c, i, d, p).filter(function (k) { return k !== st.sel; });
      if (bl.length) { if (bl.length === 1 && cur && canSwap(S, st.sel, bl[0])) H[d + '|' + p] = 'sw'; return; }
      var tmp = cur ? (take(S, c, i, cur.d, cur.p), softCost(S, c, i, d, p)) : softCost(S, c, i, d, p); if (cur) put(S, c, i, cur.d, cur.p);
      H[d + '|' + p] = tmp >= 20 || onSoft(c, i, d, p) ? 'soft' : 'ok';
    }); });
    return H;
  }
  function canSwap(S, k1, k2) {
    var a = k1.split('#'), b = k2.split('#'), c1 = courseOf(a[0]), c2 = courseOf(b[0]), i1 = +a[1], i2 = +b[1], x1 = D.place[c1.id][i1], x2 = D.place[c2.id][i2];
    if (!x1 || !x2 || D.lock[k2] || c1.split[i1] !== c2.split[i2]) return false;
    take(S, c1, i1, x1.d, x1.p); take(S, c2, i2, x2.d, x2.p);
    D.place[c1.id][i1] = null; D.place[c2.id][i2] = null;
    var ok = hardOk(c1, i1, x2.d, x2.p) && hardOk(c2, i2, x1.d, x1.p) && !blockersAt(S, c1, i1, x2.d, x2.p).length;
    if (ok) { put(S, c1, i1, x2.d, x2.p); ok = !blockersAt(S, c2, i2, x1.d, x1.p).length; take(S, c1, i1, x2.d, x2.p); }
    D.place[c1.id][i1] = x1; D.place[c2.id][i2] = x2; put(S, c1, i1, x1.d, x1.p); put(S, c2, i2, x2.d, x2.p);
    return ok;
  }
  function gridHtml(ev) {
    var S = build(), H = moveHints(), bad = {}; ev.conflictList.forEach(function (k) { bad[k] = 1; });
    var h = '<div class="tt-gscroll"><table class="tt-grid"><thead><tr><th></th>' + PER.map(function (p) { return (p === 5 ? '<th class="lunch"></th>' : '') + '<th>' + p + '<small>' + TIMES[p] + '</small></th>'; }).join('') + '</tr></thead><tbody>';
    DAYS.forEach(function (d) {
      h += '<tr><th>' + DN[d] + '</th>';
      var skip = 0;
      PER.forEach(function (p) {
        if (p === 5) h += '<td class="lunch"></td>';
        if (skip) { skip--; return; }
        var keys = segAtCell(S, d, p), f = fixedAt(d, p), hint = H ? H[d + '|' + p] : null;
        if (keys.length) {
          var k0 = keys[0], a = k0.split('#'), c = courseOf(a[0]), i = +a[1], x = D.place[c.id][i], len = c.split[i], first = x.p === p;
          if (first && len === 2 && p !== 4) skip = 1;
          var span = first && len === 2 && p !== 4 ? 2 : 1;
          var sub = st.view === 'room' ? c.t.map(tName).join(' + ') : roomName(c.room) + (st.view === 'comp' ? ' · ' + c.t.map(tName).join(' + ') : '');
          var isBad = keys.length > 1 || keys.some(function (k) { return bad[k]; }), sf = !isBad && onSoft(c, i, x.d, x.p), p8 = !isBad && hrAt(x.d, x.p + len - 1);
          if (sf) sub += ' · ทับ' + sf.n; else if (p8) sub += ' · คาบ 8';
          h += '<td colspan="' + span + '" class="tt-c has' + (isBad ? ' bad' : sf ? ' soft' : '') + (st.sel && keys.indexOf(st.sel) !== -1 ? ' sel' : '') + (hint ? ' h-' + hint : '') + '" data-cell="' + d + '|' + p + '" data-seg="' + esc(k0) + '"><div class="tt-in" style="background:' + colorOf(c) + '">' + (D.lock[k0] ? '<i class="fa-solid fa-lock tt-lk"></i>' : '') + '<b>' + esc(c.name) + (len === 2 ? ' <small>(คู่)</small>' : '') + '</b><small>' + esc(sub) + '</small>' + (keys.length > 1 ? '<small class="tt-x">ชน ' + keys.length + ' วิชา</small>' : '') + '</div></td>';
        } else {
          var lab = f ? '<span>' + esc(f.n) + '</span>' : hrAt(d, p) ? '<span>โฮมรูม' + (D.hr.allow.indexOf(d) === -1 ? ' ' + ic('fa-lock') : '<br><small>ลงวิชาเบาได้</small>') + '</span>' : '';
          h += '<td class="tt-c' + (f ? ' fx' + (f.hard ? ' hard' : '') : hrAt(d, p) ? ' hr' : '') + (hint ? ' h-' + hint : '') + '" data-cell="' + d + '|' + p + '">' + lab + '</td>';
        }
      });
      h += '</tr>';
    });
    return h + '</tbody></table></div>';
  }
  function selBar() {
    if (!st.sel) return '';
    var a = st.sel.split('#'), c = courseOf(a[0]); if (!c) return '';
    var x = (D.place[c.id] || [])[+a[1]], why = x ? whyBad(build(), st.sel) : [], sf = x && !why.length ? onSoft(c, +a[1], x.d, x.p) : null;
    var note = why.length ? '<div class="tt-why bad"><b>' + ic('fa-triangle-exclamation') + ' ชน / ผิดเงื่อนไข</b><ul>' + why.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul></div>'
      : sf ? '<div class="tt-why">' + ic('fa-circle-info') + ' ลงทับคาบ' + esc(sf.n) + ' — ตั้งไว้ให้ชนได้ (ไม่ผิด · หักคะแนนเล็กน้อย)</div>' : '';
    return note + '<div class="tt-selbar"><b>' + esc(c.name) + ' ' + roomName(c.room) + (c.split[+a[1]] === 2 ? ' (คาบคู่)' : '') + '</b><span class="cb-mut">' + (x ? DN[x.d] + ' คาบ ' + x.p : 'ยังไม่ลง') + ' · แตะช่องเพื่อย้าย</span><span class="sb-sp"></span>' + (x ? '<button type="button" class="btn btn-ghost btn-sm" data-tt-lock>' + ic(D.lock[st.sel] ? 'fa-lock-open' : 'fa-lock') + ' ' + (D.lock[st.sel] ? 'ปลดล็อก' : 'ล็อก') + '</button><button type="button" class="btn btn-ghost btn-sm" data-tt-unplace>' + ic('fa-arrow-right-from-bracket') + ' เอาออก</button>' : '') + '<button type="button" class="btn btn-ghost btn-sm" data-tt-desel>' + ic('fa-xmark') + ' ยกเลิก</button></div>';
  }
  // เหตุผลที่ช่องนี้ชน / ผิดเงื่อนไข (แตะช่องแดงเพื่อดู)
  function segName(k) { var c = courseOf(k.split('#')[0]); return c ? c.name + ' ' + roomName(c.room) : k; }
  function whyBad(S, key) {
    var a = key.split('#'), c = courseOf(a[0]), i = +a[1]; if (!c) return [];
    var x = (D.place[c.id] || [])[i]; if (!x) return [];
    var len = c.split[i], R = D.rules, d = x.d, o = {};
    if (x.p + len - 1 > 8) o['คาบคู่เกินคาบ 8'] = 1;
    if (len === 2 && R.noLunch && x.p === 4) o['คาบคู่คร่อมพักกลางวัน'] = 1;
    for (var k = 0; k < len; k++) {
      var q = x.p + k, f = fixedAt(d, q);
      if (f && f.hard) o['ลงทับคาบ' + f.n + ' (ตั้งไว้ห้ามชน)'] = 1;
      if (hrAt(d, q)) { if (!isLight(c)) o['คาบ ' + q + ' เป็นโฮมรูม — ลงได้เฉพาะวิชาเบา'] = 1; else if (D.hr.allow.indexOf(d) === -1) o['คาบ ' + q + ' วัน' + DN[d] + ' เป็นโฮมรูมอย่างเดียว (ไม่ได้เปิดให้ลงวิชาเบา)'] = 1; }
      c.t.forEach(function (tk) { if (blockedFor(tk, d, q)) o[tName(tk) + ' กันเวลาไว้ (' + DN[d] + ' คาบ ' + q + ')'] = 1; });
    }
    var cw = compWant(c);
    cells(c, i, d, x.p).forEach(function (q) {
      (S.R[c.room + '|' + d + '|' + q] || []).forEach(function (k2) { if (k2 !== key) o['ห้องนี้มี ' + segName(k2) + ' คาบ ' + q + ' อยู่แล้ว'] = 1; });
      rt(c).forEach(function (tk) { (S.T[tk + '|' + d + '|' + q] || []).forEach(function (k2) { if (k2 !== key) o[tName(tk) + ' สอน ' + segName(k2) + ' พร้อมกัน (คาบ ' + q + ')'] = 1; }); });
      if (cw) (S.C[cw + '|' + d + '|' + q] || []).forEach(function (k2) { if (k2 !== key) o['ห้องคอม ' + cw + ' ถูกใช้โดย ' + segName(k2) + ' (คาบ ' + q + ')'] = 1; });
    });
    return Object.keys(o);
  }
  function conflictCard(ev) {
    var L = ev.conflictList; if (!L.length) return '';
    var S = build();
    return '<div class="card tt-cfl"><b>' + ic('fa-triangle-exclamation') + ' ชน / ผิดเงื่อนไข (' + L.length + ')</b>' + L.slice(0, 40).map(function (k) {
      var a = k.split('#'), c = courseOf(a[0]); if (!c) return ''; var x = (D.place[c.id] || [])[+a[1]], w = whyBad(S, k);
      return '<button type="button" class="tt-cf" data-tt-goto="' + esc(k) + '"><span><b>' + esc(c.name) + '</b> ' + roomName(c.room) + (x ? ' · ' + DS[x.d] + ' คาบ ' + x.p : '') + '</span><small>' + esc(w[0] || '') + (w.length > 1 ? ' (+' + (w.length - 1) + ')' : '') + '</small></button>';
    }).join('') + (L.length > 40 ? '<p class="cb-mut" style="margin:6px 0 0">…และอีก ' + (L.length - 40) + ' รายการ</p>' : '') + '</div>';
  }
  function sidePool() {
    var list = [];
    regular().forEach(function (c) { if (st.view === 'room' && c.room !== st.room) return; if (st.view === 'teacher' && c.t.indexOf(st.teacher) === -1) return; if (st.view === 'comp' && compWant(c) !== st.comp) return; c.split.forEach(function (len, i) { if (!(D.place[c.id] || [])[i]) list.push({ c: c, i: i, len: len }); }); });
    var all = 0; regular().forEach(function (c) { c.split.forEach(function (l, i) { if (!(D.place[c.id] || [])[i]) all++; }); });
    return '<div class="card tt-pool"><b>ยังไม่ได้ลง' + (st.view === 'room' ? ' (' + roomName(st.room) + ')' : '') + '</b>' + (list.length ? list.map(function (s) { var k = s.c.id + '#' + s.i; return '<button type="button" class="tt-pi' + (st.sel === k ? ' sel' : '') + '" data-seg="' + esc(k) + '" style="background:' + colorOf(s.c) + '"><span>' + esc(s.c.name) + (st.view !== 'room' ? ' ' + roomName(s.c.room) : '') + '</span><small>' + (s.len === 2 ? 'คาบคู่' : '1 คาบ') + '</small></button>'; }).join('') : '<p class="cb-mut" style="margin:6px 0 0">' + ic('fa-check') + ' ลงครบแล้ว</p>') + (all && all !== list.length ? '<p class="cb-mut" style="margin:8px 0 0;font-size:.82rem">ทั้งโรงเรียนยังไม่ลง ' + all + ' คาบ</p>' : '') + '</div>';
  }
  function scoreCard(ev) {
    var col = ev.score >= 85 ? 'var(--accent)' : ev.score >= 60 ? '#d97706' : 'var(--danger)';
    var depts = Object.keys(ev.dept).filter(function (g) { return ev.dept[g].total; }).sort(function (a, b) { return ev.dept[b].am / ev.dept[b].total - ev.dept[a].am / ev.dept[a].total; });
    function li(t, n, warn) { return '<div class="tt-sc"><span>' + t + '</span><b' + (n && warn ? ' class="w"' : '') + '>' + n + '</b></div>'; }
    return '<div class="card"><div class="tt-score"><b style="color:' + col + '">' + ev.score + '</b><span>คะแนนคุณภาพ<br><small class="cb-mut">เทียบฉบับร่างอื่นได้</small></span></div>' +
      li('ยังไม่ได้ลง', ev.unplaced, 1) + li('ชน / ผิดเงื่อนไข', ev.conflicts, 1) + li('ลงทับคาบกิจกรรมที่ชนได้', ev.fixedUsed, 0) + li('วิชาเบาในคาบ 8', ev.p8, 0) + li('วิชาคำนวณช่วงบ่าย', ev.calcPm, 1) + li('สอนติดกันเกินกำหนด', ev.runs, 1) + li('คาบว่างคั่นของครู', ev.gaps, 0) + li('ครูที่คาบเช้าน้อยกว่า ' + D.rules.amMin + '%', ev.tLow, 1) +
      '<h4 class="tt-h4">คาบเช้าแต่ละกลุ่มสาระ</h4><div class="cb-mut" style="font-size:.78rem;margin-bottom:6px"><span style="color:#2563eb;font-weight:700">น้ำเงิน</span> = เช้า (คาบ 1–4) · เพดาน ' + D.rules.amCap + '%</div>' +
      (depts.length ? depts.map(function (g) { var x = ev.dept[g], pc = Math.round(x.am / x.total * 100); return '<div class="tt-am"><span>' + esc(g) + '</span><div class="t"><i style="width:' + pc + '%"></i></div><b' + (pc > D.rules.amCap ? ' class="w"' : '') + '>' + pc + '%</b></div>'; }).join('') : '<p class="cb-mut">ยังไม่มีข้อมูล</p>') + '</div>';
  }
  function moveSel(d, p) {
    var a = st.sel.split('#'), c = courseOf(a[0]), i = +a[1], S = build(), cur = (D.place[c.id] || [])[i];
    if (!hardOk(c, i, d, p)) { showToast('ช่องนี้ลงไม่ได้ (คาบพิเศษ / กันเวลา / วันเดียวกับคาบอื่นของวิชานี้)', true); return; }
    var bl = blockersAt(S, c, i, d, p).filter(function (k) { return k !== st.sel; });
    if (bl.length === 1 && cur && canSwap(S, st.sel, bl[0])) { var b = bl[0].split('#'), c2 = courseOf(b[0]), x2 = D.place[c2.id][+b[1]]; D.place[c2.id][+b[1]] = { d: cur.d, p: cur.p, len: c2.split[+b[1]] }; D.place[c.id][i] = { d: x2.d, p: x2.p, len: c.split[i] }; }
    else if (bl.length) { showToast('ช่องนี้ชนกับ ' + bl.map(function (k) { var cc = courseOf(k.split('#')[0]); return cc.name + ' ' + roomName(cc.room); }).join(', '), true); return; }
    else { if (!D.place[c.id]) D.place[c.id] = []; D.place[c.id][i] = { d: d, p: p, len: c.split[i] }; }
    st.sel = null; setDirty(true); showGrid();
  }
  // ---------- แท็บ ประกาศใช้ ----------
  function bName(k) { if (!k) return ''; if (k.indexOf('x:') === 0) return k.slice(2); return D.bnames[k] || tName(k); }
  function pubSubjects() {
    return D.courses.map(function (c) {
      var sch = [];
      if (c.fx && c.fx !== 'hr') { var f = D.fixed.filter(function (z) { return z.k === c.fx; })[0]; if (f) sch.push({ day: f.d, period: f.p }); } // วิชากิจกรรม = ตามคาบพิเศษ
      else if (c.fx === 'hr') { var hd = {}; (D.place[c.id] || []).forEach(function (x) { if (x) hd[x.d] = 1; }); if (!Object.keys(hd).length) DAYS.filter(function (d) { return D.hr.allow.indexOf(d) === -1; }).slice(0, +c.n || 1).forEach(function (d) { hd[d] = 1; }); Object.keys(hd).forEach(function (d) { sch.push({ day: +d, period: D.hr.p }); }); }
      else (D.place[c.id] || []).forEach(function (x, i) { if (x) for (var k = 0; k < c.split[i]; k++) sch.push({ day: x.d, period: x.p + k }); }); return { id: c.src || '', code: c.code, name: c.name, roomId: c.room, teacher: bName(c.t[0]), teacher2: bName(c.t[1]), credits: c.cr === undefined ? '' : c.cr, schedules: sch }; });
  }
  function showPub() {
    var ev = evaluate(), ok = !ev.unplaced && !ev.conflicts;
    var h = '<div class="sb-2col"><div class="card"><h3 style="margin-top:0">' + ic('fa-paper-plane ui-icon') + ' ประกาศใช้ตารางนี้</h3>' +
      '<div class="tt-pubterm"><label>ภาคเรียนที่ <select id="ttT" class="sb-in">' + ['1', '2'].map(function (t) { return '<option' + (D.term === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label><label>ปีการศึกษา <input id="ttY" class="sb-num" style="width:90px" value="' + esc(D.year) + '" maxlength="4" /></label></div>' +
      '<ul class="tt-chk"><li class="' + (ev.unplaced ? 'no' : 'ok') + '">' + ic(ev.unplaced ? 'fa-xmark' : 'fa-check') + ' ลงครบทุกคาบ' + (ev.unplaced ? ' (ยังขาด ' + ev.unplaced + ')' : '') + '</li><li class="' + (ev.conflicts ? 'no' : 'ok') + '">' + ic(ev.conflicts ? 'fa-xmark' : 'fa-check') + ' ไม่มีช่องชน' + (ev.conflicts ? ' (' + ev.conflicts + ')' : '') + '</li><li class="' + (B.enabled ? 'ok' : 'no') + '">' + ic(B.enabled ? 'fa-check' : 'fa-xmark') + ' เปิดระบบจัดตารางเรียนแล้ว</li></ul>' +
      '<p class="cb-mut" style="font-size:.86rem">ประกาศ = ส่งตารางทุกห้องให้เว็บเช็คชื่อ (แทนตารางเดิมของภาคเรียนนั้น) · ทำได้เฉพาะภาคเรียนที่ยังไม่เริ่มเช็คชื่อ · เว็บเช็คชื่อเก็บตารางเดิมสำรองไว้ 1 ชุด</p>' +
      '<label class="tt-ck" style="margin-bottom:12px"><input type="checkbox" id="ttRc" /> อัปเดตจำนวนห้องในเว็บเช็คชื่อเป็น ' + rooms().length + ' ห้องด้วย (มีผลทันทีทุกภาคเรียน — ติ๊กเมื่อจำนวนห้องเปลี่ยนจริง)</label><br>' +
      '<button type="button" class="btn btn-success" data-tt-pub' + (ok && B.enabled && B.isSuper ? '' : ' disabled') + '>' + ic('fa-paper-plane') + ' ประกาศใช้</button>' + (!B.isSuper ? '<p class="cb-mut" style="font-size:.84rem">ประกาศใช้ได้เฉพาะผู้ดูแลระบบสูงสุด</p>' : '') + (META && META.publishedAt ? '<p class="cb-mut">ประกาศล่าสุด ' + esc(formatDateTimeThai(META.publishedAt)) + '</p>' : '') +
      '<h3>' + ic('fa-print ui-icon') + ' พิมพ์</h3><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-secondary btn-sm" data-tt-print="room">' + ic('fa-door-open') + ' ตารางเรียนทุกห้อง</button><button type="button" class="btn btn-secondary btn-sm" data-tt-print="teacher">' + ic('fa-chalkboard-user') + ' ตารางสอนครูทุกคน</button></div></div>';
    h += '<div class="card"><h3 style="margin-top:0">' + ic('fa-gear ui-icon') + ' ตั้งค่าระบบจัดตารางเรียน</h3>' + (B.isSuper ? '<div class="sb-row"><div><b>เปิดใช้ระบบจัดตารางเรียน</b><small>ปิด = เห็นเฉพาะผู้ดูแลระบบ · ทำฉบับร่างได้ ประกาศใช้ไม่ได้ · เปิด = ผู้ดูแลที่ตั้งไว้ใช้ได้ และประกาศใช้ได้</small></div><div class="r"><label class="switch"><input type="checkbox" id="ttOn"' + (B.enabled ? ' checked' : '') + ' /><span class="slider"></span></label></div></div>' +
      '<div class="sb-row"><div><b>ผู้ดูแลการจัดตาราง</b><small>ใช้หน้านี้ได้เมื่อเปิดระบบ</small></div></div><div class="sb-chips">' + (B.managers.map(function (m) { return '<span class="sb-chip gr">' + esc((PMAP[m.id] || {}).name || m.id) + ' <button type="button" class="sb-x" data-tt-rmm="' + esc(m.id) + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button></span>'; }).join('') || '<span class="cb-mut">ยังไม่มี</span>') + '<select class="sb-in" id="ttAddM"><option value="">+ เพิ่มผู้ดูแล</option>' + B.people.filter(function (p) { return !B.managers.some(function (m) { return m.id === p.id; }); }).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') + '</select></div>' : '<p class="cb-mut">ตั้งค่าได้เฉพาะผู้ดูแลระบบสูงสุด · ตอนนี้ระบบ' + (B.enabled ? 'เปิด' : 'ปิด') + 'อยู่</p>') + '</div></div>';
    body.innerHTML = h;
  }
  async function cfgSave(p) {
    var r = await withProgress('กำลังบันทึก', function () { return apiCall('ttCfgSave', p); }, { successLabel: 'บันทึกแล้ว' });
    if (r.ok) { B.enabled = r.data.enabled; B.managers = r.data.managers; offEl.innerHTML = B.enabled ? '' : '<div class="sb-off">' + ic('fa-eye-slash') + ' ระบบจัดตารางเรียนปิดอยู่ — เห็นเฉพาะผู้ดูแลระบบ · ทำฉบับร่างได้ทุกอย่าง · ยังประกาศใช้ (ส่งไปเว็บเช็คชื่อ) ไม่ได้</div>'; showPub(); }
  }
  // ---------- พิมพ์ ----------
  function printAll(kind) {
    var S = build(), pages = [];
    var list = kind === 'room' ? rooms().map(function (r) { return { title: 'ตารางเรียน ' + roomName(r), key: function (d, p) { return S.R[r + '|' + d + '|' + p]; }, sub: function (c) { return c.t.map(tName).join(' + '); } }; })
      : teachersAll().filter(function (t) { return regular().some(function (c) { return rt(c).indexOf(t.k) !== -1; }); }).map(function (t) { return { title: 'ตารางสอน ' + t.n, key: function (d, p) { return S.T[t.k + '|' + d + '|' + p]; }, sub: function (c) { return roomName(c.room); } }; });
    list.forEach(function (L) {
      var h = '<h2>' + esc(L.title) + '</h2><p>ภาคเรียนที่ ' + esc(D.term + '/' + D.year) + '</p><table><thead><tr><th></th>' + PER.map(function (p) { return '<th>' + p + '<br><small>' + TIMES[p] + '</small></th>'; }).join('') + '</tr></thead><tbody>';
      DAYS.forEach(function (d) { h += '<tr><th>' + DN[d] + '</th>' + PER.map(function (p) { var k = (L.key(d, p) || [])[0], f = fixedAt(d, p); if (k) { var c = courseOf(k.split('#')[0]); return '<td><b>' + esc(c.code || '') + '</b><br>' + esc(c.name) + '<br><small>' + esc(L.sub(c)) + '</small></td>'; } return '<td class="g">' + (f ? esc(f.n) : hrAt(d, p) ? 'โฮมรูม' : '') + '</td>'; }).join('') + '</tr>'; });
      pages.push(h + '</tbody></table>');
    });
    var html = '<!doctype html><html lang="th"><head><meta charset="utf-8"><title>' + (kind === 'room' ? 'ตารางเรียน' : 'ตารางสอน') + '</title><style>@page{size:A4 landscape;margin:12mm}body{font-family:Sarabun,"Noto Sans Thai",sans-serif;color:#111}section{page-break-after:always}h2{margin:0 0 2px}p{margin:0 0 8px;color:#555}table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #999;padding:4px;font-size:12px;text-align:center;vertical-align:middle;height:58px}thead th{height:auto;background:#f1f5f9}td.g{background:#f3f4f6;color:#666}small{color:#555}</style></head><body>' + pages.map(function (p) { return '<section>' + p + '</section>'; }).join('') + '</body></html>'; // 2.34.3: สั่งพิมพ์จากหน้าหลัก (CSP ไม่อนุญาตสคริปต์ในเอกสาร)
    var u = URL.createObjectURL(new Blob([html], { type: 'text/html' })), w = window.open(u, '_blank'); if (!w) { showToast('เบราว์เซอร์บล็อกหน้าต่างใหม่ — อนุญาตป็อปอัปแล้วลองใหม่', true); return; }
    var tries = 0; (function wait() { var ok = false; try { ok = w.location.href === u && w.document.readyState === 'complete'; } catch (e) { ok = false; } if (ok) setTimeout(function () { w.print(); }, 300); else if (++tries < 100 && !w.closed) setTimeout(wait, 100); })();
  }

  // ---------- เหตุการณ์ ----------
  document.addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-tt-new]'))) { newDraft(t.getAttribute('data-tt-new')); return; }
    if (e.target.closest('[data-tt-newmenu]')) {
      var m = document.createElement('div'); m.className = 'modal-backdrop'; m.hidden = true;
      m.innerHTML = '<div class="modal-box" style="text-align:left"><button type="button" class="modal-close-x" data-x aria-label="ปิด">✕</button><h3>' + ic('fa-plus') + ' ฉบับร่างใหม่</h3><div style="display:flex;flex-direction:column;gap:10px"><button type="button" class="btn btn-primary" data-k="import">' + ic('fa-file-import') + ' ตั้งต้นจากตารางปัจจุบัน (เว็บเช็คชื่อ)</button><button type="button" class="btn btn-secondary" data-k="blank">' + ic('fa-plus') + ' ฉบับร่างว่าง</button></div><div class="modal-actions"><button type="button" class="btn btn-ghost" data-x>ยกเลิก</button></div></div>';
      document.body.appendChild(m); showModalEl(m);
      m.addEventListener('click', function (ev2) { var k = ev2.target.closest('[data-k]'); if (ev2.target.closest('[data-x]') || k) { hideModalEl(m); setTimeout(function () { m.remove(); }, 300); } if (k) newDraft(k.getAttribute('data-k')); });
      return;
    }
    if (e.target.closest('[data-tt-save]')) { await saveDraft(false); return; }
    if (e.target.closest('[data-tt-dup]')) { var nm = await askText('', 'ทำสำเนาฉบับร่าง', { value: (META ? META.name : 'ฉบับร่าง') + ' (สำเนา)', placeholder: 'ชื่อฉบับร่างใหม่', okText: 'ทำสำเนา', maxLength: 80, required: true }); if (nm && nm.trim()) { await saveDraft(true, nm.trim()); paintDraftBar(); } return; }
    if (e.target.closest('[data-tt-ren]')) { var nn = await askText('', 'เปลี่ยนชื่อฉบับร่าง', { value: META.name, placeholder: 'ชื่อฉบับร่าง', okText: 'บันทึก', maxLength: 80, required: true }); if (nn && nn.trim()) { META.name = nn.trim(); await saveDraft(false); } return; }
    if (e.target.closest('[data-tt-del]')) {
      if (!(await askConfirm('ลบฉบับร่าง <b>' + esc(META.name) + '</b> — ลบแล้วกู้คืนไม่ได้', 'ลบฉบับร่าง'))) return;
      var rd = await withProgress('กำลังลบ', function () { return apiCall('ttDel', { id: META.id }); }, { successLabel: 'ลบแล้ว' });
      if (rd.ok) { B.drafts = rd.data.drafts; META = null; D = null; dirty = false; if (B.drafts.length) openDraft(B.drafts[0].id); else { paintDraftBar(); renderEmpty(); } }
      return;
    }
    if (!D) return;
    if ((t = e.target.closest('[data-tt-tab]'))) { st.tab = t.getAttribute('data-tt-tab'); st.sel = null; show(); return; }
    if (st.tab === 'load') {
      if (e.target.closest('[data-tt-addc]')) { D.courses.push({ id: uid(), room: st.loadRoom, code: '', name: 'วิชาใหม่', n: 1, split: [1], t: [], comp: '', calc: false, group: '', fx: '' }); setDirty(true); showLoad(); return; }
      if ((t = e.target.closest('[data-tt-rmc]'))) { var id = t.getAttribute('data-tt-rmc'); D.courses = D.courses.filter(function (c) { return c.id !== id; }); delete D.place[id]; setDirty(true); showLoad(); return; }
      if (e.target.closest('[data-tt-addx]')) { var xn = document.getElementById('ttXn').value.trim(); if (xn && D.extra.indexOf(xn) === -1) { D.extra.push(xn); setDirty(true); showLoad(); } return; }
      if ((t = e.target.closest('[data-tt-rmx]'))) { var x = t.getAttribute('data-tt-rmx'); if (D.courses.some(function (c) { return c.t.indexOf('x:' + x) !== -1; })) { showToast('ยังมีวิชาที่ใช้ชื่อนี้อยู่ — เปลี่ยนครูในแถววิชาก่อน', true); return; } D.extra = D.extra.filter(function (n) { return n !== x; }); setDirty(true); showLoad(); return; }
      if (e.target.closest('[data-tt-copyroom]')) {
        var g = st.loadRoom.split('_')[0], others = rooms().filter(function (r) { return r !== st.loadRoom && r.indexOf(g + '_') === 0; }), src = D.courses.filter(function (c) { return c.room === st.loadRoom; });
        if (!others.length || !src.length) { showToast('ไม่มีห้องอื่นในระดับนี้ หรือห้องนี้ยังไม่มีวิชา', true); return; }
        if (!(await askConfirm('คัดลอกวิชาของ ' + roomName(st.loadRoom) + ' (' + src.length + ' วิชา) ไปแทนที่วิชาของ ' + others.map(roomName).join(', ') + '<br>ครูผู้สอนคัดลอกไปด้วย — แก้ทีหลังได้', 'คัดลอกวิชา'))) return;
        D.courses = D.courses.filter(function (c) { if (others.indexOf(c.room) !== -1) { delete D.place[c.id]; return false; } return true; });
        others.forEach(function (r) { src.forEach(function (c) { var n = clone(c); n.id = uid(); n.room = r; delete n.src; D.courses.push(n); }); });
        setDirty(true); showLoad(); return;
      }
    }
    if (st.tab === 'rule') {
      if (e.target.closest('[data-tt-addb]')) {
        var who = document.getElementById('bWho').value, ty = document.getElementById('bType').value, d = +document.getElementById('bDay').value, note = document.getElementById('bNote').value.trim();
        if (!who) { showToast('เลือกครูหรือกลุ่มสาระก่อน', true); return; }
        var b = { who: who, note: note };
        if (ty === 'pm1') b.pm = 1; else { b.d = d; b.ps = ty === 'pm' ? [5, 6, 7, 8] : ty === 'am' ? [1, 2, 3, 4] : ty === 'day' ? PER.slice() : String(document.getElementById('bPs').value).split(/[,\s]+/).map(Number).filter(function (x) { return x >= 1 && x <= 8; }); if (!b.ps.length) { showToast('ระบุคาบ เช่น 7,8', true); return; } }
        D.blocks.push(b); if (b.pm) delete D.pmDay[who]; setDirty(true); showRule(); return;
      }
      if ((t = e.target.closest('[data-tt-rmb]'))) { var rb = D.blocks.splice(+t.getAttribute('data-tt-rmb'), 1)[0]; if (rb && rb.pm) delete D.pmDay[rb.who]; setDirty(true); showRule(); return; }
    }
    if (st.tab === 'grid') {
      if ((t = e.target.closest('[data-tt-view]'))) { st.view = t.getAttribute('data-tt-view'); st.sel = null; showGrid(); return; }
      if ((t = e.target.closest('[data-tt-auto]'))) {
        var mode = t.getAttribute('data-tt-auto');
        if (mode === 'all' && !(await askConfirm('จัดอัตโนมัติทั้งโรงเรียน — คาบที่ไม่ได้ล็อกจะถูกจัดใหม่ทั้งหมด<br>(ยังไม่บันทึกจนกว่าจะกด "บันทึก" · ไม่พอใจกดเปิดฉบับร่างเดิมใหม่ได้)', 'จัดอัตโนมัติ'))) return;
        var before = evaluate();
        var r = await withProgress('กำลังจัดตาราง (ไม่เกิน 5 วินาที)', function () { return new Promise(function (res) { setTimeout(function () { res(solve(mode)); }, 60); }); }, { successLabel: 'จัดแล้ว' });
        st.sel = null; setDirty(true); showGrid();
        var after = evaluate(); showToast('จัดแล้ว · ยังไม่ลง ' + after.unplaced + ' คาบ · คะแนน ' + before.score + ' → ' + after.score); void r;
        return;
      }
      if (e.target.closest('[data-tt-desel]')) { st.sel = null; showGrid(); return; }
      if ((t = e.target.closest('[data-tt-goto]'))) { var gk = t.getAttribute('data-tt-goto'), gc = courseOf(gk.split('#')[0]); if (gc) { st.view = 'room'; st.room = gc.room; st.sel = gk; showGrid(); var gm = body.querySelector('.tt-gmain'); if (gm) gm.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return; }
      if (e.target.closest('[data-tt-lock]')) { if (D.lock[st.sel]) delete D.lock[st.sel]; else D.lock[st.sel] = 1; setDirty(true); showGrid(); return; }
      if (e.target.closest('[data-tt-unplace]')) { var aa = st.sel.split('#'); D.place[aa[0]][+aa[1]] = null; delete D.lock[st.sel]; st.sel = null; setDirty(true); showGrid(); return; }
      var cell = e.target.closest('[data-cell]'), seg = e.target.closest('[data-seg]');
      if (st.sel && cell) { var cp = cell.getAttribute('data-cell').split('|'), sk = cell.getAttribute('data-seg'); if (sk === st.sel) { st.sel = null; showGrid(); return; } if (D.lock[st.sel]) { showToast('คาบนี้ล็อกไว้ — ปลดล็อกก่อนย้าย', true); return; } moveSel(+cp[0], +cp[1]); return; }
      if (seg) { st.sel = seg.getAttribute('data-seg'); showGrid(); return; }
    }
    if (st.tab === 'pub') {
      if ((t = e.target.closest('[data-tt-print]'))) { printAll(t.getAttribute('data-tt-print')); return; }
      if ((t = e.target.closest('[data-tt-rmm]'))) { var mid = t.getAttribute('data-tt-rmm'); cfgSave({ managers: B.managers.filter(function (m) { return m.id !== mid; }) }); return; }
      if (e.target.closest('[data-tt-pub]')) {
        if (dirty && !(await saveDraft(false))) return;
        var term = document.getElementById('ttT').value, year = document.getElementById('ttY').value.trim();
        if (!/^\d{4}$/.test(year)) { showToast('ปีการศึกษาไม่ถูกต้อง', true); return; }
        var rc = document.getElementById('ttRc').checked;
        if (!(await askConfirm('ประกาศใช้ตาราง <b>' + esc(META.name) + '</b> ภาคเรียนที่ ' + term + '/' + year + '<br>เว็บเช็คชื่อจะใช้ตารางนี้แทนตารางเดิมของภาคเรียนนั้น (' + D.courses.length + ' รายวิชา · ' + rooms().length + ' ห้อง)', 'ประกาศใช้'))) return;
        var rp = await withProgress('กำลังส่งตารางให้เว็บเช็คชื่อ', function () { return apiCall('ttPublish', { id: META.id, term: term, year: year, subjects: pubSubjects(), roomCounts: rc ? D.grades : null }); }, { successLabel: 'ประกาศใช้แล้ว' });
        if (rp.ok) { B.drafts = rp.data.drafts; META.publishedAt = new Date().toISOString(); show(); }
      }
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'ttPick') { var id = t.value; if (dirty) { askConfirm('ฉบับร่างนี้ยังไม่ได้บันทึก — เปิดฉบับอื่นเลยไหม?', 'เปิดฉบับร่าง').then(function (ok) { if (ok) { dirty = false; openDraft(id); } else t.value = META.id; }); } else openDraft(id); return; }
    if (!D) return;
    if (t.matches('[data-grade]')) { D.grades[t.getAttribute('data-grade')] = Math.max(0, Math.min(20, +t.value || 0)); setDirty(true); showRooms(); tabsEl.querySelector('[data-tt-tab="rooms"]').innerHTML = ic('fa-door-open ui-icon') + ' ห้องเรียน (' + rooms().length + ')'; return; }
    if (t.matches('[data-fx-d]')) { D.fixed[+t.getAttribute('data-fx-d')].d = +t.value; setDirty(true); return; }
    if (t.matches('[data-fx-p]')) { D.fixed[+t.getAttribute('data-fx-p')].p = +t.value; setDirty(true); return; }
    if (t.matches('[data-fx-h]')) { D.fixed[+t.getAttribute('data-fx-h')].hard = t.checked; setDirty(true); return; }
    if (t.matches('[data-hr-allow]')) { var d = +t.getAttribute('data-hr-allow'); D.hr.allow = D.hr.allow.filter(function (x) { return x !== d; }); if (t.checked) D.hr.allow.push(d); setDirty(true); return; }
    if (t.matches('[data-tt-dummy]')) { var dk = 'x:' + t.getAttribute('data-tt-dummy'); D.dummy = (D.dummy || []).filter(function (x) { return x !== dk; }); if (t.checked) D.dummy.push(dk); setDirty(true); showLoad(); return; }
    if (t.matches('[data-light]')) { var k = t.getAttribute('data-light'); D.light = D.light.filter(function (x) { return x !== k; }); if (t.checked) D.light.push(k); setDirty(true); return; }
    if (t.id === 'ttLoadRoom') { st.loadRoom = t.value; showLoad(); return; }
    if (t.closest('.tt-load')) { onLoadInput(t); return; }
    if (t.matches('[data-rule]')) { var rk = t.getAttribute('data-rule'); D.rules[rk] = t.type === 'checkbox' ? t.checked : Math.max(0, +t.value || 0); setDirty(true); return; }
    if (t.id === 'ttCompN') { D.comp.n = Math.max(1, Math.min(3, +t.value || 1)); setDirty(true); showRule(); return; }
    if (t.matches('[data-comp-home]')) { D.comp.home[t.getAttribute('data-comp-home')] = t.value; setDirty(true); return; }
    if (t.id === 'bType') { document.getElementById('bPs').hidden = t.value !== 'p'; document.getElementById('bDay').hidden = t.value === 'pm1'; return; }
    if (t.id === 'ttRoom') { st.room = t.value; st.sel = null; showGrid(); return; }
    if (t.id === 'ttTeach') { st.teacher = t.value; st.sel = null; showGrid(); return; }
    if (t.id === 'ttComp') { st.comp = t.value; st.sel = null; showGrid(); return; }
    if (t.id === 'ttT') { D.term = t.value; setDirty(true); return; }
    if (t.id === 'ttY') { D.year = t.value.trim(); setDirty(true); return; }
    if (t.id === 'ttOn') { var on = t.checked; askConfirm(on ? 'เปิดระบบจัดตารางเรียน — ผู้ดูแลที่ตั้งไว้ใช้หน้านี้ได้ และประกาศใช้ตารางได้' : 'ปิดระบบจัดตารางเรียน — เหลือเฉพาะผู้ดูแลระบบ', on ? 'เปิดระบบ' : 'ปิดระบบ').then(function (ok) { if (ok) cfgSave({ enabled: on }); else t.checked = !on; }); return; }
    if (t.id === 'ttAddM' && t.value) { cfgSave({ managers: B.managers.concat([{ id: t.value, manage: true, view: true }]) }); return; }
  });
  boot();
})();
