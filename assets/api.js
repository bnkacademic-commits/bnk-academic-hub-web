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
// ⚠️ สำคัญ (ตั้งแต่ V11.8): ทุกครั้งที่แก้เลขนี้ ต้องไปแก้ "?v=..." ต่อท้าย assets/style.css และ assets/api.js ใน <link>/<script>
// ของทุกไฟล์ .html (index/dashboard/settings/summary/view) ให้ตรงกันด้วย — เป็นตัวกันแคชเก่า (cache-busting) เพราะเบราว์เซอร์/
// CDN ของโฮสติ้งบางเจ้ามักแคชไฟล์ .css/.js ชื่อเดิมไว้นาน ทำให้อัพโหลดไฟล์ใหม่ทับแล้วแต่ผู้ใช้ยังเห็นหน้าเว็บเวอร์ชันเก่าอยู่
// (แม้จะลบแคชเบราว์เซอร์ตัวเองแล้วก็ตาม ถ้า CDN กลางทางยังแคชอยู่) เปลี่ยนเลขท้าย query string ทุกเวอร์ชันบังคับให้โหลดใหม่เสมอ
// ตั้งแต่เวอร์ชัน 1.21.081026 เปลี่ยนรูปแบบเลขเวอร์ชันจาก "V<major>.<minor>" เป็น "1.<ลำดับรัน>.<DDMMYY วันที่ปล่อยเวอร์ชัน>"
// ตามที่ผู้ใช้ระบุ — เลขตรงกลางเป็นเลขรันต่อเนื่องทุกครั้งที่ปล่อยเวอร์ชันใหม่ (ไม่สนใจว่าเปลี่ยน D1/Worker หรือแก้แค่หน้าเว็บ)
// วันที่ท้ายคือวันที่ปล่อยเวอร์ชันนั้นจริง (ไม่ใช่วันที่เริ่มพัฒนา) ถ้าเลขรันไล่ไปถึง 99 แล้วจะล้นเป็น 100 ผู้ใช้ขอให้มาอนุมัติเองก่อนเปลี่ยนเป็น major ถัดไป (2.00)
var APP_VERSION = '1.40.101026';

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
  if (!json.ok) {
    // code (ตั้งแต่ V11.7): ติด err.code ไว้กับ Error ที่ throw ออกไปด้วยถ้า backend ส่งมา (เช่น 'SESSION_REPLACED')
    // เพื่อให้จุดที่เรียกใช้ตรวจจับ error เฉพาะเจาะจงได้ด้วยรหัส ไม่ต้องเทียบข้อความภาษาไทย (ดู startSessionWatch ด้านล่าง)
    var errMsg = json.error || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';
    // ตั้งแต่ 1.40.101026: "ไม่รู้จักคำสั่ง: xxx" = หน้าเว็บใหม่แต่ Worker บนเซิร์ฟเวอร์ยังเป็นโค้ดเก่า (ยังไม่ได้ deploy) — บอกวิธีแก้ให้ชัด
    var unk = /^ไม่รู้จักคำสั่ง:\s*(\S+)/.exec(errMsg);
    if (unk) errMsg = 'เซิร์ฟเวอร์ (Worker) ยังเป็นโค้ดเก่า ไม่มีคำสั่ง "' + unk[1] + '" — ต้องอัพเดตไฟล์ Worker เป็นชุดเดียวกับหน้าเว็บ (เวอร์ชัน ' + APP_VERSION + ') แล้ว Deploy Worker ใหม่ (ดู README ขั้นตอนอัพเดต) ก่อนใช้ฟีเจอร์นี้';
    var err = new Error(errMsg);
    err.code = json.code || null;
    throw err;
  }
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
// อัพเดตข้อมูลผู้ใช้ที่แคชไว้ใน localStorage ให้สดขึ้น โดย "ไม่แตะ" เวลา login (SESSION_LOGIN_AT_KEY) และ token เดิม
// (ตั้งแต่ 1.25.081026) — ต่างจาก setSession() ด้านบนตรงที่ setSession() รีเซ็ตตัวจับเวลาหมดอายุ 1 ชั่วโมงใหม่ทุกครั้ง ซึ่งไม่ใช่
// สิ่งที่ต้องการตอนแค่รีเฟรชข้อมูลโปรไฟล์ (เช่น ตำแหน่ง/กลุ่มสาระการเรียนรู้ที่เจ้าหน้าที่ฝ่ายวิชาการเพิ่งตั้งให้) กลางเซสชัน
function updateCachedSessionUser(user) {
  try { localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user)); } catch (e) { /* localStorage อาจถูกปิด */ }
}
// เรียก checkSession ครั้งเดียวเพื่อดึงข้อมูลผู้ใช้ปัจจุบันสดๆ จากเซิร์ฟเวอร์มาอัพเดตแคช แล้วคืนค่า session ที่อัพเดตแล้วกลับไป
// (ตั้งแต่ 1.25.081026) ใช้ที่หน้า memo.html เพื่อให้แน่ใจว่าตำแหน่ง/กลุ่มสาระการเรียนรู้ที่แสดงเป็นค่าล่าสุดเสมอ ไม่ใช่ค่าเก่า
// ที่ค้างมาตั้งแต่ตอน login ครั้งก่อน (ถ้าเรียกไม่สำเร็จ เช่น เน็ตสะดุด ก็ปล่อยผ่านคืนค่า session เดิมที่มีอยู่ไปเฉยๆ)
async function refreshSessionUser() {
  try {
    var data = await apiCall('checkSession', {});
    if (data && data.user) { updateCachedSessionUser(data.user); return data.user; }
  } catch (e) { /* ปล่อยผ่าน ใช้ค่าที่แคชไว้เดิม */ }
  return getSession();
}
function clearSession() {
  try {
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    localStorage.removeItem(SESSION_LOGIN_AT_KEY);
    localStorage.removeItem(THEME_KEY); // 1.40.101026: Dark Mode เป็นของบัญชี — ออกจากระบบแล้วไม่ทิ้งโหมดของคนนี้ไว้ให้คนถัดไปบนเครื่องเดียวกัน
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

// ---------- ป้องกันล็อกอินซ้อนกัน (ตั้งแต่ V11.7) ----------
// ตรวจเป็นระยะว่าบัญชีนี้ถูกเข้าสู่ระบบใหม่จากที่อื่น (เครื่อง/เบราว์เซอร์อื่น) มาแทนที่ session ปัจจุบันหรือยัง โดยเรียก
// action 'checkSession' เบาๆ ทุก 10 วินาที — ถ้า backend ตอบกลับด้วย code 'SESSION_REPLACED' (ดู requireAuth ใน
// worker/src/lib/util.js) แสดงว่ามีคนล็อกอินบัญชีนี้จากที่อื่นไปแล้ว จึงเด้งออกพร้อมป็อปอัพแจ้งเตือนทันที
// error อื่นๆ ระหว่างตรวจ (เช่น เครือข่ายสะดุดชั่วคราว) ปล่อยผ่านเฉยๆ รอตรวจรอบถัดไป ไม่ถือเป็นการเด้งออก
var SESSION_WATCH_INTERVAL_MS = 10 * 1000;
var _sessionWatchHandle = null;
function startSessionWatch() {
  if (_sessionWatchHandle) return; // กันเรียกซ้ำ (เช่น mountChrome ถูกเรียกมากกว่า 1 ครั้งในหน้าเดียว)
  _sessionWatchHandle = setInterval(async function () {
    if (!getToken()) return;
    try {
      await apiCall('checkSession', {});
    } catch (err) {
      if (err && err.code === 'SESSION_REPLACED') {
        stopSessionWatch();
        showSessionReplacedModal();
      }
    }
  }, SESSION_WATCH_INTERVAL_MS);
}
function stopSessionWatch() {
  if (_sessionWatchHandle) { clearInterval(_sessionWatchHandle); _sessionWatchHandle = null; }
}
function showSessionReplacedModal() {
  clearSession();
  if (_sessionTimeoutHandle) { clearTimeout(_sessionTimeoutHandle); _sessionTimeoutHandle = null; } // ไม่ต้องรอเด้งซ้ำจากตัวจับเวลาหมดอายุอีก
  ensureSharedModals();
  var modal = document.getElementById('sharedSessionReplacedModal');
  if (!modal) { location.href = 'index.html?_=' + Date.now(); return; }
  showModalEl(modal);
}

function homePageFor(session) {
  if (!session) return 'index.html';
  if (session.role === 'teacher') return 'dashboard.html';
  if (session.role === 'executive') return 'executive.html'; // ผู้บริหาร (ตั้งแต่ 1.32.101026): หน้าแรก = ปฏิทิน + สรุปภาพรวมการส่งงาน (อ่านอย่างเดียว)
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
// หน้าที่ผู้บริหารเข้าดูได้ด้วย (อ่านอย่างเดียว): สรุปรวมการส่งงาน, ประกาศและปฏิทิน (ตั้งแต่ 1.32.101026)
function requireViewerAccess() {
  var s = requireLogin();
  if (!s) return null;
  if (s.role !== 'admin' && s.role !== 'executive') { location.href = homePageFor(s); return null; }
  return s;
}
function requireAdminAccess() {
  var s = requireLogin();
  if (!s) return null;
  if (s.role !== 'admin') { location.href = homePageFor(s); return null; }
  return s;
}

// ตั้งแต่ 1.26.081026: ป้ายชื่อเจ้าหน้าที่แสดงฝ่ายที่สังกัดต่อท้ายคำว่า "เจ้าหน้าที่" (session.department มาจาก sanitizeUser
// ฝั่ง Worker) แทนชื่อ "เจ้าหน้าที่ฝ่ายวิชาการ" เดิมที่ hardcode ไว้ตัวเดียวสำหรับทุกบัญชี — ถ้ายังไม่ได้ตั้งฝ่ายไว้ (บัญชีเก่า/
// ยังไม่ได้กำหนด) จะแสดงแค่ "เจ้าหน้าที่" เฉยๆ
function roleLabel(session) {
  if (!session) return '';
  if (session.role === 'teacher') return 'ครู';
  if (session.role === 'executive') return session.position || 'ผู้บริหาร';
  if (session.role === 'admin') return session.hasHub ? ('เจ้าหน้าที่' + (session.department || '')) : 'Super Admin';
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
// Dark Mode ผูกกับบัญชี (ตั้งแต่ 1.40.101026): ตอน login Worker ส่งค่าที่บัญชีนี้เคยเลือกไว้มา (user.theme: 'dark' | 'light' | '' = ยังไม่เคยเลือก)
// หน้าเว็บตั้งค่าตามนั้นทันที (ไม่ให้โหมดของคนก่อนหน้าบนเครื่องเดียวกันค้างมา) — ยังไม่เคยเลือก = โหมดสว่าง
function applyAccountTheme(user) {
  var t = user && user.theme === 'dark' ? 'dark' : 'light';
  setTheme(t);
}
// เมื่อผู้ใช้กดสลับ Dark Mode เอง: ตั้งค่าบนหน้าเว็บทันที + บันทึกลงบัญชี (ส่งแบบไม่รอผล พลาดก็ไม่กระทบการใช้งาน) และอัพเดตค่าที่แคชใน session
function saveThemeToAccount(theme) {
  if (!getToken()) return;
  var s = getSession();
  if (s) { s.theme = theme; updateCachedSessionUser(s); }
  try { apiCall('setMyTheme', { theme: theme }).catch(function () {}); } catch (e) {}
}
function toggleTheme() {
  var next = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  saveThemeToAccount(next);
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
      return {
        siteName: 'BNKAcademicHub', iconDataUrl: '', logoDataUrl: '', summerEnabled: true, currentAcademicYear: '', currentSemester: '',
        schoolName: '', schoolDistrict: '', schoolProvince: '',
        memoHeadName: '', memoHeadPosition: '', memoDeputyName: '', memoDeputyPosition: '', memoDirectorName: '', memoDirectorPosition: ''
      };
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
    description: meta.description,
    customFieldValues: meta.customFieldValues
  });
  // ชื่อไฟล์จริงที่จะใช้อัพโหลด (ตั้งแต่ V11.7): Worker คำนวณให้แล้วจากประเภทงาน/ภาคเรียน/ปีการศึกษา (ดู uploadFileName ที่
  // teacherUploadPrepare คืนมา) แทนชื่อไฟล์เดิมจากเครื่องผู้ใช้ — เผื่อกรณี Worker เวอร์ชันเก่ายังไม่ส่งค่านี้มา จึงย้อนกลับไปใช้
  // ชื่อไฟล์เดิมได้เสมอ (fallback)
  var uploadFileName = prep.uploadFileName || file.name;
  var base64 = await fileToBase64(file);
  var relayText;
  try {
    var relayRes = await fetch(prep.relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ uploadToken: prep.uploadToken, base64: base64, filename: uploadFileName, mimeType: file.type })
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
    fileName: uploadFileName,
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
// targetUserId (ตั้งแต่ 1.33.101026): ถ้าระบุ = Super Admin อัพรูปให้บัญชีอื่น (adminAvatarUpload*) ไม่ระบุ = รูปของตัวเอง
async function uploadResizedAvatar(resized, targetUserId) {
  var approxBytes = Math.ceil(resized.base64.length * 3 / 4);
  var prep = await apiCall(targetUserId ? 'adminAvatarUploadPrepare' : 'profileAvatarUploadPrepare', targetUserId ? { userId: targetUserId, fileName: 'avatar.jpg', fileSize: approxBytes } : { fileName: 'avatar.jpg', fileSize: approxBytes });
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
  var finalizePayload = {
    fileId: result.fileId, fileUrl: result.url, directUrl: result.directUrl,
    fileName: 'avatar.jpg', mimeType: resized.mimeType
  };
  if (targetUserId) finalizePayload.userId = targetUserId;
  return apiCall(targetUserId ? 'adminAvatarUploadFinalize' : 'profileAvatarUploadFinalize', finalizePayload);
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
// จุดสีเล็กๆ แสดงหน้าชื่อประเภทงาน (ตั้งแต่ V9.7) — ใช้ร่วมกันทุกหน้าที่แสดงชื่อประเภทงาน (Hub ครู/สรุปรวม/ตั้งค่าระบบ)
function categoryDotHtml(color) {
  return '<span class="category-dot" style="background:' + escapeHtml(color || '#3457d5') + ';"></span>';
}
// สร้าง map { categoryId: color } จากรายการประเภทงาน — ใช้เมื่อรายการที่จะแสดง (ผลงาน/กำหนดการ) มีแค่ categoryId/categoryName
// (ไม่ได้เก็บสีติดไปด้วยตอนบันทึก) ให้ดึงสีปัจจุบันของประเภทงานนั้นมาแสดงแทนเสมอ — สีจะอัพเดตทันทีทุกจุดถ้า Super Admin เปลี่ยนสีทีหลัง
function buildCategoryColorMap(categories) {
  var map = {};
  (categories || []).forEach(function (c) { map[c.id] = c.color || '#3457d5'; _catDeptMap[c.id] = c.department || ''; });
  return map;
}
// ฝ่ายของประเภทงาน (ตั้งแต่ 1.40.101026) — buildCategoryColorMap เก็บ { categoryId: ชื่อฝ่าย } ไว้ด้วยทุกครั้งที่หน้าโหลดรายการประเภทงาน
// categoryDeptBadgeHtml(id) คืนป้าย "ฝ่ายวิชาการ" (ไม่ผูกฝ่าย/ไม่รู้จัก id = ไม่แสดงอะไร) ใช้ต่อท้ายชื่อประเภทงานทุกจุด
var _catDeptMap = {};
function categoryDeptBadgeHtml(categoryId) {
  var d = _catDeptMap[categoryId];
  return d ? ' <span class="cat-dept-badge">ฝ่าย' + escapeHtml(d) + '</span>' : '';
}
function categoryDeptSuffix(categoryId) {
  var d = _catDeptMap[categoryId];
  return d ? ' · ฝ่าย' + d : '';
}

// ---------- ชุดไอคอน Font Awesome — ตั้งแต่รอบปรับสไตล์เว็บทั้งระบบให้เหมือน bnksa-attendance (Tailwind + Font Awesome)
// เดิมใช้ SVG เส้นวาดเอง (ICON_PATHS) มาตั้งแต่ V-ถัดไปหลัง V10.1 เปลี่ยนมาใช้ไอคอน Font Awesome (โหลดจาก CDN ใน <head>
// ทุกหน้าแล้ว) แทน เพื่อให้ตรงกับชุดไลบรารีของเว็บต้นแบบ — คง API เดิม icon(name, size) ไว้ทุกจุดเรียกใช้เดิมไม่ต้องแก้
var ICON_FA = {
  home: 'fa-house', memo: 'fa-file-lines', summary: 'fa-chart-column', settings: 'fa-gear', calendar: 'fa-calendar-days',
  announce: 'fa-bullhorn', folder: 'fa-folder-open', tag: 'fa-tag', users: 'fa-users', trash: 'fa-trash',
  edit: 'fa-pen', plus: 'fa-plus', link: 'fa-link', checklist: 'fa-list-check', upload: 'fa-cloud-arrow-up',
  image: 'fa-image', key: 'fa-key', logout: 'fa-right-from-bracket', history: 'fa-clock-rotate-left',
  sun: 'fa-sun', palette: 'fa-palette', layout: 'fa-table-cells-large', pin: 'fa-thumbtack', clock: 'fa-clock',
  file: 'fa-file-lines', directory: 'fa-address-book'
};
function icon(name, size) {
  var s = size || 16;
  var fa = ICON_FA[name] || 'fa-circle';
  return '<i class="fas ' + fa + ' ui-icon" style="font-size:' + s + 'px" aria-hidden="true"></i>';
}
function formatDateThai(isoOrDateStr) {
  if (!isoOrDateStr) return '';
  var d = new Date(isoOrDateStr);
  if (isNaN(d.getTime())) return String(isoOrDateStr);
  var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}
// ขนาดไฟล์อ่านง่าย (ตั้งแต่ 1.40.101026) — ใช้ในแท็บ "ข้อมูลระบบ"
function formatBytes(n) {
  if (n === null || n === undefined || isNaN(Number(n))) return '-';
  var units = ['B', 'KB', 'MB', 'GB', 'TB'], i = 0, v = Number(n);
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return (i === 0 ? String(Math.round(v)) : v.toFixed(v >= 100 ? 0 : (v >= 10 ? 1 : 2))) + ' ' + units[i];
}
function formatDateTimeThai(isoStr) {
  if (!isoStr) return '';
  var d = new Date(isoStr);
  if (isNaN(d.getTime())) return String(isoStr);
  var hh = String(d.getHours()).padStart(2, '0');
  var mm = String(d.getMinutes()).padStart(2, '0');
  return formatDateThai(isoStr) + ' ' + hh + ':' + mm + ' น.';
}

// ตารางวันเริ่มภาคเรียน (ตั้งแต่ 1.40.101026) — Super Admin กำหนดเองในตั้งค่า → ทั่วไป เก็บเป็น 'MM-DD' ซ้ำทุกปี (ค่าเริ่มต้นตรงกับ Worker)
//   term1Start = เริ่มภาคเรียนที่ 1 (16 พ.ค.) · term2Start = เริ่มภาคเรียนที่ 2 (15 ต.ค.) · summerStart = เริ่มภาคฤดูร้อน (1 เม.ย. — ใช้เฉพาะเมื่อเปิดภาคฤดูร้อนไว้)
var DEFAULT_TERM_SCHEDULE = { term1Start: '05-16', term2Start: '10-15', summerStart: '04-01' };
function termScheduleOf(settings) {
  var ts = (settings && settings.termSchedule && typeof settings.termSchedule === 'object') ? settings.termSchedule : {};
  return {
    term1Start: ts.term1Start || DEFAULT_TERM_SCHEDULE.term1Start,
    term2Start: ts.term2Start || DEFAULT_TERM_SCHEDULE.term2Start,
    summerStart: ts.summerStart !== undefined ? ts.summerStart : DEFAULT_TERM_SCHEDULE.summerStart
  };
}
// คำนวณ "ปีการศึกษา/ภาคเรียนปัจจุบัน" จากวันที่จริง "ตามตารางวันเริ่มภาคเรียน" (โหมดอัตโนมัติ) — ไม่สนใจค่าที่ตั้งเอง (โหมด manual)
// ใช้ตรงๆ เมื่อต้องการ "ค่าตามเวลาจริง" ล้วนๆ (เช่น ปุ่มรีเฟรชตัวกรองเทอม/ปีในหน้าแสดงผลงานสาธารณะ) · settings (ไม่ส่ง = ค่าเริ่มต้น) · now (ไม่ส่ง = ตอนนี้)
// เทียบด้วยสตริง 'MM-DD' ของวันนี้กับวันเริ่มแต่ละเทอมตามลำดับในปีปฏิทิน:
//   ตั้งแต่ term2Start เป็นต้นไป = เทอม 2 ของปีการศึกษา = ปี พ.ศ. ปัจจุบัน · term1Start ถึงก่อน term2Start = เทอม 1 ของปี พ.ศ. ปัจจุบัน
//   ก่อน term1Start = ยังเป็นปีการศึกษาก่อนหน้า (ปี พ.ศ. − 1): ถ้าเปิดภาคฤดูร้อนและถึง summerStart แล้ว = ภาคฤดูร้อน ไม่งั้น = เทอม 2 ของปีก่อน
function trueCurrentAcademicTerm(settings, now) {
  now = now || new Date();
  var sch = termScheduleOf(settings);
  var summerOn = !settings || settings.summerEnabled !== false;
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var md = pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var beYear = now.getFullYear() + 543;
  if (md >= sch.term2Start) return { year: String(beYear), semester: '2' };
  if (md >= sch.term1Start) return { year: String(beYear), semester: '1' };
  if (summerOn && sch.summerStart && md >= sch.summerStart) return { year: String(beYear - 1), semester: 'summer' };
  return { year: String(beYear - 1), semester: '2' };
}
// "ปีการศึกษา/ภาคเรียนปัจจุบัน" ที่ใช้จริงทั่วระบบ (ค่าเริ่มต้นของตัวกรอง/ปฏิทิน/เช็คลิสต์/ป้ายเทอมในหน้าฮับ) — ตั้งแต่ 1.40.101026 มี 2 โหมดตาม settings.termMode:
//   'manual' = ใช้ปี+ภาคเรียนที่ Super Admin กรอกไว้ (currentAcademicYear/currentSemester) · 'auto' = คำนวณจากวันที่ตามตารางวันเริ่มภาคเรียน
async function currentAcademicTerm() {
  var s = await getSiteSettings();
  var mode = s && (s.termMode === 'manual' || s.termMode === 'auto') ? s.termMode : ((s && s.currentAcademicYear && s.currentSemester) ? 'manual' : 'auto');
  if (mode === 'manual' && s.currentAcademicYear && s.currentSemester) {
    return { year: String(s.currentAcademicYear), semester: String(s.currentSemester) };
  }
  return trueCurrentAcademicTerm(s);
}
// ข้อความป้ายบอก "ตอนนี้คือปีการศึกษา/ภาคเรียนอะไร" จาก currentAcademicTerm() — ใช้แสดงในปฏิทินหน้าฮับครู (ตั้งแต่ V9.8)
// ตัดคำนำหน้า "ตอนนี้: " ออกตามที่ผู้ใช้ขอ (ตั้งแต่ V9.9) เหลือแค่ตัวข้อความภาคเรียน/ปีการศึกษาล้วนๆ — เป็น async ตั้งแต่ V12.0 (ดู currentAcademicTerm() ด้านบน)
async function currentTermLabel() {
  var t = await currentAcademicTerm();
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
    '<div class="modal-backdrop" id="sharedSessionReplacedModal" hidden>' +
      '<div class="modal-box">' +
        '<button type="button" class="modal-close-x" id="sharedSessionReplacedCloseX" aria-label="ปิด">✕</button>' +
        '<h3>เข้าสู่ระบบจากที่อื่น</h3>' +
        '<p style="color:var(--text-muted); font-size:0.9rem;">บัญชีนี้เพิ่งถูกเข้าสู่ระบบจากอุปกรณ์หรือเบราว์เซอร์อื่น เพื่อความปลอดภัยระบบอนุญาตให้ใช้งานได้ทีละ 1 ที่เท่านั้น จึงนำคุณออกจากระบบที่นี่โดยอัตโนมัติ</p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-primary" id="sharedSessionReplacedOk">เข้าสู่ระบบอีกครั้ง</button>' +
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

  // ป็อปอัพ "เข้าสู่ระบบจากที่อื่น" (ตั้งแต่ V11.7) — ปุ่ม "เข้าสู่ระบบอีกครั้ง" และ X ทำหน้าที่เดียวกันเสมอ เหมือนป็อปอัพหมดเวลาการใช้งานด้านบน
  document.getElementById('sharedSessionReplacedOk').addEventListener('click', goToLoginFromExpire);
  document.getElementById('sharedSessionReplacedCloseX').addEventListener('click', goToLoginFromExpire);

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
  var isExec = !!session && session.role === 'executive';
  var isAdmin = !!session && session.role === 'admin';
  // ตั้งแต่ 1.29.091026: "จัดทำบันทึกข้อความ" เป็นแท็บในเมนูบนสุด (ไปหน้า memo.html ในแท็บเบราว์เซอร์เดิม ไม่เปิดหน้าใหม่) ของทุกบัญชีที่มี
  // หน้าฮับ (ครู และเจ้าหน้าที่ role='admin' + hasHub) — ครูเดิมไม่มีเมนูบนสุดเลย จึงเพิ่ม "หน้าแรก" ให้ด้วยเพื่อให้แถบแท็บสมบูรณ์
  if (session && (session.role === 'teacher' || (isAdmin && session.hasHub))) {
    links.push({ href: 'dashboard.html', label: 'หน้าแรก', key: 'dashboard', icon: 'home' });
    links.push({ href: 'memo.html', label: 'จัดทำบันทึกข้อความ', key: 'memo', icon: 'memo' });
  }
  // ผู้บริหาร (ตั้งแต่ 1.32.101026): หน้าแรกของตัวเอง = ปฏิทิน + สรุปภาพรวม (executive.html) — ไม่มีหน้าฮับ ไม่ส่งงาน
  if (isExec) links.push({ href: 'executive.html', label: 'หน้าแรก', key: 'executive', icon: 'home' });
  if (isAdmin || isExec) {
    links.push({ href: 'summary.html', label: 'สรุปรวมการส่งงาน', key: 'summary', icon: 'summary' });
    // "ประกาศและปฏิทิน" (ตั้งแต่ 1.32.101026): ย้ายแท็บ "ปฏิทิน" และ "ประกาศ" ออกจากหน้าตั้งค่ามารวมกันเป็นแท็บบนสุดนี้ — เจ้าหน้าที่/Super Admin จัดการได้
    // ผู้บริหารดูได้อย่างเดียว (ครูไม่มีแท็บนี้เพราะเห็นปฏิทินและประกาศในหน้าแรกอยู่แล้ว)
    links.push({ href: 'announce.html', label: 'ประกาศและปฏิทิน', key: 'announce', icon: 'announce' });
  }
  // "ทำเนียบบุคลากรโรงเรียน" (ตั้งแต่ 1.32.101026): ทุกบทบาทที่ล็อกอินเห็นแท็บนี้ — mountChrome ซ่อนให้เองถ้า Super Admin ตั้งไว้ว่า "ปิด" (settings.directoryMode)
  if (session) links.push({ href: 'directory.html', label: 'ทำเนียบบุคลากร', key: 'directory', icon: 'directory' });
  if (isAdmin) {
    // หมายเหตุ: เมนู "จัดการ Layout" (V11.1) ถูกยกเลิกตั้งแต่ V11.5 — ทั้งรูปแบบการ์ด (V11.3) และลำดับการแสดงผล (V11.5)
    // ย้ายไปรวมอยู่ในหน้า "ตั้งค่าระบบ" (ตั้งแต่ 1.32.101026 อยู่ในแท็บ "ข้อมูลหลัก") (Super Admin เท่านั้น)
    links.push({ href: 'settings.html', label: 'ตั้งค่าระบบ', key: 'settings', icon: 'settings' });
  }
  return links;
}


// ---------- แถบเมนูด้านซ้าย (ตั้งแต่ 1.40.101026 — สไตล์ Google Keep สำหรับทุกบัญชี/ทุกหน้าที่มี topbar) ----------
// - ปุ่ม 3 ขีดหน้าโลโก้ (#navToggle): คอม/แท็บเล็ต = สลับ "เปิดค้างไว้ (ปักหมุด)" ↔ "ย่อเหลือแต่ไอคอน" จำค่าไว้ใน localStorage (bnkah_nav_pinned)
//   มือถือ (< 768px) = เปิด/ปิดเป็นลิ้นชักทับหน้าจอ มีฉากดำจางๆ ด้านหลัง
// - ตอนย่ออยู่ ถ้าเอาเมาส์ชี้ที่แถบจะกางเต็มออกมาทับเนื้อหาชั่วคราว (ไม่ดันเนื้อหา) พอเอาเมาส์ออกก็ย่อกลับ
// - ค่าเริ่มต้นเมื่อยังไม่เคยเลือก: จอกว้าง ≥ 1280px เปิดค้าง, จอเล็กกว่านั้นย่อ
var NAV_PIN_KEY = 'bnkah_nav_pinned';
function _navIsMobile() { return window.matchMedia('(max-width: 767px)').matches; }
function _navGetPinned() {
  try { var v = localStorage.getItem(NAV_PIN_KEY); if (v === '1') return true; if (v === '0') return false; } catch (e) { /* ใช้ค่าเริ่มต้น */ }
  return window.innerWidth >= 1280;
}
function mountSideNav(links, activePage) {
  var old = document.getElementById('app-sidenav');
  if (old) old.remove();
  var oldBd = document.getElementById('app-sidenav-backdrop');
  if (oldBd) oldBd.remove();
  var aside = document.createElement('aside');
  aside.id = 'app-sidenav';
  aside.className = 'sidenav no-print';
  aside.setAttribute('aria-label', 'เมนูหลัก');
  aside.innerHTML = '<nav class="sidenav-list">' + links.map(function (l) {
    return '<a href="' + l.href + '" class="sidenav-item' + (l.key === activePage ? ' active' : '') + '" title="' + escapeHtml(l.label) + '"' + (l.key === activePage ? ' aria-current="page"' : '') + '>' +
      '<span class="sidenav-icon">' + icon(l.icon, 19) + '</span><span class="sidenav-label">' + escapeHtml(l.label) + '</span></a>';
  }).join('') + '</nav>';
  var backdrop = document.createElement('div');
  backdrop.id = 'app-sidenav-backdrop';
  backdrop.className = 'sidenav-backdrop no-print';
  document.body.appendChild(aside);
  document.body.appendChild(backdrop);
  document.body.classList.add('has-sidenav');

  var toggle = document.getElementById('navToggle');
  var pinned = _navGetPinned();
  var hovering = false;
  var mobileOpen = false;
  function render() {
    var mobile = _navIsMobile();
    var open = mobile ? mobileOpen : (pinned || hovering);
    document.body.classList.toggle('nav-pinned', !mobile && pinned);
    document.body.classList.toggle('nav-mobile-open', mobile && mobileOpen);
    aside.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', (mobile ? mobileOpen : pinned) ? 'true' : 'false');
  }
  function syncTopbarHeight() {
    var tb = document.querySelector('.topbar');
    if (tb) document.documentElement.style.setProperty('--topbar-h', tb.offsetHeight + 'px');
  }
  toggle.addEventListener('click', function () {
    if (_navIsMobile()) { mobileOpen = !mobileOpen; }
    else { pinned = !pinned; hovering = false; try { localStorage.setItem(NAV_PIN_KEY, pinned ? '1' : '0'); } catch (e) { /* ไม่เป็นไร */ } }
    render();
  });
  backdrop.addEventListener('click', function () { mobileOpen = false; render(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mobileOpen) { mobileOpen = false; render(); } });
  aside.addEventListener('mouseenter', function () { if (!_navIsMobile() && window.matchMedia('(hover: hover)').matches) { hovering = true; render(); } });
  aside.addEventListener('mouseleave', function () { hovering = false; render(); });
  aside.addEventListener('focusin', function () { if (!_navIsMobile()) { hovering = true; render(); } });
  aside.addEventListener('focusout', function () { hovering = false; render(); });
  window.addEventListener('resize', function () { if (!_navIsMobile()) mobileOpen = false; syncTopbarHeight(); render(); });
  syncTopbarHeight();
  if (window.ResizeObserver) { var tbEl = document.querySelector('.topbar'); if (tbEl) new ResizeObserver(syncTopbarHeight).observe(tbEl); }
  render();
}

function mountChrome(activePage) {
  var session = getSession();
  var topbarRoot = document.getElementById('app-topbar');
  if (topbarRoot && session) {
    var links = navLinksFor(session);
    // ตั้งแต่ 1.40.101026: เมนูทั้งหมดย้ายจากแถบบนสุดมาเป็นแถบเมนูด้านซ้าย (สไตล์ Google Keep) — ปุ่ม 3 ขีดหน้าโลโก้ = ปักหมุดเปิดค้าง/ย่อ,
    // ตอนย่อให้ชี้เมาส์เพื่อกางเต็มชั่วคราว, มือถือเป็นลิ้นชักเลื่อนออกมา (ดู mountSideNav ด้านล่าง)
    topbarRoot.innerHTML =
      '<div class="topbar">' +
        '<div class="topbar-left">' +
          '<button class="nav-toggle" id="navToggle" type="button" aria-label="เปิด/ปิดเมนู" aria-expanded="false" aria-controls="app-sidenav"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button>' +
          '<button class="brand js-home-btn" type="button"><span class="js-brand-logo"><span class="logo-dot"></span></span> <span class="js-site-name">BNKAcademicHub</span></button>' +
        '</div>' +
        '<div class="topbar-right">' +
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
              '<button class="dd-item" id="ddChangeAvatar" type="button"><span class="dd-icon">' + icon('image', 16) + '</span> เปลี่ยนรูปโปรไฟล์</button>' +
              '<button class="dd-item" id="ddChangePw" type="button"><span class="dd-icon">' + icon('key', 16) + '</span> เปลี่ยนรหัสผ่าน</button>' +
              '<button class="dd-item danger" id="ddLogout" type="button"><span class="dd-icon">' + icon('logout', 16) + '</span> ออกจากระบบ</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.querySelector('.js-home-btn').addEventListener('click', function () { location.href = homePageFor(session); });
    mountSideNav(links, activePage);
    // ซ่อนเมนู "ทำเนียบบุคลากร" ถ้า Super Admin ปิดทำเนียบไว้ (settings.directoryMode = 'off') — ตั้งแต่ 1.32.101026
    getSiteSettings().then(function (st) {
      if (st && st.directoryMode === 'off') {
        var dl = document.querySelector('.sidenav a[href="directory.html"]');
        if (dl && activePage !== 'directory') dl.remove();
      }
    });

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
    themeChk.addEventListener('change', function () { var t = themeChk.checked ? 'dark' : 'light'; setTheme(t); saveThemeToAccount(t); });

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
    startSessionWatch(); // ตรวจป้องกันล็อกอินซ้อนกันเป็นระยะ (ตั้งแต่ V11.7) — เริ่มพร้อมกับทุกหน้าที่มี topbar (ต้องล็อกอินอยู่แล้วเสมอ)
  }
  mountFooter();
  applyBranding();
}

// Footer มาตรฐานทุกหน้า (ตั้งแต่ 1.29.091026 ตามที่ผู้ใช้กำหนดไว้): ชื่อโรงเรียน, ลิขสิทธิ์ (ปีอัตโนมัติ เป็น พ.ศ.), ลิขสิทธิ์ผลงานเป็นของเจ้าของ
// ผลงาน, ผู้พัฒนา, ระบุว่าใช้ AI ช่วยพัฒนา + เวอร์ชัน, ลิงก์นโยบายความเป็นส่วนตัว/แจ้งปัญหา (mailto) — หน้า privacy.html ใช้ฟังก์ชันนี้ร่วมกัน
var SUPPORT_EMAIL = 'Tear.Jeerasak@gmail.com'; // อีเมลผู้ดูแลระบบ (แจ้งปัญหา/ติดต่อเรื่องข้อมูลส่วนบุคคล)
function mountFooter() {
  var root = document.getElementById('app-footer');
  if (!root) return;
  var yearBE = new Date().getFullYear() + 543;
  root.innerHTML =
    '<div class="site-footer">' +
      '<div class="footer-school">โรงเรียนบุ่งคล้านคร</div>' +
      '<div>© ' + yearBE + ' โรงเรียนบุ่งคล้านคร สงวนลิขสิทธิ์</div>' +
      '<div>ผลงานในระบบเป็นลิขสิทธิ์ของเจ้าของผลงาน</div>' +
      '<div>Developed by Jeerasak Chomphuwattana</div>' +
      '<div>Built with AI assistance · v' + escapeHtml(APP_VERSION) + '</div>' +
      '<div class="footer-links"><a href="privacy.html">นโยบายความเป็นส่วนตัว</a> · ' +
        '<a href="mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('แจ้งปัญหาการใช้งาน BNKAcademicHub') + '">แจ้งปัญหาการใช้งาน</a></div>' +
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
