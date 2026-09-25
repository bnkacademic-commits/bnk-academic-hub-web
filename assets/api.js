/**
 * BNKAcademicHub - api.js
 * ตัวช่วยเรียก backend (Cloudflare Worker), จัดการ session, ธีมมืด/สว่าง, และส่วนหน้าเว็บที่ใช้ร่วมกัน (topbar/footer/modal)
 *
 * สำคัญ: แก้ API_URL ด้านล่างเป็น URL ของ Worker (เช่น https://bnk-academic-hub-api.<ชื่อบัญชี>.workers.dev)
 * หลัง deploy — ดูขั้นตอนเต็มใน README.md (ตั้งแต่ V9 backend ย้ายจาก Google Apps Script มาเป็น
 * Cloudflare Worker + D1/KV แล้ว — ไฟล์ apps-script/ เดิมเก็บไว้เป็นข้อมูลอ้างอิงเท่านั้น ไม่ได้ใช้งานแล้ว)
 */
var API_URL = 'https://bnk-academic-hub-api.tear-jeerasak.workers.dev/';

var SESSION_TOKEN_KEY = 'bnkah_token';
var SESSION_USER_KEY = 'bnkah_user';
var SESSION_LOGIN_AT_KEY = 'bnkah_login_at';
var THEME_KEY = 'bnkah_theme';
var SESSION_TIMEOUT_MS = 60 * 60 * 1000; // เด้งออกอัตโนมัติเมื่ออยู่ในระบบครบ 1 ชั่วโมง (ฝั่งหน้าเว็บ แยกจากอายุ token ฝั่ง backend)

/**
 * เรียก action ไปยัง backend (Cloudflare Worker) เสมอใช้ Content-Type: text/plain เพื่อเลี่ยง CORS preflight
 * หากได้ผลลัพธ์ที่ไม่ใช่ JSON กลับมา (เช่น เครือข่ายสะดุดชั่วคราว) จะลองซ้ำให้อัตโนมัติ 1 ครั้งก่อนแจ้ง error —
 * เผื่อไว้เฉยๆ ตั้งแต่ย้ายมาเป็น Cloudflare Worker แล้วโอกาสเกิดน้อยกว่าระบบเดิมมาก (Worker ไม่มี fallback
 * ที่ตอบข้อความธรรมดากลับมาแบบ Apps Script เดิมที่เคยเป็นต้นเหตุปัญหานี้)
 */
async function apiCall(action, payload) {
  if (!API_URL || API_URL.indexOf('PASTE_YOUR') === 0) {
    throw new Error('ยังไม่ได้ตั้งค่า API_URL ใน assets/api.js กรุณาใส่ Web App URL ก่อนใช้งาน');
  }
  var body = JSON.stringify({ action: action, token: getToken(), payload: payload || {} });
  var attempt = async function () {
    var res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: body
    });
    var text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      var badJsonErr = new Error('เชื่อมต่อกับ Backend ไม่สำเร็จ (เซิร์ฟเวอร์ตอบกลับข้อมูลไม่ถูกต้อง) — หากเพิ่ง Deploy เวอร์ชันใหม่ของ Apps Script ให้รอสัก 1-2 นาทีแล้วลองใหม่');
      badJsonErr.__notJson = true;
      throw badJsonErr;
    }
  };
  var json;
  try {
    json = await attempt();
  } catch (e) {
    if (e.__notJson) {
      await new Promise(function (r) { setTimeout(r, 1500); });
      json = await attempt(); // ลองซ้ำอีกครั้งเดียว ถ้ายัง error ก็ปล่อยให้ throw ออกไปตามปกติ
    } else {
      throw e;
    }
  }
  if (!json.ok) throw new Error(json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ');
  return json.data;
}

