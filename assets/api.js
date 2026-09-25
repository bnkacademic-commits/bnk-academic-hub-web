/**
 * BNKAcademicHub - api.js
 * ตัวช่วยเรียก backend (Cloudflare Worker), จัดการ session, ธีมมืด/สว่าง, และส่วนหน้าเว็บที่ใช้ร่วมกัน (topbar/footer/modal)
 *
 * สำคัญ: แก้ API_URL ด้านล่างเป็น URL ของ Worker (เช่น https://bnk-academic-hub-api.<ชื่อบัญชี>.workers.dev)
 * หลัง deploy — ดูขั้นตอนเต็มใน README.md (ตั้งแต่ V9 backend ย้ายจาก Google Apps Script มาเป็น
 * Cloudflare Worker + D1/KV แล้ว — ไฟล์ apps-script/ เดิมเก็บไว้เป็นข้อมูลอ้างอิงเท่านั้น ไม่ได้ใช้งานแล้ว)
 */
var API_URL = 'https://bnk-academic-hub-api.tear-jeerasak.workers.dev';

// เลขเวอร์ชันของเว็บ — เป็นค่าคงที่ในโค้ดเท่านั้น ไม่ใช่ "ค่าตั้งค่า" ที่แก้ผ่านหน้าเว็บได้อีกต่อไปตั้งแต่ V9.1
// (ผู้ดูแลระบบ/นักพัฒนาเป็นคนแก้เลขนี้เองในไฟล์โค้ดทุกครั้งที่ปล่อยเวอร์ชันใหม่ — แสดงผลที่แถวล่างสุดของหน้าตั้งค่าเท่านั้น)
var APP_VERSION = 'V10.0';

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
      return { siteName: 'BNKAcademicHub', iconDataUrl: '', logoDataUrl: '', summerEnabled: true };
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
  applySummerVisibility(s);
  return s;
}

// ซ่อนตัวเลือก "ภาคฤดูร้อน" ออกจากทุก <select> ในหน้า ถ้า Super Admin ปิดใช้งานไว้ (บางโรงเรียนไม่มีภาคเรียนนี้) — ตั้งแต่ V9.6
// ทำงานได้ทั้งสองทาง (ปิด → เอาออก, เปิดกลับมา → ใส่คืน) โดยจำ select ที่เคยมีตัวเลือกนี้ไว้ด้วย data-had-summer เพื่อใส่คืนถูกตำแหน่ง (ภาคฤดูร้อนเป็นตัวเลือกสุดท้ายเสมอในทุก select ของระบบ)
// หมายเหตุ: ถ้า select นั้นกำลังเลือกค่า "summer" อยู่พอดี (เช่นกำลังกรองข้อมูลเก่าที่เคยเป็นภาคฤดูร้อน) จะไม่ตัดตัวเลือกออก เพื่อไม่ให้ค่าที่เลือกอยู่หายไปเฉยๆ —
// ข้อมูลเก่าที่เคยบันทึกเป็นภาคฤดูร้อนไว้ก่อนปิดตัวเลือกนี้ ยังแสดงผลได้ตามปกติเสมอ เพราะป้ายกำกับ "ภาคฤดูร้อน" ที่แสดงในตาราง/การ์ดต่างๆ คำนวณจากค่าที่บันทึกไว้ ไม่ได้อิงจาก <option> นี้
function applySummerVisibility(s) {
  var enabled = !s || s.summerEnabled !== false;
  document.querySelectorAll('select').forEach(function (sel) {
    var opt = sel.querySelector('option[value="summer"]');
    if (enabled) {
      if (!opt && sel.getAttribute('data-had-summer') === '1') {
        var newOpt = document.createElement('option');
        newOpt.value = 'summer';
        newOpt.textContent = 'ภาคฤดูร้อน';
        sel.appendChild(newOpt);
      }
    } else if (opt) {
      sel.setAttribute('data-had-summer', '1');
      if (sel.value !== 'summer') opt.remove();
    }
  });
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
/**
 * อ่านไฟล์รูปโปรไฟล์ ย่อขนาด (ไม่เกิน 480px ด้านที่ยาวที่สุด) แล้วบีบอัดเป็น JPEG คุณภาพ 0.85 ก่อนอัพโหลด
 * เพื่อให้ไฟล์เล็กพอเหมาะกับการแสดงในหน้าเว็บเสมอ (ทั้งหน้าโปรไฟล์และหน้าผลงานสาธารณะ) โดยผู้ใช้ไม่ต้องไปย่อไฟล์เอง
 */
function resizeImageForAvatar(file) {
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
        var maxSize = 480;
        var scale = Math.min(1, maxSize / Math.max(w, h));
        var outW = Math.max(1, Math.round(w * scale));
        var outH = Math.max(1, Math.round(h * scale));
        var canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff'; // กันพื้นหลังโปร่งใส (เช่น ไฟล์ PNG) กลายเป็นสีดำตอนแปลงเป็น JPEG
        ctx.fillRect(0, 0, outW, outH);
        ctx.drawImage(img, 0, 0, outW, outH);
        var dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', dataUrl: dataUrl, width: outW, height: outH });
      };
      img.onerror = function () { reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้ ลองไฟล์อื่น')); };
      img.src = String(reader.result);
    };
    reader.onerror = function () { reject(new Error('ไม่สามารถอ่านไฟล์นี้ได้')); };
    reader.readAsDataURL(file);
  });
}
/**
 * อัพโหลดรูปโปรไฟล์ (ที่ย่อ/บีบอัดไว้แล้วจาก resizeImageForAvatar) ขึ้น Google Drive ผ่าน Drive relay
 * ด้วยขั้นตอนเดียวกับการส่งไฟล์งาน (prepare -> ยิงตรงไป relay -> finalize) ดู submitWorkFile ด้านบนประกอบ
 */
