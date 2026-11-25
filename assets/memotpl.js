/* 2.33.0: แม่แบบบันทึกข้อความ — อ่านช่องจากแม่แบบ + วาดกระดาษ A4 (ใช้ทั้งหน้าเขียนและหน้าสร้างแม่แบบ)
 * ช่องที่ระบบเติมให้: {ชื่อ} {ตำแหน่ง} {กลุ่มสาระ} {โรงเรียน} {จำนวนนักเรียน} {จำนวนรายการ} {วันนี้} {ปีการศึกษา} {ภาคเรียน}
 * ช่องที่ผู้เขียนกรอก: [ชื่อช่อง] · [ชื่อช่อง:วันที่] · [ชื่อช่อง:ช่วงวันที่] · [ชื่อช่อง:ตัวเลข] · [ชื่อช่อง:เวลา] · [ชื่อช่อง:ข้อความยาว] · [ชื่อช่อง:ตัวเลือก=ก|ข]
 * ชื่อช่องซ้ำกัน = ช่องเดียวกัน (กรอกครั้งเดียว ขึ้นทุกที่) */
(function () {
  var MON = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var SYS = ['ชื่อ', 'ตำแหน่ง', 'กลุ่มสาระ', 'โรงเรียน', 'จำนวนนักเรียน', 'จำนวนรายการ', 'วันนี้', 'ปีการศึกษา', 'ภาคเรียน'];
  var TYPES = { 'วันที่': 'date', 'ช่วงวันที่': 'range', 'ตัวเลข': 'number', 'เวลา': 'time', 'ข้อความยาว': 'long' };
  var FRX = /\[([^\[\]:{}\n]{1,60})(?::([^\[\]\n]{1,200}))?\]/g, SRX = /\{([^{}\n]{1,20})\}/g;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function thD(s) { var p = String(s || '').split('-'); return p.length === 3 && +p[1] ? (+p[2]) + ' ' + MON[+p[1] - 1] + ' ' + (+p[0] + 543) : ''; }
  function thRange(a, b) {
    if (!a) return ''; if (!b || a === b) return thD(a);
    var x = a.split('-'), y = b.split('-');
    if (x[0] === y[0] && x[1] === y[1]) return (+x[2]) + ' – ' + thD(b);
    if (x[0] === y[0]) return (+x[2]) + ' ' + MON[+x[1] - 1] + ' – ' + thD(b);
    return thD(a) + ' – ' + thD(b);
  }
  function parseType(t) {
    t = String(t || '').trim(); if (!t) return { type: 'text' };
    if (/^ตัวเลือก\s*=/.test(t)) return { type: 'select', opts: t.replace(/^ตัวเลือก\s*=/, '').split('|').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 20) };
    return { type: TYPES[t] || 'text' };
  }
  // ช่องที่ต้องกรอกตามลำดับที่เจอ (เรื่อง → เรียน → เนื้อหา → ข้อความปิดท้าย)
  function fields(def) {
    var out = [], seen = {};
    [def.subject, def.to, def.body, def.closing].forEach(function (txt) {
      String(txt || '').replace(FRX, function (m, name, t) { name = name.trim(); if (!name || seen[name]) return m; seen[name] = 1; var x = parseType(t); x.name = name; out.push(x); return m; });
    });
    return out;
  }
  function sysVal(k, ctx) {
    var me = ctx.me || {};
    switch (k) {
      case 'ชื่อ': return me.name || ''; case 'ตำแหน่ง': return me.position || ''; case 'กลุ่มสาระ': return me.subjectGroup || '';
      case 'โรงเรียน': return ctx.schoolName || ''; case 'จำนวนนักเรียน': return (ctx.students || []).length ? String(ctx.students.length) : '';
      case 'จำนวนรายการ': return (ctx.rows || []).filter(function (r) { return (r || []).some(function (c) { return String(c || '').trim(); }); }).length || '';
      case 'วันนี้': return thD(ctx.today || ''); case 'ปีการศึกษา': return ctx.year || ''; case 'ภาคเรียน': return ctx.semester || '';
    }
    return null;
  }
  var W = { text: 160, date: 140, range: 190, number: 60, time: 80, select: 120 };
  function dots(w) { return '<span class="mm-dot" style="min-width:' + w + 'px">&nbsp;</span>'; }
  function valOf(f, v) {
    if (v == null || v === '') return '';
    if (f.type === 'date') return thD(v);
    if (f.type === 'range') return v && v.from ? thRange(v.from, v.to) : '';
    return String(v);
  }
  // แทนช่องในข้อความ 1 บรรทัด → HTML
  function fillLine(txt, ctx, fmap) {
    var parts = [], last = 0, re = new RegExp(FRX.source + '|' + SRX.source, 'g'), m;
    txt = String(txt || '');
    while ((m = re.exec(txt))) {
      parts.push(esc(txt.slice(last, m.index))); last = re.lastIndex;
      if (m[1] !== undefined) {
        var f = fmap[m[1].trim()] || { type: 'text' }, v = ctx.blank ? '' : valOf(f, (ctx.values || {})[m[1].trim()]);
        parts.push(v ? esc(v) : dots(W[f.type] || 120));
      } else {
        var k = m[3].trim(), sv = sysVal(k, ctx);
        if (sv === null) parts.push(esc(m[0]));
        else if (ctx.blank && k !== 'โรงเรียน' && k !== 'วันนี้') parts.push(dots(k === 'ชื่อ' ? 180 : 90));
        else parts.push(sv ? esc(sv) : dots(90));
      }
    }
    parts.push(esc(txt.slice(last)));
    return parts.join('');
  }
  function fmapOf(def) { var o = {}; fields(def).forEach(function (f) { o[f.name] = f; }); return o; }
  // ย่อหน้าเนื้อหา — ช่อง "ข้อความยาว" ที่อยู่บรรทัดเดียวโดด ๆ แตกเป็นหลายย่อหน้าตามที่พิมพ์
  function bodyHtml(def, ctx, fmap) {
    var h = '';
    String(def.body || '').split('\n').forEach(function (line) {
      if (!line.trim()) return;
      var only = /^\s*\[([^\[\]:]{1,60}):ข้อความยาว\]\s*$/.exec(line);
      if (only) {
        var v = ctx.blank ? '' : String((ctx.values || {})[only[1].trim()] || '');
        if (!v.trim()) { h += '<div class="memo-line memo-indent">' + dots(400) + '</div>' + '<div class="mm-dotline"></div><div class="mm-dotline"></div><div class="mm-dotline"></div>'; return; }
        v.split('\n').forEach(function (p) { if (p.trim()) h += '<div class="memo-line memo-indent">' + esc(p.trim()) + '</div>'; });
        return;
      }
      h += '<div class="memo-line memo-indent">' + fillLine(line, ctx, fmap) + '</div>';
    });
    return h;
  }
  function stuTables(list, rows, offset) {
    function one(off) {
      var h = '<table class="mm-tb"><thead><tr><th style="width:34px">ที่</th><th>ชื่อ – สกุล</th><th style="width:60px">ชั้น</th></tr></thead><tbody>';
      for (var i = 0; i < rows; i++) { var s = list[off + i]; h += '<tr><td>' + (s ? offset + off + i + 1 : '') + '</td><td class="l">' + (s ? esc(s.name) : '') + '</td><td>' + (s ? esc(s.room || '') : '') + '</td></tr>'; }
      return h + '</tbody></table>';
    }
    return '<div class="mm-tbs">' + one(0) + one(rows) + '</div>';
  }
  function customTable(def, ctx) {
    var cols = def.table.cols || [], rows = (ctx.blank ? [] : (ctx.rows || [])).filter(function (r) { return (r || []).some(function (c) { return String(c || '').trim(); }); });
    var n = Math.max(def.table.rows || 5, rows.length);
    var h = '<table class="mm-tb" style="margin:8px 0 10px"><thead><tr><th style="width:34px">ที่</th>' + cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>';
    for (var i = 0; i < n; i++) { var r = rows[i]; h += '<tr><td>' + (r ? i + 1 : '') + '</td>' + cols.map(function (c, j) { return '<td class="l">' + (r ? esc(r[j] || '') : '') + '</td>'; }).join('') + '</tr>'; }
    return h + '</tbody></table>';
  }
  function shortPos(p) { return String(p || '').replace(/^รองผู้อำนวยการ/, 'รองฯ '); }
  function signers(ctx) {
    var st = ctx.settings || {}, dept = ctx.dept || '', d = (st.departmentSigners && st.departmentSigners[dept]) || {};
    var gl = typeof groupLabel === 'function' ? groupLabel : function (x) { return 'กลุ่มบริหารงาน' + x; };
    return {
      headName: d.headName || '', headPos: d.headPosition || (dept ? 'หัวหน้า' + gl(dept) : 'หัวหน้ากลุ่มบริหารงาน'),
      depName: d.deputyName || '', depPos: d.deputyPosition || (dept ? 'รองผู้อำนวยการ' + gl(dept) : 'รองผู้อำนวยการ'),
      dirName: st.memoDirectorName || '', dirPos: st.memoDirectorPosition || ('ผู้อำนวยการ' + (st.schoolName || 'โรงเรียน'))
    };
  }
  var DL = '.................................................';
  function opBlock(title, name, pos, full) {
    return '<div class="mm-op' + (full ? ' full' : '') + '"><div class="mm-opt">ความคิดเห็นของ' + esc(shortPos(title)) + '</div><div class="mm-dotline"></div>' + (full ? '<div class="mm-dotline"></div>' : '') +
      '<div style="margin-top:6px">ลงชื่อ' + DL + '</div><div>(' + (name ? esc(name) : DL) + ')</div><div>' + esc(pos) + '</div></div>';
  }
  // วาดกระดาษทั้งใบ
  function render(def, ctx) {
    var fmap = fmapOf(def), st = ctx.settings || {}, s = signers(ctx), me = ctx.me || {};
    var school = [st.schoolName, st.schoolDistrict, st.schoolProvince].filter(Boolean).join(' ');
    var h = '<div class="memo-head"><img src="assets/garuda-emblem.png" alt="" /><h1>บันทึกข้อความ</h1></div>';
    h += '<div class="memo-line"><b>ส่วนราชการ</b>&nbsp;&nbsp;' + (school ? esc(school) : dots(300)) + '</div>';
    h += '<div class="memo-row"><div><b>ที่</b>&nbsp;&nbsp;' + (!ctx.blank && ctx.docNo ? esc(ctx.docNo) : dots(150)) + '</div><div><b>วันที่</b>&nbsp;&nbsp;' + (!ctx.blank && ctx.docDate ? esc(thD(ctx.docDate)) : dots(200)) + '</div></div>';
    h += '<div class="memo-line memo-subj"><b>เรื่อง</b>&nbsp;&nbsp;' + fillLine(def.subject, ctx, fmap) + '</div>';
    h += '<div class="memo-line"><b>เรียน</b>&nbsp;&nbsp;' + fillLine(def.to || ('ผู้อำนวยการ{โรงเรียน}'), ctx, fmap) + '</div>';
    h += bodyHtml(def, ctx, fmap);
    var t = def.table || {}, more = '';
    if (t.type === 'students') {
      var list = ctx.blank ? [] : (ctx.students || []), per = (t.rows || 10) * 2;
      h += stuTables(list, t.rows || 10, 0);
      if (list.length > per) { // เกิน = ต่อหน้าถัดไป (หลังช่องลงชื่อ)
        var rest = list.slice(per), pages = '';
        for (var i = 0; i < rest.length; i += 50) { var part = rest.slice(i, i + 50); pages += stuTables(part, Math.ceil(part.length / 2), per + i); }
        more = '<div class="mm-cont"><div class="mm-cont-h">รายชื่อนักเรียน (ต่อ) — ' + fillLine(def.subject, ctx, fmap) + '</div>' + pages + '</div>';
      }
    } else if (t.type === 'custom') h += customTable(def, ctx);
    if (def.closing) h += '<div class="memo-line memo-indent">' + fillLine(def.closing, ctx, fmap) + '</div>';
    h += '<div class="mm-sign"><div>ลงชื่อ' + DL + (def.signAs ? esc(def.signAs) : '') + '</div><div>(' + (ctx.blank || !me.name ? DL : esc(me.name)) + ')</div>' +
      (def.signAs ? '' : '<div>ตำแหน่ง ' + (ctx.blank || !me.position ? DL : esc(me.position)) + '</div>') + '</div>';
    var ch = def.chain || {}, pair = [];
    if (ch.head) pair.push(opBlock(s.headPos, s.headName, s.headPos));
    if (ch.deputy) pair.push(opBlock(s.depPos, s.depName, s.depPos));
    if (pair.length === 2) h += '<div class="mm-ops">' + pair.join('') + '</div>';
    else if (pair.length === 1) h += '<div class="mm-ops" style="grid-template-columns:1fr">' + pair[0] + '</div>';
    if (ch.director) h += opBlock('ผู้อำนวยการโรงเรียน', s.dirName, s.dirPos, true);
    return h + more;
  }
  // ข้อความเรื่อง (ไว้ตั้งชื่อฉบับที่บันทึก)
  function subjectText(def, ctx) { var d = document.createElement('div'); d.innerHTML = fillLine(def.subject, Object.assign({}, ctx, { blank: false }), fmapOf(def)); return (d.textContent || '').replace(/\s+/g, ' ').trim(); }
  window.MT = { fields: fields, render: render, subjectText: subjectText, thD: thD, thRange: thRange, SYS: SYS, esc: esc };
})();