// ---------- Session ----------
function getToken() { try { return localStorage.getItem(SESSION_TOKEN_KEY); } catch (e) { return null; } }
function getSession() {
  try { var raw = localStorage.getItem(SESSION_USER_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function setSession(token, user) {
  try {
    localStorage.setItem(SESSION_TOKEN_KEY, token);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
    localStorage.setItem(SESSION_LOGIN_AT_KEY, String(Date.now()));
  } catch (e) { /* localStorage อาจถูกปิด */ }
}
function clearSession() {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_LOGIN_AT_KEY);
  } catch (e) {}
}
// ออกจากระบบแล้วรีเฟรชหน้าเว็บ 1 ครั้งเสมอ (นำทางไปหน้าล็อกอินแบบโหลดใหม่จริง ไม่ใช้แคชหน้าเดิม)
function logout() {
  clearSession();
  location.href = 'index.html?_=' + Date.now();
}

// ---------- เซสชันหมดเวลาอัตโนมัติเมื่ออยู่ในระบบครบ 1 ชั่วโมง ----------
var _sessionTimeoutHandle = null;
function scheduleSessionTimeout() {
  try {
    if (_sessionTimeoutHandle) clearTimeout(_sessionTimeoutHandle);
    var loginAt = parseInt(localStorage.getItem(SESSION_LOGIN_AT_KEY) || '0', 10);
    if (!loginAt) {
      loginAt = Date.now();
      localStorage.setItem(SESSION_LOGIN_AT_KEY, String(loginAt));
    }
    var remaining = SESSION_TIMEOUT_MS - (Date.now() - loginAt);
    if (remaining <= 0) { forceSessionExpire(); return; }
    _sessionTimeoutHandle = setTimeout(forceSessionExpire, remaining);
  } catch (e) { /* localStorage อาจถูกปิด: ไม่ตั้งเวลาหมดอายุอัตโนมัติ */ }
}
function forceSessionExpire() {
  clearSession();
  ensureSharedModals();
  var modal = document.getElementById('sharedExpireModal');
  if (!modal) { location.href = 'index.html?_=' + Date.now(); return; }
  showModalEl(modal);
}

function homePageFor(session) {
  if (!session) return 'index.html';
  if (session.role === 'teacher') return 'dashboard.html';
  if (session.role === 'admin' && session.hasHub) return 'dashboard.html';
  return 'summary.html'; // เจ้าหน้าที่ระดับ Super Admin (ไม่มีหน้าฮับ)
}

function requireLogin() {
  var s = getSession();
  if (!s || !getToken()) { location.href = 'index.html'; return null; }
  return s;
}
function requireHubAccess() {
  var s = requireLogin();
  if (!s) return null;
  if (s.role === 'teacher' || (s.role === 'admin' && s.hasHub)) return s;
  location.href = homePageFor(s);
  return null;
}
function requireAdminAccess() {
  var s = requireLogin();
  if (!s) return null;
  if (s.role !== 'admin') { location.href = homePageFor(s); return null; }
  return s;
}

function roleLabel(session) {
  if (!session) return '';
  if (session.role === 'teacher') return 'ครู';
  if (session.role === 'admin') return session.hasHub ? 'เจ้าหน้าที่ฝ่ายวิชาการ' : 'Super Admin';
  return '';
}

// ---------- Theme (dark/light) ----------
function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
}
function setTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  applyTheme(theme);
}
function toggleTheme() {
  var next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  var chk = document.getElementById('themeToggleInput');
  if (chk) chk.checked = next === 'dark';
}

// ---------- Site settings (ชื่อเว็บ/โลโก้/ไอคอน) ----------
// เก็บทั้งค่า (cache) และ promise ที่กำลังโหลดอยู่ (in-flight) — กันไม่ให้สองหน้าที่เรียก applyBranding()/loadGeneralSettings() พร้อมกันตอนโหลดหน้า ยิง apiCall ซ้ำซ้อนกันโดยไม่จำเป็น
var _settingsCache = null;
var _settingsPromise = null;
function resetSettingsCache() { _settingsCache = null; _settingsPromise = null; }
async function getSiteSettings() {
  if (_settingsCache) return _settingsCache;
  if (!_settingsPromise) {
    _settingsPromise = apiCall('publicGetSettings', {}).catch(function () {
      return { siteName: 'BNKAcademicHub', version: '', iconDataUrl: '', logoDataUrl: '' };
    });
  }
  _settingsCache = await _settingsPromise;
  return _settingsCache;
}