async function uploadResizedAvatar(resized) {
  var approxBytes = Math.ceil(resized.base64.length * 3 / 4);
  var prep = await apiCall('profileAvatarUploadPrepare', { fileName: 'avatar.jpg', fileSize: approxBytes });
  var relayText;
  try {
    var relayRes = await fetch(prep.relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ uploadToken: prep.uploadToken, base64: resized.base64, filename: 'avatar.jpg', mimeType: resized.mimeType })
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
  if (!relayJson.ok) throw new Error(relayJson.error || 'อัพโหลดรูปโปรไฟล์ไม่สำเร็จ');
  var result = relayJson.data;
  return apiCall('profileAvatarUploadFinalize', {
    fileId: result.fileId, fileUrl: result.url, directUrl: result.directUrl,
    fileName: 'avatar.jpg', mimeType: resized.mimeType
  });
}

// ไอคอนคนทั่วไป (SVG เส้น currentColor) — ใช้เป็นรูปโปรไฟล์เริ่มต้นเมื่อบัญชียังไม่ได้อัพโหลดรูปเอง
var PERSON_ICON_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm0 2c-3.33 0-10 1.68-10 5v3h20v-3c0-3.32-6.67-5-10-5z"/></svg>';
// คืน HTML สำหรับวงกลมรูปโปรไฟล์: รูปที่อัพโหลดไว้ (ถ้ามี) หรือไอคอนคนเริ่มต้น
function avatarInnerHtml(avatarUrl) {
  if (avatarUrl) return '<img src="' + escapeHtml(avatarUrl) + '" alt="" />';
  return PERSON_ICON_SVG;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
// จุดสีเล็กๆ แสดงหน้าชื่อประเภทงาน (ตั้งแต่ V9.7) — ใช้ร่วมกันทุกหน้าที่แสดงชื่อประเภทงาน (Hub ครู/สรุปรวม/ตั้งค่าเว็บ)
function categoryDotHtml(color) {
  return '<span class="category-dot" style="background:' + escapeHtml(color || '#3457d5') + ';"></span>';
}
// สร้าง map { categoryId: color } จากรายการประเภทงาน — ใช้เมื่อรายการที่จะแสดง (ผลงาน/กำหนดการ) มีแค่ categoryId/categoryName
// (ไม่ได้เก็บสีติดไปด้วยตอนบันทึก) ให้ดึงสีปัจจุบันของประเภทงานนั้นมาแสดงแทนเสมอ — สีจะอัพเดตทันทีทุกจุดถ้า Super Admin เปลี่ยนสีทีหลัง
function buildCategoryColorMap(categories) {
  var map = {};
  (categories || []).forEach(function (c) { map[c.id] = c.color || '#3457d5'; });
  return map;
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

// คำนวณ "ปีการศึกษา/ภาคเรียนปัจจุบัน" จากวันที่จริงตอนนี้ (ปฏิทินการศึกษาไทยทั่วไป) — ใช้เป็นค่าเริ่มต้นของตัวกรองต่างๆ (V9.5)
// ปีการศึกษา X เริ่มพฤษภาคมปีปฏิทิน (X-543) ถึงเมษายนปีถัดไป: พ.ค.-ต.ค. = เทอม 1, พ.ย.-ธ.ค. = เทอม 2 (ปีการศึกษาเดียวกับเทอม 1),
// ม.ค.-มี.ค. = เทอม 2 (แต่เป็นปีการศึกษาที่เริ่มพฤษภาคมปีก่อนหน้า), เม.ย. = ภาคฤดูร้อน (ปีการศึกษาเดียวกับเทอม 2 ก่อนหน้า)
function currentAcademicTerm() {
  var now = new Date();
  var beYear = now.getFullYear() + 543;
  var month = now.getMonth() + 1; // 1-12
  if (month >= 5 && month <= 10) return { year: String(beYear), semester: '1' };
  if (month === 11 || month === 12) return { year: String(beYear), semester: '2' };
  if (month >= 1 && month <= 3) return { year: String(beYear - 1), semester: '2' };
  return { year: String(beYear - 1), semester: 'summer' }; // เมษายน
}
// ข้อความป้ายบอก "ตอนนี้คือปีการศึกษา/ภาคเรียนอะไร" จาก currentAcademicTerm() — ใช้แสดงในปฏิทินหน้าฮับครู (ตั้งแต่ V9.8)
// ตัดคำนำหน้า "ตอนนี้: " ออกตามที่ผู้ใช้ขอ (ตั้งแต่ V9.9) เหลือแค่ตัวข้อความภาคเรียน/ปีการศึกษาล้วนๆ
function currentTermLabel() {
  var t = currentAcademicTerm();
  var semText = t.semester === 'summer' ? 'ภาคฤดูร้อน' : ('ภาคเรียนที่ ' + t.semester);
  return semText + ' ปีการศึกษา ' + t.year;
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
        '<button type="button" class="modal-close-x" id="sharedConfirmCloseX" aria-label="ปิด">✕</button>' +
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
        '<button type="button" class="modal-close-x" id="sharedPwCloseX" aria-label="ปิด">✕</button>' +
        '<h3>เปลี่ยนรหัสผ่าน</h3>' +
        '<div id="sharedPwError" class="error-box" hidden></div>' +
        '<form id="sharedPwForm" style="text-align:left;">' +
          '<div class="field"><label for="sharedOldPw">รหัสผ่านเดิม</label><input id="sharedOldPw" type="password" required autocomplete="current-password" /></div>' +
          '<div class="field"><label for="sharedNewPw">รหัสผ่านใหม่</label><input id="sharedNewPw" type="password" required minlength="4" autocomplete="new-password" /></div>' +
          '<div class="field"><label for="sharedNewPwConfirm">ยืนยันรหัสผ่านใหม่</label><input id="sharedNewPwConfirm" type="password" required minlength="4" autocomplete="new-password" /></div>' +
          '<div class="modal-actions">' +
            '<button type="submit" class="btn btn-primary">บันทึก</button>' +
            '<button type="button" class="btn btn-ghost" id="sharedPwClose">ยกเลิก</button>' +
          '</div>' +
        '</form>' +
      '</div>' +
    '</div>' +
    '<div class="modal-backdrop" id="sharedAvatarModal" hidden>' +
      '<div class="modal-box">' +
        '<button type="button" class="modal-close-x" id="sharedAvatarCloseX" aria-label="ปิด">✕</button>' +
        '<h3>รูปโปรไฟล์</h3>' +
        '<div id="sharedAvatarError" class="error-box" hidden></div>' +
        '<div class="avatar-preview-wrap"><span class="profile-avatar avatar-preview-lg" id="sharedAvatarPreview"></span></div>' +
        '<p class="hint" style="text-align:center; margin-top:-6px;">ระบบจะย่อขนาดและบีบอัดรูปให้อัตโนมัติก่อนอัพโหลด</p>' +
        '<input type="file" id="sharedAvatarFileInput" accept="image/*" hidden />' +
        '<div class="modal-actions" style="flex-wrap:wrap;">' +
          '<button type="button" class="btn btn-secondary" id="sharedAvatarPickBtn">เลือกรูปภาพ</button>' +
          '<button type="button" class="btn btn-primary" id="sharedAvatarSaveBtn" hidden>บันทึก</button>' +
          '<button type="button" class="btn btn-danger" id="sharedAvatarRemoveBtn" hidden>ลบรูปโปรไฟล์</button>' +
          '<button type="button" class="btn btn-ghost" id="sharedAvatarClose">ปิด</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-backdrop" id="sharedExpireModal" hidden>' +
      '<div class="modal-box">' +
        '<button type="button" class="modal-close-x" id="sharedExpireCloseX" aria-label="ปิด">✕</button>' +
        '<h3>หมดเวลาการใช้งาน</h3>' +
        '<p style="color:var(--text-muted); font-size:0.9rem;">คุณอยู่ในระบบครบ 1 ชั่วโมงแล้ว เพื่อความปลอดภัยระบบได้นำคุณออกจากระบบโดยอัตโนมัติ กรุณาเข้าสู่ระบบใหม่อีกครั้ง</p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-primary" id="sharedExpireOk">เข้าสู่ระบบอีกครั้ง</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-backdrop" id="sharedProgressModal" hidden>' +
      '<div class="modal-box">' +
        '<button type="button" class="modal-close-x" id="sharedProgressCloseX" aria-label="ปิด" hidden>✕</button>' +
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
  var goToLoginFromExpire = function () { location.href = 'index.html?_=' + Date.now(); };
  document.getElementById('sharedExpireOk').addEventListener('click', goToLoginFromExpire);
  // X ของป็อปอัพหมดเวลาการใช้งานทำหน้าที่เดียวกับปุ่ม "เข้าสู่ระบบอีกครั้ง" เสมอ (ไม่ให้ปิดค้างไว้แล้วนั่งดูหน้าที่ session หมดอายุแล้วเฉยๆ)
  document.getElementById('sharedExpireCloseX').addEventListener('click', goToLoginFromExpire);

  document.getElementById('sharedPwClose').addEventListener('click', function () { hideModalEl(document.getElementById('sharedPwModal')); });
  document.getElementById('sharedPwCloseX').addEventListener('click', function () { hideModalEl(document.getElementById('sharedPwModal')); });
  document.getElementById('sharedPwForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    var errBox = document.getElementById('sharedPwError');
    errBox.hidden = true;
    var newPw = document.getElementById('sharedNewPw').value;
    var newPwConfirm = document.getElementById('sharedNewPwConfirm').value;
    if (newPw !== newPwConfirm) {
      errBox.textContent = 'รหัสผ่านใหม่ทั้งสองช่องไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง';
      errBox.hidden = false;
      return;
    }
    var ok = await askConfirm('ยืนยันเปลี่ยนรหัสผ่านของบัญชีนี้?', 'ยืนยันการเปลี่ยนรหัสผ่าน');
    if (!ok) return;
    var oldPw = document.getElementById('sharedOldPw').value;
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

  // ---------- ป็อปอัพรูปโปรไฟล์ ----------
  var _pendingAvatar = null; // ผลลัพธ์จาก resizeImageForAvatar ระหว่างที่ยังไม่กดบันทึก
  var avatarModal = document.getElementById('sharedAvatarModal');
  var avatarErrBox = document.getElementById('sharedAvatarError');
  var avatarPreview = document.getElementById('sharedAvatarPreview');
  var avatarSaveBtn = document.getElementById('sharedAvatarSaveBtn');
  var avatarRemoveBtn = document.getElementById('sharedAvatarRemoveBtn');
  var avatarFileInput = document.getElementById('sharedAvatarFileInput');

  function closeAvatarModal() { hideModalEl(avatarModal); }
  document.getElementById('sharedAvatarClose').addEventListener('click', closeAvatarModal);
  document.getElementById('sharedAvatarCloseX').addEventListener('click', closeAvatarModal);
  document.getElementById('sharedAvatarPickBtn').addEventListener('click', function () { avatarFileInput.click(); });

  avatarFileInput.addEventListener('change', async function () {
    var file = avatarFileInput.files && avatarFileInput.files[0];
    avatarFileInput.value = '';
    if (!file) return;
    avatarErrBox.hidden = true;
    try {
      var resized = await resizeImageForAvatar(file);
      _pendingAvatar = resized;
      avatarPreview.innerHTML = '<img src="' + resized.dataUrl + '" alt="" />';
      avatarSaveBtn.hidden = false;
    } catch (err) {
      avatarErrBox.textContent = err.message;
      avatarErrBox.hidden = false;
    }
  });

  avatarSaveBtn.addEventListener('click', async function () {
    if (!_pendingAvatar) return;
    avatarErrBox.hidden = true;
    var r = await withProgress('กำลังอัพโหลดรูปโปรไฟล์', function () {
      return uploadResizedAvatar(_pendingAvatar);
    }, { successLabel: 'อัพเดทรูปโปรไฟล์แล้ว' });
    if (r.ok) {
      _pendingAvatar = null;
      avatarSaveBtn.hidden = true;
      var s = getSession();
      if (s) { s.avatarUrl = r.data.avatarUrl; setSession(getToken(), s); }
      var topbarEl = document.getElementById('topbarAvatar');
      if (topbarEl) topbarEl.innerHTML = avatarInnerHtml(r.data.avatarUrl);
      avatarRemoveBtn.hidden = false;
      hideModalEl(avatarModal);
    } else {
      avatarErrBox.textContent = r.error.message;
      avatarErrBox.hidden = false;
    }
  });

  avatarRemoveBtn.addEventListener('click', async function () {
    var ok = await askConfirm('ลบรูปโปรไฟล์นี้? ระบบจะกลับไปใช้ไอคอนเริ่มต้นแทน', 'ยืนยันการลบรูปโปรไฟล์');
    if (!ok) return;
    avatarErrBox.hidden = true;
    var r = await withProgress('กำลังลบรูปโปรไฟล์', function () {
      return apiCall('profileRemoveAvatar', {});
    }, { successLabel: 'ลบรูปโปรไฟล์แล้ว' });
    if (r.ok) {
      var s2 = getSession();
      if (s2) { s2.avatarUrl = ''; setSession(getToken(), s2); }
      var topbarEl2 = document.getElementById('topbarAvatar');
      if (topbarEl2) topbarEl2.innerHTML = avatarInnerHtml('');
      avatarPreview.innerHTML = avatarInnerHtml('');
      avatarRemoveBtn.hidden = true;
      _pendingAvatar = null;
      avatarSaveBtn.hidden = true;
    } else {
      avatarErrBox.textContent = r.error.message;
      avatarErrBox.hidden = false;
    }
  });
}

function openChangePasswordModal() {
  ensureSharedModals();
  showModalEl(document.getElementById('sharedPwModal'));
}

function openAvatarModal() {
  ensureSharedModals();
  var session = getSession();
  document.getElementById('sharedAvatarError').hidden = true;
  document.getElementById('sharedAvatarPreview').innerHTML = avatarInnerHtml(session && session.avatarUrl);
  document.getElementById('sharedAvatarSaveBtn').hidden = true;
  document.getElementById('sharedAvatarRemoveBtn').hidden = !(session && session.avatarUrl);
  showModalEl(document.getElementById('sharedAvatarModal'));
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
    var closeXBtn = document.getElementById('sharedConfirmCloseX');
    function cleanup(val) {
      hideModalEl(modal);
      yesBtn.removeEventListener('click', onYes);
      noBtn.removeEventListener('click', onNo);
      closeXBtn.removeEventListener('click', onNo);
      resolve(val);
    }
    function onYes() { cleanup(true); }
    function onNo() { cleanup(false); }
    yesBtn.addEventListener('click', onYes);
    noBtn.addEventListener('click', onNo);
    closeXBtn.addEventListener('click', onNo);
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
  // X ซ่อนไว้ระหว่างกำลังทำงานอยู่โดยตั้งใจ (เช่นเดียวกับปุ่ม "ตกลง") เพื่อให้ผู้ใช้เห็นผลลัพธ์แน่นอนก่อนปิดป็อปอัพได้เสมอ
  document.getElementById('sharedProgressCloseX').hidden = true;
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
    var closeXBtn = document.getElementById('sharedProgressCloseX');
    okBtn.hidden = false;
    closeXBtn.hidden = false;
    function onOk() {
      okBtn.removeEventListener('click', onOk);
      closeXBtn.removeEventListener('click', onOk);
      hideModalEl(document.getElementById('sharedProgressModal'));
      resolve();
    }
    okBtn.addEventListener('click', onOk);
    closeXBtn.addEventListener('click', onOk);
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
    if (session.hasHub) links.push({ href: 'dashboard.html', label: 'หน้าแรก', key: 'dashboard' });
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
    topbarRoot.innerHTML =
      '<div class="topbar">' +
        '<button class="brand js-home-btn" type="button"><span class="js-brand-logo"><span class="logo-dot"></span></span> <span class="js-site-name">BNKAcademicHub</span></button>' +
        '<div class="topbar-right">' +
          '<nav class="topbar-nav">' + navHtml + '</nav>' +
          '<button class="refresh-btn" id="refreshDataBtn" type="button" title="รีเฟรชข้อมูล" aria-label="รีเฟรชข้อมูล">' +
            '<svg class="refresh-icon" viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>' +
          '</button>' +
          '<div class="profile-menu">' +
            '<button class="profile-trigger" id="profileTrigger" aria-expanded="false" type="button">' +
              '<span class="profile-avatar" id="topbarAvatar">' + avatarInnerHtml(session.avatarUrl) + '</span>' +
              '<span class="profile-name">' + escapeHtml(session.name) + '</span>' +
              '<span class="chevron">▾</span>' +
            '</button>' +
            '<div class="profile-dropdown" id="profileDropdown">' +
              '<div class="dd-header"><div class="dd-name">' + escapeHtml(session.name) + '</div><div class="dd-role">' + escapeHtml(roleLabel(session)) + '</div></div>' +
              '<div class="theme-switch-row"><span>Dark Mode</span><label class="switch"><input type="checkbox" id="themeToggleInput"><span class="slider"></span></label></div>' +
              '<div class="dd-divider"></div>' +
              '<button class="dd-item" id="ddChangeAvatar" type="button"><span class="dd-icon">🖼️</span> เปลี่ยนรูปโปรไฟล์</button>' +
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

    document.getElementById('ddChangeAvatar').addEventListener('click', function () {
      dropdown.classList.remove('open');
      openAvatarModal();
    });
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
// ยกเว้นหน้าล็อกอิน (index.html) ที่บังคับใช้ธีมสว่างเท่านั้นเสมอ ไม่ว่าจะเคยตั้งค่าธีมมืดไว้จากหน้าอื่นในเครื่องเดียวกันหรือไม่ก็ตาม
function _isLoginPage() {
  var p = location.pathname;
  return /\/index\.html$/.test(p) || /\/$/.test(p) || p === '';
}
// หน้าแสดงผลงานสาธารณะ (view.html) ก็บังคับใช้ธีมสว่างเท่านั้นเสมอเช่นกัน (ตั้งแต่ V9.9) — เป็นหน้าที่คนภายนอกเปิดดูได้โดยไม่ล็อกอิน
// ไม่ควรพึ่งค่า localStorage ของเบราว์เซอร์คนดู (ซึ่งอาจไม่ใช่เจ้าของบัญชีเลยด้วยซ้ำ) มากำหนดหน้าตาของหน้านี้
function _isForcedLightPage() {
  return _isLoginPage() || /\/view\.html$/.test(location.pathname);
}
applyTheme(_isForcedLightPage() ? 'light' : getTheme());
