/* กิจการนักเรียน (2.03.0) — หน้า care.html · ข้อมูลจาก BNK Care Center (Worker แยก) ผ่าน Worker ของเว็บส่งงาน
 * แท็บ: ภาพรวมการมาสาย · นักเรียนที่สายบ่อย · คะแนนพฤติกรรม · ตั้งค่า (สิทธิ์จัดการ)
 * ประหยัด: โหลดเมื่อเปิดแท็บ/เปลี่ยนช่วง · จำผลไว้ในหน้า (ไม่โหลดซ้ำเมื่อสลับแท็บกลับมา) */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('care'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('ccBody'), tabsEl = document.getElementById('ccTabs');
  var B = null, st = { tab: 'overview', range: 'week', from: '', to: '', grade: '', min: 3, room: '', q: '' }, C = { ov: {}, sc: {} };
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], DW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var REASON_C = { 'รถติด': '#f59e0b', 'ตื่นสาย': '#ef4444', 'ธุระ': '#3b82f6', 'อื่นๆ': '#8b5cf6', '': '#cbd5e1' };
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dP(s) { var p = String(s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function thD(s, y) { var d = dP(s); return d.getDate() + ' ' + MS[d.getMonth()] + (y ? ' ' + (d.getFullYear() + 543) : ''); }
  function err(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function lvCls(lv) { return lv === 'good' ? 'g' : (lv === 'fair' ? 'o' : 'r'); }
  function lvTxt(lv) { return lv === 'good' ? 'ดี' : (lv === 'fair' ? 'พอใช้' : 'ต้องปรับปรุง'); }

  // ---------- ช่วงวันที่ ----------
  var TERM_START = '';
  getSiteSettings().then(function (s) { try { var sch = termScheduleOf(s), now = new Date(), md = pad(now.getMonth() + 1) + '-' + pad(now.getDate()), y = now.getFullYear(); TERM_START = md >= sch.term2Start ? y + '-' + sch.term2Start : (md >= sch.term1Start ? y + '-' + sch.term1Start : (y - 1) + '-' + sch.term2Start); } catch (e) { TERM_START = ''; } });
  function rangeOf() {
    var t = B ? B.today : ymd(new Date()), d = dP(t);
    if (st.range === 'today') return [t, t];
    if (st.range === 'week') { var m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [ymd(m), t]; }
    if (st.range === 'month') return [t.slice(0, 8) + '01', t];
    if (st.range === 'term') return [TERM_START && TERM_START <= t ? TERM_START : t.slice(0, 5) + '01-01', t];
    return [st.from || t, st.to || t];
  }

  // ---------- โหลด ----------
  async function boot() {
    try { B = await apiCall('careBoot', {}); } catch (e) { tabsEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    document.getElementById('ccIntro').textContent = 'ข้อมูลการมาสายและคะแนนพฤติกรรมจาก BNK Care Center · ภาคเรียนที่ ' + B.term + '/' + B.year;
    renderTabs(); show();
  }
  function renderTabs() {
    var t = [['overview', 'fa-chart-column', 'ภาพรวมการมาสาย'], ['frequent', 'fa-user-clock', 'นักเรียนที่สายบ่อย'], ['scores', 'fa-star', 'คะแนนพฤติกรรม']];
    if (B.role === 'm') t.push(['settings', 'fa-sliders', 'ตั้งค่า']);
    tabsEl.innerHTML = t.map(function (x) { return '<button type="button" class="tab-btn' + (x[0] === st.tab ? ' active' : '') + '" data-cc-tab="' + x[0] + '"><i class="fa-solid ' + x[1] + '" aria-hidden="true"></i> ' + x[2] + '</button>'; }).join('');
  }
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-cc-tab]'); if (!b) return; st.tab = b.getAttribute('data-cc-tab'); renderTabs(); show(); });
  function show() { if (st.tab === 'scores') return showScores(); if (st.tab === 'settings') return showSettings(); return showOverview(); }

  // ---------- ภาพรวม / สายบ่อย ----------
  function filterBar(extra) {
    var r = rangeOf(), seg = [['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['term', 'ภาคเรียนนี้'], ['custom', 'กำหนดเอง']];
    return '<div class="cc-flt"><div class="cc-seg">' + seg.map(function (x) { return '<button type="button" data-cc-rg="' + x[0] + '" class="' + (st.range === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (st.range === 'custom' ? '<input type="date" id="ccFrom" value="' + r[0] + '" max="' + B.today + '" /> – <input type="date" id="ccTo" value="' + r[1] + '" max="' + B.today + '" />' : '') +
      '<select id="ccGrade" aria-label="ระดับชั้น"><option value="">ทุกระดับชั้น</option>' + [1, 2, 3, 4, 5, 6].map(function (g) { return '<option value="m' + g + '"' + (st.grade === 'm' + g ? ' selected' : '') + '>ม.' + g + '</option>'; }).join('') + '</select>' + (extra || '') +
      '<span class="cc-sp"></span><span class="cc-rtxt">' + thD(r[0], true) + (r[0] !== r[1] ? ' – ' + thD(r[1], true) : '') + '</span>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-cc-print><i class="fa-solid fa-print" aria-hidden="true"></i> พิมพ์ / PDF</button>' +
      '<button type="button" class="btn btn-success btn-sm" data-cc-csv><i class="fa-solid fa-file-excel" aria-hidden="true"></i> Excel</button></div>';
  }
  async function loadOv() {
    var r = rangeOf(), k = r[0] + '|' + r[1] + '|' + st.grade;
    if (!C.ov[k]) C.ov[k] = await apiCall('careOverview', { from: r[0], to: r[1], grade: st.grade });
    return C.ov[k];
  }
  async function showOverview() {
    var freq = st.tab === 'frequent';
    body.innerHTML = filterBar(freq ? '<select id="ccMin" aria-label="จำนวนครั้ง">' + [2, 3, 5, 10].map(function (n) { return '<option value="' + n + '"' + (st.min === n ? ' selected' : '') + '>สาย ' + n + ' ครั้งขึ้นไป</option>'; }).join('') + '</select>' : '') + '<div id="ccOv"><div class="loading">กำลังโหลด...</div></div>';
    var box = document.getElementById('ccOv'), O;
    try { O = await loadOv(); } catch (e) { box.innerHTML = err(e.message); return; }
    if (freq) { box.innerHTML = freqHtml(O); return; }
    var mx = Math.max.apply(null, [1].concat(O.byDay.map(function (x) { return x.n; }))), rmx = Math.max.apply(null, [1].concat(O.reasons.map(function (x) { return x.n; })));
    var stat = function (t, v, c) { return '<div class="cc-st"><span>' + t + '</span><b' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</b></div>'; };
    var h = '<div class="cc-sts">' + stat('มาสายวันนี้', O.todayN) + stat('มาสายในช่วงที่เลือก (ครั้ง)', O.total) + stat('นักเรียนที่สาย (ไม่ซ้ำคน)', O.students) + stat('สาย ≥ ' + O.notifyN + ' ครั้งในเดือนนี้ (คน)', O.monthFreq, O.monthFreq ? '#b91c1c' : '') + '</div>';
    h += '<div class="cc-grid"><div class="card cc-card"><h3><i class="fa-solid fa-chart-column" aria-hidden="true"></i> จำนวนนักเรียนมาสายรายวัน</h3>' +
      (O.byDay.length ? '<div class="cc-bars">' + O.byDay.slice(-31).map(function (x) { var d = dP(x.date); return '<div title="' + thD(x.date, true) + ' · ' + x.n + ' คน"><em>' + x.n + '</em><i style="height:' + Math.max(4, Math.round(x.n / mx * 130)) + 'px"></i>' + DW[d.getDay()] + ' ' + d.getDate() + '</div>'; }).join('') + '</div>' : '<p class="hint">ไม่มีการมาสายในช่วงนี้</p>') +
      '<h3 style="margin-top:16px"><i class="fa-solid fa-door-open" aria-hidden="true"></i> รายห้อง</h3>' +
      (O.byRoom.length ? '<div class="cc-tw"><table class="cc-t"><thead><tr><th>ห้อง</th><th>มาสาย (ครั้ง)</th><th>นักเรียน (คน)</th><th>ครูที่ปรึกษา</th></tr></thead><tbody>' + O.byRoom.map(function (x) { return '<tr><td><b>' + esc(x.room) + '</b></td><td>' + x.n + '</td><td>' + x.s + '</td><td>' + esc((x.advisors || []).join(', ') || '-') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="hint">-</p>') + '</div>';
    h += '<div class="card cc-card"><h3><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> สายบ่อยในช่วงนี้</h3>' + freqTable(O.frequent.slice(0, 10)) +
      (O.frequent.length > 10 ? '<p class="hint"><a href="#" data-cc-go="frequent">ดูทั้งหมด ' + O.frequent.length + ' คน</a></p>' : '') +
      '<h3 style="margin-top:16px"><i class="fa-solid fa-list" aria-hidden="true"></i> สาเหตุ</h3>' +
      (O.reasons.length ? '<div class="cc-rs">' + O.reasons.sort(function (a, b) { return (a.reason ? 0 : 1) - (b.reason ? 0 : 1) || b.n - a.n; }).map(function (x) { return '<div><span' + (x.reason ? '' : ' class="mut"') + '>' + esc(x.reason || 'ไม่ระบุ') + '</span><i style="width:' + Math.max(3, Math.round(x.n / rmx * 100)) + '%;background:' + (REASON_C[x.reason] || '#94a3b8') + '"></i><b>' + x.n + '</b></div>'; }).join('') + '</div>' : '<p class="hint">-</p>') + '</div></div>';
    box.innerHTML = h;
  }
  function freqTable(list) {
    if (!list.length) return '<p class="hint">ไม่มีข้อมูล</p>';
    return '<div class="cc-tw"><table class="cc-t"><thead><tr><th>นักเรียน</th><th>ห้อง</th><th>ครั้ง</th><th>คะแนน</th></tr></thead><tbody>' + list.map(function (x) {
      return '<tr class="cc-click" data-cc-stu="' + esc(x.key) + '"><td>' + esc(x.name) + ' <small class="mut">เลขที่ ' + esc(x.no) + '</small></td><td>' + esc(x.room) + '</td><td><span class="cc-tg ' + (x.n >= 5 ? 'r' : (x.n >= 3 ? 'o' : 'n')) + '">' + x.n + '</span></td><td>' + x.score + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function freqHtml(O) {
    var list = O.frequent.filter(function (x) { return x.n >= st.min; });
    return '<div class="card cc-card"><h3><i class="fa-solid fa-user-clock" aria-hidden="true"></i> นักเรียนที่สาย ' + st.min + ' ครั้งขึ้นไป · ' + list.length + ' คน</h3><p class="hint">แตะชื่อเพื่อดูประวัติการมาสายและคะแนน</p>' + freqTable(list) + '</div>';
  }

  // ---------- คะแนนพฤติกรรม ----------
  async function showScores() {
    var k = st.room || 'all';
    body.innerHTML = '<div class="cc-flt"><select id="ccRoom" aria-label="ห้อง"><option value="">ทุกห้อง (คะแนนน้อยก่อน)</option></select><input type="search" id="ccQ" placeholder="ค้นหาชื่อ" value="' + esc(st.q) + '" />' +
      '<span class="cc-sp"></span><span class="cc-rtxt">' + esc(periodTxt()) + ' · เริ่มต้น ' + B.settings.startPoints + ' คะแนน · มาสาย −' + B.settings.latePoints + '/ครั้ง</span></div><div id="ccSc"><div class="loading">กำลังโหลด...</div></div>';
    var box = document.getElementById('ccSc'), S;
    try { if (!C.sc[k]) C.sc[k] = await apiCall('careScores', { roomId: st.room }); S = C.sc[k]; } catch (e) { box.innerHTML = err(e.message); return; }
    document.getElementById('ccRoom').innerHTML = '<option value="">ทุกห้อง (คะแนนน้อยก่อน)</option>' + S.rooms.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === st.room ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('');
    renderScores();
  }
  // รอบคะแนนที่ใช้อยู่ (จากเซิร์ฟเวอร์) — เลือกห้อง = รอบของชั้นนั้น · ทุกห้อง = รอบเดียวกันหรือ "ตามรอบของแต่ละชั้น"
  function periodTxt() {
    var P = B.periods || {}, g = /^m(\d)/.exec(st.room || ''), v = Object.keys(P).map(function (k) { return P[k]; });
    if (g) return 'นับ ' + (P['m' + g[1]] || '');
    return v.length && v.every(function (x) { return x === v[0]; }) ? 'นับ ' + v[0] : 'นับตามรอบของแต่ละชั้น';
  }
  function renderScores() {
    var S = C.sc[st.room || 'all'], box = document.getElementById('ccSc'); if (!S || !box) return;
    var L = S.list.filter(function (x) { return !st.q || x.name.indexOf(st.q) !== -1; });
    if (!st.room) L = L.slice().sort(function (a, b) { return a.score - b.score || a.room.localeCompare(b.room) || a.no - b.no; });
    var cnt = { good: 0, fair: 0, low: 0 }; S.list.forEach(function (x) { cnt[x.level]++; });
    var tot = L.length; L = L.slice(0, st.room ? 200 : 150);
    box.innerHTML = '<div class="cc-sts">' + [['ดี (≥ ' + S.settings.good + ')', cnt.good, '#15803d'], ['พอใช้', cnt.fair, '#c2410c'], ['ต้องปรับปรุง (< ' + S.settings.fair + ')', cnt.low, '#b91c1c'], ['นักเรียนทั้งหมด', S.list.length, '']].map(function (x) { return '<div class="cc-st"><span>' + x[0] + '</span><b' + (x[2] ? ' style="color:' + x[2] + '"' : '') + '>' + x[1] + '</b></div>'; }).join('') + '</div>' +
      '<div class="card cc-card"><div class="cc-tw"><table class="cc-t"><thead><tr>' + (st.room ? '<th>เลขที่</th>' : '<th>ห้อง</th>') + '<th>ชื่อ</th><th>มาสาย</th><th>ครูเพิ่ม/หัก</th><th>คะแนน</th></tr></thead><tbody>' +
      L.map(function (x) { return '<tr class="cc-click" data-cc-stu="' + esc(x.key) + '"><td>' + esc(st.room ? x.no : x.room) + '</td><td>' + esc(x.name) + (st.room ? '' : ' <small class="mut">เลขที่ ' + esc(x.no) + '</small>') + '</td><td>' + (x.late || '-') + '</td><td>' + (x.adj ? (x.adj > 0 ? '+' : '') + x.adj : '-') + '</td><td><span class="cc-tg ' + lvCls(x.level) + '">' + x.score + '</span></td></tr>'; }).join('') +
      '</tbody></table></div>' + (tot > L.length ? '<p class="hint">แสดง ' + L.length + ' จาก ' + tot + ' คน — เลือกห้องหรือค้นหาชื่อเพื่อดูคนอื่น</p>' : '') +
      '<p class="hint"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> เพิ่ม/หักคะแนนทำได้ที่ BNK Care Center แท็บ "คะแนน" (เข้าสู่ระบบด้วยบัญชีเว็บส่งงาน)</p></div>';
  }
  async function openStudent(key) {
    document.getElementById('ccModalTitle').innerHTML = '<i class="fa-solid fa-user" aria-hidden="true"></i> ประวัตินักเรียน';
    var mb = document.getElementById('ccModalBody'); mb.innerHTML = '<div class="loading">กำลังโหลด...</div>'; showModalEl(document.getElementById('ccModal'));
    try {
      var d = await apiCall('careStudent', { key: key });
      mb.innerHTML = '<div class="cc-stu"><div class="cc-ring ' + lvCls(d.level) + '"><b>' + d.score + '</b><small>คะแนน</small></div><div><b style="font-size:1.1rem">' + esc(d.student.name) + '</b><div class="mut">' + esc(d.student.room) + ' เลขที่ ' + esc(d.student.no) + ' · ' + esc(d.period || ('ภาคเรียนที่ ' + d.term + '/' + d.year)) + '</div><span class="cc-tg ' + lvCls(d.level) + '">ระดับ ' + lvTxt(d.level) + '</span> <span class="cc-tg n">มาสาย ' + d.late + ' ครั้ง</span></div></div>' +
        (d.hist.length ? '<div class="cc-hist">' + d.hist.map(function (h) { return '<div><span class="cc-pt ' + (h.delta < 0 ? 'm' : 'p') + '">' + (h.delta > 0 ? '+' : '') + h.delta + '</span><span>' + (h.kind === 'late' ? 'มาสาย ' + esc(h.time || '') + (h.reason ? ' (' + esc(h.reason) + ')' : '') : esc(h.item) + (h.note ? ' — ' + esc(h.note) : '')) + '<small>' + thD(h.date, true) + ' · ' + (h.kind === 'late' ? 'บันทึกโดย ' + esc(h.by || '-') : 'โดย ' + esc(h.by || '-')) + '</small></span></div>'; }).join('') + '</div>' : '<p class="hint">ยังไม่มีประวัติในรอบนี้</p>');
    } catch (e) { mb.innerHTML = err(e.message); }
  }

  // ---------- ตั้งค่า (สิทธิ์จัดการ) ----------
  var draft = null;
  function showSettings() {
    var s = B.settings; draft = draft || { pinOn: s.pinOn, pin: '', notifyOn: s.notifyOn, notifyN: s.notifyN, startPoints: s.startPoints, latePoints: s.latePoints, good: s.good, fair: s.fair, items: (s.items || []).map(function (x) { return { label: x.label, delta: x.delta }; }), siteUrl: B.siteUrl, cycle: JSON.parse(JSON.stringify(s.cycle || { mode: 'all', all: 'term', g: {} })) };
    var d = draft, sw = function (id, on) { return '<input type="checkbox" class="switch" role="switch" id="' + id + '"' + (on ? ' checked' : '') + ' />'; };
    body.innerHTML = '<div class="cc-grid2"><div class="card cc-card"><h3><i class="fa-solid fa-key" aria-hidden="true"></i> การเข้าใช้ส่วนบันทึกมาสาย (สภานักเรียน)</h3>' +
      '<label class="cc-row">' + sw('ccPinOn', d.pinOn) + '<b>ใช้รหัส PIN</b></label>' + (!d.pinOn ? '<div class="cc-warn"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i> ปิด PIN = ใครมีลิงก์ก็บันทึกได้ และเห็นรายชื่อนักเรียนทั้งโรงเรียน</div>' : '') +
      '<div class="cc-row"><span class="cc-lb">รหัส PIN ใหม่ (4–6 หลัก)</span><input id="ccPin" inputmode="numeric" maxlength="6" placeholder="' + (s.pinSet ? 'ตั้งไว้แล้ว — ใส่เมื่อต้องการเปลี่ยน' : 'ยังไม่ได้ตั้ง') + '" value="' + esc(d.pin) + '" autocomplete="off" /></div>' +
      '<p class="hint">เปลี่ยนรหัส = ทุกเครื่องต้องใส่รหัสใหม่ · ใส่ผิดเกินกำหนด ระบบพัก 15 นาที · แนะนำ 6 หลัก</p>' +
      '<h3 style="margin-top:14px"><i class="fa-solid fa-bell" aria-hidden="true"></i> แจ้งเตือนครูที่ปรึกษา</h3><div class="cc-row">' + sw('ccNotifyOn', d.notifyOn) + '<span>แจ้งผ่านกระดิ่งเมื่อนักเรียนสายครบ</span><input id="ccNotifyN" type="number" min="1" max="31" class="cc-num" value="' + d.notifyN + '" /><span>ครั้ง / เดือน</span></div>' +
      '<p class="hint">แจ้งครั้งเดียวต่อนักเรียนต่อเดือน · ครูที่ปรึกษาต้องผูกบัญชีกับเว็บเช็คชื่อไว้แล้ว</p>' +
      '<h3 style="margin-top:14px"><i class="fa-solid fa-link" aria-hidden="true"></i> ลิงก์ BNK Care Center</h3><div class="cc-row"><input id="ccSite" value="' + esc(d.siteUrl) + '" style="flex:1" /><button type="button" class="btn btn-secondary btn-sm" data-cc-copy><i class="fa-solid fa-copy" aria-hidden="true"></i> คัดลอก</button><button type="button" class="btn btn-secondary btn-sm" data-cc-qr><i class="fa-solid fa-qrcode" aria-hidden="true"></i> QR</button></div><div id="ccQr" class="cc-qr" hidden></div></div>' +
      '<div class="card cc-card"><h3><i class="fa-solid fa-star" aria-hidden="true"></i> คะแนนพฤติกรรม</h3>' +
      '<div class="cc-row"><span class="cc-lb">คะแนนเริ่มต้น</span><input id="ccStart" type="number" min="0" max="1000" class="cc-num" value="' + d.startPoints + '" /></div>' +
      cycleHtml(d.cycle) +
      '<div class="cc-row"><span class="cc-lb">มาสาย หักอัตโนมัติ</span><input id="ccLate" type="number" min="0" max="50" class="cc-num" value="' + d.latePoints + '" /><span>คะแนน / ครั้ง</span></div>' +
      '<div class="cc-row"><span class="cc-lb">ระดับ</span><span class="cc-tg g">ดี ≥</span><input id="ccGood" type="number" class="cc-num" value="' + d.good + '" /><span class="cc-tg o">พอใช้ ≥</span><input id="ccFair" type="number" class="cc-num" value="' + d.fair + '" /><span class="cc-tg r">ต่ำกว่านั้น = ต้องปรับปรุง</span></div>' +
      '<h3 style="margin-top:14px"><i class="fa-solid fa-list-check" aria-hidden="true"></i> รายการเพิ่ม / หักคะแนน (ครูเลือกตอนบันทึก)</h3><div id="ccItems">' + d.items.map(function (x, i) { return '<div class="cc-it"><input type="number" class="cc-num" data-cc-it-d="' + i + '" value="' + x.delta + '" /><input data-cc-it-l="' + i + '" value="' + esc(x.label) + '" placeholder="ชื่อเรื่อง" /><button type="button" class="cc-x" data-cc-it-del="' + i + '" aria-label="ลบ"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button></div>'; }).join('') + '</div>' +
      '<div class="cc-row"><button type="button" class="btn btn-secondary btn-sm" data-cc-it-add><i class="fa-solid fa-plus" aria-hidden="true"></i> เพิ่มรายการ</button><span class="hint" style="margin:0">ติดลบ = หักคะแนน · บวก = เพิ่มคะแนน · ครูพิมพ์เรื่องอื่นเองได้ตอนบันทึก</span></div></div></div>' +
      '<div class="cc-actions"><button type="button" class="btn btn-success" data-cc-save><i class="fa-solid fa-check" aria-hidden="true"></i> บันทึกการตั้งค่า</button></div>';
  }
  var CYC = [['term', 'ทุกภาคเรียน'], ['year', 'ทุกปีการศึกษา'], ['stage', 'ทุกช่วงชั้น 3 ปี']];
  function cycOpts(id, v) { return '<select id="' + id + '" class="cc-cyc">' + CYC.map(function (x) { return '<option value="' + x[0] + '"' + (v === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'; }
  function cycLabel(v, g) { // ตัวอย่างช่วงที่นับ (ตามภาคเรียน/ปีปัจจุบัน)
    var y = +B.year || 0;
    if (v === 'stage') { if (!g) return 'ม.1–3 นับตั้งแต่ขึ้น ม.1 · ม.4–6 นับตั้งแต่ขึ้น ม.4'; var f = y - ((g - 1) % 3); return (g <= 3 ? 'ม.ต้น' : 'ม.ปลาย') + ' ' + f + '–' + (f + 2); }
    return v === 'year' ? 'ปีการศึกษา ' + B.year : 'ภาคเรียนที่ ' + B.term + '/' + B.year;
  }
  function cycleHtml(c) {
    var gv = function (i) { return (c.g || {})['m' + i] || c.all || 'term'; };
    return '<div class="cc-row"><span class="cc-lb">เริ่มนับคะแนนใหม่</span><div class="cc-seg">' + [['all', 'เหมือนกันทุกชั้น'], ['grade', 'แยกตามระดับชั้น']].map(function (x) { return '<button type="button" data-cc-cm="' + x[0] + '" class="' + ((c.mode || 'all') === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
      (c.mode === 'grade'
        ? '<div class="cc-cg">' + [1, 2, 3, 4, 5, 6].map(function (i) { return '<label><b>ม.' + i + '</b>' + cycOpts('ccCyc' + i, gv(i)) + '<small>' + esc(cycLabel(gv(i), i)) + '</small></label>'; }).join('') + '</div>'
        : '<div class="cc-row">' + cycOpts('ccCycAll', c.all || 'term') + '<span class="hint" style="margin:0">' + esc(cycLabel(c.all || 'term', 0)) + '</span></div>') +
      '<p class="hint">ข้อมูลเดิมไม่ถูกลบ — เปลี่ยนแบบเมื่อไรคะแนนคิดใหม่ทันที · แบบ 3 ปีต่อคะแนนข้ามปีด้วยรหัสนักเรียนในเว็บเช็คชื่อ</p>';
  }
  function syncDraft() {
    var d = draft, v = function (id) { var e = document.getElementById(id); return e ? e.value : ''; }, c = function (id) { var e = document.getElementById(id); return !!(e && e.checked); };
    d.pinOn = c('ccPinOn'); d.pin = v('ccPin').replace(/\D/g, ''); d.notifyOn = c('ccNotifyOn'); d.notifyN = +v('ccNotifyN') || 3; d.startPoints = +v('ccStart') || 0; d.latePoints = +v('ccLate') || 0; d.good = +v('ccGood') || 0; d.fair = +v('ccFair') || 0; d.siteUrl = v('ccSite');
    var cy = d.cycle; if (document.getElementById('ccCycAll')) cy.all = v('ccCycAll');
    cy.g = cy.g || {}; for (var i = 1; i <= 6; i++) { if (document.getElementById('ccCyc' + i)) cy.g['m' + i] = v('ccCyc' + i); else cy.g['m' + i] = cy.g['m' + i] || cy.all; }
    document.querySelectorAll('[data-cc-it-l]').forEach(function (e) { d.items[+e.getAttribute('data-cc-it-l')].label = e.value; });
    document.querySelectorAll('[data-cc-it-d]').forEach(function (e) { d.items[+e.getAttribute('data-cc-it-d')].delta = Math.trunc(+e.value || 0); });
  }

  // ---------- เหตุการณ์ ----------
  body.addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-cc-rg]'))) { st.range = t.getAttribute('data-cc-rg'); show(); return; }
    if ((t = e.target.closest('[data-cc-go]'))) { e.preventDefault(); st.tab = t.getAttribute('data-cc-go'); renderTabs(); show(); return; }
    if ((t = e.target.closest('[data-cc-stu]'))) { openStudent(t.getAttribute('data-cc-stu')); return; }
    if (e.target.closest('[data-cc-print]')) { window.print(); return; }
    if (e.target.closest('[data-cc-csv]')) { exportCsv(); return; }
    if ((t = e.target.closest('[data-cc-cm]'))) { syncDraft(); var m = t.getAttribute('data-cc-cm'); if (m === 'grade' && draft.cycle.mode !== 'grade') { for (var i = 1; i <= 6; i++) draft.cycle.g['m' + i] = draft.cycle.all || 'term'; } draft.cycle.mode = m; showSettings(); return; }
    if (e.target.closest('[data-cc-it-add]')) { syncDraft(); draft.items.push({ label: '', delta: -5 }); showSettings(); return; }
    if ((t = e.target.closest('[data-cc-it-del]'))) { syncDraft(); draft.items.splice(+t.getAttribute('data-cc-it-del'), 1); showSettings(); return; }
    if (e.target.closest('[data-cc-copy]')) { syncDraft(); try { await navigator.clipboard.writeText(draft.siteUrl); showToast('คัดลอกลิงก์แล้ว'); } catch (x) { showToast('คัดลอกไม่สำเร็จ', true); } return; }
    if (e.target.closest('[data-cc-qr]')) { syncDraft(); var q = document.getElementById('ccQr'); q.hidden = !q.hidden; q.innerHTML = ''; if (!q.hidden) { try { qrLogo(q, draft.siteUrl, 180); } catch (x) { q.textContent = 'สร้าง QR ไม่ได้'; } } return; }
    if (e.target.closest('[data-cc-save]')) {
      syncDraft(); var d = draft;
      if (d.pin && !/^\d{4,6}$/.test(d.pin)) { showToast('รหัส PIN ต้องเป็นตัวเลข 4–6 หลัก', true); return; }
      if (d.pinOn && !d.pin && !B.settings.pinSet) { showToast('ตั้งรหัส PIN ก่อนเปิดใช้', true); return; }
      var items = d.items.filter(function (x) { return String(x.label).trim() && x.delta; });
      var go = async function () {
        var r = await withProgress('กำลังบันทึกการตั้งค่า', function () { return apiCall('careSettingsSave', { pinOn: d.pinOn, pin: d.pin || undefined, notifyOn: d.notifyOn, notifyN: d.notifyN, startPoints: d.startPoints, latePoints: d.latePoints, good: d.good, fair: d.fair, items: items, cycle: d.cycle, siteUrl: d.siteUrl }); }, { successLabel: 'บันทึกการตั้งค่าแล้ว' });
        if (r.ok) { B.settings = r.data.settings; B.periods = r.data.periods || B.periods; B.siteUrl = r.data.siteUrl; draft = null; C.sc = {}; C.ov = {}; showSettings(); }
      };
      if (!d.pinOn && B.settings.pinOn) askConfirm('ปิดรหัส PIN', 'ปิดแล้ว ใครมีลิงก์ก็เปิดเว็บ เห็นรายชื่อนักเรียนทั้งโรงเรียน และบันทึกการมาสายได้ — ยืนยันปิดหรือไม่?', go); else go();
    }
  });
  body.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'ccGrade') { st.grade = e.target.value; show(); }
    else if (id === 'ccFrom' || id === 'ccTo') { var a = document.getElementById('ccFrom').value, b = document.getElementById('ccTo').value; if (a && b && a <= b) { st.from = a; st.to = b; show(); } }
    else if (id === 'ccMin') { st.min = +e.target.value; show(); }
    else if (id === 'ccRoom') { st.room = e.target.value; showScores(); }
    else if (id === 'ccPinOn' || /^ccCyc/.test(id)) { syncDraft(); showSettings(); }
  });
  body.addEventListener('input', debounce(function (e) { if (e.target.id === 'ccQ') { st.q = e.target.value.trim(); renderScores(); } }, 200));
  document.getElementById('ccModal').addEventListener('click', function (e) { if (e.target.closest('[data-cc-close]')) hideModalEl(document.getElementById('ccModal')); });
  async function exportCsv() {
    var r = rangeOf();
    var res = await withProgress('กำลังเตรียมไฟล์', function () { return apiCall('careExport', { from: r[0], to: r[1] }); }, { successLabel: 'ดาวน์โหลดแล้ว' });
    if (!res.ok) return;
    var rows = res.data.records.filter(function (x) { return !st.grade || String(x.roomId).indexOf(st.grade + '_') === 0; });
    var c = function (s) { s = String(s == null ? '' : s); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    var data = '﻿' + ['วันที่,ห้อง,เลขที่,รหัสนักเรียน,ชื่อ-นามสกุล,เวลา,สาเหตุ,ผู้บันทึก'].concat(rows.map(function (x) { return [x.date, x.room, x.no, x.code, x.name, x.time, x.reason, x.by].map(c).join(','); })).join('\n');
    var u = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' })), a = document.createElement('a');
    a.href = u; a.download = 'มาสาย_' + r[0] + '_' + r[1] + (st.grade ? '_ม' + st.grade.slice(1) : '') + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 1000);
  }
  boot();
})();