async function applyBranding() {
  var s = await getSiteSettings();
  document.querySelectorAll('.js-site-name').forEach(function (el) { el.textContent = s.siteName || 'BNKAcademicHub'; });
  if (s.siteName && document.title) {
    document.title = document.title.replace(/BNKAcademicHub/, s.siteName);
  }
  if (s.iconDataUrl) {
    var link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = s.iconDataUrl;
  }
  document.querySelectorAll('.js-brand-logo').forEach(function (el) {
    if (s.logoDataUrl) {
      el.innerHTML = '<img src="' + s.logoDataUrl + '" class="brand-logo" alt="โลโก้" />';
    } else {
      el.innerHTML = '<span class="logo-dot"></span>';
    }
  });
  document.querySelectorAll('.js-brand-logo-lg').forEach(function (el) {
    if (s.logoDataUrl) el.outerHTML = '<img src="' + s.logoDataUrl + '" class="brand-logo-lg" alt="โลโก้" />';
  });
  return s;
}

// ---------- Helpers ----------
function fileToBase64(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () { resolve(String(reader.result).split(',')[1]); };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
/**
 * ส่งไฟล์งาน 1 ไฟล์ขึ้น Drive — แบ่งเป็น 3 ขั้นตอนแทนที่จะเป็น apiCall เดียวจบแบบ action อื่นๆ:
 *   1) apiCall('teacherUploadPrepare', ...) — ให้ Worker ตรวจสิทธิ์/ประเภทงาน แล้วขอ "ตั๋วอัพโหลด" จาก Drive relay
 *   2) ยิงไฟล์ (base64) ตรงไปที่ relay เอง ไม่ผ่าน Worker เลย
 *   3) apiCall('teacherUploadFinalize', ...) — แจ้ง Worker บันทึกผลไฟล์ลงฐานข้อมูล
 * เหตุผลที่ไม่ใช่คำสั่งเดียวจบเหมือนระบบเดิม: ไฟล์งานอาจใหญ่ถึง 25MB ซึ่งเกินเวลาประมวลผล (CPU time) ต่อ
 * คำขอของ Cloudflare Workers แผนฟรี (~10ms) ถ้าให้ Worker เป็นตัวกลางรับ-ส่งไฟล์เองจะเสี่ยงอัพโหลดไม่สำเร็จ
 * สำหรับไฟล์ขนาดใหญ่ — ขั้นตอนที่ใช้เวลานาน (อ่าน/ยิงไฟล์จริง) จึงข้าม Worker ไปเลย
 */
async function submitWorkFile(file, meta) {
  var prep = await apiCall('teacherUploadPrepare', {
    fileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
    academicYear: meta.academicYear,
    semester: meta.semester,
    categoryId: meta.categoryId,
    title: meta.title,
    description: meta.description
  });
  var base64 = await fileToBase64(file);
  var relayText;
  try {
    var relayRes = await fetch(prep.relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ uploadToken: prep.uploadToken, base64: base64, filename: file.name, mimeType: file.type })
    });
    relayText = await relayRes.text();
  } catch (e) {
    throw new Error('ติดต่อระบบเก็บไฟล์ไม่สำเร็จ (เครือข่ายขัดข้อง) กรุณาลองใหม่อีกครั้ง');
  }
  var relayJson;
  try {
    relayJson = JSON.parse(relayText);
  } catch (e) {
    throw new Error('ระบบเก็บไฟล์ตอบกลับข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
  }
  if (!relayJson.ok) throw new Error(relayJson.error || 'อัพโหลดไฟล์ไม่สำเร็จ');
  var result = relayJson.data;
  return apiCall('teacherUploadFinalize', {
    submissionId: prep.submissionId,
    fileId: result.fileId,
    fileUrl: result.url,
    directUrl: result.directUrl,
    fileName: file.name,
    mimeType: file.type
  });
}
/**
 * อ่านไฟล์รูปภาพแล้วย่อขนาดอัตโนมัติ (ไม่เกิน maxSize px ด้านที่ยาวที่สุด) ก่อนแปลงเป็น base64
 * ใช้กับไอคอน/โลโก้เว็บ เพื่อไม่ให้ไฟล์ใหญ่เกินไปโดยไม่ต้องให้ผู้ใช้ไปย่อเอง — คงความโปร่งใสไว้ด้วยการ export เป็น PNG เสมอ
 */
