/* ย้ายมาจากสคริปต์ในหน้า guidance-form.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
  try { mountFooter({ compact: true }); } catch (e) { /* ข้าม */ } // 2.12.3: footer แบบย่อ (เหมือนหน้าล็อกอิน)
  /* หน้านักเรียน: เลือกห้อง → ชื่อ (พิมพ์แล้วขึ้นชื่อใกล้เคียง) → (รหัสนักเรียน ถ้าเปิด) → กรอก/แก้ข้อมูลของตัวเอง
     2.12.0: สถานะ 3 แบบ · สถาบันแยก มหาวิทยาลัย/สถาบัน กับ สายอาชีพ · เลือกยืนยันสิทธิ์ หรือ รอผล · ส่งแล้วเห็นเป็นการ์ดโปรไฟล์ (แก้ไขได้จนครูตรวจ)
     ชื่อมหาวิทยาลัย/คณะ/สาขา: แนะนำจากข้อมูลที่ผ่านการตรวจของรุ่นก่อน ๆ (พิมพ์เองได้เสมอ) */
  (function () {
    var main = document.getElementById('gfMain'), esc = function (s) { return escapeHtml(s == null ? '' : String(s)); };
    var B = null, room = '', names = null, q = '', pick = null, code = '', T = null, me = null, F = null, ed = null, edI = -1;
    var ST = [['study', 'ศึกษาต่อ', 'graduation-cap'], ['work', 'ไม่ศึกษาต่อ /<br>ทำงาน', 'briefcase'], ['other', 'อื่น ๆ', 'pen']]; // 2.12.0: "รอผล" ย้ายไปอยู่ขั้นยืนยันสิทธิ์
    var WHY = ['ทำงาน', 'ช่วยงานที่บ้าน', 'ปัญหาค่าใช้จ่าย', 'รอสมัครปีหน้า', 'เข้ารับราชการทหาร/ตำรวจ', 'อื่น ๆ']; // 2.11.1: เหตุผลที่ไม่ศึกษาต่อ (แตะเลือกเร็ว)
    var RD = [['1', 'รอบ 1 Portfolio'], ['2', 'รอบ 2 Quota'], ['3', 'รอบ 3 Admission'], ['4', 'รอบ 4 Direct'], ['other', 'รับตรง/อื่น ๆ']];
    var RDV = [['vq', 'รอบโควตา'], ['vg', 'รอบทั่วไป'], ['vo', 'รับตรง/อื่น ๆ']]; // 2.12.0: สายอาชีพ
    var norm = function (s) { return String(s || '').replace(/\s+/g, '').toLowerCase(); };
    function err(m) { var e = document.getElementById('gfErr'); if (e) e.textContent = m || ''; else if (m) showToast(m, true); }
    async function start() {
      try { B = await apiCall('publicGuideBoot', {}); } catch (e) { main.innerHTML = '<div class="gf-card gf-center"><p>' + esc(e.message) + '</p><button class="gf-btn" data-reload>ลองใหม่</button></div>'; return; }
      document.getElementById('gfSub').textContent = 'โรงเรียนบุ่งคล้านคร · ปีการศึกษา ' + B.year;
      if (!B.open) { main.innerHTML = '<div class="gf-card gf-center"><i class="fa-solid fa-lock"></i><p><b>' + (B.on ? 'ยังไม่อยู่ในช่วงเปิดรับข้อมูล' : 'ปิดรับข้อมูลชั่วคราว') + '</b></p>' + (B.on && (B.from || B.to) ? '<p class="gf-mut">เปิดรับ ' + esc(B.from || '') + ' – ' + esc(B.to || '') + '</p>' : '<p class="gf-mut">ติดต่อครูแนะแนว</p>') + '</div>'; return; }
      renderPick();
    }
    // ---------- เลือกตัวเอง ----------
    function renderPick() {
      main.innerHTML = '<div class="gf-card"><div class="gf-step"><i>1</i>เลือกห้อง</div><select id="gfRoom"><option value="">— เลือกห้อง —</option>' + B.rooms.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === room ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select>' +
        '<div class="gf-step"><i>2</i>พิมพ์ชื่อของตัวเอง</div><div id="gfName"></div>' +
        (B.verifyCode ? '<div class="gf-step"><i>3</i>รหัสนักเรียน</div><input id="gfCode" inputmode="numeric" autocomplete="off" maxlength="10" placeholder="เลขประจำตัวนักเรียน" value="' + esc(code) + '">' : '') +
        '<button class="gf-btn" id="gfGo" disabled>ถัดไป</button><div class="gf-err" id="gfErr"></div></div>';
      paintName(); paintGo();
    }
    function paintName() {
      var b = document.getElementById('gfName'); if (!b) return;
      if (!room) { b.innerHTML = '<input disabled placeholder="เลือกห้องก่อน">'; return; }
      if (!names) { b.innerHTML = '<p class="gf-mut">กำลังโหลดรายชื่อ…</p>'; return; }
      if (pick) { b.innerHTML = '<div class="gf-sel"><span>✓ ' + esc(pick.name) + '</span><button type="button" id="gfUnpick">เปลี่ยน</button></div>'; return; }
      var a = document.activeElement && document.activeElement.id === 'gfQ';
      b.innerHTML = '<input id="gfQ" autocomplete="off" placeholder="พิมพ์ชื่อ (ไม่ต้องใส่คำนำหน้า)" value="' + esc(q) + '"><div class="gf-sg" id="gfNs"></div><p class="gf-mut" style="margin:4px 0 0">พิมพ์อย่างน้อย 2 ตัวอักษร แล้วแตะชื่อของตัวเอง</p>';
      paintNs(); if (a) { var i = document.getElementById('gfQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }
    }
    function paintNs() {
      var b = document.getElementById('gfNs'); if (!b) return; var k = norm(q);
      if (k.length < 2) { b.innerHTML = ''; return; }
      var L = names.filter(function (s) { return norm(s.name).replace(/^(นาย|นางสาว|นาง|เด็กชาย|เด็กหญิง|ด\.ช\.|ด\.ญ\.|น\.ส\.)/, '').indexOf(k) !== -1 || norm(s.name).indexOf(k) !== -1; }).slice(0, 6);
      b.innerHTML = L.length ? L.map(function (s) { return '<button type="button" data-nm="' + esc(s.id) + '">' + esc(s.name) + ' <span class="gf-mut">เลขที่ ' + esc(s.no) + '</span></button>'; }).join('') : '<p class="gf-mut" style="padding:8px 12px;margin:0">ไม่พบชื่อในห้องนี้ — ตรวจสอบห้องหรือการสะกด</p>';
    }
    function paintGo() { var g = document.getElementById('gfGo'); if (g) g.disabled = !pick || (B.verifyCode && !code.trim()); }
    async function loadRoom() { names = null; pick = null; paintName(); paintGo(); try { var d = await apiCall('publicGuideRoom', { roomId: room }); names = d.names; } catch (e) { err(e.message); } paintName(); }
    async function login() {
      var g = document.getElementById('gfGo'); g.disabled = true; g.textContent = 'กำลังตรวจสอบ…'; err('');
      try { var d = await apiCall('publicGuideLogin', { roomId: room, studentId: pick.id, code: code }); T = d.ticket; me = d.student; setForm(d.mine); show(); window.scrollTo(0, 0); }
      catch (e) { err(e.message); g.disabled = false; g.textContent = 'ถัดไป'; }
    }
    // ---------- ฟอร์ม / การ์ด (2.12.0) ----------
    // F.choice: ตำแหน่งของที่ยืนยันสิทธิ์ (ตัวเลข) · 'wait' = รอผล · '' = ยังไม่เลือก · mode: card = การ์ดโปรไฟล์ (ส่งแล้ว) / form = กรอก/แก้ไข
    var mode = 'form', LAST = null;
    // 2.12.1: กด Back = แก้ไขอยู่ → กลับการ์ด · การ์ด/ฟอร์ม → กลับหน้าเลือกชื่อ (มีที่ยังไม่บันทึก = ถามก่อน) · ปิดแท็บ/รีเฟรช = เบราว์เซอร์ถาม
    var SNAP = '';
    function snap() { SNAP = JSON.stringify(F || null); }
    function changed() { if (!me || mode !== 'form' || !F) return false; sync(); return !!ed || JSON.stringify(F) !== SNAP; }
    function confirmIf(fn) { if (!changed()) { fn(); return; } askConfirm('ข้อมูลที่กรอกยังไม่ได้บันทึก ออกจากหน้านี้เลยไหม?', 'ยังไม่ได้บันทึก').then(function (ok) { if (ok) fn(); }); }
    if (window.BackNav) {
      BackNav.sub(function () { return !!me; }, function () { confirmIf(function () { T = null; me = null; pick = null; code = ''; renderPick(); window.scrollTo(0, 0); }); });
      BackNav.sub(function () { return !!me && mode === 'form' && !!F && !!F.saved; }, function () { confirmIf(function () { setForm(LAST); show(); window.scrollTo(0, 0); }); });
      BackNav.dirty(changed);
    }
    function kindOf(e) { return e && (e.kind === 'v' || /^v/.test(e.round || '')) ? 'v' : 'u'; }
    function rdLabel(e) { var L = kindOf(e) === 'v' ? RDV : RD; return (L.filter(function (r) { return r[0] === e.round; })[0] || [0, ''])[1]; }
    function tagOf(e) { return kindOf(e) === 'v' ? '<span class="gf-tg v">สายอาชีพ</span>' : '<span class="gf-tg u">มหาวิทยาลัย</span>'; }
    function subOf(e) { return [e.faculty, e.major, rdLabel(e)].filter(Boolean).map(esc).join(' · '); }
    function setForm(m) {
      LAST = m;
      F = m ? { status: m.status === 'wait' ? 'study' : m.status, statusNote: m.statusNote || '', consent: !!m.consent, entries: (m.entries || []).map(function (e) { return { kind: kindOf(e), university: e.university, faculty: e.faculty, major: e.major, round: e.round, confirmed: e.confirmed }; }), photo: m.photo, ps: m.photoSt || {}, review: m.review, reviewNote: m.reviewNote, reviewedAt: m.reviewedAt || '', saved: true } : { status: '', statusNote: '', consent: false, entries: [], photo: null, ps: {}, review: '', saved: false };
      var ci = -1; F.entries.forEach(function (e, i) { if (e.confirmed) ci = i; });
      F.choice = F.status === 'study' ? (ci !== -1 ? ci : (F.saved ? 'wait' : '')) : '';
      ed = null; edI = -1; mode = F.saved && F.status ? 'card' : 'form'; snap();
    }
    // 2.12.7: รูปที่ส่งแล้วเปลี่ยนเองไม่ได้ — ขอเปลี่ยน → ครูอนุมัติ · ครูลบรูป = ให้อัปใหม่
    function phCtl() {
      var ps = F.ps || {};
      if (!F.photo) return (ps.rej ? '<p class="gf-phn bad"><i class="fa-solid fa-triangle-exclamation"></i> ครูแนะแนวลบรูปเดิม (ไม่ผ่าน) — กรุณาอัปรูปใหม่</p>' : '') + '<button type="button" class="gf-btn gh sm" data-gf-ph>' + (ps.rej ? 'อัปรูปใหม่' : 'เลือกรูป') + '</button>';
      if (ps.unlock) return '<p class="gf-phn ok"><i class="fa-solid fa-circle-check"></i> ครูอนุมัติให้เปลี่ยนรูปแล้ว</p><button type="button" class="gf-btn gh sm" data-gf-ph>เปลี่ยนรูป</button>';
      if (ps.req) return '<p class="gf-phn"><i class="fa-solid fa-hourglass-half"></i> ขอเปลี่ยนรูปแล้ว — รอครูแนะแนวอนุมัติ</p><button type="button" class="gf-lnk" data-gf-phreq="cancel">ยกเลิกคำขอ</button>';
      return '<button type="button" class="gf-btn gh sm" data-gf-phreq="req"><i class="fa-solid fa-hand"></i> ขอเปลี่ยนรูป</button>';
    }
    function waitRes() { return F.status === 'study' && !F.entries.some(function (e) { return e.confirmed; }); } // 2.12.7: รอผล = อัปเดตผลได้แม้ครูตรวจแล้ว
    function locked() { return !!(B.review && F.review === 'ok' && F.reviewedAt) && !waitRes(); }
    function thD(iso) { var d = new Date(iso); if (!iso || isNaN(d)) return ''; return d.getDate() + ' ' + ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'][d.getMonth()] + ' ' + (d.getFullYear() + 543); }
    function show() { if (mode === 'card') renderCard(); else renderForm(); }
    function who() { return '<div class="gf-sel" style="margin-bottom:10px"><span>' + esc(me.name) + ' · ' + esc(me.room) + ' เลขที่ ' + esc(me.no) + '</span><button type="button" id="gfOut">ไม่ใช่ฉัน</button></div>'; }
    function renderCard() {
      var st = F.status, cf = typeof F.choice === 'number' ? F.entries[F.choice] : null, wait = st === 'study' && !cf, lk = locked();
      var top = st === 'study' ? (cf ? ['', '<i class="fa-solid fa-circle-check"></i> ยืนยันสิทธิ์แล้ว'] : ['w', '<i class="fa-solid fa-hourglass-half"></i> รอผล']) : ['o', st === 'work' ? '<i class="fa-solid fa-briefcase"></i> ไม่ศึกษาต่อ / ทำงาน' : '<i class="fa-solid fa-pen"></i> อื่น ๆ'];
      var mainBox = cf ? '<div class="pc-main"><div class="k"><i class="fa-solid fa-circle-check"></i> ยืนยันสิทธิ์และเลือกเรียนที่นี่</div><b>' + tagOf(cf) + ' ' + esc(cf.university) + '</b><small>' + subOf(cf) + '</small></div>'
        : wait ? '<div class="pc-main w"><div class="k">รอผล — ยังไม่ได้ยืนยันสิทธิ์</div><b>มีสิทธิ์เข้าศึกษาต่อ ' + F.entries.length + ' แห่ง</b>' + (lk ? '' : '<small>ผลออกแล้วกด "แก้ไขข้อมูล" เพื่อเลือกที่ยืนยันสิทธิ์</small>') + '</div>'
        : '<div class="pc-main o"><div class="k">' + (st === 'work' ? 'เหตุผล / สิ่งที่ทำ' : 'รายละเอียด') + '</div><b>' + esc(F.statusNote || '-') + '</b></div>';
      var oth = F.entries.filter(function (e) { return e !== cf; });
      var stLine = F.review === 'pending' ? '<div class="pc-st wait"><i class="fa-solid fa-hourglass-half"></i> ส่งแล้ว — รอครูตรวจ</div>' : F.review === 'back' ? '<div class="pc-st back"><span><b><i class="fa-solid fa-reply"></i> ครูส่งกลับให้แก้:</b> ' + esc(F.reviewNote || '') + '</span></div>' : F.review === 'ok' && F.reviewedAt ? '<div class="pc-st ok"><i class="fa-solid fa-circle-check"></i> ครูตรวจแล้ว' + (thD(F.reviewedAt) ? ' · ' + thD(F.reviewedAt) : '') + '</div>' : '<div class="pc-st ok"><i class="fa-solid fa-circle-check"></i> บันทึกแล้ว</div>';
      main.innerHTML = '<div class="pc"><div class="pc-top ' + top[0] + '"><span class="bd">' + top[1] + '</span></div>' +
        (F.photo ? '<img class="pc-av" src="' + esc(F.photo.src.replace('sz=w400', 'sz=w600')) + '" alt="" referrerpolicy="no-referrer">' : '<span class="pc-av no"><i class="fa-solid fa-user-graduate"></i></span>') +
        '<div class="pc-b"><h2>' + esc(me.name) + '</h2><div class="rm">' + esc(me.room) + ' เลขที่ ' + esc(me.no) + '</div>' + mainBox +
        (oth.length ? '<div class="pc-oth"><div class="k">' + (cf ? 'สถาบันอื่นที่มีสิทธิ์เข้าศึกษาต่อ' : 'สถาบันที่มีสิทธิ์เข้าศึกษาต่อ') + '</div>' + oth.map(function (e) { return '<div>' + tagOf(e) + ' ' + esc(e.university) + '<br><small>' + subOf(e) + '</small></div>'; }).join('') + '</div>' : '') +
        '<div class="pc-phc">' + phCtl() + '</div>' + stLine + '<button type="button" class="pc-ed" id="gfEdit"' + (lk ? ' disabled' : '') + '>' + (lk ? '<i class="fa-solid fa-lock"></i> แก้ไขไม่ได้ — ครูตรวจแล้ว' : B.review && F.review === 'ok' && F.reviewedAt ? '<i class="fa-solid fa-arrows-rotate"></i> อัปเดตผล — เพิ่มสถาบัน / ยืนยันสิทธิ์' : '<i class="fa-solid fa-pen-to-square"></i> แก้ไขข้อมูล') + '</button>' +
        '<div class="pc-note">' + (lk ? 'ถ้าต้องแก้ไข ติดต่อครูแนะแนว' : B.review && F.review === 'ok' && F.reviewedAt ? 'สอบติด / ตัดสินใจเลือกที่เรียนแล้ว อัปเดตได้เลย — ครูจะตรวจอีกครั้ง' : B.review ? 'แก้ได้จนกว่าครูจะตรวจ' : 'แก้ได้ตลอดช่วงที่เปิดรับข้อมูล') + '</div>' +
        '<div class="pc-note">' + (F.consent ? '<i class="fa-solid fa-check"></i> ยินยอมให้โรงเรียนเผยแพร่ชื่อและรูป' : 'ไม่ยินยอมเผยแพร่') + ' · <button type="button" class="gf-lnk" id="gfOut">ไม่ใช่ฉัน</button></div></div></div>';
    }
    function banner() {
      if (F.review === 'back') return '<div class="gf-ban back"><i class="fa-solid fa-rotate-left"></i> <b>ครูส่งกลับให้แก้:</b> ' + esc(F.reviewNote || '') + '</div>';
      if (F.review === 'pending') return '<div class="gf-ban wait"><i class="fa-solid fa-hourglass-half"></i> ส่งแล้ว — รอครูตรวจ (แก้ไขได้)</div>';
      return '';
    }
    function renderForm() {
      var n = 1, step = function (t, req) { return '<div class="gf-step"><i>' + (n++) + '</i> ' + t + (req ? ' <span style="color:#dc2626">*</span>' : '') + '</div>'; };
      var h = '<div class="gf-card">' + who() + banner() + step('สถานะ') + '<div class="gf-st">' + ST.map(function (s) { return '<button type="button" data-st="' + s[0] + '" class="' + (F.status === s[0] ? 'on' : '') + '"><i class="fa-solid fa-' + s[2] + '"></i><span>' + s[1] + '</span></button>'; }).join('') + '</div>';
      if (F.status === 'work' || F.status === 'other') h += step(F.status === 'work' ? 'เหตุผล / สิ่งที่ทำ' : 'รายละเอียด', true) + (F.status === 'work' ? '<div class="gf-chips gf-why">' + WHY.map(function (w) { return '<button type="button" data-why="' + esc(w) + '">' + esc(w) + '</button>'; }).join('') + '</div>' : '') +
        '<input id="gfNote" style="margin-top:8px" maxlength="200" placeholder="' + (F.status === 'work' ? 'แตะเลือกด้านบน หรือพิมพ์เอง เช่น ทำงานที่…' : 'เช่น …') + '" value="' + esc(F.statusNote) + '">';
      if (F.status === 'study') h += step('สถาบันที่สมัคร / สอบติด') + '<p class="gf-mut" style="margin:-2px 0 4px">เพิ่มได้หลายแห่ง (มหาวิทยาลัย / สถาบัน · สายอาชีพ)</p><div id="gfEnts"></div>' + step('ยืนยันสิทธิ์', true) + '<div id="gfChoice"></div>';
      h += step('รูปนักเรียน (1 รูป)') + '<div class="gf-ph">' + (F.photo ? '<img src="' + esc(F.photo.src) + '" alt="" referrerpolicy="no-referrer">' : '<span class="no"><i class="fa-solid fa-user"></i></span>') + '<div><p class="gf-mut" style="margin:0 0 6px">รูปหน้าตรง / ชุดนักเรียน' + (F.photo ? '' : ' · ส่งแล้วเปลี่ยนเองไม่ได้ (ขอครูเปลี่ยนได้)') + '</p>' + phCtl() + '</div></div>' +
        '<label class="gf-ck"><input type="checkbox" id="gfCon"' + (F.consent ? ' checked' : '') + '> <span>ยินยอมให้โรงเรียนเผยแพร่ชื่อและรูปเพื่อแสดงความยินดี</span></label>' +
        '<button class="gf-btn" id="gfSave">บันทึก</button>' + (F.saved ? '<button class="gf-btn gh" id="gfCancel">ยกเลิกการแก้ไข</button>' : '') + '<div class="gf-err" id="gfErr"></div></div>';
      main.innerHTML = h;
      paintEnts();
    }
    function sugs(field) {
      var S = B.suggest || {};
      if (field === 'university') return Object.keys(S);
      var u = ed && S[ed.university] || {};
      if (field === 'faculty') return Object.keys(u);
      return (ed && u[ed.faculty]) || [];
    }
    function paintEnts() {
      var b = document.getElementById('gfEnts'); if (!b) return;
      b.innerHTML = F.entries.map(function (e, i) {
        if (i === edI) return edHtml();
        return '<div class="gf-ent"><b>' + tagOf(e) + ' ' + esc(e.university) + '</b><small>' + subOf(e) + '</small><div class="row"><span style="flex:1"></span><button type="button" class="gf-lnk" data-ed="' + i + '">แก้ไข</button><button type="button" class="gf-lnk red" data-del="' + i + '">ลบ</button></div></div>';
      }).join('') + (edI === F.entries.length ? edHtml() : '') + (edI === -1 && F.entries.length < 12 ? '<button type="button" class="gf-add" id="gfAdd">＋ เพิ่มสถาบัน</button>' : '');
      paintChoice();
    }
    function paintChoice() {
      var b = document.getElementById('gfChoice'); if (!b) return;
      if (!F.entries.length) { b.innerHTML = '<p class="gf-mut" style="margin:0">เพิ่มสถาบันก่อน แล้วเลือกที่ยืนยันสิทธิ์ หรือ "รอผล"</p>'; return; }
      b.innerHTML = '<p class="gf-mut" style="margin:0 0 4px">เลือกที่ที่ยืนยันสิทธิ์และจะเรียนจริง (1 แห่ง) — ถ้าผลยังไม่ออกเลือก "รอผล" แล้วกลับมาแก้ภายหลัง</p>' +
        F.entries.map(function (e, i) { var on = F.choice === i; return '<button type="button" class="gf-rd' + (on ? ' on' : '') + '" data-ch="' + i + '"><span class="o"></span><span><b>' + esc(e.university) + '</b><small>' + tagOf(e) + subOf(e) + '</small>' + (on ? '<em><i class="fa-solid fa-circle-check"></i> ยืนยันสิทธิ์และเลือกเรียนที่นี่</em>' : '') + '</span></button>'; }).join('') +
        '<button type="button" class="gf-rd w' + (F.choice === 'wait' ? ' on' : '') + '" data-ch="wait"><span class="o"></span><span><b><i class="fa-solid fa-hourglass-half"></i> รอผล</b><small>ผลยังไม่ออก / ยังไม่ได้ยืนยันสิทธิ์ที่ไหน — กลับมาเลือกภายหลังได้</small></span></button>';
    }
    function edHtml() {
      var v = ed.kind === 'v', R = v ? RDV : RD;
      return '<div class="gf-ed"><label>ประเภทสถาบัน</label><div class="gf-kd"><button type="button" data-kd="u" class="' + (v ? '' : 'on') + '"><i class="fa-solid fa-building-columns"></i>มหาวิทยาลัย / สถาบัน<small>ปริญญาตรี · ทหาร · ตำรวจ · พยาบาล</small></button><button type="button" data-kd="v" class="' + (v ? 'on' : '') + '"><i class="fa-solid fa-screwdriver-wrench"></i>สายอาชีพ<small>อาชีวศึกษา (ปวส.)</small></button></div>' +
        '<label>' + (v ? 'วิทยาลัย / สถาบัน' : 'มหาวิทยาลัย / สถาบัน') + '</label><input data-f="university" autocomplete="off" maxlength="150" value="' + esc(ed.university) + '" placeholder="' + (v ? 'เช่น วิทยาลัยเทคนิคบึงกาฬ' : 'เช่น มหาวิทยาลัยขอนแก่น / โรงเรียนนายร้อยตำรวจ') + '"><div class="gf-sg" data-sg="university"></div>' +
        '<label>' + (v ? 'ประเภทวิชา' : 'คณะ <span class="gf-mut" style="font-weight:400">(ถ้ามี)</span>') + '</label><input data-f="faculty" autocomplete="off" maxlength="150" value="' + esc(ed.faculty) + '" placeholder="' + (v ? 'เช่น อุตสาหกรรม' : 'เช่น คณะวิศวกรรมศาสตร์') + '"><div class="gf-sg" data-sg="faculty"></div>' +
        '<label>สาขาวิชา</label><input data-f="major" autocomplete="off" maxlength="150" value="' + esc(ed.major) + '" placeholder="' + (v ? 'เช่น ช่างไฟฟ้ากำลัง' : 'เช่น วิศวกรรมคอมพิวเตอร์') + '"><div class="gf-sg" data-sg="major"></div>' +
        '<label>รอบ</label><div class="gf-chips">' + R.map(function (r) { return '<button type="button" data-rd="' + r[0] + '" class="' + (ed.round === r[0] ? 'on' : '') + '">' + r[1] + '</button>'; }).join('') + '</div>' +
        '<div style="display:flex;gap:8px;margin-top:12px"><button type="button" class="gf-btn gh" id="gfEdX" style="margin:0">ยกเลิก</button><button type="button" class="gf-btn" id="gfEdOk" style="margin:0">ตกลง</button></div></div>';
    }
    function edRead() { ['university', 'faculty', 'major'].forEach(function (k) { var i = document.querySelector('[data-f="' + k + '"]'); if (i) ed[k] = i.value.replace(/\s+/g, ' ').trim(); }); }
    function paintSg(f) {
      var box = document.querySelector('[data-sg="' + f + '"]'); if (!box) return; var k = norm(ed[f]);
      var L = sugs(f).filter(function (n) { return !k || norm(n).indexOf(k) !== -1; }).filter(function (n) { return n !== ed[f]; }).slice(0, 8);
      box.innerHTML = (k || f !== 'university') && L.length ? L.map(function (n) { return '<button type="button" data-pk="' + esc(f) + '" data-v="' + esc(n) + '">' + esc(n) + '</button>'; }).join('') : '';
    }
    function sync() { var n = document.getElementById('gfNote'); if (n) F.statusNote = n.value; var c = document.getElementById('gfCon'); if (c) F.consent = c.checked; }
    async function save(silent) {
      sync();
      if (edI !== -1) { err('กด "ตกลง" ที่ช่องสถาบันก่อน'); return false; }
      if (!F.status) { err('กรุณาเลือกสถานะ'); return false; }
      if (F.status === 'study' && !F.entries.length) { err('กรุณาเพิ่มสถาบันที่สมัคร / สอบติดอย่างน้อย 1 แห่ง'); return false; }
      if (F.status === 'study' && F.choice === '') { err('กรุณาเลือกที่ยืนยันสิทธิ์ หรือเลือก "รอผล"'); var cb = document.getElementById('gfChoice'); if (cb) cb.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; }
      if ((F.status === 'work' || F.status === 'other') && !String(F.statusNote || '').trim()) { err(F.status === 'work' ? 'กรุณาระบุเหตุผล / สิ่งที่ทำ' : 'กรุณาระบุรายละเอียด'); var nn = document.getElementById('gfNote'); if (nn) nn.focus(); return false; }
      var b = document.getElementById('gfSave'); if (b) { b.disabled = true; b.textContent = 'กำลังบันทึก…'; } err('');
      var st = F.status === 'study';
      try {
        var d = await apiCall('publicGuideSave', { ticket: T, status: F.status, statusNote: st ? '' : F.statusNote, consent: F.consent, choice: st && F.choice === 'wait' ? 'wait' : '', entries: st ? F.entries.map(function (e, i) { return { kind: e.kind, university: e.university, faculty: e.faculty, major: e.major, round: e.round, confirmed: F.choice === i }; }) : [] });
        setForm(d.mine); if (!silent) { show(); showToast('บันทึกแล้ว ✓'); window.scrollTo(0, 0); } return true;
      } catch (e) { if (b) { b.disabled = false; b.textContent = 'บันทึก'; } err(e.message); return false; }
    }
    function shrink(file) {
      return new Promise(function (res, rej) {
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () { var max = 1200, k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { b ? res(new File([b], 'photo.jpg', { type: 'image/jpeg' })) : rej(new Error('ย่อรูปไม่สำเร็จ')); }, 'image/jpeg', 0.85); };
        img.onerror = function () { URL.revokeObjectURL(url); rej(new Error('เปิดรูปนี้ไม่ได้')); };
        img.src = url;
      });
    }
    document.getElementById('gfFile').addEventListener('change', async function () {
      var file = this.files && this.files[0]; this.value = ''; if (!file) return;
      if (!F.saved && !(await save(true))) return; // ต้องมีข้อมูลก่อน (บันทึกครั้งแรก)
      var r = await withProgress('กำลังอัปโหลดรูป', async function (p) {
        var jf = await shrink(file);
        var prep = await apiCall('publicGuidePhotoPrepare', { ticket: T, fileName: 'photo.jpg', mimeType: 'image/jpeg', fileSize: jf.size, direct: 1, origin: location.origin });
        var res = await sendPreparedFileProgress(prep, jf, p, 10, 92, 'กำลังอัปโหลดรูป', { filename: prep.uploadFileName, mimeType: 'image/jpeg' });
        return apiCall('publicGuidePhotoFinalize', { ticket: T, pid: prep.pid, fileId: res.fileId, fileUrl: res.url });
      }, { successLabel: 'อัปโหลดรูปแล้ว', upload: true });
      if (r.ok) { var m = r.data.mine; if (LAST) LAST.photo = m.photo; else LAST = m; F.photo = m.photo; F.ps = m.photoSt || {}; F.review = m.review; F.reviewedAt = m.reviewedAt || ''; F.saved = true; sync(); show(); } // 2.12.0: เก็บสิ่งที่กำลังแก้ไว้ (ไม่ทับฟอร์ม)
    });
    async function phReq(op) {
      if (op === 'req' && !(await askConfirm('ส่งคำขอเปลี่ยนรูปให้ครูแนะแนว? เมื่อครูอนุมัติแล้วจะเปลี่ยนรูปได้', 'ขอเปลี่ยนรูป'))) return;
      var r = await withProgress(op === 'req' ? 'กำลังส่งคำขอ' : 'กำลังยกเลิก', function () { return apiCall('publicGuidePhotoRequest', { ticket: T, op: op }); }, { successLabel: op === 'req' ? 'ส่งคำขอแล้ว' : 'ยกเลิกแล้ว' });
      if (r.ok) { var m = r.data.mine; if (LAST) LAST.photoSt = m.photoSt; F.ps = m.photoSt || {}; if (mode === 'form') renderForm(); else show(); }
    }
    main.addEventListener('change', function (e) {
      if (e.target.id === 'gfRoom') { room = e.target.value; q = ''; if (room) loadRoom(); else { names = null; pick = null; paintName(); paintGo(); } }
    });
    main.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'gfQ') { q = t.value; paintNs(); return; }
      if (t.id === 'gfCode') { code = t.value; paintGo(); return; }
      var f = t.getAttribute('data-f'); if (f && ed) { ed[f] = t.value; paintSg(f); if (f === 'university') paintSg('faculty'); }
    });
    main.addEventListener('focusin', function (e) { var f = e.target.getAttribute && e.target.getAttribute('data-f'); if (f && ed) paintSg(f); });
    main.addEventListener('click', function (e) {
      var t = e.target, x;
      if ((x = t.closest('[data-nm]'))) { pick = names.filter(function (s) { return s.id === x.getAttribute('data-nm'); })[0] || null; paintName(); paintGo(); return; }
      if (t.closest('#gfUnpick')) { pick = null; paintName(); paintGo(); return; }
      if (t.closest('#gfGo')) { login(); return; }
      if (t.closest('#gfOut')) { T = null; me = null; pick = null; code = ''; renderPick(); return; }
      if ((x = t.closest('[data-st]'))) { sync(); F.status = x.getAttribute('data-st'); if (F.status === 'study') F.statusNote = ''; renderForm(); return; }
      if ((x = t.closest('[data-why]'))) { var ni = document.getElementById('gfNote'), w = x.getAttribute('data-why'), cur = ni.value.trim(); ni.value = !cur || WHY.indexOf(cur) !== -1 ? (w === 'อื่น ๆ' ? '' : w) : cur + ' · ' + w; F.statusNote = ni.value; ni.focus(); return; } // 2.11.1
      if (t.closest('#gfEdit')) { if (locked()) return; mode = 'form'; snap(); renderForm(); window.scrollTo(0, 0); return; }
      if (t.closest('#gfCancel')) { setForm(LAST); show(); window.scrollTo(0, 0); return; }
      if (t.closest('#gfAdd')) { sync(); ed = { kind: 'u', university: '', faculty: '', major: '', round: '' }; edI = F.entries.length; paintEnts(); var u = document.querySelector('[data-f="university"]'); if (u) u.focus(); return; }
      if ((x = t.closest('[data-ed]'))) { edI = +x.getAttribute('data-ed'); ed = Object.assign({}, F.entries[edI]); paintEnts(); return; }
      if ((x = t.closest('[data-del]'))) { var di = +x.getAttribute('data-del'); askConfirm('ลบสถาบันนี้ออกจากรายการ?', 'ลบสถาบัน').then(function (ok) { if (!ok) return; F.entries.splice(di, 1); if (F.choice === di) F.choice = ''; else if (typeof F.choice === 'number' && F.choice > di) F.choice--; paintEnts(); }); return; }
      if ((x = t.closest('[data-ch]'))) { var cv = x.getAttribute('data-ch'); F.choice = cv === 'wait' ? 'wait' : +cv; paintChoice(); err(''); return; }
      if ((x = t.closest('[data-kd]'))) { edRead(); var nk = x.getAttribute('data-kd'); if (nk !== ed.kind) { ed.kind = nk; ed.round = ''; } paintEnts(); return; }
      if ((x = t.closest('[data-pk]'))) { var f = x.getAttribute('data-pk'); ed[f] = x.getAttribute('data-v'); var inp = document.querySelector('[data-f="' + f + '"]'); inp.value = ed[f]; x.parentNode.innerHTML = ''; var nx = { university: 'faculty', faculty: 'major' }[f]; if (nx) { var nI = document.querySelector('[data-f="' + nx + '"]'); if (nI) { nI.focus(); paintSg(nx); } } return; }
      if ((x = t.closest('[data-rd]'))) { ed.round = ed.round === x.getAttribute('data-rd') ? '' : x.getAttribute('data-rd'); document.querySelectorAll('[data-rd]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-rd') === ed.round); }); return; }
      if (t.closest('#gfEdX')) { ed = null; edI = -1; paintEnts(); return; }
      if (t.closest('#gfEdOk')) {
        edRead();
        if (!ed.university) { err(ed.kind === 'v' ? 'กรุณากรอกชื่อวิทยาลัย/สถาบัน' : 'กรุณากรอกชื่อมหาวิทยาลัย/สถาบัน'); return; } err('');
        if (edI >= F.entries.length) F.entries.push(ed); else F.entries[edI] = ed;
        ed = null; edI = -1; paintEnts(); return;
      }
      if (t.closest('[data-gf-ph]')) { document.getElementById('gfFile').click(); return; }
      if ((x = t.closest('[data-gf-phreq]'))) { phReq(x.getAttribute('data-gf-phreq')); return; }
      if (t.closest('#gfSave')) { save(); return; }
    });
    start();
  })();
  
