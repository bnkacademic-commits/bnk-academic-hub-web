/* ย้ายมาจากสคริปต์ในหน้า privacy.html — 2.34.3 (ให้เบราว์เซอร์แคชได้ · รองรับ CSP) */
    mountFooter();
    applyBranding();
    // ผู้ใช้ที่ล็อกอินอยู่ → ปุ่ม “กลับ” พาไปหน้าแรกของบทบาทตัวเอง; ถ้ายังไม่ล็อกอิน → หน้าล็อกอิน
    var _privSession = getSession();
    var _privHome = _privSession && getToken() ? homePageFor(_privSession) : 'index.html';
    document.getElementById('privacyBackLink').setAttribute('href', _privHome);
    document.querySelector('.js-home-btn').addEventListener('click', function () { location.href = _privHome; });
  