function resizeImageToBase64(file, maxSize) {
  return new Promise(function (resolve, reject) {
    if (!file.type || file.type.indexOf('image/') !== 0) {
      reject(new Error('กรุณาเลือกไฟล์รูปภาพเท่านั้น'));
      return;
    }
    var reader = new FileReader();
    reader.onload = function () {
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var scale = Math.min(1, maxSize / Math.max(w, h));
        var outW = Math.max(1, Math.round(w * scale));
        var outH = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);
        var dataUrl = canvas.toDataURL('image/png');
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/png', width: outW, height: outH });
      };
      img.onerror = function () { reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ ลองไฟล์อื่น')); };
      img.src = String(reader.result);
    };
    reader.onerror = function () { reject(new Error('ไม่สามารถอ่านไฟล์นี้ได้')); };
    reader.readAsDataURL(file);
  });
}
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatDateThai(isoOrDateStr) {
  if (!isoOrDateStr) return '';
  var d = new Date(isoOrDateStr);
  if (isNaN(d.getTime())) return String(isoOrDateStr);
  var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}
function formatDateTimeThai(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  var hh = String(d.getHours()).padStart(2, '0');
  var mm = String(d.getMinutes()).padStart(2, '0');
  return formatDateThai(isoStr) + ' ' + hh + ':' + mm + ' น.';
}
function showToast(msg, isError) {
  var el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'toast show' + (isError ? ' toast-error' : '');
  clearTimeout(el.__timer);
  el.__timer = setTimeout(function () { el.className = 'toast'; }, 3500);
}

function showModalEl(el) {
  el.hidden = false;
  requestAnimationFrame(function () { el.classList.add('show'); });
}
function hideModalEl(el) {
  el.classList.remove('show');
  setTimeout(function () { el.hidden = true; }, 180);
}

