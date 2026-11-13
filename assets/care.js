/* กิจการนักเรียน (2.03.0 / 2.04.0) — หน้า care.html · ข้อมูลจาก BNK Care Center (Worker แยก) ผ่าน Worker ของเว็บส่งงาน
 * แท็บ: สรุปรวม (พฤติกรรม) · มาสาย [ภาพรวม · รายห้อง · สายบ่อย] · คะแนนพฤติกรรม · ตั้งค่า (สิทธิ์จัดการ)  — 2.07.0
 * 2.04.0: สรุปรายห้อง (กดดูรายคน) · ส่งออก PDF / รูปภาพ / Excel ทุกแท็บสรุป · ตั้งค่ารายการที่ครูทั่วไปใช้ได้ · ครูที่ปรึกษาดูคะแนนห้องตัวเอง
 *        · สมาชิกสภานักเรียน · หน้านักเรียนแจ้งมาสายเอง (ช่วงเวลา + ตัวเลือกเหตุผล) · ลิงก์ + QR ทั้ง 3 หน้า
 * ประหยัด: โหลดเมื่อเปิดแท็บ/เปลี่ยนช่วง · จำผลไว้ในหน้า (ไม่โหลดซ้ำเมื่อสลับแท็บกลับมา) · ส่งออกสร้างในเครื่องจากข้อมูลที่โหลดแล้ว */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('care'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('ccBody'), tabsEl = document.getElementById('ccTabs');
  // 2.12.1: กด Back ตอนดูสรุปห้องเดียว = กลับทุกห้อง
  if (window.BackNav) BackNav.sub(function () { return st.tab === 'rooms' && !!st.rroom && !!body.querySelector('[data-cc-room=""]'); }, function () { var b = body.querySelector('[data-cc-room=""]'); if (b) b.click(); });
  var B = null, st = { tab: 'summary', late: 'overview', pg: 1, pp: (function () { try { var v = +localStorage.getItem('bnkah_cc_pp'); return [50, 100, 200, 0].indexOf(v) >= 0 && localStorage.getItem('bnkah_cc_pp') !== null ? v : 50; } catch (e) { return 50; } })(), allRows: false, range: 'week', from: '', to: '', grade: '', min: 3, room: '', q: '', rroom: '' }, C = { ov: {}, sc: {}, rm: {}, rd: {}, bh: {} }, ROSTER = null;
  var SK = { d: null, n: 0, cat: 'pend', sel: {}, busy: false }; // 2.13.0: โดด / ขาดเรียน
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], DW = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var PAL = ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'];
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function pad(n) { return String(n).padStart(2, '0'); }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dP(s) { var p = String(s || '').split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function thD(s, y) { var d = dP(s); return d.getDate() + ' ' + MS[d.getMonth()] + (y ? ' ' + (d.getFullYear() + 543) : ''); }
  function err(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function lvCls(lv, sc) { return Number(sc) < 0 ? 'r' : (lv === 'good' ? 'g' : (lv === 'fair' ? 'y' : 'o')); } // 2.07.2: ดี เขียว · พอใช้ เหลือง · ต้องปรับปรุง ส้ม · ติดลบ แดง
  function lvTxt(lv) { return lv === 'good' ? 'ดี' : (lv === 'fair' ? 'พอใช้' : 'ต้องปรับปรุง'); }
  var scoreRing = function (score, start) { // 1.03.1: เขียว 0–คะแนนเริ่มต้น · น้ำเงินซ้อนเมื่อเกิน (เต็มวง +250) · แดงเมื่อติดลบ (เต็มวง −250)
    score = Number(score) || 0; start = Number(start) || 100; var R = 56, C = 2 * Math.PI * R, CAP = 250;
    var arc = function (f, col) { f = Math.max(0, Math.min(1, f)); return f <= 0 ? '' : '<circle cx="66" cy="66" r="56" fill="none" stroke="' + col + '" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (f * C).toFixed(1) + ' ' + C.toFixed(1) + '"/>'; };
    var s = '<circle cx="66" cy="66" r="56" fill="none" stroke="var(--ring-track,#e5e7eb)" stroke-width="12"/>';
    if (score < 0) s += arc(-score / CAP, '#dc2626'); else { s += arc(score / start, '#16a34a'); if (score > start) s += arc((score - start) / CAP, '#2563eb'); }
    var cls = score < 0 ? 'neg' : (score > start ? 'over' : ''), sub = score < 0 ? 'ติดลบ' : (score > start ? 'เกิน +' + (score - start) : 'จาก ' + start);
    return '<div class="sring ' + cls + '" title="คะแนน ' + score + '"><svg viewBox="0 0 132 132" aria-hidden="true">' + s + '</svg><div class="in"><b>' + score + '</b><small>' + sub + '</small></div></div>';
  };
  function put(el, html) { if (!el) return; if (el._h === html && el.innerHTML === el._raw) return; el.innerHTML = html; el._h = html; el._raw = el.innerHTML; } // 2.13.0: เขียนทับเฉพาะเมื่อเนื้อหาเปลี่ยน
  function sgn(n) { return n > 0 ? '+' + n : String(n); }
  function ic(n) { return '<i class="fa-solid ' + n + '" aria-hidden="true"></i>'; }

  // ---------- ช่วงวันที่ ----------
  var TERM_START = '', YEAR_START = '';
  getSiteSettings().then(function (s) { try { var sch = termScheduleOf(s), now = new Date(), md = pad(now.getMonth() + 1) + '-' + pad(now.getDate()), y = now.getFullYear(); TERM_START = md >= sch.term2Start ? y + '-' + sch.term2Start : (md >= sch.term1Start ? y + '-' + sch.term1Start : (y - 1) + '-' + sch.term2Start); YEAR_START = (md >= sch.term1Start ? y : y - 1) + '-' + sch.term1Start; } catch (e) { TERM_START = ''; YEAR_START = ''; } });
  function rangeOf() {
    var t = B ? B.today : ymd(new Date()), d = dP(t);
    if (st.range === 'today') return [t, t];
    if (st.range === 'week') { var m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return [ymd(m), t]; }
    if (st.range === 'month') return [t.slice(0, 8) + '01', t];
    if (st.range === 'term') return [TERM_START && TERM_START <= t ? TERM_START : t.slice(0, 5) + '01-01', t];
    if (st.range === 'year') return [YEAR_START && YEAR_START <= t ? YEAR_START : (+t.slice(0, 4) - (t.slice(5) < '05-01' ? 1 : 0)) + '-05-01', t]; // 2.08.0: ปีการศึกษานี้
    return [st.from || t, st.to || t];
  }
  function rangeTxt() { var r = rangeOf(); return thD(r[0], true) + (r[0] !== r[1] ? ' – ' + thD(r[1], true) : ''); }

  // ---------- โหลด ----------
  async function boot() {
    try { B = await apiCall('careBoot', {}); } catch (e) { tabsEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    document.getElementById('ccIntro').textContent = 'ข้อมูลการมาสายและคะแนนพฤติกรรมจาก BNK Care Center · ภาคเรียนที่ ' + B.term + '/' + B.year;
    renderTabs(); show();
    if (B.role === 'm' && B.settings && B.settings.skipOn && st.tab !== 'skip') loadSkip(true); // ตัวเลขรอยืนยันบนแท็บ (โหลดเบื้องหลัง)
  }
  // ---------- 2.13.0: โดด / ขาดเรียน (จากเว็บเช็คชื่อ) — ยืนยันก่อนหักคะแนน ----------
  var SK_CAT = [['pend', 'รอยืนยัน'], ['ok', 'ยืนยันแล้ว'], ['no', 'ไม่หัก'], ['back', 'ต้องคืนคะแนน']];
  function skBadge() { var e = document.getElementById('ccSkipN'); if (!e) return; e.textContent = SK.n; e.hidden = !SK.n; }
  async function loadSkip(quiet) {
    try { var r = await apiCall('careSkipList', {}); SK.d = r; SK.n = (r.items || []).filter(function (x) { return x.cat === 'pend' || x.cat === 'back'; }).length; skBadge(); if (st.tab === 'skip') paintSkip(); }
    catch (e) { if (!quiet) body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; }
  }
  function showSkip() {
    if (SK.d) paintSkip(); else body.innerHTML = '<div class="loading">กำลังดึงข้อมูลจากเว็บเช็คชื่อ...</div>';
    loadSkip(!!SK.d);
  }
  function paintSkip() {
    var D = SK.d; if (!D) return;
    if (D.off) { body.innerHTML = '<div class="card">' + err('ยังไม่ได้เปิดใช้ โดด / ขาดเรียน — เปิดได้ที่แท็บ ตั้งค่า › โดด / ขาดเรียน') + '</div>'; return; }
    var all = D.items || [], cnt = {}, sum = {}, r = D.rules || {};
    all.forEach(function (x) { cnt[x.cat] = (cnt[x.cat] || 0) + 1; sum[x.cat] = (sum[x.cat] || 0) + (Number(x.delta) || 0); });
    var L = all.filter(function (x) { return x.cat === SK.cat; }), by = {}, days = [];
    if (SK.cat !== 'pend') L.sort(function (a, b) { return b.d.localeCompare(a.d); });
    L.forEach(function (x) { if (!by[x.d]) { by[x.d] = []; days.push(x.d); } by[x.d].push(x); });
    Object.keys(SK.sel).forEach(function (k) { if (!L.some(function (x) { return x.k === k; })) delete SK.sel[k]; });
    var nSel = Object.keys(SK.sel).length, selSum = L.reduce(function (a, x) { return a + (SK.sel[x.k] ? Number(x.delta) || 0 : 0); }, 0);
    var st4 = function (t, v, c, sub) { return '<div class="cc-st"><span>' + t + '</span><b style="color:' + c + '">' + v + '</b><small>' + sub + '</small></div>'; };
    var rule = '-' + r.skipPts + ' / คาบ' + (r.skipPartial ? ' · ขาดบางคาบ = โดด' : '') + (r.absOn ? ' · ขาดทั้งวัน -' + r.absPts + ' / วัน' : ' · ขาดทั้งวัน: ไม่หัก') + (r.skipMax ? ' · สูงสุด -' + r.skipMax + ' / วัน' : '');
    var row = function (x) {
      var kc = x.kind === 'skip' ? 'sk' : 'ab';
      return '<label class="cc-skr"><input type="checkbox" data-cc-skk="' + esc(x.k) + '"' + (SK.sel[x.k] ? ' checked' : '') + ' /><span class="cc-skm"><b>' + esc(x.name) + '</b> <span class="cc-mut">· ' + esc(x.room) + (x.no ? ' เลขที่ ' + esc(x.no) : '') + '</span>' +
        '<small>' + esc(x.note || '') + (x.by ? ' · เช็คโดย ' + esc(x.by) : '') + (x.mBy && x.cat !== 'pend' ? ' · ' + (x.cat === 'no' ? 'ไม่หักโดย ' : 'ยืนยันโดย ') + esc(x.mBy) : '') + (x.cat === 'back' ? ' · ครูแก้สถานะในเว็บเช็คชื่อแล้ว' : '') + '</small></span>' +
        '<span class="cc-skb ' + kc + '">' + esc(x.label) + '</span><b class="cc-skd">' + (x.cat === 'no' ? '0' : sgn(Number(x.delta) || 0)) + (x.capped ? '<small title="ถึงเพดานหักต่อวัน">เพดาน</small>' : '') + '</b></label>';
    };
    var acts = SK.cat === 'pend' ? '<button type="button" class="btn btn-ghost btn-sm" data-cc-skop="no">' + ic('fa-ban') + ' ไม่หัก</button><button type="button" class="btn btn-sm cc-skok" data-cc-skop="ok">' + ic('fa-check') + ' ยืนยันหักคะแนน</button>'
      : SK.cat === 'back' ? '<button type="button" class="btn btn-sm cc-skok" data-cc-skop="undo">' + ic('fa-rotate-left') + ' คืนคะแนน</button>'
      : '<button type="button" class="btn btn-ghost btn-sm" data-cc-skop="undo">' + ic('fa-rotate-left') + (SK.cat === 'ok' ? ' ยกเลิกการหัก (คืนคะแนน → กลับไปรอยืนยัน)' : ' กลับไปรอยืนยัน') + '</button>';
    put(body, '<div class="cc-skh">' + ic('fa-rotate') + ' ข้อมูลจากเว็บเช็คชื่อ ' + esc(thD(D.from, 1)) + ' – ' + esc(thD(D.to, 1)) + ' (ระยะเวลาการเช็คชื่อ) · ดึงเมื่อ ' + esc(new Date(D.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })) + ' น. <button type="button" class="btn btn-secondary btn-sm" data-cc-skre>' + ic('fa-rotate') + ' ดึงใหม่</button></div>' +
      (D.more ? '<div class="cc-warn">' + ic('fa-triangle-exclamation') + ' รายการมากเกิน 5,000 แถว — แสดงเฉพาะส่วนแรก</div>' : '') +
      '<div class="cc-sts">' + st4('รอยืนยัน', cnt.pend || 0, '#e11d48', 'หักรวม ' + sgn(sum.pend || 0) + ' ถ้ายืนยันทั้งหมด') + st4('ยืนยันแล้ว', cnt.ok || 0, '#15803d', 'หักไปแล้ว ' + sgn(sum.ok || 0)) + st4('ต้องคืนคะแนน', cnt.back || 0, '#c2410c', 'ครูแก้สถานะภายหลัง') + st4('กฎที่ใช้', '-' + r.skipPts + ' / คาบ', '#334155', esc(rule.replace(/^-\d+ \/ คาบ( · )?/, '') || '—')) + '</div>' +
      '<div class="cc-seg cc-sks" role="tablist">' + SK_CAT.map(function (c) { return '<button type="button" data-cc-skc="' + c[0] + '" class="' + (SK.cat === c[0] ? 'on' : '') + '">' + c[1] + (cnt[c[0]] ? ' <span class="cc-skn' + (c[0] === 'back' ? ' o' : '') + '">' + cnt[c[0]] + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      (L.length ? '<div class="card cc-skl">' + days.map(function (d) { var all1 = by[d].every(function (x) { return SK.sel[x.k]; }); return '<label class="cc-skday"><input type="checkbox" data-cc-skday="' + d + '"' + (all1 ? ' checked' : '') + ' /> ' + esc(thD(d, 1)) + ' <span class="cc-mut">· ' + by[d].length + ' รายการ</span></label>' + by[d].map(row).join(''); }).join('') +
        '<div class="cc-skbar"><b>เลือก ' + nSel + ' รายการ' + (SK.cat === 'pend' && nSel ? ' · หักรวม ' + sgn(selSum) : '') + '</b><button type="button" class="btn btn-ghost btn-sm" data-cc-skall>' + (nSel === L.length ? 'ไม่เลือกเลย' : 'เลือกทั้งหมด') + '</button><span class="cc-skacts">' + acts + '</span></div></div>'
        : '<div class="card"><p class="cc-mut" style="text-align:center;padding:18px">' + (SK.cat === 'pend' ? 'ไม่มีรายการรอยืนยัน 🎉' : 'ไม่มีรายการ') + '</p></div>'));
  }
  async function skipDo(op) {
    var keys = Object.keys(SK.sel); if (!keys.length) { showToast('ยังไม่ได้เลือกรายการ', true); return; }
    if (op !== 'ok' && !(await askConfirm(op === 'no' ? 'ไม่หักคะแนน ' + keys.length + ' รายการ?' : (SK.cat === 'pend' ? '' : 'ยกเลิก / คืนคะแนน ' + keys.length + ' รายการ? (คะแนนที่หักไปจะถูกลบออก)'), op === 'no' ? 'ไม่หัก' : 'ยืนยัน'))) return;
    var r = await withProgress(op === 'ok' ? 'กำลังหักคะแนน' : 'กำลังบันทึก', async function (ctl) {
      for (var i = 0; i < keys.length; i += 60) { ctl.setProgress(Math.round(i / keys.length * 100)); await apiCall('careSkipApply', { op: op, keys: keys.slice(i, i + 60) }); }
      return true;
    }, { successLabel: op === 'ok' ? 'หักคะแนนแล้ว ' + keys.length + ' รายการ' : 'บันทึกแล้ว' });
    if (!r.ok) return;
    SK.sel = {}; C.sc = {}; C.ov = {}; C.bh = {}; C.rm = {}; C.rd = {};
    await loadSkip();
  }
  function renderTabs() {
    var t = [['summary', 'fa-chart-pie', 'สรุปรวม'], ['late', 'fa-clock', 'มาสาย'], ['scores', 'fa-star', 'คะแนนพฤติกรรม']];
    if (B.role === 'm' && B.settings && B.settings.skipOn) t.push(['skip', 'fa-person-walking-arrow-right', 'โดด / ขาดเรียน']); // 2.13.0
    if (B.role === 'm') t.push(['settings', 'fa-sliders', 'ตั้งค่า']);
    var cur = isLate() ? 'late' : st.tab;
    tabsEl.innerHTML = t.map(function (x) { return '<button type="button" class="tab-btn' + (x[0] === cur ? ' active' : '') + '" data-cc-tab="' + x[0] + '">' + ic(x[1]) + ' ' + x[2] + (x[0] === 'skip' ? '<span class="cc-skn" id="ccSkipN"' + (SK.n ? '' : ' hidden') + '>' + SK.n + '</span>' : '') + '</button>'; }).join('');
  }
  // 2.07.0: แท็บ "มาสาย" มีแท็บย่อย ภาพรวม · รายห้อง · สายบ่อย (st.tab = แท็บย่อย · st.late = แท็บย่อยล่าสุด)
  function isLate(t) { t = t || st.tab; return t === 'overview' || t === 'rooms' || t === 'frequent'; }
  function goTab(t) { if (t === 'late') t = st.late || 'overview'; if (isLate(t)) st.late = t; st.tab = t; renderTabs(); show(); }
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-cc-tab]'); if (!b) return; var t = b.getAttribute('data-cc-tab'); if ((t === st.tab || (t === 'late' && isLate(st.tab))) && body.querySelector('.cc-cap, .card')) return; /* 2.13.0: กดแท็บเดิมซ้ำ = ไม่วาดใหม่ */ goTab(t); });
  function show() { if (st.tab === 'skip') return showSkip(); if (st.tab === 'summary') return showSummary(); if (st.tab === 'scores') return showScores(); if (st.tab === 'settings') return showSettings(); if (st.tab === 'rooms') return showRooms(); return showOverview(); }
  function subBar() {
    if (!isLate()) return '';
    return '<div class="cc-sub cc-noexp" role="tablist">' + [['overview', 'fa-chart-column', 'ภาพรวม'], ['rooms', 'fa-door-open', 'รายห้อง'], ['frequent', 'fa-user-clock', 'สายบ่อย']].map(function (x) { return '<button type="button" class="' + (st.tab === x[0] ? 'on' : '') + '" data-cc-go="' + x[0] + '">' + ic(x[1]) + ' ' + x[2] + '</button>'; }).join('') + '</div>';
  }

  // ---------- แถบตัวกรอง + ปุ่มส่งออก ----------
  function exportBtns() {
    return '<span class="cc-ex"><button type="button" class="btn btn-sm cc-ex-pdf" data-cc-ex="pdf">' + ic('fa-file-pdf') + ' PDF</button>' +
      '<button type="button" class="btn btn-sm cc-ex-img" data-cc-ex="img">' + ic('fa-image') + ' รูปภาพ</button>' +
      '<button type="button" class="btn btn-sm btn-success" data-cc-ex="xls">' + ic('fa-file-excel') + ' Excel</button></span>';
  }
  function filterBar(extra, noRange) {
    var r = rangeOf(), seg = [['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้'], ['term', 'ภาคเรียนนี้'], ['year', 'ปีการศึกษานี้'], ['custom', 'กำหนดเอง']];
    return subBar() + '<div class="cc-flt">' + (noRange ? '' : '<div class="cc-seg">' + seg.map(function (x) { return '<button type="button" data-cc-rg="' + x[0] + '" class="' + (st.range === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      (st.range === 'custom' ? '<input type="date" id="ccFrom" value="' + r[0] + '" max="' + B.today + '" /> – <input type="date" id="ccTo" value="' + r[1] + '" max="' + B.today + '" />' : '')) +
      '<select id="ccGrade" aria-label="ระดับชั้น"><option value="">ทุกระดับชั้น</option>' + [1, 2, 3, 4, 5, 6].map(function (g) { return '<option value="m' + g + '"' + (st.grade === 'm' + g ? ' selected' : '') + '>ม.' + g + '</option>'; }).join('') + '</select>' + (extra || '') +
      '<span class="cc-sp"></span>' + (noRange ? '' : '<span class="cc-rtxt">' + rangeTxt() + '</span>') + exportBtns() + '</div>';
  }
  function capHead(title) { // หัวกระดาษ (แสดงเฉพาะตอนส่งออก/พิมพ์)
    return '<div class="cc-caphead"><b>' + esc(title) + '</b><span>โรงเรียนบุ่งคล้านคร · ' + (st.tab === 'scores' ? esc(periodTxt()) : (st.tab === 'summary' ? 'คะแนน' + esc(periodTxt().replace(/^นับ ?/, ' ')) + ' · กิจกรรมช่วงวันที่ ' : 'ช่วงวันที่ ') + rangeTxt()) + (st.grade ? ' · ม.' + st.grade.slice(1) : '') + '</span></div>';
  }

  // ---------- สรุปรวม / สายบ่อย ----------
  async function loadOv() {
    var r = rangeOf(), k = r[0] + '|' + r[1] + '|' + st.grade;
    if (!C.ov[k]) C.ov[k] = await apiCall('careOverview', { from: r[0], to: r[1], grade: st.grade });
    return C.ov[k];
  }
  // 2.13.0: โหลดข้อมูลชุดใหม่ = ของเดิมจางค้างไว้ (ไม่ล้างเป็น "กำลังโหลด" ให้กระพริบ) · วาดผลใหม่ทับเมื่อมาถึง
  function keepOf(id) { var o = document.getElementById(id); return o && o.innerHTML && !o.querySelector('.loading, .error-box') ? o.innerHTML : ''; }
  function restore(id, k) { var n = document.getElementById(id); if (n && k) n.innerHTML = '<div class="is-reloading">' + k + '</div>'; }
  function stat(t, v, c, sub) { return '<div class="cc-st"><span>' + t + '</span><b' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>'; }
  async function showOverview() {
    var freq = st.tab === 'frequent';
    var kp = keepOf('ccOv');
    body.innerHTML = filterBar(freq ? '<select id="ccMin" aria-label="จำนวนครั้ง">' + [2, 3, 5, 10].map(function (n) { return '<option value="' + n + '"' + (st.min === n ? ' selected' : '') + '>สาย ' + n + ' ครั้งขึ้นไป</option>'; }).join('') + '</select>' : '') + '<div id="ccOv" class="cc-cap"><div class="loading">กำลังโหลด...</div></div>'; restore('ccOv', kp);
    var box = document.getElementById('ccOv'), O;
    try { O = await loadOv(); } catch (e) { box.innerHTML = err(e.message); return; }
    if (st.tab !== (freq ? 'frequent' : 'overview')) return;
    if (freq) { box.innerHTML = capHead('นักเรียนที่สาย ' + st.min + ' ครั้งขึ้นไป') + freqHtml(O); return; }
    var mx = Math.max.apply(null, [1].concat(O.byDay.map(function (x) { return x.n; }))), rmx = Math.max.apply(null, [1].concat(O.reasons.map(function (x) { return x.n; })));
    var gr = {}; O.byRoom.forEach(function (x) { var g = /^m(\d)/.exec(x.roomId); g = g ? 'ม.' + g[1] : '-'; gr[g] = (gr[g] || 0) + x.n; });
    var gk = Object.keys(gr).sort(), gmx = Math.max.apply(null, [1].concat(gk.map(function (k) { return gr[k]; })));
    var h = capHead('สรุปการมาสาย') +
      '<div class="cc-sts">' + stat('มาสายวันนี้', O.todayN) + stat('มาสายในช่วงที่เลือก (ครั้ง)', O.total, '', O.selfN ? 'นักเรียนแจ้งเอง ' + O.selfN + ' ครั้ง' : '') + stat('นักเรียนที่สาย (ไม่ซ้ำคน)', O.students) + stat('สาย ≥ ' + O.notifyN + ' ครั้งในเดือนนี้ (คน)', O.monthFreq, O.monthFreq ? '#b91c1c' : '') + '</div>';
    h += '<div class="cc-grid"><div class="card cc-card"><h3>' + ic('fa-chart-column') + ' จำนวนนักเรียนมาสายรายวัน</h3>' +
      (O.byDay.length ? '<div class="cc-bars">' + O.byDay.slice(-31).map(function (x) { var d = dP(x.date); return '<div title="' + thD(x.date, true) + ' · ' + x.n + ' คน"><em>' + x.n + '</em><i style="height:' + Math.max(4, Math.round(x.n / mx * 130)) + 'px"></i>' + DW[d.getDay()] + ' ' + d.getDate() + '</div>'; }).join('') + '</div>' : '<p class="hint">ไม่มีการมาสายในช่วงนี้</p>') +
      '<h3 style="margin-top:16px">' + ic('fa-layer-group') + ' มาสายรายระดับชั้น</h3>' +
      (gk.length ? '<div class="cc-rs cc-gb">' + gk.map(function (k) { return '<div><span>' + esc(k) + '</span><i style="width:' + Math.max(3, Math.round(gr[k] / gmx * 100)) + '%;background:#c8102e"></i><b>' + gr[k] + '</b></div>'; }).join('') + '</div>' : '<p class="hint">-</p>') +
      '<p class="hint cc-noexp"><a href="#" data-cc-go="rooms">' + ic('fa-door-open') + ' ดูสรุปรายห้อง</a></p></div>';
    var fN = Math.min(O.frequent.length, st.fqN || 10);
    h += '<div class="card cc-card"><h3>' + ic('fa-triangle-exclamation') + ' สายบ่อยในช่วงนี้ <small class="mut" style="font-weight:500">· ' + O.frequent.length + ' คน</small></h3>' + freqTable(O.frequent.slice(0, fN)) +
      (O.frequent.length > fN ? '<p class="cc-more cc-noexp"><button type="button" class="btn btn-secondary btn-sm" data-cc-fmore>' + ic('fa-chevron-down') + ' แสดงเพิ่ม (' + fN + ' จาก ' + O.frequent.length + ' คน)</button></p>' : '') +
      '<h3 style="margin-top:16px">' + ic('fa-list') + ' สาเหตุ</h3>' +
      (O.reasons.length ? '<div class="cc-rs">' + O.reasons.slice().sort(function (a, b) { return (a.reason ? 0 : 1) - (b.reason ? 0 : 1) || b.n - a.n; }).map(function (x, i) { return '<div><span' + (x.reason ? '' : ' class="mut"') + '>' + esc(x.reason || 'ไม่ระบุ') + '</span><i style="width:' + Math.max(3, Math.round(x.n / rmx * 100)) + '%;background:' + (x.reason ? PAL[i % PAL.length] : '#cbd5e1') + '"></i><b>' + x.n + '</b></div>'; }).join('') + '</div>' : '<p class="hint">-</p>') + '</div></div>';
    box.innerHTML = h;
  }
  function freqTable(list) {
    if (!list.length) return '<p class="hint">ไม่มีข้อมูล</p>';
    return '<div class="cc-tw"><table class="cc-t cc-ft"><thead><tr><th>นักเรียน</th><th class="cc-dk">ห้อง</th><th>ครั้ง</th><th class="cc-dk">คะแนน</th></tr></thead><tbody>' + list.map(function (x) { // 2.08.0: มือถือ = ชื่อ + (ห้อง · เลขที่ · คะแนน) บรรทัดเดียว
      return '<tr class="cc-click" data-cc-stu="' + esc(x.key) + '"><td><span class="cc-fn">' + esc(x.name) + '</span> <small class="mut cc-dk">เลขที่ ' + esc(x.no) + '</small><small class="mut cc-mo">' + esc(x.room) + ' เลขที่ ' + esc(x.no) + ' · คะแนน ' + x.score + '</small></td><td class="cc-dk">' + esc(x.room) + '</td><td><span class="cc-tg ' + (x.n >= 5 ? 'r' : (x.n >= 3 ? 'o' : 'n')) + '">' + x.n + (x.n ? ' ครั้ง' : '') + '</span></td><td class="cc-dk">' + x.score + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }
  function freqList(O) { return O.frequent.filter(function (x) { return x.n >= st.min; }); }
  function freqHtml(O) {
    var list = freqList(O);
    return '<div class="card cc-card"><h3>' + ic('fa-user-clock') + ' นักเรียนที่สาย ' + st.min + ' ครั้งขึ้นไป · ' + list.length + ' คน</h3><p class="hint cc-noexp">แตะชื่อเพื่อดูประวัติการมาสายและคะแนน</p>' + freqTable(list) + '</div>';
  }

  // ---------- 2.07.0: สรุปรวม (พฤติกรรม) ----------
  async function showSummary() {
    var r = rangeOf(), k = r[0] + '|' + r[1] + '|' + st.grade;
    var kp = keepOf('ccBh');
    body.innerHTML = filterBar('') + '<div id="ccBh" class="cc-cap"><div class="loading">กำลังโหลด...</div></div>'; restore('ccBh', kp);
    var box = document.getElementById('ccBh'), S;
    try { if (!C.bh[k]) C.bh[k] = await apiCall('careBehavior', { from: r[0], to: r[1], grade: st.grade }); S = C.bh[k]; } catch (e) { box.innerHTML = err(e.message); return; }
    if (st.tab !== 'summary') return;
    box.innerHTML = summaryHtml(S);
  }
  function tagP(t) { return ' <span class="cc-pp' + (t === 'r' ? ' r' : '') + '">' + (t === 'r' ? 'ช่วงที่เลือก' : 'รอบปัจจุบัน') + '</span>'; }
  function summaryHtml(S) {
    var sc = S.score, A = S.adj, ST = S.settings, pc = function (n) { return sc.n ? Math.round(n / sc.n * 100) + '%' : '-'; };
    var h = capHead('สรุปรวมคะแนนพฤติกรรม') + '<div class="cc-sts cc-sts6">' +
      stat('คะแนนเฉลี่ย' + tagP(), sc.avg, '', sc.n + ' คน · เริ่มต้น ' + ST.startPoints) +
      stat('ระดับดี (≥ ' + ST.good + ')', sc.good, '#15803d', pc(sc.good) + ' ของนักเรียน') +
      stat('ระดับพอใช้', sc.fair, '#a16207', pc(sc.fair)) +
      stat('ต้องปรับปรุง · ติดลบ', '<span style="color:#c2410c">' + sc.low + '</span> · <span style="color:#b91c1c">' + sc.neg + '</span>', '', 'ต่ำกว่า ' + ST.fair + ' คะแนน') +
      stat('รวมหัก' + tagP('r'), A.minus, A.minus ? '#b91c1c' : '', A.late ? 'จากมาสาย ' + (-A.late) : '') +
      stat('รวมเพิ่ม' + tagP('r'), sgn(A.plus), A.plus ? '#2563eb' : '', A.count + ' ครั้งที่บันทึก') + '</div>';
    // ระดับแยกชั้น
    var gk = Object.keys(S.byGrade).sort(), seg = [['good', '#22c55e', 'ดี'], ['fair', '#facc15', 'พอใช้'], ['low', '#f97316', 'ต้องปรับปรุง'], ['neg', '#dc2626', 'ติดลบ']];
    h += '<div class="cc-grid2"><div class="card cc-card"><h3>' + ic('fa-layer-group') + ' ระดับพฤติกรรมแยกชั้น' + tagP() + '</h3><div class="cc-lg">' + seg.map(function (x) { return '<span><i style="background:' + x[1] + '"></i>' + x[2] + '</span>'; }).join('') + '</div>' +
      (gk.length ? '<div class="cc-stk">' + gk.map(function (k) { var x = S.byGrade[k]; return '<div><span>ม.' + k.slice(1) + '</span><div class="cc-stb">' + seg.map(function (z) { return x[z[0]] ? '<i style="width:' + (x[z[0]] / x.n * 100) + '%;background:' + z[1] + '" title="' + z[2] + ' ' + x[z[0]] + ' คน"></i>' : ''; }).join('') + '</div><b>' + x.n + ' คน</b><small>เฉลี่ย ' + x.avg + '</small></div>'; }).join('') + '</div>' : '<p class="hint">ยังไม่มีรายชื่อนักเรียน</p>') + '</div>';
    // รายการ
    var minusAll = S.items.reduce(function (a, x) { return a + (x.s < 0 ? x.s : 0); }, 0), its = S.items.slice(0, 12);
    h += '<div class="card cc-card"><h3>' + ic('fa-list-check') + ' รายการที่ถูกหัก / เพิ่มบ่อย' + tagP('r') + '</h3>' +
      (its.length ? '<div class="cc-il">' + its.map(function (x) { return '<div><span>' + esc(x.item) + (x.late && minusAll ? ' <small class="mut">(' + Math.round(x.s / minusAll * 100) + '% ของคะแนนที่หัก)</small>' : '') + '</span><small>' + x.n + ' ครั้ง</small><b class="' + (x.s < 0 ? 'cc-m' : 'cc-pl') + '">' + sgn(x.s) + '</b></div>'; }).join('') + '</div>' + (S.items.length > its.length ? '<p class="hint">และอีก ' + (S.items.length - its.length) + ' รายการ (ดูครบใน Excel)</p>' : '') : '<p class="hint">ไม่มีการหัก/เพิ่มคะแนนในช่วงนี้</p>') + '</div>';
    // รายวัน
    var dmx = Math.max.apply(null, [1].concat(S.byDay.map(function (x) { return Math.max(-x.m, x.p); })));
    h += '<div class="card cc-card"><h3>' + ic('fa-chart-column') + ' หัก / เพิ่ม รายวัน' + tagP('r') + '</h3><div class="cc-lg"><span><i style="background:#ef4444"></i>หัก</span><span><i style="background:#3b82f6"></i>เพิ่ม</span></div>' +
      (S.byDay.length ? '<div class="cc-bars cc-bars2">' + S.byDay.slice(-31).map(function (x) { var d = dP(x.date); return '<div title="' + thD(x.date, true) + ' · หัก ' + (-x.m) + ' · เพิ่ม ' + x.p + '"><span class="cc-bp"><i class="m" style="height:' + (x.m ? Math.max(3, Math.round(-x.m / dmx * 120)) : 0) + 'px"></i><i class="p" style="height:' + (x.p ? Math.max(3, Math.round(x.p / dmx * 120)) : 0) + 'px"></i></span>' + DW[d.getDay()] + ' ' + d.getDate() + '</div>'; }).join('') + '</div>' : '<p class="hint">ไม่มีข้อมูลในช่วงนี้</p>') + '</div>';
    // ห้อง
    var rl = function (L) { return L.length ? L.map(function (x) { return '<div class="cc-click" data-cc-go="rooms" data-r="' + esc(x.roomId) + '"><span>' + esc(x.room) + '</span><b>' + x.avg + '</b></div>'; }).join('') : '<p class="hint">-</p>'; };
    h += '<div class="card cc-card"><h3>' + ic('fa-door-open') + ' ห้องคะแนนเฉลี่ย' + tagP() + '</h3><div class="cc-2c"><div><h4 class="cc-m">ต่ำสุด ' + S.roomsLow.length + ' ห้อง</h4><div class="cc-il">' + rl(S.roomsLow) + '</div></div><div><h4 class="cc-p">สูงสุด ' + S.roomsHigh.length + ' ห้อง</h4><div class="cc-il">' + rl(S.roomsHigh) + '</div></div></div><p class="hint cc-noexp">' + ic('fa-hand-pointer') + ' กดที่ห้องเพื่อดูรายคน</p></div>';
    // ต้องติดตาม + สูงสุด
    var sl = function (L, medal) { return '<div class="cc-il">' + L.map(function (x, i) { return '<div class="cc-click" data-cc-stu="' + esc(x.key) + '"><span>' + (medal ? (['🥇', '🥈', '🥉'][i] || (i + 1) + '.') + ' ' : '') + esc(x.room) + ' เลขที่ ' + esc(x.no) + ' · ' + esc(x.name) + '</span><b class="' + (x.score < 0 ? 'cc-m' : (x.score > ST.startPoints ? 'cc-pl' : '')) + '">' + x.score + '</b></div>'; }).join('') + '</div>'; };
    var WN = S.watch.slice(0, st.watchAll ? 300 : 10);
    h += '<div class="card cc-card"><h3>' + ic('fa-triangle-exclamation') + ' นักเรียนที่ต้องติดตาม <span class="cc-m">' + S.watchN + ' คน</span>' + tagP() + '</h3><p class="hint" style="margin-top:-4px">ต่ำกว่าเกณฑ์ "ต้องปรับปรุง" (' + ST.fair + ' คะแนน) · เรียงจากต่ำสุด · กดชื่อดูประวัติ</p>' +
      (WN.length ? sl(WN) : '<p class="hint">ไม่มีนักเรียนที่ต่ำกว่าเกณฑ์ 👍</p>') + (S.watchN > WN.length ? '<p class="hint cc-noexp"><a href="#" data-cc-wall>ดูทั้งหมด ' + Math.min(S.watchN, 300) + ' คน</a>' + (S.watchN > 300 ? ' (Excel ส่งออก 300 คนแรก)' : '') + '</p>' : '') + '</div>';
    h += '<div class="card cc-card"><h3>' + ic('fa-medal') + ' คะแนนสูงสุด 10 อันดับ <small class="mut" style="font-weight:500">(ชมเชย)</small>' + tagP() + '</h3>' + (S.top.length ? sl(S.top, true) : '<p class="hint">-</p>') + '</div></div>';
    return h;
  }

  // ---------- 2.04.0: สรุปรายห้อง ----------
  async function showRooms() {
    var r = rangeOf();
    var kp = keepOf('ccRm');
    body.innerHTML = filterBar('') + '<div id="ccRm" class="cc-cap"><div class="loading">กำลังโหลด...</div></div>'; restore('ccRm', kp);
    var box = document.getElementById('ccRm');
    try {
      if (st.rroom) { var k = r[0] + '|' + r[1] + '|' + st.rroom; if (!C.rd[k]) C.rd[k] = await apiCall('careRoomDetail', { from: r[0], to: r[1], roomId: st.rroom }); if (st.tab === 'rooms') box.innerHTML = roomDetailHtml(C.rd[k]); return; }
      var k2 = r[0] + '|' + r[1]; if (!C.rm[k2]) C.rm[k2] = await apiCall('careRooms', { from: r[0], to: r[1] });
      if (st.tab === 'rooms') box.innerHTML = roomsHtml(C.rm[k2]);
    } catch (e) { box.innerHTML = err(e.message); }
  }
  function roomsList(R) { return R.rooms.filter(function (x) { return !st.grade || x.roomId.indexOf(st.grade + '_') === 0; }); }
  function lvPills(lv) { return '<span class="cc-lv g">' + lv.good + '</span><span class="cc-lv y">' + lv.fair + '</span><span class="cc-lv o">' + lv.low + '</span><span class="cc-lv r">' + (lv.neg || 0) + '</span>'; }
  function roomsHtml(R) {
    var L = roomsList(R), T = { total: 0, late: 0, lateStu: 0, minus: 0, plus: 0, sum: 0, lv: { good: 0, fair: 0, low: 0, neg: 0 } };
    L.forEach(function (x) { T.total += x.total; T.late += x.late; T.lateStu += x.lateStu; T.minus += x.minus; T.plus += x.plus; T.sum += x.avg * x.total; ['good', 'fair', 'low', 'neg'].forEach(function (k) { T.lv[k] += x.levels[k] || 0; }); });
    return capHead('สรุปรายห้อง') + '<div class="card cc-card"><div class="cc-tw"><table class="cc-t cc-rt"><thead><tr><th>ห้อง</th><th>ครูที่ปรึกษา</th><th>นักเรียน</th><th>มาสาย (ครั้ง)</th><th>มาสาย (คน)</th><th>หักคะแนน</th><th>เพิ่มคะแนน</th><th>คะแนนเฉลี่ย</th><th>ดี / พอใช้ / ปรับปรุง / ติดลบ</th></tr></thead><tbody>' +
      L.map(function (x) {
        return '<tr class="cc-click" data-cc-room="' + esc(x.roomId) + '"><td><b>' + esc(x.room) + '</b></td><td>' + esc((x.advisors || []).join(', ') || '-') + '</td><td>' + x.total + '</td><td>' + (x.late || '-') + '</td><td>' + (x.lateStu || '-') + '</td>' +
          '<td class="cc-m">' + (x.minus || '-') + '</td><td class="cc-p">' + (x.plus ? '+' + x.plus : '-') + '</td><td><b>' + x.avg + '</b></td><td>' + lvPills(x.levels) + '</td></tr>';
      }).join('') + '</tbody><tfoot><tr><td><b>รวม ' + L.length + ' ห้อง</b></td><td></td><td>' + T.total + '</td><td>' + T.late + '</td><td>' + T.lateStu + '</td><td class="cc-m">' + T.minus + '</td><td class="cc-p">+' + T.plus + '</td><td><b>' + (T.total ? Math.round(T.sum / T.total * 10) / 10 : 0) + '</b></td><td>' + lvPills(T.lv) + '</td></tr></tfoot></table></div>' +
      '<p class="hint cc-noexp">' + ic('fa-hand-pointer') + ' กดที่ห้องเพื่อดูรายคน · มาสาย/หัก/เพิ่ม = ในช่วงวันที่ที่เลือก · คะแนนเฉลี่ยและระดับ = รอบคะแนนปัจจุบัน · ระดับ ดี ≥ ' + R.settings.good + ' · พอใช้ ≥ ' + R.settings.fair + '</p></div>';
  }
  function roomDetailHtml(D) {
    var lv = { good: 0, fair: 0, low: 0, neg: 0 }; D.list.forEach(function (x) { lv[x.score < 0 ? 'neg' : x.level]++; });
    return '<div class="cc-noexp" style="margin-bottom:10px"><button type="button" class="btn btn-secondary btn-sm" data-cc-room="">' + ic('fa-chevron-left') + ' ทุกห้อง</button></div>' +
      capHead('สรุปห้อง ' + D.room) + '<div class="card cc-card"><h3>' + ic('fa-door-open') + ' ห้อง ' + esc(D.room) + ' <small class="mut" style="font-weight:500">· ครูที่ปรึกษา ' + esc((D.advisors || []).join(', ') || '-') + ' · คะแนน' + esc(D.period) + '</small></h3>' +
      '<div class="cc-tw"><table class="cc-t"><thead><tr><th>เลขที่</th><th>ชื่อ-นามสกุล</th><th>มาสาย</th><th>หักคะแนน</th><th>เพิ่มคะแนน</th><th>คะแนน</th></tr></thead><tbody>' +
      D.list.map(function (x) { return '<tr class="cc-click" data-cc-stu="' + esc(x.key) + '"><td>' + esc(x.no) + '</td><td>' + esc(x.name) + '</td><td>' + (x.late || '-') + '</td><td class="cc-m">' + (x.minus || '-') + '</td><td class="cc-p">' + (x.plus ? '+' + x.plus : '-') + '</td><td><span class="cc-tg ' + lvCls(x.level, x.score) + '">' + x.score + '</span></td></tr>'; }).join('') +
      '</tbody></table></div><p class="hint">ดี ' + lv.good + ' คน · พอใช้ ' + lv.fair + ' คน · ต้องปรับปรุง ' + lv.low + ' คน · ติดลบ ' + lv.neg + ' คน</p></div>';
  }

  // ---------- คะแนนพฤติกรรม ----------
  async function showScores() {
    var k = st.room || 'all';
    body.innerHTML = '<div class="cc-flt"><select id="ccRoom" aria-label="ห้อง"><option value="">ทุกห้อง</option></select>' + sortSel() + '<input type="search" id="ccQ" placeholder="ค้นหาชื่อ" value="' + esc(st.q) + '" />' +
      '<span class="cc-sp"></span><span class="cc-rtxt">' + esc(periodTxt()) + ' · เริ่มต้น ' + B.settings.startPoints + ' คะแนน · มาสาย −' + B.settings.latePoints + '/ครั้ง</span>' + exportBtns() + '</div><div id="ccSc" class="cc-cap"><div class="loading">กำลังโหลด...</div></div>';
    var box = document.getElementById('ccSc'), S;
    try { if (!C.sc[k]) C.sc[k] = await apiCall('careScores', { roomId: st.room }); S = C.sc[k]; } catch (e) { box.innerHTML = err(e.message); return; }
    if (st.tab !== 'scores') return;
    document.getElementById('ccRoom').innerHTML = '<option value="">ทุกห้อง</option>' + S.rooms.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === st.room ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('');
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
    // 2.12.1: เรียงคะแนน น้อย→มาก / มาก→น้อย (ห้องเดียวเลือกเรียงตามเลขที่ได้ = ค่าเริ่มต้นของห้อง)
    var so = sortOf(), d = so === 'desc' ? -1 : 1;
    if (so !== 'no') L = L.slice().sort(function (a, b) { return d * (a.score - b.score) || a.room.localeCompare(b.room) || a.no - b.no; });
    return L;
  }
  function sortOf() { var v = st.sort || ''; if (v === 'no' && !st.room) v = ''; return v || (st.room ? 'no' : 'asc'); }
  function sortSel() { var v = sortOf(); return '<select id="ccSort" aria-label="เรียงลำดับ">' + [['asc', 'คะแนนน้อย → มาก'], ['desc', 'คะแนนมาก → น้อย']].concat(st.room ? [['no', 'เรียงตามเลขที่']] : []).map(function (o) { return '<option value="' + o[0] + '"' + (v === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; }
  function renderScores() {
    var S = C.sc[st.room || 'all'], box = document.getElementById('ccSc'); if (!S || !box) return;
    var A = scoreRows(), tot = A.length;
    var cnt = { good: 0, fair: 0, low: 0, neg: 0 }; S.list.forEach(function (x) { cnt[x.score < 0 ? 'neg' : x.level]++; });
    // 2.07.2: แบ่งหน้า (ข้อมูลโหลดครบแล้ว — เปลี่ยนหน้าในเครื่อง ไม่ใช้โควต้า) · ส่งออก PDF = ทุกคนตามตัวกรอง
    var pp = st.allRows ? 0 : st.pp, pages = pp ? Math.max(1, Math.ceil(tot / pp)) : 1; if (st.pg > pages) st.pg = pages; if (st.pg < 1) st.pg = 1;
    var from = pp ? (st.pg - 1) * pp : 0, L = pp ? A.slice(from, from + pp) : A;
    box.innerHTML = capHead('คะแนนพฤติกรรม' + (st.room ? ' ห้อง ' + ((S.rooms.find(function (r) { return r.id === st.room; }) || {}).name || '') : '')) + '<div class="cc-sts cc-sts5">' + [['ดี (≥ ' + S.settings.good + ')', cnt.good, '#15803d'], ['พอใช้', cnt.fair, '#a16207'], ['ต้องปรับปรุง (< ' + S.settings.fair + ')', cnt.low, '#c2410c'], ['ติดลบ', cnt.neg, '#b91c1c'], ['นักเรียนทั้งหมด', S.list.length, '']].map(function (x) { return stat(x[0], x[1], x[2]); }).join('') + '</div>' +
      '<div class="card cc-card"><div class="cc-tw"><table class="cc-t"><thead><tr><th class="cc-ix">#</th>' + (st.room ? '<th>เลขที่</th>' : '<th>ห้อง</th>') + '<th>ชื่อ</th><th>หักคะแนน</th><th>เพิ่มคะแนน</th><th>คะแนน</th></tr></thead><tbody>' +
      L.map(function (x, i) { var m = minusOf(x), p = plusOf(x); return '<tr class="cc-click" data-cc-stu="' + esc(x.key) + '"><td class="cc-ix">' + (from + i + 1) + '</td><td>' + esc(st.room ? x.no : x.room) + '</td><td>' + esc(x.name) + (st.room ? '' : ' <small class="mut">เลขที่ ' + esc(x.no) + '</small>') + '</td><td>' + (m ? '<span class="cc-m">' + m + '</span>' : '-') + '</td><td>' + (p ? '<span class="cc-pl">+' + p + '</span>' : '-') + '</td><td><span class="cc-tg ' + lvCls(x.level, x.score) + '">' + x.score + '</span></td></tr>'; }).join('') +
      (tot ? '' : '<tr><td colspan="6" class="hint" style="text-align:center">ไม่พบนักเรียน</td></tr>') + '</tbody></table></div>' +
      '<div class="cc-pg cc-noexp"><span class="mut">' + (tot ? 'แสดง ' + (from + 1) + '–' + (from + L.length) + ' จาก ' + tot + ' คน' : '') + '</span>' + pager(pages) +
      '<label class="cc-ppl">ต่อหน้า <select id="ccPP">' + [[50, '50'], [100, '100'], [200, '200'], [0, 'ทั้งหมด']].map(function (o) { return '<option value="' + o[0] + '"' + (st.pp === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="hint cc-noexp">' + ic('fa-circle-info') + ' หักคะแนนรวมมาสายแล้ว (ดูรายละเอียดที่แท็บมาสาย หรือกดชื่อนักเรียน) · เพิ่ม/หักคะแนนทำได้ที่ BNK Care Center หน้าครู</p></div>';
  }
  function pager(n) {
    if (n <= 1) return '<span class="cc-sp"></span>';
    var p = st.pg, set = {}, out = []; [1, 2, p - 1, p, p + 1, n - 1, n].forEach(function (x) { if (x >= 1 && x <= n) set[x] = 1; });
    var ks = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
    ks.forEach(function (x, i) { if (i && x - ks[i - 1] > 1) out.push('<span class="cc-pgd">…</span>'); out.push('<button type="button" data-cc-pg="' + x + '" class="' + (x === p ? 'on' : '') + '">' + x + '</button>'); });
    return '<span class="cc-pgs"><button type="button" data-cc-pg="' + (p - 1) + '"' + (p <= 1 ? ' disabled' : '') + '>‹ ก่อนหน้า</button>' + out.join('') + '<button type="button" data-cc-pg="' + (p + 1) + '"' + (p >= n ? ' disabled' : '') + '>ถัดไป ›</button></span>';
  }
  // 2.07.1: หัก (รวมมาสาย) / เพิ่ม — Care Center เก่าที่ยังไม่ส่ง minus/plus = แยกจากยอดสุทธิแบบประมาณ
  function minusOf(x) { return x.minus !== undefined ? x.minus : (Math.min(0, x.adj || 0) - (x.late || 0) * ((B.settings || {}).latePoints || 0)); }
  function plusOf(x) { return x.plus !== undefined ? x.plus : Math.max(0, x.adj || 0); }
  var stuD = null, EVC = {};
  // 2.08.0: รูปหลักฐาน (โหลดเมื่อแตะป้าย 📷 เท่านั้น) · รายงาน PDF รายบุคคล (แนบบันทึกข้อความ / ทัณฑ์บน)
  async function evPhoto(eventId, pid) { if (!EVC[pid]) { var r = await apiCall('careEvidence', { eventId: eventId, pid: pid }); EVC[pid] = 'data:' + r.mime + ';base64,' + r.base64; } return EVC[pid]; }
  async function evShow(eventId, pids, box) {
    box.innerHTML = pids.map(function (p, i) { return '<span class="cc-evt" data-evi="' + i + '">' + (EVC[p] ? '<img src="' + EVC[p] + '" alt="">' : '<span class="mut">กำลังโหลด…</span>') + '</span>'; }).join('');
    for (var i = 0; i < pids.length; i++) {
      var sl = box.querySelector('[data-evi="' + i + '"]');
      try { var src = await evPhoto(eventId, pids[i]); if (sl) sl.innerHTML = '<img src="' + src + '" alt="">'; } catch (e) { if (sl) sl.innerHTML = '<span class="cc-m" style="font-size:.75rem">' + esc(e.message) + '</span>'; }
    }
  }
  function zoom(src) { var z = document.createElement('div'); z.className = 'cc-zoom'; z.innerHTML = '<img src="' + src + '" alt=""><button type="button" aria-label="ปิด">✕</button>'; z.addEventListener('click', function () { z.remove(); }); document.body.appendChild(z); }
  async function report() {
    var d = stuD; if (!d) return;
    await loadScriptOnce('assets/carereport.js?v=' + APP_VERSION);
    CareReport.open({ data: Object.assign({ startPoints: (B.settings || {}).startPoints || 100 }, d), school: 'โรงเรียนบุ่งคล้านคร',
      fileName: 'รายงานพฤติกรรม_' + String(d.student.room || '').replace('ม.', 'ม').replace('/', '-') + '_' + d.student.no + '_' + String(d.student.name).replace(/\s+/g, '_') + '.pdf',
      load: async function () { await loadScriptOnce('assets/html2canvas.min.js'); await loadScriptOnce('assets/jspdf.umd.min.js'); return { h2c: window.html2canvas, jsPDF: window.jspdf.jsPDF }; },
      getPhoto: evPhoto });
  }
  async function openStudent(key) {
    document.getElementById('ccModalTitle').innerHTML = ic('fa-user') + ' ประวัตินักเรียน';
    var mb = document.getElementById('ccModalBody'); mb.innerHTML = '<div class="loading">กำลังโหลด...</div>'; showModalEl(document.getElementById('ccModal'));
    try {
      var d = await apiCall('careStudent', { key: key }); stuD = d;
      mb.innerHTML = '<div class="cc-stu">' + scoreRing(d.score, (B.settings || {}).startPoints) + '<div><b style="font-size:1.1rem">' + esc(d.student.name) + '</b><div class="mut">' + esc(d.student.room) + ' เลขที่ ' + esc(d.student.no) + ' · ' + esc(d.period || ('ภาคเรียนที่ ' + d.term + '/' + d.year)) + '</div><span class="cc-tg ' + lvCls(d.level, d.score) + '">ระดับ ' + lvTxt(d.level) + '</span> <span class="cc-tg n">มาสาย ' + d.late + ' ครั้ง</span></div></div>' +
        (d.hist.length ? '<div class="cc-hist">' + d.hist.map(function (h) { var ph = h.photos || []; return '<div><span class="cc-pt ' + (h.delta < 0 ? 'm' : 'p') + '">' + sgn(h.delta) + '</span><span>' + (h.kind === 'late' ? 'มาสาย ' + esc(h.time || '') + (h.reason ? ' (' + esc(h.reason) + ')' : '') : esc(h.item) + (h.note ? ' — ' + esc(h.note) : '')) + (ph.length ? ' <button type="button" class="cc-phb" data-cc-ev="' + h.id + '" data-p="' + esc(ph.join(',')) + '">' + ic('fa-camera') + ' ' + ph.length + '</button>' : '') + '<small>' + thD(h.date, true) + ' · ' + (h.kind === 'late' ? 'บันทึกโดย ' + esc(h.by || '-') : 'โดย ' + esc(h.by || '-')) + '</small><span class="cc-evs" id="ccEvs' + (h.id || '') + '"></span></span></div>'; }).join('') + '</div>' : '<p class="hint">ยังไม่มีประวัติในรอบนี้</p>') +
        '<div class="cc-mf"><label><input type="checkbox" id="ccShotBy" /> แสดงชื่อผู้บันทึก</label><span class="cc-mfb"><button type="button" class="btn btn-sm cc-ex-img" data-cc-shot>' + ic('fa-image') + ' บันทึกเป็นรูป / แชร์</button><button type="button" class="btn btn-sm cc-ex-pdf" data-cc-rpt>' + ic('fa-file-pdf') + ' รายงาน PDF</button></span></div>';
    } catch (e) { mb.innerHTML = err(e.message); }
  }

  // ---------- 2.07.1: รูปรายคน (แชร์ให้ผู้ปกครอง ฯลฯ) — สร้างในเครื่อง ไม่ใช้โควต้า ----------
  async function studentShot() {
    var d = stuD; if (!d) return;
    var by = !!(document.getElementById('ccShotBy') || {}).checked, st0 = (B.settings || {}).startPoints || 100;
    var mn = 0, pl = 0; d.hist.forEach(function (h) { if (h.delta < 0) mn += h.delta; else pl += h.delta; });
    var now = new Date(), stamp = now.getDate() + ' ' + MS[now.getMonth()] + ' ' + (now.getFullYear() + 543) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ' น.';
    var el = document.createElement('div'); el.className = 'cc-shot';
    el.innerHTML = '<div class="cc-shh"><b>รายงานคะแนนพฤติกรรมรายบุคคล</b><span>โรงเรียนบุ่งคล้านคร · BNK Care Center · ' + esc(d.period || ('ภาคเรียนที่ ' + d.term + '/' + d.year)) + '</span></div>' +
      '<div class="cc-stu">' + scoreRing(d.score, st0) + '<div><b style="font-size:1.1rem">' + esc(d.student.name) + '</b><div class="mut">' + esc(d.student.room) + ' เลขที่ ' + esc(d.student.no) + '</div><span class="cc-tg ' + lvCls(d.level, d.score) + '">ระดับ ' + lvTxt(d.level) + '</span></div></div>' +
      '<div class="cc-shs"><div>เริ่มต้น<b>' + st0 + '</b></div><div>หัก<b class="cc-m">' + (mn || 0) + '</b></div><div>เพิ่ม<b class="cc-pl">' + (pl ? '+' + pl : 0) + '</b></div><div>มาสาย<b>' + d.late + ' ครั้ง</b></div></div>' +
      (d.hist.length ? '<div class="cc-hist">' + d.hist.map(function (h) { return '<div><span class="cc-pt ' + (h.delta < 0 ? 'm' : 'p') + '">' + sgn(h.delta) + '</span><span>' + (h.kind === 'late' ? 'มาสาย ' + esc(h.time || '') + (h.reason ? ' (' + esc(h.reason) + ')' : '') : esc(h.item) + (h.note ? ' — ' + esc(h.note) : '')) + '<small>' + thD(h.date, true) + (by ? ' · ' + (h.kind === 'late' ? 'บันทึกโดย ' : 'โดย ') + esc(h.by || '-') : '') + '</small></span></div>'; }).join('') + '</div>' : '<p class="hint">ยังไม่มีประวัติในรอบนี้</p>') +
      '<div class="cc-shf">ออกรูปเมื่อ ' + stamp + ' · ข้อมูล ณ เวลาที่ออกรูป</div>';
    var name = 'คะแนนพฤติกรรม_' + String(d.student.room || '').replace('ม.', 'ม').replace('/', '-') + '_' + d.student.no + '_' + String(d.student.name).replace(/\s+/g, '_') + '.png';
    return withProgress('กำลังสร้างรูปภาพ', async function () {
      await loadScriptOnce('assets/html2canvas.min.js');
      var html = document.documentElement, th = html.getAttribute('data-theme'), vars = document.getElementById('bnkahThemeVars');
      html.setAttribute('data-theme', 'light'); html.classList.add('cc-exporting'); if (vars) vars.disabled = true; document.body.appendChild(el);
      var c; try { c = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false }); }
      finally { el.remove(); if (th) html.setAttribute('data-theme', th); else html.removeAttribute('data-theme'); html.classList.remove('cc-exporting'); if (vars) vars.disabled = false; }
      var b = await new Promise(function (ok) { c.toBlob(ok, 'image/png'); });
      var f = null; try { f = new File([b], name, { type: 'image/png' }); } catch (x) { f = null; }
      var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
      if (touch && f && navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: 'คะแนนพฤติกรรม ' + d.student.name }); return 'shared'; } catch (x) { if (x && x.name === 'AbortError') return 'shared'; } }
      downloadBlob(b, name); return true;
    }, { successLabel: 'สร้างรูปแล้ว' });
  }

  // ---------- 2.04.0: ส่งออก PDF / รูปภาพ / Excel ----------
  function fileBase() {
    var r = rangeOf(), g = st.grade ? '_ม' + st.grade.slice(1) : '';
    if (st.tab === 'summary') return 'สรุปรวมพฤติกรรม' + g + '_' + r[0] + '_' + r[1];
    if (st.tab === 'scores') return 'คะแนนพฤติกรรม' + (st.room ? '_' + roomTxt(st.room) : '_ทุกห้อง') + (pgSuffix || '');
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
  var pgSuffix = '';
  async function exportImg() {
    pgSuffix = st.tab === 'scores' && st.pp && scoreRows().length > st.pp ? '_หน้า' + st.pg : '';
    var res = await withProgress('กำลังสร้างรูปภาพ', async function () { var c = await snap(); if (!c) throw new Error('ยังไม่มีข้อมูล'); var b = await new Promise(function (ok) { c.toBlob(ok, 'image/png'); }); downloadBlob(b, fileBase() + '.png'); return true; }, { successLabel: 'ดาวน์โหลดรูปภาพแล้ว' });
    pgSuffix = '';
    return res;
  }
  async function exportPdf() {
    return withProgress('กำลังสร้าง PDF', async function () {
      if (st.tab === 'scores') return scoresPdf(); // 2.07.2: PDF = ทุกคนตามตัวกรอง (รูปภาพ = หน้าที่เห็น)
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
  // 2.07.2: คะแนนพฤติกรรม → PDF ครบทุกคน — ถ่ายทีละ 30 คน (1 แผ่น A4) ไม่ให้รูปยาวเกินขีดจำกัดของเบราว์เซอร์
  async function scoresPdf() {
    if (!C.sc[st.room || 'all']) throw new Error('ยังไม่มีข้อมูล');
    await loadScriptOnce('assets/jspdf.umd.min.js');
    var keep = { pp: st.pp, pg: st.pg }, n = Math.max(1, Math.ceil(scoreRows().length / 30)), pdf = null;
    try {
      st.pp = 30;
      for (var i = 1; i <= n; i++) {
        st.pg = i; renderScores();
        var box = document.getElementById('ccSc'); box.classList.toggle('cc-pdfmore', i > 1);
        var c = await snap(); if (!c) throw new Error('ยังไม่มีข้อมูล');
        if (!pdf) pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        else pdf.addPage();
        var pw = pdf.internal.pageSize.getWidth() - 20, ph = pdf.internal.pageSize.getHeight() - 20, w = pw, h = c.height * pw / c.width;
        if (h > ph) { w = w * ph / h; h = ph; }
        pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 10, 10, w, h);
        pdf.setFontSize(8); pdf.text(i + ' / ' + n, pdf.internal.pageSize.getWidth() - 10, pdf.internal.pageSize.getHeight() - 5, { align: 'right' });
      }
    } finally { st.pp = keep.pp; st.pg = keep.pg; var b2 = document.getElementById('ccSc'); if (b2) b2.classList.remove('cc-pdfmore'); renderScores(); }
    pdf.save(fileBase() + '.pdf'); return true;
  }
  async function exportXls() {
    var r = rangeOf(), title = 'โรงเรียนบุ่งคล้านคร — ', H, rows, W, sheet;
    if (st.tab === 'summary') {
      var S2 = C.bh[r[0] + '|' + r[1] + '|' + st.grade]; if (!S2) return showToast('รอโหลดข้อมูลก่อน', true);
      H = ['หมวด', 'รายการ', 'ห้อง', 'จำนวน', 'คะแนน/หัก', 'เพิ่ม']; W = [20, 34, 10, 10, 12, 10]; sheet = 'สรุปรวมพฤติกรรม'; rows = [];
      var sc = S2.score; rows.push(['ภาพรวม (รอบปัจจุบัน)', 'คะแนนเฉลี่ย', '', sc.n, sc.avg, '']);
      [['good', 'ดี'], ['fair', 'พอใช้'], ['low', 'ต้องปรับปรุง'], ['neg', 'ติดลบ']].forEach(function (l) { rows.push(['ภาพรวม (รอบปัจจุบัน)', 'ระดับ' + l[1] + ' (คน)', '', sc[l[0]], '', '']); });
      rows.push(['ภาพรวม (ช่วงที่เลือก)', 'รวมหัก (นับมาสาย)', '', S2.adj.count, S2.adj.minus, S2.adj.plus]);
      Object.keys(S2.byGrade).sort().forEach(function (k) { var x = S2.byGrade[k]; rows.push(['ระดับแยกชั้น', 'ม.' + k.slice(1) + ' — ดี ' + x.good + ' · พอใช้ ' + x.fair + ' · ต้องปรับปรุง ' + x.low + ' · ติดลบ ' + x.neg, '', x.n, x.avg, '']); });
      S2.items.forEach(function (x) { rows.push(['รายการหัก/เพิ่ม', x.item, '', x.n, x.s < 0 ? x.s : '', x.s > 0 ? x.s : '']); });
      S2.byDay.forEach(function (x) { rows.push(['รายวัน', x.date, '', x.c, x.m, x.p]); });
      S2.roomsLow.forEach(function (x) { rows.push(['ห้องคะแนนเฉลี่ยต่ำสุด', x.room, x.room, x.n, x.avg, '']); });
      S2.roomsHigh.forEach(function (x) { rows.push(['ห้องคะแนนเฉลี่ยสูงสุด', x.room, x.room, x.n, x.avg, '']); });
      S2.watch.forEach(function (x) { rows.push(['นักเรียนที่ต้องติดตาม', x.name + ' (เลขที่ ' + x.no + ')', x.room, '', x.score, '']); });
      S2.top.forEach(function (x, i) { rows.push(['คะแนนสูงสุด อันดับ ' + (i + 1), x.name + ' (เลขที่ ' + x.no + ')', x.room, '', x.score, '']); });
      title += 'สรุปรวมคะแนนพฤติกรรม · กิจกรรม ' + rangeTxt() + (st.grade ? ' · ม.' + st.grade.slice(1) : '');
    } else if (st.tab === 'scores') {
      if (!C.sc[st.room || 'all']) return showToast('รอโหลดข้อมูลก่อน', true);
      H = ['ห้อง', 'เลขที่', 'ชื่อ-นามสกุล', 'มาสาย (ครั้ง)', 'หักคะแนน (รวมมาสาย)', 'เพิ่มคะแนน', 'คะแนน', 'ระดับ']; W = [10, 8, 32, 12, 18, 12, 10, 14]; sheet = 'คะแนนพฤติกรรม';
      rows = scoreRows().map(function (x) { return [x.room, +x.no || x.no, x.name, x.late, minusOf(x), plusOf(x), x.score, lvTxt(x.level)]; }); title += 'คะแนนพฤติกรรม (' + periodTxt() + ')';
    } else if (st.tab === 'rooms' && st.rroom) {
      var D = C.rd[r[0] + '|' + r[1] + '|' + st.rroom]; if (!D) return showToast('รอโหลดข้อมูลก่อน', true);
      H = ['เลขที่', 'ชื่อ-นามสกุล', 'มาสาย (ครั้ง)', 'หักคะแนน', 'เพิ่มคะแนน', 'คะแนน', 'ระดับ']; W = [8, 32, 12, 12, 12, 10, 14]; sheet = 'ห้อง ' + D.room.replace('/', '-');
      rows = D.list.map(function (x) { return [+x.no || x.no, x.name, x.late, x.minus, x.plus, x.score, lvTxt(x.level)]; }); title += 'สรุปห้อง ' + D.room + ' · ' + rangeTxt();
    } else if (st.tab === 'rooms') {
      var R = C.rm[r[0] + '|' + r[1]]; if (!R) return showToast('รอโหลดข้อมูลก่อน', true);
      H = ['ห้อง', 'ครูที่ปรึกษา', 'นักเรียน (คน)', 'มาสาย (ครั้ง)', 'มาสาย (คน)', 'หักคะแนน', 'เพิ่มคะแนน', 'คะแนนเฉลี่ย', 'ดี', 'พอใช้', 'ต้องปรับปรุง', 'ติดลบ']; W = [10, 30, 12, 12, 12, 12, 12, 12, 8, 8, 12, 8]; sheet = 'สรุปรายห้อง';
      rows = roomsList(R).map(function (x) { return [x.room, (x.advisors || []).join(', '), x.total, x.late, x.lateStu, x.minus, x.plus, x.avg, x.levels.good, x.levels.fair, x.levels.low, x.levels.neg || 0]; }); title += 'สรุปรายห้อง · ' + rangeTxt();
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
  // 2.12.2: แบนเนอร์ BNK Care Center — บันทึกทันทีเมื่อเลือกรูป (ไม่ต้องกดบันทึกการตั้งค่า) · ย่อ/ครอปเป็น 1300×433 ในเบราว์เซอร์
  var BN_PAGES = [['t', 'หน้าครู', 'fa-chalkboard-user'], ['c', 'หน้าสภานักเรียน', 'fa-users'], ['s', 'หน้านักเรียน', 'fa-user-graduate'], ['v', 'หน้าดูคะแนน', 'fa-id-card']];
  function bnOf() { var b = (B.settings && B.settings.banner) || {}; return { mode: b.mode === 'each' ? 'each' : 'all', a: b.a || '', t: b.t || '', c: b.c || '', s: b.s || '', v: b.v || '' }; } // 2.14.1: + หน้าดูคะแนน (v)
  function bnSrc(slot, ver, base) { return ver ? API_URL.replace(/\/$/, '') + '/care-banner/' + slot + '?v=' + ver : (base ? base + 'assets/banner.jpg' : ''); }
  function bnImg(src) { return src ? '<img class="cc-bn-img" src="' + esc(src) + '" alt="" loading="lazy" />' : '<div class="cc-bn-img cc-bn-def">รูปเดิม (banner.jpg)</div>'; }
  function bannerHtml(base) {
    var b = bnOf(), all = bnSrc('a', b.a, base);
    var h = '<div class="card cc-card"><h3>' + ic('fa-image') + ' แบนเนอร์ BNK Care Center</h3>' +
      '<div class="cc-seg cc-bn-seg"><button type="button" data-cc-bn-mode="all" class="' + (b.mode === 'all' ? 'on' : '') + '">ใช้รูปเดียวกันทั้ง 4 หน้า</button><button type="button" data-cc-bn-mode="each" class="' + (b.mode === 'each' ? 'on' : '') + '">แยกรายหน้า</button></div>' +
      '<div class="cc-bn-main">' + bnImg(all) + '<div><div class="hint" style="margin:0 0 6px">' + (b.mode === 'each' ? 'รูปรวม — ใช้กับหน้าที่ยังไม่ได้ตั้งรูปของตัวเอง' : 'ใช้กับหน้าครู · หน้าสภานักเรียน · หน้านักเรียน · หน้าดูคะแนน') + '<br>ขนาดแนะนำ 1300 × 433 (3:1) — ระบบย่อและครอปให้เอง</div>' +
      '<button type="button" class="btn btn-primary btn-sm" data-cc-bn-pick="a">' + ic('fa-upload') + ' เลือกรูปใหม่</button> ' + (b.a ? '<button type="button" class="btn btn-secondary btn-sm" data-cc-bn-reset="a">' + ic('fa-rotate-left') + ' ใช้รูปเดิม</button>' : '') + '</div></div>';
    if (b.mode === 'each') h += '<div class="cc-bn-each">' + BN_PAGES.map(function (pg) {
      var own = b[pg[0]], src = own ? bnSrc(pg[0], own, base) : all;
      return '<div class="cc-bn-it">' + bnImg(src) + '<b>' + ic(pg[2]) + ' ' + pg[1] + '</b><small class="mut">' + (own ? 'รูปของหน้านี้' : 'ใช้รูปรวม') + '</small><div><button type="button" class="btn btn-secondary btn-sm" data-cc-bn-pick="' + pg[0] + '">เปลี่ยนรูป</button>' + (own ? ' <button type="button" class="btn btn-secondary btn-sm" data-cc-bn-reset="' + pg[0] + '">ใช้รูปรวม</button>' : '') + '</div></div>';
    }).join('') + '</div>';
    return h + '<input type="file" id="ccBnFile" accept="image/*" hidden /><p class="hint">เปลี่ยนแล้วมีผลทันที · ครู/นักเรียนที่เปิดหน้าอยู่จะเห็นรูปใหม่เมื่อโหลดหน้าใหม่</p></div>';
  }
  function bnShrink(file) {
    return new Promise(function (ok, no) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var W = 1300, H = 433, c = document.createElement('canvas'); c.width = W; c.height = H;
        var r = Math.max(W / im.width, H / im.height), w = im.width * r, h = im.height * r, g = c.getContext('2d');
        g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); URL.revokeObjectURL(u);
        var q = 0.86, d = c.toDataURL('image/jpeg', q); while (d.length > 1300000 && q > 0.5) { q -= 0.08; d = c.toDataURL('image/jpeg', q); }
        ok(d);
      };
      im.onerror = function () { URL.revokeObjectURL(u); no(new Error('เปิดรูปนี้ไม่ได้ — ลองใช้ไฟล์ JPG หรือ PNG')); };
      im.src = u;
    });
  }
  async function bnSave(payload, label) {
    var r = await withProgress(label, function () { return apiCall('careBannerSave', payload); }, { successLabel: 'บันทึกแล้ว' });
    if (r.ok) { B.settings.banner = r.data.banner; if (draft) syncDraft(); showSettings(); }
  }
  var bnSlot = '';
  document.addEventListener('change', async function (e) {
    if (e.target.id !== 'ccBnFile') return; var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try { var d = await bnShrink(f); await bnSave({ slot: bnSlot, image: d }, 'กำลังอัปแบนเนอร์'); } catch (x) { showToast(x.message, true); }
  });
  // 2.12.3: แท็บย่อยในหน้าตั้งค่า — แต่ละหัวข้อกดบันทึกของตัวเอง (ค่าที่แก้ค้างในหัวข้ออื่นยังอยู่ · มีจุดเตือนที่แท็บ)
  // 2.14.1: เรียงใหม่ — หน้าเว็บทั้ง 3 หน้าอยู่ติดกัน → กติกาคะแนน → สิทธิ์ → ลิงก์และแบนเนอร์
  var CC_SSUB = [['council', 'หน้าสภานักเรียน', 'fa-people-group'], ['student', 'หน้านักเรียน', 'fa-user-graduate'], ['view', 'หน้าดูคะแนน', 'fa-id-card'], ['score', 'คะแนนพฤติกรรม', 'fa-star'], ['items', 'รายการคะแนน', 'fa-list-check'], ['skip', 'โดด / ขาดเรียน', 'fa-person-walking-arrow-right'], ['perm', 'สิทธิ์และแจ้งเตือน', 'fa-user-shield'], ['site', 'ลิงก์และแบนเนอร์', 'fa-link']];
  var CC_FIELDS = { council: ['pinOn', 'pin', 'council'], student: ['selfOn', 'selfFrom', 'selfTo', 'reasons'], score: ['startPoints', 'cycle', 'good', 'fair'], items: ['latePoints', 'items'], perm: ['advisorView', 'notifyOn', 'notifyN'], site: ['siteUrl'], skip: ['skipOn', 'skipPts', 'skipPartial', 'absOn', 'absPts', 'skipMax'], view: ['viewOn', 'viewId', 'viewLate', 'viewHist', 'viewBy', 'viewPhoto'] };
  var ssub = (function () { try { var v = localStorage.getItem('bnkah_cc_ssub'); return CC_FIELDS[v] ? v : 'council'; } catch (e) { return 'council'; } })();
  function baseDraft() { var s = B.settings; return { pinOn: s.pinOn, pin: '', notifyOn: s.notifyOn, notifyN: s.notifyN, startPoints: s.startPoints, latePoints: s.latePoints, good: s.good, fair: s.fair,
      items: (s.items || []).map(function (x) { return { label: x.label, delta: x.delta, t: !!x.t, c: !!x.c }; }), siteUrl: B.siteUrl, cycle: JSON.parse(JSON.stringify(s.cycle || { mode: 'all', all: 'term', g: {} })),
      advisorView: !!s.advisorView, council: (s.council || []).map(function (c) { return { k: c.k, n: c.n, r: c.r }; }), selfOn: s.selfOn !== false, selfFrom: s.selfFrom || '06:00', selfTo: s.selfTo || '17:30', reasons: (s.reasons || []).slice(),
      skipOn: !!s.skipOn, skipPts: s.skipPts == null ? 5 : s.skipPts, skipPartial: s.skipPartial !== false, absOn: !!s.absOn, absPts: s.absPts == null ? 5 : s.absPts, skipMax: s.skipMax == null ? 15 : s.skipMax,
      viewOn: !!s.viewOn, viewId: s.viewId !== false, viewLate: s.viewLate !== false, viewHist: s.viewHist !== false, viewBy: !!s.viewBy, viewPhoto: !!s.viewPhoto }; }
  function cycN(c) { c = c || {}; var g = {}; for (var i = 1; i <= 6; i++) g['m' + i] = (c.g || {})['m' + i] || c.all || 'term'; return { mode: c.mode === 'grade' ? 'grade' : 'all', all: c.all || 'term', g: c.mode === 'grade' ? g : {} }; }
  function secVal(d, k) { return JSON.stringify(CC_FIELDS[k].map(function (f) { var v = d[f]; if (f === 'cycle') return cycN(v); if (f === 'items') return (v || []).map(function (x) { return [String(x.label || '').trim(), Math.trunc(+x.delta || 0), !!x.t, !!x.c]; }); if (f === 'council') return (v || []).map(function (c) { return c.k; }); if (f === 'pin') return ''; if (typeof v === 'number') return +v; return v; })); }
  function secDirty(k) { if (!draft || !B || !B.settings) return false; if (k === 'council' && draft.pin) return true; return secVal(draft, k) !== secVal(baseDraft(), k); }
  function anyDirty() { if (st.tab !== 'settings' || !draft) return false; syncDraft(); return CC_SSUB.some(function (t) { return secDirty(t[0]); }); }
  if (window.BackNav) BackNav.dirty(anyDirty, 'การตั้งค่ากิจการนักเรียนยังไม่ได้บันทึก ออกจากหน้านี้เลยไหม?');
  function showSettings() {
    var s = B.settings;
    draft = draft || baseDraft();
    var d = draft, sw = function (id, on, attr) { return '<input type="checkbox" class="switch" role="switch" id="' + id + '"' + (attr || '') + (on ? ' checked' : '') + ' />'; }, base = siteBase(d.siteUrl);
    var links = [['', 'หน้าครู (หน้าหลัก)', 'fa-chalkboard-user'], ['council.html', 'หน้าสภานักเรียน (ใช้ PIN)', 'fa-people-group'], ['student.html', 'หน้านักเรียน (แจ้งมาสายเอง)', 'fa-user-graduate'], ['score.html', 'หน้าดูคะแนน (นักเรียน / ผู้ปกครอง)', 'fa-id-card']];
    var tabs = CC_SSUB.map(function (t) { return '<button type="button" data-cc-ssub="' + t[0] + '" class="' + (t[0] === ssub ? 'on' : '') + '">' + ic(t[2]) + ' ' + t[1] + (secDirty(t[0]) ? ' <span class="cc-dot" title="ยังไม่ได้บันทึก"></span>' : '') + '</button>'; }).join('');
    var save = function (k, extra) { return '<div class="cc-actions">' + (secDirty(k) ? '<span class="cc-unsaved">' + ic('fa-circle-exclamation') + ' ยังไม่ได้บันทึก</span>' : '') + '<button type="button" class="btn btn-success" data-cc-save="' + k + '">' + ic('fa-check') + ' บันทึก' + (extra || '') + '</button></div>'; };
    var SEC = {
      council: function () { return (
      '<div class="card cc-card"><h3>' + ic('fa-key') + ' หน้าสภานักเรียน — รหัส PIN</h3>' +
      '<label class="cc-row">' + sw('ccPinOn', d.pinOn) + '<b>ใช้รหัส PIN</b></label>' + (!d.pinOn ? '<div class="cc-warn">' + ic('fa-triangle-exclamation') + ' ปิด PIN = ใครมีลิงก์หน้าสภาก็บันทึกได้ และเห็นรายชื่อนักเรียนทั้งโรงเรียน</div>' : '') +
      '<div class="cc-row"><span class="cc-lb">รหัส PIN ใหม่ (4–6 หลัก)</span><input id="ccPin" inputmode="numeric" maxlength="6" placeholder="' + (s.pinSet ? 'ตั้งไว้แล้ว — ใส่เมื่อต้องการเปลี่ยน' : 'ยังไม่ได้ตั้ง') + '" value="' + esc(d.pin) + '" autocomplete="off" /></div>' +
      '<p class="hint">เปลี่ยนรหัส = ทุกเครื่องต้องใส่รหัสใหม่ · ใส่ผิดเกินกำหนด ระบบพัก 15 นาที · แนะนำ 6 หลัก</p></div>' +
      '<div class="card cc-card"><h3>' + ic('fa-people-group') + ' สมาชิกสภานักเรียน (' + d.council.length + ' คน)</h3><p class="hint" style="margin-top:0">ผู้บันทึกในหน้าสภานักเรียนเลือกจากรายชื่อนี้</p><div class="cc-chips">' +
      d.council.map(function (c, i) { return '<span class="cc-chip">' + esc(c.n) + ' <small>' + esc(c.r) + '</small><button type="button" data-cc-cdel="' + i + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button></span>'; }).join('') +
      '<button type="button" class="cc-chip-add" data-cc-cadd>' + ic('fa-plus') + ' เพิ่มจากรายชื่อนักเรียน</button></div></div>').replace(/<\/div>$/, '') + save('council', 'หน้าสภานักเรียน') + '</div>'; },
      student: function () { return (
      '<div class="card cc-card"><h3>' + ic('fa-user-graduate') + ' หน้านักเรียน — แจ้งมาสายด้วยตนเอง</h3>' +
      '<label class="cc-row">' + sw('ccSelfOn', d.selfOn) + '<b>เปิดให้นักเรียนแจ้งเอง</b></label>' +
      '<div class="cc-row"><span class="cc-lb">เวลาที่เปิดให้กรอก</span><input type="time" id="ccSelfFrom" value="' + esc(d.selfFrom) + '" class="cc-time" /> ถึง <input type="time" id="ccSelfTo" value="' + esc(d.selfTo) + '" class="cc-time" /></div>' +
      '<div class="cc-row" style="display:block"><div style="margin-bottom:6px">ตัวเลือกเหตุผล</div><div class="cc-chips">' + d.reasons.map(function (x, i) { return '<span class="cc-chip">' + esc(x) + '<button type="button" data-cc-rdel="' + i + '" aria-label="ลบ">' + ic('fa-xmark') + '</button></span>'; }).join('') +
      '<span class="cc-chip-in"><input id="ccRNew" maxlength="40" placeholder="เพิ่มเหตุผล" /><button type="button" data-cc-radd>' + ic('fa-plus') + '</button></span></div><p class="hint">"อื่นๆ (พิมพ์เอง)" มีให้เลือกเสมอ · นักเรียนแจ้งได้วันละ 1 ครั้ง · นับเป็นมาสายและหักคะแนนทันที (สภานักเรียนลบได้ถ้าไม่ถูกต้อง)</p></div>').replace(/<\/div>$/, '') + save('student', 'หน้านักเรียน') + '</div>'; },
      score: function () { return (
      '<div class="card cc-card"><h3>' + ic('fa-star') + ' คะแนนพฤติกรรม</h3>' +
      '<div class="cc-row"><span class="cc-lb">คะแนนเริ่มต้น</span><input id="ccStart" type="number" min="0" max="1000" class="cc-num" value="' + d.startPoints + '" /></div>' +
      cycleHtml(d.cycle) +
      '<div class="cc-row"><span class="cc-lb">ระดับ</span><span class="cc-tg g">ดี ≥</span><input id="ccGood" type="number" class="cc-num" value="' + d.good + '" /><span class="cc-tg o">พอใช้ ≥</span><input id="ccFair" type="number" class="cc-num" value="' + d.fair + '" /><span class="cc-tg r">ต่ำกว่านั้น = ต้องปรับปรุง</span></div>') + save('score', 'คะแนนพฤติกรรม') + '</div>'; },
      items: function () { return (
      '<div class="card cc-card"><h3>' + ic('fa-list-check') + ' รายการเพิ่ม / หักคะแนน</h3><div class="cc-it cc-ith"><span class="cc-num">คะแนน</span><span style="flex:1">รายการ</span><span class="cc-tcol">ครูทั่วไป</span><span class="cc-tcol">สภานักเรียน</span><span style="width:34px"></span></div>' +
      // 2.05.0: "มาสาย" เป็นแถวแรก (ลบ/เปลี่ยนชื่อไม่ได้ · เปิดให้ครูและสภาเสมอ) · ช่องคะแนน = หักต่อครั้ง
      '<div class="cc-it cc-itlate"><span class="cc-num cc-neg"><b>−</b><input id="ccLate" type="number" min="0" max="50" value="' + d.latePoints + '" aria-label="มาสาย หักคะแนนต่อครั้ง" /></span><span class="cc-itl">' + ic('fa-clock') + ' <b>มาสาย</b> ' + ic('fa-lock') + '</span><span class="cc-tcol">' + sw('ccLtT', true, ' disabled') + '</span><span class="cc-tcol">' + sw('ccLtC', true, ' disabled') + '</span><span style="width:34px"></span></div><div id="ccItems">' +
      d.items.map(function (x, i) { return '<div class="cc-it"><input type="number" class="cc-num" data-cc-it-d="' + i + '" value="' + x.delta + '" /><input data-cc-it-l="' + i + '" value="' + esc(x.label) + '" placeholder="ชื่อรายการ" /><span class="cc-tcol">' + sw('ccIt' + i, x.t, ' data-cc-it-t="' + i + '" aria-label="ครูทั่วไปใช้ได้"') + '</span><span class="cc-tcol">' + sw('ccIc' + i, x.c, ' data-cc-it-c="' + i + '" aria-label="สภานักเรียนใช้ได้"') + '</span><button type="button" class="cc-x" data-cc-it-del="' + i + '" aria-label="ลบ">' + ic('fa-xmark') + '</button></div>'; }).join('') + '</div>' +
      '<div class="cc-row"><button type="button" class="btn btn-secondary btn-sm" data-cc-it-add>' + ic('fa-plus') + ' เพิ่มรายการ</button><span class="hint" style="margin:0">ติดลบ = หัก · บวก = เพิ่ม · ครูกิจการนักเรียนใช้ได้ทุกรายการ และพิมพ์เรื่องอื่นเองได้</span></div>' +
      '<p class="hint">' + ic('fa-circle-info') + ' มาสาย: เปลี่ยนคะแนนแล้ว การมาสายที่บันทึกไว้แล้วจะคิดตามค่าใหม่ทั้งหมด (รายการอื่นคิดตามค่า ณ วันที่บันทึก) · ใส่ 0 = บันทึกการมาสายแต่ไม่หักคะแนน</p>') + save('items', 'รายการคะแนน') + '</div>'; },
      perm: function () { return (
      '<div class="card cc-card"><h3>' + ic('fa-user-shield') + ' สิทธิ์ครูทั่วไป</h3><label class="cc-row">' + sw('ccAdvView', d.advisorView) + '<span>ครูที่ปรึกษาดูคะแนนของห้องตัวเองได้ (ในหน้าครู)</span></label>' +
      '<p class="hint">ครูกิจการนักเรียน = ผู้ดูแลกิจการนักเรียน (สิทธิ์จัดการ) และเจ้าหน้าที่กลุ่มบริหารงานกิจการนักเรียน · ครูทั่วไปยกเลิกได้เฉพาะรายการที่ตัวเองบันทึกในวันเดียวกัน</p>' +
      '<h3 style="margin-top:14px">' + ic('fa-bell') + ' แจ้งเตือนครูที่ปรึกษา</h3><div class="cc-row">' + sw('ccNotifyOn', d.notifyOn) + '<span>แจ้งผ่านกระดิ่งเมื่อนักเรียนสายครบ</span><input id="ccNotifyN" type="number" min="1" max="31" class="cc-num" value="' + d.notifyN + '" /><span>ครั้ง / เดือน</span></div>' +
      '<p class="hint">แจ้งครั้งเดียวต่อนักเรียนต่อเดือน · ครูที่ปรึกษาต้องผูกบัญชีกับเว็บเช็คชื่อไว้แล้ว</p>') + save('perm', 'สิทธิ์และแจ้งเตือน') + '</div>'; },
      skip: function () { return (
      '<div class="card cc-card"><h3>' + ic('fa-person-walking-arrow-right') + ' โดด / ขาดเรียน — หักคะแนนจากเว็บเช็คชื่อ</h3>' +
      '<label class="cc-row">' + sw('ccSkipOn', d.skipOn) + '<b>เปิดใช้ (แท็บ "โดด / ขาดเรียน" · ดึงข้อมูลเมื่อเปิดแท็บ)</b></label>' +
      '<div class="cc-row"><span class="cc-lb">โดดเรียน หัก</span><input type="number" id="ccSkipPts" min="0" max="100" value="' + d.skipPts + '" class="cc-num" /> คะแนน / คาบ</div>' +
      '<label class="cc-row">' + sw('ccSkipPart', d.skipPartial) + '<b>ขาดบางคาบ แต่มาเรียนคาบอื่นวันเดียวกัน = นับเป็นโดด</b></label>' +
      '<label class="cc-row">' + sw('ccAbsOn', d.absOn) + '<b>ขาดเรียนทั้งวัน หักด้วย</b></label>' +
      (d.absOn ? '<div class="cc-row"><span class="cc-lb">ขาดเรียนทั้งวัน หัก</span><input type="number" id="ccAbsPts" min="0" max="100" value="' + d.absPts + '" class="cc-num" /> คะแนน / วัน</div>' : '') +
      '<div class="cc-row"><span class="cc-lb">หักสูงสุดต่อวัน</span><input type="number" id="ccSkipMax" min="0" max="500" value="' + d.skipMax + '" class="cc-num" /> คะแนน <span class="cc-mut">(0 = ไม่จำกัด)</span></div>' +
      '<p class="hint">ทุกรายการต้องกด "ยืนยันหักคะแนน" ในแท็บ โดด / ขาดเรียน ก่อน · 1 คาบหักได้ครั้งเดียว · ครูแก้สถานะในเว็บเช็คชื่อภายหลัง = ขึ้นในหมวด "ต้องคืนคะแนน" · ข้อมูลตาม "ระยะเวลาการเช็คชื่อ" ของภาคเรียนปัจจุบัน</p>' +
      save('skip', ' โดด / ขาดเรียน') + '</div>'); },
      view: function () { var u = base + 'score.html'; return (
      '<div class="card cc-card"><h3>' + ic('fa-id-card') + ' หน้าดูคะแนน — นักเรียน / ผู้ปกครองดูคะแนนพฤติกรรม</h3>' +
      '<label class="cc-row">' + sw('ccViewOn', d.viewOn) + '<b>เปิดหน้าดูคะแนน</b></label>' +
      '<label class="cc-row">' + sw('ccViewId', d.viewId) + '<b>ต้องใส่เลขประจำตัวนักเรียนก่อนดู</b> <span style="color:#15803d;margin-left:6px">แนะนำ</span></label>' +
      (!d.viewId ? '<div class="cc-warn">' + ic('fa-triangle-exclamation') + ' ปิดอยู่ = ใครก็เลือกชื่อแล้วดูคะแนนของคนอื่นได้</div>' : '') +
      '<div class="cc-row" style="display:block"><b>แสดงในหน้า</b><div class="cc-vchk"><label><input type="checkbox" checked disabled /> คะแนนคงเหลือ + ระดับ</label><label><input type="checkbox" id="ccViewHist"' + (d.viewHist ? ' checked' : '') + ' /> ประวัติหัก / เพิ่ม</label><label><input type="checkbox" id="ccViewLate"' + (d.viewLate ? ' checked' : '') + ' /> จำนวนครั้งมาสาย</label><label' + (d.viewHist ? '' : ' class="cc-mut"') + '><input type="checkbox" id="ccViewBy"' + (d.viewBy && d.viewHist ? ' checked' : '') + (d.viewHist ? '' : ' disabled') + ' /> ชื่อครูผู้บันทึก</label></div></div>' +
      // 2.14.1: รูปหลักฐาน — ปิดไว้ก่อน · อยู่ในประวัติ จึงต้องเปิดประวัติด้วย · โหลดรูปเมื่อกดดูเท่านั้น
      '<label class="cc-row">' + sw('ccViewPhoto', d.viewPhoto && d.viewHist, d.viewHist ? '' : ' disabled') + '<b>ดูรูปหลักฐานที่แนบไว้ได้</b>' + (d.viewHist ? '' : ' <span class="cc-mut">(ต้องเปิด "ประวัติหัก / เพิ่ม" ก่อน)</span>') + '</label>' +
      (d.viewPhoto && d.viewHist ? '<div class="cc-warn">' + ic('fa-triangle-exclamation') + ' รูปอาจมีนักเรียนคนอื่นอยู่ในภาพ · ' + (d.viewId ? 'ใครรู้เลขประจำตัวของนักเรียนก็เห็นรูปได้' : 'เลขประจำตัวปิดอยู่ = ใครก็เปิดดูรูปได้') + ' · รูปโหลดเมื่อกด "ดูรูป" เท่านั้น</div>' : '') +
      '<div class="cc-link"><span>' + ic('fa-id-card') + ' <b>ลิงก์หน้าดูคะแนน</b><small>' + esc(u) + '</small></span><button type="button" class="btn btn-secondary btn-sm" data-cc-copy="' + esc(u) + '">' + ic('fa-copy') + ' คัดลอก</button><button type="button" class="btn btn-secondary btn-sm" data-cc-qr="v" data-u="' + esc(u) + '">' + ic('fa-qrcode') + ' QR</button></div><div id="ccQrv" class="cc-qr" hidden></div>' +
      '<p class="hint">ใส่เลขประจำตัวผิด 5 ครั้ง = ล็อกการดูของนักเรียนคนนั้น 15 นาที · แบนเนอร์ของหน้านี้ตั้งได้ที่ ลิงก์และแบนเนอร์</p>' +
      save('view', ' หน้าดูคะแนน') + '</div>'); },
      site: function () { return (
      '<div class="card cc-card"><h3>' + ic('fa-link') + ' ลิงก์ BNK Care Center</h3><div class="cc-row"><span class="cc-lb">ที่อยู่เว็บ</span><input id="ccSite" value="' + esc(d.siteUrl) + '" style="flex:1" /></div>' +
      links.map(function (l, i) { var u = base + l[0]; return '<div class="cc-link"><span>' + ic(l[2]) + ' <b>' + l[1] + '</b><small>' + esc(u) + '</small></span><button type="button" class="btn btn-secondary btn-sm" data-cc-copy="' + esc(u) + '">' + ic('fa-copy') + '</button><button type="button" class="btn btn-secondary btn-sm" data-cc-qr="' + i + '" data-u="' + esc(u) + '">' + ic('fa-qrcode') + '</button></div><div id="ccQr' + i + '" class="cc-qr" hidden></div>'; }).join('') +
      '<p class="hint">หน้าสภานักเรียนและหน้านักเรียนไม่มีปุ่มกลับหน้าครู — พิมพ์ QR ติดไว้ได้เลย</p></div>').replace(/<\/div>$/, '') + save('site', 'ลิงก์') + '</div>' + bannerHtml(base); }
    };
    body.innerHTML = '<div class="cc-seg cc-ssub" role="tablist">' + tabs + '</div><div class="cc-secw">' + SEC[ssub]() + '</div>';
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
    var d = draft; if (!d) return;
    var el = function (id) { return document.getElementById(id); };
    var num = function (id, k, def) { var e = el(id); if (e) d[k] = e.value === '' ? (def || 0) : Math.trunc(+e.value || 0); };
    var chk = function (id, k) { var e = el(id); if (e) d[k] = !!e.checked; };
    var txt = function (id, k) { var e = el(id); if (e) d[k] = e.value; };
    chk('ccPinOn', 'pinOn'); if (el('ccPin')) d.pin = el('ccPin').value.replace(/\D/g, '');
    chk('ccNotifyOn', 'notifyOn'); num('ccNotifyN', 'notifyN', 3); num('ccStart', 'startPoints'); num('ccLate', 'latePoints'); num('ccGood', 'good'); num('ccFair', 'fair');
    chk('ccAdvView', 'advisorView'); chk('ccSelfOn', 'selfOn'); if (el('ccSelfFrom') && el('ccSelfFrom').value) d.selfFrom = el('ccSelfFrom').value; if (el('ccSelfTo') && el('ccSelfTo').value) d.selfTo = el('ccSelfTo').value;
    txt('ccSite', 'siteUrl');
    chk('ccSkipOn', 'skipOn'); num('ccSkipPts', 'skipPts'); chk('ccSkipPart', 'skipPartial'); chk('ccAbsOn', 'absOn'); num('ccAbsPts', 'absPts'); num('ccSkipMax', 'skipMax'); // 2.13.0
    chk('ccViewOn', 'viewOn'); chk('ccViewId', 'viewId'); chk('ccViewLate', 'viewLate'); chk('ccViewHist', 'viewHist'); ['ccViewBy', 'ccViewPhoto'].forEach(function (id) { var e = el(id); if (e && !e.disabled) d[id === 'ccViewBy' ? 'viewBy' : 'viewPhoto'] = !!e.checked; }); // 2.14.1: ปิดประวัติชั่วคราว = จำค่าเดิมไว้
    var cy = d.cycle; if (el('ccCycAll')) cy.all = el('ccCycAll').value;
    cy.g = cy.g || {}; for (var i = 1; i <= 6; i++) { if (el('ccCyc' + i)) cy.g['m' + i] = el('ccCyc' + i).value; else cy.g['m' + i] = cy.g['m' + i] || cy.all; }
    document.querySelectorAll('[data-cc-it-l]').forEach(function (e) { d.items[+e.getAttribute('data-cc-it-l')].label = e.value; });
    document.querySelectorAll('[data-cc-it-d]').forEach(function (e) { d.items[+e.getAttribute('data-cc-it-d')].delta = Math.trunc(+e.value || 0); });
    document.querySelectorAll('[data-cc-it-t]').forEach(function (e) { d.items[+e.getAttribute('data-cc-it-t')].t = e.checked; });
    document.querySelectorAll('[data-cc-it-c]').forEach(function (e) { d.items[+e.getAttribute('data-cc-it-c')].c = e.checked; });
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
    // 2.13.0: โดด / ขาดเรียน
    if ((t = e.target.closest('[data-cc-skc]'))) { SK.cat = t.getAttribute('data-cc-skc'); SK.sel = {}; paintSkip(); return; }
    if (e.target.closest('[data-cc-skre]')) { SK.d && (SK.d.at = new Date().toISOString()); var rb = e.target.closest('[data-cc-skre]'); rb.disabled = true; await loadSkip(); return; }
    if ((t = e.target.closest('[data-cc-skop]'))) { skipDo(t.getAttribute('data-cc-skop')); return; }
    if (e.target.closest('[data-cc-skall]')) { var L0 = (SK.d.items || []).filter(function (x) { return x.cat === SK.cat; }), allOn = L0.every(function (x) { return SK.sel[x.k]; }); SK.sel = {}; if (!allOn) L0.forEach(function (x) { SK.sel[x.k] = 1; }); paintSkip(); return; }
    if ((t = e.target.closest('[data-cc-pg]'))) { if (t.disabled) return; st.pg = +t.getAttribute('data-cc-pg'); renderScores(); var tb = document.getElementById('ccSc'); if (tb) tb.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    if ((t = e.target.closest('[data-cc-rg]'))) { st.range = t.getAttribute('data-cc-rg'); show(); return; }
    if ((t = e.target.closest('[data-cc-go]'))) { e.preventDefault(); st.rroom = t.getAttribute('data-r') || ''; goTab(t.getAttribute('data-cc-go')); return; }
    if (e.target.closest('[data-cc-fmore]')) { st.fqN = (st.fqN || 10) + 20; showOverview(); return; }
    if (e.target.closest('[data-cc-wall]')) { e.preventDefault(); st.watchAll = true; var bk = rangeOf(); document.getElementById('ccBh').innerHTML = summaryHtml(C.bh[bk[0] + '|' + bk[1] + '|' + st.grade]); return; }
    if ((t = e.target.closest('[data-cc-stu]'))) { openStudent(t.getAttribute('data-cc-stu')); return; }
    if ((t = e.target.closest('[data-cc-room]'))) { st.rroom = t.getAttribute('data-cc-room'); showRooms(); return; }
    if ((t = e.target.closest('[data-cc-ex]'))) { var k = t.getAttribute('data-cc-ex'); if (k === 'pdf') exportPdf(); else if (k === 'img') exportImg(); else exportXls(); return; }
    if ((t = e.target.closest('[data-cc-cm]'))) { syncDraft(); var m = t.getAttribute('data-cc-cm'); if (m === 'grade' && draft.cycle.mode !== 'grade') { for (var i = 1; i <= 6; i++) draft.cycle.g['m' + i] = draft.cycle.all || 'term'; } draft.cycle.mode = m; showSettings(); return; }
    if (e.target.closest('[data-cc-it-add]')) { syncDraft(); draft.items.push({ label: '', delta: -5, t: false, c: false }); showSettings(); return; }
    if ((t = e.target.closest('[data-cc-it-del]'))) { syncDraft(); draft.items.splice(+t.getAttribute('data-cc-it-del'), 1); showSettings(); return; }
    if ((t = e.target.closest('[data-cc-cdel]'))) { syncDraft(); draft.council.splice(+t.getAttribute('data-cc-cdel'), 1); showSettings(); return; }
    if (e.target.closest('[data-cc-cadd]')) { syncDraft(); openCouncilPicker(); return; }
    if ((t = e.target.closest('[data-cc-rdel]'))) { syncDraft(); draft.reasons.splice(+t.getAttribute('data-cc-rdel'), 1); showSettings(); return; }
    if (e.target.closest('[data-cc-radd]')) { syncDraft(); var nv = (document.getElementById('ccRNew').value || '').trim(); if (nv && draft.reasons.indexOf(nv) === -1 && draft.reasons.length < 12) draft.reasons.push(nv); showSettings(); var ri = document.getElementById('ccRNew'); if (ri) ri.focus(); return; }
    if ((t = e.target.closest('[data-cc-copy]'))) { try { await navigator.clipboard.writeText(t.getAttribute('data-cc-copy')); showToast('คัดลอกลิงก์แล้ว'); } catch (x) { showToast('คัดลอกไม่สำเร็จ', true); } return; }
    if ((t = e.target.closest('[data-cc-qr]'))) { var q = document.getElementById('ccQr' + t.getAttribute('data-cc-qr')); q.hidden = !q.hidden; q.innerHTML = ''; if (!q.hidden) { try { qrLogo(q, t.getAttribute('data-u'), 180, 'icons/care-192.png'); } catch (x) { q.textContent = 'สร้าง QR ไม่ได้'; } } return; }
    if ((t = e.target.closest('[data-cc-bn-mode]'))) { var m = t.getAttribute('data-cc-bn-mode'); if (m !== bnOf().mode) bnSave({ mode: m }, 'กำลังบันทึก'); return; }
    if ((t = e.target.closest('[data-cc-bn-pick]'))) { bnSlot = t.getAttribute('data-cc-bn-pick'); document.getElementById('ccBnFile').click(); return; }
    if ((t = e.target.closest('[data-cc-bn-reset]'))) { var sl = t.getAttribute('data-cc-bn-reset'); if (await askConfirm(sl === 'a' ? 'กลับไปใช้แบนเนอร์เดิม (banner.jpg)?' : 'หน้านี้กลับไปใช้รูปรวม?', 'แบนเนอร์')) bnSave({ slot: sl, reset: true }, 'กำลังบันทึก'); return; }
    if ((t = e.target.closest('[data-cc-ssub]'))) { syncDraft(); ssub = t.getAttribute('data-cc-ssub'); try { localStorage.setItem('bnkah_cc_ssub', ssub); } catch (x) { /* ข้าม */ } showSettings(); return; }
    if ((t = e.target.closest('[data-cc-save]'))) {
      syncDraft(); var d = draft, k = t.getAttribute('data-cc-save'), P = {};
      if (k === 'council') {
        if (d.pin && !/^\d{4,6}$/.test(d.pin)) { showToast('รหัส PIN ต้องเป็นตัวเลข 4–6 หลัก', true); return; }
        if (d.pinOn && !d.pin && !B.settings.pinSet) { showToast('ตั้งรหัส PIN ก่อนเปิดใช้', true); return; }
        P = { pinOn: d.pinOn, pin: d.pin || undefined, council: d.council.map(function (c) { return c.k; }) };
      } else if (k === 'student') {
        if (!d.selfFrom || !d.selfTo || d.selfFrom >= d.selfTo) { showToast('เวลาเปิดหน้านักเรียน: เวลาเริ่มต้องก่อนเวลาสิ้นสุด', true); return; }
        P = { selfOn: d.selfOn, selfFrom: d.selfFrom, selfTo: d.selfTo, reasons: d.reasons };
      } else if (k === 'score') {
        if (d.fair > d.good) { showToast('เกณฑ์ พอใช้ ต้องไม่มากกว่า ดี', true); return; }
        P = { startPoints: d.startPoints, cycle: d.cycle, good: d.good, fair: d.fair };
      } else if (k === 'items') {
        var items = d.items.filter(function (x) { return String(x.label).trim() && x.delta; });
        if (items.some(function (x) { return String(x.label).trim() === 'มาสาย'; })) { showToast('ชื่อ "มาสาย" ใช้กับแถวมาสายแล้ว — ตั้งชื่ออื่น', true); return; }
        P = { latePoints: d.latePoints, items: items };
      } else if (k === 'perm') P = { advisorView: d.advisorView, notifyOn: d.notifyOn, notifyN: d.notifyN };
      else if (k === 'site') P = { siteUrl: d.siteUrl };
      else if (k === 'skip') P = { skipOn: d.skipOn, skipPts: d.skipPts, skipPartial: d.skipPartial, absOn: d.absOn, absPts: d.absPts, skipMax: d.skipMax };
      else if (k === 'view') P = { viewOn: d.viewOn, viewId: d.viewId, viewLate: d.viewLate, viewHist: d.viewHist, viewBy: d.viewBy, viewPhoto: d.viewPhoto };
      var go = async function () {
        var r = await withProgress('กำลังบันทึก', function () { return apiCall('careSettingsSave', P); }, { successLabel: 'บันทึกแล้ว' });
        if (!r.ok) return;
        B.settings = r.data.settings; B.periods = r.data.periods || B.periods; B.siteUrl = r.data.siteUrl;
        var nb = baseDraft(); CC_FIELDS[k].forEach(function (f) { draft[f] = nb[f]; }); // หัวข้ออื่นที่แก้ค้างไว้ยังอยู่
        C.sc = {}; C.ov = {}; C.rm = {}; C.rd = {}; C.bh = {}; if (k === 'skip') { SK.d = null; SK.n = 0; renderTabs(); if (B.settings.skipOn) loadSkip(true); } showSettings();
      };
      if (k === 'council' && !d.pinOn && B.settings.pinOn) { if (await askConfirm('ปิดแล้ว ใครมีลิงก์หน้าสภานักเรียนก็เปิดเว็บ เห็นรายชื่อนักเรียนทั้งโรงเรียน และบันทึกการมาสายได้ — ยืนยันปิดหรือไม่?', 'ปิดรหัส PIN')) go(); }
      else go();
      return;
    }
  });
  // 2.12.3: แก้ค่าแล้วขึ้นจุด "ยังไม่ได้บันทึก" ทันที (ไม่วาดหน้าใหม่)
  function paintDirty() {
    if (st.tab !== 'settings' || !draft) return; syncDraft();
    document.querySelectorAll('[data-cc-ssub]').forEach(function (b) { var k = b.getAttribute('data-cc-ssub'), dot = b.querySelector('.cc-dot'), on = secDirty(k); if (on && !dot) b.insertAdjacentHTML('beforeend', ' <span class="cc-dot" title="ยังไม่ได้บันทึก"></span>'); else if (!on && dot) dot.remove(); });
    document.querySelectorAll('[data-cc-save]').forEach(function (b) { var box = b.parentNode, u = box.querySelector('.cc-unsaved'), on = secDirty(b.getAttribute('data-cc-save')); if (on && !u) b.insertAdjacentHTML('beforebegin', '<span class="cc-unsaved">' + ic('fa-circle-exclamation') + ' ยังไม่ได้บันทึก</span>'); else if (!on && u) u.remove(); });
  }
  body.addEventListener('input', function () { paintDirty(); });
  body.addEventListener('change', function () { setTimeout(paintDirty, 0); });
  body.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.id === 'ccRNew') { e.preventDefault(); var b = document.querySelector('[data-cc-radd]'); if (b) b.click(); } });
  body.addEventListener('change', function (e) {
    var id = e.target.id, sk;
    if ((sk = e.target.getAttribute('data-cc-skk'))) { if (e.target.checked) SK.sel[sk] = 1; else delete SK.sel[sk]; paintSkip(); return; }
    if ((sk = e.target.getAttribute('data-cc-skday'))) { var on = e.target.checked; (SK.d.items || []).forEach(function (x) { if (x.cat === SK.cat && x.d === sk) { if (on) SK.sel[x.k] = 1; else delete SK.sel[x.k]; } }); paintSkip(); return; }
    if (id === 'ccGrade') { st.grade = e.target.value; show(); }
    else if (id === 'ccFrom' || id === 'ccTo') { var a = document.getElementById('ccFrom').value, b = document.getElementById('ccTo').value; if (a && b && a <= b) { st.from = a; st.to = b; show(); } }
    else if (id === 'ccMin') { st.min = +e.target.value; show(); }
    else if (id === 'ccRoom') { st.room = e.target.value; st.pg = 1; showScores(); }
    else if (id === 'ccSort') { st.sort = e.target.value; st.pg = 1; renderScores(); }
    else if (id === 'ccPP') { st.pp = +e.target.value; st.pg = 1; try { localStorage.setItem('bnkah_cc_pp', String(st.pp)); } catch (x) { /* ไม่เป็นไร */ } renderScores(); }
    else if (id === 'ccPinOn' || /^ccCyc/.test(id)) { syncDraft(); showSettings(); }
    else if (id === 'ccSite' || id === 'ccViewId' || id === 'ccViewHist' || id === 'ccViewPhoto') { syncDraft(); showSettings(); } // 2.14.1: ตัวเลือกที่ขึ้นกับกัน
  });
  body.addEventListener('input', debounce(function (e) { if (e.target.id === 'ccQ') { st.q = e.target.value.trim(); st.pg = 1; renderScores(); } }, 200));
  var modal = document.getElementById('ccModal');
  modal.addEventListener('click', function (e) {
    var t;
    if (e.target.closest('[data-cc-close]')) { hideModalEl(modal); return; }
    if (e.target.closest('[data-cc-shot]')) { studentShot(); return; }
    if (e.target.closest('[data-cc-rpt]')) { report(); return; }
    if ((t = e.target.closest('[data-cc-ev]'))) { var bx = document.getElementById('ccEvs' + t.getAttribute('data-cc-ev')); if (bx) { if (bx.innerHTML) bx.innerHTML = ''; else evShow(+t.getAttribute('data-cc-ev'), t.getAttribute('data-p').split(','), bx); } return; }
    if ((t = e.target.closest('.cc-evt img'))) { zoom(t.src); return; }
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
