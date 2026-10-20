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
// 1.79: รุ่น Worker ขั้นต่ำที่หน้าเว็บรุ่นนี้ต้องการ (เปลี่ยนเฉพาะรุ่นที่แก้ไฟล์ Worker) — หน้าภาพรวมระบบเตือนเมื่อ Worker เก่ากว่า
var WORKER_MIN_VERSION = '1.82';
var APP_VERSION = '1.82.0.191026';

var SESSION_TOKEN_KEY = 'bnkah_token';
var SESSION_USER_KEY = 'bnkah_user';
var SESSION_LOGIN_AT_KEY = 'bnkah_login_at';
var THEME_KEY = 'bnkah_theme';
// 1.69: ออกจากระบบเมื่อ "ไม่มีการใช้งาน" ครบ 60 นาที (เดิม = ครบ 1 ชั่วโมงหลังล็อกอินเสมอ) · เตือนล่วงหน้า 2 นาที
var SESSION_TIMEOUT_MS = 60 * 60 * 1000;
var SESSION_IDLE_WARN_MS = 2 * 60 * 1000;
var SESSION_ACTIVE_KEY = 'bnkah_last_active'; // เด้งออกอัตโนมัติเมื่ออยู่ในระบบครบ 1 ชั่วโมง (ฝั่งหน้าเว็บ แยกจากอายุ token ฝั่ง backend)

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
    // ตั้งแต่ 1.41.111026: "ไม่รู้จักคำสั่ง: xxx" = หน้าเว็บใหม่แต่ Worker บนเซิร์ฟเวอร์ยังเป็นโค้ดเก่า (ยังไม่ได้ deploy) — บอกวิธีแก้ให้ชัด
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
    localStorage.setItem(SESSION_ACTIVE_KEY, String(Date.now()));
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
    localStorage.removeItem(SESSION_ACTIVE_KEY);
    localStorage.removeItem(THEME_KEY); // 1.41.111026: Dark Mode เป็นของบัญชี — ออกจากระบบแล้วไม่ทิ้งโหมดของคนนี้ไว้ให้คนถัดไปบนเครื่องเดียวกัน
  } catch (e) {}
}
// ออกจากระบบแล้วรีเฟรชหน้าเว็บ 1 ครั้งเสมอ (นำทางไปหน้าล็อกอินแบบโหลดใหม่จริง ไม่ใช้แคชหน้าเดิม)
function logout() {
  clearSession();
  location.href = 'index.html?_=' + Date.now();
}

// ---------- เซสชันหมดเวลาอัตโนมัติเมื่ออยู่ในระบบครบ 1 ชั่วโมง ----------
var _sessionTimeoutHandle = null;
// เวลาใช้งานล่าสุดเก็บใน localStorage (ใช้ร่วมกันทุกแท็บ) — ขยับเมาส์/คลิก/พิมพ์/เลื่อน/แตะ = ใช้งาน (บันทึกไม่ถี่กว่า 10 วินาทีครั้ง)
// ระหว่างป็อปอัพความคืบหน้า (อัพโหลด/บันทึก) ทำงานอยู่ นับเป็นการใช้งาน · ตรวจทุก 15 วินาที + ตอนกลับมาที่แท็บ
var _idleTimer = null, _idleLastWrite = 0, _progressBusy = 0, _idleWarnShown = false;
function idleTimeoutMs() { return Number(window.__BNKAH_IDLE_MS) || SESSION_TIMEOUT_MS; }
function idleWarnMs() { return Number(window.__BNKAH_IDLE_WARN_MS) || SESSION_IDLE_WARN_MS; }
function lastActiveAt() {
  try { return parseInt(localStorage.getItem(SESSION_ACTIVE_KEY) || localStorage.getItem(SESSION_LOGIN_AT_KEY) || '0', 10) || 0; } catch (e) { return 0; }
}
function markActive(force) {
  var now = Date.now();
  if (!force && now - _idleLastWrite < Math.min(10000, idleWarnMs() / 5)) return;
  _idleLastWrite = now;
  try { localStorage.setItem(SESSION_ACTIVE_KEY, String(now)); } catch (e) { /* ไม่เป็นไร */ }
  if (_idleWarnShown) hideIdleWarning();
}
function isIdleFor(ms) { return Date.now() - lastActiveAt() >= ms; }
// 1.80: เข้าสู่ระบบอัตโนมัติ — ไม่ออกจากระบบเมื่อนิ่ง 60 นาที (token ฝั่ง Worker หมดอายุเองเมื่อไม่ได้ใช้งานเกิน 7 วัน)
function isKeepLogin() { var s = getSession(); return !!(s && s.keepLogin); }
function checkIdle() {
  if (!getToken()) return;
  if (isKeepLogin()) { if (_idleWarnShown) hideIdleWarning(); return; }
  if (_progressBusy > 0) { markActive(true); return; }
  var idle = Date.now() - lastActiveAt();
  if (idle >= idleTimeoutMs()) { hideIdleWarning(); forceSessionExpire(); return; }
  if (idle >= idleTimeoutMs() - idleWarnMs()) showIdleWarning(); else if (_idleWarnShown) hideIdleWarning();
}
function scheduleSessionTimeout() {
  try {
    if (_idleTimer) return;
    if (!lastActiveAt()) markActive(true);
    if (isIdleFor(idleTimeoutMs()) && !isKeepLogin()) { forceSessionExpire(); return; } // กลับมาหลังพักเครื่อง/ปิดจอนานเกินกำหนด
    ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'].forEach(function (ev) {
      window.addEventListener(ev, function () { if (!_idleWarnShown || ev !== 'mousemove') markActive(false); }, { passive: true, capture: true });
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden) checkIdle(); });
    _idleTimer = setInterval(checkIdle, Math.min(15000, Math.max(1000, Math.floor(idleWarnMs() / 4))));
  } catch (e) { /* localStorage อาจถูกปิด: ไม่ตั้งเวลาหมดอายุอัตโนมัติ */ }
}
// ป็อปอัพเตือนก่อนหมดเวลา (นับถอยหลัง) — กด "ใช้งานต่อ" หรือใช้งานใดๆ (ยกเว้นแค่ขยับเมาส์ผ่าน) = นับใหม่
var _idleCountdown = null;
function showIdleWarning() {
  ensureSharedModals();
  var m = document.getElementById('sharedIdleModal');
  if (!m) return;
  var tick = function () {
    var left = Math.max(0, idleTimeoutMs() - (Date.now() - lastActiveAt()));
    var sec = Math.ceil(left / 1000);
    var el = document.getElementById('sharedIdleLeft');
    if (el) el.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    if (left <= 0) checkIdle();
  };
  tick();
  if (!_idleWarnShown) { _idleWarnShown = true; showModalEl(m); _idleCountdown = setInterval(tick, 1000); }
}
function hideIdleWarning() {
  _idleWarnShown = false;
  if (_idleCountdown) { clearInterval(_idleCountdown); _idleCountdown = null; }
  var m = document.getElementById('sharedIdleModal');
  if (m && !m.hidden) hideModalEl(m);
}
function forceSessionExpire() {
  stopSessionWatch();
  if (_idleTimer) { clearInterval(_idleTimer); _idleTimer = null; }
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
// 1.69: ทุก 30 วินาที (เดิม 10) และเฉพาะตอนที่มีการใช้งานภายใน 2 นาทีที่ผ่านมา — ลดคำขอไป Worker · ใช้งานต่อหลังนิ่ง = ตรวจทันที
// คำตอบมี token ใหม่ (ต่ออายุอัตโนมัติ) -> เก็บแทนของเดิม
var SESSION_WATCH_INTERVAL_MS = 30 * 1000;
var SESSION_WATCH_ACTIVE_MS = 2 * 60 * 1000;
var _sessionWatchHandle = null;
function startSessionWatch() {
  if (_sessionWatchHandle) return; // กันเรียกซ้ำ (เช่น mountChrome ถูกเรียกมากกว่า 1 ครั้งในหน้าเดียว)
  // 1.56: ไม่ตรวจตอนแท็บถูกซ่อน (สลับไปแท็บอื่น/พับจอ) — ลดจำนวนคำขอไปยัง Worker (โควตาฟรี 100,000 ครั้ง/วัน)
  // แล้วตรวจทันทีเมื่อกลับมาที่แท็บ จึงยังเด้งออกได้ทันเวลาเหมือนเดิม
  var check = async function (force) {
    if (!getToken() || document.hidden) return;
    if (force !== true && isIdleFor(Number(window.__BNKAH_WATCH_ACTIVE_MS) || SESSION_WATCH_ACTIVE_MS)) return;
    try {
      var r = await apiCall('checkSession', {});
      if (r && r.token && getToken()) { try { localStorage.setItem(SESSION_TOKEN_KEY, r.token); } catch (e) { /* ไม่เป็นไร */ } }
      applyTopBadges(r); // 1.75: ตัวเลขแดงบนกระดิ่ง
    } catch (err) {
      if (err && err.code === 'SESSION_REPLACED') {
        stopSessionWatch();
        showSessionReplacedModal();
      }
    }
  };
  _sessionWatchHandle = setInterval(check, Number(window.__BNKAH_WATCH_MS) || SESSION_WATCH_INTERVAL_MS);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && _sessionWatchHandle) check(true); });
  // กลับมาใช้งานหลังนิ่งเกิน 2 นาที = ตรวจทันที (ไม่ต้องรอรอบถัดไป)
  var wasIdle = false;
  setInterval(function () { if (isIdleFor(SESSION_WATCH_ACTIVE_MS)) wasIdle = true; }, 15000);
  ['mousedown', 'keydown', 'touchstart'].forEach(function (ev) { window.addEventListener(ev, function () { if (wasIdle && _sessionWatchHandle) { wasIdle = false; check(true); } }, { passive: true, capture: true }); });
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
  if (session.devHome) return session.devHome; // เฉพาะเครื่องทดสอบ (Worker ตั้ง DEV_SA_HOME)
  return 'overview.html'; // Super Admin (ไม่มีหน้าฮับ) — 1.79: หน้าภาพรวมระบบ (เดิม summary.html)
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
  // 1.41.111026: เจ้าหน้าที่ = สมาชิกกลุ่มบริหารงานที่ได้สิทธิ์แอดมิน — ป้ายแสดงชื่อกลุ่มเต็ม เช่น "เจ้าหน้าที่กลุ่มบริหารงานวิชาการ"
  if (session.role === 'admin') return session.hasHub ? ('เจ้าหน้าที่' + groupLabel(session.department)) : 'Super Admin';
  return '';
}

// ข้อมูลบัญชีในเมนูมุมขวาบน (1.46.121026 — ผู้ใช้ขอแยกเป็นบรรทัดละเรื่อง): ประเภทบัญชี / กลุ่มบริหารงาน / กลุ่มสาระการเรียนรู้
// คืน array ของ { label, value } — แสดงเฉพาะเรื่องที่เกี่ยวกับบัญชีนั้น (ผู้บริหาร/Super Admin ไม่มีกลุ่มบริหารงาน/กลุ่มสาระ)
function accountInfoLines(session) {
  if (!session) return [];
  var lines = [];
  var isExec = session.role === 'executive';
  var isSuper = session.role === 'admin' && !session.hasHub;
  var type = session.role === 'teacher' ? 'ครู' : isExec ? 'ผู้บริหาร' : (isSuper ? 'Super Admin' : 'เจ้าหน้าที่');
  lines.push({ label: 'ประเภทบัญชี', value: type + (isExec && session.position ? ' (' + session.position + ')' : '') });
  if (!isExec && !isSuper) {
    lines.push({ label: 'กลุ่มบริหารงาน', value: session.department ? groupLabel(session.department) : 'ไม่ระบุ' });
    lines.push({ label: 'กลุ่มสาระฯ', value: session.subjectGroup || 'ไม่ระบุ' });
  }
  return lines;
}

// ---------- Theme (dark/light) ----------
function getTheme() {
  try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
}
function applyTheme(theme) {
  // 1.66: 3 ธีม — 'light' กระดาษขาว (เริ่มต้น) · 'sepia' ถนอมตา · 'dark' กลางคืน
  document.documentElement.setAttribute('data-theme', theme === 'dark' || theme === 'sepia' ? theme : 'light');
}
function setTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch (e) {}
  applyTheme(theme);
}
// Dark Mode ผูกกับบัญชี (ตั้งแต่ 1.41.111026): ตอน login Worker ส่งค่าที่บัญชีนี้เคยเลือกไว้มา (user.theme: 'dark' | 'light' | '' = ยังไม่เคยเลือก)
// หน้าเว็บตั้งค่าตามนั้นทันที (ไม่ให้โหมดของคนก่อนหน้าบนเครื่องเดียวกันค้างมา) — ยังไม่เคยเลือก = โหมดสว่าง
function applyAccountTheme(user) {
  var t = user && (user.theme === 'dark' || user.theme === 'sepia') ? user.theme : 'light';
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
  Array.prototype.forEach.call(document.querySelectorAll('[data-theme-pick]'), function (b) { b.classList.toggle('on', b.getAttribute('data-theme-pick') === next); });
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
        __fallback: true, // โหลดค่าตั้งค่าไม่สำเร็จ — ห้ามเอาไปทับค่าแบรนด์ที่จำไว้ (ดู applyBranding)
        siteName: 'BNKAcademicHub', iconDataUrl: '', logoDataUrl: '', summerEnabled: true, currentAcademicYear: '', currentSemester: '',
        schoolName: '', schoolDistrict: '', schoolProvince: '',
        memoHeadName: '', memoHeadPosition: '', memoDeputyName: '', memoDeputyPosition: '', memoDirectorName: '', memoDirectorPosition: ''
      };
    });
  }
  _settingsCache = await _settingsPromise;
  return _settingsCache;
}