// ---------- Shared modals (custom, no browser confirm/alert) ----------
function ensureSharedModals() {
  if (document.getElementById('sharedConfirmModal')) return;
  var wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="modal-backdrop" id="sharedConfirmModal" hidden>' +
      '<div class="modal-box">' +
        '<h3 id="sharedConfirmTitle">ยืนยันการทำรายการ</h3>' +
        '<p id="sharedConfirmMsg" style="color:var(--text-muted); font-size:0.9rem;"></p>' +
        '<div class="modal-actions">' +
          '<button class="btn btn-danger" id="sharedConfirmYes">ยืนยัน</button>' +
          '<button class="btn btn-ghost" id="sharedConfirmNo">ยกเลิก</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-backdrop" id="sharedPwModal" hidden>' +
      '<div class="modal-box">' +
        '<h3>เปลี่ยนรหัสผ่าน</h3>' +
        '<div id="sharedPwError" class="error-box" hidden></div>' +
        '<form id="sharedPwForm" style="text-align:left;">' +
          '<div class="field"><label for="sharedOldPw">รหัสผ่านเดิม</label><input id="sharedOldPw" type="password" required autocomplete="current-password" /></div>' +
          '<div class="field"><label for="sharedNewPw">รหัสผ่านใหม่</label><input id="sharedNewPw" type="password" required minlength="4" autocomplete="new-password" /></div>' +
          '<div class="modal-actions">' +
            '<button type="submit" class="btn btn-primary">บันทึก</button>' +
            '<button type="button" class="btn btn-ghost" id="sharedPwClose">ยกเลิก</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>' +
    '<div class="modal-backdrop" id="sharedExpireModal" hidden>' +
      '<div class="modal-box">' +
        '<h3>หมดเวลาการใช้งาน</h3>' +
        '<p style="color:var(--text-muted); font-size:0.9rem;">คุณอยู่ในระบบครบ 1 ชั่วโมงแล้ว เพื่อความปลอดภัยระบบได้นำคุณออกจากระบบโดยอัตโนมัติ กรุณาเข้าสู่ระบบใหม่อีกครั้ง</p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-primary" id="sharedExpireOk">เข้าสู่ระบบอีกครั้ง</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-backdrop" id="sharedProgressModal" hidden>' +
      '<div class="modal-box">' +
        '<h3 id="sharedProgressTitle">กำลังดำเนินการ</h3>' +
        '<div id="sharedProgressBarWrap">' +
          '<div class="progress-track"><div class="progress-bar-fill" id="sharedProgressBar"></div></div>' +
          '<div class="progress-label" id="sharedProgressLabel"></div>' +
        '</div>' +
        '<div class="progress-result" id="sharedProgressResult" hidden></div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-primary" id="sharedProgressOk" hidden>ตกลง</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  document.getElementById('sharedExpireOk').addEventListener('click', function () {
    location.href = 'index.html?_=' + Date.now();
  });

  document.getElementById('sharedPwClose').addEventListener('click', function () { hideModalEl(document.getElementById('sharedPwModal')); });
  document.getElementById('sharedPwForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var errBox = document.getElementById('sharedPwError');
    errBox.hidden = true;
    var ok = await askConfirm('ยืนยันเปลี่ยนรหัสผ่านของบัญชีนี้?', 'ยืนยันการเปลี่ยนรหัสผ่าน');
    if (!ok) return;
    var oldPw = document.getElementById('sharedOldPw').value;
    var newPw = document.getElementById('sharedNewPw').value;
    var r = await withProgress('กำลังเปลี่ยนรหัสผ่าน', function () {
      return apiCall('changePassword', { oldPassword: oldPw, newPassword: newPw });
    }, { successLabel: 'เปลี่ยนรหัสผ่านเรียบร้อยแล้ว' });
    if (r.ok) {
      hideModalEl(document.getElementById('sharedPwModal'));
      document.getElementById('sharedPwForm').reset();
    } else {
      errBox.textContent = r.error.message;
      errBox.hidden = false;
    }
  });
}

function openChangePasswordModal() {
  ensureSharedModals();
  showModalEl(document.getElementById('sharedPwModal'));
}

function askConfirm(msg, title) {
  ensureSharedModals();
  return new Promise(function (resolve) {
    document.getElementById('sharedConfirmTitle').textContent = title || 'ยืนยันการทำรายการ';
    document.getElementById('sharedConfirmMsg').textContent = msg;
    var modal = document.getElementById('sharedConfirmModal');
    showModalEl(modal);
    var yesBtn = document.getElementById('sharedConfirmYes');
    var noBtn = document.getElementById('sharedConfirmNo');
    function cleanup(val) {
      hideModalEl(modal);
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      resolve(val);
    }
    function onYes() { cleanup(true); }
    function onNo() { cleanup(false); }
    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
  });
}

