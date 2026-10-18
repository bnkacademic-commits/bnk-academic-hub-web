/**
 * BNKAcademicHub — Service Worker (ตั้งแต่ 1.80, PWA)
 * ตั้งใจให้เรียบง่ายที่สุด: ไม่แคชหน้าเว็บ/ข้อมูลไว้ในเครื่อง (กันค้างรุ่นเก่า — ทุกหน้าโหลดจากเซิร์ฟเวอร์เสมอเหมือนเปิดในเบราว์เซอร์)
 * แคชเฉพาะหน้า "ไม่มีการเชื่อมต่ออินเทอร์เน็ต" (offline.html) + ไอคอน ไว้แสดงเมื่อเปิดแอปตอนไม่มีเน็ต · ไม่มีแจ้งเตือนในโทรศัพท์ (push)
 * เปลี่ยน OFFLINE_CACHE เมื่อแก้ offline.html (แคชเก่าถูกลบอัตโนมัติ)
 */
var OFFLINE_CACHE = 'bnkah-offline-1.80';
var OFFLINE_URL = 'offline.html';
var PRECACHE = [OFFLINE_URL, 'icons/icon-192.png', 'assets/fontawesome/css/fontawesome.min.css', 'assets/fontawesome/css/solid.min.css'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(OFFLINE_CACHE).then(function (c) { return c.addAll(PRECACHE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== OFFLINE_CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
// เปิดหน้าเว็บ (navigation) = ดึงจากเครือข่ายเสมอ · ไม่มีเน็ต = หน้า offline · คำขออื่นๆ ไม่ยุ่ง (เบราว์เซอร์จัดการตามปกติ)
self.addEventListener('fetch', function (e) {
  if (e.request.mode !== 'navigate') return;
  var offline = function () { return caches.open(OFFLINE_CACHE).then(function (c) { return c.match(OFFLINE_URL); }); };
  // ไม่มีเน็ต = หน้า offline ทันที (ไม่ใช้หน้าเก่าที่ค้างในแคชของเบราว์เซอร์ ซึ่งจะเปิดได้แต่ไม่มีข้อมูล/สไตล์)
  if (self.navigator && self.navigator.onLine === false) { e.respondWith(offline()); return; }
  e.respondWith(fetch(e.request).catch(offline));
});