// 1.53.121026: จำค่าแบรนด์ล่าสุด (ชื่อเว็บ/โลโก้/โลโก้แบบยาว/แสดงชื่อในแถบด้านบน) ไว้ในเครื่อง แล้ววาดแถบด้านบนจากค่าที่จำไว้ทันทีตอนเปิดหน้า
// (ไม่ต้องรอโหลดค่าตั้งค่า — โลโก้/ชื่อเว็บไม่กระพริบเปลี่ยนเวลาเปลี่ยนหน้า) แล้วค่อยอัพเดตตามค่าจริงเมื่อโหลดเสร็จ
var BRAND_CACHE_KEY = 'bnkah_brand';
function cachedBrand() { try { return JSON.parse(localStorage.getItem(BRAND_CACHE_KEY) || 'null'); } catch (e) { return null; } }
function cacheBrand(s) {
  try { localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify({ siteName: s.siteName || '', logoDataUrl: s.logoDataUrl || '', logoWideDataUrl: s.logoWideDataUrl || '', loginHeroDataUrl: s.loginHeroDataUrl || '', topbarShowName: s.topbarShowName !== false, navOrder: Array.isArray(s.navOrder) ? s.navOrder : [], themeMode: s.themeMode || 'system', themeColor: s.themeColor || '', departmentColors: s.departmentColors || {} })); } catch (e) { /* เต็ม/ไม่มี localStorage — ไม่เป็นไร */ }
}
// วาดส่วนแบรนด์ (ไม่ต้องรอ) จาก object ค่าตั้งค่า
function renderBrand(s) {
  if (!s) return;
  renderLoginHero(s);
  document.querySelectorAll('.js-site-name').forEach(function (el) { el.textContent = s.siteName || 'BNKAcademicHub'; });
  document.querySelectorAll('.js-brand-logo').forEach(function (el) {
    // โลโก้แบบยาว (settings.logoWideDataUrl, 1.52) แสดงแทนโลโก้เล็ก เฉพาะแถบด้านบนสุด (ปุ่ม .js-home-btn)
    // ชื่อเว็บในแถบด้านบน แสดง/ซ่อนตามสวิตช์ settings.topbarShowName (1.53 — อัพโลโก้แบบยาวแล้วระบบปิดให้อัตโนมัติ)
    var homeBtn = el.closest && el.closest('.js-home-btn');
    if (homeBtn) {
      homeBtn.classList.toggle('has-wide-logo', !!s.logoWideDataUrl);
      homeBtn.classList.toggle('hide-site-name', s.topbarShowName === false);
      homeBtn.setAttribute('aria-label', (s.siteName || 'BNKAcademicHub') + ' — หน้าแรก');
      if (s.logoWideDataUrl) {
        var cur = el.querySelector('img.brand-logo-wide');
        if (!cur || cur.getAttribute('src') !== s.logoWideDataUrl) el.innerHTML = '<img src="' + s.logoWideDataUrl + '" class="brand-logo-wide" alt="' + escapeHtml(s.siteName || 'BNKAcademicHub') + '" />';
        return;
      }
    }
    if (s.logoDataUrl) {
      var cur2 = el.querySelector('img.brand-logo');
      if (!cur2 || cur2.getAttribute('src') !== s.logoDataUrl) el.innerHTML = '<img src="' + s.logoDataUrl + '" class="brand-logo" alt="โลโก้" />';
    } else {
      el.innerHTML = '<span class="logo-dot"></span>';
    }
  });
}
// ---------- ธีมสี (ตั้งแต่ 1.56) ----------
// settings.themeMode: 'system' = สีเดียวทั้งระบบ (themeColor) · 'department' = แยกสีตามกลุ่มบริหารงาน (departmentColors[ชื่อกลุ่ม])
// บัญชีที่ไม่สังกัดกลุ่ม/กลุ่มยังไม่ตั้งสี = themeColor · หน้าเข้าสู่ระบบ = themeLoginColor (ว่าง = themeColor)
// จากสีเดียว คำนวณชุดสี --primary / --primary-dark / --primary-light / --primary-rgb / --grad-1..3 ทั้งโหมดสว่างและโหมดมืด
// แล้วจำ CSS ไว้ใน localStorage — สคริปต์ใน <head> ทุกหน้าใส่สีจากที่จำไว้ทันที (ไม่เห็นสีเก่าแวบตอนเปลี่ยนหน้า)
var THEME_DEFAULT_COLOR = '#0b6fcc';
var THEME_CSS_KEY = 'bnkah_theme_css';
var THEME_CSS_LOGIN_KEY = 'bnkah_theme_css_login';
var THEME_PRESETS = [
  { name: 'ฟ้า', c: '#0b6fcc' }, { name: 'น้ำเงิน', c: '#2563eb' }, { name: 'คราม (สีเดิม)', c: '#4f46e5' }, { name: 'ม่วง', c: '#7c3aed' },
  { name: 'ชมพู', c: '#db2777' }, { name: 'แดง', c: '#dc2626' }, { name: 'ส้ม', c: '#c2410c' }, { name: 'เขียว', c: '#15803d' }, { name: 'เขียวอมฟ้า', c: '#0f766e' }
];
function themeHexOk(h) { return /^#[0-9a-f]{6}$/i.test(String(h || '')); }
function themeRgb(h) { h = String(h).replace('#', ''); return [0, 2, 4].map(function (i) { return parseInt(h.substr(i, 2), 16); }); }
function themeMix(rgb, to, t) { return rgb.map(function (v, i) { return Math.round(v + (to[i] - v) * t); }); }
function themeHex(rgb) { return '#' + rgb.map(function (v) { return ('0' + Math.max(0, Math.min(255, v)).toString(16)).slice(-2); }).join(''); }
// ความต่างของสีกับตัวหนังสือสีขาว (WCAG) — ต่ำกว่า 4.5 ตัวหนังสือบนปุ่มเริ่มอ่านยาก
function themeContrastWithWhite(h) {
  var c = themeRgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 1.05 / (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] + 0.05);
}
function themePalette(hex) {
  var b = themeRgb(themeHexOk(hex) ? hex : THEME_DEFAULT_COLOR), W = [255, 255, 255], K = [0, 0, 0];
  return {
    light: { p: themeHex(b), d: themeHex(themeMix(b, K, 0.2)), l: themeHex(themeMix(b, W, 0.9)) },
    dark: { p: themeHex(themeMix(b, W, 0.1)), d: themeHex(themeMix(b, W, 0.42)), l: 'rgba(' + b.join(', ') + ', 0.22)' },
    rgb: b.join(' '), g1: themeHex(themeMix(b, K, 0.14)), g2: themeHex(b), g3: themeHex(themeMix(b, W, 0.22))
  };
}
function themeCss(hex) {
  var t = themePalette(hex);
  return ':root{--primary:' + t.light.p + ';--primary-dark:' + t.light.d + ';--primary-light:' + t.light.l + ';--primary-rgb:' + t.rgb +
    ';--grad-1:' + t.g1 + ';--grad-2:' + t.g2 + ';--grad-3:' + t.g3 + '}' +
    ':root[data-theme="dark"]{--primary:' + t.dark.p + ';--primary-dark:' + t.dark.d + ';--primary-light:' + t.dark.l + '}';
}
// สีของบัญชีที่ล็อกอินอยู่ (หรือของหน้าเข้าสู่ระบบ)
function resolveThemeColor(s, forLogin) {
  s = s || {};
  var base = themeHexOk(s.themeColor) ? s.themeColor : THEME_DEFAULT_COLOR;
  if (s.themeMode !== 'department') return base;
  if (forLogin) return themeHexOk(s.themeLoginColor) ? s.themeLoginColor : base;
  var u = getSession();
  var dc = u && u.department && s.departmentColors && s.departmentColors[u.department];
  return themeHexOk(dc) ? dc : base;
}
function setThemeCss(css) {
  var st = document.getElementById('bnkahThemeVars');
  if (!st) { st = document.createElement('style'); st.id = 'bnkahThemeVars'; document.head.appendChild(st); }
  if (st.textContent !== css) st.textContent = css;
}
function applyThemeColor(s) {
  var forLogin = document.body && document.body.classList.contains('login-page');
  var css = themeCss(resolveThemeColor(s, forLogin));
  setThemeCss(css);
  try { localStorage.setItem(forLogin ? THEME_CSS_LOGIN_KEY : THEME_CSS_KEY, css); } catch (e) { /* ไม่เป็นไร */ }
}
// ป้ายกลุ่มบริหารงานตามสีของกลุ่ม (1.58: แสดงสีของกลุ่มเสมอ ไม่ขึ้นกับรูปแบบธีมของระบบ) — ใส่ใน tag ที่ต้องการ: '<span class="x"' + deptColorAttr(dept) + '>'
// ตั้งตัวแปร --dp* ให้ CSS (.dept-colored) สลับ --primary/--primary-dark/--primary-light ภายในป้ายนั้นทั้งโหมดสว่าง/มืด
function deptThemeColor(dept, s) {
  s = s || _settingsCache || cachedBrand() || {};
  if (!dept || !s.departmentColors) return '';
  var c = s.departmentColors[dept] || s.departmentColors[String(dept).replace(/^กลุ่มบริหารงาน/, '')];
  return themeHexOk(c) ? c : '';
}
function deptColorAttr(dept, s) {
  var c = deptThemeColor(dept, s);
  if (!c) return '';
  var t = themePalette(c);
  return ' data-dept-color="' + c + '" style="--dp:' + t.light.p + ';--dp-d:' + t.light.d + ';--dp-l:' + t.light.l + ';--dpk:' + t.dark.p + ';--dpk-d:' + t.dark.d + ';--dpk-l:' + t.dark.l + '"';
}
// 1.55.131026: รูปหน้าเข้าสู่ระบบ (settings.loginHeroDataUrl) แสดงแทนโลโก้ + ชื่อเว็บ + คำบรรยายที่หัวการ์ด (.login-hero ใน index.html)
// index.html มีสคริปต์สั้นๆ ใส่รูปจากค่าที่จำไว้ (bnkah_brand) ทันทีหลังหัวการ์ดถูกสร้าง — ไม่เห็นหัวสีม่วงแวบก่อนรูปขึ้น
function renderLoginHero(s) {
  var hero = document.querySelector('.login-hero');
  if (!hero) return;
  var url = s.loginHeroDataUrl || '';
  hero.classList.toggle('has-image', !!url);
  var im = hero.querySelector('img.login-hero-img');
  if (url) {
    if (!im) { im = document.createElement('img'); im.className = 'login-hero-img'; hero.appendChild(im); }
    if (im.getAttribute('src') !== url) im.setAttribute('src', url);
    im.alt = s.siteName || 'BNKAcademicHub';
  } else if (im) { im.remove(); }
}
async function applyBranding() {
  var s = await getSiteSettings();
  if (!s.__fallback) { cacheBrand(s); renderBrand(s); applyThemeColor(s); reorderSideNav(s.navOrder); }
  if (s.siteName && document.title) {
    document.title = document.title.replace(/BNKAcademicHub/, s.siteName);
  }
  if (s.iconDataUrl) {
    var link = document.querySelector('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = s.iconDataUrl;
  }
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
  if (meta.onStage) meta.onStage('upload');
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
  if (meta.onStage) meta.onStage('finalize');
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
// 1.65: สีของประเภทงาน = สีของกลุ่มบริหารงานที่ผูกไว้ (ตั้งค่าที่ "กลุ่มบริหารงาน") — ไม่มีช่องเลือกสีตอนสร้าง/แก้ไขประเภทงานแล้ว
// ประเภทงานที่ยังไม่ผูกกลุ่ม/กลุ่มยังไม่ตั้งสี = สีที่เคยเก็บไว้ (ค่าเริ่มต้น #3457d5)
// 1.71: รูปแบบการ์ดผลงานเหลือ 3 แบบ — แปลงค่าเดิม: book/bookInline → 'bookInline' (ไฟล์ใหญ่) · frame → 'frame' (ไฟล์ปานกลาง)
// · ''/research/pin/compact/อื่นๆ → '' (ไฟล์เล็ก)
function normalizeTemplate(t) {
  t = String(t || '');
  if (t === 'book' || t === 'bookInline') return 'bookInline';
  if (t === 'frame') return 'frame';
  return '';
}
function categoryColor(c) {
  c = c || {};
  return (c.department && deptThemeColor(c.department)) || c.color || '#3457d5';
}
// 1.66: กลุ่มของประกาศ — ป้าย/สี (ว่าง = ประกาศจากโรงเรียน ใช้สีธีมหลัก)
function annGroupInfo(dept) {
  return { label: dept ? groupLabel(dept) : 'โรงเรียน', color: dept ? (deptThemeColor(dept) || '') : '' };
}
function buildCategoryColorMap(categories) {
  var map = {};
  (categories || []).forEach(function (c) { map[c.id] = categoryColor(c); _catDeptMap[c.id] = c.department || ''; });
  return map;
}
// ฝ่ายของประเภทงาน (ตั้งแต่ 1.41.111026) — buildCategoryColorMap เก็บ { categoryId: ชื่อฝ่าย } ไว้ด้วยทุกครั้งที่หน้าโหลดรายการประเภทงาน
// categoryDeptBadgeHtml(id) คืนป้าย "ฝ่ายวิชาการ" (ไม่ผูกฝ่าย/ไม่รู้จัก id = ไม่แสดงอะไร) ใช้ต่อท้ายชื่อประเภทงานทุกจุด
var _catDeptMap = {};
function categoryDeptBadgeHtml(categoryId) {
  var d = _catDeptMap[categoryId];
  return d ? ' <span class="cat-dept-badge"' + deptColorAttr(d) + '>' + escapeHtml(groupLabel(d)) + '</span>' : ''; // 1.61: สีของกลุ่ม
}
function categoryDeptSuffix(categoryId) {
  var d = _catDeptMap[categoryId];
  return d ? ' · ' + groupLabel(d) : '';
}
// ชื่อ "กลุ่มบริหารงาน" (ตั้งแต่ 1.41.111026) — ระบบเก็บเฉพาะส่วนท้ายของชื่อ (เช่น 'วิชาการ') แล้วต่อคำนำหน้าตอนแสดงผลเสมอ
// (ข้อมูลที่เคยตั้งเป็น "ฝ่ายวิชาการ" เดิมจึงขึ้นเป็น "กลุ่มบริหารงานวิชาการ" ทันที) ถ้าชื่อมีคำนำหน้าอยู่แล้วไม่ต่อซ้ำ
var GROUP_PREFIX = 'กลุ่มบริหารงาน';
function groupLabel(name) {
  var n = String(name || '').trim();
  if (!n) return '';
  return n.indexOf(GROUP_PREFIX) === 0 ? n : GROUP_PREFIX + n;
}
function normalizeGroupName(v) {
  var n = String(v || '').replace(/\s+/g, ' ').trim();
  if (n.indexOf(GROUP_PREFIX) === 0) n = n.slice(GROUP_PREFIX.length).trim();
  return n.slice(0, 60);
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
  file: 'fa-file-lines', directory: 'fa-address-book', orders: 'fa-file-signature', certs: 'fa-award', gallery: 'fa-images'
};
function icon(name, size) {
  var s = size || 16;
  var fa = ICON_FA[name] || 'fa-circle';
  return '<i class="fas ' + fa + ' ui-icon" style="font-size:' + s + 'px" aria-hidden="true"></i>';
}
// 1.58: วันที่วันนี้ ('YYYY-MM-DD' ตามเวลาเครื่อง) + แสดงวันที่แบบไทยข้างช่อง <input type="date"> (ช่องวันที่ของเบราว์เซอร์แสดง ค.ศ.)
function todayYmd() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function syncDateThai(inputId, outId) {
  var i = document.getElementById(inputId), o = document.getElementById(outId);
  if (!i || !o) return;
  o.textContent = i.value ? '(' + formatDateThai(i.value) + ')' : '(ไม่ระบุ)';
}
// 1.57: ป้ายภาคเรียน + ป้ายปีการศึกษา แยกกันชัดเจน — ภาคเรียนที่ 1 = ป้ายทึบสีหลัก · ภาคเรียนที่ 2 = ป้ายขอบสีหลัก · ภาคฤดูร้อน = ป้ายสีส้ม · ปีการศึกษา = ป้ายกลาง
// opts.short: "ปี 2569" แทน "ปีการศึกษา 2569" (ใช้ในคอลัมน์แคบ)
function termTagsHtml(semester, academicYear, opts) {
  opts = opts || {};
  var sem = String(semester || '');
  var cls = sem === 'summer' ? 'ts' : sem === '2' ? 't2' : 't1';
  var label = sem === 'summer' ? 'ภาคฤดูร้อน' : 'ภาคเรียนที่ ' + sem;
  return '<span class="term-tag ' + cls + '">' + escapeHtml(label) + '</span>' +
    (academicYear ? '<span class="year-tag">' + (opts.short ? 'ปี ' : 'ปีการศึกษา ') + escapeHtml(String(academicYear)) + '</span>' : '');
}
// 1.63: โหลดข้อมูลทีละปีการศึกษา + จำผลไว้ (เปลี่ยนกลับมาปีเดิมไม่ต้องโหลดซ้ำ) — fetchYear(year) คืน Promise ('' = ทุกปี)
// ---------- 1.79: แถบตัวกรองมาตรฐานของคลังคำสั่ง/คลังเกียรติบัตร/คลังรูปภาพ/หน้าสาธารณะ ----------
// โครง: .flt > input.flt-q + button.flt-toggle + .flt-panel (select ทั้งหมด + .flt-clear) · ตามด้วย .flt-chips และ .flt-meta (.flt-count + hint)
// จอใหญ่ = แถวเดียว · มือถือ = ช่องค้นหา + ปุ่ม "ตัวกรอง" (ตัวเลข = กรองอยู่กี่อย่าง) กดแล้วแผงเลื่อนขึ้นจากด้านล่าง
// opts.defaults(): { selectId: ค่าเริ่มต้น } (คำนวณใหม่ทุกครั้ง เช่น ปีการศึกษาปัจจุบัน) · opts.unit: 'รายการ'
function filterBarHtml(o) {
  // o: { id, search: {id, placeholder}, fields: [{id, label, html}], countId, hintId }
  return '<div class="flt" id="' + o.id + '">' +
    '<input type="search" class="flt-q" id="' + o.search.id + '" placeholder="' + escapeHtml(o.search.placeholder) + '" aria-label="ค้นหา" />' +
    '<button type="button" class="flt-toggle" aria-haspopup="dialog"><i class="fa-solid fa-sliders" aria-hidden="true"></i> ตัวกรอง <span class="flt-n" hidden></span></button>' +
    '<div class="flt-backdrop"></div>' +
    '<div class="flt-panel" role="group" aria-label="ตัวกรอง">' +
      '<div class="flt-head"><span><i class="fa-solid fa-sliders" aria-hidden="true"></i> ตัวกรอง</span><button type="button" class="modal-close-x flt-x" aria-label="ปิด">✕</button></div>' +
      o.fields.map(function (f) { return '<label class="flt-f"><span>' + escapeHtml(f.label) + '</span>' + f.html + '</label>'; }).join('') +
      '<div class="flt-acts"><button type="button" class="btn btn-close flt-clear" hidden><i class="fa-solid fa-xmark" aria-hidden="true"></i> ล้างตัวกรอง</button><button type="button" class="btn btn-success flt-done">แสดงผล</button></div>' +
    '</div></div>' +
    '<div class="flt-chips" id="' + o.id + 'Chips"></div>' +
    '<div class="flt-meta"><span class="flt-count" id="' + (o.countId || o.id + 'Count') + '"></span>' + (o.hintId ? '<span class="year-scope-hint" id="' + o.hintId + '" hidden></span>' : '') + '</div>';
}
function initFilterBar(el, opts) {
  if (typeof el === 'string') el = document.getElementById(el);
  opts = opts || {};
  var panel = el.querySelector('.flt-panel'), chips = document.getElementById(el.id + 'Chips');
  var last = { n: 0 };
  function defs() { return (opts.defaults && opts.defaults()) || {}; }
  function selects() { return Array.from(panel.querySelectorAll('select')); }
  function active() { var d = defs(); return selects().filter(function (s) { return (d[s.id] !== undefined ? String(d[s.id]) : '') !== s.value; }); }
  function setVal(s, v) { if (s.value === v) return; s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); }
  function open(on) {
    el.classList.toggle('open', !!on);
    document.documentElement.classList.toggle('flt-lock', !!on);
  }
  el.querySelector('.flt-toggle').addEventListener('click', function () { open(!el.classList.contains('open')); });
  el.querySelector('.flt-x').addEventListener('click', function () { open(false); });
  el.querySelector('.flt-done').addEventListener('click', function () { open(false); });
  el.querySelector('.flt-backdrop').addEventListener('click', function () { open(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && el.classList.contains('open')) open(false); });
  el.querySelector('.flt-clear').addEventListener('click', function () {
    var d = defs();
    selects().forEach(function (s) { setVal(s, d[s.id] !== undefined ? String(d[s.id]) : ''); });
    var q = el.querySelector('.flt-q'); if (q.value) { q.value = ''; q.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  if (chips) chips.addEventListener('click', function (e) {
    var b = e.target.closest('[data-flt-reset]'); if (!b) return;
    var s = document.getElementById(b.getAttribute('data-flt-reset')); var d = defs();
    if (s) setVal(s, d[s.id] !== undefined ? String(d[s.id]) : '');
  });
  function sync() {
    var act = active(), n = act.length;
    var badge = el.querySelector('.flt-n'); badge.hidden = !n; badge.textContent = n;
    el.querySelector('.flt-clear').hidden = !n && !el.querySelector('.flt-q').value;
    if (chips) chips.innerHTML = act.map(function (s) {
      var t = s.selectedOptions[0] ? s.selectedOptions[0].textContent : s.value;
      return '<button type="button" data-flt-reset="' + s.id + '">' + escapeHtml(t) + ' <i class="fa-solid fa-xmark" aria-hidden="true"></i></button>';
    }).join('');
  }
  el.addEventListener('change', sync);
  el.addEventListener('input', sync);
  return {
    // n = จำนวนที่พบ · extra = ข้อความต่อท้าย (เช่น "· 12 ใบ") — ขอบเขตปี/ภาคเรียนเติมให้เอง
    update: function (n, extra) {
      last.n = n; sync();
      var c = document.getElementById(el.id + 'Count') || el.parentNode.querySelector('.flt-count');
      var scope = selects().filter(function (s) { return /Year$|Sem$/.test(s.id) && s.value; }).map(function (s) { return s.selectedOptions[0] ? s.selectedOptions[0].textContent : ''; }).filter(Boolean);
      if (c) c.innerHTML = n == null ? '' : 'พบ <b>' + Number(n).toLocaleString('th-TH') + '</b> ' + escapeHtml(opts.unit || 'รายการ') + (extra ? ' ' + escapeHtml(extra) : '') + (scope.length ? ' · ' + escapeHtml(scope.join(' · ')) : '');
      el.querySelector('.flt-done').textContent = n == null ? 'แสดงผล' : 'แสดง ' + n + ' ' + (opts.unit || 'รายการ');
    },
    sync: sync,
    close: function () { open(false); }
  };
}
// ตัวเลือก "ทุกกลุ่ม" แบบ 2 หมวด: กลุ่มบริหารงาน (ค่า 'd:<ชื่อ>') + กลุ่มสาระการเรียนรู้ (ค่า = ชื่อกลุ่มสาระ · '__none' = ไม่มีกลุ่มสาระ)
function groupFilterOptions(departments, subjects, withNone) {
  return '<option value="">ทุกกลุ่ม</option>' +
    ((departments || []).length ? '<optgroup label="กลุ่มบริหารงาน">' + departments.map(function (d) { return '<option value="d:' + escapeHtml(d) + '">' + escapeHtml(groupLabel(d)) + '</option>'; }).join('') + '</optgroup>' : '') +
    ((subjects || []).length || withNone ? '<optgroup label="กลุ่มสาระการเรียนรู้">' + (subjects || []).map(function (g) { return '<option value="' + escapeHtml(g) + '">กลุ่มสาระฯ ' + escapeHtml(g) + '</option>'; }).join('') + (withNone ? '<option value="__none">ไม่มีกลุ่มสาระฯ</option>' : '') + '</optgroup>' : '');
}
function groupFilterMatch(v, department, subject) {
  if (!v) return true;
  if (v.indexOf('d:') === 0) return department === v.slice(2);
  if (v === '__none') return !subject;
  return subject === v;
}
function makeYearCache(fetchYear) {
  var cache = {};
  return {
    get: function (year, force) { var k = String(year || ''); if (force || !cache[k]) { cache[k] = Promise.resolve().then(function () { return fetchYear(k); }); cache[k].catch(function () { delete cache[k]; }); } return cache[k]; },
    clear: function () { cache = {}; },
    has: function (year) { return !!cache[String(year || '')]; }
  };
}
// 1.63: แสดงรายการทีละ LIST_PAGE แถว + ปุ่ม "แสดงเพิ่ม" (ใช้ data-more ให้หน้าเรียกเพิ่มจำนวนเอง)
var LIST_PAGE = 50;
// 1.70: บอก "แสดง N จาก M รายการ" + ปุ่ม "แสดงเพิ่ม" และ "แสดงทั้งหมด" (data-more-all — หน้าที่เรียกใช้ตั้งจำนวนที่แสดง = ทั้งหมด)
function listMoreHtml(shown, total) {
  if (shown >= total) return '';
  var left = total - shown;
  return '<div class="list-more"><div class="list-count">แสดง ' + shown + ' จาก ' + total + ' รายการ</div>' +
    '<button type="button" class="btn btn-secondary btn-sm" data-more="1"><i class="fa-solid fa-chevron-down"></i> แสดงเพิ่ม ' + Math.min(LIST_PAGE, left) + ' รายการ</button>' +
    '<button type="button" class="btn btn-ghost btn-sm" data-more="all" data-more-all="1"><i class="fa-solid fa-angles-down"></i> แสดงทั้งหมด (' + total + ')</button></div>';
}
// ข้อความแจ้งระหว่างโหลดปีการศึกษาอื่น/ทุกปี
function yearLoadingHtml(year) {
  return '<div class="loading">' + (year ? 'กำลังโหลดข้อมูลปีการศึกษา ' + escapeHtml(year) + '...' : 'กำลังโหลดข้อมูลทุกปีการศึกษา — อาจใช้เวลาสักครู่...') + '</div>';
}
// 1.60: เลขที่เกียรติบัตรภายใน — ตรงกับ formatCertNo ใน worker/src/handlers/certs.js ({ปีการศึกษา} {เลขที่} {ภาคเรียน})
// 1.67: {ปี พ.ศ.} = ปีพุทธศักราชของวันที่ในเกียรติบัตร (beYear) — ไม่ส่งมา = ใช้ year
function formatCertNo(format, digits, year, num, semester, beYear) {
  var d = Math.max(1, Math.min(8, Number(digits) || 4));
  var n = String(num); while (n.length < d) n = '0' + n;
  var f = String(format || 'บนค. {ปีการศึกษา}/{เลขที่}');
  if (f.indexOf('{เลขที่}') === -1) f += ' {เลขที่}';
  return f.replace(/\{ปีการศึกษา\}/g, year).replace(/\{ปี พ\.ศ\.\}/g, beYear || year).replace(/\{เลขที่\}/g, n).replace(/\{ภาคเรียน\}/g, semester === 'summer' ? 'ฤดูร้อน' : String(semester || '')).replace(/\s+/g, ' ').trim();
}
// 1.57: จำนวนวันที่เหลือถึงวันสุดท้ายของกำหนดส่ง (นับตามวันที่ ไม่สนเวลา) — คืน { days, text, cls } หรือ null
// ---------- 1.81: กิจกรรมในปฏิทิน (หน้าแรกครู/เจ้าหน้าที่ + หน้าผู้บริหาร) ----------
// กิจกรรม = แถบชื่อในช่องวัน (สีตามกลุ่มเจ้าของ) · กำหนดส่งงาน = จุดสีเหมือนเดิม · "ทำซ้ำทุกปี" ฉายซ้ำวัน-เดือนเดิมในปีถัดๆ ไป
var SUBJECT_GROUP_COLORS = { 'ภาษาไทย': '#dc2626', 'คณิตศาสตร์': '#2563eb', 'วิทยาศาสตร์และเทคโนโลยี': '#0891b2', 'สังคมศึกษา ศาสนา และวัฒนธรรม': '#ca8a04', 'สุขศึกษาและพลศึกษา': '#ea580c', 'ศิลปะ': '#db2777', 'การงานอาชีพ': '#65a30d', 'ภาษาต่างประเทศ': '#c026d3' };
function isActivityEv(e) { return !!e && e.kind === 'activity'; }
function activityColor(e) {
  if (e.ownerType === 'subject') return SUBJECT_GROUP_COLORS[e.ownerGroup] || '#7c3aed';
  return deptThemeColor(e.ownerGroup) || '#16a34a';
}
function activityOwnerLabel(e) { return e.ownerType === 'subject' ? 'กลุ่มสาระการเรียนรู้' + e.ownerGroup : groupLabel(e.ownerGroup); }
function activityOwnerBadgeHtml(e) {
  if (!e.ownerGroup) return '';
  return e.ownerType === 'subject' ? '<span class="evl-gb sub">กลุ่มสาระฯ ' + escapeHtml(e.ownerGroup) + '</span>' : '<span class="evl-gb">' + escapeHtml(groupLabel(e.ownerGroup)) + '</span>';
}
function activityTimeText(e) { return e.timeStart ? e.timeStart + (e.timeEnd ? '–' + e.timeEnd : '') + ' น.' : ''; }
function eventRangeText(e) { return e.endDate && e.endDate !== e.date ? formatDateThai(e.date) + ' – ' + formatDateThai(e.endDate) : formatDateThai(e.date); }
// เพิ่มกิจกรรม "ทำซ้ำทุกปี" ของปีถัดไปที่ทับช่วง fromYmd–toYmd (id = <id>@<ปี ค.ศ.>) — ไม่ฉายย้อนไปก่อนปีที่เพิ่ม
function expandRepeatEvents(events, fromYmd, toYmd) {
  var out = (events || []).slice(), y0 = +String(fromYmd).slice(0, 4), y1 = +String(toYmd).slice(0, 4);
  (events || []).forEach(function (e) {
    if (!isActivityEv(e) || !e.repeatYearly || !e.date) return;
    var by = +e.date.slice(0, 4), end = e.endDate || e.date, span = +end.slice(0, 4) - by;
    for (var y = Math.max(y0 - 1, by + 1); y <= y1; y++) {
      var d = y + e.date.slice(4), ed = (y + span) + end.slice(4);
      if (ed < fromYmd || d > toYmd) continue;
      out.push(Object.assign({}, e, { id: e.id + '@' + y, origId: e.id, date: d, endDate: ed, projected: true }));
    }
  });
  return out;
}
// แถบกิจกรรมในช่องวัน (สูงสุด 2 แถบ + "+N")
function activityBarsHtml(acts) {
  if (!acts.length) return '';
  return '<div class="cal-acts">' + acts.slice(0, 2).map(function (e) {
    return '<span class="cal-act" style="background:' + activityColor(e) + '" title="' + escapeHtml(e.title) + '">' + escapeHtml(e.title) + '</span>';
  }).join('') + (acts.length > 2 ? '<span class="cal-act-more">+' + (acts.length - 2) + '</span>' : '') + '</div>';
}
// รายละเอียดกิจกรรมในป็อปอัพวันที่
function activityDayHtml(e) {
  var c = activityColor(e), tt = activityTimeText(e);
  return '<div class="day-ev day-ev-act">' +
    '<span class="day-ev-bar" style="background:' + c + '"></span>' +
    '<div class="day-ev-main">' +
      '<div class="day-ev-title"><i class="fa-solid fa-flag" style="color:' + c + '" aria-hidden="true"></i> ' + escapeHtml(e.title) + ' <span class="evl-tp ac">กิจกรรม</span></div>' +
      '<div class="day-ev-meta"><i class="fas fa-calendar-days" aria-hidden="true"></i> ' + escapeHtml(eventRangeText(e)) + (e.repeatYearly ? ' · <i class="fa-solid fa-rotate" aria-hidden="true"></i> ทุกปี' : '') + '</div>' +
      (tt ? '<div class="day-ev-meta"><i class="fa-solid fa-clock" aria-hidden="true"></i> ' + escapeHtml(tt) + '</div>' : '') +
      (e.location ? '<div class="day-ev-meta"><i class="fa-solid fa-location-dot" aria-hidden="true"></i> ' + escapeHtml(e.location) + '</div>' : '') +
      (e.ownerGroup ? '<div class="day-ev-meta"><i class="fa-solid ' + (e.ownerType === 'subject' ? 'fa-book' : 'fa-sitemap') + '" aria-hidden="true"></i> ' + escapeHtml(activityOwnerLabel(e)) + '</div>' : '') +
      (e.message ? '<div class="sub-item-desc">' + escapeHtml(e.message) + '</div>' : '') +
    '</div></div>';
}
// "กิจกรรมที่จะถึง" ใต้ปฏิทิน — กิจกรรมที่ยังไม่จบ ภายใน 60 วัน (รวมที่ทำซ้ำทุกปี)
function activityUpcomingHtml(acts, emptyText) {
  var today = todayYmd(), lim = new Date(Date.now() + 60 * 86400000);
  var limStr = lim.getFullYear() + '-' + ('0' + (lim.getMonth() + 1)).slice(-2) + '-' + ('0' + lim.getDate()).slice(-2);
  var list = acts.filter(function (e) { return (e.endDate || e.date) >= today && e.date <= limStr; })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  var head = '<div class="cal-upcoming-heading act"><i class="fa-solid fa-flag ui-icon" aria-hidden="true"></i> กิจกรรมที่จะถึง</div>';
  if (!list.length) return head + '<div class="empty-state">' + escapeHtml(emptyText || 'ไม่มีกิจกรรมในช่วงนี้') + '</div>';
  return head + '<div class="cal-upcoming-grid">' + list.map(function (e) {
    var tt = activityTimeText(e), dl = daysLeftInfo(e.date);
    var meta = [];
    if (tt) meta.push('<i class="fa-solid fa-clock" aria-hidden="true"></i> ' + escapeHtml(tt));
    if (e.location) meta.push('<i class="fa-solid fa-location-dot" aria-hidden="true"></i> ' + escapeHtml(e.location));
    return '<div class="event-list-item cal-act-row" data-act-date="' + escapeHtml(e.date) + '">' +
      '<div class="event-date-chip act">' + escapeHtml(eventRangeText(e)) + (dl && dl.days > 0 ? '<span class="days-left">(อีก ' + dl.days + ' วัน)</span>' : (e.date <= today ? '<span class="days-left">(วันนี้)</span>' : '')) + '</div>' +
      '<div style="flex:1 1 220px; min-width:0;"><div class="sub-item-title"><i class="fa-solid fa-flag" style="color:' + activityColor(e) + '; margin-right:4px;" aria-hidden="true"></i>' + escapeHtml(e.title) + ' ' + activityOwnerBadgeHtml(e) + '</div>' +
      (meta.length ? '<div class="sub-item-meta evl-meta">' + meta.join(' · ') + '</div>' : '') +
      (e.message ? '<div class="sub-item-desc">' + escapeHtml(e.message) + '</div>' : '') + '</div></div>';
  }).join('') + '</div>';
}
// ปุ่มกรองชนิด ทั้งหมด / กำหนดส่ง / กิจกรรม
function calKindChipsHtml(kind) {
  var b = function (k, label, ic) { return '<button type="button" data-cal-kind="' + k + '" class="' + (kind === k ? 'on' : '') + '" aria-pressed="' + (kind === k) + '">' + (ic ? '<i class="fa-solid ' + ic + '" aria-hidden="true"></i> ' : '') + label + '</button>'; };
  return b('', 'ทั้งหมด', '') + b('deadline', 'กำหนดส่ง', 'fa-file-arrow-up') + b('activity', 'กิจกรรม', 'fa-flag');
}
function daysLeftInfo(endDateStr, now) {
  if (!endDateStr) return null;
  var m = String(endDateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
  var end = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  if (isNaN(end)) { var d0 = new Date(endDateStr); if (isNaN(d0.getTime())) return null; end = Date.UTC(d0.getFullYear(), d0.getMonth(), d0.getDate()); }
  now = now || new Date();
  var days = Math.round((end - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
  if (days > 0) return { days: days, text: 'เหลือ ' + days + ' วัน', cls: days <= 3 ? 'urgent' : days <= 7 ? 'soon' : '' };
  if (days === 0) return { days: 0, text: 'วันนี้วันสุดท้าย', cls: 'urgent' };
  return { days: days, text: 'เลยกำหนด ' + (-days) + ' วัน', cls: 'late' };
}
function formatDateThai(isoOrDateStr) {
  if (!isoOrDateStr) return '';
  var d = new Date(isoOrDateStr);
  if (isNaN(d.getTime())) return String(isoOrDateStr);
  var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543);
}
// ขนาดไฟล์อ่านง่าย (ตั้งแต่ 1.41.111026) — ใช้ในแท็บ "ข้อมูลระบบ"
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

// ตารางวันเริ่มภาคเรียน (ตั้งแต่ 1.41.111026) — Super Admin กำหนดเองในตั้งค่า → ทั่วไป เก็บเป็น 'MM-DD' ซ้ำทุกปี (ค่าเริ่มต้นตรงกับ Worker)
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
// ใช้ตรงๆ เมื่อต้องการ "ค่าตามเวลาจริง" ล้วนๆ (เช่น ปุ่มรีเฟรชตัวกรองภาคเรียน/ปีในหน้าแสดงผลงานสาธารณะ) · settings (ไม่ส่ง = ค่าเริ่มต้น) · now (ไม่ส่ง = ตอนนี้)
// เทียบด้วยสตริง 'MM-DD' ของวันนี้กับวันเริ่มแต่ละภาคเรียนตามลำดับในปีปฏิทิน:
//   ตั้งแต่ term2Start เป็นต้นไป = ภาคเรียนที่ 2 ของปีการศึกษา = ปี พ.ศ. ปัจจุบัน · term1Start ถึงก่อน term2Start = ภาคเรียนที่ 1 ของปี พ.ศ. ปัจจุบัน
//   ก่อน term1Start = ยังเป็นปีการศึกษาก่อนหน้า (ปี พ.ศ. − 1): ถ้าเปิดภาคฤดูร้อนและถึง summerStart แล้ว = ภาคฤดูร้อน ไม่งั้น = ภาคเรียนที่ 2 ของปีก่อน
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
// "ปีการศึกษา/ภาคเรียนปัจจุบัน" ที่ใช้จริงทั่วระบบ (ค่าเริ่มต้นของตัวกรอง/ปฏิทิน/เช็คลิสต์/ป้ายภาคเรียนในหน้าฮับ) — ตั้งแต่ 1.41.111026 มี 2 โหมดตาม settings.termMode:
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
// ---------- เปิด/ปิด "จัดทำบันทึกข้อความ" (ตั้งแต่ 1.48.121026) ----------
// องค์ประกอบใดที่ติด class "memo-feature" (ปุ่มในหน้าแรก แท็บข้อมูลกลุ่มบริหารงาน การ์ดข้อมูลพิมพ์บันทึกข้อความ) + เมนู memo.html
// จะถูกซ่อนเมื่อ settings.memoEnabled === false — เรียกซ้ำได้ทุกครั้งที่ค่าตั้งค่าเปลี่ยน
function isMemoEnabled(st) { return !(st && st.memoEnabled === false); }
// 1.53.121026: แก้เมนูกระพริบ — จำสถานะไว้ใน localStorage (bnkah_memo_off) แล้วสคริปต์ใน <head> ของทุกหน้าใส่ class "memo-off"
// ที่ <html> ก่อนหน้าเว็บแสดงผล (CSS ซ่อนให้ตั้งแต่แรก ไม่ต้องรอโหลดค่าตั้งค่า) — ค่าตั้งค่าจริงที่โหลดมาภายหลังอัพเดต class/ค่าที่จำไว้ให้ตรงเสมอ
function memoOffCached() { try { return localStorage.getItem('bnkah_memo_off') === '1'; } catch (e) { return false; } }
function applyMemoFeatureVisibility(st) {
  var off = !isMemoEnabled(st);
  try { if (off) localStorage.setItem('bnkah_memo_off', '1'); else localStorage.removeItem('bnkah_memo_off'); } catch (e) { /* ไม่มี localStorage — ใช้ class อย่างเดียว */ }
  document.documentElement.classList.toggle('memo-off', off);
  document.querySelectorAll('.memo-feature, .sidenav a[href="memo.html"]').forEach(function (el) { el.classList.toggle('memo-feature-off', off); });
}

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
          '<button class="btn btn-ghost btn-close" id="sharedConfirmNo">ยกเลิก</button>' +
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
            '<button type="button" class="btn btn-ghost btn-close" id="sharedPwClose">ยกเลิก</button>' +
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
          '<button type="button" class="btn btn-ghost btn-close" id="sharedAvatarClose">ปิด</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-backdrop" id="sharedExpireModal" hidden>' +
      '<div class="modal-box">' +
        '<button type="button" class="modal-close-x" id="sharedExpireCloseX" aria-label="ปิด">✕</button>' +
        '<h3>หมดเวลาการใช้งาน</h3>' +
        '<!-- 1.69: ไม่มีการใช้งานครบ 60 นาที -->' +
        '<p style="color:var(--text-muted); font-size:0.9rem;">ไม่มีการใช้งานต่อเนื่องครบ 60 นาที เพื่อความปลอดภัยระบบได้นำคุณออกจากระบบแล้ว กรุณาเข้าสู่ระบบอีกครั้ง</p>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-primary" id="sharedExpireOk">เข้าสู่ระบบอีกครั้ง</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    '<div class="modal-backdrop" id="sharedIdleModal" hidden>' +
      '<div class="modal-box">' +
        '<div class="idle-ic"><i class="fa-solid fa-hourglass-half" aria-hidden="true"></i></div>' +
        '<h3>ยังใช้งานอยู่ไหม?</h3>' +
        '<p style="color:var(--text-muted); font-size:0.9rem;">ไม่มีการใช้งานมาระยะหนึ่งแล้ว ระบบจะออกจากระบบให้อัตโนมัติใน</p>' +
        '<div class="idle-left" id="sharedIdleLeft">2:00</div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn btn-primary" id="sharedIdleStay"><i class="fa-solid fa-check" aria-hidden="true"></i> ใช้งานต่อ</button>' +
          '<button type="button" class="btn btn-ghost btn-close" id="sharedIdleLogout">ออกจากระบบ</button>' +
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
          '<div class="progress-anim" id="sharedProgressAnim" aria-hidden="true"><span class="progress-ring"></span><i class="fa-solid fa-gear" id="sharedProgressIcon"></i></div>' +
          '<div class="progress-track"><div class="progress-bar-fill" id="sharedProgressBar"></div></div>' +
          '<div class="progress-label" id="sharedProgressLabel" aria-live="polite"></div>' +
          '<div class="progress-meta"><span id="sharedProgressPct"></span><span id="sharedProgressTime"></span></div>' +
          '<div class="progress-note" id="sharedProgressNote" hidden><i class="fa-solid fa-triangle-exclamation"></i> กรุณาอย่าปิดหรือรีเฟรชหน้านี้จนกว่าจะเสร็จ</div>' +
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
  // 1.69: ป็อปอัพเตือนก่อนหมดเวลา
  document.getElementById('sharedIdleStay').addEventListener('click', function () { markActive(true); hideIdleWarning(); });
  document.getElementById('sharedIdleLogout').addEventListener('click', function () { logout(); });

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
    }, { successLabel: 'อัพเดทรูปโปรไฟล์แล้ว', upload: true });
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
// 1.50.121026: แอนิเมชันระหว่างรอ (ไอคอนเคลื่อนไหว + วงหมุน + ตัวจับเวลา + แถบคืบหน้าแบบประมาณการ) ให้เห็นว่าระบบยังทำงานอยู่
// และกันปิด/รีเฟรชหน้าระหว่างอัพโหลด (beforeunload) — การอัพโหลดไป Apps Script วัดความคืบหน้าจริงเป็นไบต์ไม่ได้
// (ถ้าฟัง xhr.upload.onprogress เบราว์เซอร์จะส่ง CORS preflight ซึ่ง Apps Script ไม่รองรับ) จึงใช้การประมาณจากขนาดไฟล์แทน (creepProgress)
var _progressRun = { timer: null, creep: null, started: 0, upload: false };
function _progressBeforeUnload(e) { e.preventDefault(); e.returnValue = ''; return ''; }
function _stopProgressTimers() {
  if (_progressRun.timer) clearInterval(_progressRun.timer);
  if (_progressRun.creep) clearInterval(_progressRun.creep);
  _progressRun.timer = null; _progressRun.creep = null;
  window.removeEventListener('beforeunload', _progressBeforeUnload);
}
function _fmtElapsed(ms) { var sec = Math.floor(ms / 1000); return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2); }
function _showProgressModal(title, opts) {
  opts = opts || {};
  ensureSharedModals();
  _stopProgressTimers();
  _progressRun.started = Date.now();
  _progressRun.upload = !!opts.upload;
  document.getElementById('sharedProgressIcon').className = 'fa-solid ' + (opts.upload ? 'fa-cloud-arrow-up is-upload' : 'fa-gear is-spin');
  document.getElementById('sharedProgressNote').hidden = !opts.upload;
  document.getElementById('sharedProgressPct').textContent = '';
  document.getElementById('sharedProgressTime').textContent = '';
  _progressRun.timer = setInterval(function () {
    var el = document.getElementById('sharedProgressTime');
    if (el) el.textContent = 'ผ่านไป ' + _fmtElapsed(Date.now() - _progressRun.started);
  }, 1000);
  if (opts.upload) window.addEventListener('beforeunload', _progressBeforeUnload);
  document.getElementById('sharedProgressTitle').textContent = title || 'กำลังดำเนินการ';
  document.getElementById('sharedProgressBarWrap').hidden = false;
  document.getElementById('sharedProgressResult').hidden = true;
  document.getElementById('sharedProgressOk').hidden = true;
  // X ซ่อนไว้ระหว่างกำลังทำงานอยู่โดยตั้งใจ (เช่นเดียวกับปุ่ม "ตกลง") เพื่อให้ผู้ใช้เห็นผลลัพธ์แน่นอนก่อนปิดป็อปอัพได้เสมอ
  document.getElementById('sharedProgressCloseX').hidden = true;
  setProgressIndeterminate('กำลังดำเนินการ...');
  showModalEl(document.getElementById('sharedProgressModal'));
}
function _setBar(percent) {
  var bar = document.getElementById('sharedProgressBar');
  if (!bar) return;
  bar.classList.remove('indeterminate');
  var v = Math.max(0, Math.min(100, percent));
  bar.style.width = v + '%';
  var pct = document.getElementById('sharedProgressPct');
  if (pct) pct.textContent = Math.round(v) + '%';
  return v;
}
function setProgress(percent, label) {
  if (_progressRun.creep) { clearInterval(_progressRun.creep); _progressRun.creep = null; }
  _setBar(percent);
  if (label !== undefined) document.getElementById('sharedProgressLabel').textContent = label;
}
// แถบคืบหน้าแบบประมาณการ: ค่อยๆ ไหลจาก from ไปหา to (ไม่ถึง to จนกว่าจะเรียก setProgress ครั้งถัดไป) ตามเวลาที่คาดไว้ estMs
function creepProgress(from, to, estMs, label) {
  setProgress(from, label);
  var t0 = Date.now(), tau = Math.max(800, (estMs || 4000) / 2.2);
  _progressRun.creep = setInterval(function () {
    var k = 1 - Math.exp(-(Date.now() - t0) / tau);
    _setBar(from + (to - from) * 0.97 * k);
  }, 200);
}
// เวลาที่คาดว่าจะใช้ส่งไฟล์ขนาด bytes ไป Drive relay (base64 + อัพโหลด + Apps Script บันทึกไฟล์)
function estimateUploadMs(bytes) { return 2500 + (Number(bytes) || 0) * 1.37 / 900; }
function setProgressIndeterminate(label) {
  if (_progressRun.creep) { clearInterval(_progressRun.creep); _progressRun.creep = null; }
  var pct = document.getElementById('sharedProgressPct');
  if (pct) pct.textContent = '';
  var bar = document.getElementById('sharedProgressBar');
  if (!bar) return;
  bar.classList.add('indeterminate');
  if (label !== undefined) document.getElementById('sharedProgressLabel').textContent = label;
}
function _finishProgress(message, isError) {
  _stopProgressTimers();
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
  _showProgressModal(title, { upload: !!opts.upload });
  _progressBusy++; // 1.69: ระหว่างอัพโหลด/บันทึก ไม่นับเป็นเวลานิ่ง
  try {
    var data = await workFn({
      setProgress: setProgress,
      creep: creepProgress,
      setLabel: function (label) { document.getElementById('sharedProgressLabel').textContent = label; }
    });
    await _finishProgress(opts.successLabel || 'ดำเนินการสำเร็จ', false);
    return { ok: true, data: data };
  } catch (err) {
    await _finishProgress((err && err.message) || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ', true);
    return { ok: false, error: err };
  } finally {
    _progressBusy = Math.max(0, _progressBusy - 1);
    markActive(true);
  }
}

// ---------- Shared chrome: topbar + profile dropdown + footer ----------
// ---------- ลำดับเมนูข้าง (ตั้งแต่ 1.59 — Super Admin จัดลำดับได้ที่ ตั้งค่าระบบ → ทั่วไป) ----------
// slot = ตำแหน่งในเมนู (หน้าแรกของครู/เจ้าหน้าที่ กับของผู้บริหารเป็น slot เดียวกัน 'home') · who = บัญชีที่มองเห็น (ใช้แสดงป้ายในหน้าตั้งค่า)
var NAV_SLOTS = [
  { slot: 'home', label: 'หน้าแรก', icon: 'home', who: ['teacher', 'staff', 'exec', 'super'] },
  { slot: 'memo', label: 'จัดทำบันทึกข้อความ', icon: 'memo', who: ['teacher', 'staff'] },
  { slot: 'summary', label: 'สรุปรวมการส่งงาน', icon: 'summary', who: ['staff', 'exec', 'super'] },
  { slot: 'announce', label: 'ประกาศและปฏิทิน', icon: 'announce', who: ['staff', 'exec', 'super'] },
  { slot: 'directory', label: 'ทำเนียบบุคลากร', icon: 'directory', who: ['all'] },
  { slot: 'orders', label: 'คลังคำสั่ง', icon: 'orders', who: ['all'] },
  { slot: 'certs', label: 'คลังเกียรติบัตร', icon: 'certs', who: ['all'] },
  { slot: 'gallery', label: 'คลังรูปภาพ', icon: 'gallery', who: ['all'] }, // 1.76
  { slot: 'settings', label: 'ตั้งค่าระบบ', icon: 'settings', who: ['all'] }
];
var NAV_DEFAULT_ORDER = NAV_SLOTS.map(function (x) { return x.slot; });
// ลำดับที่ใช้จริง: ค่าที่บันทึกไว้ (เฉพาะ slot ที่รู้จัก) + slot ที่ขาด (เช่นเมนูใหม่ในรุ่นถัดไป) แทรกตามตำแหน่งเริ่มต้น
function normalizeNavOrder(order) {
  var out = [];
  (Array.isArray(order) ? order : []).forEach(function (k) { if (NAV_DEFAULT_ORDER.indexOf(k) !== -1 && out.indexOf(k) === -1) out.push(k); });
  NAV_DEFAULT_ORDER.forEach(function (k, i) {
    if (out.indexOf(k) !== -1) return;
    var prev = NAV_DEFAULT_ORDER.slice(0, i).reverse().filter(function (x) { return out.indexOf(x) !== -1; })[0];
    out.splice(prev ? out.indexOf(prev) + 1 : 0, 0, k);
  });
  return out;
}
function currentNavOrder() {
  var s = _settingsCache && !_settingsCache.__fallback ? _settingsCache : cachedBrand();
  return normalizeNavOrder(s && s.navOrder);
}
function navSlotOf(key) { return key === 'dashboard' || key === 'executive' || key === 'overview' ? 'home' : key; }
// เรียงเมนูในแถบข้างที่วาดไปแล้วใหม่ (ค่าตั้งค่าโหลดเสร็จทีหลัง/เพิ่งบันทึกลำดับใหม่)
function reorderSideNav(order) {
  var list = document.querySelector('#app-sidenav .sidenav-list');
  if (!list) return;
  normalizeNavOrder(order).forEach(function (slot) {
    var a = list.querySelector('a[data-nav-slot="' + slot + '"]');
    if (a) list.appendChild(a);
  });
}
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
  // 1.79: Super Admin มีหน้าแรกของตัวเอง = ภาพรวมระบบ (overview.html)
  if (isAdmin && !session.hasHub) links.push({ href: 'overview.html', label: 'หน้าแรก', key: 'overview', icon: 'home' });
  if (isAdmin || isExec) {
    links.push({ href: 'summary.html', label: 'สรุปรวมการส่งงาน', key: 'summary', icon: 'summary' });
    // "ประกาศและปฏิทิน" (ตั้งแต่ 1.32.101026): ย้ายแท็บ "ปฏิทิน" และ "ประกาศ" ออกจากหน้าตั้งค่ามารวมกันเป็นแท็บบนสุดนี้ — เจ้าหน้าที่/Super Admin จัดการได้
    // ผู้บริหารดูได้อย่างเดียว (ครูไม่มีแท็บนี้เพราะเห็นปฏิทินและประกาศในหน้าแรกอยู่แล้ว)
    links.push({ href: 'announce.html', label: 'ประกาศและปฏิทิน', key: 'announce', icon: 'announce' });
  }
  // "ทำเนียบบุคลากรโรงเรียน" (ตั้งแต่ 1.32.101026): ทุกบทบาทที่ล็อกอินเห็นแท็บนี้ — mountChrome ซ่อนให้เองถ้า Super Admin ตั้งไว้ว่า "ปิด" (settings.directoryMode)
  if (session) links.push({ href: 'directory.html', label: 'ทำเนียบบุคลากร', key: 'directory', icon: 'directory' });
  // "คลังคำสั่ง" (ตั้งแต่ 1.41.111026 ชื่อเดิม "ไฟล์คำสั่ง"; เปลี่ยนชื่อใน 1.43.111026): ทุกบทบาทที่ล็อกอินดู/พรีวิว/เพิ่มคำสั่งได้ — แก้ไข/ลบได้เฉพาะเจ้าของ
  if (session) links.push({ href: 'orders.html', label: 'คลังคำสั่ง', key: 'orders', icon: 'orders' });
  // "คลังเกียรติบัตร" (ตั้งแต่ 1.59): ทุกบัญชีที่ล็อกอินเห็น
  if (session) links.push({ href: 'certs.html', label: 'คลังเกียรติบัตร', key: 'certs', icon: 'certs' });
  // "คลังรูปภาพ" (ตั้งแต่ 1.76): ทุกบัญชีที่ล็อกอินเห็น — ครูทุกคนเพิ่มอัลบั้มได้
  if (session) links.push({ href: 'gallery.html', label: 'คลังรูปภาพ', key: 'gallery', icon: 'gallery' });
  // 1.45.111026: ทุกบัญชีมีเมนู "ตั้งค่าระบบ" (ครู/ผู้บริหารเห็นเฉพาะแท็บ Signature Credit)
  if (session) {
    // หมายเหตุ: เมนู "จัดการ Layout" (V11.1) ถูกยกเลิกตั้งแต่ V11.5 — ทั้งรูปแบบการ์ด (V11.3) และลำดับการแสดงผล (V11.5)
    // ย้ายไปรวมอยู่ในหน้า "ตั้งค่าระบบ" (ตั้งแต่ 1.32.101026 อยู่ในแท็บ "ข้อมูลหลัก") (Super Admin เท่านั้น)
    links.push({ href: 'settings.html', label: 'ตั้งค่าระบบ', key: 'settings', icon: 'settings' });
  }
  var order = currentNavOrder(); // 1.59: เรียงตามลำดับที่ Super Admin ตั้ง
  links.forEach(function (l) { l.slot = navSlotOf(l.key); });
  links.sort(function (a, b) { return order.indexOf(a.slot) - order.indexOf(b.slot); });
  return links;
}


// ---------- แถบเมนูด้านซ้าย (ตั้งแต่ 1.41.111026 — สไตล์ Google Keep สำหรับทุกบัญชี/ทุกหน้าที่มี topbar) ----------
// - ปุ่ม 3 ขีดหน้าโลโก้ (#navToggle): คอม/แท็บเล็ต = สลับ "เปิดค้างไว้ (ปักหมุด)" ↔ "ย่อเหลือแต่ไอคอน" จำค่าไว้ใน localStorage (bnkah_nav_pinned)
//   มือถือ (< 768px) = เปิด/ปิดเป็นลิ้นชักทับหน้าจอ มีฉากดำจางๆ ด้านหลัง
// - ตอนย่ออยู่ ถ้าเอาเมาส์ชี้ที่แถบจะกางเต็มออกมาทับเนื้อหาชั่วคราว (ไม่ดันเนื้อหา) พอเอาเมาส์ออกก็ย่อกลับ
// - ค่าเริ่มต้นเมื่อยังไม่เคยเลือก: จอกว้าง ≥ 1280px เปิดค้าง, จอเล็กกว่านั้นย่อ
var NAV_PIN_KEY = 'bnkah_nav_pinned';
function _navIsMobile() { return window.matchMedia('(max-width: 767px)').matches; }
function _navGetPinned() {
  try { var v = localStorage.getItem(NAV_PIN_KEY); if (v === '1') return true; if (v === '0') return false; } catch (e) { /* ใช้ค่าเริ่มต้น */ }
  return false; // 1.68: ค่าเริ่มต้น = ย่อ (เดิมจอกว้าง ≥1280px เริ่มแบบขยาย)
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
    return '<a href="' + l.href + '" data-nav-slot="' + escapeHtml(l.slot || navSlotOf(l.key)) + '" class="sidenav-item' + (l.key === activePage ? ' active' : '') + '" title="' + escapeHtml(l.label) + '"' + (l.key === activePage ? ' aria-current="page"' : '') + '>' +
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
    if (_navIsMobile()) { mobileOpen = !mobileOpen; if (mobileOpen && typeof announceMenuOpen === 'function') announceMenuOpen('nav'); }
    else { pinned = !pinned; hovering = false; try { localStorage.setItem(NAV_PIN_KEY, pinned ? '1' : '0'); } catch (e) { /* ไม่เป็นไร */ } }
    render();
  });
  backdrop.addEventListener('click', function () { mobileOpen = false; render(); });
  document.addEventListener('bnkah:menu-open', function (e) { if (e.detail !== 'nav' && mobileOpen) { mobileOpen = false; render(); } }); // 1.79.2: เปิดเมนูอื่น = ปิดเมนูข้าง (มือถือ)
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && mobileOpen) { mobileOpen = false; render(); } });
  aside.addEventListener('mouseenter', function () { if (!_navIsMobile() && window.matchMedia('(hover: hover)').matches) { hovering = true; render(); } });
  aside.addEventListener('mouseleave', function () { hovering = false; render(); });
  aside.addEventListener('focusin', function () { if (!_navIsMobile()) { hovering = true; render(); } });
  aside.addEventListener('focusout', function () { hovering = false; render(); });
  window.addEventListener('resize', function () { if (!_navIsMobile()) mobileOpen = false; syncTopbarHeight(); render(); });
  syncTopbarHeight();
  if (window.ResizeObserver) { var tbEl = document.querySelector('.topbar'); if (tbEl) new ResizeObserver(syncTopbarHeight).observe(tbEl); }
  // 1.68: เปิดหน้าใหม่ = จัดสถานะย่อ/ขยายทันทีโดยไม่มีอนิเมชั่น (สคริปต์บนหัวหน้าใส่ .nav-noanim ไว้) — อนิเมชั่นเหลือเฉพาะตอนกดปุ่มเอง
  document.documentElement.classList.add('nav-noanim');
  render();
  requestAnimationFrame(function () { requestAnimationFrame(function () { document.documentElement.classList.remove('nav-noanim'); }); });
}