// ---------- ป็อปอัพ "กำลังดำเนินการ" (Progress bar) ----------
// เปิดหลังกดยืนยัน (askConfirm) แสดงระหว่างรอ backend ตอบกลับ แล้วให้ผู้ใช้กด "ตกลง" อีกครั้งเมื่อเสร็จ/error
function _showProgressModal(title) {
  ensureSharedModals();
  document.getElementById('sharedProgressTitle').textContent = title || 'กำลังดำเนินการ';
  document.getElementById('sharedProgressBarWrap').hidden = false;
  document.getElementById('sharedProgressResult').hidden = true;
  document.getElementById('sharedProgressOk').hidden = true;
  setProgressIndeterminate('กำลังดำเนินการ...');
  showModalEl(document.getElementById('sharedProgressModal'));
}
function setProgress(percent, label) {
  var bar = document.getElementById('sharedProgressBar');
  if (!bar) return;
  bar.classList.remove('indeterminate');
  bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
  if (label !== undefined) document.getElementById('sharedProgressLabel').textContent = label;
}
function setProgressIndeterminate(label) {
  var bar = document.getElementById('sharedProgressBar');
  if (!bar) return;
  bar.classList.add('indeterminate');
  if (label !== undefined) document.getElementById('sharedProgressLabel').textContent = label;
}
function _finishProgress(message, isError) {
  return new Promise(function (resolve) {
    document.getElementById('sharedProgressBarWrap').hidden = true;
    var resultBox = document.getElementById('sharedProgressResult');
    resultBox.hidden = false;
    resultBox.className = 'progress-result ' + (isError ? 'is-error' : 'is-success');
    resultBox.textContent = message;
    var okBtn = document.getElementById('sharedProgressOk');
    okBtn.hidden = false;
    function onOk() {
      okBtn.removeEventListener('click', onOk);
      hideModalEl(document.getElementById('sharedProgressModal'));
      resolve();
    }
    okBtn.addEventListener('click', onOk);
  });
}
/**
 * เรียกใช้งานหลัง askConfirm() แล้ว — เปิดป็อปอัพ Progress bar ระหว่างรอ workFn() ทำงาน (มักคือ apiCall)
 * workFn จะได้รับ { setProgress(percent, label), setLabel(label) } ไว้ใช้รายงานความคืบหน้าจริง (เช่น อัพโหลดหลายไฟล์)
 * เสร็จแล้วจะโชว์ผลลัพธ์ค้างไว้จนกว่าผู้ใช้จะกด "ตกลง" — คืนค่า { ok, data } หรือ { ok:false, error }
 */
