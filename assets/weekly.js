/* 2.01.0 — การเช็คชื่อประจำสัปดาห์ (หน้าแรกผู้บริหาร) · ข้อมูลจากเว็บเช็คชื่อ (apiCall 'execWeekly')
 * สรุปทุกห้อง · รายระดับชั้น · คาบที่ยังไม่เช็ค · ตารางรายห้อง (คาบ × วัน) · ส่งออก PDF แบบเดียวกับรายงานของเว็บเช็คชื่อ */
(function () {
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'], DS = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'], DL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  var C = { ok: ['#ecfdf5', '#10b981', 'เช็คแล้ว', '#047857'], no: ['#fef2f2', '#ef4444', 'ยังไม่เช็ค', '#b91c1c'], off: ['#f8fafc', '#cbd5e1', 'หยุดเรียน', '#64748b'], act: ['#f0f9ff', '#7dd3fc', 'กิจกรรม', '#0369a1'], future: ['#f8fafc', '#cbd5e1', 'ยังไม่ถึง', '#94a3b8'], club: ['#fefce8', '#facc15', 'ชุมนุม (ไม่นับ)', '#a16207'], leave: ['#f1f5f9', '#94a3b8', 'ครูไปราชการ (ไม่นับ)', '#475569'], empty: ['#ffffff', '#e2e8f0', '', '#94a3b8'] };
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
    var st = { monday: '', view: 'sum', grade: '', room: '', showAll: false }, D = null, tok = 0;
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
        '<div class="xw-wk"><button type="button" class="btn btn-ghost btn-sm" data-xw-wk="-1" aria-label="สัปดาห์ก่อน"><i class="fa-solid fa-chevron-left"></i></button><b>' + esc(weekTxt(D)) + '</b><button type="button" class="btn btn-ghost btn-sm" data-xw-wk="1" aria-label="สัปดาห์ถัดไป"' + (D.monday >= D.maxMonday ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button></div></div>' +
        '<div class="xw-chips"><button type="button" class="xw-chip' + (st.view === 'sum' ? ' on' : '') + '" data-xw-view="sum">ทุกห้อง (สรุป)</button><button type="button" class="xw-chip' + (st.view === 'room' ? ' on' : '') + '" data-xw-view="room">รายห้อง</button><span class="xw-sep"></span>' +
        '<button type="button" class="xw-chip sm' + (!st.grade ? ' on' : '') + '" data-xw-g="">ทุกระดับ</button>' + grades.map(function (g) { return '<button type="button" class="xw-chip sm' + (st.grade === g ? ' on' : '') + '" data-xw-g="' + g + '">ม.' + g + '</button>'; }).join('') + '</div>';
    }
    function kpis(list) {
      var ok = 0, tot = 0; list.forEach(function (r) { ok += r.ok; tot += r.tot; }); var p = tot ? Math.round(ok / tot * 1000) / 10 : null;
      return '<div class="xw-kp">' + [['คาบที่ต้องเช็ค', tot, '#0f172a', '#f8fafc', '#e5e7eb'], ['เช็คแล้ว', ok, '#16a34a', '#f0fdf4', '#bbf7d0'], ['ยังไม่เช็ค', tot - ok, '#dc2626', '#fef2f2', '#fecaca'], ['ภาพรวม', p == null ? '-' : p + '%', pc(p), '#eef2ff', '#c7d2fe']].map(function (x) { return '<div class="xw-k" style="background:' + x[3] + ';border-color:' + x[4] + '"><span>' + x[0] + '</span><b style="color:' + x[2] + '">' + x[1] + '</b></div>'; }).join('') + '</div>';
    }
    function bar(p) { return '<span class="xw-bar"><i style="width:' + (p || 0) + '%;background:' + pc(p) + '"></i></span><b style="color:' + pc(p) + '">' + (p == null ? '-' : p + '%') + '</b>'; }
    function renderSum() {
      var list = rooms(), byG = {};
      list.forEach(function (r) { var g = st.grade ? r.roomId : 'ม.' + gradeOf(r.roomId); var o = byG[g] = byG[g] || { label: st.grade ? r.room : g, ok: 0, tot: 0 }; o.ok += r.ok; o.tot += r.tot; });
      var rows = Object.keys(byG).sort(function (a, b) { return a.localeCompare(b, undefined, { numeric: true }); }).map(function (k) { var o = byG[k], p = pctOf(o.ok, o.tot); return '<div class="xw-row"><b>' + esc(o.label) + '</b>' + bar(p) + '<small class="cb-mut">' + o.ok + '/' + o.tot + '</small></div>'; }).join('');
      var miss = D.missing.filter(function (m) { return !st.grade || gradeOf(m.roomId) === st.grade; }).slice().reverse();
      var shown = st.showAll ? miss : miss.slice(0, 5);
      return kpis(list) + '<div class="xw-two"><div><div class="xw-h">' + (st.grade ? 'รายห้อง ม.' + st.grade : 'รายระดับชั้น') + '</div>' + (rows || '<div class="cb-mut">ไม่มีข้อมูล</div>') + '</div>' +
        '<div><div class="xw-h" style="color:#b91c1c">คาบที่ยังไม่เช็ค' + (miss.length ? ' (' + miss.length + ')' : '') + '</div>' + (miss.length ? shown.map(function (m) { return '<div class="xw-miss"><span class="cb-mut">' + DS[dP(m.ds).getDay()] + ' ' + th(m.ds) + '</span><b>' + esc(m.room) + '</b> คาบ ' + plab(m.p) + ' · ' + esc((m.code ? m.code + ' ' : '') + m.name) + ' · ' + esc((m.teachers || []).join(', ')) + (m.foreign ? ' <span class="xw-ftag">ครูต่างชาติ</span>' : '') + (m.lvNote ? ' <span class="cb-mut">(' + esc(m.lvNote) + ')</span>' : '') + '</div>'; }).join('') + (miss.length > 5 ? '<button type="button" class="xw-more" data-xw-all>' + (st.showAll ? 'ย่อรายการ' : 'ดูทั้งหมด ' + miss.length + ' คาบ') + ' <i class="fa-solid fa-chevron-' + (st.showAll ? 'up' : 'down') + '"></i></button>' : '') : '<div style="color:#16a34a;font-weight:700">เช็คชื่อครบทุกคาบ</div>') + '</div></div>';
    }
    function slotCell(x) {
      var c = C[x.st] || C.empty, nm = x.name ? (x.code ? x.code + ' ' : '') + x.name : 'ว่าง', lab = x.st === 'leave' ? 'ครู' + (x.lv || 'ไปราชการ (ไม่นับ)') : c[2];
      return '<td class="xw-cell" style="background:' + c[0] + (x.foreign ? ';box-shadow:inset 3px 0 0 #0ea5e9' : '') + '"><i style="background:' + c[1] + '"></i><div><b' + (x.name ? '' : ' class="xw-empty"') + '>' + esc(nm) + '</b>' + (x.teachers && x.teachers.length ? '<span>' + esc(x.teachers.join(', ')) + '</span>' : '') + (x.name ? '<span style="color:' + c[3] + ';font-weight:700">' + esc(lab) + (x.foreign ? ' <span class="xw-ftag">ครูต่างชาติ</span>' : '') + '</span>' : '') + '</div></td>';
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
    function render() {
      el.innerHTML = head() + '<div class="xw-body">' + (st.view === 'room' ? renderRoom() : renderSum()) + '</div><div class="xw-act"><button type="button" class="btn btn-success btn-sm" data-xw-pdf><i class="fa-solid fa-file-pdf"></i> ส่งออก PDF' + (st.grade ? ' (ม.' + st.grade + ')' : '') + '</button></div>';
    }
    el.addEventListener('click', function (e) {
      var b;
      if ((b = e.target.closest('[data-xw-wk]'))) { st.monday = add(st.monday, Number(b.getAttribute('data-xw-wk')) * 7); load(); return; }
      if ((b = e.target.closest('[data-xw-view]'))) { st.view = b.getAttribute('data-xw-view'); render(); return; }
      if ((b = e.target.closest('[data-xw-g]'))) { st.grade = b.getAttribute('data-xw-g'); st.showAll = false; render(); return; }
      if ((b = e.target.closest('[data-xw-room]'))) { st.room = b.getAttribute('data-xw-room'); render(); return; }
      if (e.target.closest('[data-xw-all]')) { st.showAll = !st.showAll; render(); return; }
      if (e.target.closest('[data-xw-pdf]')) exportPdf();
    });
    // ---------- PDF (หน้าตาเดียวกับรายงานประจำสัปดาห์ของเว็บเช็คชื่อ) ----------
    var PCSS = '.xp{position:fixed;left:-30000px;top:0;font-family:Sarabun,"Noto Sans Thai",sans-serif;color:#0f172a}.xp .pg{position:relative;width:794px;height:1123px;box-sizing:border-box;padding:66px 38px 50px;background:#fff;overflow:hidden;display:flex;flex-direction:column}.xp *{line-height:1.6}' +
      '.xp .band{position:absolute;left:38px;right:38px;top:0;height:48px;display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #4338ca;font-size:11px;color:#475569}.xp .band b{color:#312e81}.xp .foot{position:absolute;left:38px;right:38px;bottom:0;height:36px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;font-size:10px;color:#94a3b8}' +
      '.xp .hd{display:flex;justify-content:space-between;align-items:flex-end;gap:12px;margin:2px 0 12px}.xp h1{font-size:22px;font-weight:800;color:#1e1b4b;margin:0}.xp .sub{font-size:12px;color:#64748b}.xp .pill{display:inline-block;background:#eef2ff;color:#3730a3;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:700;white-space:nowrap}' +
      '.xp .kp{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:12px}.xp .k{border-radius:12px;padding:6px 12px;border:1px solid}.xp .k span{display:block;font-size:11px;color:#475569;font-weight:600}.xp .k b{display:block;font-size:22px;font-weight:800}' +
      '.xp .sec{display:flex;align-items:center;gap:8px;margin:10px 0 6px;font-size:14px;font-weight:800;color:#1e1b4b}.xp .sec:before{content:"";width:4px;height:16px;border-radius:2px;background:#4338ca;display:inline-block}.xp .sec small{font-weight:600;color:#64748b;font-size:11px}' +
      '.xp table{border-collapse:separate;border-spacing:0;width:100%;border-top:1px solid #cbd5e1;border-left:1px solid #cbd5e1;margin-bottom:10px;font-size:11px}.xp th,.xp td{border-right:1px solid #cbd5e1;border-bottom:1px solid #cbd5e1;padding:3px 6px;font-size:11px!important;font-weight:400;text-align:left}.xp thead th{font-weight:700;text-align:center}.xp thead th{background:#eef2ff;color:#312e81}.xp tbody tr:nth-child(even) td{background-color:#f8fafc}' +
      '.xp .ft{display:inline-block;background:#e0f2fe;color:#0369a1;border:1px solid #7dd3fc;border-radius:6px;padding:0 5px;font-size:9px;font-weight:800;margin-left:4px}.xp .lg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:10px;color:#475569;margin-top:6px}.xp .lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}';
    function pHead(t, sub, right) { return '<div class="hd"><div><h1>' + t + '</h1>' + (sub ? '<div class="sub">' + sub + '</div>' : '') + '</div>' + (right ? '<div style="text-align:right">' + right + '</div>' : '') + '</div>'; }
    function pKp(list) { var ok = 0, tot = 0; list.forEach(function (r) { ok += r.ok; tot += r.tot; }); var p = tot ? Math.round(ok / tot * 1000) / 10 : null; return '<div class="kp">' + [['คาบที่ต้องเช็ค', tot, '#0f172a', '#f8fafc', '#e2e8f0'], ['เช็คแล้ว', ok, '#16a34a', '#f0fdf4', '#bbf7d0'], ['ยังไม่เช็ค', tot - ok, '#dc2626', '#fef2f2', '#fecaca'], ['ภาพรวม', p == null ? '-' : p + '%', pc(p), '#eef2ff', '#c7d2fe']].map(function (x) { return '<div class="k" style="background:' + x[3] + ';border-color:' + x[4] + '"><span>' + x[0] + '</span><b style="color:' + x[2] + '">' + x[1] + '</b></div>'; }).join('') + '</div>'; }
    function cellBg(ok, tot) { if (!tot) return ''; var p = ok / tot * 100; return p >= 100 ? '#dcfce7' : p >= 75 ? '#fef9c3' : '#fee2e2'; }
    function sumPages(list) {
      var wt = weekTxt(D), miss = D.missing.filter(function (m) { return !st.grade || gradeOf(m.roomId) === st.grade; });
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
