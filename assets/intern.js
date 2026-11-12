/* นักศึกษาฝึกสอน (2.02.0)
 * - mountMentorInterns(el): แท็บ "นักศึกษาฝึกสอน" ในหน้าวิชาที่สอน (ครูพี่เลี้ยง) — คาบสอนที่ให้ช่วย · ชุมนุมร่วม · สิทธิ์ · มอบหมาย/ตรวจงาน
 * - mountInternHome(el): หน้าแรกของนักศึกษา (intern.html) — ครูพี่เลี้ยง · ตารางสอนของฉัน · งานจากครูพี่เลี้ยง (ส่งไฟล์)
 * Worker: handlers/intern.js */
(function () {
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var DN = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  var TIMES = { '1': '08.30', '2': '09.20', '3': '10.20', '4': '11.10', '5': '13.00', '6': '13.50', '7': '14.40', '8': '15.30' };
  function thD(ds) { var p = String(ds || '').split('-'); if (p.length < 3) return ''; return Number(p[2]) + ' ' + MS[Number(p[1]) - 1] + ' ' + (Number(p[0]) + 543); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function dleft(ds) { if (!ds) return null; var a = String(ds).split('-'), b = today().split('-'); return Math.round((new Date(+a[0], +a[1] - 1, +a[2]) - new Date(+b[0], +b[1] - 1, +b[2])) / 864e5); }
  var ST = { todo: ['ยังไม่ส่ง', 'it-st-todo', 'fa-hourglass-start'], review: ['รอตรวจ', 'it-st-review', 'fa-hourglass-half'], pass: ['ผ่าน', 'it-st-pass', 'fa-check'], fix: ['ให้แก้ไข', 'it-st-fix', 'fa-pen'] };
  function stChip(s) { var x = ST[s] || ST.todo; return '<span class="it-st ' + x[1] + '"><i class="fa-solid ' + x[2] + '" aria-hidden="true"></i> ' + x[0] + '</span>'; }
  function dueText(t) {
    if (!t.due) return '';
    var d = dleft(t.due), cls = t.status === 'todo' || t.status === 'fix' ? (d < 0 ? 'it-late' : d <= 2 ? 'it-soon' : '') : '';
    return '<span class="' + cls + '">กำหนดส่ง ' + thD(t.due) + (cls ? (d < 0 ? ' (เลยกำหนด ' + (-d) + ' วัน)' : d === 0 ? ' (วันนี้)' : ' (เหลือ ' + d + ' วัน)') : '') + '</span>';
  }
  function fileIcon(n) { return /\.pdf$/i.test(n) ? 'fa-file-pdf' : /\.(png|jpe?g|gif|webp|heic)$/i.test(n) ? 'fa-file-image' : /\.(docx?|odt)$/i.test(n) ? 'fa-file-word' : /\.(pptx?)$/i.test(n) ? 'fa-file-powerpoint' : /\.(xlsx?|csv)$/i.test(n) ? 'fa-file-excel' : 'fa-file'; }
  function filesHtml(files) { return (files || []).map(function (f) { return '<a class="it-file" href="' + esc(f.url) + '" target="_blank" rel="noopener"><i class="fa-solid ' + fileIcon(f.name) + '" aria-hidden="true"></i> ' + esc(f.name) + '</a>'; }).join(''); }

  // ---------- ป็อปอัปกลาง (ของไฟล์นี้) ----------
  var MD = null;
  function modal(title, html, actions, onClick) {
    if (!MD) {
      MD = document.createElement('div'); MD.className = 'modal-backdrop'; MD.hidden = true; MD.id = 'itModal';
      MD.innerHTML = '<div class="modal-box modal-box-wide it-modal"><button type="button" class="modal-close-x" data-it-close aria-label="ปิด">✕</button><h3 id="itMT"></h3><div id="itMB" style="text-align:left"></div><div class="modal-actions" id="itMA"></div></div>';
      document.body.appendChild(MD);
      MD.addEventListener('click', function (e) { if (e.target === MD || e.target.closest('[data-it-close]')) closeModal(); else if (MD._on) MD._on(e); });
    }
    document.getElementById('itMT').innerHTML = title; document.getElementById('itMB').innerHTML = html;
    document.getElementById('itMA').innerHTML = (actions || '');
    MD._on = onClick || null; showModalEl(MD);
  }
  function closeModal() { if (MD) hideModalEl(MD); }

  // =====================================================================
  // ครูพี่เลี้ยง
  // =====================================================================
  window.mountMentorInterns = function (el, onChange) {
    var D = null, sel = '', saving = 0;
    function cur() { return D && D.interns.filter(function (x) { return x.id === sel; })[0]; }
    async function load(keepSel) {
      if (!D) el.innerHTML = '<div class="loading">กำลังโหลด</div>';
      try { D = await apiCall('internMine', { full: 1 }); } catch (e) { el.innerHTML = '<div class="error-box">' + esc(e.message) + '</div>'; return; }
      if (!D.interns.length) { el.innerHTML = '<div class="card cb-empty"><i class="fa-solid fa-user-graduate"></i><p>ยังไม่มีนักศึกษาฝึกสอนในความดูแล</p></div>'; return; }
      if (!keepSel || !cur()) sel = D.interns[0].id;
      render();
    }
    function render() {
      var I = cur(); if (!I) return;
      var pending = function (x) { return (x.tasks || []).filter(function (t) { return t.status === 'review'; }).length; };
      var list = '<div class="it-list">' + D.interns.map(function (x) {
        var n = pending(x);
        return '<button type="button" class="it-pick' + (x.id === sel ? ' on' : '') + '" data-it-pick="' + esc(x.id) + '"><span class="it-av">' + (x.avatarUrl ? '<img src="' + esc(x.avatarUrl) + '" alt="">' : esc((x.name.replace(/^(นาย|นางสาว|นาง|Mr\.|Ms\.|Mrs\.)\s*/, '') || '?').slice(0, 1))) + '</span>' +
          '<span class="it-pt"><b>' + esc(x.name) + '</b><small>ช่วยสอน ' + x.subs.length + ' ห้อง' + (x.until ? ' · ถึง ' + thD(x.until) : '') + '</small>' + (n ? '<span class="it-st it-st-review">รอตรวจ ' + n + '</span>' : '') + (x.expired ? '<span class="it-st it-st-todo">ครบกำหนดแล้ว</span>' : '') + '</span></button>';
      }).join('') + '<div class="hint it-note"><i class="fa-solid fa-circle-info"></i> เพิ่ม/ลบนักศึกษาทำโดยผู้ดูแลระบบ · ครูพี่เลี้ยงตั้งค่าได้ทั้งหมดทางขวา</div></div>';
      var subsH = D.subjectsError ? '<div class="error-box">' + esc(D.subjectsError) + '</div>' : !D.linked ? '<div class="hint">ยังไม่ได้เชื่อมเว็บเช็คชื่อ — เลือกคาบสอนไม่ได้</div>' : !D.subjects.length ? '<div class="hint">ไม่พบวิชาที่คุณสอนในภาคเรียนนี้</div>' :
        D.subjects.map(function (s) { var on = I.subs.indexOf(s.id) !== -1; return '<label class="it-opt"><input type="checkbox" data-it-sub="' + esc(s.id) + '"' + (on ? ' checked' : '') + '><span class="it-ot">' + esc((s.code ? s.code + ' ' : '') + s.name) + ' <span class="it-room">' + esc(s.room) + '</span><small>' + s.periods + ' คาบ/สัปดาห์</small></span></label>'; }).join('');
      var clubH = D.club ? '<label class="it-opt"><input type="checkbox" data-it-club' + (I.club ? ' checked' : '') + '><span class="it-ot">' + esc(D.club.name) + '<small>ดูรายชื่อ เช็คชื่อ ใส่รูปได้ · เล่มรายงานยังเป็นของครูพี่เลี้ยง</small></span></label>' : '<div class="hint">คุณยังไม่มีชุมนุมในภาคเรียนนี้</div>';
      var perm = [['leave', 'แจ้งไปราชการ / ลา', 'เมื่อโรงเรียนเปิดให้ครูแจ้งเอง'], ['cal', 'ดูปฏิทินโรงเรียน', ''], ['sup', 'มีการนิเทศนักศึกษาคนนี้', 'ผู้ดูแลงานนิเทศเลือกนักศึกษาคนนี้เข้ารอบนิเทศได้']].map(function (p) {
        return '<label class="it-opt it-sw"><span class="it-ot">' + p[1] + (p[2] ? '<small>' + p[2] + '</small>' : '') + '</span><input type="checkbox" role="switch" data-it-perm="' + p[0] + '"' + (I.perm[p[0]] ? ' checked' : '') + '><span class="it-swv" aria-hidden="true"></span></label>';
      }).join('');
      var tasks = (I.tasks || []).map(function (t) {
        return '<button type="button" class="it-task" data-it-task="' + esc(t.id) + '"><span class="it-tt"><b>' + esc(t.title) + '</b><small>' + (t.status === 'todo' ? dueText(t) : t.status === 'review' ? 'ส่งแล้ว ' + (t.sentAt ? formatDateTimeThai(t.sentAt) : '') + ' · กดเพื่อตรวจ' : t.note ? 'ความเห็น: ' + esc(t.note) : (t.sentAt ? 'ส่งแล้ว ' + formatDateTimeThai(t.sentAt) : '')) + '</small></span>' + stChip(t.status) + '</button>';
      }).join('') || '<div class="hint">ยังไม่ได้มอบหมายงาน</div>';
      el.innerHTML = '<div class="it-wrap">' + list + '<div class="card it-panel">' +
        '<div class="it-head"><span class="it-av it-av-l">' + (I.avatarUrl ? '<img src="' + esc(I.avatarUrl) + '" alt="">' : '<i class="fa-solid fa-user-graduate"></i>') + '</span><div class="it-ht"><b>' + esc(I.name) + '</b><small>' + esc([I.uni, I.major].filter(Boolean).join(' · ') || 'นักศึกษาฝึกสอน') + (I.until ? ' · ฝึกสอนถึง ' + thD(I.until) : '') + '</small></div><span class="it-tag"><i class="fa-solid fa-user-graduate"></i> นักศึกษาฝึกสอน</span></div>' +
        '<section class="it-blk"><h4><i class="fa-solid fa-chalkboard-user"></i> คาบสอนที่ให้ช่วย</h4>' + subsH + '<div class="hint"><i class="fa-solid fa-circle-check" style="color:var(--accent)"></i> วิชาที่ติ๊ก = นักศึกษาเป็นครูสอนร่วมในเว็บเช็คชื่อ (เช็คชื่อ / บันทึกย้อนหลังได้) · เอาติ๊กออก = ถอดออก</div></section>' +
        '<div class="it-two"><section class="it-blk"><h4><i class="fa-solid fa-people-group"></i> ชุมนุมร่วม</h4>' + clubH + '</section><section class="it-blk"><h4><i class="fa-solid fa-sliders"></i> สิทธิ์อื่น</h4>' + perm + '</section></div>' +
        '<section class="it-blk"><h4><i class="fa-solid fa-clipboard-list"></i> งานที่มอบหมาย <button type="button" class="btn btn-primary btn-sm" data-it-assign style="margin-left:auto"><i class="fa-solid fa-plus"></i> มอบหมายงาน</button></h4>' + tasks + '<div class="hint">งานของนักศึกษาไม่ปนกับงานส่งของครู — ครูพี่เลี้ยงสั่งและตรวจเอง</div></section>' +
        '<div class="it-saving" id="itSaving" hidden><i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก</div>' +
        '</div></div>';
    }
    async function save(payload, okMsg) {
      var I = cur(); if (!I) return;
      saving++; var sv = document.getElementById('itSaving'); if (sv) sv.hidden = false;
      try {
        var r = await apiCall('internConfig', Object.assign({ internId: I.id }, payload));
        var keepTasks = I.tasks; Object.assign(I, r.intern); I.tasks = keepTasks;
        showToast(r.synced === false && payload.subs ? 'บันทึกแล้ว แต่ส่งให้เว็บเช็คชื่อไม่สำเร็จ (' + (r.syncError || '') + ') — ลองติ๊กใหม่อีกครั้ง' : okMsg, r.synced === false && !!payload.subs);
        if (onChange) onChange(D);
      } catch (e) { showToast(e.message, true); }
      saving--; render();
    }
    el.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-it-pick]'))) { sel = t.getAttribute('data-it-pick'); render(); return; }
      if (e.target.closest('[data-it-assign]')) { openAssign(); return; }
      if ((t = e.target.closest('[data-it-task]'))) { openTask(t.getAttribute('data-it-task')); }
    });
    el.addEventListener('change', function (e) {
      var t = e.target, I = cur(); if (!I) return;
      if (t.hasAttribute('data-it-sub')) { var ids = Array.prototype.map.call(el.querySelectorAll('[data-it-sub]:checked'), function (x) { return x.getAttribute('data-it-sub'); }); save({ subs: ids }, t.checked ? 'เพิ่มเป็นครูสอนร่วมแล้ว' : 'ถอดออกจากวิชานี้แล้ว'); }
      else if (t.hasAttribute('data-it-club')) save({ club: t.checked }, t.checked ? 'เพิ่มเป็นครูร่วมชุมนุมแล้ว' : 'ถอดออกจากชุมนุมแล้ว');
      else if (t.hasAttribute('data-it-perm')) { var p = {}; p[t.getAttribute('data-it-perm')] = t.checked; save({ perm: p }, 'บันทึกแล้ว'); }
    });
    function openAssign(task) {
      var I = cur(), edit = !!task;
      modal(edit ? 'แก้ไขงาน' : '<i class="fa-solid fa-clipboard-list" style="color:var(--primary)"></i> มอบหมายงาน',
        '<div class="field"><label for="itaT">ชื่องาน</label><input id="itaT" maxlength="200" value="' + esc(edit ? task.title : '') + '" placeholder="เช่น แผนการจัดการเรียนรู้ หน่วยที่ 4"></div>' +
        '<div class="field"><label for="itaD">กำหนดส่ง</label><input id="itaD" type="date" value="' + esc(edit ? task.due : '') + '"></div>' +
        '<div class="field"><label for="itaN">รายละเอียด (ไม่บังคับ)</label><textarea id="itaN" rows="3" maxlength="3000">' + esc(edit ? task.detail : '') + '</textarea></div>' +
        (edit || D.interns.length < 2 ? '' : '<div class="field"><label>มอบหมายให้</label>' + D.interns.map(function (x) { return '<label class="it-opt"><input type="checkbox" data-ita-who="' + esc(x.id) + '"' + (x.id === I.id ? ' checked' : '') + '><span class="it-ot">' + esc(x.name) + '</span></label>'; }).join('') + '</div>') +
        '<div class="error-box" id="itaErr" hidden></div>',
        '<button type="button" class="btn btn-success" data-ita-save><i class="fa-solid fa-check"></i> ' + (edit ? 'บันทึก' : 'มอบหมาย') + '</button>',
        async function (e) {
          if (!e.target.closest('[data-ita-save]')) return;
          var who = Array.prototype.map.call(document.querySelectorAll('[data-ita-who]:checked'), function (x) { return x.getAttribute('data-ita-who'); });
          var p = { title: document.getElementById('itaT').value, due: document.getElementById('itaD').value, detail: document.getElementById('itaN').value };
          if (edit) p.id = task.id; else p.internIds = who.length ? who : [I.id];
          try { await apiCall('internTaskSave', p); closeModal(); showToast(edit ? 'บันทึกแล้ว' : 'มอบหมายงานแล้ว'); load(true); }
          catch (x) { var eb = document.getElementById('itaErr'); eb.textContent = x.message; eb.hidden = false; }
        });
      setTimeout(function () { var i = document.getElementById('itaT'); if (i) i.focus(); }, 50);
    }
    function openTask(id) {
      var I = cur(), t = (I.tasks || []).filter(function (x) { return x.id === id; })[0]; if (!t) return;
      var body = '<div class="it-mhead">' + stChip(t.status) + ' <span class="hint">' + esc(I.name) + (t.due ? ' · ' + dueText(t) : '') + '</span></div>' +
        (t.detail ? '<div class="it-detail">' + esc(t.detail).replace(/\n/g, '<br>') + '</div>' : '') +
        (t.files.length ? '<div class="it-sub">ไฟล์ที่ส่ง' + (t.sentAt ? ' · ' + formatDateTimeThai(t.sentAt) : '') + '</div>' + filesHtml(t.files) : '<div class="hint">' + (t.status === 'todo' ? 'นักศึกษายังไม่ส่ง' : '') + '</div>') +
        (t.status !== 'todo' ? '<div class="field" style="margin-top:12px"><label for="itrN">ความเห็นถึงนักศึกษา</label><textarea id="itrN" rows="3" maxlength="1000" placeholder="เช่น ดีมาก / ปรับขั้นนำเข้าสู่บทเรียน">' + esc(t.note || '') + '</textarea></div>' : '') +
        '<div class="error-box" id="itrErr" hidden></div>';
      var acts = (t.status !== 'todo' ? '<button type="button" class="btn btn-warning" data-itr="fix"><i class="fa-solid fa-rotate-left"></i> ให้แก้ไข</button><button type="button" class="btn btn-success" data-itr="pass"><i class="fa-solid fa-check"></i> ผ่าน</button>' : '') +
        '<button type="button" class="btn btn-secondary" data-itr-edit><i class="fa-solid fa-pen"></i> แก้ไขงาน</button><button type="button" class="btn btn-ghost" data-itr-del style="color:var(--danger)"><i class="fa-solid fa-trash"></i> ลบ</button>';
      modal(esc(t.title), body, acts, async function (e) {
        var b;
        if ((b = e.target.closest('[data-itr]'))) {
          try { await apiCall('internTaskReview', { id: t.id, status: b.getAttribute('data-itr'), note: document.getElementById('itrN').value }); closeModal(); showToast(b.getAttribute('data-itr') === 'pass' ? 'ให้ผ่านแล้ว' : 'ส่งกลับให้แก้ไขแล้ว'); load(true); }
          catch (x) { var eb = document.getElementById('itrErr'); eb.textContent = x.message; eb.hidden = false; }
        } else if (e.target.closest('[data-itr-edit]')) { openAssign(t); }
        else if (e.target.closest('[data-itr-del]')) {
          closeModal();
          if (!(await askConfirm('ลบงาน "' + t.title + '"? ไฟล์ที่นักศึกษาส่งจะถูกย้ายลงถังขยะ', 'ลบงาน'))) return;
          try { await apiCall('internTaskDelete', { id: t.id }); showToast('ลบแล้ว'); load(true); } catch (x) { showToast(x.message, true); }
        }
      });
    }
    load();
    return { reload: function () { load(true); } };
  };

  // =====================================================================
  // นักศึกษาฝึกสอน: หน้าแรก
  // =====================================================================
  window.mountInternHome = function (el) {
    var H = null, T = null, day = (function () { var d = new Date().getDay(); return d >= 1 && d <= 5 ? d : 1; })();
    async function load() {
      el.innerHTML = '<div class="loading">กำลังโหลด</div>';
      try { H = await apiCall('internHome', {}); } catch (e) { el.innerHTML = '<div class="error-box">' + esc(e.message) + '</div>'; return; }
      render();
      try { T = await apiCall('teachBoot', {}); } catch (e) { T = { error: e.message }; }
      renderWeek();
    }
    function taskRow(t) {
      var open = t.status === 'todo' || t.status === 'fix';
      return '<button type="button" class="it-task' + (open ? ' it-open' : '') + '" data-ih-task="' + esc(t.id) + '"><span class="it-tt"><b>' + esc(t.title) + '</b><small>' +
        (t.status === 'fix' ? '<span class="it-late">ให้แก้ไข: ' + esc(t.note || '') + '</span>' : t.status === 'todo' ? dueText(t) : t.status === 'review' ? 'ส่งแล้ว รอครูพี่เลี้ยงตรวจ' : (t.note ? 'ครูพี่เลี้ยง: "' + esc(t.note) + '"' : 'ผ่านแล้ว')) + '</small></span>' +
        (open ? '<span class="btn btn-primary btn-sm"><i class="fa-solid fa-upload"></i> ' + (t.status === 'fix' ? 'ส่งใหม่' : 'ส่งงาน') + '</span>' : stChip(t.status)) + '</button>';
    }
    function render() {
      var m = H.mentor, me = H.me, open = H.tasks.filter(function (t) { return t.status === 'todo' || t.status === 'fix'; }), done = H.tasks.filter(function (t) { return t.status === 'pass'; }).length;
      el.innerHTML =
        '<div class="card ih-ban"><span class="it-av it-av-l">' + (m && m.avatarUrl ? '<img src="' + esc(m.avatarUrl) + '" alt="">' : '<i class="fa-solid fa-user-tie"></i>') + '</span><div class="it-ht"><b>ครูพี่เลี้ยง: ' + esc(m ? m.name : '-') + '</b>' + (H.co && H.co.length ? '<small>ครูพี่เลี้ยงร่วม: ' + H.co.map(function (c) { return esc(c.name); }).join(', ') + '</small>' : '') + '<small>' + esc([m && m.subjectGroup, me.until ? 'ฝึกสอนถึง ' + thD(me.until) : ''].filter(Boolean).join(' · ')) + '</small></div>' +
          '<span class="it-tag">ช่วยสอน ' + me.subs.length + ' ห้อง' + (H.club ? ' · ชุมนุม 1' : '') + '</span></div>' +
        '<div class="ih-kp"><div class="card"><b class="it-late">' + open.length + '</b><small>งานที่ต้องส่ง</small></div><div class="card"><b style="color:var(--accent)">' + done + '/' + H.tasks.length + '</b><small>งานที่ผ่านแล้ว</small></div></div>' +
        '<div class="ih-grid"><section class="card ih-sec" id="ihWeek"><h3><i class="fa-solid fa-table-cells"></i> ตารางสอนของฉัน <a class="ih-more" href="teach.html#week">ดูทั้งหมด</a></h3><div class="loading">กำลังโหลด</div></section>' +
        '<section class="card ih-sec"><h3><i class="fa-solid fa-clipboard-list"></i> งานจากครูพี่เลี้ยง</h3>' + (H.tasks.map(taskRow).join('') || '<div class="hint">ยังไม่มีงานที่มอบหมาย</div>') + '</section></div>' +
        obsSec() +
        '<div class="ih-links">' + [['teach.html', 'fa-book-open-reader', 'วิชาที่สอน / เช็คชื่อ'], H.club ? ['club.html', 'fa-people-group', 'ชุมนุม ' + H.club.name] : null, internPerm(getSession(), 'cal') ? ['schoolcalendar.html', 'fa-calendar-days', 'ปฏิทินโรงเรียน'] : null, ['directory.html', 'fa-address-book', 'ทำเนียบบุคลากร']].filter(Boolean).map(function (x) { return '<a class="card ih-link" href="' + x[0] + '"><i class="fa-solid ' + x[1] + '"></i><span>' + esc(x[2]) + '</span></a>'; }).join('') + '</div>';
    }
    // 2.11.0: บันทึกการสังเกตการสอน / นิเทศ (ที่ครูพี่เลี้ยงส่งให้) — รับทราบ + บันทึกสะท้อนคิด
    function obsSec() {
      var L = H.obs || []; if (!L.length) return '';
      var wait = L.filter(function (o) { return o.status === 'sent'; }).length;
      return '<section class="card ih-sec" style="margin-top:12px"><h3><i class="fa-solid fa-clipboard-check"></i> บันทึกการสังเกตการสอน / นิเทศ' + (wait ? ' <span class="it-st it-st-review">รอรับทราบ ' + wait + '</span>' : '') + '</h3>' +
        L.map(function (o) { return '<button type="button" class="it-task' + (o.status === 'sent' ? ' it-open' : '') + '" data-ih-obs="' + esc(o.id) + '"><span class="it-tt"><b>' + (o.kind === 'sup' ? 'นิเทศ' : 'สังเกตการสอน') + ' · ' + thD(o.date) + '</b><small>' + esc([o.subject, o.room, o.topic].filter(Boolean).concat([o.kind === 'sup' && o.observer ? o.observer : o.authorName]).join(' · ')) + '</small></span>' + (o.status === 'sent' ? '<span class="btn btn-primary btn-sm">อ่าน / รับทราบ</span>' : '<span class="it-st it-st-pass"><i class="fa-solid fa-check"></i> รับทราบแล้ว</span>') + '</button>'; }).join('') + '</section>';
    }
    function openObs(id) {
      var o = (H.obs || []).filter(function (x) { return x.id === id; })[0]; if (!o) return;
      var t = o.tpl || {};
      var html = '<p class="hint">' + esc([o.subject, o.room, o.topic ? 'เรื่อง ' + o.topic : ''].filter(Boolean).concat([o.kind === 'sup' && o.observer ? 'ผู้นิเทศ ' + o.observer : 'โดย ' + o.authorName]).join(' · ')) + '</p>' +
        (o.scoreHidden ? '' : (t.sections || []).map(function (s) { return '<div class="it-sub">' + esc(s.title) + '</div>' + (s.items || []).map(function (q) { return '<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;border-bottom:1px dashed var(--border)"><span>' + esc(q.text) + '</span><b>' + (o.scores[q.id] || '-') + ' / ' + (t.scale || 5) + '</b></div>'; }).join(''); }).join('')) +
        (t.texts || []).filter(function (x) { return o.texts[x.id]; }).map(function (x) { return '<div class="it-sub">' + esc(x.label) + '</div><div>' + esc(o.texts[x.id]).replace(/\n/g, '<br>') + '</div>'; }).join('') +
        (o.scoreHidden ? '<p class="hint">(คะแนนรายด้าน: ครูพี่เลี้ยงไม่ได้เปิดให้เห็น)</p>' : '') +
        (o.photos && o.photos.length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">' + o.photos.map(function (p) { return '<img src="' + esc(p.src) + '" alt="" referrerpolicy="no-referrer" style="width:100px;height:76px;object-fit:cover;border-radius:8px">'; }).join('') + '</div>' : '') +
        '<div class="field" style="margin-top:12px"><label for="ihRef">บันทึกสะท้อนคิดของฉัน</label><textarea id="ihRef" rows="3" maxlength="3000">' + esc(o.reflection || '') + '</textarea></div><div class="error-box" id="ihErr" hidden></div>';
      modal((o.kind === 'sup' ? 'บันทึกการนิเทศ' : 'บันทึกการสังเกตการสอน') + ' · ' + thD(o.date), html, '<button type="button" class="btn btn-success" data-ih-ack><i class="fa-solid fa-check"></i> ' + (o.status === 'ack' ? 'บันทึก' : 'รับทราบ') + '</button>', async function (e) {
        if (!e.target.closest('[data-ih-ack]')) return;
        try { await apiCall('internObsAck', { id: o.id, reflection: document.getElementById('ihRef').value }); closeModal(); showToast('รับทราบแล้ว'); load(); }
        catch (x) { var eb = document.getElementById('ihErr'); eb.textContent = x.message; eb.hidden = false; }
      });
    }
    function renderWeek() {
      var box = document.getElementById('ihWeek'); if (!box) return;
      var head = '<h3><i class="fa-solid fa-table-cells"></i> ตารางสอนของฉัน <a class="ih-more" href="teach.html#week">ดูทั้งหมด</a></h3>';
      if (!T || T.error) { box.innerHTML = head + '<div class="hint">' + esc((T && T.error) || '') + '</div>'; return; }
      if (!T.linked || !T.term) { box.innerHTML = head + '<div class="hint">' + esc(T.reason || 'ครูพี่เลี้ยงยังไม่ได้เปิดคาบสอนให้') + '</div>'; return; }
      var subs = (T.subjects || []).filter(function (s) { return !s.system; });
      if (!subs.length) { box.innerHTML = head + '<div class="hint">ครูพี่เลี้ยงยังไม่ได้เปิดคาบสอนให้</div>'; return; }
      var at = {}; subs.forEach(function (s) { (s.schedules || []).forEach(function (sc) { at[sc.day + '|' + sc.period] = s; }); });
      var grid = '<div class="ih-wk-wrap"><table class="ih-wk"><thead><tr><th></th>' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (p) { return '<th>' + p + '</th>'; }).join('') + '</tr></thead><tbody>' +
        [1, 2, 3, 4, 5].map(function (d) { return '<tr><th>' + DN[d] + '</th>' + [1, 2, 3, 4, 5, 6, 7, 8].map(function (p) { var s = at[d + '|' + p]; return s ? '<td class="on"><a href="teach.html?subject=' + encodeURIComponent(s.id) + '">' + esc(s.code || s.name) + '<br>' + esc(s.room) + '</a></td>' : '<td></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      var chips = '<div class="ih-days">' + [1, 2, 3, 4, 5].map(function (d) { return '<button type="button" data-ih-day="' + d + '" class="' + (d === day ? 'on' : '') + '">' + DN[d] + '</button>'; }).join('') + '</div><div class="ih-dlist">' +
        ([1, 2, 3, 4, 5, 6, 7, 8].filter(function (p) { return at[day + '|' + p]; }).map(function (p) { var s = at[day + '|' + p]; return '<a class="ih-per" href="teach.html?subject=' + encodeURIComponent(s.id) + '"><span class="ih-pn"><b>' + p + '</b>' + (TIMES[p] || '') + '</span><span><b>' + esc((s.code ? s.code + ' ' : '') + s.name) + '</b><small>' + esc(s.room) + '</small></span></a>'; }).join('') || '<div class="hint">วันนี้ไม่มีคาบที่ช่วยสอน</div>') + '</div>';
      box.innerHTML = head + grid + chips;
    }
    el.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-ih-day]'))) { day = +t.getAttribute('data-ih-day'); renderWeek(); return; }
      if ((t = e.target.closest('[data-ih-task]'))) openSubmit(t.getAttribute('data-ih-task'));
      if ((t = e.target.closest('[data-ih-obs]'))) openObs(t.getAttribute('data-ih-obs'));
    });
    function openSubmit(id) {
      var t = H.tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
      var editable = t.status === 'todo' || t.status === 'fix';
      var keep = t.files.map(function (f) { return f.id; }), adds = []; // adds: [{file, prep?, res?}]
      function filesBox() {
        return t.files.filter(function (f) { return keep.indexOf(f.id) !== -1; }).map(function (f) { return '<div class="it-fi"><i class="fa-solid ' + fileIcon(f.name) + '"></i><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + esc(f.name) + '</a>' + (editable ? '<button type="button" class="it-x" data-ihf-rm="' + esc(f.id) + '" aria-label="เอาไฟล์ออก"><i class="fa-solid fa-xmark"></i></button>' : '') + '</div>'; }).join('') +
          adds.map(function (a, i) { return '<div class="it-fi it-new"><i class="fa-solid ' + fileIcon(a.file.name) + '"></i><span>' + esc(a.file.name) + ' <small class="hint">(ไฟล์ใหม่)</small></span><button type="button" class="it-x" data-ihf-add="' + i + '" aria-label="เอาไฟล์ออก"><i class="fa-solid fa-xmark"></i></button></div>'; }).join('') ||
          '<div class="hint" style="text-align:center;padding:8px">ยังไม่ได้เลือกไฟล์</div>';
      }
      function draw() {
        modal(esc(t.title), '<div class="it-mhead">' + stChip(t.status) + ' <span class="hint">' + (t.due ? dueText(t) : '') + ' · ส่งให้ครูพี่เลี้ยงตรวจ</span></div>' +
          (t.detail ? '<div class="it-detail">' + esc(t.detail).replace(/\n/g, '<br>') + '</div>' : '') +
          (t.note && t.status !== 'review' ? '<div class="it-note2"><i class="fa-solid fa-comment"></i> ' + esc(t.note) + '</div>' : '') +
          (editable ? '<div class="it-drop"><label class="btn btn-secondary" for="ihFile"><i class="fa-solid fa-folder-open"></i> เลือกไฟล์</label><label class="btn btn-secondary" for="ihCam"><i class="fa-solid fa-camera"></i> ถ่ายรูป</label><input type="file" id="ihFile" multiple hidden><input type="file" id="ihCam" accept="image/*" capture="environment" hidden></div>' : '') +
          '<div id="ihFiles">' + filesBox() + '</div><div class="error-box" id="ihErr" hidden></div>',
          editable ? '<button type="button" class="btn btn-success" data-ih-send><i class="fa-solid fa-paper-plane"></i> ส่งงาน</button>' : '',
          async function (e) {
            var b;
            if ((b = e.target.closest('[data-ihf-rm]'))) { keep = keep.filter(function (x) { return x !== b.getAttribute('data-ihf-rm'); }); document.getElementById('ihFiles').innerHTML = filesBox(); return; }
            if ((b = e.target.closest('[data-ihf-add]'))) { adds.splice(+b.getAttribute('data-ihf-add'), 1); document.getElementById('ihFiles').innerHTML = filesBox(); return; }
            if (e.target.closest('[data-ih-send]')) send();
          });
        ['ihFile', 'ihCam'].forEach(function (k) { var inp = document.getElementById(k); if (inp) inp.addEventListener('change', function () { Array.prototype.forEach.call(inp.files, function (f) { adds.push({ file: f }); }); inp.value = ''; document.getElementById('ihFiles').innerHTML = filesBox(); }); });
      }
      async function send() {
        var eb = document.getElementById('ihErr'); eb.hidden = true;
        if (!keep.length && !adds.length) { eb.textContent = 'กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์'; eb.hidden = false; return; }
        if (keep.length + adds.length > 5) { eb.textContent = 'แนบได้ไม่เกิน 5 ไฟล์'; eb.hidden = false; return; }
        closeModal();
        var r = await withProgress('กำลังส่งงาน', async function (p) {
          var out = [];
          for (var i = 0; i < adds.length; i++) {
            var f = adds[i].file, from = Math.round(i / adds.length * 90), to = Math.round((i + 1) / adds.length * 90);
            var prep = await apiCall('internFilePrepare', { taskId: t.id, fileName: f.name, mimeType: f.type, fileSize: f.size, direct: 1, origin: location.origin });
            var res = p && p.setProgress ? await sendPreparedFileProgress(prep, f, p, from, to, 'กำลังอัปโหลด ' + f.name) : await sendPreparedFile(prep, f, {});
            out.push({ fileRowId: prep.fileRowId, fileId: res.fileId, fileUrl: res.url, directUrl: res.directUrl, via: res.via, fallbackReason: res.fallbackReason });
          }
          return apiCall('internTaskSubmit', { taskId: t.id, keep: keep, files: out });
        }, { successLabel: 'ส่งงานแล้ว' });
        if (r.ok) load(); else draw();
      }
      draw();
    }
    load();
  };
})();
