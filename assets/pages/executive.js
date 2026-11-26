/* ย้ายมาจากสคริปต์ในหน้า executive.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
    var session = requireViewerAccess();
    // ผู้บริหารเท่านั้นที่ใช้หน้านี้เป็นหน้าแรก (เจ้าหน้าที่/Super Admin มีหน้าแรกของตัวเองอยู่แล้ว) — ส่งกลับหน้าแรกของบทบาทนั้น
    if (session && session.role !== 'executive') { location.href = homePageFor(session); session = null; }
    if (session) mountChrome('executive');
    if (session) document.getElementById('welcomeHeading').textContent = 'สวัสดี, ' + session.name;
    // 2.01.0: เว็บไซต์โรงเรียน + การเช็คชื่อประจำสัปดาห์ + มีคาบสอนไหม (เมนู "วิชาที่สอน")
    if (session) {
      (async function () {
        var card = document.getElementById('extLinksCard'), grid = document.getElementById('extLinksGrid');
        try { var rows = await apiCall('hubListExternalLinks', {}); if (rows.length) { card.hidden = false; grid.innerHTML = rows.map(function (l) { return extLinkButtonHtml(l); }).join(''); enhanceExtLinkImages(grid); } } catch (e) { /* ไม่มีลิงก์ = ไม่แสดง */ }
      })();
      mountExecWeekly(document.getElementById('execWeeklyCard'));
      try { var thk = 'bnkTeachHas:' + session.id, thv = JSON.parse(localStorage.getItem(thk) || 'null'); if (!thv || Date.now() - thv.at > 12 * 3600e3) apiCall('teachHas', {}).then(function (r) { try { localStorage.setItem(thk, JSON.stringify({ at: Date.now(), has: !!r.has })); } catch (e) { /* ข้าม */ } if (r.has && !(thv && thv.has)) mountChrome('executive'); }).catch(function () {}); } catch (e) { /* ข้าม */ }
    }

    var calState = { year: new Date().getFullYear(), month: new Date().getMonth(), events: [] };
    var thaiMonths = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
    var thaiDow = ['อา','จ','อ','พ','พฤ','ศ','ส'];
    var categoryColorMap = {};
    var assignments = []; // ผลของ adminGetAssignmentSummary (กำหนดการที่ผูกประเภทงาน + สถานะการส่งของแต่ละคน)
    var MAX_CALENDAR_LANES = 2;

    // 1.81: กรองชนิด + กิจกรรม "ทำซ้ำทุกปี"
    var calKind = '';
    var _calMemo = { k: null, ev: null, v: null };
    function calEvents() {
      var k = calState.year + '|' + calKind + '|' + calState.events.length;
      if (_calMemo.ev === calState.events && _calMemo.k === k) return _calMemo.v;
      var y0 = Math.min(calState.year, new Date().getFullYear()), y1 = Math.max(calState.year, new Date().getFullYear()) + 1;
      _calMemo = { k: k, ev: calState.events, v: expandRepeatEvents(calState.events, y0 + '-01-01', y1 + '-12-31').filter(function (e) { return !calKind || (calKind === 'activity') === isActivityEv(e); }) };
      return _calMemo.v;
    }
    function eventsOnDate(dateStr) { return calEvents().filter(function (e) { return dateStr >= e.date && dateStr <= (e.endDate || e.date); }); }
    // จัดเรียง "แถว" ของแถบสีกำหนดการ ให้กำหนดการเดียวกันอยู่แถวเดิมทุกวัน (หลักการเดียวกับปฏิทินในหน้าแรกของครู)
    function computeEventLanes(events, monthStart, monthEnd) {
      var relevant = events.filter(function (e) { return (e.endDate || e.date) >= monthStart && e.date <= monthEnd; })
        .slice().sort(function (a, b) { return a.date < b.date ? -1 : (a.date > b.date ? 1 : 0); });
      var laneEndDates = [], laneOf = {};
      relevant.forEach(function (e) {
        var placed = false;
        for (var i = 0; i < laneEndDates.length; i++) {
          if (laneEndDates[i] < e.date) { laneEndDates[i] = e.endDate || e.date; laneOf[e.id] = i; placed = true; break; }
        }
        if (!placed) { laneEndDates.push(e.endDate || e.date); laneOf[e.id] = laneEndDates.length - 1; }
      });
      return laneOf;
    }

    function summaryFor(e) {
      var a = assignments.filter(function (x) { return x.eventId === e.id; })[0];
      if (!a) return null;
      var ok = 0, late = 0, miss = 0;
      a.rows.forEach(function (r) { if (r.status === 'onTime') ok++; else if (r.status === 'late') late++; else miss++; });
      return { ok: ok, late: late, miss: miss, total: a.rows.length };
    }

    function renderCalendar() {
      document.getElementById('calLabel').textContent = thaiMonths[calState.month] + ' ' + (calState.year + 543);
      var grid = document.getElementById('calGrid');
      grid.innerHTML = '';
      thaiDow.forEach(function (d) { var el = document.createElement('div'); el.className = 'dow'; el.textContent = d; grid.appendChild(el); });
      var firstDay = new Date(calState.year, calState.month, 1).getDay();
      var daysInMonth = new Date(calState.year, calState.month + 1, 0).getDate();
      var todayStr = todayYmd(); // 1.58: วันที่ตามเวลาเครื่อง
      var pad2 = function (n) { return String(n).padStart(2, '0'); };
      var laneOf = computeEventLanes(calState.events, calState.year + '-' + pad2(calState.month + 1) + '-01', calState.year + '-' + pad2(calState.month + 1) + '-' + pad2(daysInMonth));
      var legendCats = {}; // 1.58: คำอธิบายสีของงานที่มีในเดือนนี้
      var hasActs = false;
      document.getElementById('calKinds').innerHTML = calKindChipsHtml(calKind);
      for (var i = 0; i < firstDay; i++) { var pad = document.createElement('div'); pad.className = 'calendar-cell empty'; grid.appendChild(pad); }
      for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = calState.year + '-' + pad2(calState.month + 1) + '-' + pad2(d);
        var cell = document.createElement('div');
        cell.className = 'calendar-cell' + (dateStr === todayStr ? ' is-today' : '');
        cell.setAttribute('data-date', dateStr); cell.setAttribute('role', 'button'); cell.tabIndex = 0; // 1.58: กดดูรายละเอียดวัน
        var evs = eventsOnDate(dateStr);
        if (evs.length > 0) { cell.className += ' has-event'; cell.title = evs.map(function (e) { return e.title; }).join(', '); }
        var colIndex = (firstDay + d - 1) % 7;
        // 1.58: แสดงงานเป็นจุดสี (แบบ A ที่ผู้ใช้เลือก) แทนแถบสีลากยาว — สูงสุด 4 จุด + "+N" · กดวันเพื่อดูรายละเอียด
        var acts = evs.filter(isActivityEv), dls = evs.filter(function (e) { return !isActivityEv(e); });
        if (acts.length) hasActs = true;
        var dotsHtml = dls.slice(0, 4).map(function (e) {
          var c = e.categoryId ? (categoryColorMap[e.categoryId] || '#3457d5') : '#9aa4b8';
          return '<i class="cal-dot" style="background:' + c + ';" title="' + escapeHtml(e.title) + '"></i>';
        }).join('') + (dls.length > 4 ? '<span class="cal-dot-more">+' + (dls.length - 4) + '</span>' : '');
        dls.forEach(function (e) { if (e.categoryId) legendCats[e.categoryId] = e.categoryName || e.title; else legendCats['__none'] = 'กำหนดการทั่วไป'; });
var cc = calCellC(d, dateStr, acts); cell.className += cc.cls; if (cc.style) cell.style.cssText = cc.style; // 1.96.2: แบบ C + วันหยุด
cell.innerHTML = cc.num + (dateStr === todayStr ? '<span class="cal-today-label">วันนี้</span>' : '') + cc.label + (dotsHtml ? '<div class="cal-dots">' + dotsHtml + '</div>' : '');
        grid.appendChild(cell);
      }
      var legend = document.getElementById('calLegend');
      var lk = Object.keys(legendCats);
      if (legend) legend.innerHTML = lk.slice(0, 8).map(function (k) {
        var c = k === '__none' ? '#9aa4b8' : (categoryColorMap[k] || '#3457d5');
        return '<span><i class="cal-dot" style="background:' + c + ';"></i>' + escapeHtml(legendCats[k]) + '</span>';
      }).join('') + (lk.length > 8 ? '<span>และอีก ' + (lk.length - 8) + ' ประเภท (กดที่วันเพื่อดู)</span>' : '') // แสดงสูงสุด 8 ประเภท
        + (hasActs ? CAL_C_LEGEND : '');
      renderUpcoming();
      var actsBox = document.getElementById('calActsUpcoming');
      actsBox.hidden = calKind === 'deadline' || (!calState.events.some(isActivityEv) && calKind !== 'activity');
      if (!actsBox.hidden) actsBox.innerHTML = activityUpcomingHtml(calEvents().filter(isActivityEv));
    }

    // รายการ "กำหนดส่งงาน" ใต้ปฏิทิน (อ่านอย่างเดียว — ไม่มีปุ่มส่งงาน) พร้อมจำนวนผู้ส่งแล้ว/ทั้งหมดของแต่ละงาน
    function renderUpcoming() {
      var box = document.getElementById('calEventsUpcoming');
      box.hidden = calKind === 'activity';
      var now = new Date();
      var list = calState.events.filter(function (e) {
        if (isActivityEv(e)) return false;
        var diffDays = (new Date(e.endDate || e.date) - now) / 86400000;
        return diffDays > -1 && diffDays < 60;
      }).sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      var headingHtml = '<div class="cal-upcoming-heading"><i class="fas fa-bell ui-icon" aria-hidden="true"></i> กำหนดส่งงาน</div>';
      if (list.length === 0) { box.innerHTML = headingHtml + '<div class="empty-state">ไม่มีกำหนดการในช่วงนี้</div>'; return; }
      box.innerHTML = headingHtml + '<div class="cal-upcoming-grid">' + list.map(function (e) {
        var dateChip = e.endDate && e.endDate !== e.date ? formatDateThai(e.date) + ' – ' + formatDateThai(e.endDate) : formatDateThai(e.date);
        var dl = daysLeftInfo(e.endDate || e.date, now); if (dl && dl.days >= 0) dateChip += '<span class="days-left ' + dl.cls + '">(' + dl.text + ')</span>'; // 1.58: เหมือนหน้าแรกครู
        var sm = summaryFor(e);
        var termLabel = e.categoryId ? termTagsHtml(e.semester, e.academicYear) : '';
        var progress = sm ? '<span class="notice-badge" style="background:var(--primary-light); color:var(--primary-dark);">ส่งแล้ว ' + (sm.ok + sm.late) + '/' + sm.total + '</span>'
          : (e.categoryId && e.noSubmission ? '<span class="notice-badge"><i class="fas fa-bullhorn ui-icon" aria-hidden="true"></i> แจ้งเตือน</span>' : '');
        return '<div class="event-list-item"><div class="event-date-chip">' + dateChip + '</div>' +
          '<div style="flex:1 1 220px; min-width:220px;"><div class="sub-item-title">' + escapeHtml(e.title) + '</div>' +
          (termLabel ? '<div class="sub-item-meta term-tags-row">' + categoryDotHtml(categoryColorMap[e.categoryId]) + termLabel + '</div>' : '') +
          (e.message ? '<div class="sub-item-desc">' + escapeHtml(e.message) + '</div>' : '') + '</div>' + progress + '</div>';
      }).join('') + '</div>';
    }

    // ---------- 1.58: ป็อปอัปรายละเอียดวัน (อ่านอย่างเดียว + จำนวนผู้ส่ง) ----------
    var THAI_DOW_FULL = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
    function openDayModal(dateStr) {
      var p = dateStr.split('-'), dt = new Date(+p[0], +p[1] - 1, +p[2]);
      document.getElementById('dayModalTitle').textContent = 'วัน' + THAI_DOW_FULL[dt.getDay()] + 'ที่ ' + dt.getDate() + ' ' + thaiMonths[dt.getMonth()] + ' ' + (dt.getFullYear() + 543) + (dateStr === todayYmd() ? ' (วันนี้)' : '');
      var evs = eventsOnDate(dateStr).sort(function (a, b) { return String(a.endDate || a.date).localeCompare(String(b.endDate || b.date)); });
      document.getElementById('dayModalSub').textContent = evs.length ? 'งานในวันนี้ ' + evs.length + ' รายการ' : '';
      evs = evs.filter(isActivityEv).concat(evs.filter(function (e) { return !isActivityEv(e); }));
      document.getElementById('dayModalBody').innerHTML = evs.length ? evs.map(function (e) {
        if (isActivityEv(e)) return activityDayHtml(e);
        var color = e.categoryId ? (categoryColorMap[e.categoryId] || '#3457d5') : '#9aa4b8';
        var range = e.endDate && e.endDate !== e.date ? formatDateThai(e.date) + ' – ' + formatDateThai(e.endDate) : formatDateThai(e.date);
        var dl = daysLeftInfo(e.endDate || e.date), sm = summaryFor(e);
        var isEnd = (e.endDate || e.date) === dateStr;
        return '<div class="day-ev"><span class="day-ev-bar" style="background:' + color + '"></span><div class="day-ev-main">' +
          '<div class="day-ev-title">' + escapeHtml(e.title) + (isEnd && e.categoryId && !e.noSubmission ? ' <span class="day-ev-end"><i class="fas fa-flag" aria-hidden="true"></i> ครบกำหนดวันนี้</span>' : '') + '</div>' +
          '<div class="day-ev-meta"><i class="fas fa-calendar-days" aria-hidden="true"></i> ' + escapeHtml(range) + (dl && dl.days >= 0 ? ' <span class="days-left ' + dl.cls + '">(' + escapeHtml(dl.text) + ')</span>' : '') + '</div>' +
          (e.categoryId ? '<div class="term-tags-row">' + termTagsHtml(e.semester, e.academicYear) + '</div>' : '') +
          (e.message ? '<div class="sub-item-desc">' + escapeHtml(e.message) + '</div>' : '') + '</div>' +
          (sm ? '<span class="notice-badge" style="background:var(--primary-light); color:var(--primary-dark);">ส่งแล้ว ' + (sm.ok + sm.late) + '/' + sm.total + '</span>' : '') + '</div>';
      }).join('') : '<div class="empty-state">ไม่มีงานหรือกำหนดการในวันนี้</div>';
      showModalEl(document.getElementById('dayModal'));
    }
    (function () {
      var grid = document.getElementById('calGrid');
      grid.addEventListener('click', function (ev) { var c = ev.target.closest('.calendar-cell[data-date]'); if (c) openDayModal(c.getAttribute('data-date')); });
      grid.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { var c = ev.target.closest('.calendar-cell[data-date]'); if (c) { ev.preventDefault(); openDayModal(c.getAttribute('data-date')); } } });
      var close = function () { hideModalEl(document.getElementById('dayModal')); };
      document.getElementById('dayModalCloseX').addEventListener('click', close);
      document.getElementById('dayModalCloseBtn').addEventListener('click', close);
    })();

    // สรุปการส่งงานแบบย่อ (คอลัมน์ขวา) + แผ่นตัวเลขด้านบน
    function renderSummary(allSubs, people) {
      var today = new Date().toISOString().slice(0, 10);
      var open = assignments.filter(function (a) { return (a.endDate || a.date) >= today; });
      var openTotals = { done: 0, total: 0 };
      open.forEach(function (a) { a.rows.forEach(function (r) { openTotals.total++; if (r.status !== 'missing') openTotals.done++; }); });
      document.getElementById('exStatPeople').textContent = people;
      document.getElementById('exStatOpen').textContent = open.length;
      document.getElementById('exStatSubs').textContent = allSubs;
      document.getElementById('exStatRate').textContent = openTotals.total ? Math.round(openTotals.done * 100 / openTotals.total) + '%' : '-';
      var body = document.getElementById('execSummaryBody');
      // งานที่เปิดอยู่ + งานที่เพิ่งครบกำหนดใน 30 วันล่าสุด (ใหม่สุดก่อน) สูงสุด 8 รายการ
      var cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      var items = assignments.filter(function (a) { return (a.endDate || a.date) >= cutoff; })
        .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).slice(0, 8);
      if (items.length === 0) { body.innerHTML = '<div class="empty-state" style="padding:16px 6px;">ยังไม่มีงานที่กำลังเปิดรับ</div>'; return; }
      body.innerHTML = items.map(function (a) {
        var ok = 0, late = 0, miss = 0;
        a.rows.forEach(function (r) { if (r.status === 'onTime') ok++; else if (r.status === 'late') late++; else miss++; });
        var t = a.rows.length || 1;
        return '<div class="exec-sum-item"><div class="exec-sum-title">' + categoryDotHtml(categoryColorMap[a.categoryId]) + escapeHtml(a.title) + categoryDeptBadgeHtml(a.categoryId) + '</div>' +
          '<div class="exec-sum-meta">ครบกำหนด ' + formatDateThai(a.endDate || a.date) + '</div>' +
          '<div class="exec-bar"><span class="ok" style="width:' + (ok * 100 / t) + '%"></span><span class="late" style="width:' + (late * 100 / t) + '%"></span></div>' +
          '<div class="exec-sum-nums"><span class="ok">ตรงเวลา ' + ok + '</span><span class="late">ช้า ' + late + '</span><span class="miss">ยังไม่ส่ง ' + miss + '</span></div></div>';
      }).join('');
    }

    async function loadAll() {
      var results = await Promise.all([
        apiCall('adminListEvents', {}).catch(function () { return []; }),
        apiCall('adminGetAssignmentSummary', {}).catch(function () { return []; }),
        apiCall('adminListAllSubmissions', { countOnly: true }).catch(function () { return { total: 0 }; }), // 1.63: นับอย่างเดียว ไม่โหลดรายการ
        apiCall('adminListUsers', {}).catch(function () { return []; }),
        apiCall('calendarListWorkCategories', {}).catch(function () { return []; })
      ]);
      calState.events = results[0]; setActPool(calState.events); // 1.96.4
      assignments = results[1];
      categoryColorMap = buildCategoryColorMap(results[4]);
      var people = results[3].filter(function (u) { return u.status === 'active' && (u.role === 'teacher' || u.hasHub); }).length;
      renderCalendar(); renderSupUpcoming('supUpCard', calState.events); // 1.98.2
      renderSummary(Number(results[2] && results[2].total) || 0, people);
    }

    document.getElementById('calKinds').addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-cal-kind]'); if (!b) return;
      calKind = b.getAttribute('data-cal-kind') || '';
      renderCalendar();
    });
    document.getElementById('calPrev').addEventListener('click', function () {
      calState.month--; if (calState.month < 0) { calState.month = 11; calState.year--; }
      renderCalendar();
    });
    document.getElementById('calNext').addEventListener('click', function () {
      calState.month++; if (calState.month > 11) { calState.month = 0; calState.year++; }
      renderCalendar();
    });
    currentTermLabel().then(function (label) { document.getElementById('currentTermBadge').textContent = label; });
    if (session) loadAll();

    window.__refreshPageData = function () {
      resetSettingsCache();
      currentTermLabel().then(function (label) { document.getElementById('currentTermBadge').textContent = label; });
      return Promise.all([applyBranding(), loadAll()]);
    };
  
