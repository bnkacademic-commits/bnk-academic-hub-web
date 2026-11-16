/* ระบบสอนแทน (2.19.0) — หน้า substitute.html
 * แท็บ: จัดครูสอนแทน (ผู้ดูแล) · สั่งงานนักเรียน (ครูที่ลา) · สรุปความเท่าเทียม · ตั้งค่า
 * ปิดระบบอยู่ = เห็นเฉพาะผู้ดูแลระบบสูงสุด / แอดมินระบบ · ไม่แจ้งเตือนครู · ครูไม่เห็นคาบที่จัด */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('substitute'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('sbBody'), tabsEl = document.getElementById('sbTabs'), offEl = document.getElementById('sbOff');
  var modal = document.getElementById('sbModal'), fileIn = document.getElementById('sbFileIn');
  var B = null, st = { tab: 'plan', date: '', evUser: '' }, DAY = null, EV = null, FAIR = null, PICK = null, UP = null, EVF = {}, CF = null;
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], DW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var TIMES = { '-2': '07.30', '0': '08.00', '1': '08.30', '2': '09.20', '3': '10.20', '4': '11.10', '5': '13.00', '6': '13.50', '7': '14.40', '8': '15.30' };
  var ORDER_LBL = { day: 'สอนน้อยในวันนั้น (รวมคาบที่แทนแล้ว)', today: 'สอนแทนในวันนั้นน้อย', term: 'สอนแทนสะสมในภาคเรียนน้อย' };
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function ic(n) { return '<i class="fa-solid ' + n + '" aria-hidden="true"></i>'; }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dP(s) { var p = String(s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function thD(s, y) { var d = dP(s); return DW[d.getDay()] + ' ' + d.getDate() + ' ' + MS[d.getMonth()] + (y === false ? '' : ' ' + (d.getFullYear() + 543)); }
  function plabel(p) { return Number(p) === -2 ? 'A' : Number(p) === 0 ? 'B' : String(p); }
  function err(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function hmTxt(s) { return String(s || '').slice(11, 16).replace(':', '.'); }
  function stamp(s) { return s ? thD(s.slice(0, 10), false) + ' ' + hmTxt(s) + ' น.' : ''; }
  function shiftDay(ds, n) { var d = dP(ds); do { d.setDate(d.getDate() + n); } while (d.getDay() === 0 || d.getDay() === 6); return ymd(d); }
  var EVST = { ok: ['ok', 'fa-check', 'ส่งแล้ว'], late: ['lt', 'fa-clock', 'ส่งช้า'], miss: ['bad', 'fa-xmark', 'ไม่ส่ง'], wait: ['wt', 'fa-hourglass-half', 'รอส่ง'] };
  function evPill(s, at, dl) { var x = EVST[s] || EVST.wait; return '<span class="sb-chip ' + x[0] + '">' + ic(x[1]) + ' ' + x[2] + (at && s !== 'wait' && s !== 'miss' ? ' ' + hmTxt(at) : s === 'wait' && dl ? ' (ก่อน ' + hmTxt(dl) + ')' : '') + '</span>'; }

  async function boot() {
    try { B = await apiCall('subBoot', {}); } catch (e) { tabsEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    st.date = B.today; var d = dP(st.date); if (d.getDay() === 0 || d.getDay() === 6) st.date = shiftDay(st.date, 1);
    st.evUser = B.me.id;
    var h = (location.hash || '').slice(1);
    if (!B.manage) st.tab = B.nav === 'v' ? 'fair' : 'ev';
    if (['plan', 'ev', 'fair', 'set'].indexOf(h) !== -1 && tabList().some(function (x) { return x[0] === h; })) st.tab = h;
    show();
  }
  function tabList() {
    var t = [];
    if (B.manage) t.push(['plan', 'fa-people-arrows', 'จัดครูสอนแทน']);
    if (B.manage || B.nav === 't') t.push(['ev', 'fa-file-arrow-up', 'สั่งงานนักเรียน']);
    if (B.manage || B.nav === 'v') t.push(['fair', 'fa-scale-balanced', 'สรุปความเท่าเทียม']);
    if (B.manage) t.push(['set', 'fa-gear', 'ตั้งค่า']);
    return t;
  }
  function show() {
    offEl.innerHTML = B.enabled ? '' : '<div class="sb-off">' + ic('fa-eye-slash') + ' ระบบสอนแทนปิดอยู่ — เห็นเฉพาะผู้ดูแลระบบ · ทดลองจัดได้ · ไม่แจ้งเตือนครู · ครูไม่เห็นคาบที่จัด (เปิดได้ที่แท็บตั้งค่า)</div>';
    var t = tabList(); tabsEl.hidden = t.length < 2;
    tabsEl.innerHTML = t.length < 2 ? '' : t.map(function (x) { return '<button type="button" class="tab-btn' + (x[0] === st.tab ? ' active' : '') + '" data-sb-tab="' + x[0] + '" role="tab">' + ic(x[1] + ' ui-icon') + ' ' + x[2] + '</button>'; }).join('');
    try { history.replaceState(null, '', '#' + st.tab); } catch (x) { /* ข้าม */ }
    ({ plan: showPlan, ev: showEv, fair: showFair, set: showSet })[st.tab]();
  }
  function loading() { body.innerHTML = '<div class="loading">กำลังโหลด...</div>'; }

  // ---------- จัดครูสอนแทน ----------
  async function loadDay(fresh) {
    var keep = DAY && DAY.date === st.date; if (!keep) loading();
    try { DAY = await apiCall('subDay', { date: st.date, fresh: !!fresh }); } catch (e) { body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return false; }
    return true;
  }
  async function showPlan() { if (!DAY || DAY.date !== st.date) { if (!(await loadDay())) return; } if (st.tab === 'plan') renderPlan(); }
  function renderPlan() {
    var D = DAY, jobs = D.jobs, done = jobs.filter(function (j) { return j.subId; }).length, pub = jobs.length && jobs.every(function (j) { return j.status === 'pub'; }), anyPub = jobs.some(function (j) { return j.status === 'pub'; });
    var h = '<div class="card"><div class="sb-bar"><div class="sb-date"><button type="button" class="sb-nav" data-sb-day="-1" aria-label="วันก่อนหน้า">' + ic('fa-chevron-left') + '</button><label><input type="date" id="sbDate" value="' + esc(st.date) + '" /><span>' + thD(st.date) + '</span></label><button type="button" class="sb-nav" data-sb-day="1" aria-label="วันถัดไป">' + ic('fa-chevron-right') + '</button></div>' +
      (st.date !== B.today ? '<button type="button" class="btn btn-ghost btn-sm" data-sb-today>วันนี้</button>' : '') +
      (jobs.length ? '<span class="sb-chip gr">' + jobs.length + ' คาบต้องจัด · จัดแล้ว ' + done + (jobs.length - done ? ' · ยังว่าง ' + (jobs.length - done) : '') + '</span><span class="sb-chip ' + (pub ? 'ok' : anyPub ? 'wt' : 'gr') + '">' + (pub ? ic('fa-bullhorn') + ' ประกาศแล้ว' : anyPub ? 'ประกาศบางส่วน' : ic('fa-pen') + ' ฉบับร่าง') + '</span>' : '') +
      '<span class="sb-sp"></span><button type="button" class="btn btn-ghost btn-sm" data-sb-refresh title="ดึงประวัติลาและตารางสอนล่าสุด">' + ic('fa-rotate') + ' รีเฟรช</button>' +
      (jobs.length ? '<button type="button" class="btn sb-vi btn-sm" data-sb-auto>' + ic('fa-wand-magic-sparkles') + ' จัดอัตโนมัติ</button>' + (pub ? '<button type="button" class="btn btn-ghost btn-sm" data-sb-unpub>' + ic('fa-rotate-left') + ' กลับเป็นฉบับร่าง</button>' : '<button type="button" class="btn btn-success btn-sm" data-sb-pub>' + ic('fa-bullhorn') + ' ประกาศ</button>') : '') + '</div>';
    if (D.off) h += '<div class="sb-empty">' + ic('fa-umbrella-beach') + '<p>' + esc(D.off) + ' — ไม่มีการเรียนการสอน</p></div>';
    else {
      h += '<div class="sb-abs">' + (D.absents.length ? D.absents.map(function (a) { return '<span class="sb-chip ' + (a.kind === 'ไปราชการ' ? 'gov' : 'lv') + '">' + ic(a.kind === 'ไปราชการ' ? 'fa-briefcase' : 'fa-bed') + ' ' + esc(a.name) + ' · ' + esc(a.kind) + ' ' + (a.all ? 'ทั้งวัน' : 'คาบ ' + a.periods.map(plabel).join(', ')) + ' · ' + a.n + ' คาบ</span>'; }).join('') : '<span class="cb-mut">' + ic('fa-circle-info') + ' วันนี้ไม่มีครูลา / ไปราชการ — ลงประวัติได้ที่หน้า <a href="leave.html">แจ้งลา / ไปราชการ</a></span>') + (D.half ? '<span class="sb-chip gr">หยุดครึ่งวัน' + (D.half === 'morning' ? 'เช้า' : 'บ่าย') + '</span>' : '') + '</div>';
      if (jobs.length) {
        h += '<div class="sb-tw"><table class="sb-tb"><thead><tr><th>คาบ</th><th>วิชา / ห้อง</th><th>ครูที่ไม่อยู่</th><th>ครูสอนแทน</th><th>หลักฐานสั่งงาน</th><th></th></tr></thead><tbody>' + jobs.map(rowHtml).join('') + '</tbody></table></div>' +
          '<p class="cb-mut sb-leg">' + ic('fa-wand-magic-sparkles sb-ivi') + ' = ระบบเลือก · ' + ic('fa-lock sb-ilk') + ' = ผู้ดูแลเลือกเอง (กดจัดอัตโนมัติอีกครั้งไม่เปลี่ยน · กดแม่กุญแจเพื่อปลด) · ทุกการแก้ไขบันทึกประวัติ</p>';
      } else if (D.absents.length) h += '<div class="sb-empty">' + ic('fa-circle-check') + '<p>ไม่มีคาบที่ต้องหาครูแทน (ครูที่ลาไม่มีคาบสอนในช่วงนั้น หรือมีครูร่วมสอนอยู่)</p></div>';
      if (D.covered.length) h += '<p class="cb-mut sb-leg">' + ic('fa-user-group') + ' มีครูร่วมสอนอยู่แล้ว (ไม่ต้องจัด): ' + D.covered.map(function (c) { return 'คาบ ' + plabel(c.period) + ' ' + esc(c.name) + ' ' + esc(c.room); }).join(' · ') + '</p>';
    }
    if (D.log && D.log.length) h += '<details class="sb-log"><summary>' + ic('fa-clock-rotate-left') + ' ประวัติการแก้ไขของวันนี้ (' + D.log.length + ')</summary>' + D.log.map(function (l) { return '<div>' + esc(formatDateTimeThai(l.at)) + ' · <b>' + esc(l.by) + '</b> · ' + esc(l.msg) + '</div>'; }).join('') + '</details>';
    body.innerHTML = h + '</div>';
  }
  function rowHtml(j) {
    var sel = j.subId ? '<button type="button" class="sb-sel ' + (j.locked ? 'man' : 'auto') + '" data-sb-pick="' + esc(j.id) + '">' + ic(j.locked ? 'fa-hand-pointer' : 'fa-wand-magic-sparkles') + '<b>' + esc(j.sub) + '</b>' + ic('fa-chevron-down sb-dn') + '</button>'
      : '<button type="button" class="sb-sel empty" data-sb-pick="' + esc(j.id) + '">' + ic('fa-triangle-exclamation') + '<b>ยังไม่มีครูสอนแทน — เลือก</b>' + ic('fa-chevron-down sb-dn') + '</button>';
    return '<tr data-row="' + esc(j.id) + '"><td class="nw"><b>' + plabel(j.period) + '</b><small>' + (TIMES[String(j.period)] || '') + '</small></td><td><b>' + esc((j.code ? j.code + ' ' : '') + j.name) + '</b><small>' + esc(j.room) + '</small></td><td>' + esc(j.absent) + '</td><td>' + sel + '</td><td>' + evPill(j.ev, j.evAt, j.deadline) + '</td>' +
      '<td class="r"><button type="button" class="sb-lk' + (j.locked ? ' on' : '') + '" data-sb-lock="' + esc(j.id) + '" title="' + (j.locked ? 'ปลดล็อก (ให้จัดอัตโนมัติได้)' : 'ล็อกครูคนนี้ไว้') + '" aria-label="ล็อก">' + ic(j.locked ? 'fa-lock' : 'fa-lock-open') + '</button></td></tr>';
  }
  function findJob(id) { return (DAY && DAY.jobs || []).filter(function (j) { return j.id === id; })[0] || null; }
  async function openPick(id) {
    var j = findJob(id); if (!j) return; PICK = { job: j, list: null };
    document.getElementById('sbModalTitle').innerHTML = ic('fa-people-arrows') + ' เลือกครูสอนแทน';
    document.getElementById('sbModalBody').innerHTML = '<p class="cb-mut" style="margin:0 0 8px">' + thD(j.date) + ' · คาบ ' + plabel(j.period) + ' (' + (TIMES[String(j.period)] || '') + ') · ' + esc((j.code ? j.code + ' ' : '') + j.name) + ' ' + esc(j.room) + ' · แทน ' + esc(j.absent) + '</p><div id="sbPickList"><div class="loading">กำลังหาครูที่ว่าง...</div></div>';
    document.getElementById('sbModalActs').innerHTML = (j.subId ? '<button type="button" class="btn btn-danger" data-sb-clear>' + ic('fa-user-xmark') + ' ล้างครูสอนแทน</button>' : '') + '<button type="button" class="btn btn-ghost" data-sb-close>ปิด</button>';
    showModalEl(modal);
    try { var r = await apiCall('subCands', { id: id }); PICK.list = r.list; PICK.group = r.group; } catch (e) { document.getElementById('sbPickList').innerHTML = err(e.message); return; }
    paintPick();
  }
  function paintPick() {
    var L = PICK.list, ok = L.filter(function (c) { return !c.why; }), no = L.filter(function (c) { return c.why; });
    var T = { 0: 'นักศึกษาฝึกสอนของครูที่ลา', 1: 'กลุ่มสาระ' + (PICK.group || 'เดียวกัน') + ' (ว่างคาบนี้)', 2: 'กลุ่มสาระอื่น (ใช้เมื่อกลุ่มสาระเดียวกันไม่ว่าง)' };
    var h = '', first = true;
    [0, 1, 2].forEach(function (tr) {
      var g = ok.filter(function (c) { return c.tier === tr; }); if (!g.length) return;
      h += '<div class="sb-tier">' + esc(T[tr]) + '</div>' + (first ? '<div class="sb-ch"><span>ครู</span><span>สอนวันนี้</span><span>แทนวันนี้</span><span>แทนภาคเรียนนี้</span><span></span></div>' : '');
      g.forEach(function (c) { h += candHtml(c, first); first = false; });
    });
    if (!ok.length) h += '<div class="sb-empty">' + ic('fa-user-slash') + '<p>ไม่มีครูที่ว่างตามเงื่อนไข — เลือกจากรายชื่อด้านล่างได้ (ระบบจะถามยืนยัน)</p></div>';
    if (no.length) h += '<details class="sb-no"' + (ok.length ? '' : ' open') + '><summary>ครูที่ไม่ว่าง / เกินเพดาน (' + no.length + ')</summary>' + no.map(function (c) { return candHtml(c, false); }).join('') + '</details>';
    h += '<p class="cb-mut sb-leg">เรียง: กลุ่มสาระเดียวกันก่อน → ' + (B.cfg ? B.cfg.order.map(function (k) { return ORDER_LBL[k]; }).join(' → ') : '') + ' · ผู้บริหารและรายชื่อยกเว้นไม่แสดง</p>';
    document.getElementById('sbPickList').innerHTML = h;
  }
  function candHtml(c, best) {
    var cur = PICK.job.subId === c.id;
    return '<div class="sb-cand' + (best ? ' best' : '') + (c.why ? ' no' : '') + (cur ? ' cur' : '') + '"><div class="n">' + esc(c.name) + (best ? ' <span class="sb-chip vi sm">แนะนำ</span>' : '') + (cur ? ' <span class="sb-chip ok sm">เลือกอยู่</span>' : '') + '<small>' + esc(c.group || 'ไม่ระบุกลุ่มสาระ') + '</small></div>' +
      (c.why ? '<div class="why">' + esc(c.why) + '</div>' : '<div class="v"><b>' + c.day + '</b> คาบ</div><div class="v"><b>' + c.today + '</b></div><div class="v"><b>' + c.term + '</b></div>') +
      '<div class="a">' + (cur ? '' : c.why && /ลา|ครูที่ลาเอง/.test(c.why) ? '' : '<button type="button" class="btn btn-sm ' + (c.why ? 'btn-ghost' : best ? 'btn-success' : 'btn-secondary') + '" data-sb-choose="' + esc(c.id) + '"' + (c.why ? ' data-why="' + esc(c.why) + '"' : '') + '>เลือก</button>') + '</div></div>';
  }
  async function choose(subId, why) {
    var j = PICK.job, c = PICK.list.filter(function (x) { return x.id === subId; })[0];
    if (why && !(await askConfirm(esc(c ? c.name : '') + ' — ' + esc(why) + '<br>ยืนยันเลือกครูคนนี้?', 'เลือกครูที่ไม่ว่าง'))) return;
    hideModalEl(modal);
    var r = await withProgress('กำลังบันทึก', function () { return apiCall('subSet', { id: j.id, subId: subId }); }, { successLabel: subId ? 'เลือกแล้ว (ล็อกไว้)' : 'ล้างแล้ว' });
    if (r.ok) { await loadDay(); renderPlan(); }
  }

  // ---------- สั่งงานนักเรียน (ครูที่ลา) ----------
  async function showEv() {
    if (!EV || EV.user.id !== st.evUser) { loading(); try { EV = await apiCall('subEvList', st.evUser !== B.me.id ? { forUser: st.evUser } : {}); } catch (e) { body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; } EVF = {}; }
    if (st.tab !== 'ev') return;
    renderEv();
  }
  function evKey(x) { return x.date + '|' + x.skey; }
  function renderEv() {
    var items = EV.items, h = '<div class="card">';
    if (B.manage) h += '<div class="sb-bar"><label class="cb-mut" for="sbEvU">ครู</label><select id="sbEvU" class="sb-in">' + (B.people || []).filter(function (p) { return !p.exec; }).map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === st.evUser ? ' selected' : '') + '>' + esc(p.name) + (p.id === B.me.id ? ' (ฉัน)' : '') + '</option>'; }).join('') + '</select><span class="cb-mut">ผู้ดูแลส่งแทนครูได้</span></div>';
    h += '<h3 style="margin:4px 0 2px">' + ic('fa-file-arrow-up ui-icon') + ' สั่งงานนักเรียน' + (EV.user.id !== B.me.id ? ' · ' + esc(EV.user.name) : '') + '</h3><p class="cb-mut" style="margin:0 0 12px">วันที่ไม่อยู่ ส่งหลักฐานว่าสั่งงานแล้ว 1 ชิ้นต่อวิชา (ภาพแชทสั่งงาน หรือใบงาน) · ' + (B.cfg ? (B.cfg.evMode === 'before' ? 'ก่อนคาบสอน ' + B.cfg.evMins + ' นาที' : 'ก่อน ' + B.cfg.evTime.replace(':', '.') + ' น.') : 'ตามเวลาที่ผู้ดูแลตั้ง') + ' · ครูสอนแทนเห็นข้อความที่สั่ง</p>';
    if (!items.length) h += '<div class="sb-empty">' + ic('fa-mug-hot') + '<p>ยังไม่มีวันที่ต้องส่งงาน (มีเมื่อผู้ดูแลจัดครูสอนแทนในวันที่คุณลา / ไปราชการ)</p></div>';
    var lastD = '';
    items.forEach(function (x) {
      var k = evKey(x), f = EVF[k] || (EVF[k] = { files: (x.files || []).slice(), note: x.note || '', dirty: false });
      if (x.date !== lastD) { h += '<div class="sb-evd">' + thD(x.date) + (x.date === B.today ? ' <span class="sb-today">วันนี้</span>' : '') + '</div>'; lastD = x.date; }
      var left = x.status === 'wait' ? leftTxt(x.deadline) : '';
      h += '<div class="sb-ev ' + x.status + '" data-ev="' + esc(k) + '"><div class="h"><div><b>' + esc((x.code ? x.code + ' ' : '') + x.name) + ' · ' + esc(x.rooms.join(', ')) + '</b><small>คาบ ' + x.periods.map(plabel).join(', ') + (x.subs.length ? ' · สอนแทน: ' + esc(x.subs.join(', ')) : '') + (x.rooms.length > 1 ? ' · วิชาเดียวกันส่งครั้งเดียว' : '') + '</small></div>' + evPill(x.status, x.at, x.deadline) + '</div>' +
        (left ? '<div class="sb-dl">' + ic('fa-clock') + ' ส่งก่อน ' + hmTxt(x.deadline) + ' น. · ' + left + '</div>' : x.status === 'miss' ? '<div class="sb-dl bad">' + ic('fa-triangle-exclamation') + ' เลยเวลาส่ง (' + hmTxt(x.deadline) + ' น.) — ยังส่งได้ ระบบบันทึกว่าส่งช้า</div>' : '') +
        '<div class="sb-files">' + f.files.map(function (fl, i) { return '<span class="sb-file"><a href="' + esc(fl.url) + '" target="_blank" rel="noopener">' + ic(/\.pdf$/i.test(fl.name) ? 'fa-file-pdf' : /\.(jpe?g|png|gif|webp|heic)$/i.test(fl.name) ? 'fa-image' : 'fa-file-lines') + ' ' + esc(fl.name) + '</a><button type="button" data-ev-rm="' + i + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button></span>'; }).join('') + '</div>' +
        (f.files.length < 5 ? '<div class="sb-up"><button type="button" data-ev-up="chat">' + ic('fa-comments') + 'ภาพแชทสั่งงาน</button><button type="button" data-ev-up="sheet">' + ic('fa-file-lines') + 'ใบงาน / ไฟล์</button></div>' : '') +
        '<textarea class="sb-note" data-ev-note rows="2" maxlength="600" placeholder="สั่งงานอะไร (ครูสอนแทนเห็นข้อความนี้) เช่น ทำแบบฝึกหัด 2.3 ข้อ 1–10 ส่งท้ายคาบ">' + esc(f.note) + '</textarea>' +
        '<div class="sb-evact">' + (x.at ? '<span class="cb-mut">ส่งครั้งแรก ' + stamp(x.at) + '</span>' : '') + '<button type="button" class="btn btn-success btn-sm" data-ev-save>' + ic('fa-check') + ' ' + (x.at ? 'บันทึกการแก้ไข' : 'ส่ง') + '</button></div></div>';
    });
    body.innerHTML = h + '</div>';
  }
  function leftTxt(dl) {
    var now = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');
    var a = Date.parse(now.replace(' ', 'T') + ':00Z'), b = Date.parse(String(dl).replace(' ', 'T') + ':00Z'), m = Math.round((b - a) / 60000);
    if (!(m > 0)) return ''; if (m < 60) return 'เหลือ ' + m + ' นาที'; if (m < 1440) return 'เหลือ ' + Math.floor(m / 60) + ' ชม. ' + (m % 60) + ' นาที'; return 'เหลือ ' + Math.floor(m / 1440) + ' วัน';
  }
  async function evSave(card) {
    var k = card.getAttribute('data-ev'), x = EV.items.filter(function (i) { return evKey(i) === k; })[0], f = EVF[k]; if (!x || !f) return;
    f.note = card.querySelector('[data-ev-note]').value;
    var r = await withProgress('กำลังส่ง', function () { return apiCall('subEvSave', Object.assign({ date: x.date, skey: x.skey, files: f.files.map(function (z) { return z.id; }), note: f.note }, st.evUser !== B.me.id ? { forUser: st.evUser } : {})); }, { successLabel: 'ส่งแล้ว' });
    if (r.ok) { EV = null; showEv(); }
  }
  fileIn.addEventListener('change', async function () {
    var file = fileIn.files && fileIn.files[0]; fileIn.value = ''; if (!file || !UP) return;
    if (file.size > 20 * 1024 * 1024) { showToast('ไฟล์ใหญ่เกิน 20 MB', true); return; }
    var k = UP, card = body.querySelector('[data-ev="' + CSS.escape(k) + '"]'); if (card) EVF[k].note = card.querySelector('[data-ev-note]').value;
    var r = await withProgress('กำลังอัปโหลดไฟล์', async function () {
      var prep = await apiCall('subUploadPrepare', Object.assign({ fileName: file.name, mimeType: file.type, fileSize: file.size, direct: 1, origin: location.origin }, st.evUser !== B.me.id ? { forUser: st.evUser } : {}));
      var res = await sendPreparedFile(prep, file, { filename: prep.uploadFileName || file.name, mimeType: file.type });
      return apiCall('leaveUploadFinalize', { evidenceId: prep.evidenceId, fileId: res.fileId, fileUrl: res.url, directUrl: res.directUrl, fileName: prep.uploadFileName || file.name, mimeType: file.type, via: res.via, fallbackReason: res.fallbackReason || '' });
    }, { upload: true, successLabel: 'อัปโหลดแล้ว — กด "ส่ง" เพื่อบันทึก' });
    if (r.ok) { EVF[k].files.push({ id: r.data.id, name: r.data.name, url: r.data.url }); EVF[k].dirty = true; renderEv(); }
  });

  // ---------- สรุปความเท่าเทียม ----------
  async function showFair() {
    if (!FAIR) { loading(); try { FAIR = await apiCall('subFair', {}); } catch (e) { body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; } }
    if (st.tab !== 'fair') return;
    var rows = FAIR.rows.slice().sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, 'th'); }), mx = Math.max.apply(null, rows.map(function (r) { return r.n; }).concat([1]));
    var h = '<div class="card"><div class="sb-bar"><h3 style="margin:0">' + ic('fa-scale-balanced ui-icon') + ' สรุปความเท่าเทียม · ภาคเรียนที่ ' + esc(FAIR.term.term + '/' + FAIR.term.year) + '</h3><span class="sb-sp"></span><span class="sb-chip gr">เฉลี่ย ' + FAIR.avg + ' คาบ/คน</span><input type="search" id="sbFq" class="sb-in" placeholder="ค้นหาชื่อ / กลุ่มสาระ" /></div>' +
      '<div class="sb-tw"><table class="sb-tb sb-fair"><thead><tr><th>ครู</th><th class="c">สอนปกติ/สัปดาห์</th><th class="c">สอนแทน</th><th style="width:28%">เทียบกัน</th><th></th></tr></thead><tbody id="sbFairRows">' + rows.map(function (r) {
        var tag = r.n >= 3 && FAIR.avg && r.n >= FAIR.avg * 2 ? '<span class="sb-chip bad">มากกว่าค่าเฉลี่ย ' + (Math.round(r.n / FAIR.avg * 10) / 10) + ' เท่า</span>' : r.n === 0 ? '<span class="sb-chip gr">ยังไม่เคยแทน</span>' : '';
        return '<tr data-q="' + esc(r.name + ' ' + r.group) + '"><td><b>' + esc(r.name) + '</b><small>' + esc(r.group || '-') + '</small></td><td class="c">' + (r.load || '-') + '</td><td class="c"><b>' + r.n + '</b>' + (r.pub !== r.n ? '<small>ประกาศแล้ว ' + r.pub + '</small>' : '') + '</td><td><div class="sb-barc"><i style="width:' + (r.n / mx * 100) + '%"></i></div></td><td>' + tag + '</td></tr>';
      }).join('') + (rows.length ? '' : '<tr><td colspan="5" class="cb-mut">ยังไม่มีข้อมูล</td></tr>') + '</tbody></table></div>' +
      '<div class="sb-2col" style="margin-top:14px"><div class="sb-box"><b>' + ic('fa-clipboard-question') + ' คาบที่มอบหมายแล้วแต่ยังไม่เช็คชื่อ (' + FAIR.unchecked.length + ')</b>' + (FAIR.unchecked.length ? '<ul>' + FAIR.unchecked.slice(0, 60).map(function (u) { return '<li>' + thD(u.date, false) + ' คาบ ' + plabel(u.period) + ' · ' + esc(u.subject) + ' ' + esc(u.room) + ' · <b>' + esc(u.sub) + '</b></li>'; }).join('') + '</ul>' : '<p class="cb-mut">ไม่มี</p>') + '</div>' +
      '<div class="sb-box"><b>' + ic('fa-file-circle-exclamation') + ' หลักฐานสั่งงาน: ไม่ส่ง / ส่งช้า (' + FAIR.evBad.length + ')</b>' + (FAIR.evBad.length ? '<ul>' + FAIR.evBad.slice(0, 60).map(function (u) { return '<li>' + thD(u.date, false) + ' · <b>' + esc(u.name) + '</b> · ' + esc(u.subject) + ' · ' + (u.status === 'late' ? '<span class="sb-chip lt sm">ส่งช้า ' + hmTxt(u.at) + '</span>' : '<span class="sb-chip bad sm">ไม่ส่ง</span>') + '</li>'; }).join('') + '</ul>' : '<p class="cb-mut">ไม่มี</p>') + '</div></div>' +
      '<p class="cb-mut sb-leg">สอนปกติ/สัปดาห์ นับจากตารางสอนสัปดาห์นี้ในเว็บเช็คชื่อ · สอนแทน นับทุกคาบที่จัดในภาคเรียนนี้ (รวมฉบับร่าง)</p></div>';
    body.innerHTML = h;
  }

  // ---------- ตั้งค่า ----------
  function showSet() {
    if (!CF) CF = JSON.parse(JSON.stringify(B.cfg));
    var P = B.people || [], nm = {}; P.forEach(function (p) { nm[p.id] = p.name; });
    function chips(ids, key) { return ids.map(function (id) { return '<span class="sb-chip gr">' + esc(nm[id] || id) + ' <button type="button" class="sb-x" data-cf-rm="' + key + '" data-id="' + esc(id) + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button></span>'; }).join('') || '<span class="cb-mut">ยังไม่มี</span>'; }
    function addSel(key, ex) { return '<select class="sb-in" data-cf-add="' + key + '"><option value="">+ เพิ่มรายชื่อ</option>' + P.filter(function (p) { return ex.indexOf(p.id) === -1 && (key !== 'exempt' || !p.exec); }).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') + '</select>'; }
    function row(t, s, r) { return '<div class="sb-row"><div><b>' + t + '</b><small>' + s + '</small></div><div class="r">' + r + '</div></div>'; }
    function sw(id, on, dis) { return '<label class="switch"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + (dis ? ' disabled' : '') + ' /><span class="slider"></span></label>'; }
    var mg = CF.managers.map(function (m) { return m.id; });
    var h = '<div class="sb-2col"><div class="card">' +
      row('เปิดใช้ระบบสอนแทน', B.isSuper ? 'ปิด = เห็นเฉพาะผู้ดูแลระบบ ใช้ทดลองจัดได้ · เปิด = ครูเห็นคาบสอนแทน / แจ้งเตือน / ส่งหลักฐานสั่งงาน' : 'เปิด/ปิดได้เฉพาะผู้ดูแลระบบสูงสุด', sw('cfOn', CF.enabled, !B.isSuper)) +
      (B.isSuper ? row('ผู้ดูแลระบบสอนแทน', 'จัดครู ล็อก ประกาศ ดูสรุป (มีผลเมื่อเปิดระบบ)', '') + '<div class="sb-chips">' + chips(mg, 'managers') + addSel('managers', mg) + '</div>' : '') +
      row('ไม่ต้องสอนแทน', 'ผู้บริหารไม่ถูกเลือกอยู่แล้ว · เพิ่มรายชื่ออื่นได้ (เช่น ครูที่มีภาระพิเศษ)', '') + '<div class="sb-chips">' + chips(CF.exempt, 'exempt') + addSel('exempt', CF.exempt) + '</div>' +
      row('สอนแทนได้ไม่เกิน', 'ต่อคน', '<input type="number" id="cfDay" class="sb-num" min="1" max="8" value="' + CF.maxDay + '" /> คาบ/วัน · <input type="number" id="cfWeek" class="sb-num" min="1" max="40" value="' + CF.maxWeek + '" /> คาบ/สัปดาห์') +
      row('นักศึกษาฝึกสอนสอนแทนครูพี่เลี้ยงได้', 'ปกติปิด · เปิดเมื่อจำเป็น (เสนอเป็นลำดับแรก)', sw('cfInt', CF.interns)) +
      row('รูปรายงานการสอนแทน', 'บังคับแนบ 1 รูปตอนเช็คชื่อคาบที่สอนแทน (ตั้งค่าเดียวกับเว็บเช็คชื่อ)', B.photo === null ? '<span class="cb-mut">เชื่อมเว็บเช็คชื่อไม่ได้</span>' : sw('cfPhoto', B.photo)) +
      '</div><div class="card"><b class="sb-h">ส่งหลักฐานสั่งงานภายใน</b><div class="sb-rad"><label><input type="radio" name="cfEv" value="fixed"' + (CF.evMode === 'fixed' ? ' checked' : '') + ' /> ก่อน <input type="time" id="cfTime" class="sb-in" value="' + esc(CF.evTime) + '" /> น. ของวันที่ไม่อยู่</label><label><input type="radio" name="cfEv" value="before"' + (CF.evMode === 'before' ? ' checked' : '') + ' /> ก่อนคาบสอน <input type="number" id="cfMins" class="sb-num" min="0" max="600" value="' + CF.evMins + '" /> นาที</label></div><p class="cb-mut" style="font-size:.85rem">1 ชิ้นต่อวิชา · เลยเวลา = ยังส่งได้ แต่บันทึกว่า "ส่งช้า" · ไม่ส่ง = ขึ้นในสรุป</p>' +
      '<b class="sb-h" style="margin-top:14px">ลำดับการเลือกครูอัตโนมัติ</b><div class="sb-ord"><div class="fx">' + ic('fa-lock') + ' ว่างคาบนั้น · ไม่ได้ลา · ไม่เกินเพดาน</div><div class="fx">' + ic('fa-lock') + ' กลุ่มสาระเดียวกันก่อน</div>' + CF.order.map(function (k, i) { return '<div><span class="n">' + (i + 1) + '</span>' + esc(ORDER_LBL[k]) + '<span class="sb-sp"></span><button type="button" data-ord="' + i + '" data-d="-1"' + (i ? '' : ' disabled') + ' aria-label="ขึ้น">' + ic('fa-arrow-up') + '</button><button type="button" data-ord="' + i + '" data-d="1"' + (i < CF.order.length - 1 ? '' : ' disabled') + ' aria-label="ลง">' + ic('fa-arrow-down') + '</button></div>'; }).join('') + '</div>' +
      '<div class="sb-evact" style="margin-top:16px"><button type="button" class="btn btn-success" data-cf-save>' + ic('fa-check') + ' บันทึกการตั้งค่า</button></div></div></div>';
    body.innerHTML = h;
  }
  function cfRead() {
    var g = function (id) { return document.getElementById(id); };
    if (!g('cfDay')) return;
    CF.maxDay = +g('cfDay').value || 2; CF.maxWeek = +g('cfWeek').value || 5; CF.interns = g('cfInt').checked; CF.evTime = g('cfTime').value || '08:30'; CF.evMins = +g('cfMins').value || 0;
    var r = document.querySelector('input[name="cfEv"]:checked'); CF.evMode = r ? r.value : 'fixed';
  }
  async function cfSave() {
    cfRead();
    var p = { exempt: CF.exempt, maxDay: CF.maxDay, maxWeek: CF.maxWeek, interns: CF.interns, evMode: CF.evMode, evTime: CF.evTime, evMins: CF.evMins, order: CF.order };
    if (B.isSuper) { p.managers = CF.managers; p.enabled = document.getElementById('cfOn').checked; }
    var ph = document.getElementById('cfPhoto'); if (ph && ph.checked !== B.photo) p.photo = ph.checked;
    if (p.enabled && !B.enabled && !(await askConfirm('เปิดระบบสอนแทน — ครูจะเห็นคาบสอนแทนที่ประกาศแล้ว ได้รับแจ้งเตือน และต้องส่งหลักฐานสั่งงาน<br>ยืนยันเปิดใช้?', 'เปิดระบบสอนแทน'))) return;
    var r = await withProgress('กำลังบันทึก', function () { return apiCall('subCfgSave', p); }, { successLabel: 'บันทึกแล้ว' });
    if (r.ok) { B.cfg = r.data.cfg; B.enabled = r.data.cfg.enabled; if (r.data.photo !== undefined) B.photo = r.data.photo; CF = null; show(); }
  }

  // ---------- เหตุการณ์ ----------
  document.addEventListener('click', async function (e) {
    var t;
    if ((t = e.target.closest('[data-sb-tab]'))) { if (st.tab === 'set') cfRead(); st.tab = t.getAttribute('data-sb-tab'); if (st.tab === 'fair') FAIR = null; show(); return; }
    if (e.target.closest('[data-sb-close]')) { hideModalEl(modal); PICK = null; return; }
    if (modal.contains(e.target) && PICK) {
      if ((t = e.target.closest('[data-sb-choose]'))) { choose(t.getAttribute('data-sb-choose'), t.getAttribute('data-why') || ''); return; }
      if (e.target.closest('[data-sb-clear]')) { if (await askConfirm('ล้างครูสอนแทนของคาบนี้?', 'ล้างครูสอนแทน')) choose('', ''); return; }
      return;
    }
    if (st.tab === 'plan') {
      if ((t = e.target.closest('[data-sb-day]'))) { st.date = shiftDay(st.date, +t.getAttribute('data-sb-day')); showPlan(); return; }
      if (e.target.closest('[data-sb-today]')) { st.date = B.today; showPlan(); return; }
      if (e.target.closest('[data-sb-refresh]')) { if (await loadDay(true)) renderPlan(); return; }
      if ((t = e.target.closest('[data-sb-pick]'))) { openPick(t.getAttribute('data-sb-pick')); return; }
      if ((t = e.target.closest('[data-sb-lock]'))) {
        var j = findJob(t.getAttribute('data-sb-lock')); if (!j) return;
        if (!j.locked && !j.subId) { showToast('เลือกครูสอนแทนก่อนจึงล็อกได้', true); return; }
        var rl = await withProgress('กำลังบันทึก', function () { return apiCall('subSet', j.locked ? { id: j.id, unlock: 1 } : { id: j.id, subId: j.subId }); }, { successLabel: j.locked ? 'ปลดล็อกแล้ว' : 'ล็อกแล้ว' });
        if (rl.ok) { await loadDay(); renderPlan(); }
        return;
      }
      if (e.target.closest('[data-sb-auto]')) {
        var nl = DAY.jobs.filter(function (x) { return x.locked; }).length;
        if (!(await askConfirm('จัดครูสอนแทนอัตโนมัติ ' + thD(st.date) + '<br>คาบที่ไม่ได้ล็อกจะถูกเลือกใหม่' + (nl ? ' · คาบที่ล็อกไว้ ' + nl + ' คาบไม่เปลี่ยน' : ''), 'จัดอัตโนมัติ'))) return;
        var ra = await withProgress('กำลังจัดครูสอนแทน', function () { return apiCall('subAuto', { date: st.date }); }, { successLabel: 'จัดแล้ว' });
        if (ra.ok) { DAY = ra.data; renderPlan(); }
        return;
      }
      if (e.target.closest('[data-sb-pub]')) {
        var empty = DAY.jobs.filter(function (x) { return !x.subId; }).length;
        if (!(await askConfirm('ประกาศคาบสอนแทน ' + thD(st.date) + (empty ? '<br><b style="color:#dc2626">ยังไม่มีครูสอนแทน ' + empty + ' คาบ</b>' : '') + '<br>' + (B.enabled ? 'ครูสอนแทนจะได้รับแจ้งเตือน · ครูที่ลาได้รับแจ้งให้ส่งหลักฐานสั่งงาน' : 'ระบบปิดอยู่ — ไม่แจ้งเตือนครู (ทดลอง)'), 'ประกาศ'))) return;
        var rp = await withProgress('กำลังประกาศ', function () { return apiCall('subPublish', { date: st.date }); }, { successLabel: 'ประกาศแล้ว' });
        if (rp.ok) { await loadDay(); renderPlan(); }
        return;
      }
      if (e.target.closest('[data-sb-unpub]')) {
        if (!(await askConfirm('กลับเป็นฉบับร่าง — ครูสอนแทนจะไม่เห็นคาบของวันนี้จนกว่าจะประกาศอีกครั้ง', 'กลับเป็นฉบับร่าง'))) return;
        var ru = await withProgress('กำลังบันทึก', function () { return apiCall('subUnpublish', { date: st.date }); }, { successLabel: 'กลับเป็นฉบับร่างแล้ว' });
        if (ru.ok) { await loadDay(); renderPlan(); }
        return;
      }
    }
    if (st.tab === 'ev') {
      var card = e.target.closest('[data-ev]'); if (!card) return;
      var k = card.getAttribute('data-ev');
      if ((t = e.target.closest('[data-ev-up]'))) { UP = k; fileIn.click(); return; }
      if ((t = e.target.closest('[data-ev-rm]'))) { EVF[k].note = card.querySelector('[data-ev-note]').value; EVF[k].files.splice(+t.getAttribute('data-ev-rm'), 1); EVF[k].dirty = true; renderEv(); return; }
      if (e.target.closest('[data-ev-save]')) { evSave(card); return; }
    }
    if (st.tab === 'set') {
      if ((t = e.target.closest('[data-cf-rm]'))) { cfRead(); var key = t.getAttribute('data-cf-rm'), id = t.getAttribute('data-id'); CF[key] = CF[key].filter(function (x) { return (x.id || x) !== id; }); showSet(); return; }
      if ((t = e.target.closest('[data-ord]'))) { cfRead(); var i = +t.getAttribute('data-ord'), d = +t.getAttribute('data-d'), o = CF.order, x = o[i]; o[i] = o[i + d]; o[i + d] = x; showSet(); return; }
      if (e.target.closest('[data-cf-save]')) { cfSave(); return; }
    }
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'sbDate' && t.value) { var d = dP(t.value); st.date = d.getDay() === 0 || d.getDay() === 6 ? shiftDay(t.value, 1) : t.value; showPlan(); return; }
    if (t.id === 'sbEvU') { st.evUser = t.value; EV = null; showEv(); return; }
    if (t.matches('[data-cf-add]') && t.value) { cfRead(); var key = t.getAttribute('data-cf-add'); if (key === 'managers') CF.managers.push({ id: t.value, manage: true, view: true }); else CF[key].push(t.value); showSet(); }
  });
  document.addEventListener('input', function (e) {
    if (e.target.id === 'sbFq') { var q = e.target.value.trim(); body.querySelectorAll('#sbFairRows tr[data-q]').forEach(function (r) { r.hidden = !!q && r.getAttribute('data-q').indexOf(q) === -1; }); }
  });
  boot();
})();
