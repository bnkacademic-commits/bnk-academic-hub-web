/* 2.01.0 — การเช็คชื่อประจำสัปดาห์ (หน้าแรกผู้บริหาร) · ข้อมูลจากเว็บเช็คชื่อ (apiCall 'execWeekly')
 * สรุปทุกห้อง · รายระดับชั้น · คาบที่ยังไม่เช็ค · ตารางรายห้อง (คาบ × วัน) · ส่งออก PDF แบบเดียวกับรายงานของเว็บเช็คชื่อ */
(function () {
  // 2.12.4: CSS ของฟอร์มรายงาน (แถบหัว · กล่องตัวเลข · ตาราง · ท้ายกระดาษ) — ใช้ร่วมกับรายงานแจ้งไปราชการ/ลา
  window.XW_PCSS = '.xp{position:fixed;left:-30000px;top:0;font-family:Sarabun,"Noto Sans Thai",sans-serif;color:#0f172a}.xp .pg{position:relative;width:794px;height:1123px;box-sizing:border-box;padding:66px 38px 50px;background:#fff;overflow:hidden;display:flex;flex-direction:column}.xp *{line-height:1.6}' +
      '.xp .band{position:absolute;left:38px;right:38px;top:0;height:48px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #4338ca;font-size:11px;color:#475569}.xp .band b{color:#312e81}.xp .foot{position:absolute;left:38px;right:38px;bottom:0;height:36px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#94a3b8}' +
      '.xp .hd{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin:2px 0 12px}.xp h1{font-size:22px;font-weight:800;color:#1e1b4b;margin:0}.xp .sub{font-size:12px;color:#64748b}.xp .pill{display:inline-block;background:#eef2ff;color:#3730a3;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700;white-space:nowrap}' +
      '.xp .kp{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}.xp .k{border-radius:12px;padding:6px 12px;border:1px solid}.xp .k span{display:block;font-size:11px;color:#475569;font-weight:600}.xp .k b{display:block;font-size:22px;font-weight:800}' +
      '.xp .sec{display:flex;align-items:center;gap:8px;margin:10px 0 6px;font-size:14px;font-weight:800;color:#1e1b4b}.xp .sec:before{content:"";width:4px;height:16px;border-radius:2px;background:#4338ca;display:inline-block}.xp .sec small{font-weight:600;color:#64748b;font-size:11px}' +
      '.xp table{border-collapse:separate;border-spacing:0;width:100%;border-top:1px solid #cbd5e1;border-left:1px solid #cbd5e1;margin-bottom:10px;font-size:11px}.xp th,.xp td{border-right:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;padding:3px 6px;font-size:11px!important;font-weight:400;text-align:left}.xp thead th{font-weight:700;text-align:center}.xp thead th{background:#eef2ff;color:#312e81}.xp tbody tr:nth-child(even) td{background-color:#f8fafc}' +
      '.xp .ft{display:inline-block;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;border-radius:6px;padding:0 5px;font-size:9px;font-weight:800;margin-left:4px}.xp .lg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:10px;color:#475569;margin-top:6px}.xp .lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}';
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], DS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'], DL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  var C = { ok: ['#ecfdf5', '#10b981', 'เช็คแล้ว', '#047857'], no: ['#fef2f2', '#ef4444', 'ยังไม่เช็ค', '#b91c1c'], off: ['#f8fafc', '#cbd5e1', 'หยุดเรียน', '#64748b'], act: ['#f0f9ff', '#7dd3fc', 'กิจกรรม (ไม่นับ)', '#0369a1'], future: ['#f8fafc', '#cbd5e1', 'ยังไม่ถึง', '#94a3b8'], club: ['#fefce8', '#facc15', 'ชุมนุม (ไม่นับ)', '#a16207'], leave: ['#f1f5f9', '#94a3b8', 'ครูไปราชการ (ไม่นับ)', '#475569'], empty: ['#ffffff', '#e2e8f0', '', '#94a3b8'] };
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function dP(ds) { var p = String(ds).split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ymd(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function add(ds, n) { var d = dP(ds); d.setDate(d.getDate() + n); return ymd(d); }
  function th(ds, y) { var d = dP(ds); return d.getDate() + ' ' + MS[d.getMonth()] + (y ? ' ' + (d.getFullYear() + 543) : ''); }
  function plab(p) { return Number(p) === -2 ? 'A' : Number(p) === 0 ? 'B' : String(p); }
  function pc(p) { return p == null ? '#64748b' : p >= 90 ? '#16a34a' : p >= 75 ? '#d97706' : '#dc2626'; }
  function pctOf(ok, tot) { return tot ? Math.round(ok / tot * 100) : null; }
  function weekTxt(D) { return th(D.monday) + ' – ' + th(add(D.monday, 4), true); }
  function gradeOf(roomId) { return (/^m(\d)_/.exec(roomId || '') || [])[1] || ''; }

  window.mountExecWeekly = function (el) {
    if (!el) return;
    var st = { monday: '', view: 'sum', grade: '', room: '', showAll: false, rng: 'wk', th: 120 }, D = null, tok = 0, RC = {}, RG = null, rgTok = 0; // 2.11.1: rng = ช่วงของแท็บครู (wk/4w/term) · th = ช้าในวันเดียวกันเกินกี่นาทีจึงนับ (0 = นับเฉพาะข้ามวัน)
    async function load(fresh) {
      var my = ++tok;
      if (!D) el.innerHTML = '<div class="xw-skel"><div class="loading">กำลังโหลดข้อมูลจากเว็บเช็คชื่อ...</div></div>';
      var r; try { r = await apiCall('execWeekly', Object.assign({}, st.monday ? { monday: st.monday } : {}, fresh ? { fresh: 1 } : {})); } catch (e) { if (my === tok) el.innerHTML = '<div class="error-box">' + esc(e.message) + '</div>'; return; }
      if (my !== tok) return;
      if (!r.linked || !r.term) { el.innerHTML = '<div class="cb-mut" style="padding:8px 0">' + esc(r.reason || 'ยังไม่มีข้อมูล') + '</div>'; return; }
      D = r; st.monday = r.monday; if (!st.room || !D.rooms.some(function (x) { return x.roomId === st.room; })) st.room = D.rooms[0] ? D.rooms[0].roomId : '';
      render();
    }
    function rooms() { return D.rooms.filter(function (r) { return !st.grade || gradeOf(r.roomId) === st.grade; }); }
    function head() {
      var grades = []; D.rooms.forEach(function (r) { var g = gradeOf(r.roomId); if (g && grades.indexOf(g) === -1) grades.push(g); }); grades.sort();
      return '<div class="xw-top"><div class="section-title" style="margin:0"><i class="fa-solid fa-clipboard-check ui-icon" style="font-size:17px" aria-hidden="true"></i> การเช็คชื่อประจำสัปดาห์</div>' +
        '<div class="xw-wk"><button type="button" class="btn btn-ghost btn-sm" data-xw-wk="-1" aria-label="สัปดาห์ก่อน"' + (D.termStart && D.monday <= D.termStart ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button><b>' + esc(weekTxt(D)) + '</b><button type="button" class="btn btn-ghost btn-sm" data-xw-wk="1" aria-label="สัปดาห์ถัดไป"' + (D.monday >= D.maxMonday ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button></div></div>' +
        '<div class="xw-chips"><button type="button" class="xw-chip' + (st.view === 'sum' ? ' on' : '') + '" data-xw-view="sum">ทุกห้อง (สรุป)</button><button type="button" class="xw-chip' + (st.view === 'room' ? ' on' : '') + '" data-xw-view="room">รายห้อง</button><button type="button" class="xw-chip' + (st.view === 'tch' ? ' on' : '') + '" data-xw-view="tch">ครูที่ไม่เช็ค</button><button type="button" class="xw-chip' + (st.view === 'late' ? ' on' : '') + '" data-xw-view="late">ครูที่เช็คย้อนหลัง</button><span class="xw-sep"></span>' +
        '<button type="button" class="xw-chip sm' + (!st.grade ? ' on' : '') + '" data-xw-g="">ทุกระดับ</button>' + grades.map(function (g) { return '<button type="button" class="xw-chip sm' + (st.grade === g ? ' on' : '') + '" data-xw-g="' + g + '">ม.' + g + '</button>'; }).join('') + '</div>';
    }
    // 2.09.0: เวลาบันทึกครั้งแรก (วันเดียวกับคาบ = "บันทึก HH:MM" · วันถัดไป = "ย้อนหลัง วันที่ เวลา")
    function atTxt(x) {
      if (!x.at || (x.st !== 'ok' && x.st !== 'act')) return '';
      var d = x.at.slice(0, 10), hm = x.at.slice(11, 16);
      return x.backdated ? '<span class="xw-at late">ย้อนหลัง ' + esc(th(d)) + ' ' + esc(hm) + '</span>' : '<span class="xw-at">บันทึก ' + esc(hm) + ' น.</span>';
    }
    function kpis(list) {
      var ok = 0, tot = 0, bd = 0; list.forEach(function (r) { ok += r.ok; tot += r.tot; bd += r.backdated || 0; }); var p = tot ? Math.round(ok / tot * 1000) / 10 : null;
      return kpis0(ok, tot, p) + (bd ? '<div class="xw-bd"><i class="fa-solid fa-clock-rotate-left"></i> บันทึกย้อนหลัง ' + bd + ' คาบ <small>(บันทึกหลังวันที่ของคาบ)</small></div>' : '');
    }
    function kpis0(ok, tot, p) {
      return '<div class="xw-kp">' + [['คาบที่ต้องเช็ค', tot, '#0f172a', '#f8fafc', '#e5e7eb'], ['เช็คแล้ว', ok, '#16a34a', '#f0fdf4', '#bbf7d0'], ['ยังไม่เช็ค', tot - ok, '#dc2626', '#fef2f2', '#fecaca'], ['ภาพรวม', p == null ? '-' : p + '%', pc(p), '#eef2ff', '#c7d2fe']].map(function (x) { return '<div class="xw-k" style="background:' + x[3] + ';border-color:' + x[4] + '"><span>' + x[0] + '</span><b style="color:' + x[2] + '">' + x[1] + '</b></div>'; }).join('') + '</div>';
    }
    function bar(p) { return '<span class="xw-bar"><i style="width:' + (p || 0) + '%;background:' + pc(p) + '"></i></span><b style="color:' + pc(p) + '">' + (p == null ? '-' : p + '%') + '</b>'; }
    function renderSum() {
      var list = rooms(), byG = {};
      list.forEach(function (r) { var g = st.grade ? r.roomId : 'ม.' + gradeOf(r.roomId); var o = byG[g] = byG[g] || { label: st.grade ? r.room : g, ok: 0, tot: 0 }; o.ok += r.ok; o.tot += r.tot; });
      var rows = Object.keys(byG).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).map(function (k) { var o = byG[k], p = pctOf(o.ok, o.tot); return '<div class="xw-row"><b>' + esc(o.label) + '</b>' + bar(p) + '<small class="cb-mut">' + o.ok + '/' + o.tot + '</small></div>'; }).join('');
      var miss = (D.missing || []).filter(function (m) { return !m.leave && (!st.grade || gradeOf(m.roomId) === st.grade); }).slice().reverse();
      var shown = st.showAll ? miss : miss.slice(0, 5);
      return kpis(list) + '<div class="xw-two"><div><div class="xw-h">' + (st.grade ? 'รายห้อง ม.' + st.grade : 'รายระดับชั้น') + '</div>' + (rows || '<div class="cb-mut">ไม่มีข้อมูล</div>') + '</div>' +
        '<div><div class="xw-h" style="color:#b91c1c">คาบที่ยังไม่เช็ค' + (miss.length ? ' (' + miss.length + ')' : '') + '</div>' + (miss.length ? shown.map(function (m) { return '<div class="xw-miss"><span class="cb-mut">' + DS[dP(m.ds).getDay()] + ' ' + th(m.ds) + '</span><b>' + esc(m.room) + '</b> คาบ ' + plab(m.p) + ' · ' + esc((m.code ? m.code + ' ' : '') + m.name) + ' · ' + esc((m.teachers || []).join(', ')) + (m.foreign ? ' <span class="xw-ftag">ครูต่างชาติ</span>' : '') + (m.lvNote ? ' <span class="cb-mut">(' + esc(m.lvNote) + ')</span>' : '') + '</div>'; }).join('') + (miss.length > 5 ? '<button type="button" class="xw-more" data-xw-all>' + (st.showAll ? 'ย่อรายการ' : 'ดูทั้งหมด ' + miss.length + ' คาบ') + ' <i class="fa-solid fa-chevron-' + (st.showAll ? 'up' : 'down') + '"></i></button>' : '') : '<div style="color:#16a34a;font-weight:700">เช็คชื่อครบทุกคาบ</div>') + '</div></div>';
    }
    function slotCell(x) {
      var c = C[x.st] || C.empty, nm = x.name ? (x.code ? x.code + ' ' : '') + x.name : 'ว่าง', lab = x.st === 'leave' ? 'ครู' + (x.lv || 'ไปราชการ (ไม่นับ)') : c[2];
      return '<td class="xw-cell" style="background:' + c[0] + (x.foreign ? ';box-shadow:inset 3px 0 0 #0ea5e9' : '') + '"><i style="background:' + c[1] + '"></i><div><b' + (x.name ? '' : ' class="xw-empty"') + '>' + esc(nm) + '</b>' + (x.teachers && x.teachers.length ? '<span>' + esc(x.teachers.join(', ')) + '</span>' : '') + (x.name ? '<span style="color:' + c[3] + ';font-weight:700">' + esc(lab) + (x.foreign ? ' <span class="xw-ftag">ครูต่างชาติ</span>' : '') + '</span>' : '') + atTxt(x) + '</div></td>';
    }
    function roomGrid(r) {
      var slots = (D.slots || []), off = {};
      var h = '<table class="xw-grid"><thead><tr><th class="xw-p">คาบ</th>' + r.days.map(function (d) { var p = pctOf(d.ok, d.tot); return '<th>' + DS[dP(d.ds).getDay()] + ' ' + th(d.ds) + '<small style="color:' + (d.off ? '#94a3b8' : pc(p)) + '">' + (d.off ? 'วันหยุด' : d.tot ? d.ok + '/' + d.tot + ' · ' + p + '%' : 'ไม่นับ') + '</small></th>'; }).join('') + '</tr></thead><tbody>';
      slots.forEach(function (sl, j) {
        if (sl.p === -1) { h += '<tr><td class="xw-lunch">พัก</td>' + r.days.map(function (d, di) { if (d.off) { if (off[di]) return ''; off[di] = 1; return '<td rowspan="' + (slots.length - j) + '" class="xw-off">วันหยุด<small>' + esc(d.off) + '</small></td>'; } return '<td class="xw-lunch">พักกลางวัน</td>'; }).join('') + '</tr>'; return; }
        h += '<tr><th class="xw-p">' + plab(sl.p) + '</th>' + r.days.map(function (d, di) { if (d.off) { if (off[di]) return ''; off[di] = 1; return '<td rowspan="' + (slots.length - j) + '" class="xw-off">วันหยุด<small>' + esc(d.off) + '</small></td>'; } var x = (d.slots || []).filter(function (z) { return z.p === sl.p; })[0] || { p: sl.p, st: 'empty' }; return slotCell(x); }).join('') + '</tr>';
      });
      return h + '</tbody></table>';
    }
    function renderRoom() {
      var list = rooms(); if (!list.some(function (r) { return r.roomId === st.room; })) st.room = list[0] ? list[0].roomId : '';
      var r = list.filter(function (x) { return x.roomId === st.room; })[0];
      var chips = '<div class="xw-chips rooms">' + list.map(function (x) { return '<button type="button" class="xw-chip sm' + (x.roomId === st.room ? ' on' : '') + '" data-xw-room="' + esc(x.roomId) + '">' + esc(x.room) + ' <b style="color:' + pc(x.pct) + '">' + (x.pct == null ? '-' : x.pct + '%') + '</b></button>'; }).join('') + '</div>';
      if (!r) return chips + '<div class="cb-mut">ไม่มีห้อง</div>';
      return chips + '<div class="xw-rh"><b>' + esc(r.room) + ' · ครูที่ปรึกษา: ' + esc((r.advisors || []).join(', ') || '-') + '</b><b style="color:' + pc(r.pct) + ';font-size:1.2rem">' + (r.pct == null ? '-' : r.pct + '%') + ' <small class="cb-mut">(' + r.ok + '/' + r.tot + ' คาบ)</small></b></div><div class="cb-tbl-wrap">' + roomGrid(r) + '</div>' +
        '<div class="xw-lg">' + ['ok', 'no', 'off', 'club', 'act', 'leave'].map(function (k) { return '<span><i style="background:' + C[k][1] + '"></i>' + C[k][2] + '</span>'; }).join('') + '<span><i style="background:#0ea5e9"></i>ขอบฟ้า = คาบของครูต่างชาติ</span></div>';
    }
    // ---------- 2.11.1: ช่วงเวลาของแท็บครู (สัปดาห์นี้ / 4 สัปดาห์ / ทั้งภาคเรียน) — ดึงทีละสัปดาห์แบบย่อ (lite) · จำไว้ในหน้า ----------
    function rngWeeks() {
      if (st.rng === 'wk') return [D.monday];
      var from = st.rng === '4w' ? add(D.monday, -21) : (D.termStart || add(D.monday, -21)), out = [];
      if (D.termStart && from < D.termStart) from = D.termStart; // 2.12.4: ไม่ก่อนวันเริ่มเช็คชื่อ
      if (from > D.monday) from = D.monday;
      for (var m = from; m <= D.monday; m = add(m, 7)) out.push(m);
      return out;
    }
    function rngTxt() { var w = rngWeeks(); return w.length === 1 ? 'สัปดาห์ ' + weekTxt(D) : th(w[0]) + ' – ' + th(add(D.monday, 4), true) + ' (' + w.length + ' สัปดาห์)'; }
    async function loadRange() {
      var my = ++rgTok, weeks = rngWeeks(), need = weeks.filter(function (m) { return !RC[m] || !RC[m].at || (m === D.maxMonday && Date.now() - RC[m].at > 180000); });
      if (need.length) {
        var done = 0, prog = function () { var b = el.querySelector('.xw-body'); if (b && my === rgTok) b.innerHTML = rngBar() + '<div class="loading">กำลังรวมข้อมูล ' + done + ' / ' + need.length + ' สัปดาห์...</div>'; };
        prog();
        var q = need.slice(), worker = async function () { while (q.length) { var m = q.shift(); try { var r = await apiCall('execWeekly', { monday: m, lite: 1 }); RC[m] = { at: Date.now(), d: r }; } catch (e) { RC[m] = { at: 0, d: { missing: [], late: [], tcount: {}, err: e.message } }; } done++; prog(); } };
        await Promise.all([worker(), worker(), worker()]);
      }
      if (my !== rgTok) return;
      var agg = { missing: [], late: [], tcount: {}, weeks: weeks.length, err: 0 };
      weeks.forEach(function (m) { var d = (RC[m] || {}).d || {}; if (d.err) agg.err++; agg.missing = agg.missing.concat(d.missing || []); agg.late = agg.late.concat(d.late || []); Object.keys(d.tcount || {}).forEach(function (k) { var a = agg.tcount[k] = agg.tcount[k] || { tot: 0, ok: 0 }; a.tot += d.tcount[k].tot; a.ok += d.tcount[k].ok; }); });
      RG = agg; render();
    }
    function src() { return st.rng === 'wk' ? { missing: D.missing || [], late: D.late || [], tcount: D.tcount || {}, weeks: 1 } : RG; }
    function rngBar(extra) {
      return '<div class="xw-chips xw-rng"><span class="cb-mut" style="font-weight:700">ช่วง:</span>' + [['wk', 'สัปดาห์นี้'], ['4w', '4 สัปดาห์'], ['term', 'ทั้งภาคเรียน']].map(function (x) { return '<button type="button" class="xw-chip sm' + (st.rng === x[0] ? ' on' : '') + '" data-xw-rng="' + x[0] + '">' + x[1] + '</button>'; }).join('') + (extra || '') +
        '<span class="cb-mut xw-rtx">' + esc(rngTxt()) + '</span></div>';
    }
    function dly(m) { return m >= 1440 ? 'ช้า ' + (m / 1440).toFixed(1).replace(/\.0$/, '') + ' วัน' : 'ช้า ' + Math.floor(m / 60) + ' ชม.' + (m % 60 ? ' ' + (m % 60) + ' นาที' : ''); }
    function dDiff(l) { return Math.round((dP(l.at.slice(0, 10)) - dP(l.ds)) / 864e5); } // วันที่บันทึก − วันของคาบ
    function dlyOf(l) { return l.bd ? 'ช้า ' + dDiff(l) + ' วัน' : dly(l.lm); }
    function lateOn(l) { return l.bd || (st.th > 0 && l.lm >= st.th); }
    function lateRows() {
      var S = src(), by = {};
      S.late.filter(function (l) { return lateOn(l) && (!st.grade || gradeOf(l.roomId) === st.grade); }).forEach(function (l) {
        var who = l.by ? [l.by] : (l.teachers && l.teachers.length ? l.teachers : ['(ไม่ระบุครู)']);
        who.forEach(function (t) { var o = by[t] = by[t] || { name: t, n: 0, bd: 0, sum: 0, list: [] }; o.n++; if (l.bd) o.bd++; o.sum += l.lm; o.list.push(l); });
      });
      return Object.keys(by).map(function (k) { var o = by[k], c = S.tcount[k]; o.tot = c ? c.ok : 0; return o; }).sort(function (a, b) { return b.n - a.n || b.sum - a.sum || a.name.localeCompare(b.name, 'th'); });
    }
    function renderLate() {
      var thBar = '<span class="xw-sep"></span><span class="cb-mut" style="font-weight:700">เช็คช้าในวันเดียวกัน:</span>' + [[0, 'ไม่นับ'], [60, 'เกิน 1 ชม.'], [120, 'เกิน 2 ชม.'], [180, 'เกิน 3 ชม.']].map(function (x) { return '<button type="button" class="xw-chip sm' + (st.th === x[0] ? ' on' : '') + '" data-xw-th="' + x[0] + '">' + x[1] + '</button>'; }).join('');
      var S = src(); if (!S) return rngBar(thBar) + '<div class="loading">กำลังรวมข้อมูล...</div>';
      var L = lateRows(); st.lOpen = st.lOpen || {};
      var head = rngBar(thBar) + '<div class="cb-mut" style="margin-bottom:8px">' + (L.length ? L.length + ' คน · ' : '') + '<span style="color:#dc2626;font-weight:700">แดง</span> = บันทึกวันถัดไปขึ้นไป · <span style="color:#d97706;font-weight:700">ส้ม</span> = วันเดียวกันแต่หลังจบคาบ' + (st.th ? 'เกิน ' + st.th / 60 + ' ชม.' : '') + ' · นับให้คนที่บันทึกจริง (เช่น ครูสอนแทน)' + (S.err ? ' · <span style="color:#dc2626">โหลดไม่สำเร็จ ' + S.err + ' สัปดาห์</span>' : '') + '</div>';
      if (!L.length) return head + '<div class="xw-ok">ไม่มีการเช็คย้อนหลังในช่วงนี้ 🎉</div>';
      return head + L.map(function (t, i) {
        var o = !!st.lOpen[t.name], avg = Math.round(t.sum / t.n);
        return '<div class="xw-t lt' + (o ? ' open' : '') + '"><button type="button" class="xw-th" data-xw-lt="' + esc(t.name) + '"><span class="xw-rk">' + (i + 1) + '</span><b>' + esc(t.name) + '</b><span class="xw-tn">' + t.n + ' คาบ' + (t.tot ? ' <small class="xw-of">/ เช็ค ' + t.tot + '</small>' : '') + '<small class="xw-lsub">ข้ามวัน ' + t.bd + ' · เฉลี่ย' + dly(avg) + '</small></span><i class="fa-solid fa-chevron-' + (o ? 'up' : 'down') + '"></i></button>' +
          (o ? '<div class="xw-tl">' + t.list.slice().sort(function (a, b) { return a.ds.localeCompare(b.ds) || a.p - b.p; }).map(function (l) { var sub = l.by && (l.teachers || []).length && (l.teachers || []).indexOf(l.by) === -1; return '<div class="' + (l.bd ? (dDiff(l) >= 3 ? 'r3' : 'r') : 'o') + '"><span>' + DS[dP(l.ds).getDay()] + ' ' + th(l.ds) + ' · คาบ ' + plab(l.p) + '</span><span><b>' + esc(l.room) + '</b> ' + esc((l.code ? l.code + ' ' : '') + l.name) + (sub ? ' <span class="cb-mut">(สอนแทน ' + esc(l.teachers.join(', ')) + ')</span>' : '') + '</span><span>บันทึก ' + esc(th(l.at.slice(0, 10))) + ' ' + esc(l.at.slice(11, 16)) + ' น. · ' + dlyOf(l) + '</span></div>'; }).join('') + '</div>' : '') + '</div>';
      }).join('');
    }
    // 2.10.0: ครูที่ไม่เช็คมากที่สุด — รวมคาบที่ครูลา/ไปราชการ (ดูว่าคนสอนแทนไม่ได้เช็ค) · กดชื่อดูรายละเอียด
    function renderTch() {
      var by = {}, S = src(); if (!S) return rngBar() + '<div class="loading">กำลังรวมข้อมูล...</div>';
      (S.missing || []).filter(function (m) { return !st.grade || gradeOf(m.roomId) === st.grade; }).forEach(function (m) {
        (m.teachers && m.teachers.length ? m.teachers : ['(ไม่ระบุครู)']).forEach(function (t) { var o = by[t] = by[t] || { name: t, n: 0, lv: 0, list: [] }; o.n++; if (m.leave) o.lv++; o.list.push(m); });
      });
      var L = Object.keys(by).map(function (k) { var c = S.tcount[k]; by[k].tot = c ? c.tot : 0; return by[k]; }).sort(function (a, b) { return b.n - a.n || a.name.localeCompare(b.name, 'th'); });
      st.tOpen = st.tOpen || {};
      if (!L.length) return rngBar() + '<div class="xw-ok">เช็คชื่อครบทุกคาบในช่วงนี้ 🎉</div>';
      return rngBar() + '<div class="cb-mut" style="margin-bottom:8px">' + L.length + ' คน · นับคาบที่ไม่ได้เช็ค รวมคาบที่ครูลา/ไปราชการ (<span style="color:#7c3aed;font-weight:700">ม่วง</span> = คาบที่ครูไม่อยู่ — คนสอนแทนไม่ได้เช็ค)</div>' + L.map(function (t, i) {
        var o = !!st.tOpen[t.name];
        return '<div class="xw-t' + (o ? ' open' : '') + '"><button type="button" class="xw-th" data-xw-t="' + esc(t.name) + '"><span class="xw-rk">' + (i + 1) + '</span><b>' + esc(t.name) + '</b><span class="xw-tn">' + t.n + ' คาบ' + (t.tot ? ' <small class="xw-of">/ ' + t.tot + '</small>' : '') + (t.lv ? ' <small>(ลา/ไปราชการ ' + t.lv + ')</small>' : '') + '</span><i class="fa-solid fa-chevron-' + (o ? 'up' : 'down') + '"></i></button>' +
          (o ? '<div class="xw-tl">' + t.list.slice().sort(function (a, b) { return a.ds.localeCompare(b.ds) || a.p - b.p; }).map(function (m) { return '<div class="' + (m.leave ? 'lv' : '') + '"><span>' + DS[dP(m.ds).getDay()] + ' ' + th(m.ds) + ' · คาบ ' + plab(m.p) + '</span><span><b>' + esc(m.room) + '</b> ' + esc((m.code ? m.code + ' ' : '') + m.name) + '</span><span>' + (m.leave ? 'ครูไม่อยู่: ' + esc(m.lvNote || 'ลา/ไปราชการ') : m.lvNote ? esc(m.lvNote) : 'ไม่ได้เช็ค') + '</span></div>'; }).join('') + '</div>' : '') + '</div>';
      }).join('');
    }
    function render() {
      var tv = st.view === 'tch' || st.view === 'late';
      el.innerHTML = head() + '<div class="xw-body">' + (st.view === 'room' ? renderRoom() : st.view === 'tch' ? renderTch() : st.view === 'late' ? renderLate() : renderSum()) + '</div><div class="xw-act">' +
        (tv ? '<button type="button" class="btn btn-success btn-sm" data-xw-xls' + (src() ? '' : ' disabled') + '><i class="fa-solid fa-file-excel"></i> ส่งออก Excel</button>' : '<button type="button" class="btn btn-success btn-sm" data-xw-pdf><i class="fa-solid fa-file-pdf"></i> ส่งออก PDF' + (st.grade ? ' (ม.' + st.grade + ')' : '') + '</button>') + '</div>';
      if (tv && st.rng !== 'wk' && !RG) loadRange();
    }
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-xw-wk]'))) { st.monday = add(st.monday, Number(b.getAttribute('data-xw-wk')) * 7); RG = null; rgTok++; load(); return; }
      if ((b = e.target.closest('[data-xw-view]'))) { st.view = b.getAttribute('data-xw-view'); render(); return; }
      if ((b = e.target.closest('[data-xw-rng]'))) { st.rng = b.getAttribute('data-xw-rng'); RG = null; rgTok++; render(); return; }
      if ((b = e.target.closest('[data-xw-th]'))) { st.th = Number(b.getAttribute('data-xw-th')); render(); return; }
      if ((b = e.target.closest('[data-xw-lt]'))) { st.lOpen = st.lOpen || {}; var ln = b.getAttribute('data-xw-lt'); if (st.lOpen[ln]) delete st.lOpen[ln]; else st.lOpen[ln] = 1; render(); return; }
      if (e.target.closest('[data-xw-xls]')) { exportXls(); return; }
      if ((b = e.target.closest('[data-xw-g]'))) { st.grade = b.getAttribute('data-xw-g'); st.showAll = false; render(); return; }
      if ((b = e.target.closest('[data-xw-t]'))) { st.tOpen = st.tOpen || {}; var tn = b.getAttribute('data-xw-t'); if (st.tOpen[tn]) delete st.tOpen[tn]; else st.tOpen[tn] = 1; render(); return; }
      if ((b = e.target.closest('[data-xw-room]'))) { st.room = b.getAttribute('data-xw-room'); render(); return; }
      if (e.target.closest('[data-xw-all]')) { st.showAll = !st.showAll; render(); return; }
      if (e.target.closest('[data-xw-pdf]')) exportPdf();
    });
    // 2.11.1: ส่งออก Excel แท็บครู
    function exportXls() {
      var S = src(); if (!S) return;
      var rows = [], head, w, title;
      if (st.view === 'late') {
        title = 'ครูที่เช็คย้อนหลัง ' + rngTxt(); head = ['ครูที่บันทึก', 'วันที่', 'คาบ', 'ห้อง', 'วิชา', 'ครูประจำวิชา', 'บันทึกเมื่อ', 'ช้า (นาที)', 'ประเภท']; w = [24, 12, 6, 8, 30, 24, 18, 10, 18];
        lateRows().forEach(function (t) { t.list.forEach(function (l) { rows.push([t.name, l.ds, plab(l.p), l.room, (l.code ? l.code + ' ' : '') + l.name, (l.teachers || []).join(', '), l.at, l.lm, l.bd ? 'ย้อนหลัง (ข้ามวัน)' : 'ช้าในวันเดียวกัน']); }); });
      } else {
        title = 'ครูที่ไม่เช็คชื่อ ' + rngTxt(); head = ['ครู', 'วันที่', 'คาบ', 'ห้อง', 'วิชา', 'หมายเหตุ']; w = [24, 12, 6, 8, 30, 34];
        (S.missing || []).filter(function (m) { return !st.grade || gradeOf(m.roomId) === st.grade; }).forEach(function (m) { (m.teachers && m.teachers.length ? m.teachers : ['(ไม่ระบุครู)']).forEach(function (t) { rows.push([t, m.ds, plab(m.p), m.room, (m.code ? m.code + ' ' : '') + m.name, m.leave ? 'ครูไม่อยู่: ' + (m.lvNote || 'ลา/ไปราชการ') : m.lvNote || 'ไม่ได้เช็ค']); }); });
        rows.sort(function (a, b) { return String(a[0]).localeCompare(String(b[0]), 'th') || String(a[1]).localeCompare(String(b[1])); });
      }
      var wks = rngWeeks();
      downloadBlob(buildXlsx(st.view === 'late' ? 'เช็คย้อนหลัง' : 'ไม่เช็ค', head, rows, w, title), (st.view === 'late' ? 'ครูที่เช็คย้อนหลัง_' : 'ครูที่ไม่เช็คชื่อ_') + wks[0] + '_' + add(D.monday, 4) + '.xlsx');
    }
    // ---------- PDF (หน้าตาเดียวกับรายงานประจำสัปดาห์ของเว็บเช็คชื่อ) ----------
    var PCSS = window.XW_PCSS;
    function pHead(t, sub, right) { return '<div class="hd"><div><h1>' + t + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' + (right ? '<div style="text-align:right">' + right + '</div>' : '') + '</div>'; }
    function pKp(list) { var ok = 0, tot = 0; list.forEach(function (r) { ok += r.ok; tot += r.tot; }); var p = tot ? Math.round(ok / tot * 1000) / 10 : null; return '<div class="kp">' + [['คาบที่ต้องเช็ค', tot, '#0f172a', '#f8fafc', '#e2e8f0'], ['เช็คแล้ว', ok, '#16a34a', '#f0fdf4', '#bbf7d0'], ['ยังไม่เช็ค', tot - ok, '#dc2626', '#fef2f2', '#fecaca'], ['ภาพรวม', p == null ? '-' : p + '%', pc(p), '#eef2ff', '#c7d2fe']].map(function (x) { return '<div class="k" style="background:' + x[3] + ';border-color:' + x[4] + '"><span>' + x[0] + '</span><b style="color:' + x[2] + '">' + x[1] + '</b></div>'; }).join('') + '</div>'; }
    function cellBg(ok, tot) { if (!tot) return ''; var p = ok / tot * 100; return p >= 100 ? '#dcfce7' : p >= 75 ? '#fef9c3' : '#fee2e2'; }
    function sumPages(list) {
      var wt = weekTxt(D), miss = (D.missing || []).filter(function (m) { return !m.leave && (!st.grade || gradeOf(m.roomId) === st.grade); });
      var rRow = function (r) { return '<tr><td><b>' + esc(r.room) + '</b></td>' + r.days.map(function (d) { return '<td style="text-align:center;' + (d.off ? 'color:#94a3b8' : d.tot ? 'background:' + cellBg(d.ok, d.tot) : '') + '">' + (d.off ? 'หยุด' : d.tot ? d.ok + '/' + d.tot : '-') + '</td>'; }).join('') + '<td style="text-align:center">' + r.ok + '/' + r.tot + '</td><td><div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:7px;border-radius:9px;background:#e2e8f0;overflow:hidden"><div style="height:7px;width:' + (r.pct || 0) + '%;background:' + pc(r.pct) + '"></div></div><b style="color:' + pc(r.pct) + ';width:36px;text-align:right">' + (r.pct == null ? '-' : r.pct + '%') + '</b></div></td></tr>'; };
      var rHead = '<tr><th style="width:62px">ห้อง</th>' + D.dates.map(function (ds) { return '<th>' + DS[dP(ds).getDay()] + ' ' + dP(ds).getDate() + '</th>'; }).join('') + '<th style="width:64px">รวม</th><th style="width:140px">%</th></tr>';
      var mRow = function (m) { return '<tr><td style="text-align:center;white-space:nowrap">' + DS[dP(m.ds).getDay()] + ' ' + th(m.ds) + '</td><td style="text-align:center"><b>' + esc(m.room) + '</b></td><td style="text-align:center">' + plab(m.p) + '</td><td>' + esc((m.code ? m.code + ' ' : '') + m.name) + '</td><td>' + esc((m.teachers || []).join(', ') || '-') + (m.foreign ? '<span class="ft">ครูต่างชาติ</span>' : '') + (m.lvNote ? '<span style="color:#64748b"> (' + esc(m.lvNote) + ')</span>' : '') + '</td></tr>'; };
      var mHead = '<tr><th style="width:82px">วันที่</th><th style="width:56px">ห้อง</th><th style="width:36px">คาบ</th><th>วิชา</th><th>ครูผู้สอน</th></tr>';
      var hd = function (first) { return pHead('รายงานการเช็คชื่อประจำสัปดาห์', first ? 'สรุป' + (st.grade ? ' ม.' + st.grade : 'ทุกห้อง') + ' · นับจากคาบที่ต้องเช็คตามตารางสอน (วันหยุด / หยุดเรียน / ชุมนุม ไม่นับ)' : 'สรุป (ต่อ)', '<span class="pill">สัปดาห์ ' + esc(wt) + '</span>'); };
      var parts = [], chunks = []; for (var i = 0; i < list.length; i += 26) chunks.push(list.slice(i, i + 26)); if (!chunks.length) chunks.push([]);
      var mi = 0;
      chunks.forEach(function (ch, i) {
        var inner = hd(i === 0) + (i === 0 ? pKp(list) : '') + '<div class="sec">สรุปรายห้อง <small>สีช่อง: เขียว = ครบ · เหลือง = 75% ขึ้นไป · แดง = ต่ำกว่า 75%</small></div><table><thead>' + rHead + '</thead><tbody>' + ch.map(rRow).join('') + '</tbody></table>';
        if (i === chunks.length - 1) { var room = Math.max(0, 30 - ch.length - (i === 0 ? 4 : 0)); if (!miss.length) inner += '<div style="margin-top:12px;color:#16a34a;font-weight:800;font-size:14px">เช็คชื่อครบทุกคาบ</div>'; else if (room > 2) { inner += '<div class="sec" style="color:#b91c1c">คาบที่ยังไม่เช็คชื่อ <small>' + miss.length + ' คาบ · เรียงตามวัน</small></div><table><thead>' + mHead + '</thead><tbody>' + miss.slice(0, room).map(mRow).join('') + '</tbody></table>'; mi = room; } }
        parts.push(inner);
      });
      while (mi < miss.length) { parts.push(hd(false) + '<div class="sec" style="color:#b91c1c">คาบที่ยังไม่เช็คชื่อ (ต่อ)</div><table><thead>' + mHead + '</thead><tbody>' + miss.slice(mi, mi + 34).map(mRow).join('') + '</tbody></table>'); mi += 34; }
      return parts;
    }
    function roomPage(r) {
      var slots = D.slots || [], n = slots.filter(function (s) { return s.p !== -1; }).length, H = Math.max(46, Math.min(70, Math.floor(760 / Math.max(1, n)))), off = {};
      var td = function (x) { var c = C[x.st] || C.empty, nm = x.name ? (x.code ? x.code + ' ' : '') + x.name : 'ว่าง', lab = x.st === 'leave' ? 'ครู' + (x.lv || 'ไปราชการ (ไม่นับ)') : c[2]; return '<td style="background:' + c[0] + ';padding:0;vertical-align:top;height:' + H + 'px"><div style="display:flex;gap:5px;padding:4px 5px;height:' + (H - 1) + 'px;box-sizing:border-box;overflow:hidden;border-left:3px solid ' + (x.foreign ? '#0ea5e9' : 'transparent') + '"><span style="flex:none;width:15px;height:15px;border-radius:50%;background:' + c[1] + ';color:#fff;font-size:8px;font-weight:800;display:flex;align-items:center;justify-content:center;margin-top:2px">' + plab(x.p) + '</span><div style="min-width:0;flex:1;font-size:9.5px"><div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:' + (x.name ? '#0f172a' : '#94a3b8') + '">' + esc(nm) + '</div>' + (x.teachers && x.teachers.length ? '<div style="color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(x.teachers.join(', ')) + '</div>' : '') + (x.name ? '<div style="white-space:nowrap;overflow:hidden"><b style="color:' + c[3] + '">' + esc(lab) + '</b>' + (x.foreign ? '<span class="ft">ครูต่างชาติ</span>' : '') + '</div>' : '') + (x.lvNote ? '<div style="color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(x.lvNote) + '</div>' : '') + '</div></div></td>'; };
      var offTd = function (d, j) { return '<td rowspan="' + (slots.length - j) + '" style="background:#f8fafc;text-align:center;vertical-align:middle;color:#94a3b8;font-weight:800">วันหยุด<div style="font-weight:400;font-size:10px">' + esc(d.off) + '</div></td>'; };
      var body = '';
      slots.forEach(function (sl, j) {
        var lu = 'background:#fffbeb;color:#b45309;font-weight:700;font-size:10px;text-align:center;padding:1px';
        if (sl.p === -1) { body += '<tr><td style="' + lu + '">พัก</td>' + r.days.map(function (d, di) { if (d.off) { if (off[di]) return ''; off[di] = 1; return offTd(d, j); } return '<td style="' + lu + '">พักกลางวัน</td>'; }).join('') + '</tr>'; return; }
        body += '<tr><td style="background:#eef2ff;color:#3730a3;font-weight:800;text-align:center">' + plab(sl.p) + '</td>' + r.days.map(function (d, di) { if (d.off) { if (off[di]) return ''; off[di] = 1; return offTd(d, j); } return td((d.slots || []).filter(function (z) { return z.p === sl.p; })[0] || { p: sl.p, st: 'empty' }); }).join('') + '</tr>';
      });
      var hrow = '<tr><th style="width:42px">คาบ</th>' + r.days.map(function (d) { var p = pctOf(d.ok, d.tot); return '<th>' + DL[dP(d.ds).getDay()] + ' ' + th(d.ds) + '<div style="font-weight:600;color:' + (d.off ? '#94a3b8' : pc(p)) + ';font-size:10px">' + (d.off ? 'วันหยุด' : d.tot ? d.ok + '/' + d.tot + ' · ' + p + '%' : 'ไม่นับ') + (d.makeup ? ' · ' + esc(d.makeup) : '') + '</div></th>'; }).join('') + '</tr>';
      var lg = '<div class="lg">' + ['ok', 'no', 'off', 'club', 'act', 'leave'].map(function (k) { return '<span><i style="background:' + C[k][1] + '"></i>' + C[k][2] + '</span>'; }).join('') + '<span><i style="background:#0ea5e9"></i>ขอบฟ้า = คาบของครูต่างชาติ</span></div>';
      return pHead(esc(r.room) + ' · รายงานการเช็คชื่อประจำสัปดาห์', 'ครูที่ปรึกษา: ' + esc((r.advisors || []).join(', ') || '-'), '<span class="pill">สัปดาห์ ' + esc(weekTxt(D)) + '</span><div style="font-size:20px;font-weight:800;color:' + pc(r.pct) + ';margin-top:4px">' + (r.pct == null ? '-' : r.pct + '%') + ' <span style="font-size:11px;color:#64748b">(' + r.ok + '/' + r.tot + ' คาบ)</span></div>') + '<table style="table-layout:fixed"><thead>' + hrow + '</thead><tbody>' + body + '</tbody></table>' + lg;
    }
    async function exportPdf() {
      if (!D) return;
      var list = rooms(), parts = sumPages(list).concat(list.map(roomPage));
      var go = await withProgress('กำลังสร้างรายงาน PDF', async function () {
        await loadScriptOnce('assets/html2canvas.min.js'); await loadScriptOnce('assets/jspdf.umd.min.js');
        var box = document.createElement('div'); box.className = 'xp'; var now = new Date();
        var stamp = now.getDate() + ' ' + MS[now.getMonth()] + ' ' + (now.getFullYear() + 543) + ' ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2) + ' น.';
        box.innerHTML = '<style>' + PCSS + '</style>' + parts.map(function (x, i) { return '<div class="pg"><div class="band"><b>' + esc(D.title || 'ระบบเช็คชื่อ') + '</b><span>รายงานการเช็คชื่อประจำสัปดาห์</span></div>' + x + '<div class="foot"><span>ภาคเรียนที่ ' + esc(D.term.term + '/' + D.term.year) + ' · ข้อมูล ณ ' + stamp + '</span><span>หน้า ' + (i + 1) + ' / ' + parts.length + '</span></div></div>'; }).join('');
        document.body.appendChild(box);
        try {
          await new Promise(function (r) { setTimeout(r, 250); });
          var pdf = new jspdf.jsPDF('p', 'pt', 'a4'), els = box.querySelectorAll('.pg');
          for (var i = 0; i < els.length; i++) { var cv = await html2canvas(els[i], { scale: 1.6, backgroundColor: '#ffffff', logging: false, windowWidth: 794 }); if (i) pdf.addPage(); pdf.addImage(cv.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 595.28, 841.89); }
          pdf.save('รายงานเช็คชื่อประจำสัปดาห์_' + D.monday + (st.grade ? '_ม' + st.grade : '') + '.pdf');
        } finally { box.remove(); }
        return true;
      }, { success: 'สร้างไฟล์ PDF แล้ว' }).catch(function (e) { showToast(e.message, 'error'); });
      return go;
    }
    load();
  };
})();
