/* กิจการนักเรียน (2.03.0 / 2.04.0) — หน้า care.html · ข้อมูลจาก BNK Care Center (Worker แยก) ผ่าน Worker ของเว็บส่งงาน
 * แท็บ: สรุปรวม · สรุปรายห้อง · นักเรียนที่สายบ่อย · คะแนนพฤติกรรม · ตั้งค่า (สิทธิ์จัดการ)
 * 2.04.0: สรุปรายห้อง (กดดูรายคน) · ส่งออก PDF / รูปภาพ / Excel ทุกแท็บสรุป · ตั้งค่ารายการที่ครูทั่วไปใช้ได้ · ครูที่ปรึกษาดูคะแนนห้องตัวเอง
 *        · สมาชิกสภานักเรียน · หน้านักเรียนแจ้งมาสายเอง (ช่วงเวลา + ตัวเลือกเหตุผล) · ลิงก์ + QR ทั้ง 3 หน้า
 * ประหยัด: โหลดเมื่อเปิดแท็บ/เปลี่ยนช่วง · จำผลไว้ในหน้า (ไม่โหลดซ้ำเมื่อสลับแท็บกลับมา) · ส่งออกสร้างในเครื่องจากข้อมูลที่โหลดแล้ว */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('care'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('ccBody'), tabsEl = document.getElementById('ccTabs');
  var B = null, st = { tab: 'overview', range: 'week', from: '', to: '', grade: '', min: 3, room: '', q: '', rroom: '' }, C = { ov: {}, sc: {}, rm: {}, rd: {} }, ROSTER = null;
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], DW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var PAL = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dP(s) { var p = String(s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function thD(s, y) { var d = dP(s); return d.getDate() + ' ' + MS[d.getMonth()] + (y ? ' ' + (d.getFullYear() + 543) : ''); }
  function err(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function lvCls(lv) { return lv === 'good' ? 'g' : (lv === 'fair' ? 'o' : 'r'); }
  function lvTxt(lv) { return lv === 'good' ? 'ดี' : (lv === 'fair' ? 'พอใช้' : 'ต้องปรับปรุง'); }
  function sgn(n) { return n > 0 ? '+' + n : String(n); }
  function ic(n) { return '<i class="fa-solid ' + n + '" aria-hidden="true"></i>'; }

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
  function rangeTxt() { var r = rangeOf(); return thD(r[0], true) + (r[0] !== r[1] ? ' – ' + thD(r[1], true) : ''); }

  // ---------- โหลด ----------
  async function boot() {
    try { B = await apiCall('careBoot', {}); } catch (e) { tabsEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    document.getElementById('ccIntro').textContent = 'ข้อมูลการมาสายและคะแนนพฤติกรรมจาก BNK Care Center · ภาคเรียนที่ ' + B.term + '/' + B.year;
    renderTabs(); show();
  }
  function renderTabs() {
    var t = [['overview', 'fa-chart-column', 'สรุปรวม'], ['rooms', 'fa-door-open', 'สรุปรายห้อง'], ['frequent', 'fa-user-clock', 'นักเรียนที่สายบ่อย'], ['scores', 'fa-star', 'คะแนนพฤติกรรม']];
    if (B.role === 'm') t.push(['settings', 'fa-sliders', 'ตั้งค่า']);
    tabsEl.innerHTML = t.map(function (x) { return '<button type="button" class="tab-btn' + (x[0] === st.tab ? ' active' : '') + '" data-cc-tab="' + x[0] + '">' + ic(x[1]) + ' ' + x[2] + '</button>'; }).join('');
  }
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-cc-tab]'); if (!b) return; st.tab = b.getAttribute('data-cc-tab'); renderTabs(); show(); });
  function show() { if (st.tab === 'scores') return showScores(); if (st.tab === 'settings') return showSettings(); if (st.tab === 'rooms') return showRooms(); return showOverview(); }

  // ---------- แถบตัวกรอง + ปุ่มส่งออก ----------
  function exportBtns() {
    return '<span class="cc-ex"><button type="button" class="btn btn-sm cc-ex-pdf" data-cc-ex="pdf">' + ic('fa-file-pdf') + ' PDF</button>' +
      '<button type="button" class="btn btn-sm cc-ex-img" data-cc-ex="img">' + ic('fa-image') + ' รูปภาพ</button>' +
      '<button type="button" class="btn btn-sm btn-success" data-cc-ex="xls">' + ic('fa-file-excel') + ' Excel</button></span>';
  }
  function filterBar(extra, noRange) {
    var r = rangeOf(), seg = [['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['term', 'ภาคเรียนนี้'], ['custom', 'กำหนดเอง']];
    return '<div class="cc-flt">' + (noRange ? '' : '<div class="cc-seg">' + seg.map(function (x) { return '<button type="button" data-cc-rg="' + x[0] + '" class="' + (st.range === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (st.range === 'custom' ? '<input type="date" id="ccFrom" value="' + r[0] + '" max="' + B.today + '" /> – <input type="date" id="ccTo" value="' + r[1] + '" max="' + B.today + '" />' : '')) +
      '<select id="ccGrade" aria-label="ระดับชั้น"><option value="">ทุกระดับชั้น</option>' + [1, 2, 3, 4, 5, 6].map(function (g) { return '<option value="m' + g + '"' + (st.grade === 'm' + g ? ' selected' : '') + '>ม.' + g + '</option>'; }).join('') + '</select>' + (extra || '') +
      '<span class="cc-sp"></span>' + (noRange ? '' : '<span class="cc-rtxt">' + rangeTxt() + '</span>') + exportBtns() + '</div>';
  }
  function capHead(title) { // หัวกระดาษ (แสดงเฉพาะตอนส่งออก/พิมพ์)
    return '<div class="cc-caphead"><b>' + esc(title) + '</b><span>โรงเรียนบุ่งคล้านคร · ' + (st.tab === 'scores' ? esc(periodTxt()) : 'ช่วงวันที่ ' + rangeTxt()) + (st.grade ? ' · ม.' + st.grade.slice(1) : '') + '</span></div>';
  }

  // ---------- สรุปรวม / สายบ่อย ----------
  async function loadOv() {
    var r = rangeOf(), k = r[0] + '|' + r[1] + '|' + st.grade;
    if (!C.ov[k]) C.ov[k] = await apiCall('careOverview', { from: r[0], to: r[1], grade: st.grade });
    return C.ov[k];
  }
  function stat(t, v, c, sub) { return '<div class="cc-st"><span>' + t + '</span><b' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  async function showOverview() {
    var freq = st.tab === 'frequent';
    body.innerHTML = filterBar(freq ? '<select id="ccMin" aria-label="จำนวนครั้ง">' + [2, 3, 5, 10].map(function (n) { return '<option value="' + n + '"' + (st.min === n ? ' selected' : '') + '>สาย ' + n + ' ครั้งขึ้นไป</option>'; }).join('') + '</select>' : '') + '<div id="ccOv" class="cc-cap"><div class="loading">กำลังโหลด...</div></div>';
    var box = document.getElementById('ccOv'), O;
    try { O = await loadOv(); } catch (e) { box.innerHTML = err(e.message); return; }
    if (st.tab !== (freq ? 'frequent' : 'overview')) return;
    if (freq) { box.innerHTML = capHead('นักเรียนที่สาย ' + st.min + ' ครั้งขึ้นไป') + freqHtml(O); return; }
    var mx = Math.max.apply(null, [1].concat(O.byDay.map(function (x) { return x.n; }))), rmx = Math.max.apply(null, [1].concat(O.reasons.map(function (x) { return x.n; })));
    var S = O.score || { avg: 0, n: 0, levels: { good: 0, fair: 0, low: 0 } }, A = O.adj || { minus: 0, plus: 0, count: 0 }, ST = O.settings || B.settings;
    var gr = {}; O.byRoom.forEach(function (x) { var g = /^m(\d)/.exec(x.roomId); g = g ? 'ม.' + g[1] : '-'; gr[g] = (gr[g] || 0) + x.n; });
    var gk = Object.keys(gr).sort(), gmx = Math.max.apply(null, [1].concat(gk.map(function (k) { return gr[k]; })));
    var pct = function (n) { return S.n ? Math.round(n / S.n * 100) + '%' : '-'; };
    var h = capHead('สรุปการมาสายและคะแนนพฤติกรรม') +
      '<div class="cc-sts">' + stat('มาสายวันนี้', O.todayN) + stat('มาสายในช่วงที่เลือก (ครั้ง)', O.total, '', O.selfN ? 'นักเรียนแจ้งเอง ' + O.selfN + ' ครั้ง' : '') + stat('นักเรียนที่สาย (ไม่ซ้ำคน)', O.students) + stat('สาย ≥ ' + O.notifyN + ' ครั้งในเดือนนี้ (คน)', O.monthFreq, O.monthFreq ? '#b91c1c' : '') + '</div>' +
      '<div class="cc-sts">' + stat('คะแนนเฉลี่ย (' + S.n + ' คน)', S.avg, '#15803d', 'เริ่มต้น ' + ST.startPoints + ' คะแนน') +
      stat('ระดับ ดี / พอใช้ / ต้องปรับปรุง', '<span style="color:#15803d">' + S.levels.good + '</span> / <span style="color:#c2410c">' + S.levels.fair + '</span> / <span style="color:#b91c1c">' + S.levels.low + '</span>', '', 'ดี ' + pct(S.levels.good) + ' ของนักเรียน') +
      stat('ครูหักคะแนนรวม', A.minus, A.minus ? '#b91c1c' : '', A.count + ' รายการในช่วงที่เลือก') + stat('ครูเพิ่มคะแนนรวม', sgn(A.plus), A.plus ? '#15803d' : '') + '</div>';
    h += '<div class="cc-grid"><div class="card cc-card"><h3>' + ic('fa-chart-column') + ' จำนวนนักเรียนมาสายรายวัน</h3>' +
      (O.byDay.length ? '<div class="cc-bars">' + O.byDay.slice(-31).map(function (x) { var d = dP(x.date); return '<div title="' + thD(x.date, true) + ' · ' + x.n + ' คน"><em>' + x.n + '</em><i style="height:' + Math.max(4, Math.round(x.n / mx * 130)) + 'px"></i>' + DW[d.getDay()] + ' ' + d.getDate() + '</div>'; }).join('') + '</div>' : '<p class="hint">ไม่มีการมาสายในช่วงนี้</p>') +
      '<h3 style="margin-top:16px">' + ic('fa-layer-group') + ' มาสายรายระดับชั้น</h3>' +
      (gk.length ? '<div class="cc-rs cc-gb">' + gk.map(function (k) { return '<div><span>' + esc(k) + '</span><i style="width:' + Math.max(3, Math.round(gr[k] / gmx * 100)) + '%;background:#c8102e"></i><b>' + gr[k] + '</b></div>'; }).join('') + '</div>' : '<p class="hint">-</p>') +
      '<p class="hint"><a href="#" data-cc-go="rooms">' + ic('fa-door-open') + ' ดูสรุปรายห้อง</a></p></div>';
    h += '<div class="card cc-card"><h3>' + ic('fa-triangle-exclamation') + ' สายบ่อยในช่วงนี้</h3>' + freqTable(O.frequent.slice(0, 10)) +
      (O.frequent.length > 10 ? '<p class="hint"><a href="#" data-cc-go="frequent">ดูทั้งหมด ' + O.frequent.length + ' คน</a></p>' : '') +
      '<h3 style="margin-top:16px">' + ic('fa-list') + ' สาเหตุ</h3>' +
      (O.reasons.length ? '<div class="cc-rs">' + O.reasons.slice().sort(function (a, b) { return (a.reason ? 0 : 1) - (b.reason ? 0 : 1) || b.n - a.n; }).map(function (x, i) { return '<div><span' + (x.reason ? '' : ' class="mut"') + '>' + esc(x.reason || 'ไม่ระบุ') + '</span><i style="width:' + Math.max(3, Math.round(x.n / rmx * 100)) + '%;background:' + (x.reason ? PAL[i % PAL.length] : '#cbd5e1') + '"></i><b>' + x.n + '</b></div>'; }).join('') + '</div>' : '<p class="hint">-</p>') + '</div></div>';
    box.innerHTML = h;
  }
  function freqTable(list) {
    if (!list.length) return '<p class="hint">ไม่มีข้อมูล</p>';
    return '<div class="cc-tw"><table class="cc-t"><thead><tr><th>นักเรียน</th><th>ห้อง</th><th>ครั้ง</th><th>คะแนน</th></tr></thead><tbody>' + list.map(function (x) {
      return '<tr class="cc-click" data-cc-stu="' + esc(x.key) + '"><td>' + esc(x.name) + ' <small class="mut">เลขที่ ' + esc(x.no) + '</small></td><td>' + esc(x.room) + '</td><td><span class="cc-tg ' + (x.n >= 5 ? 'r' : (x.n >= 3 ? 'o' : 'n')) + '">' + x.n + '</span></td><td>' + x.score + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function freqList(O) { return O.frequent.filter(function (x) { return x.n >= st.min; }); }
  function freqHtml(O) {
    var list = freqList(O);
    return '<div class="card cc-card"><h3>' + ic('fa-user-clock') + ' นักเรียนที่สาย ' + st.min + ' ครั้งขึ้นไป · ' + list.length + ' คน</h3><p class="hint cc-noexp">แตะชื่อเพื่อดูประวัติการมาสายและคะแนน</p>' + freqTable(list) + '</div>';
  }

  // ---------- 2.04.0: สรุปรายห้อง ----------
  async function showRooms() {
    var r = rangeOf();
    body.innerHTML = filterBar('') + '<div id="ccRm" class="cc-cap"><div class="loading">กำลังโหลด...</div></div>';
    var box = document.getElementById('ccRm');
    try {
      if (st.rroom) { var k = r[0] + '|' + r[1] + '|' + st.rroom; if (!C.rd[k]) C.rd[k] = await apiCall('careRoomDetail', { from: r[0], to: r[1], roomId: st.rroom }); if (st.tab === 'rooms') box.innerHTML = roomDetailHtml(C.rd[k]); return; }
      var k2 = r[0] + '|' + r[1]; if (!C.rm[k2]) C.rm[k2] = await apiCall('careRooms', { from: r[0], to: r[1] });
      if (st.tab === 'rooms') box.innerHTML = roomsHtml(C.rm[k2]);
    } catch (e) { box.innerHTML = err(e.message); }
  }
  function roomsList(R) { return R.rooms.filter(function (x) { return !st.grade || x.roomId.indexOf(st.grade + '_') === 0; }); }
  function lvPills(lv) { return '<span class="cc-lv g">' + lv.good + '</span><span class="cc-lv o">' + lv.fair + '</span><span class="cc-lv r">' + lv.low + '</span>'; }
  function roomsHtml(R) {
    var L = roomsList(R), T = { total: 0, late: 0, lateStu: 0, minus: 0, plus: 0, sum: 0, lv: { good: 0, fair: 0, low: 0 } };
    L.forEach(function (x) { T.total += x.total; T.late += x.late; T.lateStu += x.lateStu; T.minus += x.minus; T.plus += x.plus; T.sum += x.avg * x.total; ['good', 'fair', 'low'].forEach(function (k) { T.lv[k] += x.levels[k]; }); });
    return capHead('สรุปรายห้อง') + '<div class="card cc-card"><div class="cc-tw"><table class="cc-t cc-rt"><thead><tr><th>ห้อง</th><th>ครูที่ปรึกษา</th><th>นักเรียน</th><th>มาสาย (ครั้ง)</th><th>มาสาย (คน)</th><th>หักคะแนน</th><th>เพิ่มคะแนน</th><th>คะแนนเฉลี่ย</th><th>ดี / พอใช้ / ปรับปรุง</th></tr></thead><tbody>' +
      L.map(function (x) {
        return '<tr class="cc-click" data-cc-room="' + esc(x.roomId) + '"><td><b>' + esc(x.room) + '</b></td><td>' + esc((x.advisors || []).join(', ') || '-') + '</td><td>' + x.total + '</td><td>' + (x.late || '-') + '</td><td>' + (x.lateStu || '-') + '</td>' +
          '<td class="cc-m">' + (x.minus || '-') + '</td><td class="cc-p">' + (x.plus ? '+' + x.plus : '-') + '</td><td><b>' + x.avg + '</b></td><td>' + lvPills(x.levels) + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td><b>รวม ' + L.length + ' ห้อง</b></td><td></td><td>' + T.total + '</td><td>' + T.late + '</td><td>' + T.lateStu + '</td><td class="cc-m">' + T.minus + '</td><td class="cc-p">+' + T.plus + '</td><td><b>' + (T.total ? Math.round(T.sum / T.total * 10) / 10 : 0) + '</b></td><td>' + lvPills(T.lv) + '</td></tr></tfoot></table></div>' +
      '<p class="hint cc-noexp">' + ic('fa-hand-pointer') + ' กดที่ห้องเพื่อดูรายคน · มาสาย/หัก/เพิ่ม = ในช่วงวันที่ที่เลือก · คะแนนเฉลี่ยและระดับ = รอบคะแนนปัจจุบัน · ระดับ ดี ≥ ' + R.settings.good + ' · พอใช้ ≥ ' + R.settings.fair + '</p></div>';
  }
  function roomDetailHtml(D) {
    var lv = { good: 0, fair: 0, low: 0 }; D.list.forEach(function (x) { lv[x.level]++; });
    return '<div class="cc-noexp" style="margin-bottom:10px"><button type="button" class="btn btn-secondary btn-sm" data-cc-room="">' + ic('fa-chevron-left') + ' ทุกห้อง</button></div>' +
      capHead('สรุปห้อง ' + D.room) + '<div class="card cc-card"><h3>' + ic('fa-door-open') + ' ห้อง ' + esc(D.room) + ' <small class="mut" style="font-weight:500">· ครูที่ปรึกษา ' + esc((D.advisors || []).join(', ') || '-') + ' · คะแนน' + esc(D.period) + '</small></h3>' +
      '<div class="cc-tw"><table class="cc-t"><thead><tr><th>เลขที่</th><th>ชื่อ-นามสกุล</th><th>มาสาย</th><th>หักคะแนน</th><th>เพิ่มคะแนน</th><th>คะแนน</th></tr></thead><tbody>' +
      D.list.map(function (x) { return '<tr class="cc-click" data-cc-stu="' + esc(x.key) + '"><td>' + esc(x.no) + '</td><td>' + esc(x.name) + '</td><td>' + (x.late || '-') + '</td><td class="cc-m">' + (x.minus || '-') + '</td><td class="cc-p">' + (x.plus ? '+' + x.plus : '-') + '</td><td><span class="cc-tg ' + lvCls(x.level) + '">' + x.score + '</span></td></tr>'; }).join('') +
      '</tbody></table></div><p class="hint">ดี ' + lv.good + ' คน · พอใช้ ' + lv.fair + ' คน · ต้องปรับปรุง ' + lv.low + ' คน</p></div>';
  }

  // ---------- คะแนนพฤติกรรม ----------
  async function showScores() {
    var k = st.room || 'all';
    body.innerHTML = '<div class="cc-flt"><select id="ccRoom" aria-label="ห้อง"><option value="">ทุกห้อง (คะแนนน้อยก่อน)</option></select><input type="search" id="ccQ" placeholder="ค้นหาชื่อ" value="' + esc(st.q) + '" />' +
      '<span class="cc-sp"></span><span class="cc-rtxt">' + esc(periodTxt()) + ' · เริ่มต้น ' + B.settings.startPoints + ' คะแนน · มาสาย −' + B.settings.latePoints + '/ครั้ง</span>' + exportBtns() + '</div><div id="ccSc" class="cc-cap"><div class="loading">กำลังโหลด...</div></div>';
    var box = document.getElementById('ccSc'), S;
    try { if (!C.sc[k]) C.sc[k] = await apiCall('careScores', { roomId: st.room }); S = C.sc[k]; } catch (e) { box.innerHTML = err(e.message); return; }
    if (st.tab !== 'scores') return;
    document.getElementById('ccRoom').innerHTML = '<option value="">ทุกห้อง (คะแนนน้อยก่อน)</option>' + S.rooms.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === st.room ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('');
    renderScores();
  }
  function periodTxt() {
    var P = B.periods || {}, g = /^m(\d)/.exec(st.room || ''), v = Object.keys(P).map(function (k) { return P[k]; });
    if (g) return 'นับ ' + (P['m' + g[1]] || '');
    return v.length && v.every(function (x) { return x === v[0]; }) ? 'นับ ' + v[0] : 'นับตามรอบของแต่ละชั้น';
  }
  function scoreRows() {
    var S = C.sc[st.room || 'all']; if (!S) return [];
    var L = S.list.filter(function (x) { return !st.q || x.name.indexOf(st.q) !== -1; });
    if (!st.room) L = L.slice().sort(function (a, b) { return a.score - b.score || a.room.localeCompare(b.room) || a.no - b.no; });
    return L;
  }
  function renderScores() {
    var S = C.sc[st.room || 'all'], box = document.getElementById('ccSc'); if (!S || !box) return;
    var L = scoreRows();
    var cnt = { good: 0, fair: 0, low: 0 }; S.list.forEach(function (x) { cnt[x.level]++; });
    var tot = L.length; L = L.slice(0, st.room ? 200 : 150);
    box.innerHTML = capHead('คะแนนพฤติกรรม' + (st.room ? ' ห้อง ' + ((S.rooms.find(function (r) { return r.id === st.room; }) || {}).name || '') : '')) + '<div class="cc-sts">' + [['ดี (≥ ' + S.settings.good + ')', cnt.good, '#15803d'], ['พอใช้', cnt.fair, '#c2410c'], ['ต้องปรับปรุง (< ' + S.settings.fair + ')', cnt.low, '#b91c1c'], ['นักเรียนทั้งหมด', S.list.length, '']].map(function (x) { return stat(x[0], x[1], x[2]); }).join('') + '</div>' +
      '<div class="card cc-card"><div class="cc-tw"><table class="cc-t"><thead><tr>' + (st.room ? '<th>เลขที่</th>' : '<th>ห้อง</th>') + '<th>ชื่อ</th><th>มาสาย</th><th>ครูเพิ่ม/หัก</th><th>คะแนน</th></tr></thead><tbody>' +
      L.map(function (x) { return '<tr class="cc-click" data-cc-stu="' + esc(x.key) + '"><td>' + esc(st.room ? x.no : x.room) + '</td><td>' + esc(x.name) + (st.room ? '' : ' <small class="mut">เลขที่ ' + esc(x.no) + '</small>') + '</td><td>' + (x.late || '-') + '</td><td>' + (x.adj ? sgn(x.adj) : '-') + '</td><td><span class="cc-tg ' + lvCls(x.level) + '">' + x.score + '</span></td></tr>'; }).join('') +
      '</tbody></table></div>' + (tot > L.length ? '<p class="hint">แสดง ' + L.length + ' จาก ' + tot + ' คน — เลือกห้องหรือค้นหาชื่อเพื่อดูคนอื่น (Excel ส่งออกครบทุกคน)</p>' : '') +
      '<p class="hint cc-noexp">' + ic('fa-circle-info') + ' เพิ่ม/หักคะแนนทำได้ที่ BNK Care Center หน้าครู (เข้าสู่ระบบด้วยบัญชีเว็บส่งงาน)</p></div>';
  }
  async function openStudent(key) {
    document.getElementById('ccModalTitle').innerHTML = ic('fa-user') + ' ประวัตินักเรียน';
    var mb = document.getElementById('ccModalBody'); mb.innerHTML = '<div class="loading">กำลังโหลด...</div>'; showModalEl(document.getElementById('ccModal'));
    try {
      var d = await apiCall('careStudent', { key: key });
      mb.innerHTML = '<div class="cc-stu"><div class="cc-ring ' + lvCls(d.level) + '"><b>' + d.score + '</b><small>คะแนน</small></div><div><b style="font-size:1.1rem">' + esc(d.student.name) + '</b><div class="mut">' + esc(d.student.room) + ' เลขที่ ' + esc(d.student.no) + ' · ' + esc(d.period || ('ภาคเรียนที่ ' + d.term + '/' + d.year)) + '</div><span class="cc-tg ' + lvCls(d.level) + '">ระดับ ' + lvTxt(d.level) + '</span> <span class="cc-tg n">มาสาย ' + d.late + ' ครั้ง</span></div></div>' +
        (d.hist.length ? '<div class="cc-hist">' + d.hist.map(function (h) { return '<div><span class="cc-pt ' + (h.delta < 0 ? 'm' : 'p') + '">' + sgn(h.delta) + '</span><span>' + (h.kind === 'late' ? 'มาสาย ' + esc(h.time || '') + (h.reason ? ' (' + esc(h.reason) + ')' : '') : esc(h.item) + (h.note ? ' — ' + esc(h.note) : '')) + '<small>' + thD(h.date, true) + ' · ' + (h.kind === 'late' ? 'บันทึกโดย ' + esc(h.by || '-') : 'โดย ' + esc(h.by || '-')) + '</small></span></div>'; }).join('') + '</div>' : '<p class="hint">ยังไม่มีประวัติในรอบนี้</p>');
    } catch (e) { mb.innerHTML = err(e.message); }
  }

  // ---------- 2.04.0: ส่งออก PDF / รูปภาพ / Excel ----------
  function fileBase() {
    var r = rangeOf(), g = st.grade ? '_ม' + st.grade.slice(1) : '';
    if (st.tab === 'scores') return 'คะแนนพฤติกรรม' + (st.room ? '_' + roomTxt(st.room) : '_ทุกห้อง');
    if (st.tab === 'rooms') return (st.rroom ? 'สรุปห้อง_' + roomTxt(st.rroom) : 'สรุปรายห้อง' + g) + '_' + r[0] + '_' + r[1];
    if (st.tab === 'frequent') return 'สายบ่อย' + g + '_' + r[0] + '_' + r[1];
    return 'สรุปรวม' + g + '_' + r[0] + '_' + r[1];
  }
  function roomTxt(id) { var m = /m(\d+)_(\d+)/.exec(id || ''); return m ? 'ม' + m[1] + '-' + m[2] : id; }
  async function snap() {
    var el = document.querySelector('.cc-cap'); if (!el || el.querySelector('.loading')) { showToast('รอโหลดข้อมูลก่อน', true); return null; }
    await loadScriptOnce('assets/html2canvas.min.js');
    var html = document.documentElement, th = html.getAttribute('data-theme'), vars = document.getElementById('bnkahThemeVars');
    html.setAttribute('data-theme', 'light'); html.classList.add('cc-exporting'); if (vars) vars.disabled = true;
    try { return await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true, windowWidth: Math.max(1100, el.scrollWidth + 40) }); }
    finally { if (th) html.setAttribute('data-theme', th); else html.removeAttribute('data-theme'); html.classList.remove('cc-exporting'); if (vars) vars.disabled = false; }
  }
  async function exportImg() {
    var res = await withProgress('กำลังสร้างรูปภาพ', async function () { var c = await snap(); if (!c) throw new Error('ยังไม่มีข้อมูล'); var b = await new Promise(function (ok) { c.toBlob(ok, 'image/png'); }); downloadBlob(b, fileBase() + '.png'); return true; }, { successLabel: 'ดาวน์โหลดรูปภาพแล้ว' });
    return res;
  }
  async function exportPdf() {
    return withProgress('กำลังสร้าง PDF', async function () {
      var c = await snap(); if (!c) throw new Error('ยังไม่มีข้อมูล');
      await loadScriptOnce('assets/jspdf.umd.min.js');
      var land = c.width / c.height > 1.25, pdf = new window.jspdf.jsPDF({ orientation: land ? 'landscape' : 'portrait', unit: 'mm', format: 'a4', compress: true });
      var pw = pdf.internal.pageSize.getWidth() - 20, ph = pdf.internal.pageSize.getHeight() - 20, pxPerMm = c.width / pw, sliceH = Math.floor(ph * pxPerMm);
      for (var y = 0, i = 0; y < c.height; y += sliceH, i++) { // ตัดเป็นหน้า ๆ (ไม่ล้นขอบ)
        var h = Math.min(sliceH, c.height - y), cv = document.createElement('canvas'); cv.width = c.width; cv.height = h;
        var g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, h); g.drawImage(c, 0, y, c.width, h, 0, 0, c.width, h);
        if (i) pdf.addPage(); pdf.addImage(cv.toDataURL('image/jpeg', 0.92), 'JPEG', 10, 10, pw, h / pxPerMm);
      }
      pdf.save(fileBase() + '.pdf'); return true;
    }, { successLabel: 'ดาวน์โหลด PDF แล้ว' });
  }
  async function exportXls() {
    var r = rangeOf(), title = 'โรงเรียนบุ่งคล้านคร — ', H, rows, W, sheet;
    if (st.tab === 'scores') {
      if (!C.sc[st.room || 'all']) return showToast('รอโหลดข้อมูลก่อน', true);
      H = ['ห้อง', 'เลขที่', 'ชื่อ-นามสกุล', 'มาสาย (ครั้ง)', 'ครูเพิ่ม/หัก', 'คะแนน', 'ระดับ']; W = [10, 8, 32, 12, 12, 10, 14]; sheet = 'คะแนนพฤติกรรม';
      rows = scoreRows().map(function (x) { return [x.room, +x.no || x.no, x.name, x.late, x.adj, x.score, lvTxt(x.level)]; }); title += 'คะแนนพฤติกรรม (' + periodTxt() + ')';
    } else if (st.tab === 'rooms' && st.rroom) {
      var D = C.rd[r[0] + '|' + r[1] + '|' + st.rroom]; if (!D) return showToast('รอโหลดข้อมูลก่อน', true);
      H = ['เลขที่', 'ชื่อ-นามสกุล', 'มาสาย (ครั้ง)', 'หักคะแนน', 'เพิ่มคะแนน', 'คะแนน', 'ระดับ']; W = [8, 32, 12, 12, 12, 10, 14]; sheet = 'ห้อง ' + D.room.replace('/', '-');
      rows = D.list.map(function (x) { return [+x.no || x.no, x.name, x.late, x.minus, x.plus, x.score, lvTxt(x.level)]; }); title += 'สรุปห้อง ' + D.room + ' · ' + rangeTxt();
    } else if (st.tab === 'rooms') {
      var R = C.rm[r[0] + '|' + r[1]]; if (!R) return showToast('รอโหลดข้อมูลก่อน', true);
      H = ['ห้อง', 'ครูที่ปรึกษา', 'นักเรียน (คน)', 'มาสาย (ครั้ง)', 'มาสาย (คน)', 'หักคะแนน', 'เพิ่มคะแนน', 'คะแนนเฉลี่ย', 'ดี', 'พอใช้', 'ต้องปรับปรุง']; W = [10, 30, 12, 12, 12, 12, 12, 12, 8, 8, 12]; sheet = 'สรุปรายห้อง';
      rows = roomsList(R).map(function (x) { return [x.room, (x.advisors || []).join(', '), x.total, x.late, x.lateStu, x.minus, x.plus, x.avg, x.levels.good, x.levels.fair, x.levels.low]; }); title += 'สรุปรายห้อง · ' + rangeTxt();
    } else if (st.tab === 'frequent') {
      var O = C.ov[r[0] + '|' + r[1] + '|' + st.grade]; if (!O) return showToast('รอโหลดข้อมูลก่อน', true);
      H = ['ห้อง', 'เลขที่', 'ชื่อ-นามสกุล', 'มาสาย (ครั้ง)', 'คะแนน']; W = [10, 8, 32, 12, 10]; sheet = 'สายบ่อย';
      rows = freqList(O).map(function (x) { return [x.room, +x.no || x.no, x.name, x.n, x.score]; }); title += 'นักเรียนที่สาย ' + st.min + ' ครั้งขึ้นไป · ' + rangeTxt();
    } else { // สรุปรวม = รายการมาสายทั้งหมดในช่วง (ข้อมูลดิบ)
      await withProgress('กำลังเตรียมไฟล์ Excel', async function () {
        var d = await apiCall('careExport', { from: r[0], to: r[1] });
        var rows2 = d.records.filter(function (x) { return !st.grade || String(x.roomId).indexOf(st.grade + '_') === 0; }).map(function (x) { return [x.date, x.room, +x.no || x.no, x.code, x.name, x.time, x.reason, x.by]; });
        downloadBlob(buildXlsx('รายการมาสาย', ['วันที่', 'ห้อง', 'เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'เวลา', 'สาเหตุ', 'ผู้บันทึก'], rows2, [12, 10, 8, 14, 32, 8, 22, 22], title + 'รายการมาสาย · ' + rangeTxt() + (st.grade ? ' · ม.' + st.grade.slice(1) : '')), fileBase() + '.xlsx');
        return true;
      }, { successLabel: 'ดาวน์โหลด Excel แล้ว (รายการมาสายทั้งหมดในช่วงที่เลือก)' });
      return;
    }
    downloadBlob(buildXlsx(sheet, H, rows, W, title), fileBase() + '.xlsx'); showToast('ดาวน์โหลด Excel แล้ว');
  }

  // ---------- ตั้งค่า (สิทธิ์จัดการ) ----------
  var draft = null;
  function siteBase(u) { u = String(u || '').trim(); u = u.replace(/(index|council|student)\.html.*$/i, ''); return u && !/\/$/.test(u) ? u + '/' : u; }
  function showSettings() {
    var s = B.settings;
    draft = draft || { pinOn: s.pinOn, pin: '', notifyOn: s.notifyOn, notifyN: s.notifyN, startPoints: s.startPoints, latePoints: s.latePoints, good: s.good, fair: s.fair,
      items: (s.items || []).map(function (x) { return { label: x.label, delta: x.delta, t: !!x.t }; }), siteUrl: B.siteUrl, cycle: JSON.parse(JSON.stringify(s.cycle || { mode: 'all', all: 'term', g: {} })),
      advisorView: !!s.advisorView, council: (s.council || []).map(function (c) { return { k: c.k, n: c.n, r: c.r }; }), selfOn: s.selfOn !== false, selfFrom: s.selfFrom || '06:00', selfTo: s.selfTo || '17:30', reasons: (s.reasons || []).slice() };
    var d = draft, sw = function (id, on, attr) { return '<input type="checkbox" class="switch" role="switch" id="' + id + '"' + (attr || '') + (on ? ' checked' : '') + ' />'; }, base = siteBase(d.siteUrl);
    var links = [['', 'หน้าครู (หน้าหลัก)', 'fa-chalkboard-user'], ['council.html', 'หน้าสภานักเรียน (ใช้ PIN)', 'fa-people-group'], ['student.html', 'หน้านักเรียน (แจ้งมาสายเอง)', 'fa-user-graduate']];
    body.innerHTML = '<div class="cc-grid2"><div>' +
      // --- การเข้าใช้ + ลิงก์
      '<div class="card cc-card"><h3>' + ic('fa-key') + ' หน้าสภานักเรียน — รหัส PIN</h3>' +
      '<label class="cc-row">' + sw('ccPinOn', d.pinOn) + '<b>ใช้รหัส PIN</b></label>' + (!d.pinOn ? '<div class="cc-warn">' + ic('fa-triangle-exclamation') + ' ปิด PIN = ใครมีลิงก์หน้าสภาก็บันทึกได้ และเห็นรายชื่อนักเรียนทั้งโรงเรียน</div>' : '') +
      '<div class="cc-row"><span class="cc-lb">รหัส PIN ใหม่ (4–6 หลัก)</span><input id="ccPin" inputmode="numeric" maxlength="6" placeholder="' + (s.pinSet ? 'ตั้งไว้แล้ว — ใส่เมื่อต้องการเปลี่ยน' : 'ยังไม่ได้ตั้ง') + '" value="' + esc(d.pin) + '" autocomplete="off" /></div>' +
      '<p class="hint">เปลี่ยนรหัส = ทุกเครื่องต้องใส่รหัสใหม่ · ใส่ผิดเกินกำหนด ระบบพัก 15 นาที · แนะนำ 6 หลัก</p></div>' +
      // --- สภานักเรียน
      '<div class="card cc-card"><h3>' + ic('fa-people-group') + ' สมาชิกสภานักเรียน (' + d.council.length + ' คน)</h3><p class="hint" style="margin-top:0">ผู้บันทึกในหน้าสภานักเรียนเลือกจากรายชื่อนี้</p><div class="cc-chips">' +
      d.council.map(function (c, i) { return '<span class="cc-chip">' + esc(c.n) + ' <small>' + esc(c.r) + '</small><button type="button" data-cc-cdel="' + i + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button></span>'; }).join('') +
      '<button type="button" class="cc-chip-add" data-cc-cadd>' + ic('fa-plus') + ' เพิ่มจากรายชื่อนักเรียน</button></div></div>' +
      // --- หน้านักเรียน
      '<div class="card cc-card"><h3>' + ic('fa-user-graduate') + ' หน้านักเรียน — แจ้งมาสายด้วยตนเอง</h3>' +
      '<label class="cc-row">' + sw('ccSelfOn', d.selfOn) + '<b>เปิดให้นักเรียนแจ้งเอง</b></label>' +
      '<div class="cc-row"><span class="cc-lb">เวลาที่เปิดให้กรอก</span><input type="time" id="ccSelfFrom" value="' + esc(d.selfFrom) + '" class="cc-time" /> ถึง <input type="time" id="ccSelfTo" value="' + esc(d.selfTo) + '" class="cc-time" /></div>' +
      '<div class="cc-row" style="display:block"><div style="margin-bottom:6px">ตัวเลือกเหตุผล</div><div class="cc-chips">' + d.reasons.map(function (x, i) { return '<span class="cc-chip">' + esc(x) + '<button type="button" data-cc-rdel="' + i + '" aria-label="ลบ">' + ic('fa-xmark') + '</button></span>'; }).join('') +
      '<span class="cc-chip-in"><input id="ccRNew" maxlength="40" placeholder="เพิ่มเหตุผล" /><button type="button" data-cc-radd>' + ic('fa-plus') + '</button></span></div><p class="hint">"อื่นๆ (พิมพ์เอง)" มีให้เลือกเสมอ · นักเรียนแจ้งได้วันละ 1 ครั้ง · นับเป็นมาสายและหักคะแนนทันที (สภานักเรียนลบได้ถ้าไม่ถูกต้อง)</p></div></div>' +
      // --- ลิงก์ 3 หน้า
      '<div class="card cc-card"><h3>' + ic('fa-link') + ' ลิงก์ BNK Care Center</h3><div class="cc-row"><span class="cc-lb">ที่อยู่เว็บ</span><input id="ccSite" value="' + esc(d.siteUrl) + '" style="flex:1" /></div>' +
      links.map(function (l, i) { var u = base + l[0]; return '<div class="cc-link"><span>' + ic(l[2]) + ' <b>' + l[1] + '</b><small>' + esc(u) + '</small></span><button type="button" class="btn btn-secondary btn-sm" data-cc-copy="' + esc(u) + '">' + ic('fa-copy') + '</button><button type="button" class="btn btn-secondary btn-sm" data-cc-qr="' + i + '" data-u="' + esc(u) + '">' + ic('fa-qrcode') + '</button></div><div id="ccQr' + i + '" class="cc-qr" hidden></div>'; }).join('') +
      '<p class="hint">หน้าสภานักเรียนและหน้านักเรียนไม่มีปุ่มกลับหน้าครู — พิมพ์ QR ติดไว้ได้เลย</p></div></div>' +
      // --- คอลัมน์ขวา: คะแนน
      '<div><div class="card cc-card"><h3>' + ic('fa-star') + ' คะแนนพฤติกรรม</h3>' +
      '<div class="cc-row"><span class="cc-lb">คะแนนเริ่มต้น</span><input id="ccStart" type="number" min="0" max="1000" class="cc-num" value="' + d.startPoints + '" /></div>' +
      cycleHtml(d.cycle) +
      '<div class="cc-row"><span class="cc-lb">มาสาย หักอัตโนมัติ</span><input id="ccLate" type="number" min="0" max="50" class="cc-num" value="' + d.latePoints + '" /><span>คะแนน / ครั้ง</span></div>' +
      '<div class="cc-row"><span class="cc-lb">ระดับ</span><span class="cc-tg g">ดี ≥</span><input id="ccGood" type="number" class="cc-num" value="' + d.good + '" /><span class="cc-tg o">พอใช้ ≥</span><input id="ccFair" type="number" class="cc-num" value="' + d.fair + '" /><span class="cc-tg r">ต่ำกว่านั้น = ต้องปรับปรุง</span></div>' +
      '<h3 style="margin-top:14px">' + ic('fa-list-check') + ' รายการเพิ่ม / หักคะแนน</h3><div class="cc-it cc-ith"><span class="cc-num">คะแนน</span><span style="flex:1">รายการ</span><span class="cc-tcol">ครูทั่วไปใช้ได้</span><span style="width:34px"></span></div><div id="ccItems">' +
      d.items.map(function (x, i) { return '<div class="cc-it"><input type="number" class="cc-num" data-cc-it-d="' + i + '" value="' + x.delta + '" /><input data-cc-it-l="' + i + '" value="' + esc(x.label) + '" placeholder="ชื่อรายการ" /><span class="cc-tcol">' + sw('ccIt' + i, x.t, ' data-cc-it-t="' + i + '" aria-label="ครูทั่วไปใช้ได้"') + '</span><button type="button" class="cc-x" data-cc-it-del="' + i + '" aria-label="ลบ">' + ic('fa-xmark') + '</button></div>'; }).join('') + '</div>' +
      '<div class="cc-row"><button type="button" class="btn btn-secondary btn-sm" data-cc-it-add>' + ic('fa-plus') + ' เพิ่มรายการ</button><span class="hint" style="margin:0">ติดลบ = หัก · บวก = เพิ่ม · ครูกิจการนักเรียนใช้ได้ทุกรายการ และพิมพ์เรื่องอื่นเองได้</span></div>' +
      '<h3 style="margin-top:14px">' + ic('fa-user-shield') + ' สิทธิ์ครูทั่วไป</h3><label class="cc-row">' + sw('ccAdvView', d.advisorView) + '<span>ครูที่ปรึกษาดูคะแนนของห้องตัวเองได้ (ในหน้าครู)</span></label>' +
      '<p class="hint">ครูกิจการนักเรียน = ผู้ดูแลกิจการนักเรียน (สิทธิ์จัดการ) และเจ้าหน้าที่กลุ่มบริหารงานกิจการนักเรียน · ครูทั่วไปยกเลิกได้เฉพาะรายการที่ตัวเองบันทึกในวันเดียวกัน</p>' +
      '<h3 style="margin-top:14px">' + ic('fa-bell') + ' แจ้งเตือนครูที่ปรึกษา</h3><div class="cc-row">' + sw('ccNotifyOn', d.notifyOn) + '<span>แจ้งผ่านกระดิ่งเมื่อนักเรียนสายครบ</span><input id="ccNotifyN" type="number" min="1" max="31" class="cc-num" value="' + d.notifyN + '" /><span>ครั้ง / เดือน</span></div>' +
      '<p class="hint">แจ้งครั้งเดียวต่อนักเรียนต่อเดือน · ครูที่ปรึกษาต้องผูกบัญชีกับเว็บเช็คชื่อไว้แล้ว</p></div></div></div>' +
      '<div class="cc-actions"><button type="button" class="btn btn-success" data-cc-save>' + ic('fa-check') + ' บันทึกการตั้งค่า</button></div>';
  }
  var CYC = [['term', 'ทุกภาคเรียน'], ['year', 'ทุกปีการศึกษา'], ['stage', 'ทุกช่วงชั้น 3 ปี']];
  function cycOpts(id, v) { return '<select id="' + id + '" class="cc-cyc">' + CYC.map(function (x) { return '<option value="' + x[0] + '"' + (v === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>'; }
  function cycLabel(v, g) {
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
    if (!document.getElementById('ccPinOn')) return;
    d.pinOn = c('ccPinOn'); d.pin = v('ccPin').replace(/\D/g, ''); d.notifyOn = c('ccNotifyOn'); d.notifyN = +v('ccNotifyN') || 3; d.startPoints = +v('ccStart') || 0; d.latePoints = +v('ccLate') || 0; d.good = +v('ccGood') || 0; d.fair = +v('ccFair') || 0; d.siteUrl = v('ccSite');
    d.advisorView = c('ccAdvView'); d.selfOn = c('ccSelfOn'); d.selfFrom = v('ccSelfFrom') || d.selfFrom; d.selfTo = v('ccSelfTo') || d.selfTo;
    var cy = d.cycle; if (document.getElementById('ccCycAll')) cy.all = v('ccCycAll');
    cy.g = cy.g || {}; for (var i = 1; i <= 6; i++) { if (document.getElementById('ccCyc' + i)) cy.g['m' + i] = v('ccCyc' + i); else cy.g['m' + i] = cy.g['m' + i] || cy.all; }
    document.querySelectorAll('[data-cc-it-l]').forEach(function (e) { d.items[+e.getAttribute('data-cc-it-l')].label = e.value; });
    document.querySelectorAll('[data-cc-it-d]').forEach(function (e) { d.items[+e.getAttribute('data-cc-it-d')].delta = Math.trunc(+e.value || 0); });
    document.querySelectorAll('[data-cc-it-t]').forEach(function (e) { d.items[+e.getAttribute('data-cc-it-t')].t = e.checked; });
  }
  // เลือกสมาชิกสภานักเรียน (รายชื่อจาก BNKSA ผ่าน Care Center — โหลดครั้งเดียวต่อการเปิดหน้า)
  var pk = { room: '', q: '' };
  async function openCouncilPicker() {
    document.getElementById('ccModalTitle').innerHTML = ic('fa-people-group') + ' เพิ่มสมาชิกสภานักเรียน';
    var mb = document.getElementById('ccModalBody'); mb.innerHTML = '<div class="loading">กำลังโหลดรายชื่อ...</div>'; showModalEl(document.getElementById('ccModal'));
    try { if (!ROSTER) ROSTER = await apiCall('careRoster', {}); } catch (e) { mb.innerHTML = err(e.message); return; }
    mb.innerHTML = '<div class="cc-flt" style="margin-bottom:8px"><select id="ccPkRoom"><option value="">ทุกห้อง</option>' + ROSTER.rooms.map(function (r) { return '<option value="' + esc(r.id) + '"' + (pk.room === r.id ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select><input type="search" id="ccPkQ" placeholder="ค้นชื่อ" value="' + esc(pk.q) + '" /></div><div id="ccPkList" class="cc-pk"></div>';
    renderPicker();
  }
  function renderPicker() {
    var box = document.getElementById('ccPkList'); if (!box || !ROSTER) return;
    var have = {}, out = []; draft.council.forEach(function (c) { have[c.k] = 1; });
    ROSTER.rooms.forEach(function (r) { if (pk.room && r.id !== pk.room) return; r.students.forEach(function (s) { if (pk.q && s[2].indexOf(pk.q) === -1) return; out.push([r, s]); }); });
    var more = out.length > 120; out = out.slice(0, 120);
    box.innerHTML = (pk.room || pk.q ? '' : '<p class="hint">เลือกห้องหรือพิมพ์ชื่อเพื่อค้นหา</p>') + out.map(function (x) { var on = have[x[1][0]]; return '<button type="button" class="cc-pkr' + (on ? ' on' : '') + '" data-cc-pick="' + esc(x[1][0]) + '" data-n="' + esc(x[1][2]) + '" data-r="' + esc(x[0].name) + '"><span class="mut">' + esc(x[0].name) + ' · ' + esc(x[1][1]) + '</span><span>' + esc(x[1][2]) + '</span><b>' + (on ? ic('fa-check') + ' เพิ่มแล้ว' : ic('fa-plus') + ' เพิ่ม') + '</b></button>'; }).join('') + (more ? '<p class="hint">แสดง 120 คนแรก — เลือกห้องหรือพิมพ์ชื่อให้แคบลง</p>' : '');
  }

  // ---------- เหตุการณ์ ----------
  body.addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-cc-rg]'))) { st.range = t.getAttribute('data-cc-rg'); show(); return; }
    if ((t = e.target.closest('[data-cc-go]'))) { e.preventDefault(); st.tab = t.getAttribute('data-cc-go'); st.rroom = ''; renderTabs(); show(); return; }
    if ((t = e.target.closest('[data-cc-stu]'))) { openStudent(t.getAttribute('data-cc-stu')); return; }
    if ((t = e.target.closest('[data-cc-room]'))) { st.rroom = t.getAttribute('data-cc-room'); showRooms(); return; }
    if ((t = e.target.closest('[data-cc-ex]'))) { var k = t.getAttribute('data-cc-ex'); if (k === 'pdf') exportPdf(); else if (k === 'img') exportImg(); else exportXls(); return; }
    if ((t = e.target.closest('[data-cc-cm]'))) { syncDraft(); var m = t.getAttribute('data-cc-cm'); if (m === 'grade' && draft.cycle.mode !== 'grade') { for (var i = 1; i <= 6; i++) draft.cycle.g['m' + i] = draft.cycle.all || 'term'; } draft.cycle.mode = m; showSettings(); return; }
    if (e.target.closest('[data-cc-it-add]')) { syncDraft(); draft.items.push({ label: '', delta: -5, t: false }); showSettings(); return; }
    if ((t = e.target.closest('[data-cc-it-del]'))) { syncDraft(); draft.items.splice(+t.getAttribute('data-cc-it-del'), 1); showSettings(); return; }
    if ((t = e.target.closest('[data-cc-cdel]'))) { syncDraft(); draft.council.splice(+t.getAttribute('data-cc-cdel'), 1); showSettings(); return; }
    if (e.target.closest('[data-cc-cadd]')) { syncDraft(); openCouncilPicker(); return; }
    if ((t = e.target.closest('[data-cc-rdel]'))) { syncDraft(); draft.reasons.splice(+t.getAttribute('data-cc-rdel'), 1); showSettings(); return; }
    if (e.target.closest('[data-cc-radd]')) { syncDraft(); var nv = (document.getElementById('ccRNew').value || '').trim(); if (nv && draft.reasons.indexOf(nv) === -1 && draft.reasons.length < 12) draft.reasons.push(nv); showSettings(); var ri = document.getElementById('ccRNew'); if (ri) ri.focus(); return; }
    if ((t = e.target.closest('[data-cc-copy]'))) { try { await navigator.clipboard.writeText(t.getAttribute('data-cc-copy')); showToast('คัดลอกลิงก์แล้ว'); } catch (x) { showToast('คัดลอกไม่สำเร็จ', true); } return; }
    if ((t = e.target.closest('[data-cc-qr]'))) { var q = document.getElementById('ccQr' + t.getAttribute('data-cc-qr')); q.hidden = !q.hidden; q.innerHTML = ''; if (!q.hidden) { try { qrLogo(q, t.getAttribute('data-u'), 180); } catch (x) { q.textContent = 'สร้าง QR ไม่ได้'; } } return; }
    if (e.target.closest('[data-cc-save]')) {
      syncDraft(); var d = draft;
      if (d.pin && !/^\d{4,6}$/.test(d.pin)) { showToast('รหัส PIN ต้องเป็นตัวเลข 4–6 หลัก', true); return; }
      if (d.pinOn && !d.pin && !B.settings.pinSet) { showToast('ตั้งรหัส PIN ก่อนเปิดใช้', true); return; }
      if (!d.selfFrom || !d.selfTo || d.selfFrom >= d.selfTo) { showToast('เวลาเปิดหน้านักเรียน: เวลาเริ่มต้องก่อนเวลาสิ้นสุด', true); return; }
      var items = d.items.filter(function (x) { return String(x.label).trim() && x.delta; });
      var go = async function () {
        var r = await withProgress('กำลังบันทึกการตั้งค่า', function () {
          return apiCall('careSettingsSave', { pinOn: d.pinOn, pin: d.pin || undefined, notifyOn: d.notifyOn, notifyN: d.notifyN, startPoints: d.startPoints, latePoints: d.latePoints, good: d.good, fair: d.fair, items: items, cycle: d.cycle, siteUrl: d.siteUrl,
            advisorView: d.advisorView, council: d.council.map(function (c) { return c.k; }), selfOn: d.selfOn, selfFrom: d.selfFrom, selfTo: d.selfTo, reasons: d.reasons });
        }, { successLabel: 'บันทึกการตั้งค่าแล้ว' });
        if (r.ok) { B.settings = r.data.settings; B.periods = r.data.periods || B.periods; B.siteUrl = r.data.siteUrl; draft = null; C.sc = {}; C.ov = {}; C.rm = {}; C.rd = {}; showSettings(); }
      };
      if (!d.pinOn && B.settings.pinOn) { if (await askConfirm('ปิดแล้ว ใครมีลิงก์หน้าสภานักเรียนก็เปิดเว็บ เห็นรายชื่อนักเรียนทั้งโรงเรียน และบันทึกการมาสายได้ — ยืนยันปิดหรือไม่?', 'ปิดรหัส PIN')) await go(); } else await go();
    }
  });
  body.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'ccRNew') { e.preventDefault(); var b = document.querySelector('[data-cc-radd]'); if (b) b.click(); } });
  body.addEventListener('change', function (e) {
    var id = e.target.id;
    if (id === 'ccGrade') { st.grade = e.target.value; show(); }
    else if (id === 'ccFrom' || id === 'ccTo') { var a = document.getElementById('ccFrom').value, b = document.getElementById('ccTo').value; if (a && b && a <= b) { st.from = a; st.to = b; show(); } }
    else if (id === 'ccMin') { st.min = +e.target.value; show(); }
    else if (id === 'ccRoom') { st.room = e.target.value; showScores(); }
    else if (id === 'ccPinOn' || /^ccCyc/.test(id)) { syncDraft(); showSettings(); }
    else if (id === 'ccSite') { syncDraft(); showSettings(); }
  });
  body.addEventListener('input', debounce(function (e) { if (e.target.id === 'ccQ') { st.q = e.target.value.trim(); renderScores(); } }, 200));
  var modal = document.getElementById('ccModal');
  modal.addEventListener('click', function (e) {
    var t;
    if (e.target.closest('[data-cc-close]')) { hideModalEl(modal); return; }
    if ((t = e.target.closest('[data-cc-pick]'))) {
      syncDraft(); var k = t.getAttribute('data-cc-pick'), i = draft.council.findIndex(function (c) { return c.k === k; });
      if (i === -1) { if (draft.council.length >= 80) { showToast('สมาชิกสภานักเรียนได้สูงสุด 80 คน', true); return; } draft.council.push({ k: k, n: t.getAttribute('data-n'), r: t.getAttribute('data-r') }); } else draft.council.splice(i, 1);
      if (st.tab === 'settings') showSettings(); renderPicker();
    }
  });
  modal.addEventListener('change', function (e) { if (e.target.id === 'ccPkRoom') { pk.room = e.target.value; renderPicker(); } });
  modal.addEventListener('input', debounce(function (e) { if (e.target.id === 'ccPkQ') { pk.q = e.target.value.trim(); renderPicker(); } }, 200));
  boot();
})();
