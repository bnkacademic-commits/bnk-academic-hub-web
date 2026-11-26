/* ย้ายมาจากสคริปต์ในหน้า intern.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
    (function () {
      var session = requireLogin();
      if (!session) return;
      if (session.role !== 'intern') { location.href = homePageFor(session); return; }
      mountChrome('intern');
      var h = new Date().getHours();
      document.getElementById('ihHello').textContent = (h < 12 ? 'สวัสดีตอนเช้า ' : h < 17 ? 'สวัสดีตอนบ่าย ' : 'สวัสดีตอนเย็น ') + session.name;
      mountInternHome(document.getElementById('ihRoot'));
      window.__refreshPageData = function () { mountInternHome(document.getElementById('ihRoot')); return Promise.resolve(); };
    })();
  
