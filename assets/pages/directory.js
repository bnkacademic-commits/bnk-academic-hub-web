/* ย้ายมาจากสคริปต์ในหน้า directory.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
    var SUBJECT_GROUP_ORDER = ['ภาษาไทย', 'คณิตศาสตร์', 'วิทยาศาสตร์และเทคโนโลยี', 'สังคมศึกษา ศาสนา และวัฒนธรรม', 'สุขศึกษาและพลศึกษา', 'ศิลปะ', 'การงานอาชีพ', 'ภาษาต่างประเทศ'];
    var POSITION_RANK = ['ครูเชี่ยวชาญพิเศษ', 'ครูเชี่ยวชาญ', 'ครูชำนาญการพิเศษ', 'ครูชำนาญการ', 'ครู', 'ครูผู้ช่วย'];
    var EXEC_RANK = ['ผู้อำนวยการ', 'รองผู้อำนวยการ'];

    var session = getSession();
    if (session && getToken()) mountChrome('directory'); else { mountFooter(); applyBranding(); }
    if (!session) {
      document.getElementById('app-topbar').innerHTML =
        '<div class="topbar"><button class="brand js-home-btn" type="button"><span class="js-brand-logo"><span class="logo-dot"></span></span> <span class="js-site-name">BNKAcademicHub</span></button>' +
        '<div class="topbar-right"><a href="index.html" class="btn btn-ghost btn-sm">เข้าสู่ระบบ</a></div></div>';
      var hb = document.querySelector('.js-home-btn'); if (hb) hb.addEventListener('click', function () { location.href = 'index.html'; });
    }

    function rankIndex(list, v) { var i = list.indexOf(v); return i < 0 ? 999 : i; }
    function hasHead(p, k) { return (p.headRoles || []).indexOf(k) >= 0; }
    function cmpPerson(a, b) {
      // หัวหน้าของกลุ่มที่จัดอยู่ (กลุ่มสาระฯ หรือกลุ่มบริหารงาน) ก่อน -> ตำแหน่งสูงไปต่ำ -> ชื่อ
      var key = groupBy === 'dept' ? 'dept' : 'subject';
      var h = (hasHead(b, key) ? 1 : 0) - (hasHead(a, key) ? 1 : 0);
      if (h) return h;
      var r = rankIndex(POSITION_RANK, a.position) - rankIndex(POSITION_RANK, b.position);
      if (r) return r;
      return String(a.name).localeCompare(String(b.name), 'th');
    }
    // ชื่อกลุ่มบริหารงานแบบ "คีย์" ไว้เทียบกัน (1.44.111026): ตัดคำนำหน้า "กลุ่มบริหารงาน"/"ฝ่าย" และช่องว่างออก
    // กันกรณีข้อมูลเก่าเก็บชื่อกลุ่มคนละรูปแบบ (เช่น "ฝ่ายวิชาการ" กับ "วิชาการ") แล้วถูกจัดเป็น "ยังไม่สังกัด" ทั้งที่สังกัดอยู่
    function dkey(n) { return String(n || '').replace(/\s+/g, '').replace(/^กลุ่มบริหารงาน/, '').replace(/^ฝ่าย/, ''); }
    function sameDept(a, b) { return !!a && !!b && dkey(a) === dkey(b); }
    function inDeptList(d) { return deptList.some(function (x) { return sameDept(x, d); }); }
    // ป้ายใต้ชื่อ (1.44.111026 จัดลำดับใหม่ตามที่ผู้ใช้ขอ: รูป → ชื่อ → ตำแหน่ง → สังกัด)
    //  - จัดกลุ่มตามกลุ่มสาระฯ: บรรทัด "สังกัด" = กลุ่มบริหารงานที่สังกัด (หรือ "หัวหน้ากลุ่มบริหารงาน…" ถ้าเป็นหัวหน้า / "ไม่ระบุกลุ่มบริหารงาน" ถ้ายังไม่สังกัด)
    //  - จัดกลุ่มตามกลุ่มบริหารงาน: กลุ่มเป็นหัวข้ออยู่แล้ว บรรทัดใต้ตำแหน่งจึงบอกกลุ่มสาระฯ แทน
    // ทำเนียบไม่บอกว่าใครเป็นเจ้าหน้าที่/แอดมิน (ตั้งแต่ 1.41.111026) — ผู้บริหารไม่สังกัดกลุ่ม จึงไม่มีบรรทัดนี้
    // คืนค่า [{text, muted}]
    function subTags(p, short) {
      var sub = [];
      if (p.kind === 'executive') return sub;
      if (groupBy === 'dept') {
        if (hasHead(p, 'dept') && p.department) sub.push({ text: short ? 'หัวหน้ากลุ่มบริหารงาน' : 'หัวหน้า' + groupLabel(p.department) });
        if (hasHead(p, 'subject')) sub.push({ text: (short ? 'หัวหน้ากลุ่มสาระฯ' : 'หัวหน้ากลุ่มสาระการเรียนรู้') + (p.subjectGroup || '') }); // 1.92.5: บอกชื่อกลุ่มสาระฯ
        else if (p.subjectGroup) sub.push({ text: (short ? 'สาระฯ' : 'กลุ่มสาระการเรียนรู้') + p.subjectGroup });
      } else {
        if (p.department) sub.push({ text: (hasHead(p, 'dept') ? 'หัวหน้า' : '') + groupLabel(p.department), dept: p.department }); // 1.56: dept = ใช้สีของกลุ่ม
        else sub.push({ text: 'ไม่ระบุกลุ่มบริหารงาน', muted: true });
        if (hasHead(p, 'subject')) sub.push({ text: short ? 'หัวหน้ากลุ่มสาระฯ' : 'หัวหน้ากลุ่มสาระการเรียนรู้' + (p.subjectGroup || '') });
      }
      return sub;
    }
    function linkAttrs(p) {
      return ' href="view.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener" title="เปิดหน้าแสดงผลงานของ ' + escapeHtml(p.name) + '"';
    }
    function cardHtml(p, isExec, isTop) {
      var sub = subTags(p);
      var inner = '<div class="dir-avatar">' + avatarInnerHtml(p.avatarUrl) + '</div>' +
        '<div class="dir-name">' + escapeHtml(p.name) + '</div>' +
        '<div class="dir-pos">' + escapeHtml(p.position || (isExec ? 'ผู้บริหาร' : '')) + '</div>' +
        sub.map(function (t) { return '<div class="dir-sub' + (t.muted ? ' muted' : '') + '"' + (t.dept ? deptColorAttr(t.dept) : '') + '>' + escapeHtml(t.text) + '</div>'; }).join('') +
        (isTop ? '<span class="drx-rk">ผู้อำนวยการ</span>' : '');
      var cls = 'dir-card' + (isExec ? ' dir-exec' : '') + (isTop ? ' drx-top' : '');
      // คลิกที่ใดก็ได้ในกรอบการ์ด -> เปิดหน้าแสดงผลงานของคนนั้นในแท็บใหม่ (ผู้บริหารไม่มีหน้าผลงาน จึงไม่เป็นลิงก์)
      if (p.hasPage) {
        return '<a class="' + cls + ' dir-link" data-kind="' + p.kind + '"' + linkAttrs(p) + '>' + inner + '</a>';
      }
      return '<div class="' + cls + '" data-kind="' + p.kind + '">' + inner + '</div>';
    }
    function sectionHtml(title, people, isExec, key) {
      if (!people.length) return '';
      return '<section class="dir-section" data-group="' + escapeHtml(key) + '"' + deptColorAttr(key) + '><h2 class="dir-section-title"><span class="bx-band">' + escapeHtml(title) + '</span><span class="bx-ln"></span>' +
        '<span class="dir-count">' + people.length + ' คน</span></h2><div class="dir-grid">' +
        people.map(function (p) { return cardHtml(p, isExec); }).join('') + '</div></section>';
    }
    // ---- มุมมองผังองค์กร ----
    function nodeHtml(p, extra) {
      var isExec = p.kind === 'executive';
      var cls = 'tn' + (extra ? ' ' + extra : '') + (hasHead(p, groupBy === 'dept' ? 'dept' : 'subject') ? ' head' : '') + (p.hasPage ? ' tn-link' : '');
      var inner = '<div class="tav">' + avatarInnerHtml(p.avatarUrl) + '</div>' +
        '<div class="tname">' + escapeHtml(p.name) + '</div>' +
        '<div class="tpos">' + escapeHtml(p.position || (isExec ? 'ผู้บริหาร' : '')) + '</div>' +
        subTags(p, true).map(function (t) { return '<div class="tsub' + (t.muted ? ' muted' : '') + '"' + (t.dept ? deptColorAttr(t.dept) : '') + '>' + escapeHtml(t.text) + '</div>'; }).join('');
      if (p.hasPage) return '<a class="' + cls + '" data-kind="' + p.kind + '"' + linkAttrs(p) + '>' + inner + '</a>';
      return '<div class="' + cls + '" data-kind="' + p.kind + '">' + inner + '</div>';
    }
    function columnHtml(title, list, key) {
      // คอลัมน์ของ 8 กลุ่มสาระฯ แสดงเสมอแม้ยังไม่มีรายชื่อ (เห็นโครงร่างของผัง) — มีเฉพาะ "ครูและบุคลากรอื่นๆ" ที่โผล่เมื่อมีคนเท่านั้น
      if (!list.length && key === 'other') return '';
      var body = list.length
        ? list.map(function (p) { return '<div class="vitem">' + nodeHtml(p, '') + '</div>'; }).join('')
        : '<div class="vitem"><div class="tn-empty">ยังไม่มีรายชื่อ</div></div>';
      return '<li data-group="' + escapeHtml(key) + '"' + deptColorAttr(key) + (list.length ? '' : ' data-empty="1"') + '><div class="gtitle">' + escapeHtml(title) + '</div><div class="vlist">' + body + '</div></li>';
    }
    function splitPeople(people) {
      var execs = people.filter(function (p) { return p.kind === 'executive'; })
        .sort(function (a, b) { return rankIndex(EXEC_RANK, a.position) - rankIndex(EXEC_RANK, b.position) || String(a.name).localeCompare(String(b.name), 'th'); });
      // 2.02.0: นักศึกษาฝึกสอน = กลุ่มแยกท้ายสุด
      return { execs: execs, rest: people.filter(function (p) { return p.kind !== 'executive' && p.kind !== 'intern'; }), interns: people.filter(function (p) { return p.kind === 'intern'; }).sort(cmpPerson) };
    }
    // รายการกลุ่ม (คอลัมน์/หัวข้อ) ตามที่เลือกจัดกลุ่ม: กลุ่มสาระฯ = 8 กลุ่มตายตัว · กลุ่มบริหารงาน = ตามรายการที่ตั้งไว้ในระบบ + "ยังไม่สังกัด" ท้ายสุด
    function buildGroups(rest) {
      var groups = [];
      if (groupBy === 'dept') {
        deptList.forEach(function (d) {
          groups.push({ key: d, title: groupLabel(d), list: rest.filter(function (p) { return sameDept(p.department, d); }).sort(cmpPerson) });
        });
        groups.push({ key: 'other', title: 'ไม่ระบุกลุ่มบริหารงาน', list: rest.filter(function (p) { return !p.department || !inDeptList(p.department); }).sort(cmpPerson) });
      } else {
        SUBJECT_GROUP_ORDER.forEach(function (g) {
          groups.push({ key: g, title: 'กลุ่มสาระการเรียนรู้' + g, list: rest.filter(function (p) { return p.subjectGroup === g; }).sort(cmpPerson) });
        });
        groups.push({ key: 'other', title: 'ครูและบุคลากรอื่นๆ', list: rest.filter(function (p) { return SUBJECT_GROUP_ORDER.indexOf(p.subjectGroup) < 0; }).sort(cmpPerson) });
      }
      return groups;
    }
    function visibleGroups(rest) {
      var gs = buildGroups(rest);
      return filterVal ? gs.filter(function (g) { return g.key === filterVal; }) : gs;
    }
    function treeHtml(people) {
      var sp = splitPeople(people), execs = sp.execs, rest = sp.rest;
      var cols = '';
      visibleGroups(rest).forEach(function (g) { cols += columnHtml(g.title, g.list, g.key); });
      if (sp.interns.length && !filterVal) cols += columnHtml('นักศึกษาฝึกสอน', sp.interns, 'intern');
      var h = '<div class="tree-hint" id="treeHint"><i class="fa-solid fa-arrows-left-right"></i> กดค้างที่พื้นที่ว่างแล้วลาก หรือเลื่อนซ้าย-ขวาเพื่อดูกลุ่มอื่นๆ</div><div class="tree-wrap"><div class="tree" id="dirTree">';
      if (execs.length) {
        h += '<ul><li>' + nodeHtml(execs[0], 'ex1');
        if (execs.length > 1) h += '<ul>' + execs.slice(1).map(function (e) { return '<li>' + nodeHtml(e, 'ex2') + '</li>'; }).join('') + '</ul>';
        h += '</li></ul>';
      }
      // คณะผู้บริหารแสดงเมื่อมีบัญชีผู้บริหารเท่านั้น — ถ้ายังไม่มีเลย ผังเริ่มที่เส้นของกลุ่ม
      h += '<div class="bus' + (execs.length ? '' : ' noroot') + '"><ul>' + cols + '</ul></div>';
      return h + '</div></div>';
    }
    function cardsHtml(people) {
      var sp = splitPeople(people), rest = sp.rest;
      var html = filterVal ? '' : execHtml(sp.execs);
      visibleGroups(rest).forEach(function (g) { html += sectionHtml(g.title, g.list, false, g.key); });
      if (sp.interns.length && !filterVal) html += sectionHtml('นักศึกษาฝึกสอน', sp.interns, false, 'intern');
      return html;
    }
    // 2.32.0: คณะผู้บริหาร — ผู้อำนวยการการ์ดใหญ่ตรงกลาง รองฯ ขนาบสองข้าง (มือถือ: ผอ. บนสุด รองฯ แถวละ 2)
    function execHtml(execs) {
      if (!execs.length) return '';
      var top = rankIndex(EXEC_RANK, execs[0].position) === 0 ? execs[0] : null, rest = top ? execs.slice(1) : execs.slice(), half = Math.ceil(rest.length / 2);
      var row = top ? rest.slice(0, half).concat([top]).concat(rest.slice(half)) : rest;
      return '<section class="dir-section drx-exec" data-group="executive"><h2 class="sr-only">คณะผู้บริหาร</h2><div class="drx-row">' + row.map(function (p) { return cardHtml(p, true, p === top); }).join('') + '</div></section>';
    }
    // ---- เลือกมุมมอง: ค่าเริ่มต้นตามความกว้างจอ (>=768px = ผังองค์กร, มือถือ = การ์ด) ผู้ใช้กดสลับเองได้และจำไว้ในเครื่องนั้น ----
    var VIEW_KEY = 'bnkah_dir_view';
    var wideMq = window.matchMedia ? window.matchMedia('(min-width: 768px)') : null;
    var allPeople = null;
    var deptList = [];
    var GROUP_KEY = 'bnkah_dir_group';
    var groupBy = 'subject', filterVal = '';
    try { var gv = localStorage.getItem(GROUP_KEY); if (gv === 'dept' || gv === 'subject') groupBy = gv; } catch (e) {}
    function storedView() { try { var v = localStorage.getItem(VIEW_KEY); return (v === 'tree' || v === 'cards') ? v : null; } catch (e) { return null; } }
    function currentView() { return storedView() || ((wideMq && wideMq.matches) ? 'tree' : 'cards'); }
    // ตัวกรอง: เลือกดูทีละกลุ่ม (รายการเปลี่ยนตามวิธีจัดกลุ่ม)
    function syncGroupControls() {
      Array.prototype.forEach.call(document.querySelectorAll('.dir-groupby button'), function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-group') === groupBy ? 'true' : 'false');
      });
      var sel = document.getElementById('dirFilter');
      var opts = [{ key: '', title: groupBy === 'dept' ? 'ทุกกลุ่มบริหารงาน' : 'ทุกกลุ่มสาระการเรียนรู้' }];
      buildGroups([]).forEach(function (g) { opts.push({ key: g.key, title: g.title }); });
      if (!opts.some(function (o) { return o.key === filterVal; })) filterVal = '';
      sel.innerHTML = opts.map(function (o) { return '<option value="' + escapeHtml(o.key) + '"' + (o.key === filterVal ? ' selected' : '') + '>' + escapeHtml(o.title) + '</option>'; }).join('');
      sel.setAttribute('aria-label', groupBy === 'dept' ? 'กรองตามกลุ่มบริหารงาน' : 'กรองตามกลุ่มสาระการเรียนรู้');
    }
    function render(people) {
      if (people) allPeople = people;
      syncGroupControls();
      var root = document.getElementById('dirRoot');
      var view = currentView();
      Array.prototype.forEach.call(document.querySelectorAll('.dir-toggle:not(.dir-groupby) button'), function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-view') === view ? 'true' : 'false');
      });
      root.setAttribute('data-view', view);
      var html = view === 'tree' ? treeHtml(allPeople || []) : cardsHtml(allPeople || []);
      root.innerHTML = html || '<div class="dir-notice">ยังไม่มีข้อมูลบุคลากร</div>';
      fitTreeNames();
      updateTreeHint();
      centerTreeOnRoot();
    }
    // ชื่อยาวเกินกรอบ -> ลดขนาดตัวอักษรทีละ 0.5px จนพอดีบรรทัดเดียว (ขั้นต่ำ 10px; ต่ำกว่านั้นอ่านยาก จึงปล่อยให้ตัดท้ายด้วย …)
    var NAME_MIN_PX = 10;
    function fitTreeNames() {
      Array.prototype.forEach.call(document.querySelectorAll('#dirTree .tname'), function (el) {
        el.style.fontSize = '';
        var size = parseFloat(getComputedStyle(el).fontSize) || 13;
        while (el.scrollWidth > el.clientWidth + 0.5 && size > NAME_MIN_PX) {
          size -= 0.5;
          el.style.fontSize = size + 'px';
        }
      });
    }
    // ฟอนต์ Sarabun โหลดเสร็จทีหลังแล้วความกว้างตัวอักษรเปลี่ยน -> วัดใหม่อีกรอบ
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fitTreeNames(); updateTreeHint(); });
    // ผังกว้างเกินจอ: เลื่อนให้ ผอ. (บนสุด) อยู่กลางจอตั้งแต่แรก ไม่ต้องไปไล่หาทางขวา
    function centerTreeOnRoot() {
      var w = document.querySelector('.tree-wrap'), r = document.querySelector('#dirTree > ul .tn');
      if (!w || !r || w.scrollWidth <= w.clientWidth) return;
      var wr = w.getBoundingClientRect(), rr = r.getBoundingClientRect();
      w.scrollLeft = Math.max(0, w.scrollLeft + (rr.left + rr.width / 2) - (wr.left + wr.width / 2));
    }
    function updateTreeHint() {
      var w = document.querySelector('.tree-wrap'), h = document.getElementById('treeHint');
      if (w && h) h.classList.toggle('show', w.scrollWidth > w.clientWidth + 2);
    }
    window.addEventListener('resize', updateTreeHint);
    Array.prototype.forEach.call(document.querySelectorAll('.dir-groupby button'), function (b) {
      b.addEventListener('click', function () {
        groupBy = b.getAttribute('data-group') === 'dept' ? 'dept' : 'subject';
        filterVal = '';
        try { localStorage.setItem(GROUP_KEY, groupBy); } catch (e) {}
        if (allPeople) render();
      });
    });
    document.getElementById('dirFilter').addEventListener('change', function () { filterVal = this.value; if (allPeople) render(); });
    Array.prototype.forEach.call(document.querySelectorAll('.dir-toggle:not(.dir-groupby) button'), function (b) {
      b.addEventListener('click', function () {
        try { localStorage.setItem(VIEW_KEY, b.getAttribute('data-view')); } catch (e) {}
        if (allPeople) render();
      });
    });
    if (wideMq) {
      var onMq = function () { if (allPeople) render(); };
      if (wideMq.addEventListener) wideMq.addEventListener('change', onMq); else if (wideMq.addListener) wideMq.addListener(onMq);
    }
    async function load() {
      var root = document.getElementById('dirRoot');
      try {
        var res = (session && getToken()) ? await apiCall('hubListDirectory', {}) : await apiCall('publicGetDirectory', {});
        deptList = res.departments || [];
        // Worker รุ่นเก่า (ก่อน 1.41) ไม่ส่งรายชื่อกลุ่มมา — สร้างจากกลุ่มของบุคลากรแทน ไม่ให้ทุกคนตกไปอยู่ "ไม่ระบุกลุ่ม"
        if (!deptList.length) (res.people || []).forEach(function (p) { if (p.department && !inDeptList(p.department)) deptList.push(p.department); });
        try { var stD = await getSiteSettings(); if (stD && Array.isArray(stD.teacherPositions) && stD.teacherPositions.length) POSITION_RANK = stD.teacherPositions.slice().reverse(); } catch (e) { /* ไม่มีค่าตั้งค่า = ป้ายกลุ่มใช้สีหลัก */ } // 1.56: สีของแต่ละกลุ่มบริหารงาน · 1.94: ลำดับตำแหน่งจากตั้งค่า (สูงสุดก่อน)
        render(res.people || []);
        try { // 2.32.0: บรรทัดใต้หัว = โรงเรียน · ปีการศึกษา · จำนวนบุคลากร
          var st0 = await getSiteSettings(), tm0 = await currentAcademicTerm().catch(function () { return null; }), n0 = (res.people || []).filter(function (p) { return p.kind !== 'intern'; }).length;
          document.getElementById('dirSub').textContent = [(st0 && st0.schoolName) || '', tm0 && tm0.year ? 'ปีการศึกษา ' + tm0.year : '', n0 ? 'บุคลากร ' + n0 + ' คน' : ''].filter(Boolean).join(' · ');
        } catch (e) { /* คงข้อความเดิม */ }
      } catch (err) {
        var msg = (err && err.message) || 'โหลดไม่สำเร็จ';
        if (!session) msg = 'ทำเนียบบุคลากรเปิดให้เฉพาะผู้ที่เข้าสู่ระบบ — กรุณาเข้าสู่ระบบก่อน';
        root.innerHTML = '<div class="dir-notice">' + escapeHtml(msg) + '</div>';
      }
    }
    window.__refreshPageData = load;
    load();
    // 2.01.0: ผังองค์กร — กดค้างที่พื้นที่ว่างแล้วลากเลื่อน (ซ้าย-ขวา ในกรอบ · ขึ้น-ลง ทั้งหน้า) · กดที่ชื่อยังเปิดรายละเอียดตามเดิม
    (function () {
      var drag = null;
      document.addEventListener('pointerdown', function (e) {
        var w = e.target.closest && e.target.closest('.tree-wrap'); if (!w || e.button > 0) return;
        if (e.target.closest('.tn, button, a, input, select')) return;
        if (e.pointerType === 'touch') return; // นิ้ว: เลื่อนแบบปกติของเครื่องอยู่แล้ว
        drag = { w: w, x: e.clientX, y: e.clientY, sl: w.scrollLeft, sy: window.scrollY, moved: false };
      });
      document.addEventListener('pointermove', function (e) {
        if (!drag) return; var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        drag.moved = true; drag.w.classList.add('dragging');
        drag.w.scrollLeft = drag.sl - dx; window.scrollTo(window.scrollX, drag.sy - dy); e.preventDefault();
      });
      function end() { if (drag) { drag.w.classList.remove('dragging'); drag = null; } }
      document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
    })();
  