async function withProgress(title, workFn, opts) {
  opts = opts || {};
  _showProgressModal(title);
  try {
    var data = await workFn({
      setProgress: setProgress,
      setLabel: function (label) { document.getElementById('sharedProgressLabel').textContent = label; }
    });
    await _finishProgress(opts.successLabel || 'ดำเนินการสำเร็จ', false);
    return { ok: true, data: data };
  } catch (err) {
    await _finishProgress((err && err.message) || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ', true);
    return { ok: false, error: err };
  }
}

// ---------- Shared chrome: topbar + profile dropdown + footer ----------
function navLinksFor(session) {
  var links = [];
  if (session && session.role === 'admin') {
    if (session.hasHub) links.push({ href: 'dashboard.html', label: 'หน้าฮับ', key: 'dashboard' });
    links.push({ href: 'summary.html', label: 'สรุปรวมการส่งงาน', key: 'summary' });
    links.push({ href: 'settings.html', label: 'ตั้งค่าเว็บ', key: 'settings' });
  }
  return links;
}

function mountChrome(activePage) {
  var session = getSession();
  var topbarRoot = document.getElementById('app-topbar');
  if (topbarRoot && session) {
    var links = navLinksFor(session);
    var navHtml = links.map(function (l) {
      return '<a href="' + l.href + '" class="' + (l.key === activePage ? 'active' : '') + '">' + escapeHtml(l.label) + '</a>';
    }).join('');
    var initial = (session.name || '?').trim().charAt(0);
    topbarRoot.innerHTML =
      '<div class="topbar">' +
        '<button class="brand js-home-btn" type="button"><span class="js-brand-logo"><span class="logo-dot"></span></span> <span class="js-site-name">BNKAcademicHub</span></button>' +
        '<div class="topbar-right">' +
          '<nav class="topbar-nav">' + navHtml + '</nav>' +
          '<button class="refresh-btn" id="refreshDataBtn" type="button" title="รีเฟรชข้อมูล" aria-label="รีเฟรชข้อมูล"><span class="refresh-icon">🔄</span></button>' +
          '<div class="profile-menu">' +
            '<button class="profile-trigger" id="profileTrigger" aria-expanded="false" type="button">' +
              '<span class="profile-avatar">' + escapeHtml(initial) + '</span>' +
              '<span class="profile-name">' + escapeHtml(session.name) + '</span>' +
              '<span class="chevron">▾</span>' +
            '</button>' +
            '<div class="profile-dropdown" id="profileDropdown">' +
              '<div class="dd-header"><div class="dd-name">' + escapeHtml(session.name) + '</div><div class="dd-role">' + escapeHtml(roleLabel(session)) + '</div></div>' +
              '<div class="theme-switch-row"><span>โหมดมืด</span><label class="switch"><input type="checkbox" id="themeToggleInput"><span class="slider"></span></label></div>' +
              '<div class="dd-divider"></div>' +
              '<button class="dd-item" id="ddChangePw" type="button"><span class="dd-icon">🔑</span> เปลี่ยนรหัสผ่าน</button>' +
              '<button class="dd-item danger" id="ddLogout" type="button"><span class="dd-icon">🚪</span> ออกจากระบบ</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.querySelector('.js-home-btn').addEventListener('click', function () { location.href = homePageFor(session); });

    var trigger = document.getElementById('profileTrigger');
    var dropdown = document.getElementById('profileDropdown');
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target) && e.target !== trigger) {
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    var themeChk = document.getElementById('themeToggleInput');
    themeChk.checked = getTheme() === 'dark';
    themeChk.addEventListener('change', function () { setTheme(themeChk.checked ? 'dark' : 'light'); });

    document.getElementById('ddChangePw').addEventListener('click', function () {
      dropdown.classList.remove('open');
      openChangePasswordModal();
    });
    document.getElementById('ddLogout').addEventListener('click', async function () {
      dropdown.classList.remove('open');
      var ok = await askConfirm('ต้องการออกจากระบบใช่หรือไม่?', 'ยืนยันการออกจากระบบ');
      if (ok) logout();
    });

    // ---------- ปุ่มรีเฟรชข้อมูล (แต่ละหน้าจะกำหนด window.__refreshPageData เองว่ารีเฟรชอะไรบ้าง) ----------
    var refreshBtn = document.getElementById('refreshDataBtn');
    refreshBtn.addEventListener('click', async function () {
      if (refreshBtn.classList.contains('spinning')) return; // กันกดซ้ำระหว่างกำลังโหลดอยู่
      refreshBtn.classList.add('spinning');
      refreshBtn.disabled = true;
      try {
        if (window.__refreshPageData) {
          await window.__refreshPageData();
        } else {
          location.reload();
          return;
        }
        showToast('รีเฟรชข้อมูลแล้ว');
      } catch (err) {
        showToast('รีเฟรชข้อมูลไม่สำเร็จ: ' + err.message, true);
      } finally {
        refreshBtn.classList.remove('spinning');
        refreshBtn.disabled = false;
      }
    });

    scheduleSessionTimeout();
  }
  mountFooter();
  applyBranding();
}

function mountFooter() {
  var root = document.getElementById('app-footer');
  if (!root) return;
  root.innerHTML =
    '<div class="site-footer">' +
      '<div class="line1">Developed and Created by Jeerasak Chomphuwattana</div>' +
      '<div>Powered by AI</div>' +
    '</div>';
}

// เรียกทันทีตอนโหลดสคริปต์เพื่อกันธีมกะพริบ (เผื่อกรณี inline script หัวไฟล์ไม่ทำงาน)
applyTheme(getTheme());
