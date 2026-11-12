/* นักศึกษาฝึกสอน (2.11.0) — หน้า interns.html
 * ภาพรวม (การ์ดรายคน) → รายคน: ข้อมูล/ตั้งค่า · งาน · สังเกตการสอน · นิเทศ · ชั่วโมงสอน · รายงาน PDF
 * สิทธิ์ (ฝั่งเซิร์ฟเวอร์ตรวจซ้ำ): admin = Super Admin/แอดมินระบบ (ทุกคน) · primary = ครูพี่เลี้ยงหลัก · co = ครูพี่เลี้ยงร่วม · exec = ผู้บริหาร (ดูอย่างเดียว)
 * แม่แบบแบบฟอร์มสังเกต/นิเทศ: แอดมินแก้ได้ (แท็บ "แม่แบบแบบฟอร์ม") · บันทึกแต่ละครั้งเก็บสำเนาแม่แบบไว้ */
(function () {
  var session = requireLogin();
  if (!session) return;
  mountChrome('interns'); if (typeof mountFooter === 'function') mountFooter();
  var body = document.getElementById('ipBody'), tabsEl = document.getElementById('ipTabs'), modal = document.getElementById('ipModal');
  var B = null, D = null, H = null, st = { tab: 'list', q: '', flt: 'active', id: '', sub: 'info' };
  var MS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  var KIND = { obs: 'สังเกตการสอน', sup: 'นิเทศ' };
  var TST = { todo: ['ยังไม่ส่ง', ''], review: ['รอตรวจ', 'w'], fix: ['ให้แก้ไข', 'r'], pass: ['ผ่าน', 'ok'] };
  function esc(s) { return escapeHtml(s == null ? '' : String(s)); }
  function ic(n) { return '<i class="fa-solid ' + n + '" aria-hidden="true"></i>'; }
  function err(m) { return '<div class="error-box">' + esc(m) + '</div>'; }
  function thD(ds, short) { var p = String(ds || '').split('-'); if (p.length < 3) return ''; var y = +p[0] + 543; return (+p[2]) + ' ' + MS[+p[1] - 1] + ' ' + (short ? String(y).slice(2) : y); }
  function today() { return (B && B.today) || new Date().toISOString().slice(0, 10); }
  function dleft(ds) { if (!ds) return null; var a = ds.split('-'), b = today().split('-'); return Math.round((new Date(+a[0], +a[1] - 1, +a[2]) - new Date(+b[0], +b[1] - 1, +b[2])) / 864e5); }
  function av(url, l) { return url ? '<img class="ip-av' + (l ? ' l' : '') + '" src="' + esc(url) + '" alt="" referrerpolicy="no-referrer">' : '<span class="ip-av' + (l ? ' l' : '') + '">' + ic('fa-user-graduate') + '</span>'; }
  function tg(t, c) { return '<span class="ip-tg ' + (c || '') + '">' + t + '</span>'; }
  function canE() { return D && D.role !== 'exec'; }
  function canP() { return D && (D.role === 'admin' || D.role === 'primary'); }
  function closeModal() { hideModalEl(modal); modal._on = null; }
  modal.addEventListener('click', function (e) { if (e.target.closest('[data-ip-close]')) closeModal(); else if (modal._on) modal._on(e); });
  function openModal(title, html, actions, on) { document.getElementById('ipModalTitle').innerHTML = title; document.getElementById('ipModalBody').innerHTML = html; document.getElementById('ipModalActions').innerHTML = actions || ''; modal._on = on || null; showModalEl(modal); }
  function mErr(m) { var e = document.getElementById('ipErr'); if (e) { e.textContent = m; e.hidden = !m; } }

  // ---------- โหลด ----------
  async function boot() {
    try { B = await apiCall('internPageBoot', {}); } catch (e) { tabsEl.innerHTML = ''; body.innerHTML = '<div class="card">' + err(e.message) + '</div>'; return; }
    var q = new URLSearchParams(location.search).get('id') || (/^#i=(.+)$/.exec(location.hash) || [])[1];
    if (q && B.list.some(function (x) { return x.id === q; })) { st.id = q; st.tab = 'list'; }
    renderTabs();
  }
  function renderTabs() {
    var t = [['list', 'fa-user-graduate', 'นักศึกษาฝึกสอน (' + B.list.length + ')']];
    if (B.admin) t.push(['tpl', 'fa-list-check', 'แม่แบบแบบฟอร์ม']);
    tabsEl.innerHTML = t.length > 1 ? t.map(function (x) { return '<button type="button" data-ip-tab="' + x[0] + '" class="' + (x[0] === st.tab ? 'on' : '') + '">' + ic(x[1]) + ' ' + x[2] + '</button>'; }).join('') : '';
    if (st.tab === 'tpl') renderTpl(); else if (st.id) openIntern(st.id); else renderList();
  }
  tabsEl.addEventListener('click', function (e) { var b = e.target.closest('[data-ip-tab]'); if (b) { st.tab = b.getAttribute('data-ip-tab'); st.id = ''; renderTabs(); } });

  // ---------- ภาพรวม ----------
  function card(x) {
    var dl = dleft(x.until), mine = x.role === 'primary' || x.role === 'co';
    var who = tg('หลัก', 'p') + ' ' + esc(x.mentor.name || '-') + (x.co.length ? ' &nbsp;' + tg('ร่วม', 'c') + ' ' + x.co.map(function (c) { return esc(c.name); }).join(', ') : '');
    var tags = x.expired ? tg('ข้อมูลยังดู/ออกรายงานได้') : tg('ช่วยสอน ' + x.subs + ' วิชา' + (x.club ? ' · ชุมนุม' : ''), 'c') +
      (x.review ? tg('รอตรวจ ' + x.review + ' งาน', 'w') : tg(x.tasks ? 'ไม่มีงานค้าง' : 'ยังไม่มีงาน')) +
      (x.obs == null ? '' : x.obs || x.sup ? tg('สังเกต ' + x.obs + ' · นิเทศ ' + x.sup, 'b') : tg('ยังไม่ได้สังเกต', 'r'));
    return '<button type="button" class="ip-card' + (x.expired ? ' exp' : '') + '" data-ip-open="' + esc(x.id) + '">' + av(x.avatarUrl) + '<span class="ip-cm"><b>' + esc(x.name) + (mine && B.admin ? ' ' + tg(x.role === 'primary' ? 'ของฉัน' : 'ร่วม', 'c') : '') + '</b><small>' +
      esc([x.uni, x.major].filter(Boolean).join(' · ')) + (x.expired ? ' · <span class="ip-red">ครบกำหนดแล้ว</span>' : dl != null ? ' · เหลือ ' + dl + ' วัน' : '') + '</small><div class="ip-ml">' + who + '</div>' + tags + '</span></button>';
  }
  function renderList() {
    var q = st.q.trim().toLowerCase(), L = B.list.filter(function (x) { return (st.flt === 'all' || (st.flt === 'active' ? !x.expired : x.expired)) && (!q || (x.name + ' ' + x.uni + ' ' + x.major + ' ' + x.mentor.name + ' ' + x.co.map(function (c) { return c.name; }).join(' ')).toLowerCase().indexOf(q) !== -1); });
    var nAct = B.list.filter(function (x) { return !x.expired; }).length;
    body.innerHTML = '<div class="card">' + (B.sqlReady ? '' : '<div class="error-box">บันทึกการสังเกต/นิเทศยังใช้ไม่ได้ — ผู้ดูแลระบบต้องรัน SQL ชุดที่สี่สิบสามก่อน</div>') +
      '<div class="ip-bar"><h3>นักศึกษาฝึกสอน ' + nAct + ' คน <span class="ip-mut">กำลังฝึก' + (B.exec ? ' · ดูได้อย่างเดียว' : '') + '</span></h3><input type="search" id="ipQ" placeholder="ค้นหา" value="' + esc(st.q) + '"><select id="ipFlt">' + [['active', 'กำลังฝึก'], ['expired', 'ครบกำหนดแล้ว'], ['all', 'ทั้งหมด']].map(function (o) { return '<option value="' + o[0] + '"' + (st.flt === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      (L.length ? '<div class="ip-cards">' + L.map(card).join('') + '</div>' : '<p class="ip-mut" style="text-align:center;padding:24px">' + (B.list.length ? 'ไม่พบรายชื่อตามที่เลือก' : 'ยังไม่มีนักศึกษาฝึกสอน — Super Admin เพิ่มบัญชีได้ที่หน้าตั้งค่า › บัญชีผู้ใช้') + '</p>') +
      (B.superAdmin ? '<div class="ip-rows" style="margin-top:14px"><div><span>เมนู "นักศึกษาฝึกสอน"<small>อัตโนมัติ = แสดงเฉพาะช่วงที่มีนักศึกษาฝึกสอนอยู่ในช่วงฝึก (ปีที่ไม่มีจะซ่อนเอง)</small></span><select id="ipNav">' + [['auto', 'อัตโนมัติ'], ['on', 'แสดงเสมอ'], ['off', 'ปิด']].map(function (o) { return '<option value="' + o[0] + '"' + (B.nav === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div></div>' : '') + '</div>';
  }
  body.addEventListener('input', function (e) { if (e.target.id === 'ipQ') { st.q = e.target.value; var p = e.target.selectionStart; renderList(); var i = document.getElementById('ipQ'); i.focus(); try { i.setSelectionRange(p, p); } catch (x) { /* ข้าม */ } } });

  // ---------- รายคน ----------
  async function openIntern(id, keepSub) {
    st.id = id; if (!keepSub) st.sub = 'info'; H = null;
    try { history.replaceState(null, '', '#i=' + id); } catch (x) { /* ข้าม */ }
    if (!D || D.intern.id !== id) body.innerHTML = '<div class="card"><div class="loading">กำลังโหลด...</div></div>';
    try { D = await apiCall('internDetail', { id: id }); } catch (e) { body.innerHTML = '<div class="card"><button type="button" class="ip-back" data-ip-back>' + ic('fa-arrow-left') + ' กลับ</button>' + err(e.message) + '</div>'; return; }
    renderDetail();
  }
  function obsOf(k) { return (D.obs || []).filter(function (o) { return o.kind === k; }); }
  function renderDetail() {
    var I = D.intern, nObs = obsOf('obs').length, nSup = obsOf('sup').length;
    var subs = [['info', 'ข้อมูล / ตั้งค่า'], ['task', 'งาน (' + D.tasks.length + ')'], ['obs', 'สังเกตการสอน (' + nObs + ')'], ['sup', 'นิเทศ (' + nSup + ')'], ['hours', 'ชั่วโมงสอน']];
    body.innerHTML = '<div class="card"><button type="button" class="ip-back" data-ip-back>' + ic('fa-arrow-left') + ' นักศึกษาฝึกสอนทั้งหมด</button>' +
      '<div class="ip-head">' + av(I.avatarUrl, true) + '<div class="ip-hm"><h2>' + esc(I.name) + '</h2><small>' + esc([I.uni, I.major].filter(Boolean).join(' · ')) + (I.from || I.until ? ' · ' + thD(I.from) + ' – ' + thD(I.until) : '') + (I.expired ? ' · <span class="ip-red">ครบกำหนดแล้ว</span>' : '') + '</small>' +
      '<div>' + (D.role === 'exec' ? tg('ดูได้อย่างเดียว') : D.role === 'co' ? tg('คุณเป็นครูพี่เลี้ยงร่วม', 'c') : D.role === 'primary' ? tg('คุณเป็นครูพี่เลี้ยงหลัก', 'p') : '') + '</div></div>' +
      '<button type="button" class="btn btn-primary" data-ip-pdf>' + ic('fa-file-pdf') + ' รายงาน PDF</button></div>' +
      '<div class="ip-sub">' + subs.map(function (x) { return '<button type="button" data-ip-sub="' + x[0] + '" class="' + (st.sub === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div><div id="ipSubBody"></div></div>';
    ({ info: renderInfo, task: renderTasks, obs: renderObs, sup: renderObs, hours: renderHours })[st.sub]();
  }
  function sb() { return document.getElementById('ipSubBody'); }

  // ข้อมูล / ตั้งค่า
  function renderInfo() {
    var I = D.intern, P = canP();
    var co = I.co.map(function (c) { return '<span class="ip-chip">' + esc(c.name) + (P ? '<button type="button" data-ip-corm="' + esc(c.id) + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button>' : '&nbsp;') + '</span>'; }).join('') || '<span class="ip-mut">ไม่มี</span>';
    var taken = [I.mentor.id].concat(I.co.map(function (c) { return c.id; }));
    var addCo = P ? '<div style="display:flex;gap:6px;margin-top:6px;width:100%"><select id="ipCoSel" style="flex:1"><option value="">+ เพิ่มครูพี่เลี้ยงร่วม</option>' + D.people.filter(function (p) { return taken.indexOf(p.id) === -1; }).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>'; }).join('') + '</select><button type="button" class="btn btn-secondary btn-sm" data-ip-coadd>เพิ่ม</button></div>' : '';
    var perm = [['leave', 'แจ้งไปราชการ / ลา'], ['cal', 'ดูปฏิทินโรงเรียน'], ['sup', 'มีการนิเทศนักศึกษาคนนี้ (หน้านิเทศการสอน)']];
    var left = '<div class="card"><h4 style="margin-top:0">' + ic('fa-id-card') + ' ข้อมูล</h4><div class="ip-rows">' +
      '<div><span>ครูพี่เลี้ยงหลัก</span><span>' + esc(I.mentor.name || '-') + '</span></div>' +
      '<div><span>ครูพี่เลี้ยงร่วม<small>สิทธิ์คล้ายครูพี่เลี้ยง (เลือกวิชา/ชุมนุมของตัวเอง · มอบหมาย/ตรวจงาน · บันทึกสังเกต/นิเทศ)</small></span><span>' + co + '</span>' + addCo + '</div>' +
      (P ? '<div><span>ช่วงฝึกสอน / สถาบัน</span><span class="ip-fm" style="width:100%"><span class="ip-fr"><label>เริ่ม<input type="date" id="ipFrom" value="' + esc(I.from) + '"></label><label>สิ้นสุด<input type="date" id="ipUntil" value="' + esc(I.until) + '"></label><label>สถาบัน<input id="ipUni" maxlength="120" value="' + esc(I.uni) + '"></label><label>สาขา<input id="ipMajor" maxlength="80" value="' + esc(I.major) + '"></label></span><button type="button" class="btn btn-secondary btn-sm" data-ip-infosave>' + ic('fa-floppy-disk') + ' บันทึกข้อมูล</button></span></div>' :
        '<div><span>ช่วงฝึกสอน</span><span>' + thD(I.from) + ' – ' + thD(I.until) + '</span></div>') +
      '<div><span>ให้นักศึกษาเห็นคะแนนรายด้าน<small>ในบันทึกสังเกต/นิเทศ · ครูพี่เลี้ยงหลักเลือก (ข้อความเห็นเสมอ)</small></span><input type="checkbox" class="ip-sw" id="ipShow"' + (I.showScore ? ' checked' : '') + (P ? '' : ' disabled') + '></div>' +
      perm.map(function (p) { return '<div><span>' + p[1] + '</span><input type="checkbox" class="ip-sw" data-ip-perm="' + p[0] + '"' + (I.perm[p[0]] ? ' checked' : '') + (P ? '' : ' disabled') + '></div>'; }).join('') + '</div></div>';
    var right = '<div class="card"><h4 style="margin-top:0">' + ic('fa-book-open') + ' วิชา / ชุมนุมที่ให้ช่วยสอน</h4><p class="ip-mut" style="margin-top:0">ครูพี่เลี้ยงแต่ละคนเลือกจากวิชาของตัวเอง · วิชาที่ติ๊ก = นักศึกษาเป็นครูสอนร่วมในเว็บเช็คชื่อ</p>' +
      D.mentors.map(function (m) {
        var ed = m.editable && canE();
        return '<div class="ip-mh">' + tg(m.primary ? 'หลัก' : 'ร่วม', m.primary ? 'p' : 'c') + ' ' + esc(m.name) + '</div>' +
          (m.subjectsError ? '<div class="ip-mut ip-red">' + esc(m.subjectsError) + '</div>' : '') +
          (m.subjects.map(function (s) { return '<label class="ip-opt"><input type="checkbox" data-ip-subj="' + esc(s.id) + '" data-m="' + esc(m.id) + '"' + (s.on ? ' checked' : '') + (ed ? '' : ' disabled') + '><span>' + esc((s.code ? s.code + ' ' : '') + s.name) + ' · ' + esc(s.room) + '<small>' + s.periods + ' คาบ/สัปดาห์</small></span></label>'; }).join('') || '<div class="ip-mut">ไม่มีวิชาในภาคเรียนนี้</div>') +
          (m.club ? '<label class="ip-opt"><input type="checkbox" data-ip-club="' + esc(m.id) + '"' + (m.club.on ? ' checked' : '') + (ed ? '' : ' disabled') + '><span>ชุมนุม ' + esc(m.club.name) + '<small>เป็นครูร่วมของชุมนุม</small></span></label>' : '');
      }).join('') + '</div>';
    sb().innerHTML = '<div class="ip-grid2">' + left + right + '</div>';
  }
  async function act(action, payload, okMsg) {
    try { await apiCall(action, payload); showToast(okMsg || 'บันทึกแล้ว'); } catch (e) { showToast(e.message, true); }
    await openIntern(st.id, true);
  }

  // งาน
  function renderTasks() {
    var T = D.tasks;
    sb().innerHTML = '<div class="ip-bar"><span class="ip-mut" style="flex:1">งานที่ครูพี่เลี้ยงมอบหมาย · ครูพี่เลี้ยงทุกคนตรวจได้</span>' + (canE() && !D.intern.expired ? '<button type="button" class="btn btn-primary" data-ip-tnew>' + ic('fa-plus') + ' มอบหมายงาน</button>' : '') + '</div>' +
      (T.map(function (t) { var s = TST[t.status] || TST.todo; return '<button type="button" class="ip-item" data-ip-task="' + esc(t.id) + '"><span class="ip-im"><b>' + esc(t.title) + '</b><small>โดย ' + esc(t.mentorName) + (t.due ? ' · กำหนดส่ง ' + thD(t.due) : '') + (t.files.length ? ' · ไฟล์ ' + t.files.length : '') + '</small></span>' + tg(s[0], s[1]) + '</button>'; }).join('') || '<p class="ip-mut">ยังไม่มีงาน</p>');
  }
  function openTaskForm(t) {
    openModal(t ? 'แก้ไขงาน' : 'มอบหมายงานให้ ' + esc(D.intern.name), '<div class="ip-fm"><label>ชื่องาน<input id="ipTT" maxlength="200" value="' + esc(t ? t.title : '') + '"></label><label>รายละเอียด<textarea id="ipTD" rows="4" maxlength="3000">' + esc(t ? t.detail : '') + '</textarea></label><label>กำหนดส่ง<input type="date" id="ipTDue" value="' + esc(t ? t.due : '') + '"></label></div><div class="error-box" id="ipErr" hidden></div>',
      '<button type="button" class="btn btn-primary" data-ip-tsave>' + ic('fa-floppy-disk') + ' บันทึก</button>', async function (e) {
        if (!e.target.closest('[data-ip-tsave]')) return;
        var p = { title: document.getElementById('ipTT').value, detail: document.getElementById('ipTD').value, due: document.getElementById('ipTDue').value };
        if (t) p.id = t.id; else p.internId = D.intern.id;
        try { await apiCall('internTaskSave', p); closeModal(); showToast('บันทึกแล้ว'); openIntern(st.id, true); } catch (x) { mErr(x.message); }
      });
  }
  function openTask(id) {
    var t = D.tasks.filter(function (x) { return x.id === id; })[0]; if (!t) return;
    var mine = t.mentorId === D.me.id || canP(), s = TST[t.status] || TST.todo;
    var html = '<p>' + tg(s[0], s[1]) + ' <span class="ip-mut">โดย ' + esc(t.mentorName) + (t.due ? ' · กำหนดส่ง ' + thD(t.due) : '') + '</span></p>' + (t.detail ? '<p>' + esc(t.detail).replace(/\n/g, '<br>') + '</p>' : '') +
      (t.files.length ? '<div class="ip-mh">ไฟล์ที่ส่ง' + (t.sentAt ? ' <span class="ip-mut">' + formatDateTimeThai(t.sentAt) + '</span>' : '') + '</div>' + t.files.map(function (f) { return '<div><a href="' + esc(f.url) + '" target="_blank" rel="noopener">' + ic('fa-file') + ' ' + esc(f.name) + '</a></div>'; }).join('') : '<p class="ip-mut">' + (t.status === 'todo' ? 'นักศึกษายังไม่ส่ง' : '') + '</p>') +
      (canE() && t.status !== 'todo' ? '<div class="ip-fm"><label>ความเห็นถึงนักศึกษา<textarea id="ipRN" rows="3" maxlength="1000">' + esc(t.note) + '</textarea></label></div>' : t.note ? '<p class="ip-ref">' + esc(t.note) + '</p>' : '') + '<div class="error-box" id="ipErr" hidden></div>';
    var a = canE() ? (t.status !== 'todo' ? '<button type="button" class="btn btn-warning" data-ip-rv="fix">' + ic('fa-rotate-left') + ' ให้แก้ไข</button><button type="button" class="btn btn-success" data-ip-rv="pass">' + ic('fa-check') + ' ผ่าน</button>' : '') +
      (mine ? '<button type="button" class="btn btn-secondary" data-ip-tedit>' + ic('fa-pen') + ' แก้ไข</button><button type="button" class="btn btn-ghost" data-ip-tdel style="color:var(--danger)">' + ic('fa-trash') + ' ลบ</button>' : '') : '';
    openModal(esc(t.title), html, a, async function (e) {
      var b;
      if ((b = e.target.closest('[data-ip-rv]'))) { try { await apiCall('internTaskReview', { id: t.id, status: b.getAttribute('data-ip-rv'), note: document.getElementById('ipRN').value }); closeModal(); showToast('บันทึกผลการตรวจแล้ว'); openIntern(st.id, true); } catch (x) { mErr(x.message); } }
      else if (e.target.closest('[data-ip-tedit]')) openTaskForm(t);
      else if (e.target.closest('[data-ip-tdel]')) { closeModal(); if (!(await askConfirm('ลบงาน "' + t.title + '"?', 'ลบงาน'))) return; act('internTaskDelete', { id: t.id }, 'ลบแล้ว'); }
    });
  }

  // สังเกตการสอน / นิเทศ
  function stTag(o) { return o.status === 'ack' ? tg('นักศึกษารับทราบแล้ว ✓', 'ok') : o.status === 'sent' ? tg('ส่งแล้ว · รอรับทราบ', 'w') : tg('ร่าง'); }
  function secAvg(o, sec) { var v = (sec.items || []).map(function (i) { return Number(o.scores[i.id]) || 0; }).filter(Boolean); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : null; }
  function renderObs() {
    var k = st.sub, L = obsOf(k), no = {};
    if (D.obs == null) { sb().innerHTML = err('ยังใช้ไม่ได้ — ผู้ดูแลระบบต้องรัน SQL ชุดที่สี่สิบสามก่อน'); return; }
    L.slice().sort(function (a, b) { return a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt); }).forEach(function (o, i) { no[o.id] = i + 1; });
    var sc = L.filter(function (o) { return o.avg != null; }), avg = sc.length ? sc.reduce(function (a, o) { return a + o.avg; }, 0) / sc.length : null;
    var html = '<div class="ip-bar"><span class="ip-mut" style="flex:1">เรียงล่าสุดก่อน' + (avg != null ? ' · คะแนนเฉลี่ย ' + avg.toFixed(1) : '') + '</span>' + (canE() ? '<button type="button" class="btn btn-primary" data-ip-onew>' + ic('fa-plus') + ' บันทึกการ' + KIND[k] + '</button>' : '') + '</div>' +
      (L.map(function (o) {
        return '<button type="button" class="ip-item" data-ip-obs="' + esc(o.id) + '"><span class="ip-sc' + (o.avg == null ? ' d' : '') + '">' + (o.avg != null ? o.avg.toFixed(1) : o.status === 'draft' ? 'ร่าง' : '-') + '</span><span class="ip-im"><b>ครั้งที่ ' + no[o.id] + ' · ' + thD(o.date) + (o.period ? ' คาบ ' + esc(o.period) : '') + (o.room ? ' · ' + esc(o.room) : '') + (o.subject ? ' ' + esc(o.subject) : '') + '</b><small>' +
          (o.topic ? 'เรื่อง ' + esc(o.topic) + ' · ' : '') + (k === 'sup' && o.observer ? 'ผู้นิเทศ ' + esc(o.observer) : 'โดย ' + esc(o.authorName)) + (o.photos.length ? ' · รูป ' + o.photos.length : '') + '</small></span>' + stTag(o) + '</button>';
      }).join('') || '<p class="ip-mut">ยังไม่มีบันทึก</p>');
    // พัฒนาการรายด้าน (แม่แบบเดียวกัน · ตามลำดับเวลา)
    var chron = sc.slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
    if (chron.length >= 2) {
      var tpl = chron[chron.length - 1].tpl, same = chron.filter(function (o) { return o.tpl.id === tpl.id; }).slice(-8);
      if (same.length >= 2) html += '<div class="ip-dev"><h4>พัฒนาการรายด้าน (ครั้งที่ ' + no[same[0].id] + ' → ' + no[same[same.length - 1].id] + ')</h4>' + (tpl.sections || []).map(function (s) {
        return '<div class="ip-dr"><span>' + esc(s.title) + '</span><div>' + same.map(function (o) { var v = secAvg(o, s); return '<i style="height:' + (v ? Math.round(v / (tpl.scale || 5) * 100) : 0) + '%" title="' + thD(o.date) + '">' + (v ? '<em>' + v.toFixed(1) + '</em>' : '') + '</i>'; }).join('') + '</div></div>';
      }).join('') + '</div>';
    }
    sb().innerHTML = html;
  }
  function shrink(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { var max = 1400, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { b ? res(new File([b], 'photo.jpg', { type: 'image/jpeg' })) : rej(new Error('ย่อรูปไม่สำเร็จ')); }, 'image/jpeg', 0.85); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('อ่านรูปไม่ได้')); };
      img.src = url;
    });
  }
  function openObs(o, kind) {
    kind = o ? o.kind : kind; var isNew = !o;
    var ed = canE() && (!o || ((o.authorId === D.me.id || canP()) && o.status !== 'ack'));
    var tpl = o ? o.tpl : D.tpls[0], adds = [], dels = [];
    var subjOpts = []; D.mentors.forEach(function (m) { m.subjects.forEach(function (s) { if (s.on) subjOpts.push(s); }); });
    function scores() { var r = {}; document.querySelectorAll('[data-ip-pt].on').forEach(function (b) { r[b.getAttribute('data-q')] = +b.getAttribute('data-ip-pt'); }); return r; }
    function texts() { var r = {}; document.querySelectorAll('[data-ip-tx]').forEach(function (t) { r[t.getAttribute('data-ip-tx')] = t.value; }); return r; }
    function form() {
      var S = o ? o.scores : {}, X = o ? o.texts : {}, dis = ed ? '' : ' disabled';
      var pts = function (q) { var a = []; for (var v = 1; v <= (tpl.scale || 5); v++) a.push('<button type="button" data-ip-pt="' + v + '" data-q="' + esc(q) + '" class="' + (S[q] === v ? 'on' : '') + '"' + dis + '>' + v + '</button>'); return '<span class="ip-pts' + (ed ? '' : ' ro') + '">' + a.join('') + '</span>'; };
      var ph = (o ? o.photos.filter(function (p) { return dels.indexOf(p.id) === -1; }) : []).map(function (p) { return '<div><img src="' + esc(p.src) + '" alt="" referrerpolicy="no-referrer">' + (ed ? '<button type="button" data-ip-phdel="' + esc(p.id) + '" aria-label="ลบรูป">' + ic('fa-xmark') + '</button>' : '') + '</div>'; }).join('') +
        adds.map(function (f, i) { return '<div class="new">' + esc(f.name) + '<button type="button" data-ip-phrm="' + i + '" aria-label="เอาออก">' + ic('fa-xmark') + '</button></div>'; }).join('');
      var nPh = (o ? o.photos.length - dels.length : 0) + adds.length;
      return '<div class="ip-fm">' + (isNew && D.tpls.length > 1 ? '<label>แม่แบบ<select id="ipTpl">' + D.tpls.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === tpl.id ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('') + '</select></label>' : '') +
        '<div class="ip-fr"><label>วันที่<input type="date" id="ipOD" value="' + esc(o ? o.date : today()) + '"' + dis + '></label><label>คาบ<input id="ipOP" maxlength="10" value="' + esc(o ? o.period : '') + '"' + dis + '></label>' +
        '<label>วิชา<input id="ipOS" list="ipSubjL" maxlength="150" value="' + esc(o ? o.subject : '') + '"' + dis + '></label><label>ห้อง<input id="ipOR" maxlength="30" value="' + esc(o ? o.room : '') + '"' + dis + '></label></div>' +
        '<datalist id="ipSubjL">' + subjOpts.map(function (s) { return '<option value="' + esc((s.code ? s.code + ' ' : '') + s.name) + '">' + esc(s.room) + '</option>'; }).join('') + '</datalist>' +
        '<label>เรื่องที่สอน<input id="ipOT" maxlength="200" value="' + esc(o ? o.topic : '') + '"' + dis + '></label>' +
        (kind === 'sup' ? '<label>ผู้นิเทศ <span class="ip-mut">(บุคลากรหรืออาจารย์นิเทศก์มหาวิทยาลัย)</span><input id="ipOO" maxlength="120" list="ipPeopleL" value="' + esc(o ? o.observer : D.me.name) + '"' + dis + '></label><datalist id="ipPeopleL">' + D.mentors.map(function (m) { return '<option value="' + esc(m.name) + '">'; }).join('') + '</datalist>' : '') +
        (tpl.sections || []).map(function (s) { return '<div class="ip-sec">' + esc(s.title) + '</div>' + (s.items || []).map(function (i) { return '<div class="ip-q"><span>' + esc(i.text) + '</span>' + pts(i.id) + '</div>'; }).join(''); }).join('') +
        (tpl.texts || []).map(function (t) { return '<label class="ip-sec" style="display:block">' + esc(t.label) + '<textarea data-ip-tx="' + esc(t.id) + '" rows="3" maxlength="3000"' + dis + '>' + esc(X[t.id] || '') + '</textarea></label>'; }).join('') +
        '<div class="ip-sec">รูปประกอบ <span class="ip-mut">(ไม่เกิน 3)</span></div><div class="ip-ph">' + (ph || (ed ? '' : '<span class="ip-mut">ไม่มีรูป</span>')) + '</div>' + (ed && nPh < 3 ? '<label class="btn btn-secondary btn-sm" for="ipPhF" style="display:inline-flex;width:auto">' + ic('fa-image') + ' เพิ่มรูป</label><input type="file" id="ipPhF" accept="image/*" multiple hidden>' : '') +
        (o && o.status === 'ack' ? '<div class="ip-ref"><b>' + ic('fa-check') + ' นักศึกษารับทราบ ' + (o.ackAt ? formatDateTimeThai(o.ackAt) : '') + '</b>' + (o.reflection ? '<div>บันทึกสะท้อนคิด: ' + esc(o.reflection).replace(/\n/g, '<br>') + '</div>' : '') + '</div>' : '') +
        (!isNew ? '<p class="ip-mut">บันทึกโดย ' + esc(o.authorName) + (o.sentAt ? ' · ส่งให้นักศึกษา ' + formatDateTimeThai(o.sentAt) : '') + '</p>' : '') + '</div><div class="error-box" id="ipErr" hidden></div>';
    }
    function draw() {
      var a = ed ? (!isNew ? '<button type="button" class="btn btn-ghost" data-ip-odel style="color:var(--danger)">' + ic('fa-trash') + ' ลบ</button>' : '') + (!o || o.status === 'draft' ? '<button type="button" class="btn btn-secondary" data-ip-osave="0">บันทึกร่าง</button>' : '') + '<button type="button" class="btn btn-primary" data-ip-osave="1">' + (o && o.status !== 'draft' ? 'บันทึกการแก้ไข' : ic('fa-paper-plane') + ' ส่งให้นักศึกษา') + '</button>' : '';
      openModal('บันทึกการ' + KIND[kind] + ' · ' + esc(D.intern.name), form(), a, onClick);
      var f = document.getElementById('ipPhF'); if (f) f.addEventListener('change', function () { var room = 3 - ((o ? o.photos.length - dels.length : 0) + adds.length); Array.prototype.slice.call(f.files, 0, Math.max(0, room)).forEach(function (x) { adds.push(x); }); keep(); draw(); });
      var t = document.getElementById('ipTpl'); if (t) t.addEventListener('change', function () { keep(); tpl = D.tpls.filter(function (x) { return x.id === t.value; })[0] || tpl; draw(); });
    }
    var memo = null;
    function keep() { memo = { s: scores(), x: texts(), d: val('ipOD'), p: val('ipOP'), su: val('ipOS'), r: val('ipOR'), t: val('ipOT'), ob: val('ipOO') }; o = Object.assign({}, o || { photos: [], status: 'draft', kind: kind, tpl: tpl, authorId: D.me.id }, { scores: memo.s, texts: memo.x, date: memo.d, period: memo.p, subject: memo.su, room: memo.r, topic: memo.t, observer: memo.ob }); if (!o.id) o._new = true; }
    function val(id) { var e = document.getElementById(id); return e ? e.value : ''; }
    async function onClick(e) {
      var b;
      if ((b = e.target.closest('[data-ip-pt]')) && ed) { b.parentNode.querySelectorAll('button').forEach(function (x) { x.classList.toggle('on', x === b && !b.classList.contains('on')); }); return; }
      if ((b = e.target.closest('[data-ip-phrm]'))) { keep(); adds.splice(+b.getAttribute('data-ip-phrm'), 1); draw(); return; }
      if ((b = e.target.closest('[data-ip-phdel]'))) { keep(); dels.push(b.getAttribute('data-ip-phdel')); draw(); return; }
      if (e.target.closest('[data-ip-odel]')) { closeModal(); if (!(await askConfirm('ลบบันทึกนี้? รูปประกอบจะถูกย้ายลงถังขยะ', 'ลบบันทึก'))) return; act('internObsDelete', { id: o.id }, 'ลบแล้ว'); return; }
      if ((b = e.target.closest('[data-ip-osave]'))) {
        var send = b.getAttribute('data-ip-osave') === '1', p = { id: o && !o._new ? o.id : '', internId: D.intern.id, kind: kind, tplId: tpl.id, date: val('ipOD'), period: val('ipOP'), subject: val('ipOS'), room: val('ipOR'), topic: val('ipOT'), observer: val('ipOO'), scores: scores(), texts: texts(), send: send };
        if (send && !(o && o.status !== 'draft')) { var miss = (tpl.sections || []).reduce(function (n, s) { return n + (s.items || []).filter(function (i) { return !p.scores[i.id]; }).length; }, 0); if (miss && !(await askConfirm('ยังไม่ได้ให้คะแนน ' + miss + ' ข้อ — ส่งให้นักศึกษาเลยไหม?', 'ส่งบันทึก'))) return; }
        closeModal();
        var r = await withProgress(send ? 'กำลังส่งให้นักศึกษา' : 'กำลังบันทึก', async function (pg) {
          var res = await apiCall('internObsSave', p), id = res.id;
          for (var i = 0; i < dels.length; i++) await apiCall('internObsPhotoDelete', { obsId: id, photoId: dels[i] });
          for (var j = 0; j < adds.length; j++) {
            var jf = await shrink(adds[j]), from = 10 + Math.round(j / adds.length * 80), to = 10 + Math.round((j + 1) / adds.length * 80);
            var prep = await apiCall('internObsPhotoPrepare', { obsId: id, fileName: 'photo.jpg', mimeType: 'image/jpeg', fileSize: jf.size, direct: 1, origin: location.origin });
            var up = await sendPreparedFileProgress(prep, jf, pg, from, to, 'กำลังอัปโหลดรูป ' + (j + 1), { filename: prep.uploadFileName, mimeType: 'image/jpeg' });
            await apiCall('internObsPhotoFinalize', { obsId: id, pid: prep.pid, fileId: up.fileId, fileUrl: up.url });
          }
          return res;
        }, { successLabel: send ? 'ส่งให้นักศึกษาแล้ว' : 'บันทึกแล้ว', upload: adds.length > 0 });
        openIntern(st.id, true);
      }
    }
    draw();
  }

  // ชั่วโมงสอน
  async function renderHours() {
    var box = sb();
    if (!H) { box.innerHTML = '<div class="loading">กำลังดึงข้อมูลจากเว็บเช็คชื่อ...</div>'; try { H = await apiCall('internHours', { id: D.intern.id }); } catch (e) { box.innerHTML = err(e.message); return; } if (st.sub !== 'hours') return; box = sb(); }
    if (!H.linked) { box.innerHTML = '<p class="ip-mut">ยังไม่ได้เชื่อมกับเว็บเช็คชื่อ</p>'; return; }
    var reg = H.subjects.filter(function (s) { return !s.club; }), club = H.subjects.filter(function (s) { return s.club; }), nClub = club.reduce(function (a, s) { return a + s.n; }, 0);
    var mx = Math.max.apply(null, H.weeks.map(function (w) { return w.n; }).concat([1]));
    box.innerHTML = '<div class="ip-bar"><span class="ip-mut" style="flex:1">นับคาบที่นักศึกษาเป็นคนเช็คชื่อในเว็บเช็คชื่อ · ' + thD(H.from) + ' – ' + thD(H.until) + '</span><button type="button" class="btn btn-secondary btn-sm" data-ip-hxls>' + ic('fa-file-excel') + ' Excel</button></div>' +
      '<table class="ip-t"><thead><tr><th>วิชา</th><th>ห้อง</th><th>ครูประจำวิชา</th><th style="text-align:right">คาบ</th></tr></thead><tbody>' +
      (reg.map(function (s) { return '<tr><td>' + esc((s.code ? s.code + ' ' : '') + s.name) + '</td><td>' + esc(s.room) + '</td><td>' + esc(s.teacher) + '</td><td class="n">' + s.n + ' คาบ</td></tr>'; }).join('') + (nClub ? '<tr><td>ชุมนุม</td><td></td><td></td><td class="n">' + nClub + ' ครั้ง</td></tr>' : '') || '<tr><td colspan="4" class="ip-mut">ยังไม่มีคาบที่นักศึกษาเช็คชื่อ</td></tr>') +
      '</tbody><tfoot><tr><td colspan="3">รวม</td><td class="n">' + H.total + ' คาบ · ≈ ' + (H.total * 50 / 60).toFixed(1) + ' ชม.</td></tr></tfoot></table>' +
      (H.weeks.length ? '<div class="ip-mh" style="margin-top:14px">รายสัปดาห์</div><div class="ip-wk">' + H.weeks.map(function (w) { return '<div><i style="height:' + Math.round(w.n / mx * 100) + '%"><em>' + w.n + '</em></i>' + thD(w.monday, true).replace(/ \d+$/, '') + '</div>'; }).join('') + '</div>' : '') +
      '<p class="ip-mut" style="margin-top:8px">คิดชั่วโมง 1 คาบ = 50 นาที</p>';
  }

  // ---------- แม่แบบแบบฟอร์ม (แอดมิน) ----------
  var TE = null;
  function renderTpl() {
    if (!TE) TE = JSON.parse(JSON.stringify(B.tpls));
    body.innerHTML = '<div class="card"><div class="ip-bar"><h3>แม่แบบแบบฟอร์มสังเกตการสอน / นิเทศ</h3><button type="button" class="btn btn-secondary btn-sm" data-te-addtpl>' + ic('fa-plus') + ' เพิ่มแม่แบบ</button><button type="button" class="btn btn-primary" data-te-save>' + ic('fa-floppy-disk') + ' บันทึก</button></div>' +
      '<p class="ip-mut" style="margin-top:0">มีได้หลายแม่แบบ (เช่น แบบของแต่ละมหาวิทยาลัย) — แม่แบบแรก = ค่าเริ่มต้น · แก้แม่แบบแล้วบันทึกเก่ายังใช้หัวข้อเดิม (ไม่เพี้ยน)</p>' +
      TE.map(function (t, ti) {
        return '<div class="ip-te"><div class="ip-tr"><b>' + (ti + 1) + '.</b><input data-te="name" data-t="' + ti + '" value="' + esc(t.name) + '" placeholder="ชื่อแม่แบบ"><select data-te="scale" data-t="' + ti + '" style="width:auto">' + [3, 4, 5].map(function (n) { return '<option value="' + n + '"' + (t.scale === n ? ' selected' : '') + '>คะแนน 1–' + n + '</option>'; }).join('') + '</select>' +
          (ti ? '<button type="button" class="x" data-te-up="' + ti + '" title="ย้ายขึ้น (เป็นค่าเริ่มต้น)">' + ic('fa-arrow-up') + '</button>' : '') + '<button type="button" class="x" data-te-deltpl="' + ti + '" title="ลบแม่แบบ">' + ic('fa-trash') + '</button></div>' +
          t.sections.map(function (s, si) {
            return '<div class="ip-tr"><span class="ip-mut">ด้าน ' + (si + 1) + '</span><input data-te="sec" data-t="' + ti + '" data-s="' + si + '" value="' + esc(s.title) + '" placeholder="ชื่อด้าน">' + (si ? '<button type="button" class="x" data-te-sup="' + ti + ':' + si + '">' + ic('fa-arrow-up') + '</button>' : '') + '<button type="button" class="x" data-te-delsec="' + ti + ':' + si + '">' + ic('fa-trash') + '</button></div>' +
              s.items.map(function (i, ii) { return '<div class="ip-tr it">•<input data-te="item" data-t="' + ti + '" data-s="' + si + '" data-i="' + ii + '" value="' + esc(i.text) + '" placeholder="หัวข้อประเมิน"><button type="button" class="x" data-te-delitem="' + ti + ':' + si + ':' + ii + '">' + ic('fa-xmark') + '</button></div>'; }).join('') +
              '<div class="ip-tr it"><button type="button" class="btn btn-ghost btn-sm" data-te-additem="' + ti + ':' + si + '">+ เพิ่มข้อ</button></div>';
          }).join('') +
          '<div class="ip-tr"><button type="button" class="btn btn-ghost btn-sm" data-te-addsec="' + ti + '">+ เพิ่มด้าน</button></div><div class="ip-mh">ช่องข้อความ</div>' +
          t.texts.map(function (x, xi) { return '<div class="ip-tr it"><input data-te="text" data-t="' + ti + '" data-x="' + xi + '" value="' + esc(x.label) + '" placeholder="เช่น จุดเด่น"><button type="button" class="x" data-te-deltext="' + ti + ':' + xi + '">' + ic('fa-xmark') + '</button></div>'; }).join('') +
          '<div class="ip-tr it"><button type="button" class="btn btn-ghost btn-sm" data-te-addtext="' + ti + '">+ ช่องข้อความ</button></div></div>';
      }).join('') + '</div>';
  }
  function teInput(e) {
    var t = e.target, k = t.getAttribute('data-te'); if (!k) return; var T = TE[+t.getAttribute('data-t')];
    if (k === 'name') T.name = t.value; else if (k === 'scale') T.scale = +t.value; else if (k === 'sec') T.sections[+t.getAttribute('data-s')].title = t.value;
    else if (k === 'item') T.sections[+t.getAttribute('data-s')].items[+t.getAttribute('data-i')].text = t.value; else if (k === 'text') T.texts[+t.getAttribute('data-x')].label = t.value;
  }
  async function teClick(e) {
    var b, a;
    function p(attr) { return b.getAttribute(attr).split(':').map(Number); }
    if ((b = e.target.closest('[data-te-addtpl]'))) TE.push({ id: '', name: 'แม่แบบใหม่', scale: 5, sections: [{ id: '', title: 'ด้านที่ 1', items: [{ id: '', text: '' }] }], texts: [{ id: '', label: 'ข้อเสนอแนะ' }] });
    else if ((b = e.target.closest('[data-te-deltpl]'))) { if (TE.length < 2) { showToast('ต้องมีแม่แบบอย่างน้อย 1 แบบ', true); return; } if (!(await askConfirm('ลบแม่แบบ "' + TE[+b.getAttribute('data-te-deltpl')].name + '"? (บันทึกเก่าไม่กระทบ)', 'ลบแม่แบบ'))) return; TE.splice(+b.getAttribute('data-te-deltpl'), 1); }
    else if ((b = e.target.closest('[data-te-up]'))) { a = +b.getAttribute('data-te-up'); TE.splice(a - 1, 0, TE.splice(a, 1)[0]); }
    else if ((b = e.target.closest('[data-te-addsec]'))) TE[+b.getAttribute('data-te-addsec')].sections.push({ id: '', title: '', items: [{ id: '', text: '' }] });
    else if ((b = e.target.closest('[data-te-delsec]'))) { a = p('data-te-delsec'); TE[a[0]].sections.splice(a[1], 1); }
    else if ((b = e.target.closest('[data-te-sup]'))) { a = p('data-te-sup'); var S = TE[a[0]].sections; S.splice(a[1] - 1, 0, S.splice(a[1], 1)[0]); }
    else if ((b = e.target.closest('[data-te-additem]'))) { a = p('data-te-additem'); TE[a[0]].sections[a[1]].items.push({ id: '', text: '' }); }
    else if ((b = e.target.closest('[data-te-delitem]'))) { a = p('data-te-delitem'); TE[a[0]].sections[a[1]].items.splice(a[2], 1); }
    else if ((b = e.target.closest('[data-te-addtext]'))) TE[+b.getAttribute('data-te-addtext')].texts.push({ id: '', label: '' });
    else if ((b = e.target.closest('[data-te-deltext]'))) { a = p('data-te-deltext'); TE[a[0]].texts.splice(a[1], 1); }
    else if ((b = e.target.closest('[data-te-save]'))) { try { var r = await apiCall('internTplSave', { list: TE }); B.tpls = r.list; TE = null; showToast('บันทึกแม่แบบแล้ว'); } catch (x) { showToast(x.message, true); return; } }
    else return;
    renderTpl();
  }

  // ---------- รายงาน PDF ----------
  async function pdfReport() {
    var I = D.intern, L = (D.obs || []).filter(function (o) { return o.status !== 'draft'; }).slice().sort(function (a, b) { return a.kind.localeCompare(b.kind) || a.date.localeCompare(b.date); });
    var r = await withProgress('กำลังสร้างรายงาน', async function () {
      await loadScriptOnce('assets/html2canvas.min.js'); await loadScriptOnce('assets/jspdf.umd.min.js');
      var W = 794, Hh = 1123, font = getComputedStyle(document.body).fontFamily, pages = [];
      var css = 'position:fixed;left:-20000px;top:0;width:' + W + 'px;min-height:' + Hh + 'px;background:#fff;color:#0f172a;padding:48px 52px;box-sizing:border-box;font-size:13.5px;line-height:1.55;font-family:' + font;
      var tb = 'width:100%;border-collapse:collapse;font-size:12.5px', td = 'border:1px solid #94a3b8;padding:4px 6px;vertical-align:top', th = td + ';font-size:12.5px;font-weight:700;letter-spacing:0;text-transform:none;color:#0f172a;font-family:inherit;text-align:left;background:#eef2f6';
      function pg(html) { var p = document.createElement('div'); p.style.cssText = css; p.innerHTML = html; document.body.appendChild(p); pages.push(p); }
      var cnt = { obs: L.filter(function (o) { return o.kind === 'obs'; }).length, sup: L.filter(function (o) { return o.kind === 'sup'; }).length };
      var hrs = H; if (!hrs) { try { hrs = await apiCall('internHours', { id: I.id }); } catch (e) { hrs = null; } }
      pg('<div style="text-align:center;font-weight:800;font-size:19px">รายงานการฝึกประสบการณ์วิชาชีพครู</div><div style="text-align:center;color:#334155;margin-bottom:14px">' + esc(I.name) + ' · ' + esc([I.uni, I.major].filter(Boolean).join(' · ')) + '</div>' +
        '<table style="' + tb + '"><tr><td style="' + td + ';width:32%">ช่วงฝึกสอน</td><td style="' + td + '">' + thD(I.from) + ' – ' + thD(I.until) + '</td></tr><tr><td style="' + td + '">ครูพี่เลี้ยงหลัก</td><td style="' + td + '">' + esc(I.mentor.name) + '</td></tr><tr><td style="' + td + '">ครูพี่เลี้ยงร่วม</td><td style="' + td + '">' + (I.co.map(function (c) { return esc(c.name); }).join(', ') || '-') + '</td></tr>' +
        '<tr><td style="' + td + '">งานที่มอบหมาย</td><td style="' + td + '">' + D.tasks.length + ' งาน (ผ่าน ' + D.tasks.filter(function (t) { return t.status === 'pass'; }).length + ')</td></tr><tr><td style="' + td + '">บันทึกการสังเกตการสอน / นิเทศ</td><td style="' + td + '">' + cnt.obs + ' / ' + cnt.sup + ' ครั้ง</td></tr>' +
        (hrs && hrs.linked ? '<tr><td style="' + td + '">ชั่วโมงสอน (คาบที่เช็คชื่อ)</td><td style="' + td + '">' + hrs.total + ' คาบ ≈ ' + (hrs.total * 50 / 60).toFixed(1) + ' ชม.</td></tr>' : '') + '</table>' +
        (L.length ? '<div style="font-weight:800;margin:14px 0 6px">สรุปผลรายครั้ง</div><table style="' + tb + '"><tr style="background:#eef2f6"><th style="' + th + '">ครั้ง</th><th style="' + th + '">ประเภท</th><th style="' + th + '">วันที่</th><th style="' + th + '">วิชา / เรื่อง</th><th style="' + th + '">ผู้สังเกต/นิเทศ</th><th style="' + th + '">เฉลี่ย</th></tr>' +
          L.map(function (o, i) { return '<tr><td style="' + td + ';text-align:center">' + (i + 1) + '</td><td style="' + td + '">' + KIND[o.kind] + '</td><td style="' + td + ';white-space:nowrap">' + thD(o.date, true) + '</td><td style="' + td + '">' + esc([o.subject, o.room, o.topic].filter(Boolean).join(' · ')) + '</td><td style="' + td + '">' + esc(o.kind === 'sup' && o.observer ? o.observer : o.authorName) + '</td><td style="' + td + ';text-align:center;font-weight:700">' + (o.avg != null ? o.avg.toFixed(1) : '-') + '</td></tr>'; }).join('') + '</table>' : ''));
      L.forEach(function (o, i) {
        var t = o.tpl || {};
        pg('<div style="font-weight:800;font-size:16px">' + (i + 1) + '. บันทึกการ' + KIND[o.kind] + ' — ' + thD(o.date) + (o.period ? ' คาบ ' + esc(o.period) : '') + '</div><div style="color:#334155;margin-bottom:8px">' + esc([o.subject, o.room, o.topic ? 'เรื่อง ' + o.topic : ''].filter(Boolean).join(' · ')) + ' · ' + (o.kind === 'sup' && o.observer ? 'ผู้นิเทศ ' + esc(o.observer) : 'โดย ' + esc(o.authorName)) + '</div>' +
          '<table style="' + tb + '"><tr style="background:#eef2f6"><th style="' + th + '">รายการประเมิน</th><th style="' + th + ';width:70px">คะแนน (1–' + (t.scale || 5) + ')</th></tr>' + (t.sections || []).map(function (s) { return '<tr><td colspan="2" style="' + td + ';font-weight:700;background:#f8fafc">' + esc(s.title) + '</td></tr>' + (s.items || []).map(function (q) { return '<tr><td style="' + td + '">' + esc(q.text) + '</td><td style="' + td + ';text-align:center">' + (o.scores[q.id] || '-') + '</td></tr>'; }).join(''); }).join('') + '</table>' +
          (t.texts || []).filter(function (x) { return o.texts[x.id]; }).map(function (x) { return '<div style="font-weight:700;margin-top:8px">' + esc(x.label) + '</div><div>' + esc(o.texts[x.id]).replace(/\n/g, '<br>') + '</div>'; }).join('') +
          (o.reflection ? '<div style="font-weight:700;margin-top:8px">บันทึกสะท้อนคิดของนักศึกษา</div><div>' + esc(o.reflection).replace(/\n/g, '<br>') + '</div>' : '') +
          (o.photos.length ? '<div style="color:#64748b;margin-top:8px;font-size:12px">รูปประกอบ ' + o.photos.length + ' รูป (ดูในเว็บ)</div>' : '') +
          '<div style="margin-top:40px;text-align:right">ลงชื่อ ........................................ ' + (o.kind === 'sup' ? 'ผู้นิเทศ' : 'ผู้สังเกต') + '<br>( ' + esc(o.kind === 'sup' && o.observer ? o.observer : o.authorName) + ' )</div>');
      });
      try {
        var pdf = new window.jspdf.jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
        for (var i = 0; i < pages.length; i++) {
          var c = await window.html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true });
          var h = Math.min(297, c.height / c.width * 210); if (i) pdf.addPage(); pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, h);
        }
        pdf.save('รายงานนักศึกษาฝึกสอน_' + I.name + '.pdf');
      } finally { pages.forEach(function (p) { p.remove(); }); }
      return true;
    }, { successLabel: 'ดาวน์โหลดรายงานแล้ว' });
    return r;
  }

  // ---------- เหตุการณ์ ----------
  body.addEventListener('input', teInput);
  // 2.12.1: กด Back ตอนดูรายคน = กลับรายชื่อ
  if (window.BackNav) BackNav.sub(function () { return !!st.id && !!body.querySelector('[data-ip-back]'); }, function () { var b = body.querySelector('[data-ip-back]'); if (b) b.click(); });
  body.addEventListener('click', function (e) {
    var b;
    if (st.tab === 'tpl') { teClick(e); return; }
    if ((b = e.target.closest('[data-ip-open]'))) { openIntern(b.getAttribute('data-ip-open')); return; }
    if (e.target.closest('[data-ip-back]')) { st.id = ''; D = null; try { history.replaceState(null, '', location.pathname); } catch (x) { /* ข้าม */ } boot(); return; }
    if ((b = e.target.closest('[data-ip-sub]'))) { st.sub = b.getAttribute('data-ip-sub'); renderDetail(); return; }
    if (e.target.closest('[data-ip-pdf]')) { pdfReport(); return; }
    if ((b = e.target.closest('[data-ip-corm]'))) { var id = b.getAttribute('data-ip-corm'); act('internSetInfo', { id: D.intern.id, co: D.intern.co.map(function (c) { return c.id; }).filter(function (x) { return x !== id; }) }, 'เอาออกแล้ว'); return; }
    if (e.target.closest('[data-ip-coadd]')) { var v = document.getElementById('ipCoSel').value; if (!v) return; act('internSetInfo', { id: D.intern.id, co: D.intern.co.map(function (c) { return c.id; }).concat([v]) }, 'เพิ่มครูพี่เลี้ยงร่วมแล้ว'); return; }
    if (e.target.closest('[data-ip-infosave]')) { act('internSetInfo', { id: D.intern.id, from: document.getElementById('ipFrom').value, until: document.getElementById('ipUntil').value, uni: document.getElementById('ipUni').value, major: document.getElementById('ipMajor').value }); return; }
    if (e.target.closest('[data-ip-tnew]')) { openTaskForm(null); return; }
    if ((b = e.target.closest('[data-ip-task]'))) { openTask(b.getAttribute('data-ip-task')); return; }
    if (e.target.closest('[data-ip-onew]')) { openObs(null, st.sub); return; }
    if ((b = e.target.closest('[data-ip-obs]'))) { openObs(D.obs.filter(function (o) { return o.id === b.getAttribute('data-ip-obs'); })[0]); return; }
    if (e.target.closest('[data-ip-hxls]') && H) { downloadBlob(buildXlsx('ชั่วโมงสอน', ['รหัสวิชา', 'วิชา', 'ห้อง', 'ครูประจำวิชา', 'จำนวนคาบ'], H.subjects.map(function (s) { return [s.code, s.club ? 'ชุมนุม ' + s.name : s.name, s.room, s.teacher, s.n]; }).concat([['', 'รวม', '', '', H.total]]), [12, 34, 10, 26, 12], 'ชั่วโมงสอน ' + D.intern.name), 'ชั่วโมงสอน_' + D.intern.name + '.xlsx'); }
  });
  body.addEventListener('change', function (e) {
    var t = e.target;
    if (t.id === 'ipFlt') { st.flt = t.value; renderList(); return; }
    if (t.id === 'ipNav') { apiCall('internNavSave', { mode: t.value }).then(function () { B.nav = t.value; showToast('บันทึกแล้ว — มีผลเมื่อเปิดหน้าใหม่'); }, function (x) { showToast(x.message, true); }); return; }
    if (!D) return;
    if (t.id === 'ipShow') { act('internConfig', { internId: D.intern.id, showScore: t.checked }, t.checked ? 'นักศึกษาเห็นคะแนนแล้ว' : 'ซ่อนคะแนนจากนักศึกษาแล้ว'); return; }
    if (t.hasAttribute('data-ip-perm')) { var pm = {}; pm[t.getAttribute('data-ip-perm')] = t.checked; act('internConfig', { internId: D.intern.id, perm: pm }); return; }
    if (t.hasAttribute('data-ip-subj')) { var m = t.getAttribute('data-m'), ids = Array.prototype.map.call(document.querySelectorAll('[data-ip-subj][data-m="' + m + '"]:checked'), function (x) { return x.getAttribute('data-ip-subj'); }); act('internConfig', { internId: D.intern.id, subs: ids, forMentor: m }, t.checked ? 'เพิ่มเป็นครูสอนร่วมแล้ว' : 'ถอดออกจากวิชานี้แล้ว'); return; }
    if (t.hasAttribute('data-ip-club')) { act('internConfig', { internId: D.intern.id, club: t.checked, forMentor: t.getAttribute('data-ip-club') }); }
  });
  boot();
})();