function mountChrome(activePage) {
  var session = getSession();
  var topbarRoot = document.getElementById('app-topbar');
  if (topbarRoot && session) {
    var links = navLinksFor(session);
    // ตั้งแต่ 1.41.111026: เมนูทั้งหมดย้ายจากแถบบนสุดมาเป็นแถบเมนูด้านซ้าย (สไตล์ Google Keep) — ปุ่ม 3 ขีดหน้าโลโก้ = ปักหมุดเปิดค้าง/ย่อ,
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
          // 1.75: แจ้งปัญหา (หูฟัง) + แจ้งเตือน (กระดิ่ง) — อยู่ระหว่างรีเฟรชกับเมนูบัญชี
          // 1.76: ปุ่มคู่มือการใช้งาน (แทนหูฟัง — แจ้งปัญหาย้ายไปเมนูบัญชี)
          '<button class="refresh-btn tb-icon-btn" id="manualOpenBtn" type="button" title="คู่มือการใช้งาน" aria-label="คู่มือการใช้งาน"><i class="fa-solid fa-book-open" aria-hidden="true"></i></button>' +
          '<button class="refresh-btn tb-icon-btn" id="notifBtn" type="button" title="แจ้งเตือน" aria-label="แจ้งเตือน" aria-expanded="false"><i class="fa-solid fa-bell" aria-hidden="true"></i><span class="tb-badge" id="notifBadge" hidden>0</span></button>' +
          '<div class="profile-menu">' +
            '<button class="profile-trigger" id="profileTrigger" aria-expanded="false" type="button">' +
              '<span class="profile-avatar" id="topbarAvatar">' + avatarInnerHtml(session.avatarUrl) + '</span>' +
              '<span class="profile-name">' + escapeHtml(session.name) + '</span>' +
              '<span class="chevron">▾</span>' +
            '</button>' +
            '<div class="profile-dropdown" id="profileDropdown">' +
              '<div class="dd-header"><div class="dd-name">' + escapeHtml(session.name) + '</div>' + accountInfoLines(session).map(function (l) { return '<div class="dd-role"><span class="dd-k">' + escapeHtml(l.label) + '</span><span class="dd-v">' + escapeHtml(l.value) + '</span></div>'; }).join('') + '</div>' +
              // 1.80: ติดตั้งแอป (PWA) — แสดงเฉพาะเครื่องที่ติดตั้งได้และยังไม่ได้ติดตั้ง (ดู updateInstallItem)
              '<button class="dd-item dd-install" id="ddInstall" type="button" hidden><span class="dd-icon"><i class="fa-solid fa-mobile-screen-button" aria-hidden="true"></i></span> ติดตั้งแอปลงเครื่องนี้</button>' +
              '<div class="dd-divider" id="ddInstallDiv" hidden></div>' +
              // 1.66: เลือกธีม 3 แบบ (ภาพตัวอย่างย่อ) แทนสวิตช์ Dark Mode เดิม
              '<div class="dd-theme-title">ธีม</div><div class="dd-themes" id="themePicker" role="radiogroup" aria-label="ธีม">' +
                [['light', 'กระดาษขาว'], ['sepia', 'ถนอมตา'], ['dark', 'กลางคืน']].map(function (t) {
                  return '<button type="button" role="radio" class="dd-theme t-' + t[0] + '" data-theme-pick="' + t[0] + '"><span class="mini"><i class="p"></i><i></i><i></i></span>' + t[1] + '</button>';
                }).join('') + '</div>' +
              '<div class="dd-divider"></div>' +
              '<button class="dd-item" id="ddChangeAvatar" type="button"><span class="dd-icon">' + icon('image', 16) + '</span> เปลี่ยนรูปโปรไฟล์</button>' +
              '<button class="dd-item" id="ddChangePw" type="button"><span class="dd-icon">' + icon('key', 16) + '</span> เปลี่ยนรหัสผ่าน</button>' +
              '<button class="dd-item" id="ddReport" type="button"><span class="dd-icon"><i class="fa-solid fa-headset" aria-hidden="true"></i></span> แจ้งปัญหา</button>' +
              '<div class="dd-divider"></div>' +
              '<button class="dd-item danger" id="ddLogout" type="button"><span class="dd-icon">' + icon('logout', 16) + '</span> ออกจากระบบ</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.querySelector('.js-home-btn').addEventListener('click', function () { location.href = homePageFor(session); });
    renderBrand(cachedBrand()); // 1.53: วาดแบรนด์จากค่าที่จำไว้ทันที (applyBranding อัพเดตตามค่าจริงอีกครั้ง)
    mountSideNav(links, activePage);
    // ซ่อนเมนู "ทำเนียบบุคลากร" ถ้า Super Admin ปิดทำเนียบไว้ (settings.directoryMode = 'off') — ตั้งแต่ 1.32.101026
    getSiteSettings().then(function (st) {
      if (st && st.directoryMode === 'off') {
        var dl = document.querySelector('.sidenav a[href="directory.html"]');
        if (dl && activePage !== 'directory') dl.remove();
      }
      // 1.48.121026: Super Admin ปิด "จัดทำบันทึกข้อความ" -> ซ่อนเมนู/ปุ่ม/แท็บที่เกี่ยวข้อง และพาออกจากหน้า memo.html
      applyMemoFeatureVisibility(st);
      if (st && st.memoEnabled === false && activePage === 'memo') location.replace(homePageFor(session));
    });

    var trigger = document.getElementById('profileTrigger');
    var dropdown = document.getElementById('profileDropdown');
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('open');
      trigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (isOpen) announceMenuOpen('profile');
    });
    onOtherMenuOpen('profile', function () { dropdown.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); });
    document.addEventListener('click', function (e) {
      if (!dropdown.contains(e.target) && e.target !== trigger) {
        dropdown.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    });
    var themePicker = document.getElementById('themePicker');
    var syncThemePicker = function () {
      var cur = getTheme();
      Array.prototype.forEach.call(themePicker.querySelectorAll('[data-theme-pick]'), function (b) { var on = b.getAttribute('data-theme-pick') === cur; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    };
    syncThemePicker();
    themePicker.addEventListener('click', function (ev) {
      var b = ev.target.closest('[data-theme-pick]'); if (!b) return;
      var t = b.getAttribute('data-theme-pick');
      setTheme(t); saveThemeToAccount(t); syncThemePicker();
    });

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

    initNotifBell(); // 1.75
    document.getElementById('manualOpenBtn').addEventListener('click', function () { openManual(); });
    document.getElementById('ddReport').addEventListener('click', function () { dropdown.classList.remove('open'); openReportModal(); });
    document.getElementById('ddInstall').addEventListener('click', function () { dropdown.classList.remove('open'); startInstallApp(); });
    updateInstallItem();
    if (/^#report:/.test(location.hash)) { var rid = location.hash.slice(8); setTimeout(function () { openReportModal({ tab: 'mine', focus: rid }); }, 300); }
    setTimeout(function () { refreshTopBadges(); }, 400);

    scheduleSessionTimeout();
    startSessionWatch(); // ตรวจป้องกันล็อกอินซ้อนกันเป็นระยะ (ตั้งแต่ V11.7) — เริ่มพร้อมกับทุกหน้าที่มี topbar (ต้องล็อกอินอยู่แล้วเสมอ)
  }
  mountFooter();
  applyBranding();
}

// Footer มาตรฐานทุกหน้า (ตั้งแต่ 1.29.091026 ตามที่ผู้ใช้กำหนดไว้): ชื่อโรงเรียน, ลิขสิทธิ์ (ปีอัตโนมัติ เป็น พ.ศ.), ลิขสิทธิ์ผลงานเป็นของเจ้าของ
// ผลงาน, ผู้พัฒนา, ระบุว่าใช้ AI ช่วยพัฒนา + เวอร์ชัน, ลิงก์นโยบายความเป็นส่วนตัว/แจ้งปัญหา (mailto) — หน้า privacy.html ใช้ฟังก์ชันนี้ร่วมกัน
var SUPPORT_EMAIL = 'Tear.Jeerasak@gmail.com'; // อีเมลผู้ดูแลระบบ (แจ้งปัญหา/ติดต่อเรื่องข้อมูลส่วนบุคคล)
function mountFooter(opts) {
  var root = document.getElementById('app-footer');
  if (!root) return;
  var yearBE = new Date().getFullYear() + 543;
  // 1.75: กดเลขเวอร์ชัน = เมนู "โหลดหน้าใหม่" / "ล้างแคชแล้วโหลดใหม่"
  var verHtml = '<span class="ver-wrap"><button type="button" class="ver-btn" id="verBtn" aria-haspopup="true" aria-expanded="false" title="โหลดหน้าใหม่ / ล้างแคช">v' + escapeHtml(APP_VERSION) + ' <i class="fa-solid fa-caret-up" aria-hidden="true"></i></button>' +
    '<span class="ver-menu" id="verMenu" hidden><button type="button" data-ver="reload"><i class="fa-solid fa-rotate-right" aria-hidden="true"></i> โหลดหน้าใหม่</button>' +
    '<button type="button" data-ver="hard"><i class="fa-solid fa-broom" aria-hidden="true"></i> ล้างแคชแล้วโหลดใหม่</button></span></span>';
  var reportLink = '<a href="mailto:' + SUPPORT_EMAIL + '?subject=' + encodeURIComponent('แจ้งปัญหาการใช้งาน BNKAcademicHub') + '">';
  if (opts && opts.compact) {
    // 1.80: หน้าล็อกอินใช้ footer แบบย่อ 2 บรรทัด — กด "เกี่ยวกับระบบ" เพื่อดูบรรทัดที่เหลือ (หน้าล็อกอินไม่ยาวขึ้น)
    root.innerHTML =
      '<div class="site-footer">' +
        '<div>© ' + yearBE + ' โรงเรียนบุ่งคล้านคร · ' + verHtml + '</div>' +
        '<div class="footer-links"><a href="privacy.html">นโยบายความเป็นส่วนตัว</a> · ' + reportLink + 'แจ้งปัญหา</a> · ' +
          '<button type="button" class="footer-about-btn" id="footerAboutBtn" aria-expanded="false" aria-controls="footerMore">เกี่ยวกับระบบ <i class="fa-solid fa-caret-down" aria-hidden="true"></i></button></div>' +
        '<div class="footer-more" id="footerMore" hidden><div>ผลงานในระบบเป็นลิขสิทธิ์ของเจ้าของผลงาน</div><div>Developed by Jeerasak Chomphuwattana</div><div>Built with AI assistance</div></div>' +
      '</div>';
    var ab = document.getElementById('footerAboutBtn'), more = document.getElementById('footerMore');
    ab.addEventListener('click', function () {
      more.hidden = !more.hidden; ab.setAttribute('aria-expanded', String(!more.hidden));
      ab.querySelector('i').className = 'fa-solid ' + (more.hidden ? 'fa-caret-down' : 'fa-caret-up');
      if (!more.hidden) more.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  } else {
    root.innerHTML =
      '<div class="site-footer">' +
        '<div class="footer-school">โรงเรียนบุ่งคล้านคร</div>' +
        '<div>© ' + yearBE + ' โรงเรียนบุ่งคล้านคร สงวนลิขสิทธิ์</div>' +
        '<div>ผลงานในระบบเป็นลิขสิทธิ์ของเจ้าของผลงาน</div>' +
        '<div>Developed by Jeerasak Chomphuwattana</div>' +
        '<div>Built with AI assistance · ' + verHtml + '</div>' +
        // 1.75: หน้าที่ล็อกอินแล้วแจ้งปัญหาผ่านเมนูบัญชี — ลิงก์อีเมลเหลือเฉพาะหน้าที่ไม่มีแถบบน (หน้าสาธารณะ/หน้าล็อกอิน)
        '<div class="footer-links"><a href="privacy.html">นโยบายความเป็นส่วนตัว</a>' +
          (document.getElementById('ddReport') ? '' : ' · ' + reportLink + 'แจ้งปัญหาการใช้งาน</a>') + '</div>' +
      '</div>';
  }
  var vb = document.getElementById('verBtn'), vm = document.getElementById('verMenu');
  vb.addEventListener('click', function (e) { e.stopPropagation(); vm.hidden = !vm.hidden; vb.setAttribute('aria-expanded', String(!vm.hidden)); if (!vm.hidden) announceMenuOpen('version'); });
  onOtherMenuOpen('version', function () { vm.hidden = true; vb.setAttribute('aria-expanded', 'false'); });
  document.addEventListener('click', function (e) { if (!vm.hidden && !e.target.closest('.ver-wrap')) { vm.hidden = true; vb.setAttribute('aria-expanded', 'false'); } });
  vm.addEventListener('click', function (e) {
    var b = e.target.closest('[data-ver]'); if (!b) return;
    vm.hidden = true;
    if (b.getAttribute('data-ver') === 'reload') location.reload();
    else hardReloadPage();
  });
}
// ล้างแคชแล้วโหลดใหม่: ลบ Cache Storage/Service Worker (ถ้ามี) + ข้อมูลชั่วคราวของหน้า (sessionStorage) แล้วดึงไฟล์หน้าเว็บ (HTML/JS/CSS)
// ใหม่จากเซิร์ฟเวอร์ทับแคชของเบราว์เซอร์ก่อนโหลดหน้าใหม่ — ไม่ออกจากระบบ ไม่ลบธีม/การตั้งค่าที่จำไว้
async function hardReloadPage() {
  showToast('กำลังล้างแคชและโหลดใหม่...');
  try { if (window.caches && caches.keys) { var ks = await caches.keys(); await Promise.all(ks.map(function (k) { return caches.delete(k); })); } } catch (e) { /* ข้าม */ }
  try { if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) { var regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(function (r) { return r.unregister(); })); } } catch (e) { /* ข้าม */ }
  try { sessionStorage.clear(); } catch (e) { /* ข้าม */ }
  try { resetSettingsCache(); localStorage.removeItem('bnkah_brand'); } catch (e) { /* ข้าม */ }
  var urls = [location.href.split('#')[0]];
  document.querySelectorAll('script[src], link[rel="stylesheet"][href]').forEach(function (el) {
    var u = el.src || el.href;
    if (u && u.indexOf(location.origin) === 0) urls.push(u);
  });
  await Promise.all(urls.map(function (u) { return fetch(u, { cache: 'reload', credentials: 'same-origin' }).catch(function () {}); }));
  location.reload();
}

// ---------- พรีวิวไฟล์แบบป็อปอัพเต็มหน้าจอ (ตั้งแต่ 1.43.111026) ----------
// ใช้กับคลังคำสั่ง (orders.html) และผลงานในหน้าแรกของครู (dashboard.html) — แสดงไฟล์ผ่านหน้า preview ของ Google Drive ใน iframe
// ปิดได้ 3 ทาง: กดพื้นที่ว่างรอบไฟล์ · ปุ่ม ✕ · ปุ่ม Esc — ปุ่ม "เปิดไฟล์" (แท็บใหม่) ยังมีแยกต่างหากเหมือนเดิม
// drivePreviewUrl: แปลงลิงก์ไฟล์ Google Drive (…/file/d/<id>/view…) เป็นลิงก์ preview ที่ฝังใน iframe ได้ — ลิงก์แบบอื่นคืนค่าเดิม
function drivePreviewUrl(url) {
  var id = driveFileId(url);
  return id ? 'https://drive.google.com/file/d/' + id + '/preview' : String(url || '');
}
// ลิงก์ดาวน์โหลดไฟล์ Google Drive โดยตรง (1.47.121026 — ปุ่ม "ดาวน์โหลด" ในป็อปอัพพรีวิว) — ลิงก์แบบอื่นคืนค่าว่าง
// 1.51.121026: แก้บั๊ก — ไฟล์ Word/Excel/PowerPoint ที่ Drive คืนลิงก์เป็น docs.google.com/document|spreadsheets|presentation/d/<id>/edit
// (ไม่ใช่ /file/d/) เดิมหา id ไม่เจอ ได้ลิงก์ว่าง กดแล้ววนกลับหน้าเดิม (dashboard.html) — ไม่ใช่เรื่องสิทธิ์ของ Google Drive
function driveDownloadUrl(url) {
  var id = driveFileId(url);
  return id ? 'https://drive.google.com/uc?export=download&id=' + id : '';
}
// ---------- ปุ่มลิงก์เว็บไซต์โรงเรียน (1.52.121026: ใช้ร่วมกันระหว่างหน้าแรกและตัวอย่างในหน้าตั้งค่า) ----------
// รูปแนวนอน (แนะนำ 320×120, 8:3) = เต็มปุ่ม 160×60 เหมือนเดิม · รูปเกือบจัตุรัส (กว้าง/สูง < 1.6) = ไอคอนตัดขอบมนอัตโนมัติ + ชื่อปุ่มข้างๆ
function extLinkButtonHtml(l, opts) {
  opts = opts || {};
  var href = opts.preview ? '#' : escapeHtml(l.url || '#');
  var attrs = opts.preview ? ' tabindex="-1" aria-hidden="true"' : ' target="_blank" rel="noopener noreferrer"';
  if (l.imageDataUrl) {
    return '<a class="ext-link-btn ext-link-btn-image" href="' + href + '"' + attrs + ' title="' + escapeHtml(l.name || '') + '">' +
      '<img src="' + l.imageDataUrl + '" alt="' + escapeHtml(l.name || '') + '" /><span class="ext-link-label">' + escapeHtml(l.name || '') + '</span></a>';
  }
  return '<a class="ext-link-btn" href="' + href + '"' + attrs + ' style="background:' + escapeHtml(l.color || '#3457d5') + ';"><span>' + escapeHtml(l.name || 'ชื่อปุ่ม') + '</span></a>';
}
function enhanceExtLinkImages(root) {
  (root || document).querySelectorAll('.ext-link-btn-image img').forEach(function (img) {
    function apply() {
      if (!img.naturalWidth || !img.naturalHeight) return;
      img.parentNode.classList.toggle('is-square', img.naturalWidth / img.naturalHeight < 1.6);
    }
    if (img.complete) apply(); else img.addEventListener('load', apply, { once: true });
  });
}

// ---------- ชนิดไฟล์สำหรับพรีวิว (1.50.121026) ----------
// 'pdf' / 'video' = ตัวแสดงตัวอย่างของ Google Drive (iframe) · 'image' = แสดงรูปตรงจาก Drive (<img>) เพราะตัวพรีวิวของ Drive
// มักขึ้น "แสดงตัวอย่างไม่ได้" กับรูป (โดยเฉพาะไฟล์ที่ส่งมาโดยไม่มี mimeType) · 'office' = Word/Excel/PowerPoint ไม่พรีวิว
// (Google แปลงแล้วรูปแบบเพี้ยน) ให้ดาวน์โหลดไปเปิดในคอมพิวเตอร์แทน · 'other' = แสดงตัวอย่างไม่ได้ ให้ดาวน์โหลด
function fileKindOf(name, mime) {
  var n = String(name || '').toLowerCase(), m = String(mime || '').toLowerCase();
  if (/pdf/.test(m) || /\.pdf$/.test(n)) return 'pdf';
  if (/\.(docx?|dotx?|xlsx?|xlsm|xltx?|csv|pptx?|ppsx?|potx?|odt|ods|odp|rtf)$/.test(n) || /msword|wordprocessingml|ms-excel|spreadsheetml|ms-powerpoint|presentationml|opendocument|rtf/.test(m)) return 'office';
  if (/^image\//.test(m) || /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif|tiff?)$/.test(n)) return 'image';
  if (/^video\//.test(m) || /\.(mp4|mov|m4v|webm|avi|mkv)$/.test(n)) return 'video';
  if (/^audio\//.test(m) || /\.(mp3|wav|m4a|ogg)$/.test(n)) return 'video';
  return m || n ? 'other' : 'pdf';
}
function driveFileId(url) {
  var u = String(url || '');
  var m = /\/(?:file|document|spreadsheets|presentation|drawings|forms)\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{10,})/.exec(u) ||
    /googleusercontent\.com\/d\/([A-Za-z0-9_-]{10,})/.exec(u) || /[?&]id=([A-Za-z0-9_-]{10,})/.exec(u) ||
    /drive\.google\.com\/.*\/d\/([A-Za-z0-9_-]{10,})/.exec(u);
  return m ? m[1] : '';
}
// ชื่อชนิดไฟล์สำหรับข้อความในป็อปอัพดาวน์โหลด
function officeKindLabel(name) {
  var n = String(name || '').toLowerCase();
  if (/\.(xlsx?|xlsm|xltx?|csv|ods)$/.test(n)) return 'Excel';
  if (/\.(pptx?|ppsx?|potx?|odp)$/.test(n)) return 'PowerPoint';
  return 'Word';
}

// nav (ตั้งแต่ 1.49.121026, ไม่บังคับ): { index, total, go(i) } — พรีวิวไล่ทีละไฟล์ มีปุ่มก่อนหน้า/ถัดไป + ลูกศรซ้าย/ขวาบนคีย์บอร์ด
// kind (ตั้งแต่ 1.50.121026, ไม่บังคับ): ผลจาก fileKindOf() — ไม่ส่ง = พรีวิวผ่าน Google Drive (iframe) เหมือนเดิม
function openFilePreview(previewUrl, title, openUrl, downloadUrl, nav, kind) {
  if (downloadUrl === undefined) downloadUrl = driveDownloadUrl(openUrl || previewUrl);
  var old = document.getElementById('filePreviewOverlay');
  var reuse = !!old && !!nav; // เปลี่ยนไฟล์ในโหมดไล่ทีละไฟล์ — ไม่ต้องเล่นแอนิเมชันเปิดใหม่
  if (old) { if (old.__dispose) old.__dispose(); old.remove(); }
  var ov = document.createElement('div');
  ov.id = 'filePreviewOverlay';
  ov.className = 'file-preview-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', 'พรีวิวไฟล์' + (title ? ' ' + title : ''));
  ov.innerHTML =
    '<div class="file-preview-frame">' +
      '<div class="file-preview-bar">' +
        (nav ? '<div class="file-preview-nav"><button type="button" class="icon-btn file-preview-prev" aria-label="ไฟล์ก่อนหน้า"' + (nav.index <= 0 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-left"></i></button>' +
          '<span class="file-preview-count">' + (nav.index + 1) + '/' + nav.total + '</span>' +
          '<button type="button" class="icon-btn file-preview-next" aria-label="ไฟล์ถัดไป"' + (nav.index >= nav.total - 1 ? ' disabled' : '') + '><i class="fa-solid fa-chevron-right"></i></button></div>' : '') +
        '<div class="file-preview-title">' + escapeHtml(title || 'พรีวิวไฟล์') + '</div>' +
        (openUrl ? '<a class="btn btn-secondary btn-sm" href="' + escapeHtml(openUrl) + '" target="_blank" rel="noopener"><i class="fa-solid fa-up-right-from-square"></i><span class="fp-lbl"> เปิดไฟล์</span></a>' : '') +
        (downloadUrl ? '<a class="btn btn-primary btn-sm file-preview-dl" href="' + escapeHtml(downloadUrl) + '" target="_blank" rel="noopener" download><i class="fa-solid fa-download"></i><span class="fp-lbl"> ดาวน์โหลด</span></a>' : '') +
        '<button type="button" class="file-preview-close" aria-label="ปิดพรีวิว">✕</button>' +
      '</div>' +
      _filePreviewBodyHtml(previewUrl, title, openUrl, downloadUrl, kind) +
    '</div>';
  function close() {
    document.removeEventListener('keydown', onKey);
    ov.classList.remove('show');
    document.body.classList.remove('file-preview-open');
    setTimeout(function () { ov.remove(); }, 160);
  }
  function step(d) { var i = nav.index + d; if (i >= 0 && i < nav.total) nav.go(i); }
  function onKey(e) {
    if (e.key === 'Escape') close();
    else if (nav && e.key === 'ArrowLeft') step(-1);
    else if (nav && e.key === 'ArrowRight') step(1);
  }
  ov.__dispose = function () { document.removeEventListener('keydown', onKey); };
  ov.addEventListener('click', function (e) { if (e.target === ov || (e.target.classList && e.target.classList.contains('file-preview-imgwrap'))) close(); }); // กดพื้นที่ว่างรอบไฟล์ = ปิด
  // รูปภาพ: ลิงก์ตรงของ Drive ไม่ได้ -> ลองภาพย่อของ Drive -> ไม่ได้อีกแสดงข้อความ + ปุ่มดาวน์โหลด
  var img = ov.querySelector('.file-preview-img');
  if (img) {
    img.addEventListener('error', function () {
      var alt = img.getAttribute('data-fallback');
      if (alt) { img.removeAttribute('data-fallback'); img.src = alt; return; }
      // 1.72: ลิงก์รูปตรง + ภาพย่อไม่ได้ทั้งคู่ -> ใช้ตัวพรีวิวของ Google Drive (iframe) เป็นทางสุดท้าย
      var wrap = img.parentNode, fid = driveFileId(openUrl || previewUrl);
      wrap.outerHTML = fid ? '<iframe class="file-preview-iframe" src="https://drive.google.com/file/d/' + fid + '/preview" title="' + escapeHtml(title || 'พรีวิวไฟล์') + '" loading="eager"></iframe>'
        : _filePreviewDlPanel('fa-file-image', 'แสดงรูปตัวอย่างไม่ได้', 'รูปนี้อาจเป็นชนิดที่เบราว์เซอร์แสดงไม่ได้ (เช่น HEIC) หรือยังไม่ได้แชร์แบบ "ทุกคนที่มีลิงก์" — ดาวน์โหลดไปเปิดในเครื่องได้เลย', downloadUrl, openUrl);
    });
    img.addEventListener('load', function () { img.classList.add('loaded'); });
  }
  ov.querySelector('.file-preview-close').addEventListener('click', close);
  if (nav) {
    ov.querySelector('.file-preview-prev').addEventListener('click', function () { step(-1); });
    ov.querySelector('.file-preview-next').addEventListener('click', function () { step(1); });
  }
  document.addEventListener('keydown', onKey);
  document.body.appendChild(ov);
  document.body.classList.add('file-preview-open');
  if (reuse) ov.classList.add('show', 'no-anim'); else requestAnimationFrame(function () { ov.classList.add('show'); });
  return close;
}

function _filePreviewDlPanel(icon, heading, text, downloadUrl, openUrl) {
  return '<div class="file-preview-dlpanel"><i class="fa-solid ' + icon + '" aria-hidden="true"></i>' +
    '<div class="fp-dl-h">' + escapeHtml(heading) + '</div><p>' + escapeHtml(text) + '</p>' +
    (downloadUrl ? '<a class="btn btn-primary file-preview-dl-big" href="' + escapeHtml(downloadUrl) + '" target="_blank" rel="noopener" download><i class="fa-solid fa-download"></i> ดาวน์โหลดไฟล์</a>' : '') +
    (!downloadUrl && openUrl ? '<a class="btn btn-secondary" href="' + escapeHtml(openUrl) + '" target="_blank" rel="noopener">เปิดไฟล์</a>' : '') +
    '</div>';
}
function _filePreviewBodyHtml(previewUrl, title, openUrl, downloadUrl, kind) {
  var id = driveFileId(openUrl || previewUrl);
  if (kind === 'image' && id) {
    return '<div class="file-preview-imgwrap"><img class="file-preview-img" src="https://lh3.googleusercontent.com/d/' + id + '=w2000" data-fallback="https://drive.google.com/thumbnail?id=' + id + '&sz=w2000" alt="' + escapeHtml(title || 'รูปภาพ') + '" referrerpolicy="no-referrer" /></div>';
  }
  // 1.72: Word/Excel/PowerPoint และไฟล์ชนิดอื่น พรีวิวผ่านตัวแสดงตัวอย่างของ Google Drive ทุกหน้า (เดิม 1.50 ให้ดาวน์โหลดอย่างเดียว)
  //       แสดงข้อความให้ดาวน์โหลดเฉพาะกรณีหา id ไฟล์ Drive ไม่เจอ
  if ((kind === 'office' || kind === 'other') && id) kind = 'pdf';
  if (kind === 'office') {
    var lbl = officeKindLabel(title);
    var ic = lbl === 'Excel' ? 'fa-file-excel' : lbl === 'PowerPoint' ? 'fa-file-powerpoint' : 'fa-file-word';
    return _filePreviewDlPanel(ic + ' office-' + lbl.toLowerCase(), 'ไฟล์ ' + lbl + ' — ดาวน์โหลดไปเปิดในคอมพิวเตอร์', 'ไฟล์ ' + lbl + ' แสดงตัวอย่างบนเว็บแล้วรูปแบบเอกสารจะเพี้ยน จึงให้ดาวน์โหลดไปเปิดด้วยโปรแกรม ' + lbl + ' ในเครื่องแทน', downloadUrl, openUrl);
  }
  if (kind === 'other') {
    return _filePreviewDlPanel('fa-file', 'ไฟล์ชนิดนี้แสดงตัวอย่างไม่ได้', 'ดาวน์โหลดไปเปิดด้วยโปรแกรมในเครื่องได้เลย', downloadUrl, openUrl);
  }
  return '<iframe class="file-preview-iframe" src="' + escapeHtml(previewUrl) + '" title="' + escapeHtml(title || 'พรีวิวไฟล์') + '" allow="autoplay" loading="eager"></iframe>';
}

// ---------- ป็อปอัพทั้งเว็บ: กดพื้นที่ว่างรอบป็อปอัพ = ป็อปอัพเด้งกระพริบเตือน (ไม่ปิด) — ตั้งแต่ 1.46.121026 ----------
// ใช้กับทุก .modal-backdrop ทุกหน้า รวมถึงป็อปอัพที่สร้างทีหลัง (ผูก event ที่ document ครั้งเดียว) — ยกเว้นพรีวิวไฟล์ (openFilePreview)
// และกล่องเปิดหนังสือใน view.html ซึ่งกดพื้นที่ว่างแล้วปิดตามเดิม (ไม่ใช่ .modal-backdrop)
// ต้องกดลงและปล่อยบนพื้นที่ว่างทั้งคู่ — กันกรณีลากคลุมข้อความในช่องกรอกแล้วปล่อยเมาส์นอกป็อปอัพ
(function () {
  var downOnBackdrop = null;
  document.addEventListener('mousedown', function (e) {
    downOnBackdrop = (e.target && e.target.classList && e.target.classList.contains('modal-backdrop')) ? e.target : null;
  }, true);
  document.addEventListener('click', function (e) {
    var bd = e.target;
    if (!bd || !bd.classList || !bd.classList.contains('modal-backdrop') || bd !== downOnBackdrop) return;
    var box = bd.querySelector('.modal-box');
    if (!box) return;
    box.classList.remove('modal-bump');
    void box.offsetWidth; // รีสตาร์ทแอนิเมชันเมื่อกดซ้ำเร็วๆ
    box.classList.add('modal-bump');
    setTimeout(function () { box.classList.remove('modal-bump'); }, 520);
  });
})();

// เรียกทันทีตอนโหลดสคริปต์เพื่อกันธีมกะพริบ (เผื่อกรณี inline script หัวไฟล์ไม่ทำงาน)
// ยกเว้นหน้าล็อกอิน (index.html) ที่บังคับใช้ธีมสว่างเท่านั้นเสมอ ไม่ว่าจะเคยตั้งค่าธีมมืดไว้จากหน้าอื่นในเครื่องเดียวกันหรือไม่ก็ตาม
function _isLoginPage() {
  var p = location.pathname;
  return /\/index\.html$/.test(p) || /\/$/.test(p) || p === '';
}
// หน้าแสดงผลงานสาธารณะ (view.html) ก็บังคับใช้ธีมสว่างเท่านั้นเสมอเช่นกัน (ตั้งแต่ V9.9) — เป็นหน้าที่คนภายนอกเปิดดูได้โดยไม่ล็อกอิน
// ไม่ควรพึ่งค่า localStorage ของเบราว์เซอร์คนดู (ซึ่งอาจไม่ใช่เจ้าของบัญชีเลยด้วยซ้ำ) มากำหนดหน้าตาของหน้านี้
function _isForcedLightPage() {
  return _isLoginPage() || /\/(view|certificate|photos)\.html$/.test(location.pathname); // 1.75: หน้าค้นหาเกียรติบัตร · 1.76: หน้าคลังรูปภาพสาธารณะ
}
applyTheme(_isForcedLightPage() ? 'light' : getTheme());

// ---------- 1.68: ตัวเลือกกลุ่มเป้าหมาย (สำหรับ) ของกำหนดการ/ประกาศ ----------
// ค่าที่เก็บ: 'all' | 'g:กลุ่ม|กลุ่ม' | 'u:id|id' (ค่าเดิม = userId คนเดียว) — Worker ตรวจ/กรองด้วยรูปแบบเดียวกัน (lib/util.js)
function parseAudienceStr(a) {
  var s = String(a || 'all');
  if (s === 'all') return { type: 'all', ids: [] };
  if (s.indexOf('g:') === 0) return { type: 'groups', ids: s.slice(2).split('|').filter(Boolean) };
  if (s.indexOf('u:') === 0) return { type: 'people', ids: s.slice(2).split('|').filter(Boolean) };
  return { type: 'people', ids: [s] };
}
function audienceLabel(a, users) {
  var p = parseAudienceStr(a);
  if (p.type === 'all') return 'ทั้งหมด';
  if (p.type === 'groups') return p.ids.map(function (d) { return groupLabel(d); }).join(', ');
  var names = p.ids.map(function (id) { var u = (users || []).filter(function (x) { return x.id === id; })[0]; return u ? u.name : ''; }).filter(Boolean);
  if (!names.length) return 'รายบุคคล ' + p.ids.length + ' คน';
  return names.length > 3 ? names.slice(0, 3).join(', ') + ' และอีก ' + (names.length - 3) + ' คน' : names.join(', ');
}
// สร้างตัวเลือกใน el (div ว่าง) — opts: { departments: [...], users: [{id,name,department}] } · คืน { get(), set(a), check() }
function createAudiencePicker(el, opts) {
  opts = opts || {};
  var state = { type: 'all', groups: {}, people: {} };
  var q = '';
  el.classList.add('aud-pick');
  el.innerHTML =
    '<div class="aud-seg" role="radiogroup" aria-label="สำหรับ">' +
      '<button type="button" role="radio" data-aud="all"><i class="fa-solid fa-users" aria-hidden="true"></i> ทั้งหมด</button>' +
      '<button type="button" role="radio" data-aud="groups"><i class="fa-solid fa-sitemap" aria-hidden="true"></i> กลุ่มบริหารงาน</button>' +
      '<button type="button" role="radio" data-aud="people"><i class="fa-solid fa-user-check" aria-hidden="true"></i> รายบุคคล</button>' +
    '</div>' +
    '<div class="aud-groups" hidden></div>' +
    '<div class="aud-people" hidden><div class="aud-sel"></div><input type="search" class="aud-q" placeholder="ค้นหาชื่อ…" aria-label="ค้นหาชื่อ" /><div class="aud-list"></div></div>';
  var seg = el.querySelector('.aud-seg'), gBox = el.querySelector('.aud-groups'), pBox = el.querySelector('.aud-people');
  function users() { return (typeof opts.users === 'function' ? opts.users() : opts.users) || []; }
  function depts() { return (typeof opts.departments === 'function' ? opts.departments() : opts.departments) || []; }
  function render() {
    Array.prototype.forEach.call(seg.querySelectorAll('[data-aud]'), function (b) { var on = b.getAttribute('data-aud') === state.type; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    gBox.hidden = state.type !== 'groups'; pBox.hidden = state.type !== 'people';
    if (state.type === 'groups') {
      gBox.innerHTML = depts().map(function (d) {
        var c = deptThemeColor(d), on = !!state.groups[d];
        return '<label class="aud-g' + (on ? ' on' : '') + '"' + (c ? ' style="--g:' + c + '"' : '') + '><input type="checkbox" data-g="' + escapeHtml(d) + '"' + (on ? ' checked' : '') + ' /><span>' + escapeHtml(groupLabel(d)) + '</span></label>';
      }).join('') || '<div class="hint">ยังไม่มีกลุ่มบริหารงาน</div>';
    }
    if (state.type === 'people') {
      var us = users(), sel = us.filter(function (u) { return state.people[u.id]; });
      pBox.querySelector('.aud-sel').innerHTML = sel.length ? sel.map(function (u) { return '<span class="aud-chip">' + escapeHtml(u.name) + '<button type="button" data-unp="' + escapeHtml(u.id) + '" aria-label="เอาออก">✕</button></span>'; }).join('') + '<span class="aud-count">เลือก ' + sel.length + ' คน</span>' : '<span class="hint">ยังไม่ได้เลือก — ติ๊กชื่อด้านล่าง</span>';
      var nq = q.replace(/\s+/g, '').toLowerCase();
      var list = us.filter(function (u) { return !nq || String(u.name).replace(/\s+/g, '').toLowerCase().indexOf(nq) !== -1 || String(u.department || '').indexOf(q.trim()) !== -1; });
      pBox.querySelector('.aud-list').innerHTML = list.map(function (u) {
        return '<label class="aud-p"><input type="checkbox" data-p="' + escapeHtml(u.id) + '"' + (state.people[u.id] ? ' checked' : '') + ' /><span>' + escapeHtml(u.name) + '</span>' + (u.department ? '<small>' + escapeHtml(groupLabel(u.department)) + '</small>' : '') + '</label>';
      }).join('') || '<div class="hint" style="padding:8px">ไม่พบชื่อ</div>';
    }
  }
  seg.addEventListener('click', function (e) { var b = e.target.closest('[data-aud]'); if (!b) return; state.type = b.getAttribute('data-aud'); render(); });
  gBox.addEventListener('change', function (e) { var c = e.target.closest('[data-g]'); if (!c) return; if (c.checked) state.groups[c.getAttribute('data-g')] = true; else delete state.groups[c.getAttribute('data-g')]; render(); });
  pBox.addEventListener('change', function (e) { var c = e.target.closest('[data-p]'); if (!c) return; if (c.checked) state.people[c.getAttribute('data-p')] = true; else delete state.people[c.getAttribute('data-p')]; render(); });
  pBox.addEventListener('click', function (e) { var b = e.target.closest('[data-unp]'); if (!b) return; delete state.people[b.getAttribute('data-unp')]; render(); });
  pBox.querySelector('.aud-q').addEventListener('input', function () { q = this.value; render(); });
  var api = {
    get: function () {
      if (state.type === 'groups') return 'g:' + Object.keys(state.groups).join('|');
      if (state.type === 'people') return 'u:' + Object.keys(state.people).join('|');
      return 'all';
    },
    set: function (a) {
      var p = parseAudienceStr(a); state = { type: p.type, groups: {}, people: {} }; q = ''; pBox.querySelector('.aud-q').value = '';
      p.ids.forEach(function (id) { if (p.type === 'groups') state.groups[id] = true; else state.people[id] = true; });
      render();
    },
    // คืนข้อความผิดพลาด หรือ '' ถ้าใช้ได้
    check: function () {
      if (state.type === 'groups' && !Object.keys(state.groups).length) return 'กรุณาเลือกกลุ่มบริหารงานอย่างน้อย 1 กลุ่ม';
      if (state.type === 'people' && !Object.keys(state.people).length) return 'กรุณาเลือกบุคคลอย่างน้อย 1 คน';
      return '';
    },
    refresh: render
  };
  render();
  return api;
}

// ======================================================================
// 1.75: กระดิ่งแจ้งเตือน + แจ้งปัญหา
// ======================================================================
var NOTIF_KIND = {
  cert_reserved: ['fa-hashtag', '#ea580c'], cert_uploaded: ['fa-award', '#d97706'], order: ['fa-file-signature', '#2563eb'], album: ['fa-images', '#0d9488'], album_deleted: ['fa-trash-can', '#dc2626'],
  report_new: ['fa-inbox', '#ef4444'], report_reply: ['fa-reply', '#7c3aed'], report_status: ['fa-headset', '#7c3aed'],
  report_done: ['fa-circle-check', '#16a34a'], report_forward: ['fa-share', '#0891b2'],
  // 1.80: ตรวจผลงาน + เตือนกำหนดส่ง
  review_ok: ['fa-circle-check', '#16a34a'], review_fix: ['fa-pen-to-square', '#ca8a04'], review_resubmit: ['fa-file-arrow-up', '#0369a1'],
  due_soon: ['fa-clock', '#d97706'], due_today: ['fa-calendar-day', '#ea580c'], due_late: ['fa-hourglass-end', '#dc2626'],
  activity_new: ['fa-flag', '#16a34a'], activity_soon: ['fa-flag', '#0d9488'] // 1.81: กิจกรรม
};
function applyTopBadges(r) {
  if (!r) return;
  if (r.welcome) openWelcome(); // 1.79: ป็อปอัพต้อนรับครั้งแรกของบัญชี
  var b = document.getElementById('notifBadge');
  if (b && typeof r.notifUnread === 'number') {
    b.textContent = r.notifUnread > 99 ? '99+' : String(r.notifUnread);
    b.hidden = !r.notifUnread;
    var btn = document.getElementById('notifBtn');
    if (btn) btn.classList.toggle('has-new', r.notifUnread > 0);
  }
  if (typeof r.reportOpen === 'number') { window.__reportOpenCount = r.reportOpen; if (window.__onReportOpenCount) window.__onReportOpenCount(r.reportOpen); }
}
async function refreshTopBadges() {
  if (!getToken() || !document.getElementById('notifBtn')) return;
  try { applyTopBadges(await apiCall('checkSession', {})); } catch (e) { /* รอบถัดไป */ }
}
function notifTimeText(iso) {
  var t = Date.parse(iso); if (!t) return '';
  var diff = (Date.now() - t) / 1000;
  if (diff < 60) return 'เมื่อสักครู่';
  if (diff < 3600) return Math.floor(diff / 60) + ' นาทีที่แล้ว';
  var d = new Date(t), now = new Date();
  if (d.toDateString() === now.toDateString()) return Math.floor(diff / 3600) + ' ชั่วโมงที่แล้ว';
  var y = new Date(now); y.setDate(now.getDate() - 1);
  var hm = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  if (d.toDateString() === y.toDateString()) return 'เมื่อวาน ' + hm;
  return formatDateThai(iso);
}
function notifGroupOf(iso) {
  var t = new Date(Date.parse(iso)), now = new Date();
  if (t.toDateString() === now.toDateString()) return 'วันนี้';
  return (now - t) < 7 * 86400000 ? 'สัปดาห์นี้' : 'ก่อนหน้านี้';
}
// 1.79.2: เมนูในแถบบน/ท้ายหน้าเปิดได้ทีละอัน — เปิดอันหนึ่ง อันอื่นปิดเอง (ทุกเมนูใช้ stopPropagation จึงต้องแจ้งกันเอง)
function announceMenuOpen(name) { document.dispatchEvent(new CustomEvent('bnkah:menu-open', { detail: name })); }
function onOtherMenuOpen(name, closeFn) { document.addEventListener('bnkah:menu-open', function (e) { if (e.detail !== name) closeFn(); }); }
function initNotifBell() {
  var btn = document.getElementById('notifBtn');
  if (!btn) return;
  var panel = document.createElement('div');
  panel.className = 'notif-panel'; panel.id = 'notifPanel'; panel.hidden = true;
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'แจ้งเตือน');
  document.body.appendChild(panel);
  var state = { items: [], due: [], soon: [], more: false, limit: 30, filter: 'all', loading: false };
  function itemHtml(n) {
    var k = NOTIF_KIND[n.kind] || ['fa-bell', '#64748b'];
    var tm = n.activityDate ? formatDateThai(n.dueDate) : n.dueDate ? 'กำหนดส่ง ' + formatDateThai(n.dueDate) : notifTimeText(n.createdAt);
    return '<button type="button" class="notif-item' + (n.unread ? ' unread' : '') + (n.pinned ? ' pinned' : '') + '" data-nid="' + escapeHtml(n.id) + '">' +
      '<span class="notif-ic" style="background:' + k[1] + '"><i class="fa-solid ' + k[0] + '" aria-hidden="true"></i></span>' +
      '<span class="notif-tx"><span class="notif-t">' + escapeHtml(n.title) + '</span>' + (n.body ? '<span class="notif-b">' + escapeHtml(n.body) + '</span>' : '') +
      '<span class="notif-tm">' + escapeHtml(tm) + (n.dept ? ' · ' + escapeHtml(groupLabel(n.dept)) : '') + '</span></span>' +
      (n.unread ? '<span class="notif-dot" aria-label="ยังไม่อ่าน"></span>' : '') + '</button>';
  }
  function render() {
    var list = state.items.filter(function (n) { return state.filter === 'all' || n.unread; });
    var unreadRead = state.items.filter(function (n) { return n.unread; }).length;
    var unread = unreadRead; // 1.81: งานที่ต้องส่ง/กิจกรรมใกล้ถึงปักไว้แยก ไม่นับเป็น "ยังไม่อ่าน"
    var html = '<div class="notif-head"><i class="fa-solid fa-bell" aria-hidden="true"></i><b>แจ้งเตือน</b>' +
      (unreadRead ? '<button type="button" class="notif-readall" data-nact="readall">อ่านทั้งหมดแล้ว</button>' : '') + '</div>' +
      '<div class="notif-filter"><button type="button" data-nf="all" class="' + (state.filter === 'all' ? 'on' : '') + '">ทั้งหมด</button>' +
      '<button type="button" data-nf="unread" class="' + (state.filter === 'unread' ? 'on' : '') + '">ยังไม่อ่าน (' + unread + ')</button></div><div class="notif-list">';
    if (state.loading && !state.items.length) html += '<div class="notif-empty"><span class="loading">กำลังโหลด</span></div>';
    else if (!list.length && !state.due.length && !state.soon.length) html += '<div class="notif-empty"><i class="fa-solid fa-bell-slash" aria-hidden="true"></i>' + (state.filter === 'unread' ? 'อ่านครบทุกรายการแล้ว' : 'ยังไม่มีแจ้งเตือนใหม่<br>เกียรติบัตร คำสั่ง และเรื่องที่แจ้ง จะแสดงที่นี่') + '</div>';
    else {
      // 1.80: "งานที่ต้องส่ง" ปักไว้บนสุดเสมอ (ทั้ง 2 ตัวกรอง) — หายเมื่อส่งงานแล้ว
      if (state.soon.length) html += '<div class="notif-group">กิจกรรมใกล้ถึง</div>' + state.soon.map(itemHtml).join(''); // 1.81
      if (state.due.length) html += '<div class="notif-group">งานที่ต้องส่ง</div>' + state.due.map(itemHtml).join('');
      var g = '';
      list.forEach(function (n) {
        var grp = notifGroupOf(n.createdAt);
        if (grp !== g) { g = grp; html += '<div class="notif-group">' + grp + '</div>'; }
        html += itemHtml(n);
      });
      if (state.more && state.filter === 'all') html += '<button type="button" class="notif-more" data-nact="more">ดูเพิ่ม</button>';
    }
    html += '</div><div class="notif-foot">แจ้งเตือนเก็บไว้ 30 วัน แล้วลบอัตโนมัติ</div>';
    panel.innerHTML = html;
  }
  async function load() {
    state.loading = true; render();
    try { var r = await apiCall('notifList', { limit: state.limit }); state.items = r.items || []; state.due = r.due || []; state.soon = r.soon || []; state.more = !!r.more; applyTopBadges({ notifUnread: 0 }); } // 1.81: เปิดกระดิ่ง = เลขหาย (งานที่ต้องส่งเตือนใหม่พรุ่งนี้)
    catch (e) { panel.querySelector('.notif-list').innerHTML = '<div class="notif-empty">' + escapeHtml(e.message) + '</div>'; state.loading = false; return; }
    state.loading = false; render();
  }
  function place() {
    var r = btn.getBoundingClientRect();
    if (window.innerWidth <= 640) { panel.style.left = '0px'; panel.style.right = '0px'; panel.style.top = (r.bottom + 8) + 'px'; panel.classList.add('mobile'); return; }
    panel.classList.remove('mobile');
    panel.style.top = (r.bottom + 10) + 'px';
    panel.style.right = Math.max(8, window.innerWidth - r.right - 60) + 'px';
    panel.style.left = 'auto';
  }
  function open() {
    announceMenuOpen('notif');
    place(); panel.hidden = false; btn.setAttribute('aria-expanded', 'true');
    applyTopBadges({ notifUnread: 0 }); // เปิดกล่อง = ตัวเลขแดงหาย (จุดยังไม่อ่านยังอยู่)
    apiCall('notifSeen', {}).catch(function () {});
    load();
  }
  function close() { panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  onOtherMenuOpen('notif', function () { if (!panel.hidden) close(); });
  btn.addEventListener('click', function (e) { e.stopPropagation(); if (panel.hidden) open(); else close(); });
  // 1.76: กดตัวกรอง/ปุ่มในกล่องแล้วกล่องวาดใหม่ (ปุ่มที่กดหลุดจากหน้า) — ใช้เส้นทางของเหตุการณ์ตอนกด ไม่ใช่ตำแหน่งปัจจุบันของปุ่ม
  document.addEventListener('click', function (e) {
    if (panel.hidden) return;
    var path = e.composedPath ? e.composedPath() : [];
    if (path.indexOf(panel) !== -1 || btn.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) close(); });
  window.addEventListener('resize', function () { if (!panel.hidden) place(); });
  panel.addEventListener('click', async function (e) {
    var f = e.target.closest('[data-nf]');
    if (f) { state.filter = f.getAttribute('data-nf'); render(); return; }
    var a = e.target.closest('[data-nact]');
    if (a && a.getAttribute('data-nact') === 'readall') {
      state.items.forEach(function (n) { n.unread = false; }); render();
      apiCall('notifRead', { all: true }).catch(function () {});
      return;
    }
    if (a && a.getAttribute('data-nact') === 'more') { state.limit += 30; load(); return; }
    var it = e.target.closest('[data-nid]');
    if (!it) return;
    var n = state.items.concat(state.due, state.soon).filter(function (x) { return x.id === it.getAttribute('data-nid'); })[0];
    if (!n) return;
    if (n.unread && !n.pinned) { n.unread = false; render(); try { await apiCall('notifRead', { id: n.id }); } catch (err) { /* ข้าม */ } }
    close();
    var link = n.link || '';
    if (/^#report:/.test(link)) { openReportModal({ tab: 'mine', focus: link.slice(8) }); return; }
    var here = location.pathname.split('/').pop() || 'index.html';
    if (link.split('#')[0] === here) { location.hash = link.split('#')[1] || ''; if (window.__onHashTab) window.__onHashTab(); return; }
    if (link) location.href = link;
  });
}

// ======================================================================
// 1.80: PWA — ติดตั้งแอปลงมือถือ/คอม (ไม่มีแจ้งเตือนในโทรศัพท์)
// Android/คอม (Chrome, Edge): เก็บเหตุการณ์ beforeinstallprompt ไว้ แล้วเรียกหน้าต่างติดตั้งของระบบเมื่อกดเมนู
// iPhone/iPad: เว็บสั่งติดตั้งเองไม่ได้ (Apple ไม่อนุญาต) → ป็อปอัพบอกวิธี 3 ขั้น · เปิดจากแอปที่ติดตั้งแล้ว = ซ่อนเมนู
// ======================================================================
var _deferredInstall = null;
function isStandaloneApp() { try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; } }
function isIosDevice() { var ua = navigator.userAgent || ''; return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); }
function canOfferInstall() { return !isStandaloneApp() && (!!_deferredInstall || isIosDevice()); }
function updateInstallItem() {
  var b = document.getElementById('ddInstall'), d = document.getElementById('ddInstallDiv');
  if (!b) return;
  var on = canOfferInstall(); b.hidden = !on; if (d) d.hidden = !on;
}
window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); _deferredInstall = e; updateInstallItem(); });
window.addEventListener('appinstalled', function () { _deferredInstall = null; updateInstallItem(); try { showToast('ติดตั้งแอปเรียบร้อยแล้ว'); } catch (e) { /* ข้าม */ } });
async function startInstallApp() {
  if (_deferredInstall) {
    var ev = _deferredInstall; _deferredInstall = null;
    try { ev.prompt(); await ev.userChoice; } catch (e) { /* ข้าม — ถ้ากดยกเลิก เบราว์เซอร์จะส่ง beforeinstallprompt มาใหม่ภายหลังเอง */ }
    updateInstallItem();
    return;
  }
  if (isIosDevice()) openIosInstallHelp();
}
function openIosInstallHelp() {
  var m = document.getElementById('iosInstallModal');
  if (!m) {
    m = document.createElement('div');
    m.className = 'modal-backdrop'; m.id = 'iosInstallModal'; m.hidden = true;
    m.innerHTML = '<div class="modal-box ios-install-box" role="dialog" aria-modal="true" aria-labelledby="iosInstallTitle">' +
      '<button type="button" class="modal-close-x" data-ios-close aria-label="ปิด">✕</button>' +
      '<div class="ios-install-head"><img src="icons/apple-touch-icon.png" alt="" /><div><h3 id="iosInstallTitle">ติดตั้ง BNK Hub บน iPhone / iPad</h3><p class="hint">ใช้เวลาไม่ถึงนาที ทำครั้งเดียว</p></div></div>' +
      '<ol class="ios-install-steps">' +
        '<li>แตะปุ่ม <span class="ios-ic"><i class="fa-solid fa-arrow-up-from-bracket" aria-hidden="true"></i></span> <b>แชร์</b> ที่แถบของ Safari</li>' +
        '<li>เลื่อนลงแล้วแตะ <b>"เพิ่มไปยังหน้าจอโฮม"</b> <span class="ios-ic"><i class="fa-solid fa-square-plus" aria-hidden="true"></i></span></li>' +
        '<li>แตะ <b>"เพิ่ม"</b> มุมขวาบน</li>' +
      '</ol>' +
      '<p class="ios-install-note">ต้องเปิดเว็บนี้ด้วย Safari · เข้าแอปครั้งแรกต้องเข้าสู่ระบบอีกครั้ง (ติ๊ก "เข้าสู่ระบบอัตโนมัติ" ไว้ จะไม่ต้องเข้าบ่อย)</p>' +
      '<div class="modal-actions"><button type="button" class="btn btn-ghost btn-close" data-ios-close>ปิด</button></div></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target.closest('[data-ios-close]')) hideModalEl(m); });
  }
  showModalEl(m);
}
if ('serviceWorker' in navigator && (location.protocol === 'https:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname))) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () { /* ไม่เป็นไร — ใช้งานเว็บได้ตามปกติ */ }); });
}

// 1.80: แถบแท็บที่เลื่อนได้ (มือถือ) — ขอบจางบอกว่ายังมีแท็บซ่อนอยู่ทางซ้าย/ขวา · กดแท็บแล้วเลื่อนให้เห็นทั้งแท็บ
function syncTabScrollHints(el) {
  var max = el.scrollWidth - el.clientWidth;
  el.classList.toggle('more-r', max > 2 && el.scrollLeft < max - 2);
  el.classList.toggle('more-l', max > 2 && el.scrollLeft > 2);
}
function initTabScrollHints() {
  document.querySelectorAll('.tabs').forEach(function (el) {
    if (el.__hint) { syncTabScrollHints(el); return; }
    el.__hint = true;
    el.addEventListener('scroll', function () { syncTabScrollHints(el); }, { passive: true });
    el.addEventListener('click', function (e) { var b = e.target.closest('.tab-btn'); if (b && b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }); });
    syncTabScrollHints(el);
  });
}
window.addEventListener('resize', function () { document.querySelectorAll('.tabs').forEach(syncTabScrollHints); });
document.addEventListener('DOMContentLoaded', function () { initTabScrollHints(); setTimeout(initTabScrollHints, 800); setTimeout(initTabScrollHints, 2500); });

// ---------- แจ้งปัญหา (ป็อปอัพ) ----------
var REPORT_STATUS = { open: ['รอรับเรื่อง', 'st-open'], progress: ['กำลังดำเนินการ', 'st-progress'], done: ['เสร็จแล้ว', 'st-done'] };
function reportStatusChip(st) { var s = REPORT_STATUS[st] || [st, '']; return '<span class="rp-status ' + s[1] + '">' + escapeHtml(s[0]) + '</span>'; }
function reportTargetChip(r) {
  if (r.target === 'system') return '<span class="rp-chip rp-sys"><i class="fa-solid fa-laptop-code" aria-hidden="true"></i> การใช้งานระบบ</span>';
  return '<span class="rp-chip"' + deptColorAttr(r.department) + '><i class="fa-solid fa-user-group" aria-hidden="true"></i> ' + escapeHtml(groupLabel(r.department)) + '</span>';
}
function reportThreadHtml(msgs) {
  return (msgs || []).map(function (m) {
    if (m.side === 'system') return '<div class="rp-msg rp-msg-sys"><i class="fa-solid fa-share" aria-hidden="true"></i> ' + escapeHtml(m.body) + ' · ' + escapeHtml(notifTimeText(m.createdAt)) + '</div>';
    return '<div class="rp-msg ' + (m.side === 'staff' ? 'rp-staff' : 'rp-reporter') + '"><div class="rp-who">' + escapeHtml(m.mine ? 'คุณ' : m.authorName) + ' · ' + escapeHtml(formatDateTimeThai(m.createdAt)) + '</div><div class="rp-body">' + escapeHtml(m.body).replace(/\n/g, '<br>') + '</div></div>';
  }).join('');
}
function reportFilesHtml(files) {
  if (!files || !files.length) return '';
  return '<div class="rp-files">' + files.map(function (f, i) {
    return '<button type="button" class="rp-file" data-rp-img="' + i + '" title="ดูภาพ"><img src="https://lh3.googleusercontent.com/d/' + encodeURIComponent(f.fileId) + '=w240" alt="ภาพแนบ ' + (i + 1) + '" referrerpolicy="no-referrer" loading="lazy" /></button>';
  }).join('') + '</div>';
}
function openReportImages(files, i) {
  var list = files.map(function (f, k) { return { url: 'https://drive.google.com/file/d/' + f.fileId + '/preview', title: 'ภาพแนบ ' + (k + 1) }; });
  (function show(j) { openFilePreview(list[j].url, list[j].title, '', '', list.length > 1 ? { index: j, total: list.length, go: show } : null, 'image'); })(i);
}
function reportClientInfo() {
  var ua = navigator.userAgent || '', b = 'เบราว์เซอร์อื่น', o = 'อื่นๆ', m;
  if ((m = /Edg\/(\d+)/.exec(ua))) b = 'Edge ' + m[1];
  else if ((m = /Chrome\/(\d+)/.exec(ua)) && !/OPR\//.test(ua)) b = 'Chrome ' + m[1];
  else if ((m = /Firefox\/(\d+)/.exec(ua))) b = 'Firefox ' + m[1];
  else if ((m = /Version\/(\d+).*Safari/.exec(ua))) b = 'Safari ' + m[1];
  if (/Windows NT 10/.test(ua)) o = 'Windows 10/11'; else if (/Windows/.test(ua)) o = 'Windows';
  else if (/Android (\d+)/.test(ua)) o = 'Android ' + /Android (\d+)/.exec(ua)[1];
  else if (/iPhone|iPad/.test(ua)) o = 'iOS'; else if (/Mac OS X/.test(ua)) o = 'macOS'; else if (/Linux/.test(ua)) o = 'Linux';
  var page = (document.querySelector('.page-header h1') || {}).textContent || document.title || location.pathname;
  return { page: String(page).trim().slice(0, 100), ua: b + ' · ' + o + ' · จอ ' + screen.width + '×' + screen.height };
}
var _reportModal = null;
// ---------- 1.79: ป็อปอัพต้อนรับ (ครั้งแรกของบัญชี — จำในฐานข้อมูล users.welcomed_at) ----------
var _welcomeOpen = false;
var WELCOME_ITEMS = {
  t: [['fa-paper-plane', '#0b6fcc', 'ส่งผลงาน', 'กดปุ่ม "ส่งงาน" ในหน้าแรก ตามรายการกำหนดส่ง'], ['fa-bell', '#f59e0b', 'กระดิ่งแจ้งเตือน', 'เกียรติบัตรที่มีชื่อคุณ คำสั่งและอัลบั้มใหม่'], ['fa-book-open', '#7c3aed', 'คู่มือการใช้งาน', 'ปุ่มรูปหนังสือ มุมขวาบน มีภาพประกอบทุกขั้นตอน'], ['fa-headset', '#ef4444', 'แจ้งปัญหา', 'กดชื่อของคุณมุมขวาบน แล้วเลือก "แจ้งปัญหา"']],
  s: [['fa-bullhorn', '#0b6fcc', 'ประกาศและปฏิทิน', 'เพิ่มประกาศและกำหนดส่งงาน แสดงในหน้าแรกของครู'], ['fa-inbox', '#ef4444', 'เรื่องที่แจ้ง', 'เรื่องที่ครูแจ้งถึงกลุ่มคุณ อยู่ในหน้าประกาศและปฏิทิน'], ['fa-bell', '#f59e0b', 'กระดิ่งแจ้งเตือน', 'เรื่องที่แจ้งใหม่ เกียรติบัตร คำสั่งและอัลบั้มใหม่'], ['fa-book-open', '#7c3aed', 'คู่มือการใช้งาน', 'ปุ่มรูปหนังสือ มุมขวาบน มีภาพประกอบทุกขั้นตอน']],
  e: [['fa-chart-pie', '#0b6fcc', 'หน้าแรกผู้บริหาร', 'ปฏิทินและภาพรวมการส่งงานของบุคลากร'], ['fa-chart-column', '#16a34a', 'สรุปรวมการส่งงาน', 'ดูว่าใครส่งงานอะไรแล้วบ้าง แยกตามงาน'], ['fa-bell', '#f59e0b', 'กระดิ่งแจ้งเตือน', 'คำสั่งและอัลบั้มรูปภาพใหม่'], ['fa-book-open', '#7c3aed', 'คู่มือการใช้งาน', 'ปุ่มรูปหนังสือ มุมขวาบน มีภาพประกอบทุกขั้นตอน']]
};
function openWelcome() {
  if (_welcomeOpen || document.getElementById('welcomeModal')) return;
  var s = getSession(); if (!s) return;
  var role = s.role === 'executive' ? 'e' : (s.role === 'admin' && s.hasHub ? 's' : 't');
  if (s.role === 'admin' && !s.hasHub) return;
  _welcomeOpen = true;
  var site = (cachedBrand() && cachedBrand().siteName) || 'BNKAcademicHub';
  var el = document.createElement('div');
  el.className = 'modal-backdrop'; el.id = 'welcomeModal'; el.hidden = true;
  el.innerHTML = '<div class="modal-box wl-box" role="dialog" aria-modal="true" aria-labelledby="welcomeTitle">' +
    '<button type="button" class="modal-close-x" id="welcomeX" aria-label="ปิด">✕</button>' +
    '<div class="wl-hd"><h3 id="welcomeTitle">ยินดีต้อนรับ, ' + escapeHtml(s.name || '') + '</h3><p>' + escapeHtml(site) + ' — รู้ 4 อย่างนี้ก็ใช้งานได้เลย</p></div>' +
    '<div class="wl-bd">' + WELCOME_ITEMS[role].map(function (x) {
      return '<div class="wl-it"><span class="wl-ic" style="background:' + x[1] + '"><i class="fa-solid ' + x[0] + '" aria-hidden="true"></i></span><span><b>' + escapeHtml(x[2]) + '</b><small>' + escapeHtml(x[3]) + '</small></span></div>';
    }).join('') + '</div>' +
    '<div class="wl-ft"><small>แสดงครั้งเดียว · เปิดดูอีกได้ในคู่มือ</small><span class="wl-btns"><button type="button" class="btn btn-secondary" id="welcomeManual"><i class="fa-solid fa-book-open" aria-hidden="true"></i> เปิดคู่มือ</button><button type="button" class="btn btn-success" id="welcomeGo">เริ่มใช้งาน</button></span></div></div>';
  document.body.appendChild(el);
  function done(thenManual) {
    hideModalEl(el);
    setTimeout(function () { el.remove(); _welcomeOpen = false; }, 250);
    apiCall('welcomeSeen', {}).catch(function () { /* ครั้งหน้าแสดงอีก */ });
    if (thenManual) openManual('start');
  }
  el.querySelector('#welcomeX').addEventListener('click', function () { done(false); });
  el.querySelector('#welcomeGo').addEventListener('click', function () { done(false); });
  el.querySelector('#welcomeManual').addEventListener('click', function () { done(true); });
  showModalEl(el);
}

// ---------- คู่มือการใช้งาน (1.76) — โหลด assets/manual.js เมื่อกดปุ่มครั้งแรก ----------
var _manualLoading = null;
function openManual(topicId) {
  if (typeof manualOpen === 'function') { manualOpen(topicId); return; }
  if (!_manualLoading) {
    _manualLoading = new Promise(function (resolve, reject) {
      var sc = document.createElement('script');
      sc.src = 'assets/manual.js?v=' + APP_VERSION;
      sc.onload = resolve;
      sc.onerror = function () { _manualLoading = null; reject(new Error('โหลดคู่มือไม่สำเร็จ — ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่')); };
      document.head.appendChild(sc);
    });
  }
  _manualLoading.then(function () { manualOpen(topicId); }).catch(function (e) { showToast(e.message, true); });
}
function openReportModal(opts) {
  opts = opts || {};
  if (!_reportModal) {
    var el = document.createElement('div');
    el.className = 'modal-backdrop'; el.id = 'reportModal'; el.hidden = true;
    el.innerHTML = '<div class="modal-box modal-box-wide rp-box" role="dialog" aria-modal="true" aria-labelledby="reportModalTitle">' +
      '<button type="button" class="modal-close-x" id="reportModalX" aria-label="ปิด">✕</button>' +
      '<h3 id="reportModalTitle"><i class="fa-solid fa-headset" aria-hidden="true"></i> แจ้งปัญหา</h3>' +
      '<div class="rp-tabs" role="tablist"><button type="button" role="tab" data-rptab="new" class="on">แจ้งเรื่องใหม่</button><button type="button" role="tab" data-rptab="mine">เรื่องที่ฉันแจ้ง</button></div>' +
      '<div class="rp-body" id="reportModalBody"></div>' +
      '<div class="modal-actions" id="reportModalActions"></div></div>';
    document.body.appendChild(el);
    _reportModal = { el: el, tab: 'new', step: 1, target: null, files: [], meta: null, mine: null, open: '' };
    el.querySelector('#reportModalX').addEventListener('click', closeReportModal);
    el.querySelector('.rp-tabs').addEventListener('click', function (e) { var b = e.target.closest('[data-rptab]'); if (b) { _reportModal.tab = b.getAttribute('data-rptab'); renderReportModal(); } });
    el.addEventListener('click', onReportModalClick);
    el.addEventListener('change', onReportModalChange);
  }
  var st = _reportModal;
  st.tab = opts.tab || 'new';
  if (st.tab === 'new' && (st.step !== 2 || !opts.keep)) { st.step = 1; st.target = null; st.files = []; st.subject = ''; st.body = ''; }
  if (opts.focus) st.open = opts.focus;
  if (st.tab === 'mine') st.mine = null;
  showModalEl(st.el);
  renderReportModal();
}
function closeReportModal() { if (_reportModal) hideModalEl(_reportModal.el); }
async function renderReportModal() {
  var st = _reportModal, body = st.el.querySelector('#reportModalBody'), act = st.el.querySelector('#reportModalActions');
  st.el.querySelectorAll('[data-rptab]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-rptab') === st.tab); });
  if (st.tab === 'new') {
    if (!st.meta) {
      body.innerHTML = '<div class="loading">กำลังโหลด</div>'; act.innerHTML = '';
      try { st.meta = await apiCall('reportMeta', {}); } catch (e) { body.innerHTML = '<div class="error-box">' + escapeHtml(e.message) + '</div>'; return; }
    }
    if (st.step === 1) {
      var m = st.meta, h = '<div class="rp-q">ปัญหาเกี่ยวกับอะไร</div>';
      if (m.canSystem) h += '<button type="button" class="rp-sys-card" data-rp-target="system"><span class="rp-ic"><i class="fa-solid fa-laptop-code" aria-hidden="true"></i></span><span><b>การใช้งานระบบ (เว็บมีปัญหา)</b><small>อัพโหลดไม่ได้ · หน้าค้าง/ขึ้นข้อผิดพลาด · ปุ่มกดไม่ทำงาน → ส่งถึงผู้ดูแลระบบ</small></span><i class="fa-solid fa-chevron-right rp-go" aria-hidden="true"></i></button>' +
        '<div class="rp-sep">หรือ เรื่องของกลุ่มบริหารงาน → ส่งถึงเจ้าหน้าที่กลุ่มนั้น</div>';
      h += '<div class="rp-groups">' + m.departments.map(function (d) {
        return '<button type="button" class="rp-group" data-rp-target="dept" data-rp-dept="' + escapeHtml(d.name) + '"' + deptColorAttr(d.name) + '><span class="rp-ic"><i class="fa-solid fa-user-group" aria-hidden="true"></i></span><span><b>' + escapeHtml(d.label) + '</b>' + (d.hint ? '<small>' + escapeHtml(d.hint) + '</small>' : '') + '</span></button>';
      }).join('') + '</div>';
      body.innerHTML = h;
      act.innerHTML = '<button type="button" class="btn btn-close" data-rp-act="close">ปิด</button>';
      return;
    }
    var t = st.target, info = reportClientInfo();
    body.innerHTML = '<div class="rp-to"' + (t.target === 'dept' ? deptColorAttr(t.department) : '') + '><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> ส่งถึง <b>' + escapeHtml(t.target === 'system' ? 'ผู้ดูแลระบบ (การใช้งานระบบ)' : 'เจ้าหน้าที่' + groupLabel(t.department)) + '</b><button type="button" class="rp-change" data-rp-act="back">เปลี่ยน</button></div>' +
      '<label class="rp-l" for="rpSubject">หัวข้อ</label><input type="text" id="rpSubject" maxlength="150" placeholder="' + (t.target === 'system' ? 'เช่น อัพโหลดไฟล์ PowerPoint ไม่ได้' : 'เช่น เกียรติบัตรอบรมไม่ครบ') + '" value="' + escapeHtml(st.subject || '') + '" />' +
      '<label class="rp-l" for="rpBody">รายละเอียดปัญหา</label><textarea id="rpBody" rows="5" maxlength="3000" placeholder="เล่าสิ่งที่เกิดขึ้น · ต้องการให้แก้ไขอะไร">' + escapeHtml(st.body || '') + '</textarea>' +
      '<div class="rp-l">แนบภาพหน้าจอ <span class="rp-hint">(ไม่บังคับ · สูงสุด ' + (st.meta.maxFiles || 3) + ' รูป)</span></div>' +
      '<div class="rp-att">' + st.files.map(function (f, i) { return '<span class="rp-thumb"><img src="' + f.url + '" alt="" /><button type="button" data-rp-rm="' + i + '" aria-label="เอารูปออก">✕</button></span>'; }).join('') +
        (st.files.length < (st.meta.maxFiles || 3) ? '<label class="rp-add" title="เพิ่มรูป"><i class="fa-solid fa-plus" aria-hidden="true"></i><input type="file" id="rpFiles" accept="image/*" multiple hidden /></label>' : '') + '</div>' +
      '<div class="rp-auto"><i class="fa-solid fa-circle-info" aria-hidden="true"></i> ระบบแนบให้อัตโนมัติ: หน้า <b>' + escapeHtml(info.page) + '</b> · ' + escapeHtml(info.ua) + '</div>' +
      '<div class="error-box" id="rpErr" hidden></div>';
    act.innerHTML = '<button type="button" class="btn btn-close" data-rp-act="close">ยกเลิก</button><button type="button" class="btn btn-primary" data-rp-act="send"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> ส่งเรื่อง</button>';
    ['rpSubject', 'rpBody'].forEach(function (id) { document.getElementById(id).addEventListener('input', function (e) { st[id === 'rpSubject' ? 'subject' : 'body'] = e.target.value; }); });
    return;
  }
  // เรื่องที่ฉันแจ้ง
  act.innerHTML = '<button type="button" class="btn btn-close" data-rp-act="close">ปิด</button>';
  if (!st.mine) {
    body.innerHTML = '<div class="loading">กำลังโหลด</div>';
    try { st.mine = (await apiCall('reportListMine', {})).items || []; } catch (e) { body.innerHTML = '<div class="error-box">' + escapeHtml(e.message) + '</div>'; return; }
  }
  if (!st.mine.length) { body.innerHTML = '<div class="empty-state">ยังไม่เคยแจ้งเรื่อง</div>'; return; }
  body.innerHTML = '<div class="rp-mine">' + st.mine.map(function (r) {
    var open = st.open === r.id;
    return '<div class="rp-item' + (open ? ' open' : '') + '" data-rp-id="' + escapeHtml(r.id) + '"><button type="button" class="rp-item-h" data-rp-toggle="' + escapeHtml(r.id) + '"><b>' + escapeHtml(r.subject) + '</b>' + reportStatusChip(r.status) + '</button>' +
      '<div class="rp-item-m">' + reportTargetChip(r) + ' · แจ้งเมื่อ ' + escapeHtml(formatDateTimeThai(r.createdAt)) + '</div>' +
      (open ? '<div class="rp-thread">' + reportFilesHtml(r.files) + reportThreadHtml(r.messages) +
        '<div class="rp-reply"><textarea rows="2" maxlength="3000" placeholder="ตอบกลับ..." data-rp-replytext="' + escapeHtml(r.id) + '"></textarea><button type="button" class="btn btn-primary btn-sm" data-rp-reply="' + escapeHtml(r.id) + '"><i class="fa-solid fa-reply" aria-hidden="true"></i> ส่ง</button></div></div>' : '') +
      '</div>';
  }).join('') + '</div>';
  var foc = st.open && body.querySelector('[data-rp-id="' + st.open + '"]');
  if (foc) foc.scrollIntoView({ block: 'nearest' });
}
async function onReportModalClick(e) {
  var st = _reportModal, b;
  if ((b = e.target.closest('[data-rp-target]'))) {
    st.target = { target: b.getAttribute('data-rp-target'), department: b.getAttribute('data-rp-dept') || '' };
    st.step = 2; renderReportModal(); setTimeout(function () { var i = document.getElementById('rpSubject'); if (i) i.focus(); }, 50); return;
  }
  if ((b = e.target.closest('[data-rp-rm]'))) { st.files.splice(Number(b.getAttribute('data-rp-rm')), 1); renderReportModal(); return; }
  if ((b = e.target.closest('[data-rp-toggle]'))) { var id = b.getAttribute('data-rp-toggle'); st.open = st.open === id ? '' : id; renderReportModal(); return; }
  if ((b = e.target.closest('[data-rp-img]'))) {
    var item = e.target.closest('[data-rp-id]'), rep = item && st.mine.filter(function (x) { return x.id === item.getAttribute('data-rp-id'); })[0];
    if (rep) openReportImages(rep.files, Number(b.getAttribute('data-rp-img'))); return;
  }
  if ((b = e.target.closest('[data-rp-reply]'))) {
    var rid = b.getAttribute('data-rp-reply'), ta = st.el.querySelector('[data-rp-replytext="' + rid + '"]');
    if (!ta || !ta.value.trim()) { if (ta) ta.focus(); return; }
    b.disabled = true;
    try { await apiCall('reportReply', { id: rid, body: ta.value }); st.mine = null; st.open = rid; renderReportModal(); showToast('ส่งข้อความแล้ว'); }
    catch (err) { showToast(err.message, true); b.disabled = false; }
    return;
  }
  if (!(b = e.target.closest('[data-rp-act]'))) return;
  var a = b.getAttribute('data-rp-act');
  if (a === 'close') { closeReportModal(); return; }
  if (a === 'back') { st.step = 1; renderReportModal(); return; }
  if (a === 'send') {
    var err = document.getElementById('rpErr'); err.hidden = true;
    var subject = (st.subject || '').trim(), text = (st.body || '').trim();
    if (!subject) { err.textContent = 'กรุณากรอกหัวข้อ'; err.hidden = false; document.getElementById('rpSubject').focus(); return; }
    if (!text) { err.textContent = 'กรุณากรอกรายละเอียดปัญหา'; err.hidden = false; document.getElementById('rpBody').focus(); return; }
    var info = reportClientInfo();
    var r = await withProgress('กำลังส่งเรื่อง', async function () {
      var files = [];
      for (var i = 0; i < st.files.length; i++) {
        var f = st.files[i].file;
        var prep = await apiCall('reportFilePrepare', { fileName: f.name, mimeType: f.type, fileSize: f.size });
        var res = await fetch(prep.relayUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ uploadToken: prep.uploadToken, base64: await fileToBase64(f), filename: 'แจ้งปัญหา-' + Date.now() + '-' + (i + 1) + '.' + ((/\.(\w+)$/.exec(f.name) || [0, 'png'])[1]), mimeType: f.type }) });
        var j = JSON.parse(await res.text());
        if (!j.ok) throw new Error(j.error || 'อัพโหลดรูปไม่สำเร็จ');
        files.push({ fileId: j.data.fileId, name: f.name });
      }
      return apiCall('reportCreate', { target: st.target.target, department: st.target.department, subject: subject, body: text, page: info.page, ua: info.ua, files: files });
    }, { successLabel: 'ส่งเรื่องเรียบร้อยแล้ว' });
    if (r.ok) { st.step = 1; st.files = []; st.subject = ''; st.body = ''; st.tab = 'mine'; st.mine = null; st.open = r.data && r.data.id; renderReportModal(); }
  }
}
function onReportModalChange(e) {
  if (e.target.id !== 'rpFiles') return;
  var st = _reportModal, max = (st.meta && st.meta.maxFiles) || 3;
  Array.from(e.target.files || []).forEach(function (f) {
    if (st.files.length >= max) return;
    if (!/^image\//.test(f.type)) { showToast('แนบได้เฉพาะไฟล์รูปภาพ', true); return; }
    if (f.size > 8 * 1024 * 1024) { showToast('รูป ' + f.name + ' ใหญ่เกิน 8MB', true); return; }
    st.files.push({ file: f, url: URL.createObjectURL(f) });
  });
  renderReportModal();
}
